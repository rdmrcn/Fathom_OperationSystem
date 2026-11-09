-- Fathom core schema (SQL Server 2019+)
-- Timestamps are stored in UTC as DATETIME2(3). Enumerations are enforced with CHECK constraints
-- so the database stays consistent even when written outside the API.

CREATE TABLE dbo.Users (
    Id            INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Users PRIMARY KEY,
    Email         NVARCHAR(254)     NOT NULL,
    PasswordHash  NVARCHAR(200)     NOT NULL,
    Name          NVARCHAR(80)      NOT NULL,
    Role          NVARCHAR(20)      NOT NULL CONSTRAINT DF_Users_Role DEFAULT ('member'),
    JobTitle      NVARCHAR(80)      NULL,
    AvatarColor   CHAR(7)           NOT NULL CONSTRAINT DF_Users_AvatarColor DEFAULT ('#6366f1'),
    IsActive      BIT               NOT NULL CONSTRAINT DF_Users_IsActive DEFAULT (1),
    CreatedAt     DATETIME2(3)      NOT NULL CONSTRAINT DF_Users_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedAt     DATETIME2(3)      NOT NULL CONSTRAINT DF_Users_UpdatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT CK_Users_Role CHECK (Role IN ('admin', 'manager', 'member'))
);
CREATE UNIQUE INDEX UX_Users_Email ON dbo.Users (Email);

CREATE TABLE dbo.RefreshTokens (
    Id                  INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_RefreshTokens PRIMARY KEY,
    UserId              INT          NOT NULL CONSTRAINT FK_RefreshTokens_Users REFERENCES dbo.Users (Id) ON DELETE CASCADE,
    TokenHash           CHAR(64)     NOT NULL,
    ExpiresAt           DATETIME2(3) NOT NULL,
    RevokedAt           DATETIME2(3) NULL,
    ReplacedByTokenHash CHAR(64)     NULL,
    UserAgent           NVARCHAR(300) NULL,
    CreatedAt           DATETIME2(3) NOT NULL CONSTRAINT DF_RefreshTokens_CreatedAt DEFAULT (SYSUTCDATETIME())
);
CREATE UNIQUE INDEX UX_RefreshTokens_TokenHash ON dbo.RefreshTokens (TokenHash);
CREATE INDEX IX_RefreshTokens_User ON dbo.RefreshTokens (UserId) INCLUDE (ExpiresAt, RevokedAt);

CREATE TABLE dbo.Projects (
    Id             INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Projects PRIMARY KEY,
    [Key]          NVARCHAR(6)   NOT NULL,
    Name           NVARCHAR(100) NOT NULL,
    Description    NVARCHAR(2000) NULL,
    Status         NVARCHAR(20)  NOT NULL CONSTRAINT DF_Projects_Status DEFAULT ('active'),
    Color          CHAR(7)       NOT NULL CONSTRAINT DF_Projects_Color DEFAULT ('#6366f1'),
    LeadId         INT           NULL CONSTRAINT FK_Projects_Lead REFERENCES dbo.Users (Id),
    StartDate      DATE          NULL,
    TargetDate     DATE          NULL,
    NextTaskNumber INT           NOT NULL CONSTRAINT DF_Projects_NextTaskNumber DEFAULT (1),
    CreatedAt      DATETIME2(3)  NOT NULL CONSTRAINT DF_Projects_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedAt      DATETIME2(3)  NOT NULL CONSTRAINT DF_Projects_UpdatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT CK_Projects_Status CHECK (Status IN ('active', 'on_hold', 'completed', 'archived')),
    CONSTRAINT CK_Projects_Dates CHECK (StartDate IS NULL OR TargetDate IS NULL OR TargetDate >= StartDate)
);
CREATE UNIQUE INDEX UX_Projects_Key ON dbo.Projects ([Key]);

CREATE TABLE dbo.ProjectMembers (
    ProjectId INT          NOT NULL CONSTRAINT FK_ProjectMembers_Projects REFERENCES dbo.Projects (Id) ON DELETE CASCADE,
    UserId    INT          NOT NULL CONSTRAINT FK_ProjectMembers_Users REFERENCES dbo.Users (Id) ON DELETE CASCADE,
    JoinedAt  DATETIME2(3) NOT NULL CONSTRAINT DF_ProjectMembers_JoinedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_ProjectMembers PRIMARY KEY (ProjectId, UserId)
);
CREATE INDEX IX_ProjectMembers_User ON dbo.ProjectMembers (UserId);

