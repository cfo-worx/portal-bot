// backend/controllers/userController.js

import User from '../models/User.js';
import { sendToPowerAutomate, sendClientToPowerAutomate } from '../utils/sendEmail.js';

// Fetch all users
export const getUsers = async (req, res) => {
  try {
    const users = await User.getAll();
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).send(error.message);
  }
};

// Create a new user (invited, not active yet)
export const addUser = async (req, res) => {
  try {
    const userData = req.body;
    // Validate userData as needed

    const { UserID } = await User.create(userData);
    res.status(201).json({ UserID });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).send(error.message);
  }
};

// Update a user
export const updateUser = async (req, res) => {
  try {
    const userId = req.params.id;
    const userData = req.body;
    // Validate userData as needed

    await User.update(userId, userData);
    res.status(200).send('User updated successfully');
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).send(error.message);
  }
};

// Delete a user
export const deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;
    await User.delete(userId);
    res.status(200).send('User deleted successfully');
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).send(error.message);
  }
};

// Send invitation to user
// Send invitation to user (guarding out clients)
export const sendInvite = async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.getById(userId);

    if (!user) {
      return res.status(404).send('User not found');
    }

    // If this user is actually a client, bounce back
    if (user.ClientID) {
      return res
        .status(400)
        .send('This is a client user. Use the client-invite endpoint instead.');
    }

    // Generate a brand-new invite token (invalidates any prior token)
    const inviteToken = await User.sendInvite(userId);

    // Build the link they’ll click to set their password
    const inviteLink = `${process.env.PUBLIC_URL}/set-password/${inviteToken}`;

    // Fire off the regular Power Automate flow
    await sendToPowerAutomate(
      user.Email,
      inviteLink,
      user.FirstName,
      user.LastName
    );

    res.status(200).send('Invitation sent successfully.');
  } catch (error) {
    console.error('Error sending invite:', error);
    res.status(500).send(error.message);
  }
};


// Set password using invite token
export const setPassword = async (req, res) => {
  try {
    const { inviteToken, password } = req.body;

    if (!inviteToken || !password) {
      return res.status(400).send('Invite token and password are required.');
    }

    await User.setPassword(inviteToken, password);
    res.status(200).send('Password set successfully.');
  } catch (error) {
    console.error('Error setting password:', error);
    res.status(500).send(error.message);
  }
};

// Login user and issue JWT
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const token = await User.login(email, password);
    res.json({ token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(401).send(error.message);
  }
};


// Send invitation to a client user
export const sendClientInvite = async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.getById(userId);
    if (!user) return res.status(404).send('User not found');

    // Generate invite token & link exactly as before
    const inviteToken = await User.sendInvite(userId);
    const inviteLink = `${process.env.PUBLIC_URL}/set-password/${inviteToken}`;

    // Send via the client-specific Logic App
    await sendClientToPowerAutomate(
      user.Email,
      inviteLink,
      user.FirstName,
      user.LastName
    );

    res.status(200).send('Client invitation sent successfully.');
  } catch (error) {
    console.error('Error sending client invite:', error);
    res.status(500).send(error.message);
  }
};
