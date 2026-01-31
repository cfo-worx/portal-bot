-- Performance Reporting enhancements
-- Adds consultant capacity, benchmark distribution, reporting settings, holiday calendar, and issue notes
-- Safe to run multiple times (idempotent-ish) on SQL Server

/* 1) GlobalSettings additions */
IF COL_LENGTH('GlobalSettings', 'HoursVarianceWarnPct') IS NULL
BEGIN
    ALTER TABLE GlobalSettings
    ADD HoursVarianceWarnPct DECIMAL(6,4) NOT NULL
        CONSTRAINT DF_GlobalSettings_HoursVarianceWarnPct DEFAULT (0.0500);
END;

IF COL_LENGTH('GlobalSettings', 'HoursVarianceCriticalPct') IS NULL
BEGIN
    ALTER TABLE GlobalSettings
    ADD HoursVarianceCriticalPct DECIMAL(6,4) NOT NULL
        CONSTRAINT DF_GlobalSettings_HoursVarianceCriticalPct DEFAULT (0.1500);
END;

IF COL_LENGTH('GlobalSettings', 'BusinessDaysOnlyDefault') IS NULL
BEGIN
    ALTER TABLE GlobalSettings
    ADD BusinessDaysOnlyDefault BIT NOT NULL
        CONSTRAINT DF_GlobalSettings_BusinessDaysOnlyDefault DEFAULT (1);
END;

IF COL_LENGTH('GlobalSettings', 'IncludeSubmittedDefault') IS NULL
BEGIN
    ALTER TABLE GlobalSettings
    ADD IncludeSubmittedDefault BIT NOT NULL
        CONSTRAINT DF_GlobalSettings_IncludeSubmittedDefault DEFAULT (0);
END;

IF COL_LENGTH('GlobalSettings', 'WorkdayHoursDefault') IS NULL
BEGIN
    ALTER TABLE GlobalSettings
    ADD WorkdayHoursDefault DECIMAL(6,2) NOT NULL
        CONSTRAINT DF_GlobalSettings_WorkdayHoursDefault DEFAULT (8.00);
END;

/* 2) Consultant capacity */
IF COL_LENGTH('Consultant', 'CapacityHoursPerWeek') IS NULL
BEGIN
    ALTER TABLE Consultant
    ADD CapacityHoursPerWeek DECIMAL(6,2) NOT NULL
        CONSTRAINT DF_Consultant_CapacityHoursPerWeek DEFAULT (40.00);
END;

/* 3) Benchmark distribution type (effective dated via BenchmarkHistory) */
IF COL_LENGTH('Benchmark', 'DistributionType') IS NULL
BEGIN
    ALTER TABLE Benchmark
    ADD DistributionType NVARCHAR(50) NOT NULL
        CONSTRAINT DF_Benchmark_DistributionType DEFAULT ('linear');
END;

IF COL_LENGTH('BenchmarkHistory', 'DistributionType') IS NULL
BEGIN
    ALTER TABLE BenchmarkHistory
    ADD DistributionType NVARCHAR(50) NOT NULL
        CONSTRAINT DF_BenchmarkHistory_DistributionType DEFAULT ('linear');
END;

/* 4) Holiday calendar (company-defined non-working days) */
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[HolidayCalendar]') AND type in (N'U'))
BEGIN
    CREATE TABLE HolidayCalendar (
        HolidayDate DATE NOT NULL PRIMARY KEY,
        HolidayName NVARCHAR(200) NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_HolidayCalendar_CreatedAt DEFAULT (SYSUTCDATETIME())
    );
END;

/* 5) Report issue notes / acknowledgements (weekly review support) */
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ReportIssueNotes]') AND type in (N'U'))
BEGIN
    CREATE TABLE ReportIssueNotes (
        IssueKey NVARCHAR(250) NOT NULL PRIMARY KEY,
        IssueType NVARCHAR(50) NOT NULL,
        Severity NVARCHAR(20) NULL,
        PeriodStart DATE NOT NULL,
        PeriodEnd DATE NOT NULL,
        ClientID UNIQUEIDENTIFIER NULL,
        ConsultantID UNIQUEIDENTIFIER NULL,
        Role NVARCHAR(100) NULL,
        Status NVARCHAR(30) NOT NULL CONSTRAINT DF_ReportIssueNotes_Status DEFAULT ('open'),
        Decision NVARCHAR(50) NULL,
        SnoozedUntil DATE NULL,
        Notes NVARCHAR(MAX) NULL,
        AcknowledgedAt DATETIME2 NULL,
        AcknowledgedBy NVARCHAR(200) NULL,
        UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_ReportIssueNotes_UpdatedAt DEFAULT (SYSUTCDATETIME())
    );

    CREATE INDEX IX_ReportIssueNotes_Period ON ReportIssueNotes(PeriodStart, PeriodEnd);
    CREATE INDEX IX_ReportIssueNotes_ClientConsultant ON ReportIssueNotes(ClientID, ConsultantID);
END;
