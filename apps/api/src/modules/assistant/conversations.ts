import type { AssistantMessage, AssistantSource, AssistantToolTrace, Conversation, ConversationDetail } from "@stratum/shared";
import type { QueryRunner } from "../../db/pool.js";
import { sql } from "../../db/sql.js";
import { toIso } from "../../lib/mappers.js";

interface ConversationRow {
  id: number;
  title: string;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

interface MessageRow {
  id: number;
  conversationId: number;
  role: "user" | "assistant";
  content: string;
  source: AssistantSource | null;
  toolTrace: string;
  createdAt: Date;
}

function toConversation(row: ConversationRow): Conversation {
  return { id: row.id, title: row.title, messageCount: row.messageCount, createdAt: toIso(row.createdAt), updatedAt: toIso(row.updatedAt) };
}

export function toMessage(row: MessageRow): AssistantMessage {
  let toolTrace: AssistantToolTrace[] = [];
  try {
    const parsed: unknown = JSON.parse(row.toolTrace);
    if (Array.isArray(parsed)) toolTrace = parsed as AssistantToolTrace[];
  } catch {
    toolTrace = [];
  }
  return { id: row.id, conversationId: row.conversationId, role: row.role, content: row.content, source: row.source, toolTrace, createdAt: toIso(row.createdAt) };
}

const conversationSelect = sql`
  SELECT c.Id AS id, c.Title AS title, c.CreatedAt AS createdAt, c.UpdatedAt AS updatedAt,
         (SELECT COUNT(*) FROM dbo.Messages m WHERE m.ConversationId = c.Id) AS messageCount
  FROM dbo.Conversations c`;

export function titleFromMessage(message: string): string {
  const firstLine = message.replace(/\s+/g, " ").trim();
  return firstLine.length > 60 ? `${firstLine.slice(0, 57).trimEnd()}…` : firstLine || "New conversation";
}

export const conversationsRepo = {
  async list(db: QueryRunner, userId: number): Promise<Conversation[]> {
    const rows = await db.query<ConversationRow>(sql`${conversationSelect} WHERE c.UserId = ${userId} ORDER BY c.UpdatedAt DESC`);
    return rows.map(toConversation);
  },

  async find(db: QueryRunner, userId: number, id: number): Promise<Conversation | null> {
    const row = await db.one<ConversationRow>(sql`${conversationSelect} WHERE c.UserId = ${userId} AND c.Id = ${id}`);
    return row ? toConversation(row) : null;
  },

  async detail(db: QueryRunner, userId: number, id: number): Promise<ConversationDetail | null> {
    const conversation = await this.find(db, userId, id);
    if (!conversation) return null;
    const rows = await db.query<MessageRow>(sql`
      SELECT Id AS id, ConversationId AS conversationId, Role AS role, Content AS content, Source AS source, ToolTrace AS toolTrace, CreatedAt AS createdAt
      FROM dbo.Messages WHERE ConversationId = ${id} ORDER BY CreatedAt ASC, Id ASC`);
    return { ...conversation, messages: rows.map(toMessage) };
  },

  /** Recent turns used as model context (oldest first). */
  async history(db: QueryRunner, id: number, limit: number): Promise<AssistantMessage[]> {
    const rows = await db.query<MessageRow>(sql`
      SELECT TOP (${limit}) Id AS id, ConversationId AS conversationId, Role AS role, Content AS content, Source AS source, ToolTrace AS toolTrace, CreatedAt AS createdAt
      FROM dbo.Messages WHERE ConversationId = ${id} ORDER BY CreatedAt DESC, Id DESC`);
    return rows.map(toMessage).reverse();
  },

  async create(db: QueryRunner, userId: number, title: string): Promise<number> {
    const row = await db.one<{ id: number }>(sql`
      INSERT INTO dbo.Conversations (UserId, Title) OUTPUT inserted.Id AS id VALUES (${userId}, ${title})`);
    return row!.id;
  },

  async addMessage(
    db: QueryRunner,
    input: { conversationId: number; role: "user" | "assistant"; content: string; source?: AssistantSource | null; toolTrace?: AssistantToolTrace[] },
  ): Promise<AssistantMessage> {
    const row = await db.one<MessageRow>(sql`
      INSERT INTO dbo.Messages (ConversationId, Role, Content, Source, ToolTrace)
      OUTPUT inserted.Id AS id, inserted.ConversationId AS conversationId, inserted.Role AS role, inserted.Content AS content,
             inserted.Source AS source, inserted.ToolTrace AS toolTrace, inserted.CreatedAt AS createdAt
      VALUES (${input.conversationId}, ${input.role}, ${input.content}, ${input.source ?? null}, ${JSON.stringify(input.toolTrace ?? [])})`);
    await db.execute(sql`UPDATE dbo.Conversations SET UpdatedAt = SYSUTCDATETIME() WHERE Id = ${input.conversationId}`);
    return toMessage(row!);
  },

  remove(db: QueryRunner, userId: number, id: number): Promise<number> {
    return db.execute(sql`DELETE FROM dbo.Conversations WHERE Id = ${id} AND UserId = ${userId}`);
  },
};
