// Financial Reporting Dashboard Page
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Grid,
  Paper,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Autocomplete,
  Chip,
  CircularProgress,
  IconButton,
  Collapse,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  Snackbar,
  Alert,
} from '@mui/material';
import {
  FileDownload as FileDownloadIcon,
  FilterList as FilterListIcon,
  Clear as ClearIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import { getFinancialData } from '../../../api/financialReports';
import { getClients } from '../../../api/clients';
import { getActiveConsultants } from '../../../api/consultants';

const FinancialReportingPage = () => {
  // Data states
  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter states
  const [filtersVisible, setFiltersVisible] = useState(true);
  const [dateFilter, setDateFilter] = useState('currentMonth');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedClients, setSelectedClients] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState([]);

  // Options for filters
  const [clients, setClients] = useState([]);
  const [staff, setStaff] = useState([]);

  // Tab state
  const [activeTab, setActiveTab] = useState(0);

  // Sorting states for each table
  const [sortConfig, setSortConfig] = useState({
    lineItem: { orderBy: '', order: 'asc' },
    byType: { orderBy: '', order: 'asc' },
    byPerson: { orderBy: '', order: 'asc' },
    byClient: { orderBy: '', order: 'asc' },
    byRole: { orderBy: '', order: 'asc' },
  });

  // Snackbar state
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success',
  });

  // Calculate date range based on filter selection
  const getDateRange = () => {
    const now = dayjs();
    let start, end;

    switch (dateFilter) {
      case 'noDate':
        return {
          startDate: null,
          endDate: null,
        };
      case 'custom':
        return {
          startDate: customStartDate || null,
          endDate: customEndDate || null,
        };
      case 'currentMonth':
        start = now.startOf('month');
        end = now.endOf('month');
        break;
      case 'lastMonth':
        start = now.subtract(1, 'month').startOf('month');
        end = now.subtract(1, 'month').endOf('month');
        break;
      case 'currentQuarter':
        const quarter = Math.floor(now.month() / 3);
        start = now.month(quarter * 3).startOf('month');
        end = now.month(quarter * 3 + 2).endOf('month');
        break;
      case 'lastQuarter':
        const lastQuarter = Math.floor(now.month() / 3) - 1;
        const lastQuarterMonth = lastQuarter < 0 ? 9 : lastQuarter * 3;
        start = now.month(lastQuarterMonth).startOf('month');
        end = now.month(lastQuarterMonth + 2).endOf('month');
        break;
      case 'yearToDate':
        start = now.startOf('year');
        end = now.endOf('month');
        break;
      case 'lastYear':
        start = now.subtract(1, 'year').startOf('year');
        end = now.subtract(1, 'year').endOf('year');
        break;
      default:
        return { startDate: null, endDate: null };
    }

    return {
      startDate: start.format('YYYY-MM-DD'),
      endDate: end.format('YYYY-MM-DD'),
    };
  };

  // Load initial data
  useEffect(() => {
    loadClients();
    loadStaff();
  }, []);

  useEffect(() => {
    loadFinancialData();
  }, [dateFilter, customStartDate, customEndDate, selectedClients, selectedStaff]);

  const loadClients = async () => {
    try {
      const data = await getClients();
      // Sort clients alphabetically by ClientName
      const sorted = (data || []).sort((a, b) => {
        const nameA = (a.ClientName || '').toLowerCase();
        const nameB = (b.ClientName || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });
      setClients(sorted);
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  };

  const loadStaff = async () => {
    try {
      const data = await getActiveConsultants();
      // Sort staff alphabetically by FirstName + LastName
      const sorted = (data || []).sort((a, b) => {
        const nameA = `${a.FirstName || ''} ${a.LastName || ''}`.trim().toLowerCase();
        const nameB = `${b.FirstName || ''} ${b.LastName || ''}`.trim().toLowerCase();
        return nameA.localeCompare(nameB);
      });
      setStaff(sorted);
    } catch (error) {
      console.error('Error loading staff:', error);
    }
  };

  const loadFinancialData = async () => {
    setLoading(true);
    setError(null);
    try {
      const dateRange = getDateRange();
      const filters = {
        ...dateRange,
        clientIds: selectedClients.map(c => c.ClientID),
        consultantIds: selectedStaff.map(s => s.ConsultantID),
      };

      const data = await getFinancialData(filters);
      setRawData(data || []);
    } catch (err) {
      console.error('Error loading financial data:', err);
      setError('Failed to load financial data');
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setDateFilter('noDate');
    setCustomStartDate('');
    setCustomEndDate('');
    setSelectedClients([]);
    setSelectedStaff([]);
  };

  // Get number of months based on date filter
  const getMonths = (item) => {
    const now = dayjs();
    const dateRange = getDateRange();
    
    // If no date filter (Total), return null
    if (dateFilter === 'noDate') {
      if (!item.ContractEndReason && item.ActiveStatus && item.ContractStartDate) {
        const start = dayjs(item.ContractStartDate);
        const end = now;
        return Math.ceil(end.diff(start, 'month', true));
      } else {
        return item.ContractLength;
      }
    }

    const filterStart = dayjs(dateRange.startDate);
    const filterEnd = dayjs(dateRange.endDate);
    const contractStart = dayjs(item.ContractStartDate);
    const newStart = contractStart && contractStart.isAfter(filterStart) ? contractStart : filterStart;

    return Math.ceil(filterEnd.diff(newStart, 'month', true));
  }

  // Calculate revenue and costs for each line item
  const calculateLineItemRevenue = (item) => {
    const contractType = item.ContractType || 'Project';
    const months = getMonths(item);
    
    // For Software role, always calculate as rate * quantity regardless of contract type
    let softwareRevenueObj = null;
    if (item.Role === 'Software') {
      const rate = item.ClientRate || 0;
      const quantity = item.Quantity != null ? parseFloat(item.Quantity) : 0;
      const softwareRevenue = rate * quantity;
      
      softwareRevenueObj = {
        totalAmount: softwareRevenue,
        monthlyAmount: months > 0 ? softwareRevenue / months : softwareRevenue,
      };
    }
    
    if (contractType === 'Project' || contractType === 'M&A') {
      // Flat fee - divide by contract length or months remaining
      const totalFee = item.ClientRate || item.TotalProjectFee / item.LineItemCount || 0;
      const validMonths = months > item.ContractLength ? item.ContractLength : months;
      const contractRevenue = item.TotalProjectFee / item.ContractLength * validMonths || 0;
      if (item.Role === 'Software') {
        return {
          ...softwareRevenueObj,
          contractRevenue,
        }
      }
      return {
        totalAmount: (totalFee / item.ContractLength) * validMonths || 0,
        monthlyAmount: 0,
        contractRevenue,
      };
    } else if (contractType === 'Hourly') {
      // Rate * Hours
      const total = (item.ClientRate || 0) * (item.TotalHours || 0);
      return {
        totalAmount: total,
        monthlyAmount: months > 0 ? total / months : 0, // For hourly, monthly = total in period
      };
    } else if (contractType === 'Recurring') {
      // Monthly fee
      // const monthlyFee = item.ClientRate || (item.MonthlyFee || 0) / item.LineItemCount || 0;
      const monthlyFee = item.ClientRate || 0;
      const contractRevenue = months >= 0 ? (item.MonthlyFee || 0) * months : 0;
      if (item.Role === 'Software') {
        return {
          ...softwareRevenueObj,
          contractRevenue,
        }
      }
      return {
        totalAmount: months >= 0 ? monthlyFee * months : 0,
        monthlyAmount: monthlyFee,
        contractRevenue,
      };
    }
    
    return { totalAmount: 0, monthlyAmount: 0 };
  };

  const calculateLineItemCost = (item) => {
    if (!item.PayType || !item.PayRate) return 0;

    const months = getMonths(item);

    if (item.PayType === 'Salary') {
      // Fixed monthly cost
      return (item.HourlyRate || 0) * (item.TotalHours || 0);
    } else if (item.PayType === 'Hourly' || item.PayType === 'Flat Rate') {
      // Pay rate * hours worked
      return (item.PayRate || 0) * (item.TotalHours || 0);
    }

    return 0;
  };

  // Generic sort function
  const sortData = (data, orderBy, order) => {
    if (!orderBy) return data;
    
    return [...data].sort((a, b) => {
      let aValue = a[orderBy];
      let bValue = b[orderBy];
      
      // Handle null/undefined values
      if (aValue == null) aValue = '';
      if (bValue == null) bValue = '';
      
      // Handle numeric values
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return order === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      // Handle string values
      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();
      
      if (order === 'asc') {
        return aStr.localeCompare(bStr);
      } else {
        return bStr.localeCompare(aStr);
      }
    });
  };

  // Process data for different views
  const processedData = rawData.map(item => {
    const revenue = calculateLineItemRevenue(item);
    const cost = calculateLineItemCost(item);
    const grossMargin = revenue.totalAmount - cost;
    const marginPercent = revenue.totalAmount > 0 ? (grossMargin / revenue.totalAmount) * 100 : 0;

    return {
      ...item,
      ...revenue,
      cost,
      grossMargin,
      marginPercent,
    };
  });

  // Tab 1: Revenue by Line Item
  const revenueByLineItemSorted = sortData(
    processedData,
    sortConfig.lineItem.orderBy,
    sortConfig.lineItem.order
  );

  // Tab 2: Revenue by Type
  const revenueByType = processedData.reduce((acc, item) => {
    const type = item.ContractType || 'Project';
    if (!acc[type]) {
      acc[type] = {
        type,
        totalRevenue: 0,
        lineItemCount: 0,
      };
    }
    acc[type].totalRevenue += item.totalAmount;
    acc[type].lineItemCount += 1;
    return acc;
  }, {});

  const revenueByTypeArray = Object.values(revenueByType);
  const totalRevenueByType = revenueByTypeArray.reduce((sum, item) => sum + item.totalRevenue, 0);
  revenueByTypeArray.forEach(item => {
    item.percentOfTotal = totalRevenueByType > 0 ? (item.totalRevenue / totalRevenueByType) * 100 : 0;
  });
  const revenueByTypeArraySorted = sortData(
    revenueByTypeArray,
    sortConfig.byType.orderBy,
    sortConfig.byType.order
  );

  // Tab 3: By Person
  const byPerson = processedData.reduce((acc, item) => {
    const key = item.ConsultantID || item.StaffName;
    if (!key) return acc;

    if (!acc[key]) {
      acc[key] = {
        name: item.StaffName,
        role: item.Role || item.JobTitle || 'Unknown',
        totalRevenue: 0,
        totalCost: 0,
        totalCostObj: {},
      };
    }
    acc[key].totalRevenue += item.totalAmount;
    acc[key].totalCostObj[item.ClientID] = item.cost || 0;
    return acc;
  }, {});

  const byPersonArray = Object.values(byPerson).map(item => {
    item.totalCost = Object.values(item.totalCostObj).reduce((sum, i) => sum + i, 0);
    return {
      ...item,
      grossMargin: item.totalRevenue - item.totalCost,
      marginPercent: item.totalRevenue > 0 ? ((item.totalRevenue - item.totalCost) / item.totalRevenue) * 100 : 0,
    }
  });
  const byPersonArraySorted = sortData(
    byPersonArray,
    sortConfig.byPerson.orderBy,
    sortConfig.byPerson.order
  );

  const totalMarginByPerson = byPersonArray.reduce((sum, item) => sum + item.grossMargin, 0);
  const totalRevenueByPerson = byPersonArray.reduce((sum, item) => sum + item.totalRevenue, 0);
  const totalMarginPercentByPerson = totalRevenueByPerson > 0 ? (totalMarginByPerson / totalRevenueByPerson) * 100 : 0;

  // Tab 4: By Client
  const byClient = processedData.reduce((acc, item) => {
    const key = item.ClientID;
    if (!key) return acc;

    if (!acc[key]) {
      acc[key] = {
        client: item.ClientName,
        totalRevenue: 0,
        totalCost: 0,
        totalCostObj: {},
      };
    }
    if (item.ContractType === 'Hourly' || (item.ContractType === 'Recurring' && !item.MonthlyFee)) {
      acc[key].totalRevenue += item.totalAmount;
    } else {
      acc[key].totalRevenue += 0;
    }
    
    acc[key].totalCostObj[item.ConsultantID] = item.cost || 0;
    acc[key].clientId = key;
    return acc;
  }, {});

  const byClientArray = Object.values(byClient).map(item => {
    const lineItems = processedData.filter(i => i.ClientID === item.clientId);
    const revenueByContracts = {};
    lineItems.forEach(i => {
      if (i.ContractType !== 'Hourly') {
        if (!revenueByContracts[i.ContractID]) {
          revenueByContracts[i.ContractID] = i.contractRevenue || 0;
        }
      }
    });
    item.totalRevenue = item.totalRevenue + Object.values(revenueByContracts).reduce((sum, i) => sum + i, 0);
    item.totalCost = Object.values(item.totalCostObj).reduce((sum, i) => sum + i, 0);
    return {
      ...item,
      grossMargin: item.totalRevenue - item.totalCost,
      marginPercent: item.totalRevenue > 0 ? ((item.totalRevenue - item.totalCost) / item.totalRevenue) * 100 : 0,
    }
  });
  const byClientArraySorted = sortData(
    byClientArray,
    sortConfig.byClient.orderBy,
    sortConfig.byClient.order
  );

  const totalMarginByClient = byClientArray.reduce((sum, item) => sum + item.grossMargin, 0);
  const totalRevenueByClient = byClientArray.reduce((sum, item) => sum + item.totalRevenue, 0);
  const totalMarginPercentByClient = totalRevenueByClient > 0 ? (totalMarginByClient / totalRevenueByClient) * 100 : 0;

  // Tab 5: By Role
  const byRole = processedData.reduce((acc, item) => {
    const role = (item.Role || 'Unknown').trim();
    if (!acc[role]) {
      acc[role] = {
        role,
        totalRevenue: 0,
        totalCost: 0,
      };
    }
    acc[role].totalRevenue += item.totalAmount;
    acc[role].totalCost += item.cost;
    return acc;
  }, {});

  const byRoleArray = Object.values(byRole).map(item => ({
    ...item,
    grossMargin: item.totalRevenue - item.totalCost,
    marginPercent: item.totalRevenue > 0 ? ((item.totalRevenue - item.totalCost) / item.totalRevenue) * 100 : 0,
  }));
  const byRoleArraySorted = sortData(
    byRoleArray,
    sortConfig.byRole.orderBy,
    sortConfig.byRole.order
  );

  const totalMarginByRole = byRoleArray.reduce((sum, item) => sum + item.grossMargin, 0);
  const totalRevenueByRole = byRoleArray.reduce((sum, item) => sum + item.totalRevenue, 0);
  const totalMarginPercentByRole = totalRevenueByRole > 0 ? (totalMarginByRole / totalRevenueByRole) * 100 : 0;

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatPercent = (value) => {
    return `${value.toFixed(1)}%`;
  };

  // Sorting helper function
  const handleSort = (table, field) => {
    const currentConfig = sortConfig[table];
    const newOrder = currentConfig.orderBy === field && currentConfig.order === 'asc' ? 'desc' : 'asc';
    setSortConfig({
      ...sortConfig,
      [table]: { orderBy: field, order: newOrder },
    });
  };

  const exportToExcel = () => {
    try {
      const workbook = XLSX.utils.book_new();
      const dateRange = getDateRange();
      const dateRangeStr = dateRange.startDate && dateRange.endDate 
        ? `${dayjs(dateRange.startDate).format('MM-DD-YYYY')}_to_${dayjs(dateRange.endDate).format('MM-DD-YYYY')}`
        : 'all_dates';

      // Sheet 1: Revenue by Line Item
      const lineItemData = revenueByLineItem.map(item => ({
        'Client': item.ClientName || '',
        'Line Item': item.StaffName || '',
        'Type': item.ContractType || 'Project',
        'Rate': item.ClientRate || 0,
        'Hours': item.TotalHours || 0,
        'Total Amount': item.totalAmount || 0,
        'Monthly Amount': item.monthlyAmount || 0,
        'Months Remaining': item.MonthsRemaining !== null ? item.MonthsRemaining : 'N/A',
        'Cost': item.cost || 0,
        'Gross Margin': item.grossMargin || 0,
        'Margin %': item.marginPercent || 0,
      }));
      const lineItemWS = XLSX.utils.json_to_sheet(lineItemData);
      XLSX.utils.book_append_sheet(workbook, lineItemWS, 'Revenue by Line Item');

      // Sheet 2: Revenue by Type
      const revenueByTypeData = revenueByTypeArray.map(item => ({
        'Billing Type': item.type || '',
        'Total Revenue': item.totalRevenue || 0,
        'Number of Line Items': item.lineItemCount || 0,
        '% of Total Revenue': item.percentOfTotal || 0,
      }));
      // Add total row
      revenueByTypeData.push({
        'Billing Type': 'TOTAL',
        'Total Revenue': totalRevenueByType,
        'Number of Line Items': revenueByTypeArray.reduce((sum, item) => sum + item.lineItemCount, 0),
        '% of Total Revenue': 100,
      });
      const revenueByTypeWS = XLSX.utils.json_to_sheet(revenueByTypeData);
      XLSX.utils.book_append_sheet(workbook, revenueByTypeWS, 'Revenue by Type');

      // Sheet 3: By Person
      const byPersonData = byPersonArray.map(item => ({
        'Name': item.name || '',
        'Role': item.role || '',
        'Total Revenue': item.totalRevenue || 0,
        'Total Cost': item.totalCost || 0,
        'Gross Margin': item.grossMargin || 0,
        'Margin %': item.marginPercent || 0,
      }));
      // Add total row
      byPersonData.push({
        'Name': 'TOTAL',
        'Role': '',
        'Total Revenue': totalRevenueByPerson,
        'Total Cost': byPersonArray.reduce((sum, item) => sum + item.totalCost, 0),
        'Gross Margin': totalMarginByPerson,
        'Margin %': totalMarginPercentByPerson,
      });
      const byPersonWS = XLSX.utils.json_to_sheet(byPersonData);
      XLSX.utils.book_append_sheet(workbook, byPersonWS, 'By Person');

      // Sheet 4: By Client
      const byClientData = byClientArray.map(item => ({
        'Client': item.client || '',
        'Total Revenue': item.totalRevenue || 0,
        'Total Cost': item.totalCost || 0,
        'Gross Margin': item.grossMargin || 0,
        'Margin %': item.marginPercent || 0,
      }));
      // Add total row
      byClientData.push({
        'Client': 'TOTAL',
        'Total Revenue': totalRevenueByClient,
        'Total Cost': byClientArray.reduce((sum, item) => sum + item.totalCost, 0),
        'Gross Margin': totalMarginByClient,
        'Margin %': totalMarginPercentByClient,
      });
      const byClientWS = XLSX.utils.json_to_sheet(byClientData);
      XLSX.utils.book_append_sheet(workbook, byClientWS, 'By Client');

      // Sheet 5: By Role
      const byRoleData = byRoleArray.map(item => ({
        'Role': item.role || '',
        'Total Revenue': item.totalRevenue || 0,
        'Total Cost': item.totalCost || 0,
        'Gross Margin': item.grossMargin || 0,
        'Margin %': item.marginPercent || 0,
      }));
      // Add total row
      byRoleData.push({
        'Role': 'TOTAL',
        'Total Revenue': totalRevenueByRole,
        'Total Cost': byRoleArray.reduce((sum, item) => sum + item.totalCost, 0),
        'Gross Margin': totalMarginByRole,
        'Margin %': totalMarginPercentByRole,
      });
      const byRoleWS = XLSX.utils.json_to_sheet(byRoleData);
      XLSX.utils.book_append_sheet(workbook, byRoleWS, 'By Role');

      // Generate filename with date range
      const filename = `Financial_Report_${dateRangeStr}_${dayjs().format('YYYY-MM-DD_HH-mm-ss')}.xlsx`;

      // Write the file
      XLSX.writeFile(workbook, filename);
      
      // Show success message
      setSnackbar({
        open: true,
        message: `Excel file "${filename}" downloaded successfully`,
        severity: 'success',
      });
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      setSnackbar({
        open: true,
        message: 'Error exporting to Excel. Please try again.',
        severity: 'error',
      });
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={3}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Fractional CFO Dashboard
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Comprehensive reporting for contract revenue and gross margins
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<FileDownloadIcon />}
          onClick={exportToExcel}
        >
          Export to Excel
        </Button>
      </Box>

      {/* Filters Section */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box display="flex" alignItems="center" gap={1}>
            <FilterListIcon />
            <Typography variant="h6">Filters</Typography>
          </Box>
          <Box display="flex" gap={1}>
            <Button
              size="small"
              onClick={clearFilters}
              startIcon={<ClearIcon />}
            >
              Clear All
            </Button>
            <IconButton
              size="small"
              onClick={() => setFiltersVisible(!filtersVisible)}
            >
              {filtersVisible ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
        </Box>

        <Collapse in={filtersVisible}>
          <Grid container spacing={2}>
            {/* Date Filter */}
            <Grid item xs={12} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Date Range</InputLabel>
                <Select
                  value={dateFilter}
                  label="Date Range"
                  onChange={(e) => setDateFilter(e.target.value)}
                >
                  <MenuItem value="noDate">Total</MenuItem>
                  <MenuItem value="custom">Custom Range</MenuItem>
                  <MenuItem value="currentMonth">Current Month</MenuItem>
                  <MenuItem value="lastMonth">Last Month</MenuItem>
                  <MenuItem value="currentQuarter">Current Quarter</MenuItem>
                  <MenuItem value="lastQuarter">Last Quarter</MenuItem>
                  <MenuItem value="yearToDate">Year to Date</MenuItem>
                  <MenuItem value="lastYear">Last Year</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {dateFilter === 'custom' && (
              <>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    size="small"
                    type="date"
                    label="Start Date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    size="small"
                    type="date"
                    label="End Date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
              </>
            )}

            {/* Client Filter */}
            <Grid item xs={12} md={4}>
              <Autocomplete
                multiple
                options={clients}
                getOptionLabel={(option) => option.ClientName || ''}
                value={selectedClients}
                onChange={(e, newValue) => setSelectedClients(newValue)}
                renderInput={(params) => (
                  <TextField {...params} label="Clients" size="small" />
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      label={option.ClientName}
                      {...getTagProps({ index })}
                      size="small"
                    />
                  ))
                }
              />
            </Grid>

            {/* Staff Filter */}
            <Grid item xs={12} md={4}>
              <Autocomplete
                multiple
                options={staff}
                getOptionLabel={(option) => `${option.FirstName} ${option.LastName}`}
                value={selectedStaff}
                onChange={(e, newValue) => setSelectedStaff(newValue)}
                renderInput={(params) => (
                  <TextField {...params} label="Staff" size="small" />
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      label={`${option.FirstName} ${option.LastName}`}
                      {...getTagProps({ index })}
                      size="small"
                    />
                  ))
                }
              />
            </Grid>
          </Grid>
        </Collapse>
      </Paper>

      {/* Tabs */}
      <Paper sx={{ mt: 3 }}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab label="Revenue by Line Item" />
          <Tab label="Revenue by Type" />
          <Tab label="By Person" />
          <Tab label="By Client" />
          <Tab label="By Role" />
        </Tabs>

        <Box sx={{ p: 3 }}>
          {/* Tab 1: Revenue by Line Item */}
          {activeTab === 0 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Revenue by Line Item
              </Typography>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                {dateFilter === 'noDate' ? 'Total' : ''} Revenue: {formatCurrency(revenueByLineItemSorted.reduce((sum, item) => sum + item.totalAmount, 0))}
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>
                        <TableSortLabel
                          active={sortConfig.lineItem.orderBy === 'ClientName'}
                          direction={sortConfig.lineItem.orderBy === 'ClientName' ? sortConfig.lineItem.order : 'asc'}
                          onClick={() => handleSort('lineItem', 'ClientName')}
                        >
                          Client
                        </TableSortLabel>
                      </TableCell>
                      <TableCell>
                        <TableSortLabel
                          active={sortConfig.lineItem.orderBy === 'StaffName'}
                          direction={sortConfig.lineItem.orderBy === 'StaffName' ? sortConfig.lineItem.order : 'asc'}
                          onClick={() => handleSort('lineItem', 'StaffName')}
                        >
                          Line Item
                        </TableSortLabel>
                      </TableCell>
                      <TableCell>
                        <TableSortLabel
                          active={sortConfig.lineItem.orderBy === 'ContractType'}
                          direction={sortConfig.lineItem.orderBy === 'ContractType' ? sortConfig.lineItem.order : 'asc'}
                          onClick={() => handleSort('lineItem', 'ContractType')}
                        >
                          Type
                        </TableSortLabel>
                      </TableCell>
                      <TableCell align="right">
                        <TableSortLabel
                          active={sortConfig.lineItem.orderBy === 'ClientRate'}
                          direction={sortConfig.lineItem.orderBy === 'ClientRate' ? sortConfig.lineItem.order : 'asc'}
                          onClick={() => handleSort('lineItem', 'ClientRate')}
                        >
                          Rate
                        </TableSortLabel>
                      </TableCell>
                      <TableCell align="right">
                        <TableSortLabel
                          active={sortConfig.lineItem.orderBy === 'TotalHours'}
                          direction={sortConfig.lineItem.orderBy === 'TotalHours' ? sortConfig.lineItem.order : 'asc'}
                          onClick={() => handleSort('lineItem', 'TotalHours')}
                        >
                          Hours
                        </TableSortLabel>
                      </TableCell>
                      <TableCell align="right">
                        <TableSortLabel
                          active={sortConfig.lineItem.orderBy === 'totalAmount'}
                          direction={sortConfig.lineItem.orderBy === 'totalAmount' ? sortConfig.lineItem.order : 'asc'}
                          onClick={() => handleSort('lineItem', 'totalAmount')}
                        >
                          {dateFilter === 'noDate' ? 'Total ' : ''}Amount
                        </TableSortLabel>
                      </TableCell>
                      <TableCell align="right">
                        <TableSortLabel
                          active={sortConfig.lineItem.orderBy === 'monthlyAmount'}
                          direction={sortConfig.lineItem.orderBy === 'monthlyAmount' ? sortConfig.lineItem.order : 'asc'}
                          onClick={() => handleSort('lineItem', 'monthlyAmount')}
                        >
                          Monthly Amount
                        </TableSortLabel>
                      </TableCell>
                      <TableCell align="right">
                        <TableSortLabel
                          active={sortConfig.lineItem.orderBy === 'MonthsRemaining'}
                          direction={sortConfig.lineItem.orderBy === 'MonthsRemaining' ? sortConfig.lineItem.order : 'asc'}
                          onClick={() => handleSort('lineItem', 'MonthsRemaining')}
                        >
                          Months Remaining
                        </TableSortLabel>
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {revenueByLineItemSorted.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{item.ClientName}</TableCell>
                        <TableCell>{item.StaffName}</TableCell>
                        <TableCell>{item.ContractType || 'Project'}</TableCell>
                        <TableCell align="right">{formatCurrency(item.ClientRate)}</TableCell>
                        <TableCell align="right">{item.TotalHours.toFixed(1)}</TableCell>
                        <TableCell align="right">{formatCurrency(item.totalAmount)}</TableCell>
                        <TableCell align="right">{formatCurrency(item.monthlyAmount)}</TableCell>
                        <TableCell align="right">{item.MonthsRemaining !== null ? item.MonthsRemaining : 'N/A'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* Tab 2: Revenue by Type */}
          {activeTab === 1 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Revenue by Billing Type
              </Typography>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                {dateFilter === 'noDate' ? 'Total' : ''} Revenue: {formatCurrency(totalRevenueByType)}
              </Typography>
              <TableContainer sx={{ mb: 3 }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>
                        <TableSortLabel
                          active={sortConfig.byType.orderBy === 'type'}
                          direction={sortConfig.byType.orderBy === 'type' ? sortConfig.byType.order : 'asc'}
                          onClick={() => handleSort('byType', 'type')}
                        >
                          Billing Type
                        </TableSortLabel>
                      </TableCell>
                      <TableCell align="right">
                        <TableSortLabel
                          active={sortConfig.byType.orderBy === 'totalRevenue'}
                          direction={sortConfig.byType.orderBy === 'totalRevenue' ? sortConfig.byType.order : 'asc'}
                          onClick={() => handleSort('byType', 'totalRevenue')}
                        >
                          {dateFilter === 'noDate' ? 'Total ' : ''}Revenue
                        </TableSortLabel>
                      </TableCell>
                      <TableCell align="right">
                        <TableSortLabel
                          active={sortConfig.byType.orderBy === 'lineItemCount'}
                          direction={sortConfig.byType.orderBy === 'lineItemCount' ? sortConfig.byType.order : 'asc'}
                          onClick={() => handleSort('byType', 'lineItemCount')}
                        >
                          Number of Line Items
                        </TableSortLabel>
                      </TableCell>
                      <TableCell align="right">
                        <TableSortLabel
                          active={sortConfig.byType.orderBy === 'percentOfTotal'}
                          direction={sortConfig.byType.orderBy === 'percentOfTotal' ? sortConfig.byType.order : 'asc'}
                          onClick={() => handleSort('byType', 'percentOfTotal')}
                        >
                          % of {dateFilter === 'noDate' ? 'Total ' : ''}Revenue
                        </TableSortLabel>
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {revenueByTypeArraySorted.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{item.type}</TableCell>
                        <TableCell align="right">{formatCurrency(item.totalRevenue)}</TableCell>
                        <TableCell align="right">{item.lineItemCount}</TableCell>
                        <TableCell align="right">{formatPercent(item.percentOfTotal)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* Tab 3: By Person */}
          {activeTab === 2 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Gross Margin by Person
              </Typography>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                {dateFilter === 'noDate' ? 'Total ' : ''}Margin: {formatCurrency(totalMarginByPerson)} ({formatPercent(totalMarginPercentByPerson)})
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>
                        <TableSortLabel
                          active={sortConfig.byPerson.orderBy === 'name'}
                          direction={sortConfig.byPerson.orderBy === 'name' ? sortConfig.byPerson.order : 'asc'}
                          onClick={() => handleSort('byPerson', 'name')}
                        >
                          Name
                        </TableSortLabel>
                      </TableCell>
                      <TableCell>
                        <TableSortLabel
                          active={sortConfig.byPerson.orderBy === 'role'}
                          direction={sortConfig.byPerson.orderBy === 'role' ? sortConfig.byPerson.order : 'asc'}
                          onClick={() => handleSort('byPerson', 'role')}
                        >
                          Role
                        </TableSortLabel>
                      </TableCell>
                      <TableCell align="right">
                        <TableSortLabel
                          active={sortConfig.byPerson.orderBy === 'totalRevenue'}
                          direction={sortConfig.byPerson.orderBy === 'totalRevenue' ? sortConfig.byPerson.order : 'asc'}
                          onClick={() => handleSort('byPerson', 'totalRevenue')}
                        >
                          {dateFilter === 'noDate' ? 'Total ' : ''}Revenue
                        </TableSortLabel>
                      </TableCell>
                      <TableCell align="right">
                        <TableSortLabel
                          active={sortConfig.byPerson.orderBy === 'totalCost'}
                          direction={sortConfig.byPerson.orderBy === 'totalCost' ? sortConfig.byPerson.order : 'asc'}
                          onClick={() => handleSort('byPerson', 'totalCost')}
                        >
                          {dateFilter === 'noDate' ? 'Total ' : ''}Cost
                        </TableSortLabel>
                      </TableCell>
                      <TableCell align="right">
                        <TableSortLabel
                          active={sortConfig.byPerson.orderBy === 'grossMargin'}
                          direction={sortConfig.byPerson.orderBy === 'grossMargin' ? sortConfig.byPerson.order : 'asc'}
                          onClick={() => handleSort('byPerson', 'grossMargin')}
                        >
                          Gross Margin
                        </TableSortLabel>
                      </TableCell>
                      <TableCell align="right">
                        <TableSortLabel
                          active={sortConfig.byPerson.orderBy === 'marginPercent'}
                          direction={sortConfig.byPerson.orderBy === 'marginPercent' ? sortConfig.byPerson.order : 'asc'}
                          onClick={() => handleSort('byPerson', 'marginPercent')}
                        >
                          Margin %
                        </TableSortLabel>
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {byPersonArraySorted.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{item.name}</TableCell>
                        <TableCell>{item.role}</TableCell>
                        <TableCell align="right">{formatCurrency(item.totalRevenue)}</TableCell>
                        <TableCell align="right">{formatCurrency(item.totalCost)}</TableCell>
                        <TableCell align="right">{formatCurrency(item.grossMargin)}</TableCell>
                        <TableCell align="right">{formatPercent(item.marginPercent)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* Tab 4: By Client */}
          {activeTab === 3 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Gross Margin by Client
              </Typography>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                {dateFilter === 'noDate' ? 'Total ' : ''}Margin: {formatCurrency(totalMarginByClient)} ({formatPercent(totalMarginPercentByClient)})
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>
                        <TableSortLabel
                          active={sortConfig.byClient.orderBy === 'client'}
                          direction={sortConfig.byClient.orderBy === 'client' ? sortConfig.byClient.order : 'asc'}
                          onClick={() => handleSort('byClient', 'client')}
                        >
                          Client
                        </TableSortLabel>
                      </TableCell>
                      <TableCell align="right">
                        <TableSortLabel
                          active={sortConfig.byClient.orderBy === 'totalRevenue'}
                          direction={sortConfig.byClient.orderBy === 'totalRevenue' ? sortConfig.byClient.order : 'asc'}
                          onClick={() => handleSort('byClient', 'totalRevenue')}
                        >
                          {dateFilter === 'noDate' ? 'Total ' : ''}Revenue
                        </TableSortLabel>
                      </TableCell>
                      <TableCell align="right">
                        <TableSortLabel
                          active={sortConfig.byClient.orderBy === 'totalCost'}
                          direction={sortConfig.byClient.orderBy === 'totalCost' ? sortConfig.byClient.order : 'asc'}
                          onClick={() => handleSort('byClient', 'totalCost')}
                        >
                          {dateFilter === 'noDate' ? 'Total ' : ''}Cost
                        </TableSortLabel>
                      </TableCell>
                      <TableCell align="right">
                        <TableSortLabel
                          active={sortConfig.byClient.orderBy === 'grossMargin'}
                          direction={sortConfig.byClient.orderBy === 'grossMargin' ? sortConfig.byClient.order : 'asc'}
                          onClick={() => handleSort('byClient', 'grossMargin')}
                        >
                          Gross Margin
                        </TableSortLabel>
                      </TableCell>
                      <TableCell align="right">
                        <TableSortLabel
                          active={sortConfig.byClient.orderBy === 'marginPercent'}
                          direction={sortConfig.byClient.orderBy === 'marginPercent' ? sortConfig.byClient.order : 'asc'}
                          onClick={() => handleSort('byClient', 'marginPercent')}
                        >
                          Margin %
                        </TableSortLabel>
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {byClientArraySorted.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{item.client}</TableCell>
                        <TableCell align="right">{formatCurrency(item.totalRevenue)}</TableCell>
                        <TableCell align="right">{formatCurrency(item.totalCost)}</TableCell>
                        <TableCell align="right">{formatCurrency(item.grossMargin)}</TableCell>
                        <TableCell align="right">{formatPercent(item.marginPercent)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* Tab 5: By Role */}
          {activeTab === 4 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Gross Margin by Role
              </Typography>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                {dateFilter === 'noDate' ? 'Total ' : ''}Margin: {formatCurrency(totalMarginByRole)} ({formatPercent(totalMarginPercentByRole)})
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>
                        <TableSortLabel
                          active={sortConfig.byRole.orderBy === 'role'}
                          direction={sortConfig.byRole.orderBy === 'role' ? sortConfig.byRole.order : 'asc'}
                          onClick={() => handleSort('byRole', 'role')}
                        >
                          Role
                        </TableSortLabel>
                      </TableCell>
                      <TableCell align="right">
                        <TableSortLabel
                          active={sortConfig.byRole.orderBy === 'totalRevenue'}
                          direction={sortConfig.byRole.orderBy === 'totalRevenue' ? sortConfig.byRole.order : 'asc'}
                          onClick={() => handleSort('byRole', 'totalRevenue')}
                        >
                          {dateFilter === 'noDate' ? 'Total ' : ''}Revenue
                        </TableSortLabel>
                      </TableCell>
                      <TableCell align="right">
                        <TableSortLabel
                          active={sortConfig.byRole.orderBy === 'totalCost'}
                          direction={sortConfig.byRole.orderBy === 'totalCost' ? sortConfig.byRole.order : 'asc'}
                          onClick={() => handleSort('byRole', 'totalCost')}
                        >
                          {dateFilter === 'noDate' ? 'Total ' : ''}Cost
                        </TableSortLabel>
                      </TableCell>
                      <TableCell align="right">
                        <TableSortLabel
                          active={sortConfig.byRole.orderBy === 'grossMargin'}
                          direction={sortConfig.byRole.orderBy === 'grossMargin' ? sortConfig.byRole.order : 'asc'}
                          onClick={() => handleSort('byRole', 'grossMargin')}
                        >
                          Gross Margin
                        </TableSortLabel>
                      </TableCell>
                      <TableCell align="right">
                        <TableSortLabel
                          active={sortConfig.byRole.orderBy === 'marginPercent'}
                          direction={sortConfig.byRole.orderBy === 'marginPercent' ? sortConfig.byRole.order : 'asc'}
                          onClick={() => handleSort('byRole', 'marginPercent')}
                        >
                          Margin %
                        </TableSortLabel>
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {byRoleArraySorted.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{item.role}</TableCell>
                        <TableCell align="right">{formatCurrency(item.totalRevenue)}</TableCell>
                        <TableCell align="right">{formatCurrency(item.totalCost)}</TableCell>
                        <TableCell align="right">{formatCurrency(item.grossMargin)}</TableCell>
                        <TableCell align="right">{formatPercent(item.marginPercent)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </Box>
      </Paper>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity} 
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default FinancialReportingPage;

