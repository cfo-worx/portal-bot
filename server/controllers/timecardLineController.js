// backend/controllers/timecardLineController.js

import TimecardLine from '../models/TimecardLine.js';
import { v4 as uuidv4 } from 'uuid';

// Fetch all timecard lines
export const getTimecardLines = async (req, res) => {
  try {
    const timecardLines = await TimecardLine.getAll();
    res.json(timecardLines);
  } catch (error) {
    res.status(500).send(error.message);
  }
};

// Fetch timecard lines by TimecardID
export const getTimecardLinesByTimecardID = async (req, res) => {
  try {
    const { TimecardID } = req.query;
    const timecardLines = await TimecardLine.getByTimecardID(TimecardID);
    res.json(timecardLines);
  } catch (error) {
    res.status(500).send(error.message);
  }
};

// Update a timecard line
export const updateTimecardLine = async (req, res) => {
  try {
    await TimecardLine.update(req.params.id, {
      ...req.body,
      UpdatedOn: new Date(),
    });
    res.status(200).send('Timecard line updated successfully');
  } catch (error) {
    res.status(500).send(error.message);
  }
};

// Fetch summary data
export const getTimecardLinesSummary = async (req, res) => {
  try {
    const summary = await TimecardLine.getSummary();
    res.json(summary);
  } catch (error) {
    console.error('Error fetching timesheet summary:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Add a new timecard line
export const addTimecardLine = async (req, res) => {
  try {
    const newTimecardLine = {
      ...req.body,
      TimecardLineID: req.body.TimecardLineID || uuidv4(), // Generate a new ID if not provided
      CreatedOn: new Date(),
      UpdatedOn: new Date(),
    };

    const result = await TimecardLine.create(newTimecardLine);

    res.status(201).json({
      message: result.message,
      TimecardLineID: result.TimecardLineID,
    });
  } catch (error) {
    console.error('Error adding timecard line:', error);
    res.status(500).json({ message: 'Internal Server Error', details: error.message });
  }
};

// Delete a timecard line
export const deleteTimecardLine = async (req, res) => {
  try {
    const { id } = req.params;
    await TimecardLine.delete(id); // Assuming the model has a delete method
    res.status(200).json({ message: 'Timecard line deleted successfully' });
  } catch (error) {
    console.error('Error deleting timecard line:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Get all timecard lines with details
export const getTimecardLinesWithDetails = async (req, res) => {
  try {
    const lines = await TimecardLine.getAllWithDetails();
    res.json(lines);
  } catch (error) {
    console.error('Error fetching timecard lines with details:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Fetch timecard lines by ConsultantID and Month/Year
export const getTimecardLinesByConsultantAndMonth = async (req, res) => {
  try {
    const { ConsultantID, Month, Year } = req.query;

    // Validate required parameters
    if (!ConsultantID || !Month || !Year) {
      return res.status(400).json({ message: 'ConsultantID, Month, and Year are required parameters.' });
    }

    // Use the model method
    const lines = await TimecardLine.getByConsultantAndMonth(ConsultantID, Month, Year);
    res.json(lines);
  } catch (error) {
    console.error('Error fetching timecard lines by month:', error);
    res.status(500).json({ message: 'Internal Server Error', details: error.message });
  }
};

// Fetch timecard lines by ConsultantID and Date
export const getTimecardLinesByDate = async (req, res) => {
  try {
    const { ConsultantID, Date } = req.query;

    // Validate required parameters
    if (!ConsultantID || !Date) {
      return res.status(400).json({ message: 'ConsultantID and Date are required parameters.' });
    }

    // Use the model method
    const lines = await TimecardLine.getByConsultantAndDate(ConsultantID, Date);
    res.json(lines);
  } catch (error) {
    console.error('Error fetching timecard lines by date:', error);
    res.status(500).json({ message: 'Internal Server Error', details: error.message });
  }
};


// Fetch timecard lines for all consultants for a given month and year
export const getTimecardLinesByMonthAll = async (req, res) => {
  try {
    const { Month, Year } = req.query;
    if (!Month || !Year) {
      return res.status(400).json({ message: 'Month and Year are required.' });
    }
    // In your model, create a similar method (or inline query) that does NOT filter by ConsultantID.
    const lines = await TimecardLine.getByMonth(Month, Year);
    res.json(lines);
  } catch (error) {
    console.error('Error fetching timesheet lines by month:', error);
    res.status(500).json({ message: 'Internal Server Error', details: error.message });
  }
};


// Fetch timecard lines for all consultants for a specific date
export const getTimecardLinesByDateAll = async (req, res) => {
  try {
    const { Date } = req.query;
    if (!Date) {
      return res.status(400).json({ message: 'Date is required.' });
    }
    // In your model, add a method to get lines by date for all consultants.
    const lines = await TimecardLine.getByDate(Date);
    res.json(lines);
  } catch (error) {
    console.error('Error fetching timesheet lines by date:', error);
    res.status(500).json({ message: 'Internal Server Error', details: error.message });
  }
};


// **New Controller Method: Submit Timesheet for a Day**
export const submitTimesheetForDay = async (req, res) => {
  try {
    const { consultantID, date } = req.body;
    if (!consultantID || !date) {
      return res.status(400).json({ message: 'consultantID and date are required.' });
    }

    const rowsAffected = await TimecardLine.submitTimesheetForDay(consultantID, date);
    if (rowsAffected[0] > 0) { // rowsAffected is an array
      return res.status(200).json({ message: 'Timesheet submitted successfully.' });
    } else {
      return res.status(404).json({ message: 'No timesheet entries found for the given consultant and date.' });
    }
  } catch (error) {
    console.error('Error submitting timesheet for day:', error);
    res.status(500).json({ message: 'Internal Server Error.' });
  }
};
