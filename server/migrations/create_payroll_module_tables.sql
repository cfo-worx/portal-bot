/*
  CFO Worx Portal — Payroll + External Time Consolidation

  Tables:
    - PayrollRun
    - PayrollRunLine
    - PayrollRunException
    - PayrollAdjustment
    - ExternalTimeIntegrationLink
    - ExternalTimeEntry

  Notes:
    - Idempotent (safe to run multiple times)
    - Uses dbo schema
*/

-- PayrollRun
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[PayrollRun]') AND type in (N'U'))
BEGIN
  CREATE TABLE dbo.PayrollRun (
    PayrollRunID UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_PayrollRun PRIMARY KEY,
    RunType NVARCHAR(20) NOT NULL, -- BIWEEKLY | MONTHLY
    PeriodStart DATE NOT NULL,
    PeriodEnd DATE NOT NULL,
    IncludeSubmitted BIT NOT NULL CONSTRAINT DF_PayrollRun_IncludeSubmitted DEFAULT(0),
    Status NVARCHAR(20) NOT NULL CONSTRAINT DF_PayrollRun_Status DEFAULT('Draft'), -- Draft | Calculated | Finalized
    CreatedBy NVARCHAR(255) NULL,
    CreatedOn DATETIME2 NOT NULL CONSTRAINT DF_PayrollRun_CreatedOn DEFAULT(SYSUTCDATETIME()),
    UpdatedOn DATETIME2 NOT NULL CONSTRAINT DF_PayrollRun_UpdatedOn DEFAULT(SYSUTCDATETIME()),
    FinalizedOn DATETIME2 NULL,
    Notes NVARCHAR(MAX) NULL
  );

  CREATE INDEX IX_PayrollRun_Period ON dbo.PayrollRun(PeriodStart, PeriodEnd);
END;

-- PayrollRunLine
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[PayrollRunLine]') AND type in (N'U'))
BEGIN
  CREATE TABLE dbo.PayrollRunLine (
    PayrollRunLineID UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_PayrollRunLine PRIMARY KEY,
    PayrollRunID UNIQUEIDENTIFIER NOT NULL,
    ConsultantID UNIQUEIDENTIFIER NOT NULL,
    ConsultantName NVARCHAR(255) NULL,
    PayType NVARCHAR(30) NULL,
    TimecardCycle NVARCHAR(30) NULL,
    PayrollProvider NVARCHAR(30) NULL, -- Portal | Upwork | OnlineJobs | Wise | Wire | Other

    ExpectedWorkDays DECIMAL(8,2) NOT NULL CONSTRAINT DF_PayrollRunLine_ExpectedWorkDays DEFAULT(0),
    ExpectedHours DECIMAL(8,2) NOT NULL CONSTRAINT DF_PayrollRunLine_ExpectedHours DEFAULT(0),
    TimeOffDays DECIMAL(8,2) NOT NULL CONSTRAINT DF_PayrollRunLine_TimeOffDays DEFAULT(0),
    HolidayDays DECIMAL(8,2) NOT NULL CONSTRAINT DF_PayrollRunLine_HolidayDays DEFAULT(0),

    ApprovedHours DECIMAL(10,2) NOT NULL CONSTRAINT DF_PayrollRunLine_ApprovedHours DEFAULT(0),
    SubmittedHours DECIMAL(10,2) NOT NULL CONSTRAINT DF_PayrollRunLine_SubmittedHours DEFAULT(0),
    ExternalTrackedHours DECIMAL(10,2) NOT NULL CONSTRAINT DF_PayrollRunLine_ExternalTrackedHours DEFAULT(0),
    UnallocatedExternalHours DECIMAL(10,2) NOT NULL CONSTRAINT DF_PayrollRunLine_UnallocatedExternalHours DEFAULT(0),

    HourlyRate DECIMAL(18,2) NULL,
    PeriodPayRate DECIMAL(18,2) NULL, -- salary/flat amount for this cycle

    Reimbursements DECIMAL(18,2) NOT NULL CONSTRAINT DF_PayrollRunLine_Reimbursements DEFAULT(0),
    Deductions DECIMAL(18,2) NOT NULL CONSTRAINT DF_PayrollRunLine_Deductions DEFAULT(0),
    CatchUpHours DECIMAL(10,2) NOT NULL CONSTRAINT DF_PayrollRunLine_CatchUpHours DEFAULT(0),

    GrossPay DECIMAL(18,2) NOT NULL CONSTRAINT DF_PayrollRunLine_GrossPay DEFAULT(0),
    NetPay DECIMAL(18,2) NOT NULL CONSTRAINT DF_PayrollRunLine_NetPay DEFAULT(0),
    AvgActivityPercent DECIMAL(6,2) NULL,
    Flags NVARCHAR(400) NULL,

    CreatedOn DATETIME2 NOT NULL CONSTRAINT DF_PayrollRunLine_CreatedOn DEFAULT(SYSUTCDATETIME())
  );

  ALTER TABLE dbo.PayrollRunLine
    ADD CONSTRAINT FK_PayrollRunLine_PayrollRun
      FOREIGN KEY (PayrollRunID) REFERENCES dbo.PayrollRun(PayrollRunID) ON DELETE CASCADE;

  CREATE INDEX IX_PayrollRunLine_Run ON dbo.PayrollRunLine(PayrollRunID);
  CREATE INDEX IX_PayrollRunLine_Consultant ON dbo.PayrollRunLine(ConsultantID);
