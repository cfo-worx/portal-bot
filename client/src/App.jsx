// frontend/src/App.jsx

import React, { useState, useEffect, useContext } from 'react';
import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
} from 'react-router-dom';

import SignInPage from './pages/SignInPage';
import SetPasswordPage from './pages/SetPasswordPage';
import DashboardLayout from './components/Layout/DashboardLayout';
import PrivateRoute from './components/PrivateRoute';
import NotFoundPage from './pages/NotFoundPage';
import { AuthProvider, AuthContext } from './context/AuthContext';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';

// Admin Pages
import AdminDashboardPage from './modules/admin/pages/DashboardPage';
import AdminClientsPage from './modules/admin/pages/ClientsPage';
import AdminTeamPage from './modules/admin/pages/TeamPage';
import AdminUsersPage from './modules/admin/pages/UsersPage';
import AdminProfilePage from './modules/admin/pages/ProfilePage';
import AdminSettingsPage from './modules/admin/pages/SettingsPage';
import AdminTimesheetsPage from './modules/admin/pages/TimesheetsPage';
import FinancialReportingPage from './modules/admin/pages/FinancialReportingPage';
import CRMPage from './modules/crm/CRMPage';
import ROITrackerPage from './modules/roi/ROITrackerPage';
import PayrollPage from './modules/payroll/PayrollPage';
import CommissionsPage from './modules/commissions/CommissionsPage';
import CollaborationPage from './modules/collaboration/CollaborationPage';
import HelpdeskPage from './modules/helpdesk/HelpdeskPage';
import ClientWorkPage from './modules/clientWork/ClientWorkPage';

// Client Pages
import ReportsPage from './modules/client/pages/ReportsPage';

// Consultant Pages
import CalendarPage from './modules/consultant/pages/CalendarPage';
import TimecardHistoryPage from './modules/consultant/pages/TimecardHistoryPage';
import ConsultantFeed from './modules/consultant/pages/ConsultantFeed';
import ConsultantPM from './modules/consultant/pages/ConsultantPM';

// Manager Pages
import ProjectsPage from './modules/manager/pages/ProjectsPage';
import ProjectsTemplate from './modules/manager/pages/ProjectsTemplate';
import ProjectsDashboard from './modules/manager/pages/ProjectsDashboard';
import ClientLanding from './modules/client/pages/ClientLanding';

// Reports Page
import NewReportsPage from './modules/reports/ReportsPage';
import GovernancePage from './modules/governance/pages/GovernancePage';

import CRMAppMock from "./modules/crm-mock/CRMApp";

const stripePromise = loadStripe('pk_test_51IW8vEB2VVReBGDXnn7GYjL07pPE17sztxLahJGlDPNmXVGfqOybM4hNUHWRUQ1c3zqNkojS7lfhxmJJv9oEpw61008pPpVBNs');

const App = () => {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
};

