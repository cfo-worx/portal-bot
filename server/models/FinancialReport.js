import { poolPromise, sql } from '../db.js';

class FinancialReport {
  /**
   * Get financial reporting data with filters
   * @param {Object} filters - { startDate, endDate, clientIds, consultantIds }
   */
  static async getFinancialData(filters = {}) {
    const pool = await poolPromise;
    const { startDate, endDate, clientIds, consultantIds } = filters;

    // Get all contracts with filters
    let contractQuery = `
      SELECT 
        c.*,
        cl.ClientName,
        cl.ActiveStatus
      FROM Contract c
      JOIN Client cl ON c.ClientID = cl.ClientID
      WHERE 1=1
    `;

    const request = pool.request();

    if (clientIds && clientIds.length > 0) {
      const placeholders = clientIds.map((_, i) => `@ClientId${i}`).join(',');
      contractQuery += ` AND c.ClientID IN (${placeholders})`;
      clientIds.forEach((id, i) => {
        request.input(`ClientId${i}`, sql.UniqueIdentifier, id);
      });
    }

    const contracts = await request.query(contractQuery);
    const contractRecords = contracts.recordset;

    // Get all consultants
    let consultantQuery = `SELECT * FROM Consultant WHERE Status = 1`;
    const consultantRequest = pool.request();
    
    if (consultantIds && consultantIds.length > 0) {
      const placeholders = consultantIds.map((_, i) => `@ConsultantId${i}`).join(',');
      consultantQuery += ` AND ConsultantID IN (${placeholders})`;
      consultantIds.forEach((id, i) => {
        consultantRequest.input(`ConsultantId${i}`, sql.UniqueIdentifier, id);
      });
    }

    const consultantsResult = await consultantRequest.query(consultantQuery);
    const consultants = consultantsResult.recordset;

    // Create a map of consultant names to consultant data
    // Use normalized names (trimmed, case-insensitive) for matching
    const consultantMap = {};
    consultants.forEach(con => {
      const fullName = `${con.FirstName || ''} ${con.LastName || ''}`.trim();
      // Store with both original and normalized key for flexible lookup
      consultantMap[fullName] = con;
      consultantMap[fullName.toLowerCase()] = con;
      // Also store with normalized whitespace (multiple spaces -> single space)
      const normalizedName = fullName.replace(/\s+/g, ' ').trim().toLowerCase();
      consultantMap[normalizedName] = con;
    });

    // Get timesheet hours
    let timesheetQuery = `
      SELECT 
        ConsultantID,
        ClientID,
        SUM(ClientFacingHours + NonClientFacingHours) AS TotalHours
      FROM TimecardLines
      WHERE Status = 'Approved'
    `;
    const timesheetRequest = pool.request();

    if (startDate && endDate) {
      timesheetQuery += ` AND TimesheetDate BETWEEN @TimesheetStartDate AND @TimesheetEndDate`;
      timesheetRequest.input('TimesheetStartDate', sql.Date, startDate);
      timesheetRequest.input('TimesheetEndDate', sql.Date, endDate);
    }

    timesheetQuery += ` GROUP BY ConsultantID, ClientID`;

    const timesheetsResult = await timesheetRequest.query(timesheetQuery);
    const timesheets = timesheetsResult.recordset;

    // Create a map of hours by consultant and client
    const hoursMap = {};
    timesheets.forEach(ts => {
      // Convert GUIDs to strings and normalize to uppercase for consistent comparison
      const consultantIdStr = String(ts.ConsultantID || '').toUpperCase();
      const clientIdStr = String(ts.ClientID || '').toUpperCase();
      const key = `${consultantIdStr}_${clientIdStr}`;
      hoursMap[key] = parseFloat(ts.TotalHours) || 0;
    });

    console.log('hoursMap', hoursMap);

    // Helper function to check if contract is valid for the date range
    const isContractValidForDateRange = (contract, startDate, endDate) => {
      if (!contract.ActiveStatus) {
        return false;
      }

      const contractStart = contract.ContractStartDate ? new Date(contract.ContractStartDate) : null;
      const contractEnd = contract.ContractEndDate ? new Date(contract.ContractEndDate) : null;
      const rangeStart = new Date(startDate);
      const rangeEnd = new Date(endDate);

      // If no date range is specified, all contracts are valid
      if (!startDate || !endDate) {
        return true;
      }

      // Contract must start before or on the range end date
      if (contractStart && contractStart > rangeEnd) {
        return false;
      }

      // If contract has an end date, it must end after or on the range start date
      if (contractEnd && contractEnd < rangeStart) {
        if (contract.ContractEndReason) {
          return false;
        } else {
          return true;
        }
      }

      // Contract is valid if it overlaps with the date range
      return true;
    };

    // Process contracts and expand staff assignments
    const lineItems = [];

    contractRecords.forEach(contract => {
      // Check if contract is valid for the date range
      if (!isContractValidForDateRange(contract, startDate, endDate)) {
        return; // Skip this contract if it's not valid for the date range
      }

      const contractId = contract.ContractID;
      const clientId = contract.ClientID;
      const clientName = contract.ClientName;
      const contractType = contract.ContractType || 'Project';
      const contractStartDate = contract.ContractStartDate;
      const contractEndDate = contract.ContractEndDate;
      let contractLength = contract.ContractLength;
      const contractEndReason = contract.ContractEndReason;
      const contractLineItems = [];

      // Calculate contract length from start and end dates if not defined
      if (!contractLength && contractStartDate && contractEndDate) {
        const start = new Date(contractStartDate);
        const end = new Date(contractEndDate);
        const diffTime = Math.abs(end - start);
        const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30));
        contractLength = diffMonths;
      }

      // For active contracts without end reason, calculate length from start date to current date
      // If contract end date exists and is before today, use end date instead of current date
      if (contract.ActiveStatus && !contractEndReason && contractStartDate) {
        const start = new Date(contractStartDate);
        const now = new Date();
        let referenceDate = now;
        
        // Check if contract end date exists and is before today
        if (contractEndDate) {
          const end = new Date(contractEndDate);
          if (end > now) {
            referenceDate = end;
          }
        }
        
        const diffTime = Math.abs(referenceDate - start);
        const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30));
        contractLength = diffMonths;
      }

      // Helper function to add a line item
      const addLineItem = (staffName, role, clientRate, quantity = null) => {
        if (!staffName || staffName.trim() === '') return;

        // Normalize the staff name for lookup (trim, normalize whitespace, lowercase)
        const normalizedStaffName = staffName.trim().replace(/\s+/g, ' ').toLowerCase();
        // Try multiple lookup strategies
        const consultant = consultantMap[staffName.trim()] || 
                          consultantMap[staffName.trim().toLowerCase()] ||
                          consultantMap[normalizedStaffName];
        const consultantId = consultant?.ConsultantID;
        const payType = consultant?.PayType;
        const payRate = parseFloat(consultant?.PayRate) || 0;
        const hourlyRate = parseFloat(consultant?.HourlyRate) || 0;
        const jobTitle = consultant?.JobTitle;

        // Get hours for this consultant/client
        // Convert GUIDs to strings and normalize to uppercase for consistent comparison
        const consultantIdStr = consultantId ? String(consultantId).toUpperCase() : null;
        const clientIdStr = clientId ? String(clientId).toUpperCase() : null;
        const hoursKey = consultantIdStr && clientIdStr ? `${consultantIdStr}_${clientIdStr}` : null;
        const totalHours = hoursKey ? (hoursMap[hoursKey] || 0) : 0;

        // Calculate months remaining
        let monthsRemaining = null;
        if (contractEndReason) {
          monthsRemaining = 0;
        } else if (contractEndDate) {
          const end = new Date(contractEndDate);
          const now = new Date();
          monthsRemaining = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24 * 30)));
        } else if (contractLength && contractStartDate) {
          const start = new Date(contractStartDate);
          const now = new Date();
          const monthsElapsed = Math.floor((now - start) / (1000 * 60 * 60 * 24 * 30));
          monthsRemaining = Math.max(0, contractLength - monthsElapsed);
        }

        contractLineItems.push({
          ContractID: contractId,
          ClientID: clientId,
          ClientName: clientName,
          ContractType: contractType,
          ContractStartDate: contractStartDate,
          ContractEndDate: contractEndDate,
          ContractEndReason: contractEndReason,
          ContractLength: contractLength,
          ActiveStatus: contract.ActiveStatus,
          StaffName: staffName.trim(),
          Role: role,
          ClientRate: parseFloat(clientRate) || 0,
          Quantity: quantity != null ? parseFloat(quantity) : null,
          ConsultantID: consultantId,
          PayType: payType,
          PayRate: payRate,
          HourlyRate: hourlyRate,
          JobTitle: jobTitle,
          TotalProjectFee: parseFloat(contract.TotalProjectFee) || 0,
          MonthlyFee: parseFloat(contract.MonthlyFee) || 0,
          OnboardingFee: parseFloat(contract.OnboardingFee) || 0,
          TotalHours: totalHours,
          MonthsRemaining: monthsRemaining,
        });
      };

      // Add CFO
      if (contract.AssignedCFO) {
        addLineItem(contract.AssignedCFO, 'CFO', contract.AssignedCFORate);
      }

      // Add Controller
      if (contract.AssignedController) {
        addLineItem(contract.AssignedController, 'Controller', contract.AssignedControllerRate);
      }

      // Add Senior Accountant
      if (contract.AssignedSeniorAccountant) {
        addLineItem(contract.AssignedSeniorAccountant, 'Senior Accountant', contract.AssignedSeniorAccountantRate);
      }

      // Add Software
      if (contract.AssignedSoftware) {
        const softwareQuantity = contract.AssignedSoftwareQuantity != null ? parseFloat(contract.AssignedSoftwareQuantity) : 1;
        addLineItem(contract.AssignedSoftware, 'Software', contract.AssignedSoftwareRate, softwareQuantity);
      }

      // Add Additional Staff from JSON
      if (contract.AdditionalStaff) {
        try {
          const additionalStaff = JSON.parse(contract.AdditionalStaff);
          if (Array.isArray(additionalStaff)) {
            additionalStaff.forEach(staff => {
              if (staff.name) {
                addLineItem(staff.name, staff.role || 'Additional Staff', staff.rate || 0);
              }
            });
          }
        } catch (e) {
          console.error('Error parsing AdditionalStaff JSON:', e);
        }
      }

      // Calculate total line items count for this contract and add to all line items
      const totalLineItems = contractLineItems.length;
      contractLineItems.forEach(item => {
        item.LineItemCount = totalLineItems;
        lineItems.push(item);
      });
    });

    return lineItems;
  }
}

export default FinancialReport;