END;

-- PayrollRunException
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[PayrollRunException]') AND type in (N'U'))
BEGIN
  CREATE TABLE dbo.PayrollRunException (
    PayrollRunExceptionID UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_PayrollRunException PRIMARY KEY,
    PayrollRunID UNIQUEIDENTIFIER NOT NULL,
    ConsultantID UNIQUEIDENTIFIER NULL,
    WorkDate DATE NULL,
    ExceptionType NVARCHAR(50) NOT NULL, -- HOURS_MISMATCH | UNALLOCATED_TIME | LOW_ACTIVITY | LATE_ENTRY | MISSING_HOURS
    Severity NVARCHAR(10) NOT NULL CONSTRAINT DF_PayrollRunException_Severity DEFAULT('WARN'), -- INFO | WARN | CRIT
    Source NVARCHAR(30) NULL, -- Portal | Upwork | Hubstaff
    PortalHours DECIMAL(10,2) NULL,
    ExternalHours DECIMAL(10,2) NULL,
    ActivityPercent DECIMAL(6,2) NULL,
    Details NVARCHAR(MAX) NULL,
    Resolved BIT NOT NULL CONSTRAINT DF_PayrollRunException_Resolved DEFAULT(0),
    ResolvedBy NVARCHAR(255) NULL,
    ResolvedOn DATETIME2 NULL,
    CreatedOn DATETIME2 NOT NULL CONSTRAINT DF_PayrollRunException_CreatedOn DEFAULT(SYSUTCDATETIME())
  );

  ALTER TABLE dbo.PayrollRunException
    ADD CONSTRAINT FK_PayrollRunException_PayrollRun
      FOREIGN KEY (PayrollRunID) REFERENCES dbo.PayrollRun(PayrollRunID) ON DELETE CASCADE;

  CREATE INDEX IX_PayrollRunException_Run ON dbo.PayrollRunException(PayrollRunID);
  CREATE INDEX IX_PayrollRunException_Consultant ON dbo.PayrollRunException(ConsultantID);
END;

