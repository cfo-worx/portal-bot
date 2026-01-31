-- Weekly Review Session table for CFO meeting workflow
-- Persists weekly review notes by week, client, and consultant with prior-week carry-forward
-- Safe to run multiple times (idempotent) on SQL Server

IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[WeeklyReviewSession]') AND type in (N'U'))
BEGIN
    CREATE TABLE WeeklyReviewSession (
        ReviewSessionID UNIQUEIDENTIFIER NOT NULL 
            CONSTRAINT DF_WeeklyReviewSession_ReviewSessionID DEFAULT NEWID() PRIMARY KEY,
        
        WeekStartDate DATE NOT NULL,
        WeekEndDate DATE NOT NULL,
        
        ClientID UNIQUEIDENTIFIER NULL,
        ConsultantID UNIQUEIDENTIFIER NULL,
        
        Notes NVARCHAR(MAX) NULL,
        ActionItems NVARCHAR(MAX) NULL,
        
        Status NVARCHAR(30) NOT NULL 
            CONSTRAINT DF_WeeklyReviewSession_Status DEFAULT ('draft'),
        
        CreatedAt DATETIME2 NOT NULL 
            CONSTRAINT DF_WeeklyReviewSession_CreatedAt DEFAULT SYSUTCDATETIME(),
        CreatedByUserID UNIQUEIDENTIFIER NULL,
        UpdatedAt DATETIME2 NOT NULL 
            CONSTRAINT DF_WeeklyReviewSession_UpdatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedByUserID UNIQUEIDENTIFIER NULL,
        
        -- Carry-forward flag
        CarriedForwardFromSessionID UNIQUEIDENTIFIER NULL,
        
        CONSTRAINT FK_WeeklyReviewSession_Client FOREIGN KEY (ClientID) REFERENCES Client(ClientID),
        CONSTRAINT FK_WeeklyReviewSession_Consultant FOREIGN KEY (ConsultantID) REFERENCES Consultant(ConsultantID),
        CONSTRAINT FK_WeeklyReviewSession_CarriedForward FOREIGN KEY (CarriedForwardFromSessionID) REFERENCES WeeklyReviewSession(ReviewSessionID)
    );

    -- Index for efficient lookups by week and entity
    CREATE INDEX IX_WeeklyReviewSession_Week ON WeeklyReviewSession(WeekStartDate, WeekEndDate);
    CREATE INDEX IX_WeeklyReviewSession_ClientConsultant ON WeeklyReviewSession(ClientID, ConsultantID);
    CREATE INDEX IX_WeeklyReviewSession_WeekClient ON WeeklyReviewSession(WeekStartDate, ClientID);
    CREATE INDEX IX_WeeklyReviewSession_WeekConsultant ON WeeklyReviewSession(WeekStartDate, ConsultantID);
END;

