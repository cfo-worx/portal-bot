/*
  CFO Worx Portal - Client Work module
  Consolidates: Client dashboard actions, Close (checklist + QA scan), AI reporting runs,
  13-week cash forecast, board pack builder (templates + packs), market intelligence,
  and internal accounting staff evaluation.

  NOTE: This migration is written to be idempotent (safe to run multiple times).
  Table/column conventions follow the rest of the portal schema (UNIQUEIDENTIFIER PKs).
*/

-- ----------------------------
-- ClientWorkSettings
-- ----------------------------
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ClientWorkSettings]') AND type IN (N'U'))
BEGIN
  CREATE TABLE [dbo].[ClientWorkSettings] (
    [ClientWorkSettingsID] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_ClientWorkSettingsID] DEFAULT NEWID(),
    [ClientID] UNIQUEIDENTIFIER NOT NULL,
    [SettingsJson] NVARCHAR(MAX) NULL,
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_ClientWorkSettings_CreatedAt] DEFAULT SYSUTCDATETIME(),
    [UpdatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_ClientWorkSettings_UpdatedAt] DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_ClientWorkSettings] PRIMARY KEY CLUSTERED ([ClientWorkSettingsID]),
    CONSTRAINT [UQ_ClientWorkSettings_ClientID] UNIQUE ([ClientID]),
    CONSTRAINT [FK_ClientWorkSettings_Client] FOREIGN KEY ([ClientID]) REFERENCES [dbo].[Client]([ClientID])
  );

  CREATE INDEX [IX_ClientWorkSettings_ClientID] ON [dbo].[ClientWorkSettings]([ClientID]);
END

-- ----------------------------
-- Close Checklist
-- ----------------------------
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ClientWorkCloseRuns]') AND type IN (N'U'))
BEGIN
  CREATE TABLE [dbo].[ClientWorkCloseRuns] (
    [CloseRunID] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_ClientWorkCloseRuns_CloseRunID] DEFAULT NEWID(),
    [ClientID] UNIQUEIDENTIFIER NOT NULL,
    [PeriodKey] NVARCHAR(7) NOT NULL, -- YYYY-MM
    [AsOfDate] DATE NULL,
    [Status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_ClientWorkCloseRuns_Status] DEFAULT 'Draft', -- Draft|Submitted|Approved
    [Notes] NVARCHAR(MAX) NULL,
    [CreatedByUserID] UNIQUEIDENTIFIER NULL,
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_ClientWorkCloseRuns_CreatedAt] DEFAULT SYSUTCDATETIME(),
    [UpdatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_ClientWorkCloseRuns_UpdatedAt] DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_ClientWorkCloseRuns] PRIMARY KEY CLUSTERED ([CloseRunID]),
    CONSTRAINT [FK_ClientWorkCloseRuns_Client] FOREIGN KEY ([ClientID]) REFERENCES [dbo].[Client]([ClientID])
  );
  CREATE INDEX [IX_ClientWorkCloseRuns_Client_Period] ON [dbo].[ClientWorkCloseRuns]([ClientID],[PeriodKey]);
END

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ClientWorkCloseChecklistItems]') AND type IN (N'U'))
BEGIN
  CREATE TABLE [dbo].[ClientWorkCloseChecklistItems] (
    [CloseChecklistItemID] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_ClientWorkCloseChecklistItems_ID] DEFAULT NEWID(),
    [CloseRunID] UNIQUEIDENTIFIER NOT NULL,
    [ItemKey] NVARCHAR(100) NOT NULL,
    [ItemLabel] NVARCHAR(255) NOT NULL,
    [IsComplete] BIT NOT NULL CONSTRAINT [DF_ClientWorkCloseChecklistItems_IsComplete] DEFAULT 0,
    [CompletedByUserID] UNIQUEIDENTIFIER NULL,
    [CompletedAt] DATETIME2 NULL,
    [Notes] NVARCHAR(MAX) NULL,
    [UpdatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_ClientWorkCloseChecklistItems_UpdatedAt] DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_ClientWorkCloseChecklistItems] PRIMARY KEY CLUSTERED ([CloseChecklistItemID]),
    CONSTRAINT [FK_ClientWorkCloseChecklistItems_CloseRun] FOREIGN KEY ([CloseRunID]) REFERENCES [dbo].[ClientWorkCloseRuns]([CloseRunID]) ON DELETE CASCADE
  );

  CREATE INDEX [IX_ClientWorkCloseChecklistItems_CloseRun] ON [dbo].[ClientWorkCloseChecklistItems]([CloseRunID]);