-- PayrollAdjustment (manual reimbursements/deductions/catch-up)
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[PayrollAdjustment]') AND type in (N'U'))
BEGIN
  CREATE TABLE dbo.PayrollAdjustment (
    PayrollAdjustmentID UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_PayrollAdjustment PRIMARY KEY,
    ConsultantID UNIQUEIDENTIFIER NOT NULL,
    PeriodStart DATE NOT NULL,
    PeriodEnd DATE NOT NULL,
    AdjustmentType NVARCHAR(30) NOT NULL, -- REIMBURSEMENT | DEDUCTION | CATCHUP
    Amount DECIMAL(18,2) NULL,
    Hours DECIMAL(10,2) NULL,
    Description NVARCHAR(500) NULL,
    CreatedBy NVARCHAR(255) NULL,
    CreatedOn DATETIME2 NOT NULL CONSTRAINT DF_PayrollAdjustment_CreatedOn DEFAULT(SYSUTCDATETIME())
  );
  CREATE INDEX IX_PayrollAdjustment_Period ON dbo.PayrollAdjustment(PeriodStart, PeriodEnd);
  CREATE INDEX IX_PayrollAdjustment_Consultant ON dbo.PayrollAdjustment(ConsultantID);
END;

-- ExternalTimeIntegrationLink (maps a consultant to an external worker id per source)
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ExternalTimeIntegrationLink]') AND type in (N'U'))
BEGIN
  CREATE TABLE dbo.ExternalTimeIntegrationLink (
    IntegrationLinkID UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_ExternalTimeIntegrationLink PRIMARY KEY,
    ConsultantID UNIQUEIDENTIFIER NOT NULL,
    Source NVARCHAR(30) NOT NULL, -- Upwork | Hubstaff
    ExternalWorkerID NVARCHAR(100) NOT NULL,
    ExternalContractID NVARCHAR(100) NULL,
    IsActive BIT NOT NULL CONSTRAINT DF_ExternalTimeIntegrationLink_IsActive DEFAULT(1),
    CreatedOn DATETIME2 NOT NULL CONSTRAINT DF_ExternalTimeIntegrationLink_CreatedOn DEFAULT(SYSUTCDATETIME()),
    UpdatedOn DATETIME2 NOT NULL CONSTRAINT DF_ExternalTimeIntegrationLink_UpdatedOn DEFAULT(SYSUTCDATETIME())
  );
  CREATE UNIQUE INDEX UX_ExternalTimeIntegrationLink_SourceWorker ON dbo.ExternalTimeIntegrationLink(Source, ExternalWorkerID);
  CREATE INDEX IX_ExternalTimeIntegrationLink_Consultant ON dbo.ExternalTimeIntegrationLink(ConsultantID);
END;

-- ExternalTimeEntry
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ExternalTimeEntry]') AND type in (N'U'))
BEGIN
  CREATE TABLE dbo.ExternalTimeEntry (
    ExternalTimeEntryID UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_ExternalTimeEntry PRIMARY KEY,
    Source NVARCHAR(30) NOT NULL, -- Upwork | Hubstaff
    ExternalWorkerID NVARCHAR(100) NOT NULL,
    ExternalContractID NVARCHAR(100) NULL,
    WorkDate DATE NOT NULL,
    Hours DECIMAL(10,2) NOT NULL,
    ActivityPercent DECIMAL(6,2) NULL,
    ConsultantID UNIQUEIDENTIFIER NULL,
    ImportedOn DATETIME2 NOT NULL CONSTRAINT DF_ExternalTimeEntry_ImportedOn DEFAULT(SYSUTCDATETIME()),
    ImportedBy NVARCHAR(255) NULL,
    RawPayload NVARCHAR(MAX) NULL
  );

  CREATE INDEX IX_ExternalTimeEntry_WorkDate ON dbo.ExternalTimeEntry(WorkDate);
  CREATE INDEX IX_ExternalTimeEntry_SourceWorkerDate ON dbo.ExternalTimeEntry(Source, ExternalWorkerID, WorkDate);
  CREATE INDEX IX_ExternalTimeEntry_Consultant ON dbo.ExternalTimeEntry(ConsultantID);
END;
