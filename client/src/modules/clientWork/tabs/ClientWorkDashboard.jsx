import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Grid,
  Paper,
  Typography,
  Stack,
  Button,
  Chip,
  Divider,
  CircularProgress,
} from "@mui/material";
import {
  getClientWorkDashboardSummary,
  listAccountingStaff,
} from "../../../api/clientWork";

function MetricCard({ title, value, subtitle, tone }) {
  const colorMap = {
    success: "success",
    warning: "warning",
    error: "error",
    info: "info",
    default: "default",
  };

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={1}>
        <Typography variant="subtitle2" color="text.secondary">
          {title}
        </Typography>
        <Typography variant="h5" sx={{ lineHeight: 1.1 }}>
          {value ?? "—"}
        </Typography>
        {subtitle ? (
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip
              size="small"
              label={tone ? tone.toUpperCase() : "INFO"}
              color={colorMap[tone] || "default"}
              variant="outlined"
            />
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          </Stack>
        ) : null}
      </Stack>
    </Paper>
  );
}

export default function ClientWorkDashboard({ clientId, settings, onNavigateTab }) {
  const [summary, setSummary] = useState(null);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(false);

  const tone = useMemo(() => {
    const cash = summary?.cashForecast;
    if (!cash) return "default";
    if (cash.alertLevel === "critical") return "error";
    if (cash.alertLevel === "warning") return "warning";
    return "success";
  }, [summary]);

  useEffect(() => {
    if (!clientId) return;
    (async () => {
      setLoading(true);
      try {
        const [dashRes, staffRes] = await Promise.all([
          getClientWorkDashboardSummary(clientId),
          listAccountingStaff(clientId),
        ]);
        setSummary(dashRes.data);
        setStaff(staffRes.data?.staff || []);
      } catch (e) {
        console.error("Client Work dashboard load failed", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [clientId]);

  if (!clientId) {
    return (
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography>Select a client to see the Client Work dashboard.</Typography>
      </Paper>
    );
  }

  if (loading) {
    return (
      <Box sx={{ p: 4, display: "flex", justifyContent: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Stack spacing={2}>
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <MetricCard
            title="Close"
            value={summary?.close?.periodKey || "—"}
            subtitle={
              summary?.close
                ? `${summary.close.checklistCompletionPct}% checklist • ${summary.close.openFlagsCount} open QA flags`
                : "Run Close checklist + QA scan"
            }
            tone={summary?.close?.openFlagsCount > 0 ? "warning" : "success"}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <MetricCard
            title="Cash Forecast (13w)"
            value={summary?.cashForecast?.latestEndingCashFormatted || "—"}
            subtitle={
              summary?.cashForecast
                ? `Scenario: ${summary.cashForecast.scenarioName} • Start: ${summary.cashForecast.startWeekEndingDate}`
                : "Create a 13-week forecast"
            }
            tone={tone}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <MetricCard
            title="AI Reporting"
            value={summary?.ai?.latestStatus || "—"}
            subtitle={
              summary?.ai
                ? `Latest period: ${summary.ai.latestPeriodKey}`
                : "Generate draft monthly commentary"
            }
            tone={summary?.ai?.latestStatus === "Published" ? "success" : "info"}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <MetricCard
            title="Board Pack"
            value={summary?.boardPack?.latestStatus || "—"}
            subtitle={
              summary?.boardPack
                ? `Latest: ${summary.boardPack.latestPeriodKey}`
                : "Build a board pack PDF"
            }
            tone={summary?.boardPack?.latestStatus === "Published" ? "success" : "info"}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <MetricCard
            title="Market Intelligence"
            value={summary?.marketIntel?.latestRunDate || "—"}
            subtitle={
              summary?.marketIntel
                ? `${summary.marketIntel.itemsCount} items in latest refresh`
                : "Refresh client + industry feed"
            }
            tone={summary?.marketIntel?.itemsCount > 0 ? "success" : "default"}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <MetricCard
            title="Open Tasks"
            value={summary?.tasks?.openCount ?? "—"}
            subtitle={summary?.tasks ? "From Collaboration module" : "No task data"}
            tone={summary?.tasks?.openCount > 0 ? "warning" : "success"}
          />
        </Grid>
      </Grid>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1}>
          <Typography variant="subtitle1">Quick actions</Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button variant="contained" onClick={() => onNavigateTab?.("close")}>Close</Button>
            <Button variant="outlined" onClick={() => onNavigateTab?.("ai")}>AI Report</Button>
            <Button variant="outlined" onClick={() => onNavigateTab?.("cash")}>Cash Forecast</Button>
            <Button variant="outlined" onClick={() => onNavigateTab?.("board")}>Board Pack</Button>
            <Button variant="outlined" onClick={() => onNavigateTab?.("intel")}>Market Intel</Button>
            <Button variant="outlined" onClick={() => onNavigateTab?.("eval")}>Staff Eval</Button>
          </Stack>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1}>
          <Typography variant="subtitle1">Internal accounting staff contacts</Typography>
          <Typography variant="body2" color="text.secondary">
            Add/update these in **Staff Eval** → Staff List.
          </Typography>
          <Divider />
          {staff.length === 0 ? (
            <Typography variant="body2">No internal accounting staff configured for this client yet.</Typography>
          ) : (
            <Stack spacing={1}>
              {staff.map((s) => (
                <Paper key={s.StaffID} variant="outlined" sx={{ p: 1.5 }}>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between">
                    <Box>
                      <Typography variant="subtitle2">{s.Name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {s.RoleTitle || "—"}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} alignItems="center">
                      {s.Email ? (
                        <Button size="small" href={`mailto:${s.Email}`}>
                          Email
                        </Button>
                      ) : null}
                      {s.IsActive ? <Chip size="small" label="Active" color="success" variant="outlined" /> : <Chip size="small" label="Inactive" variant="outlined" />}
                    </Stack>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}
