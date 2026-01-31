/*
  CFO Worx Portal — Commission Tracking (15/10/5 cash-based)

  Tables:
    - QboCustomerMapping
    - QboPayment
    - CommissionAgreement
    - CommissionSplit
    - CommissionAccrual

  Notes:
    - Idempotent
*/

-- QBO customer mapping (portal client -> QBO customer)
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[QboCustomerMapping]') AND type in (N'U'))
BEGIN
  CREATE TABLE dbo.QboCustomerMapping (
    QboCustomerMappingID UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_QboCustomerMapping PRIMARY KEY,
    ClientID UNIQUEIDENTIFIER NOT NULL,
    QboCustomerID NVARCHAR(100) NOT NULL,
    QboCustomerName NVARCHAR(255) NULL,
    ConfidenceScore DECIMAL(5,2) NULL,
    IsApproved BIT NOT NULL CONSTRAINT DF_QboCustomerMapping_IsApproved DEFAULT(0),
    ApprovedBy NVARCHAR(255) NULL,
    ApprovedOn DATETIME2 NULL,
    CreatedOn DATETIME2 NOT NULL CONSTRAINT DF_QboCustomerMapping_CreatedOn DEFAULT(SYSUTCDATETIME()),
    UpdatedOn DATETIME2 NOT NULL CONSTRAINT DF_QboCustomerMapping_UpdatedOn DEFAULT(SYSUTCDATETIME())
  );

  CREATE UNIQUE INDEX UX_QboCustomerMapping_Client ON dbo.QboCustomerMapping(ClientID);
  CREATE INDEX IX_QboCustomerMapping_QboCustomerID ON dbo.QboCustomerMapping(QboCustomerID);
END;

-- QBO payments (normalized Receive Payments -> applied to invoices)
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[QboPayment]') AND type in (N'U'))
BEGIN
  CREATE TABLE dbo.QboPayment (
    QboPaymentID UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_QboPayment PRIMARY KEY,
    QboRealmID NVARCHAR(30) NULL,
    QboPaymentTxnID NVARCHAR(100) NOT NULL,
    QboCustomerID NVARCHAR(100) NOT NULL,
    QboInvoiceTxnID NVARCHAR(100) NULL,
    PaymentDate DATE NOT NULL,
    Amount DECIMAL(18,2) NOT NULL,
    ImportedOn DATETIME2 NOT NULL CONSTRAINT DF_QboPayment_ImportedOn DEFAULT(SYSUTCDATETIME()),
    ImportedBy NVARCHAR(255) NULL,
    RawPayload NVARCHAR(MAX) NULL
  );

  CREATE UNIQUE INDEX UX_QboPayment_TxnID ON dbo.QboPayment(QboPaymentTxnID);
  CREATE INDEX IX_QboPayment_PaymentDate ON dbo.QboPayment(PaymentDate);
  CREATE INDEX IX_QboPayment_Customer ON dbo.QboPayment(QboCustomerID);
END;

-- CommissionAgreement: links a portal Contract (or CRM Deal) to commission eligibility
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[CommissionAgreement]') AND type in (N'U'))
BEGIN
  CREATE TABLE dbo.CommissionAgreement (
    CommissionAgreementID UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_CommissionAgreement PRIMARY KEY,
    ContractID UNIQUEIDENTIFIER NULL,
    DealID UNIQUEIDENTIFIER NULL,
    ClientID UNIQUEIDENTIFIER NOT NULL,
    IsEligible BIT NOT NULL CONSTRAINT DF_CommissionAgreement_IsEligible DEFAULT(1),
    IneligibleReason NVARCHAR(255) NULL,
    OverrideEligible BIT NOT NULL CONSTRAINT DF_CommissionAgreement_OverrideEligible DEFAULT(0),
    CreatedBy NVARCHAR(255) NULL,
    CreatedOn DATETIME2 NOT NULL CONSTRAINT DF_CommissionAgreement_CreatedOn DEFAULT(SYSUTCDATETIME()),
    UpdatedOn DATETIME2 NOT NULL CONSTRAINT DF_CommissionAgreement_UpdatedOn DEFAULT(SYSUTCDATETIME())
  );

  CREATE INDEX IX_CommissionAgreement_Client ON dbo.CommissionAgreement(ClientID);
  CREATE INDEX IX_CommissionAgreement_Contract ON dbo.CommissionAgreement(ContractID);
  CREATE INDEX IX_CommissionAgreement_Deal ON dbo.CommissionAgreement(DealID);