END

-- ----------------------------
-- Close QA Scan
-- ----------------------------
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ClientWorkCloseQAScanRuns]') AND type IN (N'U'))
BEGIN
  CREATE TABLE [dbo].[ClientWorkCloseQAScanRuns] (
    [QAScanRunID] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_ClientWorkCloseQAScanRuns_ID] DEFAULT NEWID(),
    [ClientID] UNIQUEIDENTIFIER NOT NULL,
    [PeriodKey] NVARCHAR(10) NOT NULL,
    [AsOfDate] DATE NULL,
    [Status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_ClientWorkCloseQAScanRuns_Status] DEFAULT 'Draft', -- Draft|Uploaded|Completed
    [CreatedByUserID] UNIQUEIDENTIFIER NULL,
    [SourceFileName] NVARCHAR(255) NULL,
    [SourceFilePath] NVARCHAR(500) NULL,
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_ClientWorkCloseQAScanRuns_CreatedAt] DEFAULT SYSUTCDATETIME(),
    [UpdatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_ClientWorkCloseQAScanRuns_UpdatedAt] DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_ClientWorkCloseQAScanRuns] PRIMARY KEY CLUSTERED ([QAScanRunID]),
    CONSTRAINT [FK_ClientWorkCloseQAScanRuns_Client] FOREIGN KEY ([ClientID]) REFERENCES [dbo].[Client]([ClientID])
  );
  CREATE INDEX [IX_ClientWorkCloseQAScanRuns_Client_Period] ON [dbo].[ClientWorkCloseQAScanRuns]([ClientID],[PeriodKey]);
END

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ClientWorkGLTransactions]') AND type IN (N'U'))
BEGIN
  CREATE TABLE [dbo].[ClientWorkGLTransactions] (
    [GLTransactionID] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_ClientWorkGLTransactions_ID] DEFAULT NEWID(),
    [ClientID] UNIQUEIDENTIFIER NOT NULL,
    [PeriodKey] NVARCHAR(10) NOT NULL,
    [TxnDate] DATE NULL,
    [AccountName] NVARCHAR(255) NULL,
    [VendorName] NVARCHAR(255) NULL,
    [CustomerName] NVARCHAR(255) NULL,
    [ClassName] NVARCHAR(255) NULL,
    [LocationName] NVARCHAR(255) NULL,
    [Amount] DECIMAL(18,2) NOT NULL CONSTRAINT [DF_ClientWorkGLTransactions_Amount] DEFAULT 0,
    [Memo] NVARCHAR(MAX) NULL,
    [Source] NVARCHAR(100) NOT NULL CONSTRAINT [DF_ClientWorkGLTransactions_Source] DEFAULT 'upload',
    CONSTRAINT [PK_ClientWorkGLTransactions] PRIMARY KEY CLUSTERED ([GLTransactionID]),
    CONSTRAINT [FK_ClientWorkGLTransactions_Client] FOREIGN KEY ([ClientID]) REFERENCES [dbo].[Client]([ClientID])
  );

  CREATE INDEX [IX_ClientWorkGLTransactions_Client_Period] ON [dbo].[ClientWorkGLTransactions]([ClientID],[PeriodKey]);
  CREATE INDEX [IX_ClientWorkGLTransactions_Account] ON [dbo].[ClientWorkGLTransactions]([AccountName]);
  CREATE INDEX [IX_ClientWorkGLTransactions_Vendor] ON [dbo].[ClientWorkGLTransactions]([VendorName]);
