import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Stack,
  Divider,
  TextField,
  Button,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  Chip,
  CircularProgress,
  IconButton,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";

import {
  getCashForecast,
  createOrGetCashForecast,
  upsertCashForecastLine,
  deleteCashForecastLine,
} from "../../../api/clientWork";

function fmtMoney(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "-";
  return Number(n).toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function defaultStartFriday() {
  const d = new Date();
  // set to most recent Friday
  const day = d.getDay();
  const diff = (day >= 5 ? day - 5 : day + 2);
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}

export default function CashForecastTab({ clientId, clientName }) {
  const [scenarioName, setScenarioName] = useState("Base");
  const [startWeekEnding, setStartWeekEnding] = useState(defaultStartFriday());
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const [newLine, setNewLine] = useState({
    weekEndingDate: defaultStartFriday(),
    lineType: "Other",
    counterpartyType: "",
    counterpartyName: "",
    amount: "",
    description: "",
    notes: "",
  });

  const load = async () => {
    if (!clientId) return;
    setBusy(true);
    setErr("");
    try {
      const { data: res } = await getCashForecast(clientId, scenarioName, startWeekEnding);
      setData(res);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || "Failed to load cash forecast");
      setData(null);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, scenarioName, startWeekEnding]);

  const ensureForecast = async () => {
    if (!clientId) return;
    setBusy(true);
    setErr("");
    try {
      await createOrGetCashForecast(clientId, scenarioName, startWeekEnding);
      await load();
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || "Failed to create forecast");
    } finally {
      setBusy(false);
    }
  };

  const onAddLine = async () => {
    if (!data?.forecastId) return;
    setBusy(true);
    setErr("");
    try {
      await upsertCashForecastLine(data.forecastId, {
        ...newLine,
        amount: Number(newLine.amount),
      });
      setNewLine((prev) => ({ ...prev, amount: "", description: "", notes: "" }));
      await load();
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || "Failed to add line");
    } finally {
      setBusy(false);
    }
  };

  const onDeleteLine = async (lineId) => {
    setBusy(true);
    setErr("");
    try {
      await deleteCashForecastLine(lineId);
      await load();
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || "Failed to delete line");
    } finally {
      setBusy(false);
    }
  };

  const warning = data?.thresholds?.warning;
  const critical = data?.thresholds?.critical;

  const alertFor = (endingCash) => {
    if (critical !== null && critical !== undefined && endingCash <= critical) return { label: "Critical", color: "error" };
    if (warning !== null && warning !== undefined && endingCash <= warning) return { label: "Warning", color: "warning" };
    return null;
  };

  const lines = data?.lines || [];

  return (
    <Stack spacing={2}>
      <Paper sx={{ p: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
          <Typography variant="h6" sx={{ flex: 1 }}>
            13‑Week Cash Forecast
          </Typography>
          <TextField
            select
            size="small"
            label="Scenario"
            value={scenarioName}
            onChange={(e) => setScenarioName(e.target.value)}
            sx={{ width: 140 }}
          >
            <MenuItem value="Base">Base</MenuItem>
            <MenuItem value="Downside">Downside</MenuItem>
          </TextField>
          <TextField
            size="small"
            label="Start (Friday)"
            type="date"
            value={startWeekEnding}
            onChange={(e) => setStartWeekEnding(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 170 }}
          />
          <Button variant="outlined" onClick={ensureForecast} disabled={!clientId || busy}>
            Create / Get
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
        {busy && !data && (
          <Stack direction="row" spacing={1} alignItems="center">
            <CircularProgress size={18} />
            <Typography variant="body2">Loading…</Typography>
          </Stack>
        )}

        {!data && !busy && (
          <Alert severity="info">No forecast yet for this client/scenario. Click “Create / Get”.</Alert>
        )}

        {data && (
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
                <Typography variant="subtitle2">Starting cash</Typography>
                <Typography variant="h6">{fmtMoney(data.startingCashBalanceOverride)}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Source: {data.startingCashSource || "Manual / QBO"}
                </Typography>
              </Paper>
              <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
                <Typography variant="subtitle2">Liquidity available</Typography>
                <Typography variant="h6">{fmtMoney(data.startingLiquidityAvailable)}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Optional line for revolver / credit availability.
                </Typography>
              </Paper>
              <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
                <Typography variant="subtitle2">Thresholds</Typography>
                <Typography variant="body2">Warning: {fmtMoney(warning)}</Typography>
                <Typography variant="body2">Critical: {fmtMoney(critical)}</Typography>
              </Paper>
            </Stack>

            <Divider />

            <Typography variant="subtitle1">13-week view</Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Week ending (Fri)</TableCell>
                    <TableCell align="right">Opening</TableCell>
                    <TableCell align="right">Inflows</TableCell>
                    <TableCell align="right">Outflows</TableCell>
                    <TableCell align="right">Ending</TableCell>
                    <TableCell>Alert</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(data.weeks || []).map((w) => {
                    const al = alertFor(w.endingCash);
                    return (
                      <TableRow key={w.weekEndingDate}>
                        <TableCell>{w.weekEndingDate}</TableCell>
                        <TableCell align="right">{fmtMoney(w.openingCash)}</TableCell>
                        <TableCell align="right">{fmtMoney(w.inflows)}</TableCell>
                        <TableCell align="right">{fmtMoney(w.outflows)}</TableCell>
                        <TableCell align="right">{fmtMoney(w.endingCash)}</TableCell>
                        <TableCell>{al ? <Chip size="small" label={al.label} color={al.color} /> : ""}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>

            <Divider />

            <Typography variant="subtitle1">Line items</Typography>
            <Typography variant="caption" color="text.secondary">
              Tip: Keep entries at the <b>Friday week-ending</b> level for now. You can still add notes for known delays.
            </Typography>

            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Week</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Counterparty</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell>Notes</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {lines.map((l) => (
                    <TableRow key={l.lineId}>
                      <TableCell>{l.weekEndingDate}</TableCell>
                      <TableCell>{l.lineType}</TableCell>
                      <TableCell>{l.counterpartyName || "-"}</TableCell>
                      <TableCell>{l.description || "-"}</TableCell>
                      <TableCell align="right">{fmtMoney(l.amount)}</TableCell>
                      <TableCell>
                        {l.clientNote ? (
                          <Chip size="small" color="info" label="Client note" sx={{ mr: 1 }} />
                        ) : null}
                        {l.notes || ""}
                      </TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => onDeleteLine(l.lineId)} disabled={busy}>
                          <DeleteIcon fontSize="inherit" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}

                  <TableRow>
                    <TableCell>
                      <TextField
                        type="date"
                        size="small"
                        value={newLine.weekEndingDate}
                        onChange={(e) => setNewLine((p) => ({ ...p, weekEndingDate: e.target.value }))}
                        InputLabelProps={{ shrink: true }}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        select
                        size="small"
                        value={newLine.lineType}
                        onChange={(e) => setNewLine((p) => ({ ...p, lineType: e.target.value }))}
                        sx={{ minWidth: 120 }}
                      >
                        {[
                          "OpeningBalance",
                          "AR",
                          "AP",
                          "Payroll",
                          "Debt",
                          "Capex",
                          "Other",
                        ].map((t) => (
                          <MenuItem key={t} value={t}>
                            {t}
                          </MenuItem>
                        ))}
                      </TextField>
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        value={newLine.counterpartyName}
                        onChange={(e) => setNewLine((p) => ({ ...p, counterpartyName: e.target.value }))}
                        placeholder="Customer / Vendor"
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        value={newLine.description}
                        onChange={(e) => setNewLine((p) => ({ ...p, description: e.target.value }))}
                        placeholder="Description"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <TextField
                        size="small"
                        value={newLine.amount}
                        onChange={(e) => setNewLine((p) => ({ ...p, amount: e.target.value }))}
                        placeholder="0.00"
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        value={newLine.notes}
                        onChange={(e) => setNewLine((p) => ({ ...p, notes: e.target.value }))}
                        placeholder="Notes"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        variant="contained"
                        size="small"
                        onClick={onAddLine}
                        disabled={busy || !newLine.weekEndingDate || !newLine.amount}
                      >
                        Add
                      </Button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        )}
      </Paper>
    </Stack>
  );
}
