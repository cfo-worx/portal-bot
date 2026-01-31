// frontend/src/api/users.js

import axios from './index';

// Fetch all users
export const getUsers = async () => {
  const response = await axios.get('/users');
  return response.data;
};

// Add a new user (invitation)
export const addUser = async (data) => {
  const response = await axios.post('/users', data);
  return response.data;
};

// Update a user
export const updateUser = async (id, data) => {
  await axios.put(`/users/${id}`, data);
};

// Delete a user
export const deleteUser = async (id) => {
  await axios.delete(`/users/${id}`);
};

// Send an invite to a user
export const sendUserInvite = async (userId) => {
  try {
    const response = await axios.post(`/users/${userId}/invite`);
    return response.data;
  } catch (error) {
    console.error('Error sending user invite:', error);
    return {}
  }
};

// Send an invite to a client user
export const sendClientInvite = async (userId) => {
  try {
    const response = await axios.post(`/users/${userId}/client-invite`);
    return response.data;
  } catch (error) {
    console.error('Error sending client invite:', error);
    return {}
  }
};

export const sendConsultantReminder = async (consultantId) => {
  const response = await axios.post(`/consultants/${consultantId}/reminder`);
  return response.data;
};

// Set password using invite token
export const setPassword = async (inviteToken, password) => {
  const response = await axios.post('/users/set-password', { inviteToken, password });
  return response.data;
};

// Login user and receive JWT
export const login = async (email, password) => {
  const response = await axios.post('/users/login', { email, password });
  return response.data;
};
