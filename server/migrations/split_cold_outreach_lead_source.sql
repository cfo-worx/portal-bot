-- Split "Cold Outreach" lead source into three separate sources:
-- - Cold Calling
-- - Cold Email
-- - LinkedIn DMs

-- Step 1: Update existing deals that reference "Cold Outreach" to NULL
-- (Users will need to manually reassign these to the appropriate new source)
UPDATE CRMDeal
SET LeadSourceID = NULL
WHERE LeadSourceID IN (
    SELECT LeadSourceID 
    FROM CRMLeadSource 
    WHERE SourceName = 'Cold Outreach'
);

-- Step 2: Delete the "Cold Outreach" lead source
DELETE FROM CRMLeadSource
WHERE SourceName = 'Cold Outreach';

-- Step 3: Add the three new lead sources
-- Check if they already exist before inserting to avoid duplicates
IF NOT EXISTS (SELECT * FROM CRMLeadSource WHERE SourceName = 'Cold Calling')
BEGIN
    INSERT INTO CRMLeadSource (SourceName) VALUES ('Cold Calling');
END;

IF NOT EXISTS (SELECT * FROM CRMLeadSource WHERE SourceName = 'Cold Email')
BEGIN
    INSERT INTO CRMLeadSource (SourceName) VALUES ('Cold Email');
END;

IF NOT EXISTS (SELECT * FROM CRMLeadSource WHERE SourceName = 'LinkedIn DMs')
BEGIN
    INSERT INTO CRMLeadSource (SourceName) VALUES ('LinkedIn DMs');
END;

