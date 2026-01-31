-- Add software cost/COGS fields to Contract table for tracking software expenses
-- Safe to run multiple times (idempotent) on SQL Server

IF COL_LENGTH('Contract', 'AssignedSoftwareCost') IS NULL
BEGIN
  ALTER TABLE Contract ADD AssignedSoftwareCost DECIMAL(18,2) NULL;
END

IF COL_LENGTH('Contract', 'AssignedSoftwareProvidedFree') IS NULL
BEGIN
  ALTER TABLE Contract ADD AssignedSoftwareProvidedFree BIT NULL DEFAULT 0;
END

