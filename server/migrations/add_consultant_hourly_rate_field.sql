-- Migration: Add HourlyRate field to Consultant table
-- This field is used when PayType is 'Salary' to store the hourly rate

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'Consultant') AND name = 'HourlyRate')
BEGIN
    ALTER TABLE Consultant ADD HourlyRate DECIMAL(18,2) NULL;
END