const AppRoutes = () => {
  const { auth, signIn, signOut } = useContext(AuthContext);
  const [activeRole, setActiveRole] = useState('');

  // On login, pick the first role if nothing was chosen yet
  useEffect(() => {
    if (auth.user?.roles && auth.user.roles.length > 0) {
      setActiveRole((prev) =>
        auth.user.roles.includes(prev) ? prev : auth.user.roles[0]
      );
      console.log('User roles:', auth.user.roles);
    }
  }, [auth.user]);

  return (
    <Routes>
      {/* 1) Public */}
      <Route
        path="/signin"
        element={
          auth.isAuthenticated ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <SignInPage onSignIn={signIn} />
          )
        }
      />
      <Route path="/set-password/:inviteToken" element={<SetPasswordPage />} />

      {/* 2) Protected: everything under /dashboard uses DashboardLayout */}
      <Route
        path="/dashboard/*"
        element={
          <PrivateRoute>
            <DashboardLayout
              activeRole={activeRole}
              setActiveRole={setActiveRole}
              userRoles={auth.user?.roles || []}
              onSignOut={signOut}
            />
          </PrivateRoute>
        }
      >
        {/*
          Index route: immediately redirect to whichever top-level route matches activeRole
        */}
        <Route
          index
          element={
            auth.user?.roles.includes('Admin') ? (
              <Navigate to="admin" replace />
            ) : auth.user?.roles.includes('Consultant') ? (
              <Navigate to="consultant" replace />
            ) : auth.user?.roles.includes('Manager') ? (
              <Navigate to="manager/projects" replace />
            ) : auth.user?.roles.includes('Sales') ? (
              <Navigate to="sales/crm" replace />
            ) : auth.user?.roles.includes('Client') ? (
              <Navigate to="client/reports" replace />
            ) : (
              <NotFoundPage />
            )
          }
        />

        {/* ------ Admin Routes ------ */}
        {auth.user?.roles.includes('Admin') && (
          <Route path="admin/*">
            <Route index element={<AdminDashboardPage />} />
            <Route path="clients" element={<AdminClientsPage />} />
            <Route path="team" element={<AdminTeamPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="profile" element={<AdminProfilePage />} />
            <Route path="settings" element={<AdminSettingsPage />} />
            <Route path="timesheets" element={<AdminTimesheetsPage />} />
            <Route path="financial-reporting" element={<FinancialReportingPage />} />
            <Route path="reports" element={<NewReportsPage />} />
            <Route path="payroll" element={<PayrollPage />} />
            <Route path="commissions" element={<CommissionsPage />} />
            <Route path="collaboration" element={<CollaborationPage />} />
            <Route path="crm" element={<CRMPage activeRole={activeRole} />} />
            <Route path="roi-tracker" element={<ROITrackerPage />} />
            <Route path="client-work" element={<ClientWorkPage />} />
            <Route path="governance" element={<GovernancePage />} />
            <Route path="helpdesk" element={<HelpdeskPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        )}

        {/* ------ Consultant Routes ------ */}
        {auth.user?.roles.includes('Consultant') && (
          <Route path="consultant/*">
            <Route index element={<ConsultantFeed />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="history" element={<TimecardHistoryPage />} />
            <Route path="feed" element={<ConsultantFeed />} />
            <Route path="projects" element={<ConsultantPM />} />
            <Route path="crm" element={<CRMPage activeRole={activeRole} />} />
            <Route path="roi-tracker" element={<ROITrackerPage />} />
            <Route path="client-work" element={<ClientWorkPage />} />
            <Route path="helpdesk" element={<HelpdeskPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        )}

        {/* ------ Manager Routes ------ */}
        {auth.user?.roles.includes('Manager') && (
          <Route path="manager/*">
            <Route index element={<Navigate to="projectsDashboard" replace />} />
            <Route path="projectsDashboard" element={<ProjectsDashboard />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="templates" element={<ProjectsTemplate />} />
            <Route path="reports" element={<NewReportsPage />} />
            <Route path="commissions" element={<CommissionsPage />} />
            <Route path="collaboration" element={<CollaborationPage />} />
            <Route path="crm" element={<CRMPage activeRole={activeRole} />} />
            <Route path="roi-tracker" element={<ROITrackerPage />} />
            <Route path="client-work" element={<ClientWorkPage />} />
            <Route path="governance" element={<GovernancePage />} />
            <Route path="helpdesk" element={<HelpdeskPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        )}


        {/* ------ Sales Routes ------ */}
        {auth.user?.roles.includes('Sales') && (
          <Route path="sales/*">
            <Route index element={<Navigate to="crm" replace />} />
            <Route path="crm" element={<CRMPage activeRole={activeRole} />} />
            <Route path="commissions" element={<CommissionsPage />} />
            <Route path="history" element={<TimecardHistoryPage />} />
            <Route path="helpdesk" element={<HelpdeskPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        )}

        {/* ------ Client Routes ------ */}
        {auth.user?.roles.includes('Client') && (
          <Route path="client/*">
            <Route index element={<Navigate to="reports" replace />} />
            <Route path="reports" element={<ClientLanding />} />
            <Route path="helpdesk" element={<HelpdeskPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        )}

        {/* Catch-all if somehow none of the above matched */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      <Route path="/crm-mock" element={<CRMAppMock />} />

      {/* 3) If no route matched, go home */}
      <Route path="*" element={<Navigate to="/signin" replace />} />
    </Routes>
  );
};

export default App;
