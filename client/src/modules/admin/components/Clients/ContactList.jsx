// src/modules/admin/components/Clients/ContactList.jsx

import React from 'react';
import { DataGrid } from '@mui/x-data-grid';
import { IconButton } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

const ContactList = ({ contacts, onEditContact, onDeleteContact }) => {
  const columns = [
    { field: 'Name', headerName: 'Name', flex: 1, editable: true },
    { field: 'Title', headerName: 'Title', flex: 1, editable: true },
    { field: 'PhoneNumber', headerName: 'Phone Number', flex: 1, editable: true },
    { field: 'Email', headerName: 'Email', flex: 1, editable: true },
    { field: 'Timezone', headerName: 'Timezone', flex: 1, editable: true },
    {
      field: 'actions',
      headerName: 'Actions',
      sortable: false,
      flex: 0.5,
      renderCell: (params) => (
        <>
          <IconButton
            color="primary"
            onClick={() => onEditContact(params.row)}
            aria-label="edit"
          >
            <EditIcon />
          </IconButton>
          <IconButton
            color="secondary"
            onClick={() => onDeleteContact(params.row)}
            aria-label="delete"
          >
            <DeleteIcon />
          </IconButton>
        </>
      ),
    },
  ];

  return (
    <div style={{ height: 400, width: '100%' }}>
      <DataGrid
        rows={contacts}
        columns={columns}
        pageSize={5}
        getRowId={(row) => row.ContactID}
        disableSelectionOnClick
      />
    </div>
  );
};

export default ContactList;
