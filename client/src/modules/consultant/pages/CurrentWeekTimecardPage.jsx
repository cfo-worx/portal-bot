import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Button,
  Card,
  CardContent,
  CardActions,
  Grid,
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc'; // Import the UTC plugin
import axios from 'axios';
import TimeEntryFormModal from '../components/TimeEntryFormModal';
import { v4 as uuidv4 } from 'uuid';

// Extend Day.js with the UTC plugin
dayjs.extend(utc);

// Helper function to get Monday of the current week
function getMondayOfCurrentWeek() {
  const now = dayjs();
  const dayOfWeek = now.day(); // Sunday=0, Monday=1, ... Saturday=6
  const monday = now.subtract(dayOfWeek === 0 ? 6 : dayOfWeek - 1, 'day');
  return monday.startOf('day');
}

const CurrentWeekTimecardPage = () => {
  const [currentWeekStart, setCurrentWeekStart] = useState(getMondayOfCurrentWeek());
  const [timeEntries, setTimeEntries] = useState({});
  const [timecardStatus, setTimecardStatus] = useState('Not Submitted'); // Default to "Not Submitted"
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);

  // Fetch the timecard status for the current week
  useEffect(() => {
    const fetchTimecardStatus = async () => {
      const weekStart = currentWeekStart.format('YYYY-MM-DD');
      const weekEnd = currentWeekStart.add(6, 'day').format('YYYY-MM-DD');

      try {
        const response = await axios.get('/api/timecardHeaders/consultant', {
          params: { ConsultantID: '59DD707A-75C9-4292-A373-50493FAC9001' },
        });

        console.log('API Response:', response.data); // Log the entire response

        const currentWeekCard = response.data.find((card) => {
          const dbWeekStart = dayjs(card.WeekStartDate).utc().format('YYYY-MM-DD');
          const dbWeekEnd = dayjs(card.WeekEndDate).utc().format('YYYY-MM-DD');
          console.log(`Comparing WeekStart: ${dbWeekStart} === ${weekStart} AND WeekEnd: ${dbWeekEnd} === ${weekEnd}`);
          return dbWeekStart === weekStart && dbWeekEnd === weekEnd;
        });

        console.log('Matching Timecard:', currentWeekCard); // Log the matched timecard

        setTimecardStatus(currentWeekCard?.Status || 'Not Submitted');
      } catch (error) {
        console.error('Error fetching timecard status:', error);
        setTimecardStatus('Not Submitted');
      }
    };

    fetchTimecardStatus();
  }, [currentWeekStart]);

  // Fetch saved time entries from local storage
  useEffect(() => {
    const savedEntries = localStorage.getItem('timeEntries');
    if (savedEntries) {
      const parsedEntries = JSON.parse(savedEntries);
      const weekEntries = ensureWeekStructure(parsedEntries, currentWeekStart);
      setTimeEntries(weekEntries);
      console.log('Loaded Time Entries from Local Storage:', weekEntries);
    } else {
      const mockData = generateMockData(currentWeekStart);
      setTimeEntries(mockData);
      console.log('Initialized Mock Time Entries:', mockData);
    }
  }, [currentWeekStart]);

  const weekDays = Array.from({ length: 7 }, (_, i) => currentWeekStart.add(i, 'day'));

  const handlePrevWeek = () => {
    setCurrentWeekStart((prev) => prev.subtract(7, 'day'));
  };

  const handleNextWeek = () => {
    setCurrentWeekStart((prev) => prev.add(7, 'day'));
  };

  const getDayEntries = (date) => {
    return timeEntries[date.format('YYYY-MM-DD')] || [];
  };

  const calculateDayTotal = (date) => {
    const entries = getDayEntries(date);
    return entries.reduce((sum, e) => sum + e.TotalHours, 0).toFixed(1);
  };

  const handleAddEntry = (date) => {
    setSelectedEntry({ Date: date.format('YYYY-MM-DD') });
    setIsModalOpen(true);
  };

  const handleEditEntry = (entry) => {
    setSelectedEntry(entry);
    setIsModalOpen(true);
  };

  const handleDeleteEntry = (entry) => {
    if (window.confirm('Are you sure you want to delete this entry?')) {
      const newTimeEntries = { ...timeEntries };
      const dayList = newTimeEntries[entry.Date].filter((e) => e !== entry);
      newTimeEntries[entry.Date] = dayList;
      setTimeEntries(newTimeEntries);
      localStorage.setItem('timeEntries', JSON.stringify(newTimeEntries));
      console.log('Deleted Entry:', entry);
      console.log('Updated Time Entries:', newTimeEntries);
    }
  };

  const handleSaveEntry = (updatedEntry) => {
    const newTimeEntries = { ...timeEntries };
    if (!newTimeEntries[updatedEntry.Date]) {
      newTimeEntries[updatedEntry.Date] = [];
    }
    if (selectedEntry && selectedEntry.Date && selectedEntry.TimecardLineID) {
      const index = newTimeEntries[updatedEntry.Date].findIndex(
        (e) => e.TimecardLineID === selectedEntry.TimecardLineID
      );
      if (index > -1) {
        newTimeEntries[updatedEntry.Date][index] = { ...updatedEntry };
      } else {
        newTimeEntries[updatedEntry.Date].push({ ...updatedEntry, TimecardLineID: generateUUID() });
      }
    } else {
      newTimeEntries[updatedEntry.Date].push({ ...updatedEntry, TimecardLineID: generateUUID() });
    }
    setTimeEntries(newTimeEntries);
    localStorage.setItem('timeEntries', JSON.stringify(newTimeEntries));
    setIsModalOpen(false);
    setSelectedEntry(null);
    console.log('Saved Entry:', updatedEntry);
    console.log('Updated Time Entries:', newTimeEntries);
  };

  const weekStartStr = currentWeekStart.format('MMM D, YYYY');
  const weekEnd = currentWeekStart.add(6, 'day');
  const weekEndStr = weekEnd.format('MMM D, YYYY');

  const handleSubmitTimecard = async () => {
    if (timecardStatus !== 'Not Submitted') {
      alert('This timecard cannot be edited.');
      return;
    }

    try {
      const allEntries = Object.values(timeEntries).flat();
      if (allEntries.length === 0) {
        alert('No entries to submit.');
        return;
      }

      const totalHours = allEntries.reduce((sum, e) => sum + e.TotalHours, 0).toFixed(1);

      const consultantID = '59DD707A-75C9-4292-A373-50493FAC9001';
      const timecardID = generateUUID();

      const headerData = {
        TimecardID: timecardID,
        ConsultantID: consultantID,
        WeekStartDate: currentWeekStart.format('YYYY-MM-DD'),
        WeekEndDate: weekEnd.format('YYYY-MM-DD'),
        TotalHours: totalHours,
        Status: 'Submitted',
        Notes: 'Submitted via UI',
      };

      console.log('Submitting Header:', headerData);

      const headerResponse = await axios.post('/api/timecardHeaders', headerData);
      console.log('Header Response:', headerResponse.data);

      for (const entry of allEntries) {
        const lineData = {
          TimecardLineID: entry.TimecardLineID || generateUUID(),
          TimecardID: timecardID,
          ConsultantID: consultantID,
          ClientID: '38D93B26-BC6D-4341-8A46-A5877E2F2752', // hardcode
          ProjectID: 'ED65B3B7-7715-4D45-A9F7-028E79DA4EF8',// hardcode
          WeekStartDate: headerData.WeekStartDate,
          WeekEndDate: headerData.WeekEndDate,
          ProjectName: entry.ProjectName,
          ProjectTask: entry.ProjectTask,
          ClientFacingHours: entry.ClientFacingHours,
          NonClientFacingHours: entry.NonClientFacingHours,
          OtherTaskHours: entry.OtherTaskHours,
          Status: 'Submitted',
          Notes: entry.Notes || '',
          CreatedOn: new Date(),
          UpdatedOn: new Date(),
        };

        console.log('Submitting Line:', lineData);

        const lineResponse = await axios.post('/api/timecardLines', lineData);
        console.log('Line Response:', lineResponse.data);
      }

      localStorage.removeItem('timeEntries');
      setTimeEntries(generateMockData(currentWeekStart));
      alert('Timecard submitted successfully!');
      console.log('Timecard submitted and local storage cleared.');
    } catch (error) {
      console.error('Error submitting timecard:', error);
      alert('Failed to submit timecard. Check console for details.');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <IconButton onClick={handlePrevWeek}>
          <ArrowBackIosNewIcon />
        </IconButton>
        <Typography variant="h5" sx={{ mx: 2 }}>
          Week of {weekStartStr} - {weekEndStr}
        </Typography>
        <IconButton onClick={handleNextWeek}>
          <ArrowForwardIosIcon />
        </IconButton>
        <Box sx={{ flexGrow: 1 }} />
        <Chip label={timecardStatus} color={statusToColor(timecardStatus)} />
      </Box>

      {timecardStatus === 'Not Submitted' && (
        <Box sx={{ mb: 2 }}>
          <Button variant="contained" color="primary" onClick={handleSubmitTimecard}>
            Submit Timesheet
          </Button>
        </Box>
      )}

      {weekDays.map((day, index) => {
        const dayStr = day.format('ddd');
        const dateStr = day.format('MMM D');
        const dayTotal = calculateDayTotal(day);

        return (
          <Accordion key={index}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography sx={{ fontWeight: 'bold' }}>{dayStr}</Typography>
              <Typography sx={{ fontStyle: 'italic', mx: 2 }}>{dateStr}</Typography>
              <Typography>Total: {dayTotal} hrs</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box>
                <Button variant="outlined" onClick={() => handleAddEntry(day)}>
                  Add Entry
                </Button>
                {getDayEntries(day).length === 0 && <Typography>No entries for this day.</Typography>}
                {getDayEntries(day).map((entry) => (
                  <Card key={entry.TimecardLineID} sx={{ mt: 2 }}>
                    <CardContent>
                      <Typography variant="h6">{entry.ProjectName}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {entry.ProjectTask}
                      </Typography>
                      <Grid container spacing={1} sx={{ mt: 1 }}>
                        <Grid item xs={4}>
                          <Typography variant="body2">
                            <strong>Client Facing:</strong> {entry.ClientFacingHours} hrs
                          </Typography>
                        </Grid>
                        <Grid item xs={4}>
                          <Typography variant="body2">
                            <strong>Non-Client Facing:</strong> {entry.NonClientFacingHours} hrs
                          </Typography>
                        </Grid>
                        <Grid item xs={4}>
                          <Typography variant="body2">
                            <strong>Other Task:</strong> {entry.OtherTaskHours} hrs
                          </Typography>
                        </Grid>
                        <Grid item xs={4}>
                          <Typography variant="body2">
                            <strong>Total:</strong> {entry.TotalHours} hrs
                          </Typography>
                        </Grid>
                        {entry.Notes && (
                          <Grid item xs={12}>
                            <Typography variant="body2">
                              <strong>Notes:</strong> {entry.Notes}
                            </Typography>
                          </Grid>
                        )}
                      </Grid>
                    </CardContent>
                    <CardActions>
                      <Button size="small" onClick={() => handleEditEntry(entry)}>
                        Edit
                      </Button>
                      <Button size="small" color="error" onClick={() => handleDeleteEntry(entry)}>
                        Delete
                      </Button>
                    </CardActions>
                  </Card>
                ))}
              </Box>
            </AccordionDetails>
          </Accordion>
        );
      })}

      <TimeEntryFormModal
        open={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedEntry(null);
        }}
        onSave={handleSaveEntry}
        entry={selectedEntry}
        defaultDate={selectedEntry?.Date || currentWeekStart.format('YYYY-MM-DD')}
      />
    </Box>
  );
};

// Helper functions
function generateMockData(weekStart) {
  const data = {};
  for (let i = 0; i < 7; i++) {
    const dateKey = weekStart.add(i, 'day').format('YYYY-MM-DD');
    data[dateKey] = [];
  }
  return data;
}

function ensureWeekStructure(entries, weekStart) {
  const newEntries = { ...entries };
  for (let i = 0; i < 7; i++) {
    const dateKey = weekStart.add(i, 'day').format('YYYY-MM-DD');
    if (!newEntries[dateKey]) {
      newEntries[dateKey] = [];
    }
  }
  return newEntries;
}

function statusToColor(status) {
  switch (status) {
    case 'Approved':
      return 'success';
    case 'Submitted':
      return 'primary';
    case 'Rejected':
      return 'error';
    default:
      return 'default';
  }
}

function generateUUID() {
  return uuidv4();
}

export default CurrentWeekTimecardPage;
