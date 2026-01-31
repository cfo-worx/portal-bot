-- Lead Database Tables
-- Stores leads/accounts with import tracking and deduplication

-- 1. Lead Import Batch Table (tracks import sessions)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'LeadImportBatch')
BEGIN
    CREATE TABLE LeadImportBatch (
        BatchID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        FileName NVARCHAR(255) NOT NULL,
        FilePath NVARCHAR(500) NULL,
        TotalRows INT DEFAULT 0,
        ImportedRows INT DEFAULT 0,
        ErrorRows INT DEFAULT 0,
        DuplicateRows INT DEFAULT 0,
        Status NVARCHAR(50) NOT NULL DEFAULT 'Pending', -- 'Pending', 'Processing', 'Completed', 'Failed'
        ErrorSummary NVARCHAR(MAX) NULL, -- JSON array of error messages
        CreatedBy UNIQUEIDENTIFIER NULL, -- FK to Users
        CreatedOn DATETIME2 DEFAULT GETDATE(),
        CompletedOn DATETIME2 NULL,
        CONSTRAINT FK_LeadImportBatch_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES Users(UserID)
    );
    
    CREATE INDEX IX_LeadImportBatch_CreatedOn ON LeadImportBatch(CreatedOn DESC);
    CREATE INDEX IX_LeadImportBatch_Status ON LeadImportBatch(Status);
END;

-- 2. Lead Table (stores individual lead records)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Lead')
BEGIN
    CREATE TABLE Lead (
        LeadID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        -- Primary deduplication fields
        Email NVARCHAR(255) NULL,
        Domain NVARCHAR(255) NULL, -- Extracted from email domain
        -- Company/Account fields
        CompanyName NVARCHAR(255) NULL,
        Industry NVARCHAR(100) NULL,
        Revenue DECIMAL(18,2) NULL,
        EmployeeCount INT NULL,
        -- Contact fields
        FirstName NVARCHAR(100) NULL,
        LastName NVARCHAR(100) NULL,
        FullName NVARCHAR(255) NULL,
        Title NVARCHAR(100) NULL,
        Phone NVARCHAR(50) NULL,
        -- Location fields
        City NVARCHAR(100) NULL,
        State NVARCHAR(50) NULL,
        Country NVARCHAR(100) NULL,
        -- Additional fields
        Website NVARCHAR(255) NULL,
        LinkedInURL NVARCHAR(500) NULL,
        AccountingSystem NVARCHAR(100) NULL,
        Notes NVARCHAR(MAX) NULL,
        Tags NVARCHAR(500) NULL, -- Comma-separated tags
        -- Metadata
        LeadScore INT DEFAULT 0,
        LastContactDate DATETIME2 NULL,
        Source NVARCHAR(100) NULL,
        IsDuplicate BIT DEFAULT 0,
        DuplicateOfLeadID UNIQUEIDENTIFIER NULL, -- FK to Lead (if this is a duplicate)
        ImportBatchID UNIQUEIDENTIFIER NULL, -- FK to LeadImportBatch
        IsActive BIT DEFAULT 1,
        CreatedOn DATETIME2 DEFAULT GETDATE(),
        UpdatedOn DATETIME2 DEFAULT GETDATE(),
        CreatedBy UNIQUEIDENTIFIER NULL, -- FK to Users
        UpdatedBy UNIQUEIDENTIFIER NULL, -- FK to Users
        CONSTRAINT FK_Lead_DuplicateOf FOREIGN KEY (DuplicateOfLeadID) REFERENCES Lead(LeadID),
        CONSTRAINT FK_Lead_ImportBatch FOREIGN KEY (ImportBatchID) REFERENCES LeadImportBatch(BatchID),
        CONSTRAINT FK_Lead_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES Users(UserID),
        CONSTRAINT FK_Lead_UpdatedBy FOREIGN KEY (UpdatedBy) REFERENCES Users(UserID)
    );
    
    -- Indexes for performance
    CREATE INDEX IX_Lead_Email ON Lead(Email);
    CREATE INDEX IX_Lead_Domain ON Lead(Domain);
    CREATE INDEX IX_Lead_CompanyName ON Lead(CompanyName);
    CREATE INDEX IX_Lead_Industry ON Lead(Industry);
    CREATE INDEX IX_Lead_IsDuplicate ON Lead(IsDuplicate);
    CREATE INDEX IX_Lead_ImportBatchID ON Lead(ImportBatchID);
    CREATE INDEX IX_Lead_IsActive ON Lead(IsActive);
    CREATE INDEX IX_Lead_CreatedOn ON Lead(CreatedOn DESC);
    
    -- Unique constraint for deduplication (domain + email combination)
    CREATE UNIQUE NONCLUSTERED INDEX IX_Lead_DomainEmail_Unique 
    ON Lead(Domain, Email) 
    WHERE Email IS NOT NULL AND Domain IS NOT NULL AND IsDuplicate = 0;
END;

-- 3. Lead Import Error Table (stores per-row import errors)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'LeadImportError')
BEGIN
    CREATE TABLE LeadImportError (
        ErrorID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        BatchID UNIQUEIDENTIFIER NOT NULL, -- FK to LeadImportBatch
        RowNumber INT NOT NULL,
        RowData NVARCHAR(MAX) NULL, -- JSON of the row data
        ErrorMessage NVARCHAR(MAX) NOT NULL,
        ErrorType NVARCHAR(50) NULL, -- 'Validation', 'Duplicate', 'System'
        CreatedOn DATETIME2 DEFAULT GETDATE(),
        CONSTRAINT FK_LeadImportError_Batch FOREIGN KEY (BatchID) REFERENCES LeadImportBatch(BatchID) ON DELETE CASCADE
    );
    
    CREATE INDEX IX_LeadImportError_BatchID ON LeadImportError(BatchID);
END;

