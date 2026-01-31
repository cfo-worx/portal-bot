// frontend/src/components/Consultants/ConsultantList.jsx

import React, { useState } from 'react';
import { DataGrid } from '@mui/x-data-grid';
import {
  Button,
  Tooltip,
  Snackbar,
  Alert,
  CircularProgress
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import dayjs from 'dayjs';
import { sendConsultantReminder } from '../../../../api/consultants';

const ConsultantList = ({ consultants, onView, onEdit }) => {
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success',
  });
  const [loadingReminder, setLoadingReminder] = useState(null);

  const handleSendReminder = async (consultant) => {
    setLoadingReminder(consultant.ConsultantID);
    try {
      await sendConsultantReminder(consultant.ConsultantID);
      setSnackbar({
        open: true,
        message: `Reminder sent to ${consultant.CompanyEmail}!`,
        severity: 'success',
      });
    } catch (error) {
      console.error('Reminder error:', error);
      setSnackbar({
        open: true,
        message: `Failed to send reminder to ${consultant.CompanyEmail}.`,
        severity: 'error',
      });
    } finally {
      setLoadingReminder(null);
    }
  };

  const columns = [
    {
      field: 'nameWithBreadcrumb',
      headerName: 'Consultant',
      flex: 1.5,
      sortable: false,
      renderCell: ({ row }) => {
        const fullName = `${row.FirstName} ${row.LastName}`;
        const date = row.LatestTimesheetDate
          ? dayjs(row.LatestTimesheetDate)
          : null;
        const diffDays = date ? dayjs().diff(date, 'day') : null;

        let crumbText = 'No time entered';
        let color = '#888';
        if (diffDays !== null) {
          if (diffDays === 0) {
            crumbText = 'Today';
            color = 'green';
          } else if (diffDays === 1) {
            crumbText = '1 day ago';
            color = 'green';
          } else if (diffDays < 7) {
            crumbText = `${diffDays} days ago`;
            color = 'green';
          } else if (diffDays < 14) {
            crumbText = `${Math.floor(diffDays / 7)} week ago`;
            color = 'orange';
          } else if (diffDays < 30) {
            crumbText = `${Math.floor(diffDays / 7)} weeks ago`;
            color = 'orange';
          } else {
            const months = Math.floor(diffDays / 30);
            crumbText = months === 1 ? '1 month ago' : `${months} months ago`;
            color = 'red';
          }
        }

        return (
          <div style={{ paddingTop: 10, lineHeight: 1.2 }}>
            <div>{fullName}</div>
            <div
              style={{
                fontSize: '0.75rem',
                color,
                marginTop: 2,
                marginLeft: 4,
              }}
            >
              {crumbText}
            </div>
          </div>
        );
      },
    },
    { field: 'JobTitle',     headerName: 'Job Title',     flex: 0.8 },
    { field: 'CompanyEmail', headerName: 'Company Email', flex: 1 },
    { field: 'PhoneNumber',  headerName: 'Phone Number',  flex: 0.8 },
    {
      field: 'actions',
      headerName: 'Actions',
      sortable: false,
      flex: 1.5,
      renderCell: (params) => (
        <>
          <Tooltip title="View Card">
            <Button
              variant="contained"
              size="small"
              color="primary"
              startIcon={<VisibilityIcon />}
              onClick={() => onView(params.row)}
              sx={{ mr: 1 }}
            >
              View
            </Button>
          </Tooltip>
          <Tooltip title="Edit Consultant">
            <Button
              variant="contained"
              size="small"
              color="info"
              startIcon={<EditIcon />}
              onClick={() => onEdit(params.row)}
              sx={{ mr: 1 }}
            >
              Edit
            </Button>
          </Tooltip>
          <Tooltip title="Send Timesheet Reminder">
            <Button
              variant="contained"
              size="small"
              color="secondary"
              startIcon={<SendIcon />}
              onClick={() => handleSendReminder(params.row)}
              disabled={loadingReminder === params.row.ConsultantID}
              sx={{ position: 'relative', overflow: 'hidden' }}
            >
              {loadingReminder === params.row.ConsultantID ? (
                <CircularProgress size={18} sx={{ color: '#fff' }} />
              ) : (
                'Remind'
              )}
            </Button>
          </Tooltip>
        </>
      ),
    },
  ];

  return (
    <>
      <div style={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={consultants}
          columns={columns}
          pageSize={10}
          rowsPerPageOptions={[10, 20, 50]}
          getRowId={(row) => row.ConsultantID}
          disableSelectionOnClick
          initialState={{
            sorting: { sortModel: [{ field: 'FirstName', sort: 'asc' }] },
          }}
        />
      </div>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar(s => ({ ...s, open: false }))}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default ConsultantList;
