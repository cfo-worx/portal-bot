import Lead from '../models/Lead.js';
import LeadImportBatch from '../models/LeadImportBatch.js';
import { poolPromise, sql } from '../db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse as parseCsv } from 'csv-parse/sync';
import * as XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsDir = path.join(__dirname, '../../uploads/leads');

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Helper: Extract domain from email
function extractDomain(email) {
  if (!email || typeof email !== 'string') return null;
  const parts = email.split('@');
  return parts.length > 1 ? parts[1].toLowerCase().trim() : null;
}

// Helper: Normalize field names (handle various column name variations)
function normalizeFieldName(name) {
  if (!name) return null;
  const normalized = String(name).trim().toLowerCase();
  
  const fieldMap = {
    'email': 'Email',
    'e-mail': 'Email',
    'email address': 'Email',
    'company': 'CompanyName',
    'company name': 'CompanyName',
    'companyname': 'CompanyName',
    'organization': 'CompanyName',
    'org': 'CompanyName',
    'first name': 'FirstName',
    'firstname': 'FirstName',
    'fname': 'FirstName',
    'last name': 'LastName',
    'lastname': 'LastName',
    'lname': 'LastName',
    'full name': 'FullName',
    'fullname': 'FullName',
    'name': 'FullName',
    'title': 'Title',
    'job title': 'Title',
    'position': 'Title',
    'phone': 'Phone',
    'phone number': 'Phone',
    'telephone': 'Phone',
    'industry': 'Industry',
    'revenue': 'Revenue',
    'annual revenue': 'Revenue',
    'employees': 'EmployeeCount',
    'employee count': 'EmployeeCount',
    'headcount': 'EmployeeCount',
    'city': 'City',
    'state': 'State',
    'province': 'State',
    'country': 'Country',
    'website': 'Website',
    'web': 'Website',
    'url': 'Website',
    'linkedin': 'LinkedInURL',
    'linkedin url': 'LinkedInURL',
    'linkedinurl': 'LinkedInURL',
    'accounting system': 'AccountingSystem',
    'accounting': 'AccountingSystem',
    'erp': 'AccountingSystem',
    'notes': 'Notes',
    'note': 'Notes',
    'tags': 'Tags',
    'tag': 'Tags',
    'source': 'Source',
    'lead source': 'Source',
  };
  
  return fieldMap[normalized] || null;
}

// Helper: Parse value based on field type
function parseValue(fieldName, value) {
  if (value === null || value === undefined || value === '') return null;
  
  const strValue = String(value).trim();
  if (!strValue) return null;
  
  if (fieldName === 'Revenue') {
    // Remove currency symbols and commas
    const cleaned = strValue.replace(/[$,]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }
  
  if (fieldName === 'EmployeeCount') {
    const num = parseInt(strValue);
    return isNaN(num) ? null : num;
  }
  
  if (fieldName === 'Email') {
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(strValue) ? strValue.toLowerCase() : null;
  }
  
  return strValue;
}

// Parse CSV file
function parseCsvFile(filePath) {
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const records = parseCsv(fileContent, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  });
  return records;
}

// Parse Excel file
function parseExcelFile(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const records = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
  return records;
}

