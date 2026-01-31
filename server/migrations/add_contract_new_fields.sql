-- Migration: Add new fields to Contract table for updated contract form
-- This migration adds fields for contract types, revenue fields, staff rates, and additional staff
-- Note: GO statements removed for Node.js mssql compatibility

-- Add ContractType field
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'Contract') AND name = 'ContractType')
BEGIN
    ALTER TABLE Contract ADD ContractType NVARCHAR(50) NULL;
END

-- Add revenue fields based on contract type
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'Contract') AND name = 'TotalProjectFee')
BEGIN
    ALTER TABLE Contract ADD TotalProjectFee DECIMAL(18,2) NULL;
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'Contract') AND name = 'PercentageOfCompanySale')
BEGIN
    ALTER TABLE Contract ADD PercentageOfCompanySale DECIMAL(18,2) NULL;
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'Contract') AND name = 'HourlyRateLow')
BEGIN
    ALTER TABLE Contract ADD HourlyRateLow DECIMAL(18,2) NULL;
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'Contract') AND name = 'HourlyRateHigh')
BEGIN
    ALTER TABLE Contract ADD HourlyRateHigh DECIMAL(18,2) NULL;
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'Contract') AND name = 'MonthlyFee')
BEGIN
    ALTER TABLE Contract ADD MonthlyFee DECIMAL(18,2) NULL;
END

-- Add staff rate fields
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'Contract') AND name = 'AssignedCFORate')
BEGIN
    ALTER TABLE Contract ADD AssignedCFORate DECIMAL(18,2) NULL;
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'Contract') AND name = 'AssignedControllerRate')
BEGIN
    ALTER TABLE Contract ADD AssignedControllerRate DECIMAL(18,2) NULL;
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'Contract') AND name = 'AssignedSeniorAccountantRate')
BEGIN
    ALTER TABLE Contract ADD AssignedSeniorAccountantRate DECIMAL(18,2) NULL;
END

-- Add AdditionalStaff field for JSON storage
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'Contract') AND name = 'AdditionalStaff')
BEGIN
    ALTER TABLE Contract ADD AdditionalStaff NVARCHAR(MAX) NULL;
END

