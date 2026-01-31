import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables - try local .env first, fallback to production path
dotenv.config({ path: path.join(__dirname, '.env') });

import os from 'os';
import express from 'express';
import cors from 'cors';
import userRoutes from './routes/userRoutes.js';
import clientRoutes from './routes/clientRoutes.js';
import timecardRoutes from './routes/timecardRoutes.js';
import consultantRoutes from './routes/consultantRoutes.js';
import contactRoutes from './routes/contactRoutes.js';
import benchmarkRoutes from './routes/benchmarkRoutes.js';
import {
  getTimecardHeaders,
  updateTimecardHeader,
  createTimecardHeader,
  getTimecardHeadersByConsultantID,
} from './controllers/timecardHeaderController.js';
import {
  getTimecardLines,
  getTimecardLinesByTimecardID,
  updateTimecardLine,
  getTimecardLinesSummary,
  addTimecardLine,
  getTimecardLinesByConsultantAndMonth,
  getTimecardLinesByDate,
  submitTimesheetForDay,
  deleteTimecardLine,
  getTimecardLinesByMonthAll,
  getTimecardLinesByDateAll,
} from './controllers/timecardLineController.js';
import { poolPromise } from './db.js';
import listEndpoints from 'express-list-endpoints';
import { authenticateJWT } from './middleware/auth.js'; // Import JWT middleware
import projectRoutes from './routes/projectRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import subtaskRoutes from './routes/subtaskRoutes.js';
import supportRequestRoutes from './routes/supportRequestRoutes.js';
import globalSettingRoutes   from './routes/globalSettingRoutes.js';
import discussionRoutes from './routes/discussionRoutes.js';
import roiRoutes from './routes/roiRoutes.js';
import templatesRouter from './routes/templates.js';
import contractRoutes from './routes/contractRoutes.js';
import financialReportRoutes from './routes/financialReportRoutes.js';
import performanceReportRoutes from './routes/performanceReportRoutes.js';
import crmSettingsRoutes from './routes/crmSettingsRoutes.js';
import crmDealRoutes from './routes/crmDealRoutes.js';
import crmReportRoutes from './routes/crmReportRoutes.js';
import leadRoutes from './routes/leadRoutes.js';
import buySideRoutes from './routes/buySideRoutes.js';
import payrollRoutes from './routes/payrollRoutes.js';
import externalTimeRoutes from './routes/externalTimeRoutes.js';
import clientActivityRoutes from './routes/clientActivityRoutes.js';
import commissionsRoutes from './routes/commissionsRoutes.js';
import collaborationRoutes from './routes/collaborationRoutes.js';
import governanceCalendarRoutes from './routes/governanceCalendarRoutes.js';
import governanceCovenantRoutes from './routes/governanceCovenantRoutes.js';
import helpdeskRoutes from './routes/helpdeskRoutes.js';
import clientWorkRoutes from './routes/clientWorkRoutes.js';
import { scheduleRecurringCloneJob } from './jobs/recurringClone.js';
import { scheduleGovernanceDigestJob } from './jobs/governanceDigest.js';  

// Initialize express
const app = express();

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cors());

// User Management
app.use('/api/users', userRoutes);



// Routes
app.use('/api/clients', clientRoutes);
app.use('/api/timecards', timecardRoutes);
app.use('/api/consultants', consultantRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/benchmarks', benchmarkRoutes);

// TimecardHeader routes
app.get('/api/timecardHeaders', getTimecardHeaders);
app.put('/api/timecardHeaders/:id', updateTimecardHeader);
app.post('/api/timecardHeaders', createTimecardHeader);
app.get('/api/timecardHeaders/consultant', getTimecardHeadersByConsultantID);

// TimecardLine routes
app.get('/api/timecardLines', getTimecardLinesByTimecardID);
app.put('/api/timecardLines/:id', updateTimecardLine);
app.get('/api/timecardLines/summary', getTimecardLinesSummary);
app.post('/api/timecardLines', addTimecardLine); // Fixed here
// ADD the delete route:
app.delete('/api/timecardLines/:id', deleteTimecardLine);

// New TimecardLine routes for fetching by consultant and month/year or date
app.get('/api/timecardLines/month', getTimecardLinesByConsultantAndMonth); // Fetch lines by consultant & month/year
app.get('/api/timecardLines/date', getTimecardLinesByDate); // Fetch lines by date

app.get('/api/timecardLines/month/all', getTimecardLinesByMonthAll);
app.get('/api/timecardLines/date/all', getTimecardLinesByDateAll);

// **New Route: Submit Timesheet for a Day**
app.post('/api/timecardLines/submit', submitTimesheetForDay);

// Log all registered routes
console.log('Registered Routes:', listEndpoints(app));

app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/subtasks', subtaskRoutes);
app.use('/api/support-requests', supportRequestRoutes);
app.use('/api/globalSettings',   globalSettingRoutes);

app.use('/api/discussion', discussionRoutes);
app.use('/api/roi', roiRoutes);

app.use('/api/templates', templatesRouter);
app.use('/api/contracts', contractRoutes);
app.use('/api/financial-reports', financialReportRoutes);
app.use('/api/performance-reports', performanceReportRoutes);
app.use('/api/crm/settings', crmSettingsRoutes);
app.use('/api/crm/deals', crmDealRoutes);
app.use('/api/crm/reports', crmReportRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/buyside', buySideRoutes);

// Operations modules
app.use('/api/payroll', payrollRoutes);
app.use('/api/external-time', externalTimeRoutes);
app.use('/api/client-activity', clientActivityRoutes);
app.use('/api/commissions', commissionsRoutes);
app.use('/api/collaboration', collaborationRoutes);
app.use('/api/governance/calendar', governanceCalendarRoutes);
app.use('/api/governance/covenants', governanceCovenantRoutes);
app.use('/api/helpdesk', helpdeskRoutes);
app.use('/api/client-work', clientWorkRoutes);

scheduleRecurringCloneJob();
scheduleGovernanceDigestJob();


// Debug: Log environment variables
console.log('Environment Variables:', {
  DB_HOST: process.env.DB_HOST,
  DB_PORT: process.env.DB_PORT,
  DB_USER: process.env.DB_USER,
  DB_NAME: process.env.DB_NAME,
});


//Start the server
const PORT = process.env.PORT || 5000;
const PUBLIC_URL = process.env.PUBLIC_URL || 'https://portal.cfoworx.com';

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Server is running at ${PUBLIC_URL}`);
});