// ========== GET LEADS ==========
export const getLeads = async (req, res) => {
  try {
    const filters = {
      isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : true,
      isDuplicate: req.query.isDuplicate !== undefined ? req.query.isDuplicate === 'true' : undefined,
      search: req.query.search || null,
      domain: req.query.domain || null,
      email: req.query.email || null,
      industry: req.query.industry || null,
    };
    
    const leads = await Lead.getAll(filters);
    res.json(leads);
  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
};

// ========== GET LEAD BY ID ==========
export const getLeadById = async (req, res) => {
  try {
    const lead = await Lead.getById(req.params.id);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    res.json(lead);
  } catch (error) {
    console.error('Error fetching lead:', error);
    res.status(500).json({ error: 'Failed to fetch lead' });
  }
};

// ========== UPDATE LEAD ==========
export const updateLead = async (req, res) => {
  try {
    const leadData = {
      ...req.body,
      UpdatedBy: req.user?.userId || req.user?.user_id || null,
    };
    
    const updatedLead = await Lead.update(req.params.id, leadData);
    res.json(updatedLead);
  } catch (error) {
    console.error('Error updating lead:', error);
    res.status(500).json({ error: 'Failed to update lead' });
  }
};

// ========== DELETE LEAD ==========
export const deleteLead = async (req, res) => {
  try {
    await Lead.delete(req.params.id);
    res.json({ message: 'Lead deleted successfully' });
  } catch (error) {
    console.error('Error deleting lead:', error);
    res.status(500).json({ error: 'Failed to delete lead' });
  }
};

// ========== IMPORT LEADS ==========
export const importLeads = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'File is required' });
    }

    const filePath = req.file.path;
    const fileName = req.file.originalname;
    const fileExt = path.extname(fileName).toLowerCase();
    
    // Create import batch
    const batch = await LeadImportBatch.create({
      FileName: fileName,
      FilePath: filePath,
      Status: 'Processing',
      CreatedBy: req.user?.userId || req.user?.user_id || null,
    });

    const errors = [];
    let importedCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;

    try {
      // Parse file based on extension
      let records = [];
      if (fileExt === '.csv') {
        records = parseCsvFile(filePath);
      } else if (fileExt === '.xlsx' || fileExt === '.xls') {
        records = parseExcelFile(filePath);
      } else {
        throw new Error('Unsupported file format');
      }

      if (!Array.isArray(records) || records.length === 0) {
        throw new Error('File appears empty or invalid');
      }

      // Map column headers
      const headers = Object.keys(records[0] || {});
      const fieldMapping = {};
      headers.forEach(header => {
        const mappedField = normalizeFieldName(header);
        if (mappedField) {
          fieldMapping[header] = mappedField;
        }
      });

      // Process each row
      for (let i = 0; i < records.length; i++) {
        const row = records[i];
        const rowNumber = i + 2; // +2 because row 1 is header, and arrays are 0-indexed
        
        try {
          // Extract and validate required fields
          const email = parseValue('Email', row[headers.find(h => normalizeFieldName(h) === 'Email')] || 
                                         row['email'] || row['Email'] || row['E-mail'] || '');
          const domain = email ? extractDomain(email) : null;
          
          // Skip if no email
          if (!email) {
            errors.push({
              rowNumber,
              rowData: JSON.stringify(row),
              errorMessage: 'Email is required',
              errorType: 'Validation',
            });
            errorCount++;
            continue;
          }

          // Check for duplicates
          const duplicates = await Lead.findDuplicates(email, domain);
          if (duplicates.length > 0) {
            // Mark as duplicate
            const duplicateLead = await Lead.create({
              Email: email,
              Domain: domain,
              CompanyName: parseValue('CompanyName', row[headers.find(h => normalizeFieldName(h) === 'CompanyName')] || row['company'] || ''),
              Industry: parseValue('Industry', row[headers.find(h => normalizeFieldName(h) === 'Industry')] || ''),
              Revenue: parseValue('Revenue', row[headers.find(h => normalizeFieldName(h) === 'Revenue')] || ''),
              EmployeeCount: parseValue('EmployeeCount', row[headers.find(h => normalizeFieldName(h) === 'EmployeeCount')] || ''),
              FirstName: parseValue('FirstName', row[headers.find(h => normalizeFieldName(h) === 'FirstName')] || ''),
              LastName: parseValue('LastName', row[headers.find(h => normalizeFieldName(h) === 'LastName')] || ''),
              FullName: parseValue('FullName', row[headers.find(h => normalizeFieldName(h) === 'FullName')] || ''),
              Title: parseValue('Title', row[headers.find(h => normalizeFieldName(h) === 'Title')] || ''),
              Phone: parseValue('Phone', row[headers.find(h => normalizeFieldName(h) === 'Phone')] || ''),
              City: parseValue('City', row[headers.find(h => normalizeFieldName(h) === 'City')] || ''),
              State: parseValue('State', row[headers.find(h => normalizeFieldName(h) === 'State')] || ''),
              Country: parseValue('Country', row[headers.find(h => normalizeFieldName(h) === 'Country')] || ''),
              Website: parseValue('Website', row[headers.find(h => normalizeFieldName(h) === 'Website')] || ''),
              LinkedInURL: parseValue('LinkedInURL', row[headers.find(h => normalizeFieldName(h) === 'LinkedInURL')] || ''),
              AccountingSystem: parseValue('AccountingSystem', row[headers.find(h => normalizeFieldName(h) === 'AccountingSystem')] || ''),
              Notes: parseValue('Notes', row[headers.find(h => normalizeFieldName(h) === 'Notes')] || ''),
              Tags: parseValue('Tags', row[headers.find(h => normalizeFieldName(h) === 'Tags')] || ''),
              Source: parseValue('Source', row[headers.find(h => normalizeFieldName(h) === 'Source')] || ''),
              IsDuplicate: true,
              DuplicateOfLeadID: duplicates[0].LeadID,
              ImportBatchID: batch.BatchID,
              CreatedBy: req.user?.userId || req.user?.user_id || null,
            });
            duplicateCount++;
            continue;
          }

          // Create lead
          const leadData = {
            Email: email,
            Domain: domain,
            ImportBatchID: batch.BatchID,
            CreatedBy: req.user?.userId || req.user?.user_id || null,
          };

          // Map all available fields
          headers.forEach(header => {
            const mappedField = fieldMapping[header];
            if (mappedField && mappedField !== 'Email') {
              leadData[mappedField] = parseValue(mappedField, row[header]);
            }
          });

          await Lead.create(leadData);
          importedCount++;

        } catch (rowError) {
          errors.push({
            rowNumber,
            rowData: JSON.stringify(row),
            errorMessage: rowError.message || 'Failed to process row',
            errorType: 'System',
          });
          errorCount++;
        }
      }

      // Save errors to database
      if (errors.length > 0) {
        const pool = await poolPromise;
        for (const error of errors) {
          await pool.request()
            .input('BatchID', sql.UniqueIdentifier, batch.BatchID)
            .input('RowNumber', sql.Int, error.rowNumber)
            .input('RowData', sql.NVarChar(sql.MAX), error.rowData)
            .input('ErrorMessage', sql.NVarChar(sql.MAX), error.errorMessage)
            .input('ErrorType', sql.NVarChar, error.errorType)
            .query(`
              INSERT INTO LeadImportError (BatchID, RowNumber, RowData, ErrorMessage, ErrorType)
              VALUES (@BatchID, @RowNumber, @RowData, @ErrorMessage, @ErrorType)
            `);
        }
      }

      // Update batch status
      await LeadImportBatch.update(batch.BatchID, {
        TotalRows: records.length,
        ImportedRows: importedCount,
        ErrorRows: errorCount,
        DuplicateRows: duplicateCount,
        Status: 'Completed',
        CompletedOn: new Date(),
        ErrorSummary: errors.length > 0 ? JSON.stringify(errors.slice(0, 100)) : null, // Limit to first 100 errors
      });

      res.json({
        batchId: batch.BatchID,
        totalRows: records.length,
        importedRows: importedCount,
        duplicateRows: duplicateCount,
        errorRows: errorCount,
        errors: errors.slice(0, 100), // Return first 100 errors
      });

    } catch (parseError) {
      // Update batch status to Failed
      await LeadImportBatch.update(batch.BatchID, {
        Status: 'Failed',
        ErrorSummary: parseError.message,
      });
      
      throw parseError;
    }
  } catch (error) {
    console.error('Error importing leads:', error);
    res.status(500).json({ error: error.message || 'Failed to import leads' });
  }
};

// ========== GET IMPORT BATCHES ==========
export const getImportBatches = async (req, res) => {
  try {
    const batches = await LeadImportBatch.getAll();
    res.json(batches);
  } catch (error) {
    console.error('Error fetching import batches:', error);
    res.status(500).json({ error: 'Failed to fetch import batches' });
  }
};

// ========== GET IMPORT BATCH ERRORS ==========
export const getImportBatchErrors = async (req, res) => {
  try {
    const errors = await LeadImportBatch.getErrors(req.params.batchId);
    res.json(errors);
  } catch (error) {
    console.error('Error fetching import errors:', error);
    res.status(500).json({ error: 'Failed to fetch import errors' });
  }
};

// ========== GET DUPLICATE GROUPS ==========
export const getDuplicateGroups = async (req, res) => {
  try {
    const duplicates = await Lead.getDuplicateGroups();
    res.json(duplicates);
  } catch (error) {
    console.error('Error fetching duplicate groups:', error);
    res.status(500).json({ error: 'Failed to fetch duplicate groups' });
  }
};

