// backend/controllers/timecardHeaderController.js

import TimecardHeader from '../models/TimecardHeader.js';
import { v4 as uuidv4 } from 'uuid';

// Fetch all timecard headers
export const getTimecardHeaders = async (req, res) => {
  try {
    const headers = await TimecardHeader.getAll();
    res.json(headers);
  } catch (error) {
    res.status(500).send(error.message);
  }
};

// Update a timecard header
export const updateTimecardHeader = async (req, res) => {
  try {
    await TimecardHeader.update(req.params.id, {
      ...req.body,
      UpdatedOn: new Date(),
    });
    res.status(200).send('Timecard header updated successfully');
  } catch (error) {
    res.status(500).send(error.message);
  }
};


export const createTimecardHeader = async (req, res) => {
  try {
    // Expect body: { ConsultantID, WeekStartDate, WeekEndDate, TotalHours, Status, Notes }
    // We generate a TimecardID if not provided
    const timecardID = req.body.TimecardID || uuidv4();
    // Replace references to WeekStartDate/WeekEndDate with TimesheetDate
const data = {
  TimecardID: timecardID,
  ConsultantID: req.body.ConsultantID,
  TimesheetDate: req.body.TimesheetDate,
  TotalHours: req.body.TotalHours || 0,
  Status: req.body.Status || 'Open',
  Notes: req.body.Notes || '',
  CreatedOn: new Date(),
  UpdatedOn: new Date(),
};

    await TimecardHeader.create(data);
    res.status(201).json({ message: 'Timecard header created', TimecardID: timecardID });
  } catch (error) {
    console.error('Error creating timecard header:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};



export const getTimecardHeadersByConsultantID = async (req, res) => {
  try {
    // Use hardcoded ConsultantID for now
    const consultantID = req.query.ConsultantID || '59DD707A-75C9-4292-A373-50493FAC9001';
    const headers = await TimecardHeader.getByConsultantID(consultantID);
    res.json(headers);
  } catch (error) {
    console.error('Error fetching timecard headers:', error);
    res.status(500).send(error.message);
  }
};


// Other methods as needed...
