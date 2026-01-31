-- Create trigger to update UpdatedOn timestamp
-- This must be run after create_contract_table.sql

CREATE TRIGGER TR_Contract_UpdatedOn
ON Contract
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE Contract 
    SET UpdatedOn = GETDATE()
    WHERE ContractID IN (SELECT ContractID FROM inserted);
END;
