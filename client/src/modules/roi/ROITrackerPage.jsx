import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Box, Tab, Tabs, Typography } from '@mui/material';
import { AuthContext } from '../../context/AuthContext';
import RoiDashboard from './components/RoiDashboard';
import RoiWinsTable from './components/RoiWinsTable';
import RoiApprovals from './components/RoiApprovals';
import RoiSettings from './components/RoiSettings';

const ROITrackerPage = () => {
  const { auth } = useContext(AuthContext);
  const roles = auth?.user?.roles || [];

  const tabs = useMemo(() => {
    const base = [{ key: 'dashboard', label: 'Dashboard' }, { key: 'wins', label: 'Wins' }];
    if (roles.includes("Admin") || roles.includes('Manager')) {
      base.push({ key: 'approvals', label: 'Approvals' });
    }
    if (roles.includes('Admin')) {
      base.push({ key: 'settings', label: 'Settings' });
    }
    return base;
  }, [roles]);

  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    // Keep active tab valid when role changes
    if (activeTab > tabs.length - 1) setActiveTab(0);
  }, [tabs, activeTab]);

  if (!roles.length) {
    return (
      <Box p={2}>
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h4" sx={{ mb: 2 }}>
        ROI Tracker
      </Typography>

      <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 2 }}>
        {tabs.map((t) => (
          <Tab key={t.key} label={t.label} />
        ))}
      </Tabs>

      {tabs[activeTab]?.key === 'dashboard' && <RoiDashboard />}
      {tabs[activeTab]?.key === 'wins' && <RoiWinsTable />}
      {tabs[activeTab]?.key === 'approvals' && <RoiApprovals />}
      {tabs[activeTab]?.key === 'settings' && <RoiSettings />}
    </Box>
  );
};

export default ROITrackerPage;