CREATE TABLE dbo.Tasks (
    Id            INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Tasks PRIMARY KEY,
    ProjectId     INT           NOT NULL CONSTRAINT FK_Tasks_Projects REFERENCES dbo.Projects (Id) ON DELETE CASCADE,
    Number        INT           NOT NULL,
    Title         NVARCHAR(200) NOT NULL,
    Description   NVARCHAR(MAX) NULL,
    Status        NVARCHAR(20)  NOT NULL CONSTRAINT DF_Tasks_Status DEFAULT ('todo'),
    Priority      NVARCHAR(20)  NOT NULL CONSTRAINT DF_Tasks_Priority DEFAULT ('medium'),
    Type          NVARCHAR(20)  NOT NULL CONSTRAINT DF_Tasks_Type DEFAULT ('feature'),
    AssigneeId    INT           NULL CONSTRAINT FK_Tasks_Assignee REFERENCES dbo.Users (Id),
    ReporterId    INT           NOT NULL CONSTRAINT FK_Tasks_Reporter REFERENCES dbo.Users (Id),
    DueDate       DATE          NULL,
    EstimateHours DECIMAL(7,2)  NULL,
    Position      FLOAT         NOT NULL CONSTRAINT DF_Tasks_Position DEFAULT (0),
    Labels        NVARCHAR(500) NOT NULL CONSTRAINT DF_Tasks_Labels DEFAULT ('[]'),
    CreatedAt     DATETIME2(3)  NOT NULL CONSTRAINT DF_Tasks_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedAt     DATETIME2(3)  NOT NULL CONSTRAINT DF_Tasks_UpdatedAt DEFAULT (SYSUTCDATETIME()),
    CompletedAt   DATETIME2(3)  NULL,
    CONSTRAINT UQ_Tasks_ProjectNumber UNIQUE (ProjectId, Number),
    CONSTRAINT CK_Tasks_Status CHECK (Status IN ('backlog', 'todo', 'in_progress', 'in_review', 'done')),
    CONSTRAINT CK_Tasks_Priority CHECK (Priority IN ('low', 'medium', 'high', 'critical')),
    CONSTRAINT CK_Tasks_Type CHECK (Type IN ('feature', 'bug', 'chore', 'research')),
    CONSTRAINT CK_Tasks_Labels_Json CHECK (ISJSON(Labels) = 1),
    CONSTRAINT CK_Tasks_Estimate CHECK (EstimateHours IS NULL OR EstimateHours >= 0),
    CONSTRAINT CK_Tasks_Completed CHECK ((Status = 'done' AND CompletedAt IS NOT NULL) OR (Status <> 'done' AND CompletedAt IS NULL))
);
CREATE INDEX IX_Tasks_Project_Status_Position ON dbo.Tasks (ProjectId, Status, Position);
CREATE INDEX IX_Tasks_Assignee_Status ON dbo.Tasks (AssigneeId, Status) INCLUDE (DueDate, Priority);
CREATE INDEX IX_Tasks_Open_DueDate ON dbo.Tasks (DueDate) INCLUDE (ProjectId, AssigneeId, Priority) WHERE Status <> 'done';
CREATE INDEX IX_Tasks_UpdatedAt ON dbo.Tasks (UpdatedAt DESC);

CREATE TABLE dbo.Comments (
    Id        INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Comments PRIMARY KEY,
    TaskId    INT           NOT NULL CONSTRAINT FK_Comments_Tasks REFERENCES dbo.Tasks (Id) ON DELETE CASCADE,
    AuthorId  INT           NOT NULL CONSTRAINT FK_Comments_Users REFERENCES dbo.Users (Id),
    Body      NVARCHAR(MAX) NOT NULL,
    CreatedAt DATETIME2(3)  NOT NULL CONSTRAINT DF_Comments_CreatedAt DEFAULT (SYSUTCDATETIME())
);
CREATE INDEX IX_Comments_Task ON dbo.Comments (TaskId, CreatedAt);

CREATE TABLE dbo.ActivityLog (
    Id        BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ActivityLog PRIMARY KEY,
    ActorId   INT           NULL CONSTRAINT FK_ActivityLog_Users REFERENCES dbo.Users (Id) ON DELETE SET NULL,
    ProjectId INT           NULL CONSTRAINT FK_ActivityLog_Projects REFERENCES dbo.Projects (Id) ON DELETE CASCADE,
    TaskId    INT           NULL,
    Action    NVARCHAR(40)  NOT NULL,
    Details   NVARCHAR(MAX) NOT NULL CONSTRAINT DF_ActivityLog_Details DEFAULT ('{}'),
    CreatedAt DATETIME2(3)  NOT NULL CONSTRAINT DF_ActivityLog_CreatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT CK_ActivityLog_Details_Json CHECK (ISJSON(Details) = 1)
);
CREATE INDEX IX_ActivityLog_CreatedAt ON dbo.ActivityLog (CreatedAt DESC);
CREATE INDEX IX_ActivityLog_Project ON dbo.ActivityLog (ProjectId, CreatedAt DESC);
CREATE INDEX IX_ActivityLog_Task ON dbo.ActivityLog (TaskId, CreatedAt DESC);

CREATE TABLE dbo.Conversations (
    Id        INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Conversations PRIMARY KEY,
    UserId    INT           NOT NULL CONSTRAINT FK_Conversations_Users REFERENCES dbo.Users (Id) ON DELETE CASCADE,
    Title     NVARCHAR(120) NOT NULL,
    CreatedAt DATETIME2(3)  NOT NULL CONSTRAINT DF_Conversations_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedAt DATETIME2(3)  NOT NULL CONSTRAINT DF_Conversations_UpdatedAt DEFAULT (SYSUTCDATETIME())
);
CREATE INDEX IX_Conversations_User ON dbo.Conversations (UserId, UpdatedAt DESC);

CREATE TABLE dbo.Messages (
    Id             INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Messages PRIMARY KEY,
    ConversationId INT           NOT NULL CONSTRAINT FK_Messages_Conversations REFERENCES dbo.Conversations (Id) ON DELETE CASCADE,
    Role           NVARCHAR(10)  NOT NULL,
    Content        NVARCHAR(MAX) NOT NULL,
    Source         NVARCHAR(10)  NULL,
    ToolTrace      NVARCHAR(MAX) NOT NULL CONSTRAINT DF_Messages_ToolTrace DEFAULT ('[]'),
    CreatedAt      DATETIME2(3)  NOT NULL CONSTRAINT DF_Messages_CreatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT CK_Messages_Role CHECK (Role IN ('user', 'assistant')),
    CONSTRAINT CK_Messages_Source CHECK (Source IS NULL OR Source IN ('llm', 'builtin')),
    CONSTRAINT CK_Messages_ToolTrace_Json CHECK (ISJSON(ToolTrace) = 1)
);
CREATE INDEX IX_Messages_Conversation ON dbo.Messages (ConversationId, CreatedAt);
