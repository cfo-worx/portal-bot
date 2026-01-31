// frontend/src/components/Users/UserForm.jsx

import React, { useState, useEffect } from 'react';
import {
  TextField,
  Button,
  Grid,
  FormControlLabel,
  Switch,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
  FormHelperText,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { blue, green, orange, purple } from '@mui/material/colors';
import Modal from '../Shared/Modal';
import { validateUser } from '../../utils/validation';
import { addUser, updateUser, sendUserInvite, sendClientInvite } from '../../api/users';
import { getConsultants } from '../../api/consultants';
import { getClients } from '../../api/clients'; // Assuming you have an API to fetch clients

const AdminSwitch = styled(Switch)(({ theme }) => ({
  '& .MuiSwitch-switchBase.Mui-checked': {
    color: blue[600],
    '&:hover': {
      backgroundColor: blue[100],
    },
  },
  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
    backgroundColor: blue[600],
  },
}));

const ConsultantSwitch = styled(Switch)(({ theme }) => ({
  '& .MuiSwitch-switchBase.Mui-checked': {
    color: green[600],
    '&:hover': {
      backgroundColor: green[100],
    },
  },
  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
    backgroundColor: green[600],
  },
}));

const ManagerSwitch = styled(Switch)(({ theme }) => ({
  '& .MuiSwitch-switchBase.Mui-checked': {
    color: orange[600],
    '&:hover': {
      backgroundColor: orange[100],
    },
  },
  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
    backgroundColor: orange[600],
  },
}));

const ClientSwitch = styled(Switch)(({ theme }) => ({
  '& .MuiSwitch-switchBase.Mui-checked': {
    color: purple[600],
    '&:hover': {
      backgroundColor: purple[100],
    },
  },
  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
    backgroundColor: purple[600],
  },
}));

