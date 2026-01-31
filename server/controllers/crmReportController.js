import { poolPromise, sql } from '../db.js';

// Helper to build date filter
const buildDateFilter = (request, startDate, endDate) => {
  if (startDate) {
    request.input('StartDate', sql.DateTime2, new Date(startDate));
  }
  if (endDate) {
    request.input('EndDate', sql.DateTime2, new Date(endDate));
  }
  return {
    start: startDate ? 'AND d.CreatedOn >= @StartDate' : '',
    end: endDate ? 'AND d.CreatedOn <= @EndDate' : '',
    activityStart: startDate ? 'AND a.ActivityDate >= @StartDate' : '',
    activityEnd: endDate ? 'AND a.ActivityDate <= @EndDate' : '',
  };
};

// Get KPIs summary
export const getKPISummary = async (req, res) => {
  try {
    const { module, startDate, endDate } = req.query;
    const pool = await poolPromise;
    const request = pool.request();
    
    let moduleFilter = '';
    if (module) {
      moduleFilter = 'AND d.Module = @Module';
      request.input('Module', sql.NVarChar, module);
    }
    
    const dateFilters = buildDateFilter(request, startDate, endDate);
    
    // Pipeline value (open deals)
    const pipelineQuery = `
      SELECT 
        COUNT(*) AS OpenDeals,
        SUM(CAST(d.Amount AS FLOAT)) AS PipelineValue
      FROM CRMDeal d
      LEFT JOIN CRMStage s ON d.StageID = s.StageID
      WHERE d.IsActive = 1
        AND (s.StageName NOT LIKE '%Closed%' OR s.StageName IS NULL)
        ${moduleFilter}
        ${dateFilters.start}
        ${dateFilters.end}
    `;
    
    // Closed won deals
    const closedWonQuery = `
      SELECT 
        COUNT(*) AS ClosedWonCount,
        SUM(CAST(d.Amount AS FLOAT)) AS ClosedWonValue,
        AVG(CAST(d.Amount AS FLOAT)) AS AvgContractValue
      FROM CRMDeal d
      LEFT JOIN CRMStage s ON d.StageID = s.StageID
      WHERE d.IsActive = 1
        AND s.StageName LIKE '%Closed/Won%'
        ${moduleFilter}
        ${dateFilters.start}
        ${dateFilters.end}
    `;
    
    // Quotes sent (deals in "Quote Sent" stage or activities with Quote type)
    const quotesQuery = `
      SELECT COUNT(DISTINCT d.DealID) AS QuotesSent
      FROM CRMDeal d
      LEFT JOIN CRMStage s ON d.StageID = s.StageID
      WHERE d.IsActive = 1
        AND (s.StageName LIKE '%Quote%' OR s.StageName LIKE '%Quoted%')
        ${moduleFilter}
        ${dateFilters.start}
        ${dateFilters.end}
    `;
    
    // Rebook (follow-up activities)
    const rebookQuery = `
      SELECT COUNT(DISTINCT a.DealID) AS RebookCount
      FROM CRMDealActivity a
      INNER JOIN CRMDeal d ON a.DealID = d.DealID
      WHERE d.IsActive = 1
        AND (a.ActivityDescription LIKE '%follow%' OR a.ActivityDescription LIKE '%rebook%' OR a.ActivityType = 'Meeting')
        ${moduleFilter}
        ${dateFilters.activityStart}
        ${dateFilters.activityEnd}
    `;
    
    // Commissions (from closed won deals - assuming Amount represents commission value)
    const commissionsQuery = `
      SELECT SUM(CAST(d.Amount AS FLOAT)) AS TotalCommissions
      FROM CRMDeal d
      LEFT JOIN CRMStage s ON d.StageID = s.StageID
      WHERE d.IsActive = 1
        AND s.StageName LIKE '%Closed/Won%'
        ${moduleFilter}
        ${dateFilters.start}
        ${dateFilters.end}
    `;
    
    const [pipeline, closedWon, quotes, rebook, commissions] = await Promise.all([
      request.query(pipelineQuery),
      request.query(closedWonQuery),
      request.query(quotesQuery),
      request.query(rebookQuery),
      request.query(commissionsQuery),
    ]);
    
    res.json({
      pipelineValue: pipeline.recordset[0]?.PipelineValue || 0,
      openDeals: pipeline.recordset[0]?.OpenDeals || 0,
      closedWonCount: closedWon.recordset[0]?.ClosedWonCount || 0,
      closedWonValue: closedWon.recordset[0]?.ClosedWonValue || 0,
      avgContractValue: closedWon.recordset[0]?.AvgContractValue || 0,
      quotesSent: quotes.recordset[0]?.QuotesSent || 0,
      rebookCount: rebook.recordset[0]?.RebookCount || 0,
      totalCommissions: commissions.recordset[0]?.TotalCommissions || 0,
    });
  } catch (error) {
    console.error('Error fetching KPI summary:', error);
    res.status(500).json({ error: 'Failed to fetch KPI summary' });
  }
};

