-- CRM Deal Attachment Table
-- Stores file attachments for CRM deals (PDFs, Excel, CSV)

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CRMDealAttachment')
BEGIN
    CREATE TABLE CRMDealAttachment (
        AttachmentID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        DealID UNIQUEIDENTIFIER NOT NULL,
        FilePath NVARCHAR(500) NOT NULL,
        FileName NVARCHAR(255) NOT NULL,
        FileSize BIGINT NULL,
        FileType NVARCHAR(50) NULL, -- 'pdf', 'excel', 'csv'
        MimeType NVARCHAR(100) NULL,
        CreatedBy UNIQUEIDENTIFIER NULL, -- FK to Users
        CreatedOn DATETIME2 DEFAULT GETDATE(),
        CONSTRAINT FK_CRMDealAttachment_Deal FOREIGN KEY (DealID) REFERENCES CRMDeal(DealID) ON DELETE CASCADE,
        CONSTRAINT FK_CRMDealAttachment_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES Users(UserID)
    );
    
    CREATE INDEX IX_CRMDealAttachment_Deal ON CRMDealAttachment(DealID);
    CREATE INDEX IX_CRMDealAttachment_CreatedOn ON CRMDealAttachment(CreatedOn DESC);
END;

