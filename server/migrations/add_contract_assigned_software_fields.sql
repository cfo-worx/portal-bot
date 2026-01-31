-- Migration: Add AssignedSoftware and AssignedSoftwareRate fields to Contract table

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'Contract') AND name = 'AssignedSoftware')
BEGIN
    ALTER TABLE Contract ADD AssignedSoftware NVARCHAR(255) NULL;
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'Contract') AND name = 'AssignedSoftwareRate')
BEGIN
    ALTER TABLE Contract ADD AssignedSoftwareRate DECIMAL(18,2) NULL;
END