// Get trailing 12 months data
export const getTrailing12Months = async (req, res) => {
  try {
    const { module } = req.query;
    const pool = await poolPromise;
    const request = pool.request();
    
    let moduleFilter = '';
    if (module) {
      moduleFilter = 'AND d.Module = @Module';
      request.input('Module', sql.NVarChar, module);
    }
    
    const query = `
      SELECT 
        FORMAT(d.CreatedOn, 'yyyy-MM') AS Month,
        COUNT(*) AS DealCount,
        SUM(CAST(d.Amount AS FLOAT)) AS DealValue,
        SUM(CASE WHEN s.StageName LIKE '%Closed/Won%' THEN 1 ELSE 0 END) AS ClosedWonCount,
        SUM(CASE WHEN s.StageName LIKE '%Closed/Won%' THEN CAST(d.Amount AS FLOAT) ELSE 0 END) AS ClosedWonValue
      FROM CRMDeal d
      LEFT JOIN CRMStage s ON d.StageID = s.StageID
      WHERE d.IsActive = 1
        AND d.CreatedOn >= DATEADD(MONTH, -12, GETDATE())
        ${moduleFilter}
      GROUP BY FORMAT(d.CreatedOn, 'yyyy-MM')
      ORDER BY Month ASC
    `;
    
    const result = await request.query(query);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching trailing 12 months:', error);
    res.status(500).json({ error: 'Failed to fetch trailing 12 months data' });
  }
};

// Get source productivity (by LeadSource)
export const getSourceProductivity = async (req, res) => {
  try {
    const { module, startDate, endDate } = req.query;
    const pool = await poolPromise;
    const request = pool.request();
    
    let moduleFilter = '';
    if (module) {
      moduleFilter = 'AND d.Module = @Module';
      request.input('Module', sql.NVarChar, module);
    }
    
    const dateFilters = buildDateFilter(request, startDate, endDate);
    
    const query = `
      SELECT 
        ls.SourceName AS SourceName,
        COUNT(DISTINCT d.DealID) AS DealCount,
        SUM(CAST(d.Amount AS FLOAT)) AS TotalValue,
        SUM(CASE WHEN s.StageName LIKE '%Closed/Won%' THEN 1 ELSE 0 END) AS ClosedWonCount,
        SUM(CASE WHEN s.StageName LIKE '%Closed/Won%' THEN CAST(d.Amount AS FLOAT) ELSE 0 END) AS ClosedWonValue,
        AVG(CAST(d.Amount AS FLOAT)) AS AvgDealValue
      FROM CRMDeal d
      LEFT JOIN CRMLeadSource ls ON d.LeadSourceID = ls.LeadSourceID
      LEFT JOIN CRMStage s ON d.StageID = s.StageID
      WHERE d.IsActive = 1
        AND ls.SourceName IS NOT NULL
        ${moduleFilter}
        ${dateFilters.start}
        ${dateFilters.end}
      GROUP BY ls.SourceName
      ORDER BY DealCount DESC
    `;
    
    const result = await request.query(query);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching source productivity:', error);
    res.status(500).json({ error: 'Failed to fetch source productivity' });
  }
};

