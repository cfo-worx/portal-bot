-- Migration: Create ContractPDF table for storing multiple PDFs per contract

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ContractPDF')
BEGIN
    CREATE TABLE ContractPDF (
        PDFID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        ContractID UNIQUEIDENTIFIER NOT NULL,
        FilePath NVARCHAR(500) NOT NULL,
        FileName NVARCHAR(255) NOT NULL,
        FileSize BIGINT NULL,
        CreatedOn DATETIME NOT NULL DEFAULT GETDATE(),
        FOREIGN KEY (ContractID) REFERENCES Contract(ContractID) ON DELETE CASCADE
    );
    
    -- Create index for faster lookups
    CREATE INDEX IX_ContractPDF_ContractID ON ContractPDF(ContractID);
END

