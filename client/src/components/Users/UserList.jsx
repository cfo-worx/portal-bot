// frontend/src/components/Users/UserList.jsx

import React from 'react';
import { DataGrid } from '@mui/x-data-grid';
import { Button, CircularProgress } from '@mui/material';

const UserList = ({
  users,
  onEdit,
  onDelete,
  onInvite,
  onResetPassword,
  loadingInvite,
  loadingReset,
}) => {
  const columns = [
    { field: 'FirstName', headerName: 'First Name', width: 150 },
    { field: 'LastName', headerName: 'Last Name', width: 150 },
    { field: 'Email', headerName: 'Email', width: 200 },
    { field: 'ConsultantName', headerName: 'Consultant', width: 200 },
    { field: 'ClientName', headerName: 'Client', width: 200 },
    {
      field: 'actions',
      headerName: 'Actions',
      sortable: false,
      width: 350, // Adjusted width to fit all buttons
      renderCell: (params) => {
        console.log('Rendering actions for user:', params.row); // Debugging
        return (
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              height: '100%',
            }}
          >
            <Button
              variant="contained"
              size="small"
              onClick={() => onEdit(params.row)}
            >
              Edit
            </Button>
            <Button
              variant="outlined"
              size="small"
              color="error"
              onClick={() => onDelete(params.row.UserID)}
            >
              Delete
            </Button>
            <Button
              variant="contained"
              size="small"
              color="secondary"
              onClick={() => onInvite(params.row)}
              disabled={loadingInvite === params.row.UserID} // Disable while loading
              sx={{ position: 'relative', overflow: 'hidden' }}
            >
              {loadingInvite === params.row.UserID ? (
                <CircularProgress size={18} sx={{ color: '#fff' }} />
              ) : (
                'Invite'
              )}
            </Button>
            <Button
              variant="contained"
              size="small"
              color="warning"
              onClick={() => onResetPassword(params.row)}
              disabled={loadingReset === params.row.UserID} // Disable while loading
              sx={{ position: 'relative', overflow: 'hidden' }}
            >
              {loadingReset === params.row.UserID ? (
                <CircularProgress size={18} sx={{ color: '#fff' }} />
              ) : (
                'Reset'
              )}
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div style={{ height: 600, width: '100%' }}>
      <DataGrid
        rows={users}
        columns={columns}
        pageSize={10}
        rowsPerPageOptions={[10, 20, 50]}
        getRowId={(row) => row.UserID}
        sx={{
          '& .MuiDataGrid-cell': {
            fontSize: '0.8rem', // Smaller font size for detail rows
          },
          '& .MuiDataGrid-columnHeaders': {
            fontSize: '0.9rem', // Smaller font size for header
            fontWeight: 'bold',
          },
          '& .MuiDataGrid-root': {
            fontSize: '0.8rem', // General font size fallback
          },
        }}
      />
    </div>
  );
};

export default UserList;
