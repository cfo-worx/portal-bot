import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Stack,
  Divider,
  Button,
  TextField,
  MenuItem,
  CircularProgress,
  Alert,
  Chip,
} from "@mui/material";

import {
  createAiRun,
  listAiRuns,
  getAiRun,
  generateAiRun,
  updateAiRun,
  publishAiRun,
  lockAiRun,
} from "../../../api/clientWork";

function fmt(dt) {
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return String(dt || "");
  }
}

function defaultPeriodKey() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export default function AIReportTab({ clientId, clientName }) {
  const [periodKey, setPeriodKey] = useState(defaultPeriodKey());
  const [runs, setRuns] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selected, setSelected] = useState(null);

  const [inputJsonText, setInputJsonText] = useState(
    JSON.stringify(
      {
        // Optional structured inputs that reduce hallucination risk.
        // Add what you have (from LiveFlow/QBO exports) and leave the rest blank.
        highlights: [],
        financials: {
          month: periodKey,
          revenue: null,
          grossProfit: null,
          grossMarginPct: null,
          opex: null,
          ebitda: null,
          cashChange: null,
        },
        budget: {
          revenue: null,
          grossProfit: null,
          opex: null,
          ebitda: null,
        },
        ytd: {},
        forwardLook: {
          mtdAsOf: new Date().toISOString().slice(0, 10),
          mtdRevenue: null,
          mtdEbitda: null,
          nextMonthBudgetRevenue: null,
          nextMonthBudgetEbitda: null,
        },
        meetingThemes: [],
      },
      null,
      2
    )
  );

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const canEdit = useMemo(() => {
    if (!selected) return true;
    return selected.status !== "Locked";
  }, [selected]);

  const loadRuns = async () => {
    if (!clientId) return;
    setErr("");
    try {
      const { data } = await listAiRuns(clientId);
      const runsArray = Array.isArray(data) ? data : [];
      setRuns(runsArray);
      if (!selectedId && runsArray.length) setSelectedId(runsArray[0].aiRunId);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || "Failed to load AI runs");
    }
  };

  const loadSelected = async (aiRunId) => {
    if (!aiRunId) {
      setSelected(null);
      return;
    }
    setErr("");
    try {
      const { data } = await getAiRun(aiRunId);
      setSelected(data);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || "Failed to load run");
    }
  };

  useEffect(() => {
    loadRuns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  useEffect(() => {
    loadSelected(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const onCreateRun = async () => {
    setBusy(true);
    setErr("");
    try {
      const { data } = await createAiRun(clientId, periodKey);
      await loadRuns();
      setSelectedId(data.aiRunId);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || "Failed to create run");
    } finally {
      setBusy(false);
    }
  };

  const onGenerateDraft = async () => {
    if (!selectedId) return;
    setBusy(true);
    setErr("");
    try {
      let inputData = null;
      try {
        inputData = JSON.parse(inputJsonText);
      } catch {
        // keep null; server will fallback to generic
      }
      await generateAiRun(selectedId, { inputData });
      await loadSelected(selectedId);
      await loadRuns();
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || "Failed to generate draft");
    } finally {
      setBusy(false);
    }
  };

  const onSaveEdits = async () => {
    if (!selectedId || !selected) return;
    setBusy(true);
    setErr("");
    try {
      await updateAiRun(selectedId, {
        outputJson: selected.outputJson,
        outputEmailText: selected.outputEmailText,
      });
      await loadSelected(selectedId);
      await loadRuns();
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || "Failed to save");
    } finally {
      setBusy(false);
    }
  };

  const onPublish = async () => {
    if (!selectedId) return;
    setBusy(true);
    setErr("");
    try {
      await publishAiRun(selectedId);
      await loadSelected(selectedId);
      await loadRuns();
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || "Failed to publish");
    } finally {
      setBusy(false);
    }
  };

  const onLock = async () => {
    if (!selectedId) return;
    setBusy(true);
    setErr("");
    try {
      await lockAiRun(selectedId);
      await loadSelected(selectedId);
      await loadRuns();
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || "Failed to lock");
    } finally {
      setBusy(false);
    }
  };

  const statusChip = (s) => {
    const map = {
      Draft: "default",
      Published: "success",
      Locked: "warning",
      Error: "error",
    };
    return <Chip size="small" label={s || "-"} color={map[s] || "default"} />;
  };

  return (
    <Stack spacing={2}>
      <Paper sx={{ p: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
          <Typography variant="h6" sx={{ flex: 1 }}>
            AI Reporting Engine
          </Typography>
          <TextField
            select
            label="Period"
            value={periodKey}
            onChange={(e) => setPeriodKey(e.target.value)}
            size="small"
            sx={{ width: 140 }}
          >
            {[0, 1, 2, 3, 4, 5].map((i) => {
              const d = new Date();
              d.setMonth(d.getMonth() - i - 1);
              const y = d.getFullYear();
              const m = String(d.getMonth() + 1).padStart(2, "0");
              const k = `${y}-${m}`;
              return (
                <MenuItem key={k} value={k}>
                  {k}
                </MenuItem>
              );
            })}
          </TextField>
          <Button variant="contained" onClick={onCreateRun} disabled={!clientId || busy}>
            New run
          </Button>
          <Button variant="outlined" onClick={loadRuns} disabled={!clientId || busy}>
            Refresh
          </Button>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Client: <b>{clientName || "(select a client)"}</b>
        </Typography>
        {err && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {err}
          </Alert>
        )}
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <Box sx={{ minWidth: 260 }}>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              Runs
            </Typography>
            <Stack spacing={1}>
              {(!Array.isArray(runs) || runs.length === 0) && (
                <Typography variant="body2" color="text.secondary">
                  No runs yet.
                </Typography>
              )}
              {(Array.isArray(runs) ? runs : []).map((r) => (
                <Paper
                  key={r.aiRunId}
                  variant="outlined"
                  sx={{
                    p: 1,
                    cursor: "pointer",
                    borderColor: selectedId === r.aiRunId ? "primary.main" : "divider",
                  }}
                  onClick={() => setSelectedId(r.aiRunId)}
                >
                  <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {r.periodKey}
                    </Typography>
                    {statusChip(r.status)}
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    Updated: {fmt(r.updatedAt)}
                  </Typography>
                </Paper>
              ))}
            </Stack>
          </Box>

          <Divider flexItem orientation="vertical" sx={{ display: { xs: "none", md: "block" } }} />

          <Box sx={{ flex: 1 }}>
            {!selectedId && (
              <Typography variant="body2" color="text.secondary">
                Create/select a run to view details.
              </Typography>
            )}

            {selectedId && !selected && (
              <Stack direction="row" spacing={1} alignItems="center">
                <CircularProgress size={18} />
                <Typography variant="body2">Loading run…</Typography>
              </Stack>
            )}

            {selected && (
              <Stack spacing={2}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="center">
                  <Typography variant="subtitle1" sx={{ flex: 1 }}>
                    Run: {selected.periodKey} {statusChip(selected.status)}
                  </Typography>
                  <Button variant="contained" onClick={onGenerateDraft} disabled={busy || !canEdit}>
                    Generate / refresh draft
                  </Button>
                  <Button variant="outlined" onClick={onSaveEdits} disabled={busy || !canEdit}>
                    Save edits
                  </Button>
                  <Button variant="outlined" color="success" onClick={onPublish} disabled={busy || !canEdit}>
                    Publish
                  </Button>
                  <Button variant="outlined" color="warning" onClick={onLock} disabled={busy || selected.status === "Locked"}>
                    Lock
                  </Button>
                </Stack>

                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2">Structured inputs (optional)</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Paste a JSON payload of key metrics to reduce hallucination risk. If you leave it invalid/blank, the server
                    will generate a conservative placeholder draft.
                  </Typography>
                  <TextField
                    value={inputJsonText}
                    onChange={(e) => setInputJsonText(e.target.value)}
                    multiline
                    minRows={10}
                    fullWidth
                    sx={{ mt: 1 }}
                    disabled={!canEdit}
                  />
                </Paper>

                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2">Email commentary (editable)</Typography>
                  <TextField
                    value={selected.outputEmailText || ""}
                    onChange={(e) =>
                      setSelected((prev) => ({
                        ...prev,
                        outputEmailText: e.target.value,
                      }))
                    }
                    multiline
                    minRows={12}
                    fullWidth
                    sx={{ mt: 1 }}
                    disabled={!canEdit}
                  />
                </Paper>

                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2">Draft JSON (editable)</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Stored as JSON for downstream rendering (board pack builder). You can safely edit text fields.
                  </Typography>
                  <TextField
                    value={
                      typeof selected.outputJson === "string"
                        ? selected.outputJson
                        : JSON.stringify(selected.outputJson || {}, null, 2)
                    }
                    onChange={(e) => setSelected((prev) => ({ ...prev, outputJson: e.target.value }))}
                    multiline
                    minRows={12}
                    fullWidth
                    sx={{ mt: 1 }}
                    disabled={!canEdit}
                  />
                </Paper>
              </Stack>
            )}
          </Box>
        </Stack>
      </Paper>
    </Stack>
  );
}
