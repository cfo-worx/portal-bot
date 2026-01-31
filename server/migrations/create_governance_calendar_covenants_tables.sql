/*
  CFO Worx Portal — Governance Calendar + Covenant Monitoring
  Tables:
    - GovernanceSettings
    - GovernanceCalendarEvent
    - GovernanceCalendarEventAttachment
    - ClientCovenant
    - ClientCovenantSnapshot
    - ClientCovenantAttachment
    - ClientCovenantAlert
*/

-- Settings (singleton row)
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='GovernanceSettings' AND xtype='U')
BEGIN
  CREATE TABLE dbo.GovernanceSettings (
    SettingsID INT IDENTITY(1,1) PRIMARY KEY,
    DefaultComplianceLeadDays INT NOT NULL DEFAULT 14,
    DefaultInsuranceLeadDays INT NOT NULL DEFAULT 60,
    DefaultVendorLeadDays INT NOT NULL DEFAULT 30,
    DigestEnabled BIT NOT NULL DEFAULT 1,
    DigestCron NVARCHAR(50) NOT NULL DEFAULT '30 8 * * *', -- 08:30 daily
    Timezone NVARCHAR(100) NOT NULL DEFAULT 'America/New_York',
    TeamsWebhookUrl NVARCHAR(400) NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NULL
  );
END;

IF NOT EXISTS (SELECT 1 FROM dbo.GovernanceSettings)
BEGIN
  INSERT INTO dbo.GovernanceSettings (DefaultComplianceLeadDays, DefaultInsuranceLeadDays, DefaultVendorLeadDays, DigestEnabled, DigestCron, Timezone)
  VALUES (14, 60, 30, 1, '30 8 * * *', 'America/New_York');
END;

-- Calendar Events
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='GovernanceCalendarEvent' AND xtype='U')
BEGIN
  CREATE TABLE dbo.GovernanceCalendarEvent (
    EventID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
    ClientID UNIQUEIDENTIFIER NULL, -- NULL = CFO Worx internal
    EventType NVARCHAR(50) NOT NULL, -- Compliance | Insurance | VendorContract | CovenantReport
    Title NVARCHAR(200) NOT NULL,
    Category NVARCHAR(120) NULL, -- e.g., Payroll Tax, Workers Comp, IT
    JurisdictionLevel NVARCHAR(30) NULL, -- Federal | State | District/County | City (Compliance)
    JurisdictionDetail NVARCHAR(120) NULL, -- e.g., TX, Hillsborough County, Tampa
    VendorOrPolicyName NVARCHAR(200) NULL,
    DueDate DATE NOT NULL,
    RecurrenceType NVARCHAR(20) NOT NULL DEFAULT 'none', -- none | weekly | monthly | quarterly | annual
    RecurrenceInterval INT NULL, -- e.g., every 1 month
    LeadTimeDays INT NULL,
    Status NVARCHAR(20) NOT NULL DEFAULT 'Open', -- Open | Completed | Canceled
    CompletedDate DATE NULL,
    AssignedToUserID UNIQUEIDENTIFIER NULL,
    Notes NVARCHAR(MAX) NULL,
    IsClientVisible BIT NOT NULL DEFAULT 0, -- internal only until shared
    CreatedByUserID UNIQUEIDENTIFIER NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NULL
  );

  CREATE INDEX IX_GovCalEvent_DueDate ON dbo.GovernanceCalendarEvent (DueDate);
  CREATE INDEX IX_GovCalEvent_Client ON dbo.GovernanceCalendarEvent (ClientID);
  CREATE INDEX IX_GovCalEvent_Status ON dbo.GovernanceCalendarEvent (Status);
END;

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='GovernanceCalendarEventAttachment' AND xtype='U')
BEGIN
  CREATE TABLE dbo.GovernanceCalendarEventAttachment (
    AttachmentID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
    EventID UNIQUEIDENTIFIER NOT NULL,
    FileName NVARCHAR(260) NOT NULL,
    FilePath NVARCHAR(400) NOT NULL,
    MimeType NVARCHAR(120) NULL,
    FileSizeBytes BIGINT NULL,
    UploadedByUserID UNIQUEIDENTIFIER NULL,
    UploadedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_GovCalAttachment_Event FOREIGN KEY (EventID) REFERENCES dbo.GovernanceCalendarEvent(EventID) ON DELETE CASCADE
  );

  CREATE INDEX IX_GovCalAttachment_Event ON dbo.GovernanceCalendarEventAttachment (EventID);
END;

