\
/*
  CFO Worx ROI Tracker - Smoke Test (v2)
  - Validates tables exist
  - Inserts a Draft ROI Win + consultant split + activity tag
  - Submits + approves the win
  - Rolls back transaction so no data is persisted

  Prereqs:
  - ROI Tracker migration applied (server/migrations/create_roi_tracker_tables.sql)
  - At least 1 row exists in dbo.Client, dbo.Consultant, dbo.Users
*/

SET NOCOUNT ON;

BEGIN TRY
  BEGIN TRAN;

  -- 1) Table existence checks
  IF OBJECT_ID('dbo.ROIWin', 'U') IS NULL THROW 50000, 'Missing table dbo.ROIWin', 1;
  IF OBJECT_ID('dbo.ROIWinConsultant', 'U') IS NULL THROW 50000, 'Missing table dbo.ROIWinConsultant', 1;
  IF OBJECT_ID('dbo.ROIWinActivityTag', 'U') IS NULL THROW 50000, 'Missing table dbo.ROIWinActivityTag', 1;
  IF OBJECT_ID('dbo.ROIImpactCategory', 'U') IS NULL THROW 50000, 'Missing table dbo.ROIImpactCategory', 1;
  IF OBJECT_ID('dbo.ROIActivityTag', 'U') IS NULL THROW 50000, 'Missing table dbo.ROIActivityTag', 1;
  IF OBJECT_ID('dbo.ROIRejectionReason', 'U') IS NULL THROW 50000, 'Missing table dbo.ROIRejectionReason', 1;

  PRINT '✅ ROI tables exist';

  -- 2) Grab sample foreign keys
  DECLARE @ClientID UNIQUEIDENTIFIER = (SELECT TOP 1 ClientID FROM dbo.Client ORDER BY ClientName);
  IF @ClientID IS NULL THROW 50001, 'No clients found in dbo.Client', 1;

  DECLARE @ConsultantID UNIQUEIDENTIFIER = (SELECT TOP 1 ConsultantID FROM dbo.Consultant ORDER BY ConsultantName);
  IF @ConsultantID IS NULL THROW 50002, 'No consultants found in dbo.Consultant', 1;

  DECLARE @UserID UNIQUEIDENTIFIER = (SELECT TOP 1 UserID FROM dbo.Users ORDER BY Email);
  IF @UserID IS NULL THROW 50003, 'No users found in dbo.Users', 1;

  DECLARE @CategoryID INT = (SELECT TOP 1 CategoryID FROM dbo.ROIImpactCategory ORDER BY CategoryID);
  IF @CategoryID IS NULL THROW 50004, 'No categories found in dbo.ROIImpactCategory', 1;

  DECLARE @TagID INT = (SELECT TOP 1 TagID FROM dbo.ROIActivityTag ORDER BY TagID);

  -- 3) Insert a Draft ROI Win
  DECLARE @ROIWinID UNIQUEIDENTIFIER = NEWID();

  INSERT INTO dbo.ROIWin (
    ROIWinID,
    ClientID,
    Title,
    CategoryID,
    ImpactType,
    ImpactDate,
    RecurringMonthlyAmount,
    RecurringStartDate,
    RecurringEndDate,
    OneTimeTotalValue,
    OneTimeSpreadMonths,
    ClientOwnerUserID,
    ExternalNotes,
    InternalNotes,
    Status,
    CreatedAt,
    CreatedByUserID,
    LastEditedAt,
    LastEditedByUserID,
    IsDeleted
  )
  VALUES (
    @ROIWinID,
    @ClientID,
    'Smoke Test Win - Recurring',
    @CategoryID,
    'Recurring',
    CAST(SYSUTCDATETIME() AS DATE),
    1234.56,
    CAST(SYSUTCDATETIME() AS DATE),
    NULL,
    NULL,
    NULL,
    @UserID,
    'External notes (smoke test)',
    'Internal notes (smoke test)',
    'Draft',
    SYSUTCDATETIME(),
    @UserID,
    SYSUTCDATETIME(),
    @UserID,
    0
  );

  -- 4) Insert Consultant split (100%)
  INSERT INTO dbo.ROIWinConsultant (
    ROIWinConsultantID,
    ROIWinID,
    ConsultantID,
    PercentSplit,
    IsPrimary
  )
  VALUES (
    NEWID(),
    @ROIWinID,
    @ConsultantID,
    100.0,
    1
  );

  -- 5) Insert one activity tag (optional)
  IF @TagID IS NOT NULL
  BEGIN
    INSERT INTO dbo.ROIWinActivityTag (
      ROIWinActivityTagID,
      ROIWinID,
      TagID
    )
    VALUES (
      NEWID(),
      @ROIWinID,
      @TagID
    );
  END

  PRINT '✅ Inserted ROI win + consultant split (+ optional tag)';

  -- 6) Submit + approve workflow
  UPDATE dbo.ROIWin
  SET
    Status = 'Submitted',
    SubmittedAt = SYSUTCDATETIME(),
    SubmittedByUserID = @UserID
  WHERE ROIWinID = @ROIWinID;

  UPDATE dbo.ROIWin
  SET
    Status = 'Approved',
    ApprovedAt = SYSUTCDATETIME(),
    ApprovedByUserID = @UserID
  WHERE ROIWinID = @ROIWinID;

  -- 7) Verify row exists + status values
  SELECT
    ROIWinID, Title, Status,
    SubmittedAt, ApprovedAt,
    CreatedByUserID, ClientOwnerUserID
  FROM dbo.ROIWin
  WHERE ROIWinID = @ROIWinID;

  SELECT *
  FROM dbo.ROIWinConsultant
  WHERE ROIWinID = @ROIWinID;

  SELECT *
  FROM dbo.ROIWinActivityTag
  WHERE ROIWinID = @ROIWinID;

  PRINT '✅ ROI Tracker smoke test PASSED (rolling back)';
  ROLLBACK;

END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK;

  DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
  DECLARE @ErrLine INT = ERROR_LINE();
  DECLARE @ErrNum INT = ERROR_NUMBER();
  DECLARE @ErrState INT = ERROR_STATE();

  PRINT '❌ ROI Tracker smoke test FAILED';
  PRINT CONCAT('Error ', @ErrNum, ' (state ', @ErrState, ') at line ', @ErrLine, ': ', @ErrMsg);
  THROW;
END CATCH;
