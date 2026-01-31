-- Migration: Add AssignedSoftwareQuantity field to Contract table

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'Contract') AND name = 'AssignedSoftwareQuantity')
BEGIN
    ALTER TABLE Contract ADD AssignedSoftwareQuantity INT NULL;
END