END

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ClientWorkCloseQAFlags]') AND type IN (N'U'))
BEGIN
  CREATE TABLE [dbo].[ClientWorkCloseQAFlags] (
    [CloseQAFlagID] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_ClientWorkCloseQAFlags_ID] DEFAULT NEWID(),
    [QAScanRunID] UNIQUEIDENTIFIER NOT NULL,
    [Severity] NVARCHAR(20) NOT NULL CONSTRAINT [DF_ClientWorkCloseQAFlags_Severity] DEFAULT 'Warning', -- Warning|Critical
    [Category] NVARCHAR(100) NOT NULL,
    [AccountName] NVARCHAR(255) NULL,
    [VendorName] NVARCHAR(255) NULL,
    [CustomerName] NVARCHAR(255) NULL,
    [TxnDate] DATE NULL,
    [Amount] DECIMAL(18,2) NULL,
    [Description] NVARCHAR(MAX) NOT NULL,
    [SuggestedFix] NVARCHAR(MAX) NULL,
    [Status] NVARCHAR(50) NOT NULL CONSTRAINT [DF_ClientWorkCloseQAFlags_Status] DEFAULT 'Open', -- Open|Dismissed|Resolved
    [ReviewerUserID] UNIQUEIDENTIFIER NULL,
    [ReviewerNotes] NVARCHAR(MAX) NULL,
    [ResolutionNotes] NVARCHAR(MAX) NULL,
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_ClientWorkCloseQAFlags_CreatedAt] DEFAULT SYSUTCDATETIME(),
    [UpdatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_ClientWorkCloseQAFlags_UpdatedAt] DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_ClientWorkCloseQAFlags] PRIMARY KEY CLUSTERED ([CloseQAFlagID]),
    CONSTRAINT [FK_ClientWorkCloseQAFlags_QAScanRun] FOREIGN KEY ([QAScanRunID]) REFERENCES [dbo].[ClientWorkCloseQAScanRuns]([QAScanRunID]) ON DELETE CASCADE
  );

  CREATE INDEX [IX_ClientWorkCloseQAFlags_Run] ON [dbo].[ClientWorkCloseQAFlags]([QAScanRunID]);
  CREATE INDEX [IX_ClientWorkCloseQAFlags_Status] ON [dbo].[ClientWorkCloseQAFlags]([Status]);
END

-- ----------------------------
-- AI Reporting Runs
-- ----------------------------
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ClientWorkAIRuns]') AND type IN (N'U'))
BEGIN
  CREATE TABLE [dbo].[ClientWorkAIRuns] (
    [AIRunID] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_ClientWorkAIRuns_ID] DEFAULT NEWID(),
    [ClientID] UNIQUEIDENTIFIER NOT NULL,
    [PeriodKey] NVARCHAR(10) NOT NULL,
    [AsOfDate] DATE NULL,
    [Status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_ClientWorkAIRuns_Status] DEFAULT 'Draft', -- Draft|Published|Locked
    [InputsJson] NVARCHAR(MAX) NULL,
    [OutputJson] NVARCHAR(MAX) NULL,
    [OutputEmailText] NVARCHAR(MAX) NULL,
    [PublishedAt] DATETIME2 NULL,
    [PublishedByUserID] UNIQUEIDENTIFIER NULL,
    [LockedAt] DATETIME2 NULL,
    [LockedByUserID] UNIQUEIDENTIFIER NULL,
    [CreatedByUserID] UNIQUEIDENTIFIER NULL,
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_ClientWorkAIRuns_CreatedAt] DEFAULT SYSUTCDATETIME(),
    [UpdatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_ClientWorkAIRuns_UpdatedAt] DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_ClientWorkAIRuns] PRIMARY KEY CLUSTERED ([AIRunID]),
    CONSTRAINT [FK_ClientWorkAIRuns_Client] FOREIGN KEY ([ClientID]) REFERENCES [dbo].[Client]([ClientID])
  );

  CREATE INDEX [IX_ClientWorkAIRuns_Client_Period] ON [dbo].[ClientWorkAIRuns]([ClientID],[PeriodKey]);
  CREATE INDEX [IX_ClientWorkAIRuns_Status] ON [dbo].[ClientWorkAIRuns]([Status]);
END

