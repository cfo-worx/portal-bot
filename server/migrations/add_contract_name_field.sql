-- Migration: Add ContractName field to Contract table
-- This migration adds a ContractName field to allow users to give contracts descriptive names
-- Note: GO statements removed for Node.js mssql compatibility

-- Add ContractName field
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'Contract') AND name = 'ContractName')
BEGIN
    ALTER TABLE Contract ADD ContractName NVARCHAR(255) NULL;
END

