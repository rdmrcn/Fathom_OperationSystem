import { describe, expect, it } from "vitest";
import { guardReportQuery } from "../../src/modules/assistant/sql-guard.js";

describe("guardReportQuery", () => {
  it("accepts a simple select from a reporting view", () => {
    const r = guardReportQuery("SELECT TaskKey, Title FROM reporting.vTasks WHERE IsOverdue = 1");
    expect(r.ok).toBe(true);
    expect(r.sql).toMatch(/reporting\.vTasks/i);
  });

  it("strips a trailing semicolon and comments", () => {
    const r = guardReportQuery("/* note */ SELECT TOP 10 ProjectKey FROM reporting.vProjects -- trailing\n;");
    expect(r.ok).toBe(true);
  });

  it("rejects mutating statements", () => {
    expect(guardReportQuery("DELETE FROM reporting.vTasks").ok).toBe(false);
    expect(guardReportQuery("UPDATE reporting.vTasks SET Title = 'x'").ok).toBe(false);
    expect(guardReportQuery("INSERT INTO reporting.vTasks SELECT * FROM reporting.vTasks").ok).toBe(false);
    expect(guardReportQuery("DROP TABLE dbo.Users").ok).toBe(false);
  });

  it("rejects dbo and stacked statements", () => {
    expect(guardReportQuery("SELECT * FROM dbo.Users").reason).toMatch(/reporting schema/i);
    expect(guardReportQuery("SELECT 1 FROM reporting.vTasks; SELECT 2 FROM reporting.vUsers").ok).toBe(false);
  });

  it("rejects stored-procedure prefixes", () => {
    expect(guardReportQuery("SELECT * FROM reporting.vTasks WHERE 1=1; EXEC xp_cmdshell 'dir'").ok).toBe(false);
    expect(guardReportQuery("SELECT * FROM reporting.vTasks CROSS APPLY OPENROWSET('a','b')").ok).toBe(false);
  });

  it("allows a join between two reporting views", () => {
    const r = guardReportQuery(
      "SELECT u.Name, COUNT(*) AS n FROM reporting.vTasks t JOIN reporting.vUsers u ON u.UserId = t.AssigneeId GROUP BY u.Name",
    );
    expect(r.ok).toBe(true);
  });
});
