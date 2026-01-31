// backend/utils/sendEmail.js

import axios from 'axios';

export const sendToPowerAutomate = async (email, inviteLink, firstName, lastName) => {
  const powerAutomateWebhookUrl = process.env.POWER_AUTOMATE_WEBHOOK_URL;

  const payload = {
    email: email,
    firstName: firstName,
    lastName: lastName,
    inviteLink: inviteLink,
  };

  try {
    const response = await axios.post(powerAutomateWebhookUrl, payload);
    return response.data;
  } catch (error) {
    console.error('Error sending email via Power Automate:', error);
    throw new Error('Failed to send invitation email.');
  }
};
 

// Exactly the same payload but a different Logic App endpoint
export const sendClientToPowerAutomate = async (email, inviteLink, firstName, lastName) => {
  const clientWebhookUrl = process.env.POWER_AUTOMATE_CLIENT_WEBHOOK_URL;
  const payload = { email, firstName, lastName, inviteLink };
  try {
    const response = await axios.post(clientWebhookUrl, payload);
    return response.data;
  } catch (error) {
    console.error('Error sending client invite via Power Automate:', error);
    throw new Error('Failed to send client invitation email.');
  }
};