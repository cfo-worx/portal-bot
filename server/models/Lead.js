import { poolPromise, sql } from '../db.js';
import { v4 as uuidv4 } from 'uuid';

class Lead {
  static async getAll(filters = {}) {
    const pool = await poolPromise;
    const request = pool.request();
    
    let query = `
      SELECT 
        l.*,
        b.FileName AS ImportFileName,
        b.CreatedOn AS ImportDate,
        u1.FirstName + ' ' + u1.LastName AS CreatedByName,
        u2.FirstName + ' ' + u2.LastName AS UpdatedByName
      FROM Lead l
      LEFT JOIN LeadImportBatch b ON l.ImportBatchID = b.BatchID
      LEFT JOIN Users u1 ON l.CreatedBy = u1.UserID
      LEFT JOIN Users u2 ON l.UpdatedBy = u2.UserID
      WHERE 1=1
    `;
    
    if (filters.isActive !== undefined) {
      query += ` AND l.IsActive = @IsActive`;
      request.input('IsActive', sql.Bit, filters.isActive);
    }
    
    if (filters.isDuplicate !== undefined) {
      query += ` AND l.IsDuplicate = @IsDuplicate`;
      request.input('IsDuplicate', sql.Bit, filters.isDuplicate);
    }
    
    if (filters.search) {
      const searchTerm = `%${filters.search}%`;
      query += ` AND (
        l.CompanyName LIKE @Search OR
        l.Email LIKE @Search OR
        l.Domain LIKE @Search OR
        l.FirstName LIKE @Search OR
        l.LastName LIKE @Search OR
        l.FullName LIKE @Search OR
        l.Industry LIKE @Search
      )`;
      request.input('Search', sql.NVarChar, searchTerm);
    }
    
    if (filters.domain) {
      query += ` AND l.Domain = @Domain`;
      request.input('Domain', sql.NVarChar, filters.domain);
    }
    
    if (filters.email) {
      query += ` AND l.Email = @Email`;
      request.input('Email', sql.NVarChar, filters.email);
    }
    
    if (filters.industry) {
      query += ` AND l.Industry = @Industry`;
      request.input('Industry', sql.NVarChar, filters.industry);
    }
    
    query += ` ORDER BY l.CreatedOn DESC`;
    
    const result = await request.query(query);
    return result.recordset;
  }

  static async getById(id) {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input('LeadID', sql.UniqueIdentifier, id)
      .query(`
        SELECT 
          l.*,
          b.FileName AS ImportFileName,
          b.CreatedOn AS ImportDate,
          u1.FirstName + ' ' + u1.LastName AS CreatedByName,
          u2.FirstName + ' ' + u2.LastName AS UpdatedByName
        FROM Lead l
        LEFT JOIN LeadImportBatch b ON l.ImportBatchID = b.BatchID
        LEFT JOIN Users u1 ON l.CreatedBy = u1.UserID
        LEFT JOIN Users u2 ON l.UpdatedBy = u2.UserID
        WHERE l.LeadID = @LeadID
      `);
    return result.recordset[0] || null;
  }

