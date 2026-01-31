// src/modules/admin/components/Clients/ContactsDrawer.jsx

import React, { useState } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Button,
  Divider,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ContactList from './ContactList';
import ContactForm from './ContactForm';

const ContactsDrawer = ({
  open,
  onClose,
  client,
  contacts,
  refreshContacts,
}) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentContact, setCurrentContact] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const handleAddContact = () => {
    setIsEditMode(false);
    setCurrentContact(null);
    setIsFormOpen(true);
  };

  const handleEditContact = (contact) => {
    setIsEditMode(true);
    setCurrentContact(contact);
    setIsFormOpen(true);
  };

  const handleDeleteContact = (contact) => {
    // Implement delete logic, likely involving API call
    // Example:
    // deleteContact(client.ClientID, contact.ContactID)
    //   .then(() => refreshContacts())
    //   .catch(error => console.error('Error deleting contact:', error));
  };

  const handleFormClose = () => {
    setIsEditMode(false);
    setCurrentContact(null);
    setIsFormOpen(false);
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={() => {
        onClose();
        handleFormClose(); // Close the form when the drawer is closed
      }}
      PaperProps={{ sx: { width: '50%' } }}
    >
      <Box
        sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Typography variant="h6">
            Contacts for {client ? client.ClientName : ''}
          </Typography>
          <IconButton onClick={() => {
            onClose();
            handleFormClose(); // Close the form when the drawer is closed
          }}>
            <CloseIcon />
          </IconButton>
        </Box>
        <Divider sx={{ my: 1 }} />

        {/* Add Contact Button */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <Button
            variant="contained"
            color="primary"
            onClick={handleAddContact}
          >
            Add Contact
          </Button>
        </Box>

        {/* Contacts List */}
        <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
          <ContactList
            contacts={contacts}
            onEditContact={handleEditContact}
            onDeleteContact={handleDeleteContact}
          />
        </Box>

        {/* Contact Form */}
        {isFormOpen && (
          <Box sx={{ mt: 2 }}>
            <ContactForm
              client={client}
              contact={isEditMode ? currentContact : null}
              isEditMode={isEditMode}
              onClose={handleFormClose}
              refreshContacts={refreshContacts}
            />
          </Box>
        )}
      </Box>
    </Drawer>
  );
};

export default ContactsDrawer;