-- ----------------------------
-- Cash Forecasts (13-week)
-- ----------------------------
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ClientWorkCashForecasts]') AND type IN (N'U'))
BEGIN
  CREATE TABLE [dbo].[ClientWorkCashForecasts] (
    [CashForecastID] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_ClientWorkCashForecasts_ID] DEFAULT NEWID(),
    [ClientID] UNIQUEIDENTIFIER NOT NULL,
    [ScenarioName] NVARCHAR(50) NOT NULL CONSTRAINT [DF_ClientWorkCashForecasts_Scenario] DEFAULT 'Base',
    [StartWeekEndingDate] DATE NOT NULL, -- Friday week-ending
    [StartingCashBalanceOverride] DECIMAL(18,2) NULL,
    [StartingLiquidityAvailable] DECIMAL(18,2) NULL,
    [WarningCashThreshold] DECIMAL(18,2) NULL,
    [CriticalCashThreshold] DECIMAL(18,2) NULL,
    [Status] NVARCHAR(50) NOT NULL CONSTRAINT [DF_ClientWorkCashForecasts_Status] DEFAULT 'Draft',
    [CreatedByUserID] UNIQUEIDENTIFIER NULL,
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_ClientWorkCashForecasts_CreatedAt] DEFAULT SYSUTCDATETIME(),
    [UpdatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_ClientWorkCashForecasts_UpdatedAt] DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_ClientWorkCashForecasts] PRIMARY KEY CLUSTERED ([CashForecastID]),
    CONSTRAINT [FK_ClientWorkCashForecasts_Client] FOREIGN KEY ([ClientID]) REFERENCES [dbo].[Client]([ClientID])
  );

  CREATE INDEX [IX_ClientWorkCashForecasts_Client] ON [dbo].[ClientWorkCashForecasts]([ClientID]);
  CREATE INDEX [IX_ClientWorkCashForecasts_Client_Scenario_Start] ON [dbo].[ClientWorkCashForecasts]([ClientID],[ScenarioName],[StartWeekEndingDate]);
END

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ClientWorkCashForecastLines]') AND type IN (N'U'))
BEGIN
  CREATE TABLE [dbo].[ClientWorkCashForecastLines] (
    [CashForecastLineID] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_ClientWorkCashForecastLines_ID] DEFAULT NEWID(),
    [CashForecastID] UNIQUEIDENTIFIER NOT NULL,
    [WeekEndingDate] DATE NOT NULL,
    [LineType] NVARCHAR(50) NOT NULL, -- AR|AP|Payroll|Tax|Other
    [Direction] NVARCHAR(20) NOT NULL, -- Inflow|Outflow
    [CounterpartyType] NVARCHAR(50) NULL,
    [CounterpartyName] NVARCHAR(255) NULL,
    [Amount] DECIMAL(18,2) NOT NULL,
    [Notes] NVARCHAR(MAX) NULL,
    [ClientNote] NVARCHAR(MAX) NULL,
    [HasClientNote] BIT NOT NULL CONSTRAINT [DF_ClientWorkCashForecastLines_HasClientNote] DEFAULT 0,
    [CreatedByUserID] UNIQUEIDENTIFIER NULL,
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_ClientWorkCashForecastLines_CreatedAt] DEFAULT SYSUTCDATETIME(),
    [UpdatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_ClientWorkCashForecastLines_UpdatedAt] DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_ClientWorkCashForecastLines] PRIMARY KEY CLUSTERED ([CashForecastLineID]),
    CONSTRAINT [FK_ClientWorkCashForecastLines_Forecast] FOREIGN KEY ([CashForecastID]) REFERENCES [dbo].[ClientWorkCashForecasts]([CashForecastID]) ON DELETE CASCADE
  );

  CREATE INDEX [IX_ClientWorkCashForecastLines_Forecast] ON [dbo].[ClientWorkCashForecastLines]([CashForecastID]);
  CREATE INDEX [IX_ClientWorkCashForecastLines_WeekEnding] ON [dbo].[ClientWorkCashForecastLines]([WeekEndingDate]);
END