// Get rep performance breakdown
export const getRepPerformance = async (req, res) => {
  try {
    const { module, startDate, endDate } = req.query;
    const pool = await poolPromise;
    const request = pool.request();
    
    let moduleFilter = '';
    if (module) {
      moduleFilter = 'AND d.Module = @Module';
      request.input('Module', sql.NVarChar, module);
    }
    
    const dateFilters = buildDateFilter(request, startDate, endDate);
    
    const query = `
      SELECT 
        c.FirstName + ' ' + c.LastName AS RepName,
        c.ConsultantID AS RepID,
        COUNT(DISTINCT d.DealID) AS TotalDeals,
        SUM(CAST(d.Amount AS FLOAT)) AS TotalPipelineValue,
        SUM(CASE WHEN s.StageName LIKE '%Closed/Won%' THEN 1 ELSE 0 END) AS ClosedWonCount,
        SUM(CASE WHEN s.StageName LIKE '%Closed/Won%' THEN CAST(d.Amount AS FLOAT) ELSE 0 END) AS ClosedWonValue,
        AVG(CAST(d.Amount AS FLOAT)) AS AvgDealValue,
        COUNT(DISTINCT CASE WHEN a.ActivityType = 'Call' THEN a.ActivityID END) AS CallCount,
        COUNT(DISTINCT CASE WHEN a.ActivityType = 'Meeting' THEN a.ActivityID END) AS MeetingCount,
        COUNT(DISTINCT CASE WHEN s.StageName LIKE '%Quote%' THEN d.DealID END) AS QuotesSent
      FROM CRMDeal d
      LEFT JOIN Consultant c ON d.OwnerID = c.ConsultantID
      LEFT JOIN CRMStage s ON d.StageID = s.StageID
      LEFT JOIN CRMDealActivity a ON d.DealID = a.DealID
      WHERE d.IsActive = 1
        AND c.ConsultantID IS NOT NULL
        ${moduleFilter}
        ${dateFilters.start}
        ${dateFilters.end}
      GROUP BY c.ConsultantID, c.FirstName, c.LastName
      ORDER BY TotalPipelineValue DESC
    `;
    
    const result = await request.query(query);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching rep performance:', error);
    res.status(500).json({ error: 'Failed to fetch rep performance' });
  }
};

// Get stage breakdown
export const getStageBreakdown = async (req, res) => {
  try {
    const { module, startDate, endDate } = req.query;
    const pool = await poolPromise;
    const request = pool.request();
    
    let moduleFilter = '';
    if (module) {
      moduleFilter = 'AND d.Module = @Module';
      request.input('Module', sql.NVarChar, module);
    }
    
    const dateFilters = buildDateFilter(request, startDate, endDate);
    
    const query = `
      SELECT 
        s.StageName,
        COUNT(DISTINCT d.DealID) AS DealCount,
        SUM(CAST(d.Amount AS FLOAT)) AS TotalValue,
        AVG(CAST(d.Amount AS FLOAT)) AS AvgValue
      FROM CRMDeal d
      LEFT JOIN CRMStage s ON d.StageID = s.StageID
      WHERE d.IsActive = 1
        ${moduleFilter}
        ${dateFilters.start}
        ${dateFilters.end}
      GROUP BY s.StageName
      ORDER BY DealCount DESC
    `;
    
    const result = await request.query(query);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching stage breakdown:', error);
    res.status(500).json({ error: 'Failed to fetch stage breakdown' });
  }
};

// Get activity trends (for charts)
export const getActivityTrends = async (req, res) => {
  try {
    const { module, startDate, endDate, groupBy = 'day' } = req.query;
    const pool = await poolPromise;
    const request = pool.request();
    
    let moduleFilter = '';
    if (module) {
      moduleFilter = 'AND d.Module = @Module';
      request.input('Module', sql.NVarChar, module);
    }
    
    const dateFilters = buildDateFilter(request, startDate, endDate);
    
    let dateFormat = "FORMAT(a.ActivityDate, 'yyyy-MM-dd')";
    if (groupBy === 'week') {
      dateFormat = "FORMAT(DATEADD(DAY, -DATEPART(WEEKDAY, a.ActivityDate) + 1, a.ActivityDate), 'yyyy-MM-dd')";
    } else if (groupBy === 'month') {
      dateFormat = "FORMAT(a.ActivityDate, 'yyyy-MM')";
    }
    
    const query = `
      SELECT 
        ${dateFormat} AS Period,
        a.ActivityType,
        COUNT(*) AS ActivityCount
      FROM CRMDealActivity a
      INNER JOIN CRMDeal d ON a.DealID = d.DealID
      WHERE d.IsActive = 1
        ${moduleFilter}
        ${dateFilters.activityStart}
        ${dateFilters.activityEnd}
      GROUP BY ${dateFormat}, a.ActivityType
      ORDER BY Period ASC, a.ActivityType
    `;
    
    const result = await request.query(query);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching activity trends:', error);
    res.status(500).json({ error: 'Failed to fetch activity trends' });
  }
};

