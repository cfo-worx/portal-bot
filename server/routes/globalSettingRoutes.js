import express from 'express';
import {
  getCalendarLocked,
  updateCalendarLocked,
  getPerformanceReportingSettings,
  updatePerformanceReportingSettings,
  getHolidayCalendar,
  addHoliday,
  deleteHoliday,
} from '../controllers/globalSettingController.js';
import { authenticateJWT, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

/* Calendar lock (Admin only) */
router.get('/calendarLocked', authenticateJWT, authorizeRoles('Admin'), getCalendarLocked);
router.put('/calendarLocked', authenticateJWT, authorizeRoles('Admin'), updateCalendarLocked);

/* Performance reporting settings */
router.get('/performanceReporting', authenticateJWT, authorizeRoles('Admin', 'Manager'), getPerformanceReportingSettings);
router.put('/performanceReporting', authenticateJWT, authorizeRoles('Admin'), updatePerformanceReportingSettings);

/* Holiday calendar */
router.get('/holidayCalendar', authenticateJWT, authorizeRoles('Admin', 'Manager'), getHolidayCalendar);
router.post('/holidayCalendar', authenticateJWT, authorizeRoles('Admin'), addHoliday);
router.delete('/holidayCalendar/:holidayDate', authenticateJWT, authorizeRoles('Admin'), deleteHoliday);

export default router;
