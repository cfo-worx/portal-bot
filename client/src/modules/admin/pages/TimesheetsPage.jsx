// frontend/src/modules/approver/pages/TimesheetsPage.jsx

import React, { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import {
  Box,
  Card,
  Checkbox,
  Grid,
  IconButton,
  ListItemText,
  MenuItem,
  Select,
  Tooltip,
  Typography,
} from '@mui/material';
import ArrowLeftIcon from '@mui/icons-material/ArrowLeft';
import ArrowRightIcon from '@mui/icons-material/ArrowRight';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { getTimecardLinesWithDetails } from '../../../api/timecards';
import TimesheetDayModal from './TimesheetDayModal';

dayjs.extend(utc);


const getConsultantName = (line = {}) => {
    // If the backend ever aliases it as ConsultantName, use that
    if (line.ConsultantName) return line.ConsultantName.trim();
  
    // Build it from separate columns (what you have today)
    const first = line.FirstName || '';
    const last  = line.LastName  || '';
    return `${first} ${last}`.trim();
  };

// Colors for each status bucket.
const statusColors = {
  approved: '#006400',
  open: '#000080',
  rejected: '#8B0000',
  submitted: '#555555',
};

// Order of status bars.
const statusOrder = ['open', 'submitted', 'rejected', 'approved'];

const TimesheetsPage = () => {
  const [allLines, setAllLines] = useState([]);
  const [monthLines, setMonthLines] = useState([]);
  const [clients, setClients] = useState([]);
  const [consultants, setConsultants] = useState([]);

  const [selectedClient, setSelectedClient] = useState('');
  const [selectedConsultants, setSelectedConsultants] = useState([]);

  const [currentMonth, setCurrentMonth] = useState(dayjs());
  const [linesByDate, setLinesByDate] = useState({});
  const [selectedDate, setSelectedDate] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(false);

  // 1) Fetch all lines once
  useEffect(() => {
    (async () => {
      try {
        const data = await getTimecardLinesWithDetails();
        setAllLines(data);
      } catch (err) {
        console.error('Error fetching timecard lines:', err);
      }
    })();
  }, []);

  // 2) Filter to current month, exclude "open"
  useEffect(() => {
    const filtered = allLines.filter(line => {
      const d = dayjs(line.TimesheetDate).add(1, 'day');
      return (
        d.year() === currentMonth.year() &&
        d.month() === currentMonth.month() &&
        line.Status.toLowerCase() !== 'open'
      );
    });
    setMonthLines(filtered);
  }, [allLines, currentMonth]);

  // 3) Build unique, sorted lists of clients & consultants (full names)
  useEffect(() => {
    const clientSet = new Set();
    const consultantSet = new Set();

    monthLines.forEach(line => {
      if (line.ClientName) {
        clientSet.add(line.ClientName);
      }
      const fullName = getConsultantName(line);
      if (fullName) {
        consultantSet.add(fullName);
      }
    });

    setClients(Array.from(clientSet).sort((a, b) => a.localeCompare(b)));
    setConsultants(Array.from(consultantSet).sort((a, b) => a.localeCompare(b)));
  }, [monthLines]);

  // 4) Group lines by date, applying client/consultant filters
  useEffect(() => {
    const agg = {};
    monthLines
      .filter(line => {
        if (selectedClient && line.ClientName !== selectedClient) return false;
        const fullName = getConsultantName(line);
        if (
          selectedConsultants.length > 0 &&
          !selectedConsultants.includes(fullName)
        ) {
          return false;
        }
        return true;
      })
      .forEach(line => {
        const key = dayjs(line.TimesheetDate).add(1, 'day').format('YYYY-MM-DD');
        if (!agg[key]) agg[key] = [];
        agg[key].push(line);
      });

    setLinesByDate(agg);
  }, [monthLines, selectedClient, selectedConsultants, refreshTrigger]);

  // Helpers
  const isFutureDay = day => day.startOf('day').isAfter(dayjs().startOf('day'));
  const handleDayClick = day => {
    if (!isFutureDay(day)) {
      setSelectedDate(day);
      setModalOpen(true);
    }
  };
  const handlePreviousMonth = () => setCurrentMonth(m => m.subtract(1, 'month'));
  const handleNextMonth     = () => setCurrentMonth(m => m.add(1, 'month'));
  const handleMonthChange   = e => setCurrentMonth(m => m.month(e.target.value - 1));
  const handleYearChange    = e => setCurrentMonth(m => m.year(e.target.value));

  // Sum hours by status for a given date
  const getStatusHoursForDate = day => {
    const key = day.format('YYYY-MM-DD');
    const lines = linesByDate[key] || [];
    const buckets = { open: 0, submitted: 0, rejected: 0, approved: 0 };
    lines.forEach(line => {
      const hrs =
        parseFloat(line.ClientFacingHours || 0) +
        parseFloat(line.NonClientFacingHours || 0) +
        parseFloat(line.OtherTaskHours || 0);
      const st = line.Status.toLowerCase();
      buckets[st] = (buckets[st] || 0) + hrs;
    });
    return buckets;
  };

  // Calendar calculations
  const daysInMonth  = currentMonth.daysInMonth();
  const startOfMonth = currentMonth.startOf('month');
  const years        = Array.from({ length: 11 }, (_, i) => dayjs().year() - 5 + i);

  return (
    <Box sx={{ p: 2 }}>
      {/* Navigation + Filters */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, flexWrap: 'wrap' }}>
        <IconButton onClick={handlePreviousMonth}>
          <ArrowLeftIcon />
        </IconButton>
        <Typography variant="h5" sx={{ mx: 2 }}>
          {currentMonth.format('MMMM YYYY')}
        </Typography>
        <IconButton onClick={handleNextMonth}>
          <ArrowRightIcon />
        </IconButton>

        <Box sx={{ ml: 'auto', display: 'flex', gap: 1, alignItems: 'center' }}>
          {/* Client dropdown */}
          <Select
            value={selectedClient}
            onChange={e => setSelectedClient(e.target.value)}
            displayEmpty
            size="small"
            sx={{ minWidth: 140 }}
          >
            <MenuItem value="">All Clients</MenuItem>
            {clients.map(client => (
              <MenuItem key={client} value={client}>
                {client}
              </MenuItem>
            ))}
          </Select>

          {/* Consultants multi-select */}
          <Select
            multiple
            value={selectedConsultants}
            onChange={e => setSelectedConsultants(e.target.value)}
             /* keep the label short so the box doesn’t grow */
  renderValue={vals => {
    if (vals.length === 0) return 'All Consultants';
    if (vals.length === 1) return vals[0];              // “Jane Doe”
    return `${vals[0]}, +${vals.length - 1}`;           // “Jane Doe, +2”
  }}
            size="small"
              sx={{
                 width: 180,                     /* fixed width, no more auto-stretch */
                 whiteSpace: 'nowrap',
                 overflow: 'hidden',
                 textOverflow: 'ellipsis',
               }}
          >
            {consultants.map(name => (
              <MenuItem key={name} value={name}>
                <Checkbox checked={selectedConsultants.includes(name)} />
                <ListItemText primary={name} />
              </MenuItem>
            ))}
          </Select>

          {/* Month & Year selectors */}
          <Select
            value={currentMonth.month() + 1}
            onChange={handleMonthChange}
            size="small"
            sx={{ zIndex: 10 }}
          >
            {Array.from({ length: 12 }).map((_, idx) => (
              <MenuItem key={idx} value={idx + 1}>
                {dayjs().month(idx).format('MMMM')}
              </MenuItem>
            ))}
          </Select>
          <Select
            value={currentMonth.year()}
            onChange={handleYearChange}
            size="small"
            sx={{ zIndex: 10 }}
          >
            {years.map(y => (
              <MenuItem key={y} value={y}>
                {y}
              </MenuItem>
            ))}
          </Select>
        </Box>
      </Box>

      {/* Legend */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2 }}>
        {statusOrder.map(s => (
          <Box key={s} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box
              sx={{
                width: 16,
                height: 16,
                backgroundColor: statusColors[s],
                borderRadius: 0.5,
              }}
            />
            <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Weekday Headers */}
      <Grid container>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <Grid item xs={1.71} key={d}>
            <Typography align="center" sx={{ fontWeight: 'bold' }}>
              {d}
            </Typography>
          </Grid>
        ))}
      </Grid>

      {/* Calendar Days */}
      <Grid container>
        {/* Leading blanks */}
        {Array.from({ length: startOfMonth.day() }).map((_, i) => (
          <Grid item xs={1.71} key={`blank-${i}`} />
        ))}

        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = startOfMonth.add(i, 'day');
          const future = isFutureDay(day);
          const hours = getStatusHoursForDate(day);

          return (
            <Grid item xs={1.71} key={i} sx={{ p: 0.5 }}>
              <Tooltip title={future ? 'Not Available' : 'View Details'} arrow>
                <Box sx={{ position: 'relative' }}>
                  <Card
                    onClick={() => handleDayClick(day)}
                    sx={{
                      height: 120,
                      p: 1,
                      backgroundColor: 'white',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      cursor: future ? 'not-allowed' : 'pointer',
                      opacity: future ? 0.7 : 1,
                      pointerEvents: future ? 'none' : 'auto',
                    }}
                  >
                    <Typography sx={{ fontWeight: 'bold' }}>
                      {day.date()}
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      {statusOrder.map(s => {
                        const h = hours[s];
                        return h > 0 ? (
                          <Box
                            key={s}
                            sx={{
                              backgroundColor: statusColors[s],
                              color: 'white',
                              borderRadius: 1,
                              height: 16,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.75rem',
                              px: 0.5,
                            }}
                          >
                            {h.toFixed(1)}
                          </Box>
                        ) : null;
                      })}
                    </Box>
                  </Card>
                  {future && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        width: 24,
                        height: 24,
                        backgroundColor: 'rgba(255,255,255,0.7)',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <LockOutlinedIcon fontSize="small" color="disabled" />
                    </Box>
                  )}
                </Box>
              </Tooltip>
            </Grid>
          );
        })}
      </Grid>

      {/* Timesheet Day Modal */}
      {selectedDate && (
        <TimesheetDayModal
          open={modalOpen}
          date={selectedDate}
          onClose={() => setModalOpen(false)}
          refreshTrigger={refreshTrigger}
          onTimeEntryChange={updated => {
            if (updated) setRefreshTrigger(prev => !prev);
          }}
          clientFilter={selectedClient}
          consultantFilter={selectedConsultants}
        />
      )}
    </Box>
  );
};

export default TimesheetsPage;
