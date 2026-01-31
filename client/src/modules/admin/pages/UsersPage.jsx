// frontend/src/pages/UsersPage.jsx

import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, CircularProgress } from '@mui/material';
import { ToggleButton, ToggleButtonGroup } from '@mui/material';
import UserList from '../../../components/Users/UserList';
import UserForm from '../../../components/Users/UserForm';
import NotifyModal from '../../../components/Shared/NotifyModal';
import { getUsers, deleteUser, sendUserInvite, sendClientInvite } from '../../../api/users';

const UsersPage = () => {
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // Modal and loading states
  const [loadingInvite, setLoadingInvite] = useState(null);
  const [loadingReminder, setLoadingReminder] = useState(null);
  const [loadingReset, setLoadingReset] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [modalSeverity, setModalSeverity] = useState('success'); // 'success' or 'error'
  const [userRoleFilter, setUserRoleFilter] = useState('all');   // all | consultants | clients

  // Fetch users from the backend
  const fetchUsers = async () => {
    try {
      const data = await getUsers();

      // Optional: Log the raw API data
      console.log('Raw API Data:', data);

      setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
      setModalMessage('Failed to fetch users.');
      setModalSeverity('error');
      setModalOpen(true);
    }
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle opening the add user form
  const handleAdd = () => {
    setSelectedUser(null);
    setShowForm(true);
  };

  // Handle opening the edit user form
  const handleEdit = (user) => {
    setSelectedUser(user);
    setShowForm(true);
  };

  // Handle deleting a user
  const handleDelete = async (userId) => {
    if (window.confirm(`Are you sure you want to delete this user?`)) {
      try {
        await deleteUser(userId);
        fetchUsers();
        setModalMessage('User deleted successfully.');
        setModalSeverity('success');
        setModalOpen(true);
      } catch (error) {
        console.error('Error deleting user:', error);
        setModalMessage('Failed to delete user.');
        setModalSeverity('error');
        setModalOpen(true);
      }
    }
  };

  // Handle sending an invitation to a user
// Handle sending an invitation to a user or client
const handleInvite = async (user) => {
  setLoadingInvite(user.UserID);
      try {
      if (user.ClientID) {
        // use the client-invite endpoint
        await sendClientInvite(user.UserID);
        setModalMessage(`Client invite sent to ${user.Email}!`);
      } else {
        // standard user
        await sendUserInvite(user.UserID);
        setModalMessage(`Invitation sent to ${user.Email}!`);
      }
      setModalSeverity('success');
    } catch (error) {
      console.error('Error sending invite:', error);
      setModalMessage(
        user.ClientID
          ? `Failed to send client invite to ${user.Email}.`
          : `Failed to send invitation to ${user.Email}.`
      );
      setModalSeverity('error');
    } finally {
      setModalOpen(true);
      setLoadingInvite(null);
  }
};


  const handleRemind = async (user) => {
  setLoadingReminder(user.UserID);
  try {
    await sendUserReminder(user.UserID);
    setModalMessage(`Reminder sent to ${user.Email}!`);
    setModalSeverity('success');
  } catch (err) {
    console.error(err);
    setModalMessage(`Failed to send reminder to ${user.Email}.`);
    setModalSeverity('error');
  } finally {
    setModalOpen(true);
    setLoadingReminder(null);
  }
};

  // Handle resetting a user's password
  const handleResetPassword = async (user) => {
    setLoadingReset(user.UserID);
    try {
      // Implement your password reset logic here
      // This is a placeholder implementation
      const response = await fetch('https://your-backend.com/api/users/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.UserID }),
      });

      if (response.ok) {
        setModalMessage(`Password reset link sent to ${user.Email} successfully.`);
        setModalSeverity('success');
        setModalOpen(true);
      } else {
        const errorData = await response.json();
        setModalMessage(errorData.message || 'Failed to send password reset.');
        setModalSeverity('error');
        setModalOpen(true);
      }
    } catch (error) {
      console.error('Error resetting password:', error);
      setModalMessage('Error sending password reset.');
      setModalSeverity('error');
      setModalOpen(true);
    } finally {
      setLoadingReset(null);
    }
  };

  // Handle closing the modal
  const handleModalClose = () => {
    setModalOpen(false);
    setModalMessage('');
  };

  const handleRoleFilterChange = (event, newFilter) => {
  if (newFilter !== null) setUserRoleFilter(newFilter);
};

const filteredUsers = users.filter((u) => {
  const roles = u.Roles || [];            // the array of roles
  const hasConsultant = roles.includes('Consultant');
  const hasClient     = roles.includes('Client');

  if (userRoleFilter === 'consultants') return hasConsultant;
  if (userRoleFilter === 'clients')     return hasClient;
  return true; // 'all'
});


  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Users Management
      </Typography>
      <Button variant="contained" color="primary" onClick={handleAdd} sx={{ mb: 2 }}>
        Add User
      </Button>
      <Box ml={2}>
    <ToggleButtonGroup
      value={userRoleFilter}
      exclusive
      onChange={handleRoleFilterChange}
      size="small"
      aria-label="role filter"
    >
      <ToggleButton value="all">All</ToggleButton>
      <ToggleButton value="consultants">Consultants</ToggleButton>
      <ToggleButton value="clients">Clients</ToggleButton>
    </ToggleButtonGroup>
  </Box>
      {users.length === 0 ? (
        <CircularProgress />
      ) : (
        <UserList
          users={filteredUsers}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onInvite={handleInvite}
          onResetPassword={handleResetPassword}
          onRemind={handleRemind}
          loadingInvite={loadingInvite} // Pass the state
          loadingReset={loadingReset}   // Pass the state
        />
      )}
      {showForm && (
        <UserForm
          user={selectedUser}
          onClose={() => setShowForm(false)}
          refreshUsers={fetchUsers}
        />
      )}
      <NotifyModal
        open={modalOpen}
        onClose={handleModalClose}
        message={modalMessage}
        severity={modalSeverity}
      />
    </Box>
  );
};

export default UsersPage;
