-- Buy-Side Client and Campaign Tables
-- Supports M&A Buy-Side deal organization with campaign criteria

-- 1. Buy-Side Client Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'BuySideClient')
BEGIN
    CREATE TABLE BuySideClient (
        ClientID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        ClientName NVARCHAR(255) NOT NULL UNIQUE,
        Description NVARCHAR(MAX) NULL,
        IsActive BIT DEFAULT 1,
        CreatedOn DATETIME2 DEFAULT GETDATE(),
        UpdatedOn DATETIME2 DEFAULT GETDATE(),
        CreatedBy UNIQUEIDENTIFIER NULL, -- FK to Users
        CONSTRAINT FK_BuySideClient_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES Users(UserID)
    );
    
    CREATE INDEX IX_BuySideClient_IsActive ON BuySideClient(IsActive);
END;

-- 2. Buy-Side Campaign Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'BuySideCampaign')
BEGIN
    CREATE TABLE BuySideCampaign (
        CampaignID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        ClientID UNIQUEIDENTIFIER NOT NULL, -- FK to BuySideClient
        CampaignName NVARCHAR(255) NOT NULL,
        Description NVARCHAR(MAX) NULL,
        -- Campaign Criteria
        Industry NVARCHAR(500) NULL, -- Comma-separated or JSON array
        Location NVARCHAR(500) NULL, -- Comma-separated states/cities or JSON array
        HeadcountMin INT NULL,
        HeadcountMax INT NULL,
        RevenueMin DECIMAL(18,2) NULL,
        RevenueMax DECIMAL(18,2) NULL,
        CriteriaJson NVARCHAR(MAX) NULL, -- JSON for additional criteria
        IsActive BIT DEFAULT 1,
        CreatedOn DATETIME2 DEFAULT GETDATE(),
        UpdatedOn DATETIME2 DEFAULT GETDATE(),
        CreatedBy UNIQUEIDENTIFIER NULL, -- FK to Users
        CONSTRAINT FK_BuySideCampaign_Client FOREIGN KEY (ClientID) REFERENCES BuySideClient(ClientID),
        CONSTRAINT FK_BuySideCampaign_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES Users(UserID),
        CONSTRAINT UQ_BuySideCampaign_Client_CampaignName UNIQUE (ClientID, CampaignName)
    );
    
    CREATE INDEX IX_BuySideCampaign_ClientID ON BuySideCampaign(ClientID);
    CREATE INDEX IX_BuySideCampaign_IsActive ON BuySideCampaign(IsActive);
END;