-- ----------------------------
-- Board Pack Builder
-- ----------------------------
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ClientWorkBoardPackTemplates]') AND type IN (N'U'))
BEGIN
  CREATE TABLE [dbo].[ClientWorkBoardPackTemplates] (
    [BoardPackTemplateID] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_ClientWorkBoardPackTemplates_ID] DEFAULT NEWID(),
    [TemplateName] NVARCHAR(200) NOT NULL,
    [Description] NVARCHAR(MAX) NULL,
    [TemplateJson] NVARCHAR(MAX) NULL,
    [CreatedByUserID] UNIQUEIDENTIFIER NULL,
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_ClientWorkBoardPackTemplates_CreatedAt] DEFAULT SYSUTCDATETIME(),
    [UpdatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_ClientWorkBoardPackTemplates_UpdatedAt] DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_ClientWorkBoardPackTemplates] PRIMARY KEY CLUSTERED ([BoardPackTemplateID])
  );
END

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ClientWorkBoardPacks]') AND type IN (N'U'))
BEGIN
  CREATE TABLE [dbo].[ClientWorkBoardPacks] (
    [BoardPackID] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_ClientWorkBoardPacks_ID] DEFAULT NEWID(),
    [ClientID] UNIQUEIDENTIFIER NOT NULL,
    [PeriodKey] NVARCHAR(10) NOT NULL,
    [BoardPackTemplateID] UNIQUEIDENTIFIER NULL,
    [Status] NVARCHAR(50) NOT NULL CONSTRAINT [DF_ClientWorkBoardPacks_Status] DEFAULT 'Draft', -- Draft|Generated|Published
    [ConfigJson] NVARCHAR(MAX) NULL,
    [CreatedByUserID] UNIQUEIDENTIFIER NULL,
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_ClientWorkBoardPacks_CreatedAt] DEFAULT SYSUTCDATETIME(),
    [UpdatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_ClientWorkBoardPacks_UpdatedAt] DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_ClientWorkBoardPacks] PRIMARY KEY CLUSTERED ([BoardPackID]),
    CONSTRAINT [FK_ClientWorkBoardPacks_Client] FOREIGN KEY ([ClientID]) REFERENCES [dbo].[Client]([ClientID])
  );

  CREATE INDEX [IX_ClientWorkBoardPacks_Client_Period] ON [dbo].[ClientWorkBoardPacks]([ClientID],[PeriodKey]);
END

-- ----------------------------
-- Market Intelligence
-- ----------------------------
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ClientWorkMarketIntelRuns]') AND type IN (N'U'))
BEGIN
  CREATE TABLE [dbo].[ClientWorkMarketIntelRuns] (
    [MarketIntelRunID] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_ClientWorkMarketIntelRuns_ID] DEFAULT NEWID(),
    [ClientID] UNIQUEIDENTIFIER NOT NULL,
    [RunAt] DATETIME2 NOT NULL,
    [Status] NVARCHAR(50) NOT NULL CONSTRAINT [DF_ClientWorkMarketIntelRuns_Status] DEFAULT 'Completed',
    [QueryJson] NVARCHAR(MAX) NULL,
    [CreatedByUserID] UNIQUEIDENTIFIER NULL,
    CONSTRAINT [PK_ClientWorkMarketIntelRuns] PRIMARY KEY CLUSTERED ([MarketIntelRunID]),
    CONSTRAINT [FK_ClientWorkMarketIntelRuns_Client] FOREIGN KEY ([ClientID]) REFERENCES [dbo].[Client]([ClientID])
  );

  CREATE INDEX [IX_ClientWorkMarketIntelRuns_Client] ON [dbo].[ClientWorkMarketIntelRuns]([ClientID]);
