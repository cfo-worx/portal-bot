import React, { useEffect, useMemo, useState, useContext } from "react";
import {
  Box,
  Tabs,
  Tab,
  Typography,
  Paper,
  Stack,
  Divider,
  FormControlLabel,
  Switch,
  CircularProgress,
  Alert,
} from "@mui/material";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";

import { AuthContext } from "../../context/AuthContext";
import { getClients, getActiveClients, getActiveClientsForConsultant } from "../../api/clients";
import { getClientWorkSettings, updateClientWorkSettings } from "../../api/clientWork";

import ClientWorkDashboard from "./tabs/ClientWorkDashboard";
import CloseTab from "./tabs/CloseTab";
import AIReportTab from "./tabs/AIReportTab";
import CashForecastTab from "./tabs/CashForecastTab";
import BoardPackTab from "./tabs/BoardPackTab";
import MarketIntelTab from "./tabs/MarketIntelTab";
import StaffEvalTab from "./tabs/StaffEvalTab";

function tabProps(index) {
  return {
    id: `client-work-tab-${index}`,
    "aria-controls": `client-work-tabpanel-${index}`,
  };
}

const DEFAULT_SETTINGS = {
  enableClose: true,
  enableAiReporting: true,
  enableCashForecast: true,
  enableBoardPack: true,
  enableMarketIntel: true,
  enableStaffEval: true,
  clientLogoUrl: "",
  materialityThreshold: 2500,
  glLookbackMonths: 3,
  cashWarningThreshold: 0,
  cashCriticalThreshold: 0,
  marketIntelMonthlyCap: 10,
  marketIntelQuery: {
    geography: "",
    competitors: [],
    keywords: [],
  },
};

