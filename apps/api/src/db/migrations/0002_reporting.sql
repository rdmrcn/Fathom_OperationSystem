-- Read-only reporting layer used by the AI assistant's report-query tool.
-- The assistant may only SELECT from views in this schema, so sensitive columns
-- (emails, password hashes, tokens, private conversations) are never exposed.

CREATE SCHEMA reporting;
GO

CREATE VIEW reporting.vUsers AS
SELECT u.Id        AS UserId,
       u.Name,
       u.Role,
       u.JobTitle,
       u.IsActive,
       u.CreatedAt
FROM dbo.Users AS u;
GO

CREATE VIEW reporting.vProjects AS
SELECT p.Id          AS ProjectId,
       p.[Key]       AS ProjectKey,
       p.Name        AS ProjectName,
       p.Status,
       p.StartDate,
       p.TargetDate,
       p.LeadId,
       l.Name        AS LeadName,
       p.CreatedAt,
       p.UpdatedAt,
       (SELECT COUNT(*) FROM dbo.Tasks t WHERE t.ProjectId = p.Id)                       AS TaskCount,
       (SELECT COUNT(*) FROM dbo.Tasks t WHERE t.ProjectId = p.Id AND t.Status = 'done') AS DoneCount,
       (SELECT COUNT(*) FROM dbo.Tasks t WHERE t.ProjectId = p.Id AND t.Status <> 'done'
                                              AND t.DueDate < CAST(SYSUTCDATETIME() AS DATE)) AS OverdueCount,
       (SELECT COUNT(*) FROM dbo.ProjectMembers m WHERE m.ProjectId = p.Id)              AS MemberCount
FROM dbo.Projects AS p
LEFT JOIN dbo.Users AS l ON l.Id = p.LeadId;
GO

CREATE VIEW reporting.vTasks AS
SELECT t.Id             AS TaskId,
       p.[Key] + '-' + CAST(t.Number AS NVARCHAR(10)) AS TaskKey,
       t.ProjectId,
       p.[Key]          AS ProjectKey,
       p.Name           AS ProjectName,
       t.Title,
       t.Status,
       t.Priority,
       t.Type,
       t.AssigneeId,
       a.Name           AS AssigneeName,
       t.ReporterId,
       r.Name           AS ReporterName,
       t.DueDate,
       t.EstimateHours,
       t.Labels,
       t.CreatedAt,
       t.UpdatedAt,
       t.CompletedAt,
       CASE WHEN t.Status <> 'done' AND t.DueDate < CAST(SYSUTCDATETIME() AS DATE) THEN 1 ELSE 0 END AS IsOverdue,
       CASE WHEN t.CompletedAt IS NOT NULL THEN DATEDIFF(DAY, t.CreatedAt, t.CompletedAt) END         AS CycleTimeDays
FROM dbo.Tasks AS t
JOIN dbo.Projects AS p ON p.Id = t.ProjectId
LEFT JOIN dbo.Users AS a ON a.Id = t.AssigneeId
LEFT JOIN dbo.Users AS r ON r.Id = t.ReporterId;
GO

CREATE VIEW reporting.vActivity AS
SELECT al.Id        AS ActivityId,
       al.Action,
       al.ActorId,
       u.Name       AS ActorName,
       al.ProjectId,
       p.[Key]      AS ProjectKey,
       al.TaskId,
       al.CreatedAt
FROM dbo.ActivityLog AS al
LEFT JOIN dbo.Users AS u ON u.Id = al.ActorId
LEFT JOIN dbo.Projects AS p ON p.Id = al.ProjectId;
GO

CREATE VIEW reporting.vComments AS
SELECT c.Id        AS CommentId,
       c.TaskId,
       c.AuthorId,
       u.Name      AS AuthorName,
       LEN(c.Body) AS BodyLength,
       c.CreatedAt
FROM dbo.Comments AS c
LEFT JOIN dbo.Users AS u ON u.Id = c.AuthorId;
GO

-- Database role that can only read the reporting schema. A login can be mapped
-- to it for the assistant (see DB_REPORTING_USER / DB_REPORTING_PASSWORD).
CREATE ROLE reporting_reader;
GO
GRANT SELECT ON SCHEMA::reporting TO reporting_reader;
GO
