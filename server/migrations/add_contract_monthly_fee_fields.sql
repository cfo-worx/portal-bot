-- Migration: Add MonthlyFeeLow and MonthlyFeeHigh fields to Contract table
-- This migration adds fields for Hourly contracts to specify monthly fee range
-- Note: GO statements removed for Node.js mssql compatibility

-- Add MonthlyFeeLow field
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'Contract') AND name = 'MonthlyFeeLow')
BEGIN
    ALTER TABLE Contract ADD MonthlyFeeLow DECIMAL(18,2) NULL;
END

-- Add MonthlyFeeHigh field
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'Contract') AND name = 'MonthlyFeeHigh')
BEGIN
    ALTER TABLE Contract ADD MonthlyFeeHigh DECIMAL(18,2) NULL;
END

