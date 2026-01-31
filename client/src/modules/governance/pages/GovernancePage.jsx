import React, { useEffect, useMemo, useState, useContext } from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
  Paper,
  Stack,
  IconButton,
  Tooltip,
  CircularProgress,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DoneIcon from "@mui/icons-material/Done";
import CancelIcon from "@mui/icons-material/Cancel";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import dayjs from "dayjs";

import { getActiveClients, getClients } from "../../../api/clients";
import {
  fetchGovernanceSettings,
  fetchGovernanceEvents,
  createGovernanceEvent,
  updateGovernanceEvent,
  setGovernanceEventStatus,
  deleteGovernanceEvent,
  uploadGovernanceEventAttachment,
  downloadGovernanceEventAttachment,
} from "../../../api/governanceCalendar";
import {
  fetchCovenantDashboard,
  fetchCovenants,
  createCovenant,
  updateCovenant,
  fetchCovenantSnapshots,
  createCovenantSnapshot,
  uploadCovenantAttachment,
  downloadCovenantAttachment,
  fetchCovenantAlerts,
  acknowledgeCovenantAlert,
} from "../../../api/governanceCovenants";
import { AuthContext } from "../../../context/AuthContext";

function statusChip(label) {
  const v = String(label || "").toUpperCase();
  if (v === "CRITICAL") return <Chip size="small" label="Critical" color="error" />;
  if (v === "WARN") return <Chip size="small" label="Warning" color="warning" />;
  if (v === "OK") return <Chip size="small" label="OK" color="success" />;
  if (v === "COMPLETED") return <Chip size="small" label="Completed" color="success" />;
  if (v === "CANCELED") return <Chip size="small" label="Canceled" />;
  return <Chip size="small" label={label || "—"} />;
}

function fmtDate(d) {
  if (!d) return "—";
  return dayjs(d).format("YYYY-MM-DD");
}

function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "download";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

const EVENT_TYPES = ["Compliance", "Insurance", "VendorContract", "CovenantReport"];
const RECURRENCE_TYPES = ["none", "weekly", "monthly", "quarterly", "annual"];
const JURISDICTION_LEVELS = ["Federal", "State", "District/County", "City"];

