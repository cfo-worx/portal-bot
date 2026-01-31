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
  CircularProgress,
  Alert,
  Chip,
  Switch,
  FormControlLabel,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
} from "@mui/material";

import {
  listAccountingStaff,
  upsertAccountingStaff,
  listStaffEvaluations,
  createStaffEvaluation,
} from "../../../api/clientWork";

const DEFAULT_SCORES = {
  accounting_skill: 3,
  timeliness: 3,
  trainability: 3,
  professionalism: 3,
  collaboration: 3,
  attention_to_detail: 3,
};

export default function StaffEvalTab({ clientId, clientName }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [staff, setStaff] = useState([]);
  const [evaluations, setEvaluations] = useState([]);

  const [staffForm, setStaffForm] = useState({
    StaffID: "",
    Name: "",
    Title: "",
    Email: "",
    IsActive: true,
  });

  const [evalForm, setEvalForm] = useState({
    StaffID: "",
    EvaluationDate: new Date().toISOString().slice(0, 10),
    WouldHire: false,
    ShareableSummary: "",
    InternalNotes: "",
    Scores: { ...DEFAULT_SCORES },
  });

  const load = async () => {
    if (!clientId) return;
    setLoading(true);
    setError("");
    try {
      const [sRes, eRes] = await Promise.all([
        listAccountingStaff(clientId),
        listStaffEvaluations(clientId),
      ]);
      setStaff(sRes.data.staff || []);
      setEvaluations(eRes.data.evaluations || []);
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || "Failed to load staff evaluation data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const staffOptions = useMemo(() => staff.filter((s) => s.IsActive), [staff]);

  const handleSaveStaff = async () => {
    if (!clientId) return;
    setError("");
    try {
      await upsertAccountingStaff(clientId, {
        staffId: staffForm.StaffID || undefined,
        name: staffForm.Name,
        title: staffForm.Title,
        email: staffForm.Email,
        isActive: staffForm.IsActive,
      });
      setStaffForm({ StaffID: "", Name: "", Title: "", Email: "", IsActive: true });
      await load();
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || "Failed to save staff.");
    }
  };

  const handleCreateEvaluation = async () => {
    if (!clientId) return;
    setError("");
    try {
      if (!evalForm.StaffID) {
        setError("Select a staff member to evaluate.");
        return;
      }
      await createStaffEvaluation(clientId, {
        staffId: evalForm.StaffID,
        evaluationDate: evalForm.EvaluationDate,
        scoresJson: JSON.stringify(evalForm.Scores),
        wouldHire: evalForm.WouldHire,
        shareableSummary: evalForm.ShareableSummary,
        internalNotes: evalForm.InternalNotes,
      });
      setEvalForm({
        StaffID: "",
        EvaluationDate: new Date().toISOString().slice(0, 10),
        WouldHire: false,
        ShareableSummary: "",
        InternalNotes: "",
        Scores: { ...DEFAULT_SCORES },
      });
      await load();
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || "Failed to create evaluation.");
    }
  };

  const scoreKeys = Object.keys(DEFAULT_SCORES);

  return (
    <Stack spacing={2}>
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6">Internal Accounting Staff Evaluation</Typography>
        <Typography variant="body2" color="text.secondary">
          Track recurring close issues, professionalism, and whether CFO Worx would hire a given internal team member.
          Shareable summaries can be exported to client management when appropriate.
        </Typography>

        <Divider sx={{ my: 2 }} />

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "flex-start" }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle1">Add / Update Staff</Typography>
            <Stack spacing={1} sx={{ mt: 1 }}>
              <TextField
                label="Name"
                value={staffForm.Name}
                onChange={(e) => setStaffForm((s) => ({ ...s, Name: e.target.value }))}
              />
              <TextField
                label="Title"
                value={staffForm.Title}
                onChange={(e) => setStaffForm((s) => ({ ...s, Title: e.target.value }))}
              />
              <TextField
                label="Email"
                value={staffForm.Email}
                onChange={(e) => setStaffForm((s) => ({ ...s, Email: e.target.value }))}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={!!staffForm.IsActive}
                    onChange={(e) => setStaffForm((s) => ({ ...s, IsActive: e.target.checked }))}
                  />
                }
                label="Active"
              />
              <Button variant="contained" onClick={handleSaveStaff}>
                Save Staff
              </Button>
            </Stack>
          </Box>

          <Box sx={{ flex: 2 }}>
            <Typography variant="subtitle1">Create Evaluation</Typography>
            <Stack spacing={1} sx={{ mt: 1 }}>
              <TextField
                select
                label="Staff"
                value={evalForm.StaffID}
                onChange={(e) => setEvalForm((s) => ({ ...s, StaffID: e.target.value }))}
              >
                <MenuItem value="">Select…</MenuItem>
                {staffOptions.map((s) => (
                  <MenuItem key={s.StaffID} value={s.StaffID}>
                    {s.Name} {s.Title ? `(${s.Title})` : ""}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                label="Evaluation Date"
                type="date"
                value={evalForm.EvaluationDate}
                onChange={(e) => setEvalForm((s) => ({ ...s, EvaluationDate: e.target.value }))}
                InputLabelProps={{ shrink: true }}
              />

              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                {scoreKeys.map((k) => (
                  <TextField
                    key={k}
                    label={k.replaceAll("_", " ")}
                    type="number"
                    inputProps={{ min: 1, max: 5 }}
                    value={evalForm.Scores[k]}
                    onChange={(e) =>
                      setEvalForm((s) => ({
                        ...s,
                        Scores: { ...s.Scores, [k]: Number(e.target.value || 0) },
                      }))
                    }
                    sx={{ minWidth: 180 }}
                  />
                ))}
              </Stack>

              <FormControlLabel
                control={
                  <Switch
                    checked={!!evalForm.WouldHire}
                    onChange={(e) => setEvalForm((s) => ({ ...s, WouldHire: e.target.checked }))}
                  />
                }
                label="Would CFO Worx hire this person?"
              />

              <TextField
                label="Shareable Summary (client-facing, optional)"
                value={evalForm.ShareableSummary}
                onChange={(e) => setEvalForm((s) => ({ ...s, ShareableSummary: e.target.value }))}
                multiline
                minRows={2}
              />
              <TextField
                label="Internal Notes (private)"
                value={evalForm.InternalNotes}
                onChange={(e) => setEvalForm((s) => ({ ...s, InternalNotes: e.target.value }))}
                multiline
                minRows={3}
              />

              <Button variant="contained" onClick={handleCreateEvaluation}>
                Save Evaluation
              </Button>
            </Stack>
          </Box>
        </Stack>

        {loading && (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2 }}>
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">
              Loading…
            </Typography>
          </Stack>
        )}
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="subtitle1">Evaluation History</Typography>
          <Chip label={`${evaluations.length} total`} variant="outlined" />
        </Stack>

        {evaluations.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No evaluations created yet for <b>{clientName}</b>.
          </Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Staff</TableCell>
                  <TableCell>Would Hire</TableCell>
                  <TableCell>Shareable Summary</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {evaluations.slice(0, 50).map((e) => (
                  <TableRow key={e.EvaluationID} hover>
                    <TableCell>{String(e.EvaluationDate).slice(0, 10)}</TableCell>
                    <TableCell>
                      {e.StaffName}
                      {e.StaffTitle ? ` (${e.StaffTitle})` : ""}
                    </TableCell>
                    <TableCell>{e.WouldHire ? "Yes" : "No"}</TableCell>
                    <TableCell>{e.ShareableSummary || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Stack>
  );
}
