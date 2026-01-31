-- Add ContactPhone, ContractTerm, and OnboardingFee fields to CRMDeal table
-- TCV (Amount) will be auto-calculated as MRR × ContractTerm + OnboardingFee

IF EXISTS (SELECT * FROM sys.tables WHERE name = 'CRMDeal')
BEGIN
    -- Add ContactPhone field
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('CRMDeal') AND name = 'ContactPhone')
    BEGIN
        ALTER TABLE CRMDeal ADD ContactPhone NVARCHAR(50) NULL;
    END

    -- Add ContractTerm field (in months)
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('CRMDeal') AND name = 'ContractTerm')
    BEGIN
        ALTER TABLE CRMDeal ADD ContractTerm INT NULL;
    END

    -- Add OnboardingFee field (one-time fee)
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('CRMDeal') AND name = 'OnboardingFee')
    BEGIN
        ALTER TABLE CRMDeal ADD OnboardingFee DECIMAL(18,2) NULL;
    END
END;

