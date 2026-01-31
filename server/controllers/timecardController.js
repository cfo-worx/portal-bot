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

// Add a new timecard line
export const addTimecardLine = async (req, res) => {
  try {
    const data = {
      ...req.body,
      TimecardLineID: uuidv4(),
      CreatedOn: new Date(),
      UpdatedOn: new Date(),
    };
    const newTimecardLine = await TimecardLine.create(data);
    res.status(201).json(newTimecardLine);
  } catch (error) {
    res.status(500).send(error.message);
  }
};

// Update a timecard line
export const updateTimecardLine = async (req, res) => {
  try {
    const updatedTimecardLine = await TimecardLine.update(req.params.id, {
      ...req.body,
      UpdatedOn: new Date(),
    });
    res.json(updatedTimecardLine);
  } catch (error) {
    res.status(500).send(error.message);
  }
};

// Delete a timecard line
export const deleteTimecardLine = async (req, res) => {
  try {
    await TimecardLine.delete(req.params.id);
    res.status(204).send();
  } catch (error) {
    res.status(500).send(error.message);
  }
};