END

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ClientWorkMarketIntelItems]') AND type IN (N'U'))
BEGIN
  CREATE TABLE [dbo].[ClientWorkMarketIntelItems] (
    [MarketIntelItemID] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_ClientWorkMarketIntelItems_ID] DEFAULT NEWID(),
    [MarketIntelRunID] UNIQUEIDENTIFIER NULL,
    [ClientID] UNIQUEIDENTIFIER NOT NULL,
    [PublishedAt] DATETIME2 NULL,
    [Title] NVARCHAR(500) NOT NULL,
    [Source] NVARCHAR(255) NULL,
    [Url] NVARCHAR(1000) NULL,
    [Category] NVARCHAR(100) NULL,
    [Summary] NVARCHAR(MAX) NULL,
    [IsPinned] BIT NOT NULL CONSTRAINT [DF_ClientWorkMarketIntelItems_IsPinned] DEFAULT 0,
    [Tags] NVARCHAR(500) NULL,
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_ClientWorkMarketIntelItems_CreatedAt] DEFAULT SYSUTCDATETIME(),
    [UpdatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_ClientWorkMarketIntelItems_UpdatedAt] DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_ClientWorkMarketIntelItems] PRIMARY KEY CLUSTERED ([MarketIntelItemID]),
    CONSTRAINT [FK_ClientWorkMarketIntelItems_Client] FOREIGN KEY ([ClientID]) REFERENCES [dbo].[Client]([ClientID])
  );

  CREATE INDEX [IX_ClientWorkMarketIntelItems_Client] ON [dbo].[ClientWorkMarketIntelItems]([ClientID]);
  CREATE INDEX [IX_ClientWorkMarketIntelItems_Pinned] ON [dbo].[ClientWorkMarketIntelItems]([IsPinned]);
END

-- ----------------------------
-- Internal Accounting Staff Evaluation
-- ----------------------------
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ClientWorkAccountingStaff]') AND type IN (N'U'))
BEGIN
  CREATE TABLE [dbo].[ClientWorkAccountingStaff] (
    [AccountingStaffID] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_ClientWorkAccountingStaff_ID] DEFAULT NEWID(),
    [ClientID] UNIQUEIDENTIFIER NOT NULL,
    [FullName] NVARCHAR(200) NOT NULL,
    [RoleTitle] NVARCHAR(200) NULL,
    [Email] NVARCHAR(255) NULL,
    [Phone] NVARCHAR(50) NULL,
    [IsActive] BIT NOT NULL CONSTRAINT [DF_ClientWorkAccountingStaff_IsActive] DEFAULT 1,
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_ClientWorkAccountingStaff_CreatedAt] DEFAULT SYSUTCDATETIME(),
    [UpdatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_ClientWorkAccountingStaff_UpdatedAt] DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_ClientWorkAccountingStaff] PRIMARY KEY CLUSTERED ([AccountingStaffID]),
    CONSTRAINT [FK_ClientWorkAccountingStaff_Client] FOREIGN KEY ([ClientID]) REFERENCES [dbo].[Client]([ClientID])
  );

  CREATE INDEX [IX_ClientWorkAccountingStaff_Client] ON [dbo].[ClientWorkAccountingStaff]([ClientID]);
END

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ClientWorkAccountingStaffEvaluations]') AND type IN (N'U'))
BEGIN
  CREATE TABLE [dbo].[ClientWorkAccountingStaffEvaluations] (
    [EvaluationID] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_ClientWorkAccountingStaffEvaluations_ID] DEFAULT NEWID(),
    [ClientID] UNIQUEIDENTIFIER NOT NULL,
    [AccountingStaffID] UNIQUEIDENTIFIER NULL,
    [PeriodKey] NVARCHAR(10) NULL,
    [OverallRating] DECIMAL(4,2) NULL,
    [WouldHire] BIT NULL,
    [ScoresJson] NVARCHAR(MAX) NULL,
    [ShareableSummary] NVARCHAR(MAX) NULL,
    [InternalNotes] NVARCHAR(MAX) NULL,
    [CreatedByUserID] UNIQUEIDENTIFIER NULL,
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_ClientWorkAccountingStaffEvaluations_CreatedAt] DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_ClientWorkAccountingStaffEvaluations] PRIMARY KEY CLUSTERED ([EvaluationID]),
    CONSTRAINT [FK_ClientWorkAccountingStaffEvaluations_Client] FOREIGN KEY ([ClientID]) REFERENCES [dbo].[Client]([ClientID])
  );

  CREATE INDEX [IX_ClientWorkAccountingStaffEvaluations_Client] ON [dbo].[ClientWorkAccountingStaffEvaluations]([ClientID]);
END

