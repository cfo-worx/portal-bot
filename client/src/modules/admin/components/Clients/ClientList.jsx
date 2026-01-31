import React from 'react';
import { DataGrid } from '@mui/x-data-grid';
import { Button } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';

const ClientList = ({ clients, onEdit, onViewContacts, onViewBenchmarks, onDelete }) => {
  const formatCurrency = (value) => {
    if (value === null || value === undefined || value === '') return '$0.00';
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(numValue || 0);
  };

  const columns = [
    { field: 'ClientName', headerName: 'Client Name', flex: 1 },
    { field: 'BillingEmail', headerName: 'Billing Email', flex: 1 },
    { field: 'PhoneNumber', headerName: 'Phone Number', flex: 1 },
    {
      field: 'RecurringRevenue',
      headerName: 'Recurring Revenue',
      flex: 1,
      renderCell: (params) => formatCurrency(params.value),
    },
    {
      field: 'ProjectRevenue',
      headerName: 'Project Revenue',
      flex: 1,
      renderCell: (params) => formatCurrency(params.value),
    },
    {
      field: 'ActiveStatus',
      headerName: 'Status',
      flex: 1,
      renderCell: (params) => {
        const status = params.row?.ActiveStatus;

        let displayStatus = 'Unknown';
        let color = '#000000'; // Default color

        // Handle both boolean and numeric representations
        if (status === true || status === 1) {
          displayStatus = 'Active';
          color = '#4caf50'; // Green
        } else if (status === false || status === 0) {
          displayStatus = 'Inactive';
          color = '#f44336'; // Red
        }

        return (
          <span
            style={{
              color: color,
              fontWeight: 'bold',
            }}
          >
            {displayStatus}
          </span>
        );
      },
    },
    {
      field: 'actions',
      headerName: 'Actions',
      sortable: false,
      flex: 2,
      renderCell: (params) => (
        <>
          <Button
            variant="contained"
            size="small"
            onClick={() => onEdit(params.row)}
            sx={{ mr: 1 }}
          >
            Edit
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={() => onViewContacts(params.row)}
            sx={{ mr: 1 }}
          >
            Contacts
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={() => onViewBenchmarks(params.row)}
            sx={{ mr: 1 }}
          >
            Benchmarks
          </Button>
          <Button
            variant="outlined"
            color="error"
            size="small"
            startIcon={<DeleteIcon />}
            onClick={() => onDelete(params.row)}
          >
            Delete
          </Button>
        </>
      ),
    },
  ];

  return (
    <div style={{ height: 500, width: '100%' }}>
      <DataGrid
        rows={clients}
        columns={columns}
        pageSize={10}
        getRowId={(row) => row.ClientID}
        initialState={{
          sorting: {
            sortModel: [{ field: 'ClientName', sort: 'asc' }],
          },
        }}
      />
    </div>
  );
};

export default ClientList;
