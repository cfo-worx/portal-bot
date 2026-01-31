import React, { useEffect, useMemo, useState } from 'react';
import { Box, Tabs, Tab, Typography } from '@mui/material';

import SalesCRM from './components/SalesCRM';
import CRMSettings from './components/CRMSettings';
import CRMReports from './components/CRMReports';
import ProspectQueue from './components/ProspectQueue';
import LeadDatabase from './components/LeadDatabase';

const CRMPage = ({ activeRole }) => {
  const canManageCRM = activeRole === 'Admin' || activeRole === 'Manager';
  const canSeeLeadDb = canManageCRM; // Option B selected: Admin + Manager only
  const canSeeReports = canManageCRM;
  const canSeeSettings = canManageCRM;
  const canSeeProspectQueue = activeRole === 'Sales' || canManageCRM;

  const tabs = useMemo(() => {
    const base = [
      { key: 'sales', label: 'Sales Pipeline' },
      ...(canSeeLeadDb ? [{ key: 'leads', label: 'Lead Database' }] : []),
      ...(canSeeProspectQueue ? [{ key: 'queue', label: 'Prospect Queue' }] : []),
      { key: 'sell', label: 'M&A Sell-Side' },
      { key: 'buy', label: 'M&A Buy-Side' },
      ...(canSeeReports ? [{ key: 'reports', label: 'Reports' }] : []),
      ...(canSeeSettings ? [{ key: 'settings', label: 'Settings' }] : []),
    ];
    return base;
  }, [canSeeLeadDb, canSeeProspectQueue, canSeeReports, canSeeSettings]);

  const [activeTab, setActiveTab] = useState(tabs[0]?.key || 'sales');

  // If tabs change (role switch), ensure active tab is still valid
  useEffect(() => {
    if (!tabs.some((t) => t.key === activeTab)) {
      setActiveTab(tabs[0]?.key || 'sales');
    }
  }, [tabs, activeTab]);

  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="h4" sx={{ mb: 2 }}>
        CRM
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs
          value={activeTab}
          onChange={(e, newVal) => setActiveTab(newVal)}
          variant="scrollable"
          scrollButtons="auto"
        >
          {tabs.map((tab) => (
            <Tab key={tab.key} value={tab.key} label={tab.label} />
          ))}
        </Tabs>
      </Box>

      <Box sx={{ mt: 2 }}>
        {activeTab === 'sales' && (
          <SalesCRM activeRole={activeRole} module="sales" />
        )}

        {activeTab === 'leads' && canSeeLeadDb && (
          <LeadDatabase activeRole={activeRole} />
        )}

        {activeTab === 'queue' && canSeeProspectQueue && (
          <ProspectQueue activeRole={activeRole} />
        )}

        {activeTab === 'sell' && (
          <SalesCRM
            activeRole={activeRole}
            module="sell"
            title="M&A Sell-Side Pipeline"
          />
        )}

        {activeTab === 'buy' && (
          <SalesCRM
            activeRole={activeRole}
            module="buy"
            title="M&A Buy-Side Pipeline"
            enableClientCampaignFilters
          />
        )}

        {activeTab === 'reports' && canSeeReports && (
          <CRMReports activeRole={activeRole} />
        )}

        {activeTab === 'settings' && canSeeSettings && <CRMSettings />}
      </Box>
    </Box>
  );
};

export default CRMPage;
