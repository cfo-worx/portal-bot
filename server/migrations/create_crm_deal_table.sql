-- CRM Deal Table
-- Stores deals for Sales CRM, M&A Sell-Side, and M&A Buy-Side

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CRMDeal')
BEGIN
    CREATE TABLE CRMDeal (
        DealID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        Module NVARCHAR(50) NOT NULL, -- 'sales', 'sell', 'buy'
        Company NVARCHAR(255) NOT NULL,
        Contact NVARCHAR(255) NULL,
        ContactTitle NVARCHAR(255) NULL,
        ContactEmail NVARCHAR(255) NULL,
        Amount DECIMAL(18,2) NULL, -- TCV (Total Contract Value)
        MRR DECIMAL(18,2) NULL, -- Monthly Recurring Revenue
        OwnerID UNIQUEIDENTIFIER NULL, -- FK to Consultant (rep/owner)
        LeadSourceID UNIQUEIDENTIFIER NULL, -- FK to CRMLeadSource
        StageID UNIQUEIDENTIFIER NOT NULL, -- FK to CRMStage
        LastActivity NVARCHAR(500) NULL,
        LastActivityDate DATETIME2 NULL,
        ActivityCount INT DEFAULT 0,
        CompanySize NVARCHAR(10) NULL, -- 'S', 'M', 'L'
        ClosedReason NVARCHAR(255) NULL,
        ClosedDate DATETIME2 NULL,
        Notes NVARCHAR(MAX) NULL,
        DetailsJson NVARCHAR(MAX) NULL, -- JSON for additional deal details
        ManualScoreBoost INT DEFAULT 0, -- Manual lead score boost
        IsActive BIT DEFAULT 1,
        CreatedOn DATETIME2 DEFAULT GETDATE(),
        UpdatedOn DATETIME2 DEFAULT GETDATE(),
        CreatedBy UNIQUEIDENTIFIER NULL, -- FK to Users
        CONSTRAINT FK_CRMDeal_Owner FOREIGN KEY (OwnerID) REFERENCES Consultant(ConsultantID),
        CONSTRAINT FK_CRMDeal_LeadSource FOREIGN KEY (LeadSourceID) REFERENCES CRMLeadSource(LeadSourceID),
        CONSTRAINT FK_CRMDeal_Stage FOREIGN KEY (StageID) REFERENCES CRMStage(StageID),
        CONSTRAINT FK_CRMDeal_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES Users(UserID)
    );
    
    CREATE INDEX IX_CRMDeal_Module ON CRMDeal(Module);
    CREATE INDEX IX_CRMDeal_Stage ON CRMDeal(StageID);
    CREATE INDEX IX_CRMDeal_Owner ON CRMDeal(OwnerID);
    CREATE INDEX IX_CRMDeal_LeadSource ON CRMDeal(LeadSourceID);
    CREATE INDEX IX_CRMDeal_IsActive ON CRMDeal(IsActive);
END;

-- CRM Deal Note Table (for deal notes/activities)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CRMDealNote')
BEGIN
    CREATE TABLE CRMDealNote (
        NoteID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        DealID UNIQUEIDENTIFIER NOT NULL,
        NoteText NVARCHAR(MAX) NOT NULL,
        CreatedBy UNIQUEIDENTIFIER NULL, -- FK to Users
        CreatedOn DATETIME2 DEFAULT GETDATE(),
        CONSTRAINT FK_CRMDealNote_Deal FOREIGN KEY (DealID) REFERENCES CRMDeal(DealID) ON DELETE CASCADE,
        CONSTRAINT FK_CRMDealNote_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES Users(UserID)
    );
    
    CREATE INDEX IX_CRMDealNote_Deal ON CRMDealNote(DealID);
    CREATE INDEX IX_CRMDealNote_CreatedOn ON CRMDealNote(CreatedOn DESC);
END;

-- CRM Deal Activity Table (for tracking activities like calls, emails, meetings)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CRMDealActivity')
BEGIN
    CREATE TABLE CRMDealActivity (
        ActivityID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        DealID UNIQUEIDENTIFIER NOT NULL,
        ActivityType NVARCHAR(50) NOT NULL, -- 'call', 'email', 'meeting', 'note', etc.
        ActivityDescription NVARCHAR(500) NULL,
        ActivityDate DATETIME2 DEFAULT GETDATE(),
        CreatedBy UNIQUEIDENTIFIER NULL, -- FK to Users
        CreatedOn DATETIME2 DEFAULT GETDATE(),
        CONSTRAINT FK_CRMDealActivity_Deal FOREIGN KEY (DealID) REFERENCES CRMDeal(DealID) ON DELETE CASCADE,
        CONSTRAINT FK_CRMDealActivity_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES Users(UserID)
    );
    
    CREATE INDEX IX_CRMDealActivity_Deal ON CRMDealActivity(DealID);
    CREATE INDEX IX_CRMDealActivity_ActivityDate ON CRMDealActivity(ActivityDate DESC);
END;

