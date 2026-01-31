/*
  CFO Worx Portal — Collaboration Spaces + Task Tracker

  Tables:
    - CollaborationSpace
    - CollaborationSpaceMember
    - CollaborationTask
    - CollaborationTaskComment

  Notes:
    - Idempotent
*/

-- CollaborationSpace
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[CollaborationSpace]') AND type in (N'U'))
BEGIN
  CREATE TABLE dbo.CollaborationSpace (
    CollaborationSpaceID UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_CollaborationSpace PRIMARY KEY,
    Name NVARCHAR(200) NOT NULL,
    Description NVARCHAR(500) NULL,
    IsPrivate BIT NOT NULL CONSTRAINT DF_CollaborationSpace_IsPrivate DEFAULT(1),
    CreatedByUserID UNIQUEIDENTIFIER NULL,
    CreatedOn DATETIME2 NOT NULL CONSTRAINT DF_CollaborationSpace_CreatedOn DEFAULT(SYSUTCDATETIME()),
    UpdatedOn DATETIME2 NOT NULL CONSTRAINT DF_CollaborationSpace_UpdatedOn DEFAULT(SYSUTCDATETIME())
  );
  CREATE INDEX IX_CollaborationSpace_Name ON dbo.CollaborationSpace(Name);
END;

-- CollaborationSpaceMember
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[CollaborationSpaceMember]') AND type in (N'U'))
BEGIN
  CREATE TABLE dbo.CollaborationSpaceMember (
    CollaborationSpaceMemberID UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_CollaborationSpaceMember PRIMARY KEY,
    CollaborationSpaceID UNIQUEIDENTIFIER NOT NULL,
    UserID UNIQUEIDENTIFIER NOT NULL,
    MemberRole NVARCHAR(30) NOT NULL CONSTRAINT DF_CollaborationSpaceMember_Role DEFAULT('MEMBER'), -- OWNER | MEMBER
    AddedOn DATETIME2 NOT NULL CONSTRAINT DF_CollaborationSpaceMember_AddedOn DEFAULT(SYSUTCDATETIME())
  );

  ALTER TABLE dbo.CollaborationSpaceMember
    ADD CONSTRAINT FK_CollaborationSpaceMember_Space
      FOREIGN KEY (CollaborationSpaceID) REFERENCES dbo.CollaborationSpace(CollaborationSpaceID) ON DELETE CASCADE;

  CREATE UNIQUE INDEX UX_CollaborationSpaceMember_SpaceUser ON dbo.CollaborationSpaceMember(CollaborationSpaceID, UserID);
  CREATE INDEX IX_CollaborationSpaceMember_User ON dbo.CollaborationSpaceMember(UserID);
END;

-- CollaborationTask
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[CollaborationTask]') AND type in (N'U'))
BEGIN
  CREATE TABLE dbo.CollaborationTask (
    CollaborationTaskID UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_CollaborationTask PRIMARY KEY,
    CollaborationSpaceID UNIQUEIDENTIFIER NOT NULL,
    Title NVARCHAR(200) NOT NULL,
    Description NVARCHAR(MAX) NULL,
    Category NVARCHAR(50) NULL, -- Marketing | Finance | Operations | HR | IT | Vendors | ...
    Priority NVARCHAR(20) NOT NULL CONSTRAINT DF_CollaborationTask_Priority DEFAULT('MEDIUM'), -- LOW | MEDIUM | HIGH | URGENT
    Status NVARCHAR(20) NOT NULL CONSTRAINT DF_CollaborationTask_Status DEFAULT('OPEN'), -- OPEN | IN_PROGRESS | BLOCKED | DONE
    ClientID UNIQUEIDENTIFIER NULL,
    ContractID UNIQUEIDENTIFIER NULL,
    ProjectID UNIQUEIDENTIFIER NULL,
    AssignedToUserID UNIQUEIDENTIFIER NULL,
    DueDate DATE NULL,
    SnoozedUntil DATE NULL,
    CreatedByUserID UNIQUEIDENTIFIER NULL,
    CreatedOn DATETIME2 NOT NULL CONSTRAINT DF_CollaborationTask_CreatedOn DEFAULT(SYSUTCDATETIME()),
    UpdatedOn DATETIME2 NOT NULL CONSTRAINT DF_CollaborationTask_UpdatedOn DEFAULT(SYSUTCDATETIME()),
    CompletedOn DATETIME2 NULL
  );

  ALTER TABLE dbo.CollaborationTask
    ADD CONSTRAINT FK_CollaborationTask_Space
      FOREIGN KEY (CollaborationSpaceID) REFERENCES dbo.CollaborationSpace(CollaborationSpaceID) ON DELETE CASCADE;

  CREATE INDEX IX_CollaborationTask_Status ON dbo.CollaborationTask(Status);
  CREATE INDEX IX_CollaborationTask_Assignee ON dbo.CollaborationTask(AssignedToUserID);
  CREATE INDEX IX_CollaborationTask_DueDate ON dbo.CollaborationTask(DueDate);
  CREATE INDEX IX_CollaborationTask_Space ON dbo.CollaborationTask(CollaborationSpaceID);
END;

-- CollaborationTaskComment
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[CollaborationTaskComment]') AND type in (N'U'))
BEGIN
  CREATE TABLE dbo.CollaborationTaskComment (
    CollaborationTaskCommentID UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_CollaborationTaskComment PRIMARY KEY,
    CollaborationTaskID UNIQUEIDENTIFIER NOT NULL,
    UserID UNIQUEIDENTIFIER NULL,
    Body NVARCHAR(MAX) NOT NULL,
    CreatedOn DATETIME2 NOT NULL CONSTRAINT DF_CollaborationTaskComment_CreatedOn DEFAULT(SYSUTCDATETIME())
  );
  ALTER TABLE dbo.CollaborationTaskComment
    ADD CONSTRAINT FK_CollaborationTaskComment_Task
      FOREIGN KEY (CollaborationTaskID) REFERENCES dbo.CollaborationTask(CollaborationTaskID) ON DELETE CASCADE;

  CREATE INDEX IX_CollaborationTaskComment_Task ON dbo.CollaborationTaskComment(CollaborationTaskID);
END;