export default function GovernancePage() {
  const { auth } = useContext(AuthContext);
  const user = auth?.user;
  const role = user?.role || user?.roles?.[0] || "";

  const canEdit = useMemo(() => ["Admin", "Manager"].includes(role), [role]);
  const isAdmin = role === "Admin";

  const [tab, setTab] = useState(0);

  /** shared data **/
  const [clients, setClients] = useState([]);
  const [activeOnly, setActiveOnly] = useState(true);

  /** Calendar */
  const [settings, setSettings] = useState(null);
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventFilters, setEventFilters] = useState(() => {
    const start = dayjs().startOf("month").format("YYYY-MM-DD");
    const end = dayjs().endOf("month").format("YYYY-MM-DD");
    return {
      clientId: "",
      status: "Open",
      types: "",
      dateFrom: start,
      dateTo: end,
    };
  });

  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [eventForm, setEventForm] = useState(null);
  const [eventSaving, setEventSaving] = useState(false);
  const [eventUploadFor, setEventUploadFor] = useState(null);
  const [eventAttachments, setEventAttachments] = useState([]);

  /** Covenants */
  const [covClientId, setCovClientId] = useState("");
  const [covDashboard, setCovDashboard] = useState([]);
  const [covDashboardLoading, setCovDashboardLoading] = useState(false);
  const [covenants, setCovenants] = useState([]);
  const [covenantsLoading, setCovenantsLoading] = useState(false);
  const [covDialogOpen, setCovDialogOpen] = useState(false);
  const [covForm, setCovForm] = useState(null);
  const [covAttachments, setCovAttachments] = useState([]);
  const [snapDialogOpen, setSnapDialogOpen] = useState(false);
  const [snapForm, setSnapForm] = useState(null);
  const [covAlerts, setCovAlerts] = useState([]);
  const [covAlertsLoading, setCovAlertsLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const list = activeOnly ? await getActiveClients() : await getClients();
        setClients(list || []);
      } catch (e) {
        console.error("Failed to load clients:", e);
      }
    })();
  }, [activeOnly]);

  useEffect(() => {
    (async () => {
      try {
        const s = await fetchGovernanceSettings();
        setSettings(s);
      } catch (e) {
        console.error("Failed to load governance settings:", e);
      }
    })();
  }, []);

  const refreshEvents = async () => {
    setEventsLoading(true);
    try {
      const params = {
        ...eventFilters,
        activeClientsOnly: activeOnly ? "true" : "false",
      };
      if (params.types) params.types = params.types;
      const rows = await fetchGovernanceEvents(params);
      setEvents(rows || []);
    } catch (e) {
      console.error("Failed to load events:", e);
    } finally {
      setEventsLoading(false);
    }
  };

  useEffect(() => {
    refreshEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventFilters.clientId, eventFilters.status, eventFilters.types, eventFilters.dateFrom, eventFilters.dateTo, activeOnly]);

  const openNewEvent = () => {
    setEventAttachments([]);
    setEventForm({
      EventType: "Compliance",
      Title: "",
      ClientID: null,
      Category: "",
      JurisdictionLevel: "Federal",
      JurisdictionDetail: "",
      VendorOrPolicyName: "",
      DueDate: dayjs().format("YYYY-MM-DD"),
      RecurrenceType: "none",
      RecurrenceInterval: null,
      LeadTimeDays: null,
      Status: "Open",
      Notes: "",
      IsClientVisible: false,
    });
    setEventDialogOpen(true);
  };

  const openEditEvent = async (row) => {
    setEventAttachments([]);
    setEventForm({
      EventID: row.EventID,
      EventType: row.EventType,
      Title: row.Title || "",
      ClientID: row.ClientID || null,
      Category: row.Category || "",
      JurisdictionLevel: row.JurisdictionLevel || "Federal",
      JurisdictionDetail: row.JurisdictionDetail || "",
      VendorOrPolicyName: row.VendorOrPolicyName || "",
      DueDate: row.DueDate ? dayjs(row.DueDate).format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD"),
      RecurrenceType: row.RecurrenceType || "none",
      RecurrenceInterval: row.RecurrenceInterval ?? null,
      LeadTimeDays: row.LeadTimeDays ?? null,
      Status: row.Status || "Open",
      Notes: row.Notes || "",
      IsClientVisible: !!row.IsClientVisible,
    });
    setEventDialogOpen(true);
    try {
      const details = await fetchGovernanceEvent(row.EventID);
      setEventAttachments(details.attachments || []);
    } catch (e) {
      console.error('Failed to load event attachments:', e);
    }
  };

  const saveEvent = async () => {
    if (!eventForm?.Title) return;
    setEventSaving(true);
    try {
      const payload = { ...eventForm };
      if (payload.ClientID === "INTERNAL") payload.ClientID = null;
      if (payload.EventID) await updateGovernanceEvent(payload.EventID, payload);
      else await createGovernanceEvent(payload);

      setEventDialogOpen(false);
      setEventForm(null);
      await refreshEvents();
    } catch (e) {
      console.error("Failed to save event:", e);
    } finally {
      setEventSaving(false);
    }
  };

  const markEvent = async (eventId, status) => {
    try {
      await setGovernanceEventStatus(eventId, status);
      await refreshEvents();
    } catch (e) {
      console.error("Failed to update event status:", e);
    }
  };

  const removeEvent = async (eventId) => {
    try {
      await deleteGovernanceEvent(eventId);
      await refreshEvents();
    } catch (e) {
      console.error("Failed to delete event:", e);
    }
  };

  const handleUploadAttachment = async (eventId, file) => {
    if (!file) return;
    try {
      await uploadGovernanceEventAttachment(eventId, file);
      await refreshEvents();
    } catch (e) {
      console.error("Upload failed:", e);
    } finally {
      setEventUploadFor(null);
    }
  };

  const handleDownloadAttachment = async (attachment) => {
    try {
      const blob = await downloadGovernanceEventAttachment(attachment.AttachmentID);
      downloadBlob(blob, attachment.FileName);
    } catch (e) {
      console.error("Download failed:", e);
    }
  };

  const handleUploadAttachmentInDialog = async (file) => {
    if (!eventForm?.EventID || !file) return;
    try {
      await uploadGovernanceEventAttachment(eventForm.EventID, file);
      const details = await fetchGovernanceEvent(eventForm.EventID);
      setEventAttachments(details.attachments || []);
      await refreshEvents();
    } catch (e) {
      console.error('Upload failed:', e);
    }
  };

  /** Covenants **/
  const refreshCovenants = async () => {
    setCovenantsLoading(true);
    try {
      const rows = await fetchCovenants({ clientId: covClientId || undefined, activeOnly: "true" });
      setCovenants(rows || []);
    } catch (e) {
      console.error("Failed to load covenants:", e);
    } finally {
      setCovenantsLoading(false);
    }
  };

  const refreshCovDashboard = async () => {
    setCovDashboardLoading(true);
    try {
      const rows = await fetchCovenantDashboard({ clientId: covClientId || undefined });
      setCovDashboard(rows || []);
    } catch (e) {
      console.error("Failed to load covenant dashboard:", e);
    } finally {
      setCovDashboardLoading(false);
    }
  };

  const refreshCovAlerts = async () => {
    setCovAlertsLoading(true);
    try {
      const rows = await fetchCovenantAlerts({ clientId: covClientId || undefined, includeAcknowledged: "false" });
      setCovAlerts(rows || []);
    } catch (e) {
      console.error("Failed to load alerts:", e);
    } finally {
      setCovAlertsLoading(false);
    }
  };

  useEffect(() => {
    if (tab !== 1) return;
    refreshCovenants();
    refreshCovDashboard();
    refreshCovAlerts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, covClientId]);

  const openNewCovenant = () => {
    if (!covClientId) return;
    setCovAttachments([]);
    setCovForm({
      ClientID: covClientId,
      CovenantName: "",
      MetricKey: "DSCR",
      ThresholdType: "MIN",
      ThresholdValue: 1.0,
      WarnValue: null,
      CriticalValue: null,
      MeasurementFrequency: "Weekly",
      IsActive: true,
      Notes: "",
      IsClientVisible: false,
    });
    setCovDialogOpen(true);
  };

  const openEditCovenant = async (row) => {
    setCovAttachments([]);
    setCovForm({
      CovenantID: row.CovenantID,
      ClientID: row.ClientID,
      CovenantName: row.CovenantName || "",
      MetricKey: row.MetricKey || "DSCR",
      ThresholdType: row.ThresholdType || "MIN",
      ThresholdValue: Number(row.ThresholdValue ?? 1.0),
      WarnValue: row.WarnValue != null ? Number(row.WarnValue) : null,
      CriticalValue: row.CriticalValue != null ? Number(row.CriticalValue) : null,
      MeasurementFrequency: row.MeasurementFrequency || "Weekly",
      IsActive: !!row.IsActive,
      Notes: row.Notes || "",
      IsClientVisible: !!row.IsClientVisible,
    });
    setCovDialogOpen(true);
    try {
      const details = await fetchCovenant(row.CovenantID);
      setCovAttachments(details.attachments || []);
    } catch (e) {
      console.error('Failed to load covenant attachments:', e);
    }
  };

  const saveCovenant = async () => {
    if (!covForm?.ClientID || !covForm?.CovenantName) return;
    try {
      if (covForm.CovenantID) await updateCovenant(covForm.CovenantID, covForm);
      else await createCovenant(covForm);
      setCovDialogOpen(false);
      setCovForm(null);
      await refreshCovenants();
      await refreshCovDashboard();
    } catch (e) {
      console.error("Failed to save covenant:", e);
    }
  };

  const openNewSnapshot = (covenantRow) => {
    setSnapForm({
      CovenantID: covenantRow.CovenantID,
      SnapshotDate: dayjs().format("YYYY-MM-DD"),
      ActualValue: covenantRow.LatestActualValue ?? "",
      Source: "Manual",
      Notes: "",
    });
    setSnapDialogOpen(true);
  };

  const saveSnapshot = async () => {
    if (!snapForm?.CovenantID || snapForm?.ActualValue === "" || snapForm?.ActualValue == null) return;
    try {
      await createCovenantSnapshot(snapForm.CovenantID, snapForm);
      setSnapDialogOpen(false);
      setSnapForm(null);
      await refreshCovDashboard();
      await refreshCovAlerts();
    } catch (e) {
      console.error("Failed to save snapshot:", e);
    }
  };

  const handleUploadCovenantDoc = async (covenantId, file) => {
    if (!file) return;
    try {
      await uploadCovenantAttachment(covenantId, file);
      await refreshCovenants();
    } catch (e) {
      console.error("Upload failed:", e);
    }
  };

  const handleDownloadCovenantDoc = async (attachment) => {
    try {
      const blob = await downloadCovenantAttachment(attachment.AttachmentID);
      downloadBlob(blob, attachment.FileName);
    } catch (e) {
      console.error("Download failed:", e);
    }
  };

  const handleUploadCovenantDocInDialog = async (file) => {
    if (!covForm?.CovenantID || !file) return;
    try {
      await uploadCovenantAttachment(covForm.CovenantID, file);
      const details = await fetchCovenant(covForm.CovenantID);
      setCovAttachments(details.attachments || []);
      await refreshCovenants();
    } catch (e) {
      console.error('Upload failed:', e);
    }
  };

  const ackAlert = async (alertId) => {
    try {
      await acknowledgeCovenantAlert(alertId, { notes: "Acknowledged in portal" });
      await refreshCovAlerts();
    } catch (e) {
      console.error("Failed to acknowledge:", e);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Governance
      </Typography>
      <Typography variant="body2" sx={{ mb: 2, color: "text.secondary" }}>
        Compliance / Vendor / Insurance Calendar + Covenant Monitoring (internal by default; share with client only when toggled).
      </Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "stretch", md: "center" }}>
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel>Clients list</InputLabel>
            <Select label="Clients list" value={activeOnly ? "active" : "all"} onChange={(e) => setActiveOnly(e.target.value === "active")}>
              <MenuItem value="active">Active only</MenuItem>
              <MenuItem value="all">All clients</MenuItem>
            </Select>
          </FormControl>

          <Box sx={{ flex: 1 }} />

          {settings && (
            <Typography variant="caption" color="text.secondary">
              Digest: {settings.DigestEnabled ? "On" : "Off"} • TZ: {settings.Timezone} • Cron: {settings.DigestCron}
            </Typography>
          )}
        </Stack>
      </Paper>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Calendar" />
        <Tab label="Covenants" />
      </Tabs>

      {tab === 0 && (
        <Paper sx={{ p: 2 }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "stretch", md: "center" }} sx={{ mb: 2 }}>
            <FormControl size="small" sx={{ minWidth: 240 }}>
              <InputLabel>Client</InputLabel>
              <Select
                label="Client"
                value={eventFilters.clientId}
                onChange={(e) => setEventFilters((p) => ({ ...p, clientId: e.target.value }))}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="INTERNAL">CFO Worx (Internal)</MenuItem>
                {clients.map((c) => (
                  <MenuItem key={c.ClientID} value={c.ClientID}>
                    {c.ClientName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Status</InputLabel>
              <Select label="Status" value={eventFilters.status} onChange={(e) => setEventFilters((p) => ({ ...p, status: e.target.value }))}>
                <MenuItem value="">All</MenuItem>
                <MenuItem value="Open">Open</MenuItem>
                <MenuItem value="Completed">Completed</MenuItem>
                <MenuItem value="Canceled">Canceled</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel>Types</InputLabel>
              <Select
                label="Types"
                multiple
                value={eventFilters.types ? eventFilters.types.split(",").filter(Boolean) : []}
                renderValue={(selected) => selected.join(", ")}
                onChange={(e) => setEventFilters((p) => ({ ...p, types: (e.target.value || []).join(",") }))}
              >
                {EVENT_TYPES.map((t) => (
                  <MenuItem key={t} value={t}>
                    {t}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              size="small"
              label="From"
              type="date"
              value={eventFilters.dateFrom}
              onChange={(e) => setEventFilters((p) => ({ ...p, dateFrom: e.target.value }))}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              size="small"
              label="To"
              type="date"
              value={eventFilters.dateTo}
              onChange={(e) => setEventFilters((p) => ({ ...p, dateTo: e.target.value }))}
              InputLabelProps={{ shrink: true }}
            />

            <Box sx={{ flex: 1 }} />

            <Button variant="outlined" onClick={refreshEvents} disabled={eventsLoading}>
              Refresh
            </Button>

            {canEdit && (
              <Button startIcon={<AddIcon />} variant="contained" onClick={openNewEvent}>
                New
              </Button>
            )}
          </Stack>

          <Divider sx={{ mb: 2 }} />

          {eventsLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Box sx={{ overflowX: "auto" }}>
              <Box component="table" sx={{ width: "100%", borderCollapse: "collapse" }}>
                <Box component="thead">
                  <Box component="tr">
                    {["Due", "Client", "Type", "Title", "Category", "Jurisdiction", "Lead", "Status", "Actions"].map((h) => (
                      <Box key={h} component="th" sx={{ textAlign: "left", borderBottom: "1px solid", borderColor: "divider", p: 1, whiteSpace: "nowrap" }}>
                        <Typography variant="caption" color="text.secondary">
                          {h}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
                <Box component="tbody">
                  {events.map((e) => (
                    <Box key={e.EventID} component="tr">
                      <Box component="td" sx={{ p: 1, borderBottom: "1px solid", borderColor: "divider", whiteSpace: "nowrap" }}>
                        <Typography variant="body2">{fmtDate(e.DueDate)}</Typography>
                      </Box>
                      <Box component="td" sx={{ p: 1, borderBottom: "1px solid", borderColor: "divider" }}>
                        <Typography variant="body2">{e.ClientName || "CFO Worx (Internal)"}</Typography>
                        {e.ClientID && e.ActiveStatus === 0 && (
                          <Typography variant="caption" color="warning.main">
                            Inactive
                          </Typography>
                        )}
                      </Box>
                      <Box component="td" sx={{ p: 1, borderBottom: "1px solid", borderColor: "divider" }}>
                        <Typography variant="body2">{e.EventType}</Typography>
                      </Box>
                      <Box component="td" sx={{ p: 1, borderBottom: "1px solid", borderColor: "divider" }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {e.Title}
                        </Typography>
                        {e.IsClientVisible ? (
                          <Typography variant="caption" color="success.main">
                            Client-visible
                          </Typography>
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            Internal only
                          </Typography>
                        )}
                      </Box>
                      <Box component="td" sx={{ p: 1, borderBottom: "1px solid", borderColor: "divider" }}>
                        <Typography variant="body2">{e.Category || "—"}</Typography>
                      </Box>
                      <Box component="td" sx={{ p: 1, borderBottom: "1px solid", borderColor: "divider" }}>
                        <Typography variant="body2">
                          {e.JurisdictionLevel ? `${e.JurisdictionLevel}${e.JurisdictionDetail ? ` • ${e.JurisdictionDetail}` : ""}` : "—"}
                        </Typography>
                      </Box>
                      <Box component="td" sx={{ p: 1, borderBottom: "1px solid", borderColor: "divider", whiteSpace: "nowrap" }}>
                        <Typography variant="body2">{e.LeadTimeDays ?? "—"}d</Typography>
                      </Box>
                      <Box component="td" sx={{ p: 1, borderBottom: "1px solid", borderColor: "divider" }}>
                        {statusChip(e.Status)}
                      </Box>
                      <Box component="td" sx={{ p: 1, borderBottom: "1px solid", borderColor: "divider", whiteSpace: "nowrap" }}>
                        <Stack direction="row" spacing={1}>
                          {canEdit && (
                            <Tooltip title="Edit">
                              <IconButton size="small" onClick={() => openEditEvent(e)}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {canEdit && e.Status === "Open" && (
                            <Tooltip title="Complete">
                              <IconButton size="small" onClick={() => markEvent(e.EventID, "Completed")}>
                                <DoneIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {canEdit && e.Status === "Open" && (
                            <Tooltip title="Cancel">
                              <IconButton size="small" onClick={() => markEvent(e.EventID, "Canceled")}>
                                <CancelIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}

                          <Tooltip title="Upload attachment">
                            <IconButton size="small" onClick={() => setEventUploadFor(e.EventID)}>
                              <UploadFileIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>

                          {isAdmin && (
                            <Tooltip title="Delete">
                              <IconButton size="small" onClick={() => removeEvent(e.EventID)}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Stack>

                        {eventUploadFor === e.EventID && (
                          <Box sx={{ mt: 1 }}>
                            <input
                              type="file"
                              onChange={(ev) => handleUploadAttachment(e.EventID, ev.target.files?.[0])}
                              style={{ maxWidth: 220 }}
                            />
                            <Button size="small" onClick={() => setEventUploadFor(null)}>
                              Close
                            </Button>
                          </Box>
                        )}
                      </Box>
                    </Box>
                  ))}
                  {events.length === 0 && (
                    <Box component="tr">
                      <Box component="td" colSpan={9} sx={{ p: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                          No matching calendar items.
                        </Typography>
                      </Box>
                    </Box>
                  )}
                </Box>
              </Box>

              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2 }}>
                Note: Attachments are stored on the server filesystem (uploads/governance). Consider moving to a cloud blob store for production hardening.
              </Typography>
            </Box>
          )}
        </Paper>
      )}

      {tab === 1 && (
        <Paper sx={{ p: 2 }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "stretch", md: "center" }} sx={{ mb: 2 }}>
            <FormControl size="small" sx={{ minWidth: 300 }}>
              <InputLabel>Client</InputLabel>
              <Select label="Client" value={covClientId} onChange={(e) => setCovClientId(e.target.value)}>
                <MenuItem value="">All</MenuItem>
                {clients.map((c) => (
                  <MenuItem key={c.ClientID} value={c.ClientID}>
                    {c.ClientName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Box sx={{ flex: 1 }} />

            {canEdit && (
              <Button startIcon={<AddIcon />} variant="contained" disabled={!covClientId} onClick={openNewCovenant}>
                New Covenant
              </Button>
            )}
          </Stack>

          <Divider sx={{ mb: 2 }} />

          <Stack direction={{ xs: "column", lg: "row" }} spacing={2} alignItems="stretch">
            <Box sx={{ flex: 2 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Covenant Dashboard
              </Typography>

              {covDashboardLoading ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <Box sx={{ overflowX: "auto" }}>
                  <Box component="table" sx={{ width: "100%", borderCollapse: "collapse" }}>
                    <Box component="thead">
                      <Box component="tr">
                        {["Client", "Covenant", "Metric", "Threshold", "Latest", "Status", "Alerts", "Actions"].map((h) => (
                          <Box key={h} component="th" sx={{ textAlign: "left", borderBottom: "1px solid", borderColor: "divider", p: 1, whiteSpace: "nowrap" }}>
                            <Typography variant="caption" color="text.secondary">
                              {h}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                    <Box component="tbody">
                      {covDashboard.map((r) => (
                        <Box key={r.CovenantID} component="tr">
                          <Box component="td" sx={{ p: 1, borderBottom: "1px solid", borderColor: "divider" }}>
                            <Typography variant="body2">{r.ClientName}</Typography>
                          </Box>
                          <Box component="td" sx={{ p: 1, borderBottom: "1px solid", borderColor: "divider" }}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {r.CovenantName}
                            </Typography>
                            {r.IsClientVisible ? (
                              <Typography variant="caption" color="success.main">
                                Client-visible
                              </Typography>
                            ) : (
                              <Typography variant="caption" color="text.secondary">
                                Internal only
                              </Typography>
                            )}
                          </Box>
                          <Box component="td" sx={{ p: 1, borderBottom: "1px solid", borderColor: "divider" }}>
                            <Typography variant="body2">{r.MetricKey}</Typography>
                          </Box>
                          <Box component="td" sx={{ p: 1, borderBottom: "1px solid", borderColor: "divider", whiteSpace: "nowrap" }}>
                            <Typography variant="body2">
                              {r.ThresholdType} {Number(r.ThresholdValue).toFixed(3)}
                            </Typography>
                          </Box>
                          <Box component="td" sx={{ p: 1, borderBottom: "1px solid", borderColor: "divider", whiteSpace: "nowrap" }}>
                            <Typography variant="body2">
                              {r.LatestActualValue == null ? "—" : Number(r.LatestActualValue).toFixed(3)}{" "}
                              {r.LatestSnapshotDate ? `(${fmtDate(r.LatestSnapshotDate)})` : ""}
                            </Typography>
                          </Box>
                          <Box component="td" sx={{ p: 1, borderBottom: "1px solid", borderColor: "divider" }}>
                            {statusChip(r.LatestStatus || "—")}
                          </Box>
                          <Box component="td" sx={{ p: 1, borderBottom: "1px solid", borderColor: "divider", whiteSpace: "nowrap" }}>
                            {r.OpenAlertCount > 0 ? (
                              <Chip size="small" color="warning" icon={<WarningAmberIcon />} label={`${r.OpenAlertCount}`} />
                            ) : (
                              <Chip size="small" label="0" />
                            )}
                          </Box>
                          <Box component="td" sx={{ p: 1, borderBottom: "1px solid", borderColor: "divider", whiteSpace: "nowrap" }}>
                            <Stack direction="row" spacing={1}>
                              {canEdit && (
                                <Tooltip title="Add snapshot">
                                  <IconButton size="small" onClick={() => openNewSnapshot(r)}>
                                    <AddIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                              {canEdit && (
                                <Tooltip title="Edit covenant">
                                  <IconButton size="small" onClick={() => openEditCovenant(r)}>
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                            </Stack>
                          </Box>
                        </Box>
                      ))}
                      {covDashboard.length === 0 && (
                        <Box component="tr">
                          <Box component="td" colSpan={8} sx={{ p: 2 }}>
                            <Typography variant="body2" color="text.secondary">
                              No covenants found (or select a client).
                            </Typography>
                          </Box>
                        </Box>
                      )}
                    </Box>
                  </Box>
                </Box>
              )}
            </Box>

            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Open Covenant Alerts
              </Typography>

              {covAlertsLoading ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <Stack spacing={1}>
                  {covAlerts.slice(0, 15).map((a) => (
                    <Paper key={a.AlertID} variant="outlined" sx={{ p: 1.5 }}>
                      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                        <Stack spacing={0.3}>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {a.AlertLevel} • {a.ClientName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {a.CovenantName} ({a.MetricKey}) • {fmtDate(a.CreatedAt)}
                          </Typography>
                        </Stack>

                        {canEdit && (
                          <Button size="small" variant="outlined" onClick={() => ackAlert(a.AlertID)}>
                            Ack
                          </Button>
                        )}
                      </Stack>

                      <Typography variant="body2" sx={{ mt: 1 }}>
                        {a.Message}
                      </Typography>
                    </Paper>
                  ))}
                  {covAlerts.length === 0 && (
                    <Typography variant="body2" color="text.secondary">
                      No open alerts.
                    </Typography>
                  )}
                </Stack>
              )}
            </Box>
          </Stack>
        </Paper>
      )}

      {/* Event dialog */}
      <Dialog open={eventDialogOpen} onClose={() => setEventDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{eventForm?.EventID ? "Edit Calendar Item" : "New Calendar Item"}</DialogTitle>
        <DialogContent>
          {!eventForm ? null : (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <FormControl size="small" sx={{ minWidth: 220 }}>
                  <InputLabel>Type</InputLabel>
                  <Select
                    label="Type"
                    value={eventForm.EventType}
                    onChange={(e) => setEventForm((p) => ({ ...p, EventType: e.target.value }))}
                  >
                    {EVENT_TYPES.map((t) => (
                      <MenuItem key={t} value={t}>
                        {t}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 260 }}>
                  <InputLabel>Client</InputLabel>
                  <Select
                    label="Client"
                    value={eventForm.ClientID ?? "INTERNAL"}
                    onChange={(e) => setEventForm((p) => ({ ...p, ClientID: e.target.value === "INTERNAL" ? null : e.target.value }))}
                  >
                    <MenuItem value="INTERNAL">CFO Worx (Internal)</MenuItem>
                    {clients.map((c) => (
                      <MenuItem key={c.ClientID} value={c.ClientID}>
                        {c.ClientName}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <TextField
                  size="small"
                  label="Due date"
                  type="date"
                  value={eventForm.DueDate}
                  onChange={(e) => setEventForm((p) => ({ ...p, DueDate: e.target.value }))}
                  InputLabelProps={{ shrink: true }}
                />
              </Stack>

              <TextField
                size="small"
                label="Title"
                value={eventForm.Title}
                onChange={(e) => setEventForm((p) => ({ ...p, Title: e.target.value }))}
                placeholder="e.g., Payroll tax filing, Workers comp renewal, Vendor contract renewal..."
              />

              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField
                  size="small"
                  label="Category"
                  value={eventForm.Category}
                  onChange={(e) => setEventForm((p) => ({ ...p, Category: e.target.value }))}
                  placeholder="e.g., IT, Marketing, Sales Tax, Payroll Tax, Workers Comp..."
                  sx={{ flex: 1 }}
                />
                <TextField
                  size="small"
                  label="Vendor / Policy"
                  value={eventForm.VendorOrPolicyName}
                  onChange={(e) => setEventForm((p) => ({ ...p, VendorOrPolicyName: e.target.value }))}
                  sx={{ flex: 1 }}
                />
              </Stack>

              {eventForm.EventType === "Compliance" && (
                <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                  <FormControl size="small" sx={{ minWidth: 220 }}>
                    <InputLabel>Jurisdiction</InputLabel>
                    <Select
                      label="Jurisdiction"
                      value={eventForm.JurisdictionLevel || "Federal"}
                      onChange={(e) => setEventForm((p) => ({ ...p, JurisdictionLevel: e.target.value }))}
                    >
                      {JURISDICTION_LEVELS.map((j) => (
                        <MenuItem key={j} value={j}>
                          {j}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <TextField
                    size="small"
                    label="Jurisdiction detail"
                    value={eventForm.JurisdictionDetail}
                    onChange={(e) => setEventForm((p) => ({ ...p, JurisdictionDetail: e.target.value }))}
                    placeholder="e.g., TX, Hillsborough County, Tampa"
                    sx={{ flex: 1 }}
                  />
                </Stack>
              )}

              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <FormControl size="small" sx={{ minWidth: 220 }}>
                  <InputLabel>Recurrence</InputLabel>
                  <Select
                    label="Recurrence"
                    value={eventForm.RecurrenceType || "none"}
                    onChange={(e) => setEventForm((p) => ({ ...p, RecurrenceType: e.target.value }))}
                  >
                    {RECURRENCE_TYPES.map((r) => (
                      <MenuItem key={r} value={r}>
                        {r}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <TextField
                  size="small"
                  label="Lead time (days)"
                  type="number"
                  value={eventForm.LeadTimeDays ?? ""}
                  onChange={(e) => setEventForm((p) => ({ ...p, LeadTimeDays: e.target.value === "" ? null : Number(e.target.value) }))}
                  helperText={
                    settings
                      ? `Defaults: Compliance ${settings.DefaultComplianceLeadDays}d • Insurance ${settings.DefaultInsuranceLeadDays}d • Vendor ${settings.DefaultVendorLeadDays}d`
                      : "Leave blank to use defaults"
                  }
                  sx={{ minWidth: 220 }}
                />

                <FormControl size="small" sx={{ minWidth: 180 }}>
                  <InputLabel>Status</InputLabel>
                  <Select
                    label="Status"
                    value={eventForm.Status}
                    onChange={(e) => setEventForm((p) => ({ ...p, Status: e.target.value }))}
                  >
                    <MenuItem value="Open">Open</MenuItem>
                    <MenuItem value="Completed">Completed</MenuItem>
                    <MenuItem value="Canceled">Canceled</MenuItem>
                  </Select>
                </FormControl>
              </Stack>

              <FormControlLabel
                control={
                  <Switch
                    checked={!!eventForm.IsClientVisible}
                    onChange={(e) => setEventForm((p) => ({ ...p, IsClientVisible: e.target.checked }))}
                  />
                }
                label="Visible to client (default off)"
              />

              <TextField
                size="small"
                label="Notes"
                value={eventForm.Notes}
                onChange={(e) => setEventForm((p) => ({ ...p, Notes: e.target.value }))}
                multiline
                minRows={4}
              />

              {eventForm.EventID && (
                <Box>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Attachments
                  </Typography>

                  <Stack spacing={1}>
                    {eventAttachments.map((a) => (
                      <Stack key={a.AttachmentID} direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                        <Typography variant="body2" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {a.FileName}
                        </Typography>
                        <Tooltip title="Download">
                          <IconButton size="small" onClick={() => handleDownloadAttachment(a)}>
                            <DownloadIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    ))}

                    {eventAttachments.length === 0 && (
                      <Typography variant="caption" color="text.secondary">
                        No attachments yet.
                      </Typography>
                    )}

                    <Button component="label" variant="outlined" startIcon={<UploadFileIcon />}>
                      Upload attachment
                      <input hidden type="file" onChange={(e) => handleUploadAttachmentInDialog(e.target.files?.[0])} />
                    </Button>
                  </Stack>
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEventDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveEvent} disabled={!canEdit || eventSaving || !eventForm?.Title}>
            {eventSaving ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Covenant dialog */}
      <Dialog open={covDialogOpen} onClose={() => setCovDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{covForm?.CovenantID ? "Edit Covenant" : "New Covenant"}</DialogTitle>
        <DialogContent>
          {!covForm ? null : (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <FormControl size="small" sx={{ minWidth: 260 }}>
                <InputLabel>Client</InputLabel>
                <Select
                  label="Client"
                  value={covForm.ClientID}
                  onChange={(e) => setCovForm((p) => ({ ...p, ClientID: e.target.value }))}
                >
                  {clients.map((c) => (
                    <MenuItem key={c.ClientID} value={c.ClientID}>
                      {c.ClientName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField size="small" label="Covenant name" value={covForm.CovenantName} onChange={(e) => setCovForm((p) => ({ ...p, CovenantName: e.target.value }))} />

              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField
                  size="small"
                  label="Metric key"
                  value={covForm.MetricKey}
                  onChange={(e) => setCovForm((p) => ({ ...p, MetricKey: e.target.value }))}
                  placeholder="DSCR, DebtEBITDA, Liquidity..."
                  sx={{ flex: 1 }}
                />
                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <InputLabel>Type</InputLabel>
                  <Select label="Type" value={covForm.ThresholdType} onChange={(e) => setCovForm((p) => ({ ...p, ThresholdType: e.target.value }))}>
                    <MenuItem value="MIN">MIN (must be ≥)</MenuItem>
                    <MenuItem value="MAX">MAX (must be ≤)</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  size="small"
                  label="Threshold"
                  type="number"
                  value={covForm.ThresholdValue}
                  onChange={(e) => setCovForm((p) => ({ ...p, ThresholdValue: Number(e.target.value) }))}
                  sx={{ minWidth: 160 }}
                />
              </Stack>

              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField
                  size="small"
                  label="Warn value (optional)"
                  type="number"
                  value={covForm.WarnValue ?? ""}
                  onChange={(e) => setCovForm((p) => ({ ...p, WarnValue: e.target.value === "" ? null : Number(e.target.value) }))}
                  helperText="If blank, system uses a default 5% buffer"
                  sx={{ minWidth: 220 }}
                />
                <TextField
                  size="small"
                  label="Critical value (optional)"
                  type="number"
                  value={covForm.CriticalValue ?? ""}
                  onChange={(e) => setCovForm((p) => ({ ...p, CriticalValue: e.target.value === "" ? null : Number(e.target.value) }))}
                  helperText="If blank, threshold is treated as critical"
                  sx={{ minWidth: 220 }}
                />
              </Stack>

              <FormControlLabel
                control={<Switch checked={!!covForm.IsActive} onChange={(e) => setCovForm((p) => ({ ...p, IsActive: e.target.checked }))} />}
                label="Active"
              />
              <FormControlLabel
                control={<Switch checked={!!covForm.IsClientVisible} onChange={(e) => setCovForm((p) => ({ ...p, IsClientVisible: e.target.checked }))} />}
                label="Visible to client (default off)"
              />

              <TextField
                size="small"
                label="Notes"
                value={covForm.Notes}
                onChange={(e) => setCovForm((p) => ({ ...p, Notes: e.target.value }))}
                multiline
                minRows={3}
              />

              {covForm.CovenantID && (
                <Box>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Loan / Covenant Docs
                  </Typography>
                  <Stack spacing={1}>
                    {covAttachments.map((a) => (
                      <Stack key={a.AttachmentID} direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                        <Typography variant="body2" sx={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                          {a.FileName}
                        </Typography>
                        <Tooltip title="Download">
                          <IconButton size="small" onClick={() => handleDownloadCovenantDoc(a)}>
                            <DownloadIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    ))}
                    {covAttachments.length === 0 && (
                      <Typography variant="caption" color="text.secondary">
                        No docs uploaded yet.
                      </Typography>
                    )}

                    <Button component="label" variant="outlined" startIcon={<UploadFileIcon />}>
                      Upload
                      <input hidden type="file" onChange={(e) => handleUploadCovenantDocInDialog(e.target.files?.[0])} />
                    </Button>
                  </Stack>
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCovDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveCovenant} disabled={!canEdit || !covForm?.CovenantName}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snapshot dialog */}
      <Dialog open={snapDialogOpen} onClose={() => setSnapDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New Covenant Snapshot</DialogTitle>
        <DialogContent>
          {!snapForm ? null : (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                size="small"
                label="Snapshot date"
                type="date"
                value={snapForm.SnapshotDate}
                onChange={(e) => setSnapForm((p) => ({ ...p, SnapshotDate: e.target.value }))}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                size="small"
                label="Actual value"
                type="number"
                value={snapForm.ActualValue}
                onChange={(e) => setSnapForm((p) => ({ ...p, ActualValue: e.target.value }))}
                placeholder="Enter DSCR, leverage, etc"
              />
              <TextField size="small" label="Notes (optional)" value={snapForm.Notes} onChange={(e) => setSnapForm((p) => ({ ...p, Notes: e.target.value }))} />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSnapDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveSnapshot} disabled={!canEdit}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