// Export report data (CSV)
export const exportReport = async (req, res) => {
  try {
    const { type, module, startDate, endDate } = req.query;
    
    let data = [];
    let filename = 'crm-report';
    
    switch (type) {
      case 'rep-performance':
        const repData = await getRepPerformanceData(req);
        data = repData;
        filename = 'rep-performance';
        break;
      case 'source-productivity':
        const sourceData = await getSourceProductivityData(req);
        data = sourceData;
        filename = 'source-productivity';
        break;
      case 'stage-breakdown':
        const stageData = await getStageBreakdownData(req);
        data = stageData;
        filename = 'stage-breakdown';
        break;
      default:
        return res.status(400).json({ error: 'Invalid export type' });
    }
    
    // Convert to CSV
    if (data.length === 0) {
      return res.status(404).json({ error: 'No data to export' });
    }
    
    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map(row => headers.map(header => {
        const value = row[header];
        return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
      }).join(','))
    ];
    
    const csv = csvRows.join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}-${Date.now()}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting report:', error);
    res.status(500).json({ error: 'Failed to export report' });
  }
};

// Helper functions for export
const getRepPerformanceData = async (req) => {
  const pool = await poolPromise;
  const request = pool.request();
  const { module, startDate, endDate } = req.query;
  
  let moduleFilter = '';
  if (module) {
    moduleFilter = 'AND d.Module = @Module';
    request.input('Module', sql.NVarChar, module);
  }
  
  const dateFilters = buildDateFilter(request, startDate, endDate);
  
  const query = `
    SELECT 
      c.FirstName + ' ' + c.LastName AS RepName,
      COUNT(DISTINCT d.DealID) AS TotalDeals,
      SUM(CAST(d.Amount AS FLOAT)) AS TotalPipelineValue,
      SUM(CASE WHEN s.StageName LIKE '%Closed/Won%' THEN 1 ELSE 0 END) AS ClosedWonCount,
      SUM(CASE WHEN s.StageName LIKE '%Closed/Won%' THEN CAST(d.Amount AS FLOAT) ELSE 0 END) AS ClosedWonValue
    FROM CRMDeal d
    LEFT JOIN Consultant c ON d.OwnerID = c.ConsultantID
    LEFT JOIN CRMStage s ON d.StageID = s.StageID
    WHERE d.IsActive = 1
      AND c.ConsultantID IS NOT NULL
      ${moduleFilter}
      ${dateFilters.start}
      ${dateFilters.end}
    GROUP BY c.ConsultantID, c.FirstName, c.LastName
    ORDER BY TotalPipelineValue DESC
  `;
  
  const result = await request.query(query);
  return result.recordset;
};

const getSourceProductivityData = async (req) => {
  const pool = await poolPromise;
  const request = pool.request();
  const { module, startDate, endDate } = req.query;
  
  let moduleFilter = '';
  if (module) {
    moduleFilter = 'AND d.Module = @Module';
    request.input('Module', sql.NVarChar, module);
  }
  
  const dateFilters = buildDateFilter(request, startDate, endDate);
  
  const query = `
    SELECT 
      ls.SourceName AS SourceName,
      COUNT(DISTINCT d.DealID) AS DealCount,
      SUM(CAST(d.Amount AS FLOAT)) AS TotalValue,
      SUM(CASE WHEN s.StageName LIKE '%Closed/Won%' THEN 1 ELSE 0 END) AS ClosedWonCount
    FROM CRMDeal d
    LEFT JOIN CRMLeadSource ls ON d.LeadSourceID = ls.LeadSourceID
    LEFT JOIN CRMStage s ON d.StageID = s.StageID
    WHERE d.IsActive = 1
      AND ls.SourceName IS NOT NULL
      ${moduleFilter}
      ${dateFilters.start}
      ${dateFilters.end}
    GROUP BY ls.SourceName
    ORDER BY DealCount DESC
  `;
  
  const result = await request.query(query);
  return result.recordset;
};

const getStageBreakdownData = async (req) => {
  const pool = await poolPromise;
  const request = pool.request();
  const { module, startDate, endDate } = req.query;
  
  let moduleFilter = '';
  if (module) {
    moduleFilter = 'AND d.Module = @Module';
    request.input('Module', sql.NVarChar, module);
  }
  
  const dateFilters = buildDateFilter(request, startDate, endDate);
  
  const query = `
    SELECT 
      s.StageName,
      COUNT(DISTINCT d.DealID) AS DealCount,
      SUM(CAST(d.Amount AS FLOAT)) AS TotalValue
    FROM CRMDeal d
    LEFT JOIN CRMStage s ON d.StageID = s.StageID
    WHERE d.IsActive = 1
      ${moduleFilter}
      ${dateFilters.start}
      ${dateFilters.end}
    GROUP BY s.StageName
    ORDER BY DealCount DESC
  `;
  
  const result = await request.query(query);
  return result.recordset;
};