const UserForm = ({ user, onClose, refreshUsers }) => {
  const [formData, setFormData] = useState({
    FirstName: '',
    LastName: '',
    Email: '',
    Roles: [],
    ConsultantID: '',
    ClientID: '', // Added ClientID
  });
  const [consultants, setConsultants] = useState([]);
  const [clients, setClients] = useState([]); // State for clients
  const [consultantError, setConsultantError] = useState(false);
  const [clientError, setClientError] = useState(false); // Error state for client

  useEffect(() => {
    // Fetch consultants and clients on mount
    const fetchData = async () => {
      try {
        const consultantsData = await getConsultants();
        
        // Sort consultants by First Name alphabetically
        const sortedConsultants = consultantsData.sort((a, b) =>
          a.FirstName.localeCompare(b.FirstName)
        );
  
        setConsultants(sortedConsultants);
      } catch (error) {
        console.error('Error fetching consultants:', error);
      }
  
      try {
        const clientsData = await getClients();

// Sort clients alphabetically by ClientName
const sortedClients = clientsData.sort((a, b) =>
  a.ClientName.localeCompare(b.ClientName)
);

setClients(sortedClients);

      } catch (error) {
        console.error('Error fetching clients:', error);
      }
    };
    
    fetchData();
  
    if (user) {
      setFormData({
        FirstName: user.FirstName || '',
        LastName: user.LastName || '',
        Email: user.Email || '',
        Roles: user.Roles || [],
        ConsultantID: user.ConsultantID || '',
        ClientID: user.ClientID || '',
      });
    } else {
      // Reset form data when adding a new user
      setFormData({
        FirstName: '',
        LastName: '',
        Email: '',
        Roles: [],
        ConsultantID: '',
        ClientID: '',
      });
    }
  }, [user]);
  

  const handleChange = (e) => {
    const { name, value } = e.target;

    // Reset errors if necessary
    if (name === 'ConsultantID') {
      setConsultantError(false);
    }
    if (name === 'ClientID') {
      setClientError(false);
    }

    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleRoleToggle = (role) => (event) => {
    const isChecked = event.target.checked;
    let newRoles = [];

    if (isChecked) {
      newRoles = [...formData.Roles, role];
    } else {
      newRoles = formData.Roles.filter((r) => r !== role);
    }

    // Handle mutual exclusivity between Consultant and Client
    if (role === 'Consultant' && isChecked) {
      if (formData.Roles.includes('Client')) {
        newRoles = newRoles.filter((r) => r !== 'Client');
        setFormData((prev) => ({
          ...prev,
          Roles: newRoles,
          ClientID: '',
        }));
        setClientError(false);
      }
    }

    if (role === 'Client' && isChecked) {
      if (formData.Roles.includes('Consultant')) {
        newRoles = newRoles.filter((r) => r !== 'Consultant');
        setFormData((prev) => ({
          ...prev,
          Roles: newRoles,
          ConsultantID: '',
        }));
        setConsultantError(false);
      }
    }

    // If unchecking Consultant or Client, clear corresponding IDs
    if (role === 'Consultant' && !isChecked) {
      setFormData((prev) => ({
        ...prev,
        ConsultantID: '',
      }));
      setConsultantError(false);
    }

    if (role === 'Client' && !isChecked) {
      setFormData((prev) => ({
        ...prev,
        ClientID: '',
      }));
      setClientError(false);
    }

    // Finally, set the updated roles
    setFormData((prev) => ({
      ...prev,
      Roles: newRoles,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('Submitting User Form with data:', formData); // Debugging

    // Check for role-specific requirements
    const isConsultantRoleSelected = formData.Roles.includes('Consultant');
    const isClientRoleSelected = formData.Roles.includes('Client');

    let hasError = false;

    if (isConsultantRoleSelected && !formData.ConsultantID) {
      setConsultantError(true);
      hasError = true;
    }

    if (isClientRoleSelected && !formData.ClientID) {
      setClientError(true);
      hasError = true;
    }

    if (hasError) {
      return;
    }

    // Validate other fields
    const errors = validateUser(formData);
    if (errors.length > 0) {
      alert(errors.join('\n'));
      return;
    }

    // Prepare data for API
    const dataToSubmit = {
      ...formData,
      ConsultantID: formData.ConsultantID || null,
      ClientID: formData.ClientID || null, // Handle ClientID
    };

    try {
      if (user) {
        await updateUser(user.UserID, dataToSubmit);
      } else {
        const response = await addUser(dataToSubmit);
        // Optionally send an invite after adding the user
        if (formData.Roles.includes('Client')) {
          await sendClientInvite(response.UserID);
        } else {
          await sendUserInvite(response.UserID);
        }
      }
      refreshUsers();
      onClose();
    } catch (error) {
      console.error('Error saving user:', error);
      alert('Failed to save user.');
    }
  };

  return (
    <Modal open={true} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <Grid container spacing={2}>
          {/* First Name */}
          <Grid item xs={12} sm={6}>
            <TextField
              label="First Name"
              name="FirstName"
              value={formData.FirstName}
              onChange={handleChange}
              fullWidth
              required
            />
          </Grid>
          {/* Last Name */}
          <Grid item xs={12} sm={6}>
            <TextField
              label="Last Name"
              name="LastName"
              value={formData.LastName}
              onChange={handleChange}
              fullWidth
              required
            />
          </Grid>
          {/* Email */}
          <Grid item xs={12} sm={6}>
            <TextField
              label="Email"
              name="Email"
              value={formData.Email}
              onChange={handleChange}
              fullWidth
              required
              type="email"
            />
          </Grid>
          {/* Consultant Dropdown */}
          {formData.Roles.includes('Consultant') && (
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth error={consultantError}>
                <InputLabel id="consultant-label">Consultant</InputLabel>
                <Select
                  labelId="consultant-label"
                  id="consultant-select"
                  name="ConsultantID"
                  value={formData.ConsultantID}
                  label="Consultant"
                  onChange={handleChange}
                >
                  <MenuItem value="">
                    <em>None</em>
                  </MenuItem>
                  {consultants.map((consultant) => (
                    <MenuItem key={consultant.ConsultantID} value={consultant.ConsultantID}>
                      {consultant.FirstName} {consultant.LastName}
                    </MenuItem>
                  ))}
                </Select>
                {consultantError && (
                  <FormHelperText>
                    Please select a consultant when Consultant role is assigned.
                  </FormHelperText>
                )}
              </FormControl>
            </Grid>
          )}
          {/* Client Dropdown */}
          {formData.Roles.includes('Client') && (
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth error={clientError}>
                <InputLabel id="client-label">Client</InputLabel>
                <Select
                  labelId="client-label"
                  id="client-select"
                  name="ClientID"
                  value={formData.ClientID}
                  label="Client"
                  onChange={handleChange}
                >
                  <MenuItem value="">
                    <em>None</em>
                  </MenuItem>
                  {clients.map((client) => (
                    <MenuItem key={client.ClientID} value={client.ClientID}>
                      {client.ClientName}
                    </MenuItem>
                  ))}
                </Select>
                {clientError && (
                  <FormHelperText>
                    Please select a client when Client role is assigned.
                  </FormHelperText>
                )}
              </FormControl>
            </Grid>
          )}
          {/* Roles as Switches */}
          <Grid item xs={12}>
            <Grid container spacing={2}>
              <Grid item xs={6} sm={3}>
                <FormControlLabel
                  control={
                    <AdminSwitch
                      checked={formData.Roles.includes('Admin')}
                      onChange={handleRoleToggle('Admin')}
                    />
                  }
                  label="Admin"
                />
              </Grid>
              <Grid item xs={6} sm={3}>
                <FormControlLabel
                  control={
                    <ConsultantSwitch
                      checked={formData.Roles.includes('Consultant')}
                      onChange={handleRoleToggle('Consultant')}
                    />
                  }
                  label="Consultant"
                />
              </Grid>
              <Grid item xs={6} sm={3}>
                <FormControlLabel
                  control={
                    <ManagerSwitch
                      checked={formData.Roles.includes('Manager')}
                      onChange={handleRoleToggle('Manager')}
                    />
                  }
                  label="Manager"
                />
              </Grid>
              <Grid item xs={6} sm={3}>
                <FormControlLabel
                  control={
                    <ClientSwitch
                      checked={formData.Roles.includes('Client')}
                      onChange={handleRoleToggle('Client')}
                    />
                  }
                  label="Client"
                />
              </Grid>
            </Grid>
          </Grid>
          {/* Submit Button */}
          <Grid item xs={12}>
            <Button type="submit" variant="contained" color="primary" fullWidth>
              {user ? 'Update' : 'Save'}
            </Button>
          </Grid>
        </Grid>
      </form>
    </Modal>
  );
};

export default UserForm;
