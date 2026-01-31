-- Add GM variance threshold setting for trailing 3-month GM expectation recommendations
-- Safe to run multiple times (idempotent) on SQL Server

IF COL_LENGTH('GlobalSettings', 'GMVarianceThresholdPct') IS NULL
BEGIN
  ALTER TABLE GlobalSettings ADD GMVarianceThresholdPct DECIMAL(6,4) NULL;
END

-- Set default value if NULL
IF COL_LENGTH('GlobalSettings', 'GMVarianceThresholdPct') IS NOT NULL
BEGIN
  EXEC('UPDATE GlobalSettings SET GMVarianceThresholdPct = ISNULL(GMVarianceThresholdPct, 0.0500) WHERE GMVarianceThresholdPct IS NULL');
END

