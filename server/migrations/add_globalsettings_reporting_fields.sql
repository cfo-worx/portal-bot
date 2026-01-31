/*
  Adds columns required for performance reporting settings.
  Safe to run multiple times.
  Note: GO statements removed for Node.js mssql compatibility
*/

IF COL_LENGTH('GlobalSettings', 'AttentionRiskDays') IS NULL
BEGIN
  ALTER TABLE GlobalSettings ADD AttentionRiskDays INT NULL;
END

IF COL_LENGTH('GlobalSettings', 'DefaultDistributionType') IS NULL
BEGIN
  ALTER TABLE GlobalSettings ADD DefaultDistributionType NVARCHAR(50) NULL;
END

-- Optional: set defaults on existing row if NULL (only if columns exist)
-- Using dynamic SQL to avoid parse-time column validation errors
IF COL_LENGTH('GlobalSettings', 'AttentionRiskDays') IS NOT NULL
BEGIN
  EXEC('UPDATE GlobalSettings SET AttentionRiskDays = ISNULL(AttentionRiskDays, 7) WHERE AttentionRiskDays IS NULL');
END

IF COL_LENGTH('GlobalSettings', 'DefaultDistributionType') IS NOT NULL
BEGIN
  EXEC('UPDATE GlobalSettings SET DefaultDistributionType = ISNULL(DefaultDistributionType, ''linear'') WHERE DefaultDistributionType IS NULL');
END
