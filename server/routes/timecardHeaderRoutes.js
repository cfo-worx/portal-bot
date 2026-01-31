// backend/routes/timecardHeaderRoutes.js
import express from 'express';
import { getTimecardHeaders, updateTimecardHeader, createTimecardHeader } from '../controllers/timecardHeaderController.js';

const router = express.Router();

// GET /api/timecardHeaders - Fetch all timecard headers
router.get('/', getTimecardHeaders);

// PUT /api/timecardHeaders/:id - Update a specific timecard header
router.put('/:id', updateTimecardHeader);


router.post('/', createTimecardHeader);

// You can add more routes here as needed (e.g., POST, DELETE)

export default router;
