import React, { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import axios from 'axios'; // Add this import

import {
  Box,
  Typography,
  Chip,
  Button
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';

// Mock fetch
// Replace fetchPastTimecards in TimecardHistoryPage.jsx

async function fetchPastTimecards() {
  try {
    const response = await axios.get('/api/timecardHeaders/consultant', {
      params: { ConsultantID: '59DD707A-75C9-4292-A373-50493FAC9001' }, // Hardcoded for now
    });
    return response.data.map((header) => ({
      id: header.TimecardID,
      WeekStartDate: dayjs(header.WeekStartDate).format('YYYY-MM-DD'),
      WeekEndDate: dayjs(header.WeekEndDate).format('YYYY-MM-DD'),
      TotalHours: header.TotalHours,
      Status: header.Status,
      Notes: header.Notes,
    }));
  } catch (error) {
    console.error('Error fetching timecard history:', error);
    return [];
  }
}


const TimecardHistoryPage = () => {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    (async () => {
      const data = await fetchPastTimecards();
      setRows(data);
    })();
  }, []);

  const columns = [
    { field: 'WeekStartDate', headerName: 'Week Start', flex: 1 },
    { field: 'WeekEndDate', headerName: 'Week End', flex: 1 },
    { field: 'TotalHours', headerName: 'Total Hours', flex: 1 },
    { 
      field: 'Status', 
      headerName: 'Status', 
      flex: 1,
      renderCell: (params) => <Chip label={params.value} color={statusToColor(params.value)} />
    },
    { field: 'Notes', headerName: 'Notes', flex: 2 },
    {
      field: 'actions',
      headerName: 'Actions',
      renderCell: (params) => (
        <Button
          variant="contained"
          size="small"
          onClick={() => viewTimecardDetails(params.row)}
        >
          View
        </Button>
      ),
      flex: 1,
    }
  ];

  const viewTimecardDetails = (row) => {
    // Navigate to /consultant with query param or open a modal
    // For now, just alert
    alert(`Viewing details for: ${row.WeekStartDate} - ${row.WeekEndDate}`);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>Timecard History</Typography>
      <div style={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={rows}
          columns={columns}
          pageSize={10}
        />
      </div>
    </Box>
  );
};

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

export default TimecardHistoryPage;