export default function ClientWorkPage() {
  const { auth } = useContext(AuthContext);
  const user = auth?.user;

  const isManager = user?.roles?.includes("Manager") || false;
  const isAdmin = user?.roles?.includes("Admin") || false;
  const isConsultant = user?.roles?.includes("Consultant") || false;

  const [tabIndex, setTabIndex] = useState(0);
  const [clients, setClients] = useState([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [includeInactive, setIncludeInactive] = useState(false);

  const [selectedClient, setSelectedClient] = useState(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [settingsLoading, setSettingsLoading] = useState(false);

  const visibleTabs = useMemo(() => {
    const tabs = [
      { key: "dashboard", label: "Dashboard", enabled: true },
      { key: "close", label: "Close", enabled: settings.enableClose },
      { key: "ai", label: "AI Reporting", enabled: settings.enableAiReporting },
      { key: "cash", label: "13-Week Cash", enabled: settings.enableCashForecast },
      { key: "board", label: "Board Pack", enabled: settings.enableBoardPack },
      { key: "intel", label: "Market Intel", enabled: settings.enableMarketIntel },
      { key: "eval", label: "Staff Eval", enabled: settings.enableStaffEval && (isAdmin || isManager) },
    ];
    return tabs.filter((t) => t.enabled);
  }, [settings, isAdmin, isManager]);

  // Keep tabIndex in range if settings toggle hides a tab
  useEffect(() => {
    if (tabIndex >= visibleTabs.length) setTabIndex(0);
  }, [visibleTabs.length, tabIndex]);

  useEffect(() => {
    const loadClients = async () => {
      setClientsLoading(true);
      try {
        let res;
        if (isConsultant && !isManager && !isAdmin) {
          res = await getActiveClientsForConsultant(user.userId);
        } else if (includeInactive) {
          res = await getClients();
        } else {
          res = await getActiveClients();
        }

        const raw = Array.isArray(res)
          ? res
          : Array.isArray(res?.data)
            ? res.data
            : Array.isArray(res?.clients)
              ? res.clients
              : [];
        const list = raw
          .slice()
          .sort((a, b) => String(a.ClientName).localeCompare(String(b.ClientName)));
        setClients(list);

        // Select persisted client if still available
        const persisted = localStorage.getItem("clientWork.selectedClientId");
        const match = persisted ? list.find((c) => String(c.ClientID) === String(persisted)) : null;
        setSelectedClient(match || list[0] || null);
      } catch (e) {
        console.error("Failed to load clients", e);
        setClients([]);
      } finally {
        setClientsLoading(false);
      }
    };
    if (user?.userId) loadClients();
  }, [user?.userId, includeInactive, isConsultant, isManager, isAdmin]);

  useEffect(() => {
    const loadSettings = async () => {
      if (!selectedClient?.ClientID) return;
      setSettingsLoading(true);
      try {
        const res = await getClientWorkSettings(selectedClient.ClientID);
        const parsed = res?.data?.settings || {};
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
        localStorage.setItem("clientWork.selectedClientId", selectedClient.ClientID);
      } catch (e) {
        console.error("Failed to load client work settings", e);
        setSettings(DEFAULT_SETTINGS);
      } finally {
        setSettingsLoading(false);
      }
    };
    loadSettings();
  }, [selectedClient?.ClientID]);

  const saveSettings = async (next) => {
    if (!selectedClient?.ClientID) return;
    setSettings(next);
    try {
      await updateClientWorkSettings(selectedClient.ClientID, next);
    } catch (e) {
      console.error("Failed to save settings", e);
    }
  };

  const renderActivePanel = () => {
    const activeKey = visibleTabs[tabIndex]?.key;
    const clientId = selectedClient?.ClientID;
    if (!clientId) {
      return (
        <Box sx={{ p: 3 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            Select a client to view Client Work dashboards and tools.
          </Alert>
          <Typography variant="body2" color="text.secondary">
            Choose a client from the dropdown above. Once selected, this module will load the
            Dashboard, Close checklist / QA scan, AI Reporting, 13-week cash, Board Pack,
            Market Intelligence, and Staff Evaluation views.
          </Typography>
        </Box>
      );
    }

    switch (activeKey) {
      case "dashboard":
        return (
          <ClientWorkDashboard
            clientId={clientId}
            client={selectedClient}
            settings={settings}
            onNavigateTab={(key) => {
              const idx = visibleTabs.findIndex((t) => t.key === key);
              if (idx >= 0) setTabIndex(idx);
            }}
          />
        );
      case "close":
        return <CloseTab clientId={clientId} client={selectedClient} settings={settings} />;
      case "ai":
        return <AIReportTab clientId={clientId} client={selectedClient} settings={settings} />;
      case "cash":
        return <CashForecastTab clientId={clientId} client={selectedClient} settings={settings} />;
      case "board":
        return <BoardPackTab clientId={clientId} client={selectedClient} settings={settings} />;
      case "intel":
        return <MarketIntelTab clientId={clientId} client={selectedClient} settings={settings} onSaveSettings={saveSettings} />;
      case "eval":
        return <StaffEvalTab clientId={clientId} client={selectedClient} settings={settings} />;
      default:
        return null;
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }} justifyContent="space-between">
          <Box>
            <Typography variant="h5" fontWeight={700} gutterBottom>
              Client Work
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Close • QA Scan • AI Reporting • 13-Week Cash • Board Pack • Market Intel • Staff Evaluation
            </Typography>
          </Box>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
            {(isAdmin || isManager) && (
              <FormControlLabel
                control={<Switch checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} />}
                label="Include inactive"
              />
            )}

            <Autocomplete
              size="small"
              sx={{ minWidth: 320 }}
              options={clients}
              loading={clientsLoading}
              getOptionLabel={(o) => o?.ClientName || ""}
              value={selectedClient}
              onChange={(_, v) => setSelectedClient(v)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Select client"
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {clientsLoading ? <CircularProgress color="inherit" size={18} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />
          </Stack>
        </Stack>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Stack spacing={1}>
          <Tabs
            value={tabIndex}
            onChange={(_, v) => setTabIndex(v)}
            variant="scrollable"
            scrollButtons="auto"
          >
            {visibleTabs.map((t, idx) => (
              <Tab key={t.key} label={t.label} {...tabProps(idx)} />
            ))}
          </Tabs>
          <Divider />

          {settingsLoading ? (
            <Box sx={{ p: 4, display: "flex", justifyContent: "center" }}>
              <CircularProgress />
            </Box>
          ) : (
            <Box sx={{ pt: 2 }}>{renderActivePanel()}</Box>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}
