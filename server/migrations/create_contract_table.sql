-- Create Contract table
CREATE TABLE Contract (
    ContractID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    ClientID UNIQUEIDENTIFIER NOT NULL,
    ContractLength INT NULL,
    MonthlyRevenue DECIMAL(18,2) NULL,
    OnboardingFee DECIMAL(18,2) NULL,
    AssignedCFO NVARCHAR(255) NULL,
    AssignedController NVARCHAR(255) NULL,
    AssignedSeniorAccountant NVARCHAR(255) NULL,
    ContractStartDate DATE NULL,
    ContractEndDate DATE NULL,
    ContractEndReason NVARCHAR(255) NULL,
    PricingType NVARCHAR(50) NULL,
    TotalFee DECIMAL(18,2) NULL,
    LowerFee DECIMAL(18,2) NULL,
    HigherFee DECIMAL(18,2) NULL,
    CreatedOn DATETIME2 DEFAULT GETDATE(),
    UpdatedOn DATETIME2 DEFAULT GETDATE(),
    
    -- Foreign key constraint
    CONSTRAINT FK_Contract_Client FOREIGN KEY (ClientID) REFERENCES Client(ClientID) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IX_Contract_ClientID ON Contract(ClientID);
CREATE INDEX IX_Contract_StartDate ON Contract(ContractStartDate);
CREATE INDEX IX_Contract_EndDate ON Contract(ContractEndDate);

-- Note: Trigger creation moved to separate file due to SQL Server batch requirements