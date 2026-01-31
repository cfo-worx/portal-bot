import FinancialReport from '../models/FinancialReport.js';

// Get financial reporting data
export const getFinancialData = async (req, res) => {
  try {
    const { startDate, endDate, clientIds, consultantIds } = req.query;
    
    const filters = {
      startDate: startDate || null,
      endDate: endDate || null,
      clientIds: clientIds ? (Array.isArray(clientIds) ? clientIds : [clientIds]) : null,
      consultantIds: consultantIds ? (Array.isArray(consultantIds) ? consultantIds : [consultantIds]) : null,
    };

    const data = await FinancialReport.getFinancialData(filters);
    res.json(data);
  } catch (error) {
    console.error('Error fetching financial data:', error);
    res.status(500).json({ error: 'Failed to fetch financial data' });
  }
};

