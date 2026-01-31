-- ROI Tracker tables
-- Creates tables required for the ROI Tracker module.

BEGIN TRY

    -- Categories
    IF OBJECT_ID('dbo.ROIImpactCategory', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.ROIImpactCategory (
            CategoryID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            Name NVARCHAR(100) NOT NULL UNIQUE,
            IsActive BIT NOT NULL CONSTRAINT DF_ROIImpactCategory_IsActive DEFAULT (1),
            SortOrder INT NOT NULL CONSTRAINT DF_ROIImpactCategory_SortOrder DEFAULT (100)
        );

        INSERT INTO dbo.ROIImpactCategory (Name, SortOrder) VALUES
            ('Tax', 10),
            ('Revenue', 20),
            ('Gross Margin', 30),
            ('Profitability', 40),
            ('Balance Sheet', 50),
            ('Vendor Negotiations', 60),
            ('Marketing Department', 70),
            ('Sales Department', 80),
            ('Other', 90);
    END

    -- Activity Tags
    IF OBJECT_ID('dbo.ROIActivityTag', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.ROIActivityTag (
            ActivityTagID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            Name NVARCHAR(120) NOT NULL UNIQUE,
            IsActive BIT NOT NULL CONSTRAINT DF_ROIActivityTag_IsActive DEFAULT (1),
            SortOrder INT NOT NULL CONSTRAINT DF_ROIActivityTag_SortOrder DEFAULT (100)
        );

        -- Seed a practical starter set (admin editable)
        INSERT INTO dbo.ROIActivityTag (Name, SortOrder) VALUES
            ('Pricing & Packaging', 10),
            ('Vendor / Cost Reduction', 20),
            ('Tax Credits / Incentives', 30),
            ('Cash Flow / Working Capital', 40),
            ('Financial Reporting / Close', 50),
            ('Budgeting / Forecasting', 60),
            ('KPI / Dashboarding', 70),
            ('Sales Process / CRM', 80),
            ('Marketing Operations', 90),
            ('Process Automation', 100),
            ('Operations / SOPs', 110),
            ('Hiring / Org Design', 120),
            ('System Implementation', 130),
            ('Strategic Planning', 140),
            ('Other', 150);
    END

    -- Rejection Reasons
    IF OBJECT_ID('dbo.ROIRejectionReason', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.ROIRejectionReason (
            RejectionReasonID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            ReasonText NVARCHAR(200) NOT NULL,
            IsActive BIT NOT NULL CONSTRAINT DF_ROIRejectionReason_IsActive DEFAULT (1),
            SortOrder INT NOT NULL CONSTRAINT DF_ROIRejectionReason_SortOrder DEFAULT (100)
        );

        INSERT INTO dbo.ROIRejectionReason (ReasonText, SortOrder) VALUES
            ('Insufficient detail / explanation', 10),
            ('Value not supported / unclear calculation', 20),
            ('Wrong category / impact type', 30),
            ('Duplicate of existing win', 40),
            ('Outside client active period / invalid dates', 50),
            ('Other', 999);
    END

    -- Main ROI Win table
    IF OBJECT_ID('dbo.ROIWin', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.ROIWin (
            ROIWinID UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_ROIWin_ROIWinID DEFAULT NEWID() PRIMARY KEY,

            ClientID UNIQUEIDENTIFIER NOT NULL,
            Title NVARCHAR(200) NOT NULL,
            CategoryID INT NOT NULL,

            -- Impact
            ImpactType NVARCHAR(20) NOT NULL, -- 'Recurring' | 'OneTime'
            ImpactDate DATE NOT NULL,         -- month bucket uses this date (impact recognition date)

            -- Recurring fields
            RecurringMonthlyAmount DECIMAL(18,2) NULL,
            RecurringStartDate DATE NULL,
            RecurringEndDate DATE NULL,

            -- One-time fields
            OneTimeTotalValue DECIMAL(18,2) NULL,
            OneTimeSpreadMonths INT NULL CONSTRAINT DF_ROIWin_OneTimeSpreadMonths DEFAULT (1), -- 1-3

            -- Notes
            ExternalNotes NVARCHAR(MAX) NULL,
            InternalNotes NVARCHAR(MAX) NULL,

            -- Workflow
            Status NVARCHAR(20) NOT NULL CONSTRAINT DF_ROIWin_Status DEFAULT ('Draft'),
            CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ROIWin_CreatedAt DEFAULT SYSUTCDATETIME(),
            CreatedByUserID UNIQUEIDENTIFIER NULL,
            LastEditedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ROIWin_LastEditedAt DEFAULT SYSUTCDATETIME(),
            LastEditedByUserID UNIQUEIDENTIFIER NULL,

            SubmittedAt DATETIME2(0) NULL,
            SubmittedByUserID UNIQUEIDENTIFIER NULL,

            ApprovedAt DATETIME2(0) NULL,
            ApprovedByUserID UNIQUEIDENTIFIER NULL,

            RejectedAt DATETIME2(0) NULL,
            RejectedByUserID UNIQUEIDENTIFIER NULL,
            RejectionReasonID INT NULL,
            RejectionNote NVARCHAR(MAX) NULL,

            CorrectionNote NVARCHAR(MAX) NULL,
            Revision INT NOT NULL CONSTRAINT DF_ROIWin_Revision DEFAULT (0),

            -- Optional: single client owner (User)
            ClientOwnerUserID UNIQUEIDENTIFIER NULL,

            -- Soft delete
            IsDeleted BIT NOT NULL CONSTRAINT DF_ROIWin_IsDeleted DEFAULT (0),
            DeletedAt DATETIME2(0) NULL,
            DeletedByUserID UNIQUEIDENTIFIER NULL
        );

        -- FKs (assumes core tables exist)
        ALTER TABLE dbo.ROIWin WITH CHECK ADD CONSTRAINT FK_ROIWin_Client FOREIGN KEY (ClientID) REFERENCES dbo.Client (ClientID);
        ALTER TABLE dbo.ROIWin WITH CHECK ADD CONSTRAINT FK_ROIWin_Category FOREIGN KEY (CategoryID) REFERENCES dbo.ROIImpactCategory (CategoryID);
        ALTER TABLE dbo.ROIWin WITH CHECK ADD CONSTRAINT FK_ROIWin_RejectionReason FOREIGN KEY (RejectionReasonID) REFERENCES dbo.ROIRejectionReason (RejectionReasonID);
        ALTER TABLE dbo.ROIWin WITH CHECK ADD CONSTRAINT FK_ROIWin_CreatedBy FOREIGN KEY (CreatedByUserID) REFERENCES dbo.Users (UserID);
        ALTER TABLE dbo.ROIWin WITH CHECK ADD CONSTRAINT FK_ROIWin_LastEditedBy FOREIGN KEY (LastEditedByUserID) REFERENCES dbo.Users (UserID);
        ALTER TABLE dbo.ROIWin WITH CHECK ADD CONSTRAINT FK_ROIWin_SubmittedBy FOREIGN KEY (SubmittedByUserID) REFERENCES dbo.Users (UserID);
        ALTER TABLE dbo.ROIWin WITH CHECK ADD CONSTRAINT FK_ROIWin_ApprovedBy FOREIGN KEY (ApprovedByUserID) REFERENCES dbo.Users (UserID);
        ALTER TABLE dbo.ROIWin WITH CHECK ADD CONSTRAINT FK_ROIWin_RejectedBy FOREIGN KEY (RejectedByUserID) REFERENCES dbo.Users (UserID);
        ALTER TABLE dbo.ROIWin WITH CHECK ADD CONSTRAINT FK_ROIWin_DeletedBy FOREIGN KEY (DeletedByUserID) REFERENCES dbo.Users (UserID);
        ALTER TABLE dbo.ROIWin WITH CHECK ADD CONSTRAINT FK_ROIWin_ClientOwner FOREIGN KEY (ClientOwnerUserID) REFERENCES dbo.Users (UserID);

        -- Basic constraints
        ALTER TABLE dbo.ROIWin ADD CONSTRAINT CK_ROIWin_ImpactType CHECK (ImpactType IN ('Recurring','OneTime'));
        ALTER TABLE dbo.ROIWin ADD CONSTRAINT CK_ROIWin_Status CHECK (Status IN ('Draft','Submitted','Approved','Rejected'));
        ALTER TABLE dbo.ROIWin ADD CONSTRAINT CK_ROIWin_SpreadMonths CHECK (OneTimeSpreadMonths IS NULL OR (OneTimeSpreadMonths BETWEEN 1 AND 3));

        CREATE INDEX IX_ROIWin_Client_Status ON dbo.ROIWin (ClientID, Status) INCLUDE (ImpactType, ImpactDate, CreatedAt);
        CREATE INDEX IX_ROIWin_ImpactDate ON dbo.ROIWin (ImpactDate);
    END

    -- Win <> ActivityTag
    IF OBJECT_ID('dbo.ROIWinActivityTag', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.ROIWinActivityTag (
            ROIWinID UNIQUEIDENTIFIER NOT NULL,
            ActivityTagID INT NOT NULL,
            CONSTRAINT PK_ROIWinActivityTag PRIMARY KEY (ROIWinID, ActivityTagID)
        );

        ALTER TABLE dbo.ROIWinActivityTag WITH CHECK ADD CONSTRAINT FK_ROIWinActivityTag_Win FOREIGN KEY (ROIWinID) REFERENCES dbo.ROIWin (ROIWinID);
        ALTER TABLE dbo.ROIWinActivityTag WITH CHECK ADD CONSTRAINT FK_ROIWinActivityTag_Tag FOREIGN KEY (ActivityTagID) REFERENCES dbo.ROIActivityTag (ActivityTagID);

        CREATE INDEX IX_ROIWinActivityTag_Tag ON dbo.ROIWinActivityTag (ActivityTagID);
    END

    -- Win <> Consultant split
    IF OBJECT_ID('dbo.ROIWinConsultant', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.ROIWinConsultant (
            ROIWinConsultantID UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_ROIWinConsultant_ID DEFAULT NEWID() PRIMARY KEY,
            ROIWinID UNIQUEIDENTIFIER NOT NULL,
            ConsultantID UNIQUEIDENTIFIER NOT NULL,
            PercentSplit DECIMAL(5,2) NOT NULL,
            IsPrimary BIT NOT NULL CONSTRAINT DF_ROIWinConsultant_IsPrimary DEFAULT (0)
        );

        ALTER TABLE dbo.ROIWinConsultant WITH CHECK ADD CONSTRAINT FK_ROIWinConsultant_Win FOREIGN KEY (ROIWinID) REFERENCES dbo.ROIWin (ROIWinID);
        ALTER TABLE dbo.ROIWinConsultant WITH CHECK ADD CONSTRAINT FK_ROIWinConsultant_Consultant FOREIGN KEY (ConsultantID) REFERENCES dbo.Consultant (ConsultantID);

        ALTER TABLE dbo.ROIWinConsultant ADD CONSTRAINT UQ_ROIWinConsultant UNIQUE (ROIWinID, ConsultantID);
        ALTER TABLE dbo.ROIWinConsultant ADD CONSTRAINT CK_ROIWinConsultant_Split CHECK (PercentSplit > 0 AND PercentSplit <= 100);

        CREATE INDEX IX_ROIWinConsultant_Win ON dbo.ROIWinConsultant (ROIWinID);
        CREATE INDEX IX_ROIWinConsultant_Consultant ON dbo.ROIWinConsultant (ConsultantID);
    END

END TRY
BEGIN CATCH
    DECLARE @Err NVARCHAR(4000) = ERROR_MESSAGE();
    RAISERROR('ROI Tracker migration failed: %s', 16, 1, @Err);
END CATCH
