import express from 'express';
import { 
    getTimecardLines, 
    updateTimecardLine, 
    getTimecardLinesSummary,
    addTimecardLine,      // Add this
  deleteTimecardLine,
  getTimecardLinesWithDetails   // And this
  } from '../controllers/timecardLineController.js';

const router = express.Router();

router.get('/', getTimecardLines);
router.put('/:id', updateTimecardLine);
router.get('/summary', getTimecardLinesSummary);

// Add a new timecard line
router.post('/', addTimecardLine);

// Delete a timecard line by ID
router.delete('/:id', deleteTimecardLine);

// New route to fetch all timecard lines with details
router.get('/lines-with-details', getTimecardLinesWithDetails);


export default router;
