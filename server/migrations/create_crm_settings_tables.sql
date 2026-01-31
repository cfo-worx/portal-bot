-- CRM Settings Database Schema
-- This migration creates all tables needed for CRM settings

-- 1. CRM Stages Configuration (for Sales, Sell-Side, Buy-Side pipelines)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CRMStage')
BEGIN
    CREATE TABLE CRMStage (
        StageID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        Module NVARCHAR(50) NOT NULL, -- 'sales', 'sell', 'buy'
        StageName NVARCHAR(100) NOT NULL,
        DisplayOrder INT NOT NULL,
        Probability DECIMAL(5,2) DEFAULT 0, -- 0-100
        StaleThresholdDays INT DEFAULT 30, -- days before considered stale
        IsActive BIT DEFAULT 1,
        CreatedOn DATETIME2 DEFAULT GETDATE(),
        UpdatedOn DATETIME2 DEFAULT GETDATE(),
        CONSTRAINT UQ_CRMStage_Module_StageName UNIQUE (Module, StageName)
    );
    
    CREATE INDEX IX_CRMStage_Module ON CRMStage(Module);
END;

-- 2. Lead Sources
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CRMLeadSource')
BEGIN
    CREATE TABLE CRMLeadSource (
        LeadSourceID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        SourceName NVARCHAR(100) NOT NULL UNIQUE,
        IsActive BIT DEFAULT 1,
        CreatedOn DATETIME2 DEFAULT GETDATE(),
        UpdatedOn DATETIME2 DEFAULT GETDATE()
    );
END;

-- 3. Canned Replies/Templates
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CRMCannedReply')
BEGIN
    CREATE TABLE CRMCannedReply (
        CannedReplyID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        Title NVARCHAR(255) NOT NULL,
        Content NVARCHAR(MAX) NOT NULL,
        Category NVARCHAR(50) NULL, -- 'prospect', 'followup', 'quote', etc.
        IsActive BIT DEFAULT 1,
        CreatedOn DATETIME2 DEFAULT GETDATE(),
        UpdatedOn DATETIME2 DEFAULT GETDATE()
    );
END;

-- 4. Rep Goals (weekly/monthly/quarterly)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CRMRepGoal')
BEGIN
    CREATE TABLE CRMRepGoal (
        GoalID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        ConsultantID UNIQUEIDENTIFIER NOT NULL, -- FK to Consultant
        PeriodType NVARCHAR(20) NOT NULL, -- 'weekly', 'monthly', 'quarterly'
        PeriodStart DATE NOT NULL, -- Start date of the period
        PeriodEnd DATE NOT NULL, -- End date of the period
        -- Goal metrics
        CallsBooked INT DEFAULT 0,
        CallsAttended INT DEFAULT 0, -- manual entry
        QuotesSent INT DEFAULT 0,
        TotalQuoteValue DECIMAL(18,2) DEFAULT 0,
        AvgQuoteValue DECIMAL(18,2) DEFAULT 0,
        ClosedWon INT DEFAULT 0,
        CreatedOn DATETIME2 DEFAULT GETDATE(),
        UpdatedOn DATETIME2 DEFAULT GETDATE(),
        CONSTRAINT FK_CRMRepGoal_Consultant FOREIGN KEY (ConsultantID) REFERENCES Consultant(ConsultantID),
        CONSTRAINT UQ_CRMRepGoal_Consultant_Period UNIQUE (ConsultantID, PeriodType, PeriodStart)
    );
    
    CREATE INDEX IX_CRMRepGoal_Consultant ON CRMRepGoal(ConsultantID);
    CREATE INDEX IX_CRMRepGoal_Period ON CRMRepGoal(PeriodType, PeriodStart, PeriodEnd);
END;

-- Insert default Sales CRM stages
IF NOT EXISTS (SELECT * FROM CRMStage WHERE Module = 'sales')
BEGIN
    INSERT INTO CRMStage (Module, StageName, DisplayOrder, Probability, StaleThresholdDays) VALUES
    ('sales', 'Prospect', 1, 10, 7),
    ('sales', 'Lead', 2, 20, 14),
    ('sales', 'Call Booked', 3, 30, 7),
    ('sales', 'Follow Up', 4, 40, 14),
    ('sales', 'Quote Sent', 5, 60, 21),
    ('sales', 'Quoted Follow Up', 6, 70, 14),
    ('sales', 'Closed/Won', 7, 100, NULL),
    ('sales', 'Closed/Lost', 8, 0, NULL);
END;

-- Insert default M&A Sell-Side stages
IF NOT EXISTS (SELECT * FROM CRMStage WHERE Module = 'sell')
BEGIN
    INSERT INTO CRMStage (Module, StageName, DisplayOrder, Probability, StaleThresholdDays) VALUES
    ('sell', 'Teaser', 1, 10, 14),
    ('sell', 'NDA', 2, 20, 7),
    ('sell', 'CIM', 3, 30, 14),
    ('sell', 'IOI', 4, 50, 14),
    ('sell', 'LOI', 5, 70, 21),
    ('sell', 'DD', 6, 85, 30),
    ('sell', 'Closed/Won', 7, 100, NULL),
    ('sell', 'Closed/Lost', 8, 0, NULL);
END;

-- Insert default M&A Buy-Side stages
IF NOT EXISTS (SELECT * FROM CRMStage WHERE Module = 'buy')
BEGIN
    INSERT INTO CRMStage (Module, StageName, DisplayOrder, Probability, StaleThresholdDays) VALUES
    ('buy', 'Positive Response', 1, 10, 14),
    ('buy', 'Call Scheduled', 2, 20, 7),
    ('buy', 'NDA', 3, 30, 7),
    ('buy', 'Financials', 4, 40, 14),
    ('buy', 'IOI', 5, 50, 14),
    ('buy', 'LOI', 6, 70, 21),
    ('buy', 'DD', 7, 85, 30),
    ('buy', 'Closed/Won', 8, 100, NULL),
    ('buy', 'Closed/Lost', 9, 0, NULL);
END;

-- Insert default lead sources
IF NOT EXISTS (SELECT * FROM CRMLeadSource)
BEGIN
    INSERT INTO CRMLeadSource (SourceName) VALUES
    ('Website'),
    ('Referral'),
    ('LinkedIn'),
    ('Cold Calling'),
    ('Cold Email'),
    ('LinkedIn DMs'),
    ('Trade Show'),
    ('Partner'),
    ('Other');
END;

