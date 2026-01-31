import Consultant from '../models/Consultant.js';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';  

// Fetch all consultants
export const getConsultants = async (req, res) => {
  try {
    const consultants = await Consultant.getAll();
    res.json(consultants);
  } catch (error) {
    res.status(500).send(error.message);
  }
};



// Fetch all consultants
export const getActiveConsultants = async (req, res) => {
  try {
    const consultants = await Consultant.getActiveConsultants();
    res.json(consultants);
  } catch (error) {
    res.status(500).send(error.message);
  }
};

// Add a new consultant
export const addConsultant = async (req, res) => {
  try {
    const data = {
      ...req.body,
      ConsultantID: uuidv4(),
      CreatedOn: new Date(),
      UpdatedOn: new Date(),
    };
    const newConsultant = await Consultant.create(data);
    res.status(201).json(newConsultant);
  } catch (error) {
    res.status(500).send(error.message);
  }
};

// Update consultant details
export const updateConsultant = async (req, res) => {
  try {
    const updatedConsultant = await Consultant.update(req.params.id, {
      ...req.body,
      UpdatedOn: new Date(),
    });
    res.json(updatedConsultant);
  } catch (error) {
    res.status(500).send(error.message);
  }
};

// Delete a consultant
export const deleteConsultant = async (req, res) => {
  try {
    await Consultant.delete(req.params.id);
    res.status(204).send();
  } catch (error) {
    res.status(500).send(error.message);
  }
};



/**
 * Send a timesheet reminder via Power Automate
 */
export const sendReminder = async (req, res) => {
  try {
    const consultantId = req.params.id;
    const consultant = await Consultant.getById(consultantId);

    if (!consultant) {
      return res.status(404).send('Consultant not found');
    }

    // Prepare your payload
    const payload = {
      consultantId: consultant.ConsultantID,
      firstName: consultant.FirstName,
      lastName: consultant.LastName,
      email: consultant.CompanyEmail,
      // you can add any other fields your flow needs
    };

    // Placeholder Power Automate webhook URL
    // const powerAutomateUrl = 'https://prod-52.westus.logic.azure.com:443/workflows/de48305915254fb7bf2127c53614bc24/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=CK7oCskHmVLuOKwVDhkB63q10D8LuWxacV5ond5Qk5w';
    const powerAutomateUrl = 'https://default8fb4fd22935c48ebbb35bfc44a1a63.0d.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/de48305915254fb7bf2127c53614bc24/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=EuHjvZkWHUQTAtNlcEeNBTEAWG7e9z6AmksHrzTCFME';

    // Fire off the reminder
    await axios.post(powerAutomateUrl, payload);

    res.status(200).send('Reminder sent successfully');
  } catch (error) {
    console.error('Error sending reminder:', error);
    res.status(500).send(error.message);
  }
};
