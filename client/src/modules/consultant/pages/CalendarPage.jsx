// frontend/src/modules/consultant/pages/CalendarPage.jsx

import React, { useState, useEffect, useContext, useCallback } from 'react';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import {
  Grid,
  Card,
  Typography,
  Box,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
} from '@mui/material';
import ArrowLeftIcon from '@mui/icons-material/ArrowLeft';
import ArrowRightIcon from '@mui/icons-material/ArrowRight';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { getTimecardLinesByConsultantAndMonth } from '../../../api/timecards';
import { getCalendarLocked } from '../../../api/globalSettings';
import DayInfoModal from './DayInfoModal';
import { AuthContext } from '../../../context/AuthContext';

dayjs.extend(utc);

// Same status colors as before
const statusColors = {
  open: '#000080',      // Navy
  submitted: '#555555', // Dark Gray
  approved: '#006400',  // Dark Green
  rejected: '#8B0000',  // Dark Red
};

// The order in which status bars appear in each day card
const statusOrder = ['open', 'submitted', 'rejected', 'approved'];

const CalendarPage = () => {
  const { auth } = useContext(AuthContext);
  const consultantID = auth.user?.consultantId;

  // Track which month/year we’re showing
  const [currentMonth, setCurrentMonth] = useState(dayjs());
  const [timecardLines, setTimecardLines] = useState([]);

  // A quick lookup => { 'YYYY-MM-DD': [lines], ... }
  const [linesByDate, setLinesByDate] = useState({});

  // For DayInfoModal
  const [selectedDate, setSelectedDate] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Trigger to re-fetch month data
  const [refreshTrigger, setRefreshTrigger] = useState(false);

  // Global lock flag
  const [calendarLocked, setCalendarLocked] = useState(true);

  // Fetch global setting once
  useEffect(() => {
    (async () => {
      try {
        const locked = await getCalendarLocked();
        setCalendarLocked(locked);
      } catch (err) {
        console.error('Error fetching calendar lock setting:', err);
      }
    })();
  }, []);

  // 1) Fetch lines for the current month
  const fetchMonthData = useCallback(async () => {
    if (!consultantID) return;
    const month = currentMonth.month() + 1; // dayjs is 0-based
    const year = currentMonth.year();

    try {
      const data = await getTimecardLinesByConsultantAndMonth(consultantID, month, year);
      setTimecardLines(data);
    } catch (error) {
      console.error('Error fetching timecard lines for month:', error);
    }
  }, [consultantID, currentMonth]);

  useEffect(() => {
    fetchMonthData();
  }, [currentMonth, refreshTrigger, fetchMonthData]);

  // 2) Build linesByDate
  useEffect(() => {
    const aggregated = {};
    timecardLines.forEach((line) => {
      // Adjust to local to mitigate UTC shift
      const adjustedDate = dayjs.utc(line.TimesheetDate).add(12, 'hour').local();
      const dateKey = adjustedDate.format('YYYY-MM-DD');
      if (!aggregated[dateKey]) aggregated[dateKey] = [];
      aggregated[dateKey].push(line);
    });
    setLinesByDate(aggregated);
  }, [timecardLines]);

  // Helper: Determine if day is in the future (always true for future days)
  const isFutureDay = (dayObj) => {
    return dayObj.startOf('day').isAfter(dayjs().startOf('day'));
  };

  // Helper: Check if day is locked (only when calendarLocked === true)
  const isDayLocked = (dayObj) => {
    if (!calendarLocked) return false;
    // Calculate cutoff date for the day's week (Sunday 23:59:59)
    const cutoffDate = dayObj.add((7 - dayObj.day()) % 7, 'day').endOf('day');
    // Only lock if past the week cutoff - individual line locks are handled separately
    return dayjs().isAfter(cutoffDate);
  };

  // Summation of hours by status for a given day
  const getStatusHoursForDate = (dayObj) => {
    const dateKey = dayObj.format('YYYY-MM-DD');
    const lines = linesByDate[dateKey] || [];
    const statusHours = {
      open: 0,
      submitted: 0,
      approved: 0,
      rejected: 0,
    };
    lines.forEach((line) => {
      const hours =
        parseFloat(line.ClientFacingHours || 0) +
        parseFloat(line.NonClientFacingHours || 0) +
        parseFloat(line.OtherTaskHours || 0);
      const st = (line.Status || 'open').toLowerCase();
      if (statusHours[st] !== undefined) {
        statusHours[st] += hours;
      } else {
        statusHours.open += hours; // fallback
      }
    });
    return statusHours;
  };

  // Clicking on a day => open DayInfoModal
  //  - Future days: blocked entirely
  //  - Locked days: allowed to view (readOnly)
  const handleDayClick = (dayObj) => {
    if (isFutureDay(dayObj)) return;
    setSelectedDate(dayObj);
    setModalOpen(true);
  };

  // Month/Year navigation
  const handlePreviousMonth = () => setCurrentMonth(currentMonth.subtract(1, 'month'));
  const handleNextMonth     = () => setCurrentMonth(currentMonth.add(1, 'month'));
  const handleMonthChange   = (e) => setCurrentMonth(currentMonth.month(+e.target.value - 1));
  const handleYearChange    = (e) => setCurrentMonth(currentMonth.year(+e.target.value));

  // Build years array from currentYear-5 ... currentYear+5
  const yearOptions = [];
  const cYear = dayjs().year();
  for (let y = cYear - 5; y <= cYear + 5; y++) {
    yearOptions.push(y);
  }

  // Calculate days in month + offset for Monday-based calendar
  const daysInMonth = currentMonth.daysInMonth();
  const startOfMonth = currentMonth.startOf('month');
  const offset = (startOfMonth.day() + 6) % 7;

  return (
    <Box sx={{ p: 2, mt: '1px' }}>
      {/* Calendar Navigation */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <IconButton onClick={handlePreviousMonth}>
          <ArrowLeftIcon />
        </IconButton>
        <Typography variant="h5" sx={{ mx: 2 }}>
          {currentMonth.format('MMMM YYYY')}
        </Typography>



        <IconButton onClick={handleNextMonth}>
          <ArrowRightIcon />
        </IconButton>

        <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
          <Select
            value={currentMonth.month() + 1}
            onChange={handleMonthChange}
            size="small"
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
          >
            {yearOptions.map((yearVal) => (
              <MenuItem key={yearVal} value={yearVal}>
                {yearVal}
              </MenuItem>
            ))}
          </Select>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2 }}>
  {statusOrder.map((s) => (
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

      {/* Weekday Headers (Mon-Sun) */}
      <Grid container>
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <Grid item xs={1.71} key={d}>
            <Typography variant="subtitle1" align="center" sx={{ fontWeight: 'bold' }}>
              {d}
            </Typography>
          </Grid>
        ))}
      </Grid>

      {/* Calendar Days */}
      <Grid container>
        {/* Blank slots for offset */}
        {Array.from({ length: offset }).map((_, i) => (
          <Grid item xs={1.71} key={`blank-${i}`} />
        ))}

        {Array.from({ length: daysInMonth }).map((_, i) => {
          const dayObj = startOfMonth.add(i, 'day');
          const future = isFutureDay(dayObj);
          const locked = isDayLocked(dayObj);
          const statusHours = getStatusHoursForDate(dayObj);

          // Decide on tooltip text
          let tooltipTitle = 'View Details';
          if (future) tooltipTitle = 'Not Available (Future Day)';
          if (locked && !future) tooltipTitle = 'Locked (Submitted) – View Only';

          // Build dynamic style
          const dayCardStyle = {
            height: 120,
            backgroundColor: 'white',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            p: 1,
            cursor: future ? 'not-allowed' : 'pointer',
            opacity: future || locked ? 0.7 : 1,
            pointerEvents: future ? 'none' : 'auto',
          };

          return (
            <Grid item xs={1.71} key={i} style={{ padding: '4px' }}>
              <Tooltip title={tooltipTitle} arrow placement="top">
                <Box sx={{ position: 'relative' }}>
                  <Card
                    sx={dayCardStyle}
                    onClick={() => handleDayClick(dayObj)}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      {dayObj.date()}
                    </Typography>
                    <Box sx={{ mt: 0.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      {statusOrder.map((s) => {
                        const hrs = statusHours[s];
                        return hrs > 0 ? (
                          <Box
                            key={s}
                            sx={{
                              backgroundColor: statusColors[s],
                              color: 'white',
                              width: '100%',
                              textAlign: 'center',
                              fontSize: '0.75rem',
                              borderRadius: 1,
                              height: '16px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              px: 0.5,
                            }}
                          >
                            {hrs.toFixed(1)}
                          </Box>
                        ) : null;
                      })}
                    </Box>
                  </Card>

                  {/* Lock Icon if future or locked */}
                  {(future || locked) && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'rgba(255,255,255,0.7)',
                        borderRadius: '50%',
                        width: 24,
                        height: 24,
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

      {/* DayInfoModal */}
      {selectedDate && (
        <DayInfoModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          date={selectedDate}
          refreshTrigger={refreshTrigger}
          onTimeEntryChange={(updated) => {
            if (updated) {
              setRefreshTrigger((prev) => !prev);
            }
          }}
          readOnly={isDayLocked(selectedDate)}
        />
      )}
    </Box>
  );
};

export default CalendarPage;
