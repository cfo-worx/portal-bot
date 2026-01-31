import React, { useEffect, useState } from 'react';
import ClientList from '../components/Clients/ClientList';
import ClientForm from '../components/Clients/ClientForm';
import ContactsDrawer from '../components/Clients/ContactsDrawer';
import BenchmarkDrawer from '../components/Clients/BenchmarkDrawer'; // New Import
import Button from '@mui/material/Button';
import Snackbar from '@mui/material/Snackbar';
import MuiAlert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import { getClients, deleteClient } from '../../../api/clients';
import { getContactsByClient, deleteContact } from '../../../api/contacts';
import { getBenchmarksByClient, deleteBenchmark } from '../../../api/benchmarks'; // New Import
import { ToggleButton, ToggleButtonGroup, Box } from '@mui/material';

const Alert = React.forwardRef(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

const ClientsPage = () => {
  const [clients, setClients] = useState([]);
  const [showClientModal, setShowClientModal] = useState(false);
  const [editClient, setEditClient] = useState(null);

  // Contacts States
  const [showContactsDrawer, setShowContactsDrawer] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [editContact, setEditContact] = useState(null);
  const [isEditContactMode, setIsEditContactMode] = useState(false);

  // Benchmarks States
  const [showBenchmarkDrawer, setShowBenchmarkDrawer] = useState(false);
  const [benchmarks, setBenchmarks] = useState([]);
  const [editBenchmark, setEditBenchmark] = useState(null);
  const [isEditBenchmarkMode, setIsEditBenchmarkMode] = useState(false);

  // Snackbar state
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success',
  });

  // Client status filter state (toggle between Active and Inactive)
  const [clientStatusFilter, setClientStatusFilter] = useState('active');

  // Delete confirmation modal state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState(null);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const data = await getClients();
      setClients(data);
    } catch (error) {
      console.error('Error fetching clients:', error);
      showSnackbar('Error fetching clients.', 'error');
    }
  };

  const fetchContacts = async (clientId) => {
    try {
      const data = await getContactsByClient(clientId);
      setContacts(data);
    } catch (error) {
      console.error('Error fetching contacts:', error);
      showSnackbar('Error fetching contacts.', 'error');
    }
  };

  const fetchBenchmarks = async (clientId) => {
    try {
      const data = await getBenchmarksByClient(clientId);
      setBenchmarks(data);
    } catch (error) {
      console.error('Error fetching benchmarks:', error);
      showSnackbar('Error fetching benchmarks.', 'error');
    }
  };

  // Contacts Handlers
  const handleAddClient = () => {
    setEditClient(null);
    setShowClientModal(true);
  };

  const handleEditClient = (client) => {
    setEditClient(client);
    setShowClientModal(true);
  };

  const handleCloseClientModal = () => {
    setShowClientModal(false);
    setEditClient(null);
  };

  const handleViewContacts = (client) => {
    setSelectedClient(client);
    fetchContacts(client.ClientID);
    setShowContactsDrawer(true);
  };

  const handleCloseContactsDrawer = () => {
    setShowContactsDrawer(false);
    setSelectedClient(null);
    setContacts([]);
    setEditContact(null);
    setIsEditContactMode(false);
  };

  const handleAddContact = () => {
    setEditContact(null);
    setIsEditContactMode(true);
  };

  const handleEditContact = (contact) => {
    setEditContact(contact);
    setIsEditContactMode(true);
  };

  const handleDeleteContact = async (contact) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete contact "${contact.Name}"?`
    );
    if (confirmDelete) {
      try {
        await deleteContact(selectedClient.ClientID, contact.ContactID);
        fetchContacts(selectedClient.ClientID);
        showSnackbar('Contact deleted successfully.', 'success');
      } catch (error) {
        console.error('Error deleting contact:', error);
        showSnackbar('Error deleting contact.', 'error');
      }
    }
  };

  const refreshContacts = () => {
    if (selectedClient) {
      fetchContacts(selectedClient.ClientID);
      showSnackbar('Contact saved successfully.', 'success');
    }
  };

  // Benchmarks Handlers
  const handleViewBenchmarks = (client) => {
    setSelectedClient(client);
    fetchBenchmarks(client.ClientID);
    setShowBenchmarkDrawer(true);
  };

  const handleCloseBenchmarkDrawer = () => {
    setShowBenchmarkDrawer(false);
    setSelectedClient(null);
    setBenchmarks([]);
    setEditBenchmark(null);
    setIsEditBenchmarkMode(false);
  };

  const handleAddBenchmark = () => {
    setEditBenchmark(null);
    setIsEditBenchmarkMode(false); // If we consider 'add' mode as not edit mode
  };

  const handleEditBenchmark = (benchmark) => {
    setEditBenchmark(benchmark);
    setIsEditBenchmarkMode(true);
  };

  const handleDeleteBenchmark = async (benchmark) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete this benchmark?`
    );
    if (confirmDelete) {
      try {
        await deleteBenchmark(benchmark.BenchmarkID);
        fetchBenchmarks(selectedClient.ClientID);
        showSnackbar('Benchmark deleted successfully.', 'success');
      } catch (error) {
        console.error('Error deleting benchmark:', error);
        showSnackbar('Error deleting benchmark.', 'error');
      }
    }
  };

  const refreshBenchmarks = () => {
    if (selectedClient) {
      fetchBenchmarks(selectedClient.ClientID);
      showSnackbar('Benchmark saved successfully.', 'success');
    }
  };

  const showSnackbar = (message, severity) => {
    setSnackbar({
      open: true,
      message,
      severity,
    });
  };

  const handleCloseSnackbar = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbar({ ...snackbar, open: false });
  };

  // Handle filter toggle change
  const handleStatusFilterChange = (event, newFilter) => {
    if (newFilter !== null) {
      setClientStatusFilter(newFilter);
    }
  };

  // Handle delete client
  const handleDeleteClient = (client) => {
    setClientToDelete(client);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!clientToDelete) return;

    try {
      await deleteClient(clientToDelete.ClientID);
      setDeleteConfirmOpen(false);
      setClientToDelete(null);
      fetchClients(); // Refresh the list
      showSnackbar(`Client "${clientToDelete.ClientName}" deleted successfully.`, 'success');
    } catch (error) {
      console.error('Error deleting client:', error);
      const errorMessage = error.response?.status === 403 
        ? 'You do not have permission to delete clients. Admin access required.'
        : error.response?.data?.message || 'Error deleting client.';
      showSnackbar(errorMessage, 'error');
      setDeleteConfirmOpen(false);
      setClientToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirmOpen(false);
    setClientToDelete(null);
  };

  // Filter clients based on ActiveStatus and the selected filter
  const filteredClients = clients.filter((client) => {
    if (clientStatusFilter === 'active') {
      return client.ActiveStatus === true || client.ActiveStatus === 1;
    } else {
      return client.ActiveStatus === false || client.ActiveStatus === 0;
    }
  });

  return (
    <div className="p-6">
      {/* Page Header */}
      <h1 className="text-3xl font-semibold mb-4">Clients</h1>

      {/* Controls above the table header */}
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="contained"
          color="primary"
          sx={{
            backgroundColor: '#1976d2',
            '&:hover': { backgroundColor: '#115293' },
            padding: '8px 16px',
            fontSize: '14px',
          }}
          onClick={handleAddClient}
        >
          Add Client
        </Button>
        <ToggleButtonGroup
          value={clientStatusFilter}
          exclusive
          onChange={handleStatusFilterChange}
          aria-label="Client Status Filter"
          sx={{ padding: '8px' }}
        >
          <ToggleButton value="active" aria-label="Active Clients">
            Active
          </ToggleButton>
          <ToggleButton value="inactive" aria-label="Inactive Clients">
            Inactive
          </ToggleButton>
        </ToggleButtonGroup>
      </div>

      {/* Client List Table */}
      <ClientList
        clients={filteredClients}
        onEdit={handleEditClient}
        onViewContacts={handleViewContacts}
        onViewBenchmarks={handleViewBenchmarks} // Pass this prop to handle benchmarks
        onDelete={handleDeleteClient}
      />

      {showClientModal && (
        <ClientForm
          client={editClient}
          onClose={handleCloseClientModal}
          refreshClients={fetchClients}
          showSnackbar={showSnackbar}
        />
      )}

      <ContactsDrawer
        open={showContactsDrawer}
        onClose={handleCloseContactsDrawer}
        client={selectedClient}
        contacts={contacts}
        onEditContact={handleEditContact}
        onDeleteContact={handleDeleteContact}
        onAddContact={handleAddContact}
        isEditContactMode={isEditContactMode}
        editContact={editContact}
        refreshContacts={refreshContacts}
      />

      <BenchmarkDrawer
        open={showBenchmarkDrawer}
        onClose={handleCloseBenchmarkDrawer}
        client={selectedClient}
        benchmarks={benchmarks}
        onEditBenchmark={handleEditBenchmark}
        onDeleteBenchmark={handleDeleteBenchmark}
        onAddBenchmark={handleAddBenchmark}
        isEditBenchmarkMode={isEditBenchmarkMode}
        editBenchmark={editBenchmark}
        refreshBenchmarks={refreshBenchmarks}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={handleCancelDelete}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">
          Delete Client
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            Are you sure you want to delete "{clientToDelete?.ClientName}"? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelDelete} color="primary">
            No
          </Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained" autoFocus>
            Yes
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </div>
  );
};

export default ClientsPage;
