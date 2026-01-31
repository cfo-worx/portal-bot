import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Stack,
  Divider,
  TextField,
  Button,
  CircularProgress,
  Checkbox,
  FormControlLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Alert,
} from "@mui/material";
import {
  getOrCreateCloseRun,
  updateCloseChecklistItem,
  uploadCloseGL,
  runCloseQAScan,
  getCloseQAFlags,
  updateCloseQAFlag,
} from "../../../api/clientWork";

function monthKeyFromDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function defaultPeriodKey() {
  const now = new Date();
  // Default to previous month (common workflow: mid-month reporting prior month)
  const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return monthKeyFromDate(prev);
}

function severityChip(sev) {
  const s = String(sev || "").toLowerCase();
  if (s === "critical") return <Chip size="small" label="CRITICAL" color="error" variant="outlined" />;
  if (s === "warning") return <Chip size="small" label="WARNING" color="warning" variant="outlined" />;
  return <Chip size="small" label={sev || "INFO"} variant="outlined" />;
}

export default function CloseTab({ clientId }) {
  const [periodKey, setPeriodKey] = useState(defaultPeriodKey());
  const [run, setRun] = useState(null);
  const [items, setItems] = useState([]);
  const [scanRunId, setScanRunId] = useState(null);
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const completionPct = useMemo(() => {
    if (!items?.length) return 0;
    const done = items.filter((i) => i.IsComplete).length;
    return Math.round((done / items.length) * 100);
  }, [items]);

  const load = async () => {
    if (!clientId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getOrCreateCloseRun(clientId, periodKey);
      setRun(res.data?.run || null);
      setItems(res.data?.items || []);
      setScanRunId(res.data?.run?.LatestScanRunID || null);
      if (res.data?.run?.LatestScanRunID) {
        const flagsRes = await getCloseQAFlags(res.data.run.LatestScanRunID);
        setFlags(flagsRes.data?.flags || []);
      } else {
        setFlags([]);
      }
    } catch (e) {
      console.error("Close tab load failed", e);
      setError(e?.response?.data?.message || "Failed to load Close data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, periodKey]);

  const onToggleItem = async (itemId, checked) => {
    setItems((prev) => prev.map((i) => (i.ItemID === itemId ? { ...i, IsComplete: checked } : i)));
    try {
      await updateCloseChecklistItem(itemId, { isComplete: checked });
    } catch (e) {
      console.error("Update checklist item failed", e);
      // revert
      setItems((prev) => prev.map((i) => (i.ItemID === itemId ? { ...i, IsComplete: !checked } : i)));
    }
  };

  const onUpdateItemNotes = async (itemId, notes) => {
    setItems((prev) => prev.map((i) => (i.ItemID === itemId ? { ...i, Notes: notes } : i)));
    try {
      await updateCloseChecklistItem(itemId, { notes });
    } catch (e) {
      console.error("Update checklist notes failed", e);
    }
  };

  const onUploadGL = async (file) => {
    if (!file || !clientId) return;
    setUploading(true);
    setError(null);
    try {
      const upRes = await uploadCloseGL(clientId, periodKey, file);
      const scanId = upRes.data?.scanRunId;
      setScanRunId(scanId);
      await runCloseQAScan(scanId, { lookbackMonths: 3 });
      const flagsRes = await getCloseQAFlags(scanId);
      setFlags(flagsRes.data?.flags || []);
      await load();
    } catch (e) {
      console.error("Upload / run QA scan failed", e);
      setError(e?.response?.data?.message || "Upload/scan failed.");
    } finally {
      setUploading(false);
    }
  };

  const exportFlagsCsv = () => {
    if (!flags?.length) return;
    const header = [
      "Severity",
      "Category",
      "Account",
      "Vendor",
      "Customer",
      "TxnDate",
      "Amount",
      "Description",
      "SuggestedFix",
      "Status",
      "ReviewerNotes",
    ];
    const rows = flags.map((f) => [
      f.Severity || "",
      f.Category || "",
      f.AccountName || "",
      f.VendorName || "",
      f.CustomerName || "",
      f.TxnDate || "",
      f.Amount ?? "",
      (f.Description || "").replace(/\r?\n/g, " "),
      (f.SuggestedFix || "").replace(/\r?\n/g, " "),
      f.Status || "",
      (f.ReviewerNotes || "").replace(/\r?\n/g, " "),
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `close_qa_flags_${periodKey}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onUpdateFlag = async (flagId, patch) => {
    setFlags((prev) => prev.map((f) => (f.FlagID === flagId ? { ...f, ...patch } : f)));
    try {
      await updateCloseQAFlag(flagId, patch);
    } catch (e) {
      console.error("Update flag failed", e);
      await load();
    }
  };

  if (!clientId) {
    return (
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography>Select a client to run monthly close.</Typography>
      </Paper>
    );
  }

  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1}>
          <Typography variant="h6">Close</Typography>
          <Typography variant="body2" color="text.secondary">
            Checklist + QA Scan (G/L variance + error detection). Upload an exported G/L CSV and the system will generate a review list.
          </Typography>
          <Divider />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
            <TextField
              label="Period (YYYY-MM)"
              value={periodKey}
              onChange={(e) => setPeriodKey(e.target.value)}
              size="small"
              sx={{ width: 160 }}
            />
            <Chip label={`Checklist: ${completionPct}%`} color={completionPct === 100 ? "success" : "default"} variant="outlined" />
            {run?.Status ? <Chip label={`Run: ${run.Status}`} variant="outlined" /> : null}
          </Stack>
          {error ? <Alert severity="error">{error}</Alert> : null}
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle1">Close checklist</Typography>
        {loading ? (
          <Box sx={{ p: 3, display: "flex", justifyContent: "center" }}>
            <CircularProgress />
          </Box>
        ) : (
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            {items.map((item) => (
              <Paper key={item.ItemID} variant="outlined" sx={{ p: 1.5 }}>
                <Stack spacing={1}>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }} justifyContent="space-between">
                    <FormControlLabel
                      control={<Checkbox checked={!!item.IsComplete} onChange={(e) => onToggleItem(item.ItemID, e.target.checked)} />}
                      label={item.ItemLabel}
                    />
                    <Chip size="small" label={item.IsComplete ? "Complete" : "Open"} color={item.IsComplete ? "success" : "default"} variant="outlined" />
                  </Stack>
                  <TextField
                    label="Notes"
                    value={item.Notes || ""}
                    onChange={(e) => onUpdateItemNotes(item.ItemID, e.target.value)}
                    multiline
                    minRows={2}
                  />
                </Stack>
              </Paper>
            ))}
          </Stack>
        )}
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1}>
          <Typography variant="subtitle1">Close QA Scan</Typography>
          <Typography variant="body2" color="text.secondary">
            Upload a G/L CSV export for the close month. We will flag: missing recurring expenses, unusual spikes, negative revenue, and vendor mis-coding.
          </Typography>
          <Divider />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
            <Button variant="contained" component="label" disabled={uploading}>
              {uploading ? "Uploading / scanning..." : "Upload G/L CSV"}
              <input
                type="file"
                hidden
                accept=".csv,text/csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onUploadGL(file);
                  e.target.value = "";
                }}
              />
            </Button>
            {scanRunId ? <Chip label={`Scan Run: ${scanRunId}`} variant="outlined" /> : null}
            <Button variant="outlined" onClick={exportFlagsCsv} disabled={!flags.length}>
              Export flags CSV
            </Button>
          </Stack>

          <TableContainer component={Paper} variant="outlined" sx={{ mt: 1 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Severity</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Account</TableCell>
                  <TableCell>Vendor</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Reviewer Notes</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {flags.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <Typography variant="body2" color="text.secondary">
                        No flags yet. Upload a G/L CSV to generate a review list.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  flags.map((f) => (
                    <TableRow key={f.FlagID} hover>
                      <TableCell>{severityChip(f.Severity)}</TableCell>
                      <TableCell>{f.Category}</TableCell>
                      <TableCell sx={{ maxWidth: 380 }}>{f.Description}</TableCell>
                      <TableCell>{f.AccountName}</TableCell>
                      <TableCell>{f.VendorName}</TableCell>
                      <TableCell align="right">{f.Amount != null ? Number(f.Amount).toLocaleString(undefined, { style: "currency", currency: "USD" }) : ""}</TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          value={f.Status || "Open"}
                          onChange={(e) => onUpdateFlag(f.FlagID, { status: e.target.value })}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          value={f.ReviewerNotes || ""}
                          onChange={(e) => onUpdateFlag(f.FlagID, { reviewerNotes: e.target.value })}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Stack>
      </Paper>
    </Stack>
  );
}