  static async create(data) {
    const pool = await poolPromise;
    const leadId = data.LeadID || uuidv4();
    
    // Extract domain from email if not provided
    let domain = data.Domain;
    if (!domain && data.Email) {
      const emailParts = data.Email.split('@');
      domain = emailParts.length > 1 ? emailParts[1].toLowerCase() : null;
    }
    
    const result = await pool
      .request()
      .input('LeadID', sql.UniqueIdentifier, leadId)
      .input('Email', sql.NVarChar, data.Email || null)
      .input('Domain', sql.NVarChar, domain || null)
      .input('CompanyName', sql.NVarChar, data.CompanyName || null)
      .input('Industry', sql.NVarChar, data.Industry || null)
      .input('Revenue', sql.Decimal(18, 2), data.Revenue || null)
      .input('EmployeeCount', sql.Int, data.EmployeeCount || null)
      .input('FirstName', sql.NVarChar, data.FirstName || null)
      .input('LastName', sql.NVarChar, data.LastName || null)
      .input('FullName', sql.NVarChar, data.FullName || null)
      .input('Title', sql.NVarChar, data.Title || null)
      .input('Phone', sql.NVarChar, data.Phone || null)
      .input('City', sql.NVarChar, data.City || null)
      .input('State', sql.NVarChar, data.State || null)
      .input('Country', sql.NVarChar, data.Country || null)
      .input('Website', sql.NVarChar, data.Website || null)
      .input('LinkedInURL', sql.NVarChar, data.LinkedInURL || null)
      .input('AccountingSystem', sql.NVarChar, data.AccountingSystem || null)
      .input('Notes', sql.NVarChar(sql.MAX), data.Notes || null)
      .input('Tags', sql.NVarChar, data.Tags || null)
      .input('LeadScore', sql.Int, data.LeadScore || 0)
      .input('LastContactDate', sql.DateTime2, data.LastContactDate || null)
      .input('Source', sql.NVarChar, data.Source || null)
      .input('IsDuplicate', sql.Bit, data.IsDuplicate || false)
      .input('DuplicateOfLeadID', sql.UniqueIdentifier, data.DuplicateOfLeadID || null)
      .input('ImportBatchID', sql.UniqueIdentifier, data.ImportBatchID || null)
      .input('IsActive', sql.Bit, data.IsActive !== undefined ? data.IsActive : true)
      .input('CreatedBy', sql.UniqueIdentifier, data.CreatedBy || null)
      .query(`
        INSERT INTO Lead (
          LeadID, Email, Domain, CompanyName, Industry, Revenue, EmployeeCount,
          FirstName, LastName, FullName, Title, Phone, City, State, Country,
          Website, LinkedInURL, AccountingSystem, Notes, Tags, LeadScore,
          LastContactDate, Source, IsDuplicate, DuplicateOfLeadID, ImportBatchID,
          IsActive, CreatedBy
        )
        VALUES (
          @LeadID, @Email, @Domain, @CompanyName, @Industry, @Revenue, @EmployeeCount,
          @FirstName, @LastName, @FullName, @Title, @Phone, @City, @State, @Country,
          @Website, @LinkedInURL, @AccountingSystem, @Notes, @Tags, @LeadScore,
          @LastContactDate, @Source, @IsDuplicate, @DuplicateOfLeadID, @ImportBatchID,
          @IsActive, @CreatedBy
        );
        SELECT * FROM Lead WHERE LeadID = @LeadID;
      `);
    
    return result.recordset[0];
  }

