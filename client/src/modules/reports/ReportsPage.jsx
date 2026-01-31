import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Switch,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  CircularProgress,
  TextField,
  FormControlLabel,
  Divider,
} from '@mui/material';
import dayjs from 'dayjs';
import { useLocation, useNavigate } from 'react-router-dom';
import { getClients, getActiveClients } from '../../api/clients';
import { getActiveConsultants, getConsultants } from '../../api/consultants';
import PerformanceTab from './components/PerformanceTab';
import ClientHealthTab from './components/ClientHealthTab';
import ConsultantUtilizationTab from './components/ConsultantUtilizationTab';
import TrendsTab from './components/TrendsTab';
import IssuesQueueTab from './components/IssuesQueueTab';
import ContractsTab from './components/ContractsTab';
import ClientActivityTab from './components/ClientActivityTab';
import SettingsTab from './components/SettingsTab';
import WeeklyReviewTab from './components/WeeklyReviewTab';
import CapacityPlanningTab from './components/CapacityPlanningTab';

const PERIODS = [
  { value: 'thisMonth', label: 'This Month' },
  { value: 'lastMonth', label: 'Last Month' },
  { value: 'nextMonth', label: 'Next Month' },
  { value: 'thisQuarter', label: 'This Quarter' },
  { value: 'lastQuarter', label: 'Last Quarter' },
  { value: 'thisYear', label: 'This Year' },
  { value: 'custom', label: 'Custom Range' },
];

const AS_OF_PRESETS = [
  { value: 'today', label: 'Today' },
  { value: 'periodStart', label: 'Start of Period' },
  { value: 'periodEnd', label: 'End of Period' },
  { value: 'custom', label: 'Custom Date' },
];

