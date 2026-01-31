-- Migration: Add Timezone field to Contact table

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'Contact') AND name = 'Timezone')
BEGIN
    ALTER TABLE Contact ADD Timezone NVARCHAR(100) NULL;
END

