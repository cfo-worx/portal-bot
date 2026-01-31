-- Create ITTicket table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ITTicket')
BEGIN
    CREATE TABLE ITTicket (
        TicketID UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        Title NVARCHAR(200) NOT NULL,
        Description NVARCHAR(MAX) NOT NULL,
        Category NVARCHAR(50) NOT NULL,
        Priority NVARCHAR(10) NOT NULL, -- P0, P1, P2, P3
        Status NVARCHAR(30) NOT NULL DEFAULT 'open', -- open | in_progress | blocked | resolved | closed
        AffectedPage NVARCHAR(200) NULL,
        AffectedFeature NVARCHAR(200) NULL,
        StepsToReproduce NVARCHAR(MAX) NULL,
        ExpectedBehavior NVARCHAR(MAX) NULL,
        ActualBehavior NVARCHAR(MAX) NULL,
        Environment NVARCHAR(50) NULL, -- prod | staging | local
        BrowserInfo NVARCHAR(500) NULL,
        AppVersion NVARCHAR(50) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CreatedByUserID UNIQUEIDENTIFIER NULL,
        UpdatedAt DATETIME2 NULL,
        UpdatedByUserID UNIQUEIDENTIFIER NULL,
        AssignedToUserID UNIQUEIDENTIFIER NULL,
        ClosedAt DATETIME2 NULL,
        ClosedByUserID UNIQUEIDENTIFIER NULL,
        ResolutionSummary NVARCHAR(MAX) NULL,
        TotalTimeSpentMinutes INT NOT NULL DEFAULT 0
    );

    -- FKs are created separately to avoid failures if Users table name differs.
    IF OBJECT_ID('Users', 'U') IS NOT NULL
    BEGIN
        ALTER TABLE ITTicket WITH CHECK ADD CONSTRAINT FK_ITTicket_CreatedBy FOREIGN KEY (CreatedByUserID)
            REFERENCES Users(UserID);
        ALTER TABLE ITTicket WITH CHECK ADD CONSTRAINT FK_ITTicket_UpdatedBy FOREIGN KEY (UpdatedByUserID)
            REFERENCES Users(UserID);
        ALTER TABLE ITTicket WITH CHECK ADD CONSTRAINT FK_ITTicket_AssignedTo FOREIGN KEY (AssignedToUserID)
            REFERENCES Users(UserID);
        ALTER TABLE ITTicket WITH CHECK ADD CONSTRAINT FK_ITTicket_ClosedBy FOREIGN KEY (ClosedByUserID)
            REFERENCES Users(UserID);
    END

    CREATE INDEX IX_ITTicket_Status ON ITTicket(Status);
    CREATE INDEX IX_ITTicket_Priority ON ITTicket(Priority);
    CREATE INDEX IX_ITTicket_CreatedAt ON ITTicket(CreatedAt);
END

-- Create ITTicketAttachment table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ITTicketAttachment')
BEGIN
    CREATE TABLE ITTicketAttachment (
        AttachmentID UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        TicketID UNIQUEIDENTIFIER NOT NULL,
        FileName NVARCHAR(255) NOT NULL,
        FilePath NVARCHAR(500) NOT NULL,
        FileSize INT NULL,
        MimeType NVARCHAR(100) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CreatedByUserID UNIQUEIDENTIFIER NULL
    );

    ALTER TABLE ITTicketAttachment WITH CHECK ADD CONSTRAINT FK_ITTicketAttachment_Ticket
        FOREIGN KEY (TicketID) REFERENCES ITTicket(TicketID) ON DELETE CASCADE;

    IF OBJECT_ID('Users', 'U') IS NOT NULL
    BEGIN
        ALTER TABLE ITTicketAttachment WITH CHECK ADD CONSTRAINT FK_ITTicketAttachment_CreatedBy
            FOREIGN KEY (CreatedByUserID) REFERENCES Users(UserID);
    END

    CREATE INDEX IX_ITTicketAttachment_TicketID ON ITTicketAttachment(TicketID);
END

-- Create ITTicketComment table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ITTicketComment')
BEGIN
    CREATE TABLE ITTicketComment (
        CommentID UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        TicketID UNIQUEIDENTIFIER NOT NULL,
        Body NVARCHAR(MAX) NOT NULL,
        IsInternal BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CreatedByUserID UNIQUEIDENTIFIER NULL
    );

    ALTER TABLE ITTicketComment WITH CHECK ADD CONSTRAINT FK_ITTicketComment_Ticket
        FOREIGN KEY (TicketID) REFERENCES ITTicket(TicketID) ON DELETE CASCADE;

    IF OBJECT_ID('Users', 'U') IS NOT NULL
    BEGIN
        ALTER TABLE ITTicketComment WITH CHECK ADD CONSTRAINT FK_ITTicketComment_CreatedBy
            FOREIGN KEY (CreatedByUserID) REFERENCES Users(UserID);
    END

    CREATE INDEX IX_ITTicketComment_TicketID ON ITTicketComment(TicketID);
END

-- Create ITTicketWorkLog table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ITTicketWorkLog')
BEGIN
    CREATE TABLE ITTicketWorkLog (
        WorkLogID UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        TicketID UNIQUEIDENTIFIER NOT NULL,
        Minutes INT NOT NULL,
        Note NVARCHAR(500) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CreatedByUserID UNIQUEIDENTIFIER NULL
    );

    ALTER TABLE ITTicketWorkLog WITH CHECK ADD CONSTRAINT FK_ITTicketWorkLog_Ticket
        FOREIGN KEY (TicketID) REFERENCES ITTicket(TicketID) ON DELETE CASCADE;

    IF OBJECT_ID('Users', 'U') IS NOT NULL
    BEGIN
        ALTER TABLE ITTicketWorkLog WITH CHECK ADD CONSTRAINT FK_ITTicketWorkLog_CreatedBy
            FOREIGN KEY (CreatedByUserID) REFERENCES Users(UserID);
    END

    CREATE INDEX IX_ITTicketWorkLog_TicketID ON ITTicketWorkLog(TicketID);
END