const ReportsPage = () => {
  const [activeTab, setActiveTab] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();

  // NOTE: TAB_KEYS must match the visual tab order below for deep-linking + URL persistence to work correctly.
  const TAB_KEYS = ['performance', 'client-health', 'consultant-utilization', 'trends', 'issues', 'weekly-review', 'capacity-planning', 'contracts', 'client-activity', 'settings'];
  const tabKeyToIndex = useMemo(() => TAB_KEYS.reduce((m, k, idx) => (m[k] = idx, m), {}), []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab && tabKeyToIndex[tab] != null) {
      setActiveTab(tabKeyToIndex[tab]);
    }
  }, [location.search, tabKeyToIndex]);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    const params = new URLSearchParams(location.search);
    params.set('tab', TAB_KEYS[newValue] || TAB_KEYS[0]);
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
  };

  // Global filters
  const [businessDaysOnly, setBusinessDaysOnly] = useState(true);
  const [includeSubmitted, setIncludeSubmitted] = useState(false);

  const [period, setPeriod] = useState('thisMonth');
  const [customStartDate, setCustomStartDate] = useState(dayjs().startOf('month').format('YYYY-MM-DD'));
  const [customEndDate, setCustomEndDate] = useState(dayjs().endOf('month').format('YYYY-MM-DD'));

  const [asOfPreset, setAsOfPreset] = useState('today');
  const [asOfDate, setAsOfDate] = useState(dayjs().format('YYYY-MM-DD'));

  const [activeOnlyClients, setActiveOnlyClients] = useState(true);
  const [activeOnlyConsultants, setActiveOnlyConsultants] = useState(true);

  const [selectedClient, setSelectedClient] = useState('all');
  const [selectedConsultant, setSelectedConsultant] = useState('all');
  const [selectedRole, setSelectedRole] = useState('all');

  const [clients, setClients] = useState([]);
  const [consultants, setConsultants] = useState([]);
  const [loading, setLoading] = useState(true);

  // Date range derived from "period" + custom dates
  const dateRange = useMemo(() => {
    const now = dayjs();
    let start;
    let end;

    switch (period) {
      case 'thisMonth':
        start = now.startOf('month');
        end = now.endOf('month');
        break;
      case 'lastMonth':
        start = now.subtract(1, 'month').startOf('month');
        end = now.subtract(1, 'month').endOf('month');
        break;
      case 'nextMonth':
        start = now.add(1, 'month').startOf('month');
        end = now.add(1, 'month').endOf('month');
        break;
      case 'thisQuarter':
        start = now.startOf('quarter');
        end = now.endOf('quarter');
        break;
      case 'lastQuarter':
        start = now.subtract(1, 'quarter').startOf('quarter');
        end = now.subtract(1, 'quarter').endOf('quarter');
        break;
      case 'thisYear':
        start = now.startOf('year');
        end = now.endOf('year');
        break;
      case 'custom':
      default:
        start = dayjs(customStartDate).isValid() ? dayjs(customStartDate) : now.startOf('month');
        end = dayjs(customEndDate).isValid() ? dayjs(customEndDate) : now.endOf('month');
        break;
    }

    return {
      startDate: start.format('YYYY-MM-DD'),
      endDate: end.format('YYYY-MM-DD'),
    };
  }, [period, customStartDate, customEndDate]);

  // Keep as-of in range and keep preset behavior consistent
  useEffect(() => {
    const start = dayjs(dateRange.startDate);
    const end = dayjs(dateRange.endDate);
    const today = dayjs().startOf('day');

    // If user switches to a past period, default as-of to end of that period.
    if (period === 'lastMonth' || period === 'lastQuarter' || period === 'thisYear') {
      if (asOfPreset === 'today') {
        setAsOfPreset('periodEnd');
        setAsOfDate(end.format('YYYY-MM-DD'));
        return;
      }
    }

    // Apply preset
    if (asOfPreset === 'today') {
      // clamp today into the period range
      const clamped = today.isBefore(start, 'day') ? start : (today.isAfter(end, 'day') ? end : today);
      setAsOfDate(clamped.format('YYYY-MM-DD'));
      return;
    }
    if (asOfPreset === 'periodStart') {
      setAsOfDate(start.format('YYYY-MM-DD'));
      return;
    }
    if (asOfPreset === 'periodEnd') {
      setAsOfDate(end.format('YYYY-MM-DD'));
      return;
    }

    // Custom preset: validate and clamp
    const asOf = dayjs(asOfDate);
    if (!asOf.isValid()) {
      setAsOfDate(end.format('YYYY-MM-DD'));
      return;
    }
    if (asOf.isBefore(start, 'day')) setAsOfDate(start.format('YYYY-MM-DD'));
    else if (asOf.isAfter(end, 'day')) setAsOfDate(end.format('YYYY-MM-DD'));
  }, [dateRange.startDate, dateRange.endDate, period, asOfPreset]);

  // Load dropdown sources (clients, consultants)
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [clientsData, consultantsData] = await Promise.all([
          activeOnlyClients ? getActiveClients() : getClients(),
          activeOnlyConsultants ? getActiveConsultants() : getConsultants(),
        ]);

        const sortedClients = (clientsData || [])
          .slice()
          .sort((a, b) => String(a.ClientName || '').localeCompare(String(b.ClientName || '')));

        const sortedConsultants = (consultantsData || [])
          .slice()
          .sort((a, b) => {
            const la = String(a.LastName || '');
            const lb = String(b.LastName || '');
            const cmp = la.localeCompare(lb);
            if (cmp !== 0) return cmp;
            return String(a.FirstName || '').localeCompare(String(b.FirstName || ''));
          });

        setClients(sortedClients);
        setConsultants(sortedConsultants);

        // If current selections are no longer available, reset to all
        if (selectedClient !== 'all' && !sortedClients.some(c => c.ClientID === selectedClient)) {
          setSelectedClient('all');
        }
        if (selectedConsultant !== 'all' && !sortedConsultants.some(c => c.ConsultantID === selectedConsultant)) {
          setSelectedConsultant('all');
        }
      } catch (error) {
        console.error('Error loading reports filters:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOnlyClients, activeOnlyConsultants]);

  const filters = useMemo(() => {
    return {
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      asOfDate,
      clientIds: selectedClient !== 'all'
        ? [selectedClient]
        : (activeOnlyClients ? clients.map(c => c.ClientID) : []),
      consultantIds: selectedConsultant !== 'all'
        ? [selectedConsultant]
        : (activeOnlyConsultants ? consultants.map(c => c.ConsultantID) : []),
      role: selectedRole !== 'all' ? selectedRole : null,
      includeSubmitted,
      businessDaysOnly,
    };
  }, [dateRange.startDate, dateRange.endDate, asOfDate, selectedClient, selectedConsultant, selectedRole, includeSubmitted, businessDaysOnly, activeOnlyClients, activeOnlyConsultants, clients, consultants]);

  const invalidCustomRange = period === 'custom' && dayjs(customStartDate).isValid() && dayjs(customEndDate).isValid()
    ? dayjs(customEndDate).isBefore(dayjs(customStartDate), 'day')
    : false;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: '#f5f5f5' }}>
      {/* Header */}
      <Box sx={{ bgcolor: '#ffffff', p: 2, borderBottom: '1px solid #e0e0e0' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            Reports
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <FormControlLabel
              control={
                <Switch
                  checked={businessDaysOnly}
                  onChange={(e) => setBusinessDaysOnly(e.target.checked)}
                  size="small"
                />
              }
              label={businessDaysOnly ? 'Business Days' : 'All Days'}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={includeSubmitted}
                  onChange={(e) => setIncludeSubmitted(e.target.checked)}
                  size="small"
                />
              }
              label={includeSubmitted ? 'Include Submitted (Preview)' : 'Approved Only'}
            />
          </Box>
        </Box>

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="Performance" />
          <Tab label="Client Health" />
          <Tab label="Consultant Utilization" />
          <Tab label="Trends" />
          <Tab label="Issues Queue" />
          <Tab label="Weekly Review" />
          <Tab label="Capacity Planning" />
          <Tab label="Contracts" />
            <Tab label="Client Activity" />
          <Tab label="Settings" />
        </Tabs>

        {/* Filters */}
        <Box sx={{ display: 'flex', gap: 2, mt: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Period</InputLabel>
            <Select
              value={period}
              label="Period"
              onChange={(e) => setPeriod(e.target.value)}
            >
              {PERIODS.map(p => (
                <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {period === 'custom' && (
            <>
              <TextField
                size="small"
                label="Start"
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                error={invalidCustomRange}
              />
              <TextField
                size="small"
                label="End"
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                error={invalidCustomRange}
                helperText={invalidCustomRange ? 'End must be on/after Start' : ''}
              />
            </>
          )}

          <Divider flexItem orientation="vertical" sx={{ mx: 0.5 }} />

          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>As-of (cutoff)</InputLabel>
            <Select
              value={asOfPreset}
              label="As-of (cutoff)"
              onChange={(e) => setAsOfPreset(e.target.value)}
            >
              {AS_OF_PRESETS.map(p => (
                <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            size="small"
            label="As-of Date"
            type="date"
            value={asOfDate}
            onChange={(e) => {
              setAsOfPreset('custom');
              setAsOfDate(e.target.value);
            }}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 170 }}
          />

          <Divider flexItem orientation="vertical" sx={{ mx: 0.5 }} />

          <FormControlLabel
            control={
              <Switch
                checked={activeOnlyClients}
                onChange={(e) => setActiveOnlyClients(e.target.checked)}
                size="small"
              />
            }
            label={activeOnlyClients ? 'Active Clients Only' : 'All Clients'}
          />

          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Client</InputLabel>
            <Select
              value={selectedClient}
              label="Client"
              onChange={(e) => setSelectedClient(e.target.value)}
            >
              <MenuItem value="all">All</MenuItem>
              {clients.map((client) => (
                <MenuItem key={client.ClientID} value={client.ClientID}>
                  {client.ClientName}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControlLabel
            control={
              <Switch
                checked={activeOnlyConsultants}
                onChange={(e) => setActiveOnlyConsultants(e.target.checked)}
                size="small"
              />
            }
            label={activeOnlyConsultants ? 'Active Consultants Only' : 'All Consultants'}
          />

          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel>Consultant</InputLabel>
            <Select
              value={selectedConsultant}
              label="Consultant"
              onChange={(e) => setSelectedConsultant(e.target.value)}
            >
              <MenuItem value="all">All</MenuItem>
              {consultants.map((consultant) => (
                <MenuItem key={consultant.ConsultantID} value={consultant.ConsultantID}>
                  {consultant.LastName}, {consultant.FirstName}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel>Role</InputLabel>
            <Select
              value={selectedRole}
              label="Role"
              onChange={(e) => setSelectedRole(e.target.value)}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="CFO">CFO</MenuItem>
              <MenuItem value="Controller">Controller</MenuItem>
              <MenuItem value="Senior Accountant">Senior Accountant</MenuItem>
              <MenuItem value="Staff Accountant">Staff Accountant</MenuItem>
              <MenuItem value="Other">Other</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Box>

      {/* Tab Content */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {activeTab === 0 && <PerformanceTab filters={filters} />}
        {activeTab === 1 && <ClientHealthTab filters={filters} />}
        {activeTab === 2 && <ConsultantUtilizationTab filters={filters} />}
        {activeTab === 3 && <TrendsTab filters={filters} />}
        {activeTab === 4 && <IssuesQueueTab filters={filters} />}
        {activeTab === 5 && <WeeklyReviewTab filters={filters} />}
        {activeTab === 6 && <CapacityPlanningTab filters={filters} />}
        {activeTab === 7 && <ContractsTab filters={filters} />}
        {activeTab === 8 && (
          <ClientActivityTab
            clients={clients}
          />
        )}
        {activeTab === 9 && <SettingsTab />}
      </Box>
    </Box>
  );
};

export default ReportsPage;