-- Covenants
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ClientCovenant' AND xtype='U')
BEGIN
  CREATE TABLE dbo.ClientCovenant (
    CovenantID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
    ClientID UNIQUEIDENTIFIER NOT NULL,
    CovenantName NVARCHAR(200) NOT NULL,
    MetricKey NVARCHAR(50) NOT NULL, -- DSCR | DebtEBITDA | Leverage | Liquidity | MinCash | Other
    ThresholdType NVARCHAR(10) NOT NULL, -- MIN | MAX
    ThresholdValue DECIMAL(18,6) NOT NULL,
    WarnValue DECIMAL(18,6) NULL,
    CriticalValue DECIMAL(18,6) NULL,
    MeasurementFrequency NVARCHAR(20) NOT NULL DEFAULT 'Weekly',
    TestDayOfWeek INT NULL, -- 0=Sun ... 6=Sat (optional)
    IsActive BIT NOT NULL DEFAULT 1,
    EffectiveStartDate DATE NULL,
    EffectiveEndDate DATE NULL,
    Notes NVARCHAR(MAX) NULL,
    IsClientVisible BIT NOT NULL DEFAULT 0,
    CreatedByUserID UNIQUEIDENTIFIER NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NULL
  );

  CREATE INDEX IX_ClientCovenant_Client ON dbo.ClientCovenant (ClientID);
  CREATE INDEX IX_ClientCovenant_Active ON dbo.ClientCovenant (IsActive);
END;

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ClientCovenantSnapshot' AND xtype='U')
BEGIN
  CREATE TABLE dbo.ClientCovenantSnapshot (
    SnapshotID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
    CovenantID UNIQUEIDENTIFIER NOT NULL,
    SnapshotDate DATE NOT NULL,
    ActualValue DECIMAL(18,6) NOT NULL,
    Status NVARCHAR(12) NOT NULL, -- OK | WARN | CRITICAL
    Source NVARCHAR(50) NULL, -- Manual | Computed
    Notes NVARCHAR(MAX) NULL,
    CreatedByUserID UNIQUEIDENTIFIER NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_CovenantSnapshot_Covenant FOREIGN KEY (CovenantID) REFERENCES dbo.ClientCovenant(CovenantID) ON DELETE CASCADE
  );

  CREATE INDEX IX_CovenantSnapshot_CovenantDate ON dbo.ClientCovenantSnapshot (CovenantID, SnapshotDate DESC);
END;

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ClientCovenantAttachment' AND xtype='U')
BEGIN
  CREATE TABLE dbo.ClientCovenantAttachment (
    AttachmentID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
    CovenantID UNIQUEIDENTIFIER NOT NULL,
    FileName NVARCHAR(260) NOT NULL,
    FilePath NVARCHAR(400) NOT NULL,
    MimeType NVARCHAR(120) NULL,
    FileSizeBytes BIGINT NULL,
    UploadedByUserID UNIQUEIDENTIFIER NULL,
    UploadedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_CovenantAttachment_Covenant FOREIGN KEY (CovenantID) REFERENCES dbo.ClientCovenant(CovenantID) ON DELETE CASCADE
  );

  CREATE INDEX IX_CovenantAttachment_Covenant ON dbo.ClientCovenantAttachment (CovenantID);
END;

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ClientCovenantAlert' AND xtype='U')
BEGIN
  CREATE TABLE dbo.ClientCovenantAlert (
    AlertID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
    CovenantID UNIQUEIDENTIFIER NOT NULL,
    SnapshotID UNIQUEIDENTIFIER NULL,
    AlertLevel NVARCHAR(12) NOT NULL, -- WARN | CRITICAL
    Message NVARCHAR(500) NOT NULL,
    IsAcknowledged BIT NOT NULL DEFAULT 0,
    AcknowledgedByUserID UNIQUEIDENTIFIER NULL,
    AcknowledgedAt DATETIME2 NULL,
    AcknowledgementNotes NVARCHAR(MAX) NULL,
    SnoozeUntil DATE NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_CovenantAlert_Covenant FOREIGN KEY (CovenantID) REFERENCES dbo.ClientCovenant(CovenantID) ON DELETE CASCADE,
    CONSTRAINT FK_CovenantAlert_Snapshot FOREIGN KEY (SnapshotID) REFERENCES dbo.ClientCovenantSnapshot(SnapshotID)
  );

  CREATE INDEX IX_CovenantAlert_Covenant ON dbo.ClientCovenantAlert (CovenantID);
  CREATE INDEX IX_CovenantAlert_Ack ON dbo.ClientCovenantAlert (IsAcknowledged, SnoozeUntil);
END;