  static async update(id, data) {
    const pool = await poolPromise;
    
    // Extract domain from email if email is being updated
    let domain = data.Domain;
    if (!domain && data.Email) {
      const emailParts = data.Email.split('@');
      domain = emailParts.length > 1 ? emailParts[1].toLowerCase() : null;
    } else if (!domain && data.Email === null) {
      domain = null;
    }
    
    const updates = [];
    const request = pool.request().input('LeadID', sql.UniqueIdentifier, id);
    
    if (data.Email !== undefined) {
      updates.push('Email = @Email');
      request.input('Email', sql.NVarChar, data.Email || null);
    }
    
    if (domain !== undefined) {
      updates.push('Domain = @Domain');
      request.input('Domain', sql.NVarChar, domain || null);
    }
    
    if (data.CompanyName !== undefined) {
      updates.push('CompanyName = @CompanyName');
      request.input('CompanyName', sql.NVarChar, data.CompanyName || null);
    }
    
    if (data.Industry !== undefined) {
      updates.push('Industry = @Industry');
      request.input('Industry', sql.NVarChar, data.Industry || null);
    }
    
    if (data.Revenue !== undefined) {
      updates.push('Revenue = @Revenue');
      request.input('Revenue', sql.Decimal(18, 2), data.Revenue || null);
    }
    
    if (data.EmployeeCount !== undefined) {
      updates.push('EmployeeCount = @EmployeeCount');
      request.input('EmployeeCount', sql.Int, data.EmployeeCount || null);
    }
    
    if (data.FirstName !== undefined) {
      updates.push('FirstName = @FirstName');
      request.input('FirstName', sql.NVarChar, data.FirstName || null);
    }
    
    if (data.LastName !== undefined) {
      updates.push('LastName = @LastName');
      request.input('LastName', sql.NVarChar, data.LastName || null);
    }
    
    if (data.FullName !== undefined) {
      updates.push('FullName = @FullName');
      request.input('FullName', sql.NVarChar, data.FullName || null);
    }
    
    if (data.Title !== undefined) {
      updates.push('Title = @Title');
      request.input('Title', sql.NVarChar, data.Title || null);
    }
    
    if (data.Phone !== undefined) {
      updates.push('Phone = @Phone');
      request.input('Phone', sql.NVarChar, data.Phone || null);
    }
    
    if (data.City !== undefined) {
      updates.push('City = @City');
      request.input('City', sql.NVarChar, data.City || null);
    }
    
    if (data.State !== undefined) {
      updates.push('State = @State');
      request.input('State', sql.NVarChar, data.State || null);
    }
    
    if (data.Country !== undefined) {
      updates.push('Country = @Country');
      request.input('Country', sql.NVarChar, data.Country || null);
    }
    
    if (data.Website !== undefined) {
      updates.push('Website = @Website');
      request.input('Website', sql.NVarChar, data.Website || null);
    }
    
    if (data.LinkedInURL !== undefined) {
      updates.push('LinkedInURL = @LinkedInURL');
      request.input('LinkedInURL', sql.NVarChar, data.LinkedInURL || null);
    }
    
    if (data.AccountingSystem !== undefined) {
      updates.push('AccountingSystem = @AccountingSystem');
      request.input('AccountingSystem', sql.NVarChar, data.AccountingSystem || null);
    }
    
    if (data.Notes !== undefined) {
      updates.push('Notes = @Notes');
      request.input('Notes', sql.NVarChar(sql.MAX), data.Notes || null);
    }
    
    if (data.Tags !== undefined) {
      updates.push('Tags = @Tags');
      request.input('Tags', sql.NVarChar, data.Tags || null);
    }
    
    if (data.LeadScore !== undefined) {
      updates.push('LeadScore = @LeadScore');
      request.input('LeadScore', sql.Int, data.LeadScore);
    }
    
    if (data.LastContactDate !== undefined) {
      updates.push('LastContactDate = @LastContactDate');
      request.input('LastContactDate', sql.DateTime2, data.LastContactDate || null);
    }
    
    if (data.Source !== undefined) {
      updates.push('Source = @Source');
      request.input('Source', sql.NVarChar, data.Source || null);
    }
    
    if (data.IsDuplicate !== undefined) {
      updates.push('IsDuplicate = @IsDuplicate');
      request.input('IsDuplicate', sql.Bit, data.IsDuplicate);
    }
    
    if (data.DuplicateOfLeadID !== undefined) {
      updates.push('DuplicateOfLeadID = @DuplicateOfLeadID');
      request.input('DuplicateOfLeadID', sql.UniqueIdentifier, data.DuplicateOfLeadID || null);
    }
    
    if (data.IsActive !== undefined) {
      updates.push('IsActive = @IsActive');
      request.input('IsActive', sql.Bit, data.IsActive);
    }
    
    if (data.UpdatedBy !== undefined) {
      updates.push('UpdatedBy = @UpdatedBy');
      request.input('UpdatedBy', sql.UniqueIdentifier, data.UpdatedBy || null);
    }
    
    if (updates.length === 0) {
      return await this.getById(id);
    }
    
    updates.push('UpdatedOn = GETDATE()');
    
    const query = `UPDATE Lead SET ${updates.join(', ')} WHERE LeadID = @LeadID; SELECT * FROM Lead WHERE LeadID = @LeadID;`;
    const result = await request.query(query);
    return result.recordset[0];
  }

  static async delete(id) {
    const pool = await poolPromise;
    await pool
      .request()
      .input('LeadID', sql.UniqueIdentifier, id)
      .query('DELETE FROM Lead WHERE LeadID = @LeadID');
    return true;
  }

  // Check for duplicates based on domain + email
  static async findDuplicates(email, domain) {
    const pool = await poolPromise;
    const request = pool.request();
    
    let query = `
      SELECT * FROM Lead
      WHERE IsDuplicate = 0 AND IsActive = 1
    `;
    
    if (email) {
      query += ` AND Email = @Email`;
      request.input('Email', sql.NVarChar, email);
    }
    
    if (domain) {
      query += ` AND Domain = @Domain`;
      request.input('Domain', sql.NVarChar, domain);
    }
    
    const result = await request.query(query);
    return result.recordset;
  }

  // Get duplicate groups for review
  static async getDuplicateGroups() {
    const pool = await poolPromise;
    // Use FOR XML PATH for SQL Server compatibility (works on older versions)
    const result = await pool.request().query(`
      SELECT 
        Domain,
        Email,
        COUNT(*) AS DuplicateCount,
        STUFF((
          SELECT ',' + CAST(LeadID AS NVARCHAR(36))
          FROM Lead l2
          WHERE l2.Domain = l1.Domain AND l2.Email = l1.Email
            AND l2.IsDuplicate = 0 AND l2.IsActive = 1
          FOR XML PATH('')
        ), 1, 1, '') AS LeadIDs
      FROM Lead l1
      WHERE l1.IsDuplicate = 0 AND l1.IsActive = 1
        AND l1.Domain IS NOT NULL AND l1.Email IS NOT NULL
      GROUP BY l1.Domain, l1.Email
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
    `);
    return result.recordset;
  }
}

export default Lead;