END;

-- CommissionSplit: supports split commissions (2 ways max in requirements, but supports N)
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[CommissionSplit]') AND type in (N'U'))
BEGIN
  CREATE TABLE dbo.CommissionSplit (
    CommissionSplitID UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_CommissionSplit PRIMARY KEY,
    CommissionAgreementID UNIQUEIDENTIFIER NOT NULL,
    UserID UNIQUEIDENTIFIER NOT NULL,
    SplitPercent DECIMAL(6,2) NOT NULL, -- 0-100
    CreatedOn DATETIME2 NOT NULL CONSTRAINT DF_CommissionSplit_CreatedOn DEFAULT(SYSUTCDATETIME())
  );

  ALTER TABLE dbo.CommissionSplit
    ADD CONSTRAINT FK_CommissionSplit_Agreement
      FOREIGN KEY (CommissionAgreementID) REFERENCES dbo.CommissionAgreement(CommissionAgreementID) ON DELETE CASCADE;

  CREATE INDEX IX_CommissionSplit_Agreement ON dbo.CommissionSplit(CommissionAgreementID);
  CREATE INDEX IX_CommissionSplit_User ON dbo.CommissionSplit(UserID);
END;

-- CommissionAccrual: computed from QBO payments/invoices with 15/10/5 schedule
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[CommissionAccrual]') AND type in (N'U'))
BEGIN
  CREATE TABLE dbo.CommissionAccrual (
    CommissionAccrualID UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_CommissionAccrual PRIMARY KEY,
    CommissionAgreementID UNIQUEIDENTIFIER NOT NULL,
    UserID UNIQUEIDENTIFIER NOT NULL,
    SplitPercent DECIMAL(6,2) NOT NULL,
    MonthIndex INT NOT NULL, -- 1,2,3
    CommissionRate DECIMAL(6,4) NOT NULL, -- 0.15,0.10,0.05
    BaseAmount DECIMAL(18,2) NOT NULL,
    CommissionAmount DECIMAL(18,2) NOT NULL,
    QboPaymentTxnID NVARCHAR(100) NULL,
    PaymentDate DATE NULL,
    Status NVARCHAR(30) NOT NULL CONSTRAINT DF_CommissionAccrual_Status DEFAULT('POTENTIAL'),
      -- POTENTIAL | PENDING_PAYMENT | ACCRUED | PAYABLE | PAID | STOPPED
    PayablePeriodStart DATE NULL,
    PayablePeriodEnd DATE NULL,
    PaidOn DATE NULL,
    Notes NVARCHAR(500) NULL,
    CreatedOn DATETIME2 NOT NULL CONSTRAINT DF_CommissionAccrual_CreatedOn DEFAULT(SYSUTCDATETIME())
  );

  ALTER TABLE dbo.CommissionAccrual
    ADD CONSTRAINT FK_CommissionAccrual_Agreement
      FOREIGN KEY (CommissionAgreementID) REFERENCES dbo.CommissionAgreement(CommissionAgreementID) ON DELETE CASCADE;

  CREATE INDEX IX_CommissionAccrual_Agreement ON dbo.CommissionAccrual(CommissionAgreementID);
  CREATE INDEX IX_CommissionAccrual_User ON dbo.CommissionAccrual(UserID);
  CREATE INDEX IX_CommissionAccrual_Status ON dbo.CommissionAccrual(Status);
  CREATE INDEX IX_CommissionAccrual_PaymentDate ON dbo.CommissionAccrual(PaymentDate);
END;
