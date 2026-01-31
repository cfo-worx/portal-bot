// frontend/src/components/DayInfoModal.jsx
import React, { useState, useEffect, useContext } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Typography, IconButton, Button, Box, Chip,
  Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, TextField, MenuItem,
  CircularProgress, Collapse, Alert
} from '@mui/material';

import CloseIcon      from '@mui/icons-material/Close';
import AddIcon        from '@mui/icons-material/Add';
import EditIcon       from '@mui/icons-material/Edit';
import DeleteIcon     from '@mui/icons-material/Delete';
import SaveIcon       from '@mui/icons-material/Save';
import CancelIcon     from '@mui/icons-material/Close';
import SendIcon       from '@mui/icons-material/Send';
import PlayArrowIcon  from '@mui/icons-material/PlayArrow';
import StopIcon       from '@mui/icons-material/Stop';

import dayjs from 'dayjs';

import {
  getTimecardLinesByDate,
  addOrUpdateTimecardLine,
  deleteTimecardLine,
  submitTimesheetForDay
} from '../../../api/timecards';
import { getActiveClientsForConsultant } from '../../../api/clients';
import { getCalendarLocked }             from '../../../api/globalSettings';
import { AuthContext }                   from '../../../context/AuthContext';

/* ───────── helpers ───────── */
const roundNearestHalf = n => Math.round(n * 2) / 2 || 0;
const roundUpHalf      = n => Math.ceil( n * 2) / 2 || 0;
const fmtHMS = sec => {
  const h = String(Math.floor(sec / 3600)).padStart(2, '0');
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
};
const statusBorder = s => ({ approved:'green', rejected:'red', submitted:'gray' }[s] || 'transparent');

/* ───────── confirm-submit dialog ───────── */
const ConfirmSubmitDialog = ({ open, onConfirm, onCancel }) => (
  <Dialog open={open} onClose={onCancel}>
    <DialogTitle>Confirm Day Submission</DialogTitle>
    <DialogContent dividers>
      <Typography variant="body2">
        Are you sure you want to submit all time for the day?  After
        submission entries are locked unless released by an admin.
      </Typography>
    </DialogContent>
    <DialogActions sx={{ px:3, pb:2 }}>
      <Button onClick={onCancel}>Cancel</Button>
      <Button variant="contained" startIcon={<SendIcon />} onClick={onConfirm}>
        Submit&nbsp;&amp;&nbsp;Lock
      </Button>
    </DialogActions>
  </Dialog>
);

/* ───────── main ───────── */
export default function DayInfoModal({ open, onClose, date, refreshTrigger, onTimeEntryChange }) {
  const { auth }    = useContext(AuthContext);
  const consultantID = auth.user?.consultantId;

  /* ── remote data ── */
  const [lines,   setLines]   = useState([]);
  const [clients, setClients] = useState([]);
  const [calendarLocked, setCalendarLocked] = useState(true);

  /* ── UI / local state ── */
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [alertMsg, setAlertMsg] = useState('');
  const [editingId, setEditingId] = useState(null);  // 'new' or TimecardLineID
  const [drafts,    setDrafts]    = useState({});
  const [saving,    setSaving]    = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  /* ── timers (persisted in localStorage so they survive hot-reloads) ── */
  const [timers, setTimers] = useState(() => {
    try { return JSON.parse(localStorage.getItem('timekeeperTimers') || '{}'); }
    catch { return {}; }
  });
  const [, forceTick] = useState(0);               // re-render 1/s while timers run

  useEffect(() => localStorage.setItem('timekeeperTimers', JSON.stringify(timers)), [timers]);
  useEffect(() => {
    if (!Object.values(timers).some(t => t.running)) return;
    const id = setInterval(() => forceTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [timers]);

  const elapsedSec = id => {
    const t = timers[id];
    if (!t) return 0;
    return t.running ? t.elapsed + Math.floor((Date.now() - t.start) / 1000) : t.elapsed;
  };

  const startTimer = id => setTimers(p => ({
    ...p,
    [id]: { running: true, start: Date.now(), elapsed: p[id]?.elapsed || 0 }
  }));

  const stopTimer = id => setTimers(p => {
    const t = p[id]; if (!t || !t.running) return p;
    const elapsed  = t.elapsed + Math.floor((Date.now() - t.start) / 1000);
    const hrsAdd   = roundUpHalf(elapsed / 3600);           // bump up to 0.5
    /* → add to *existing* Client-Facing hours in current draft row */
    setDrafts(d => {
      const prev = parseFloat(d[id]?.ClientFacingHours || 0);
      return {
        ...d,
        [id]: { ...(d[id] || {}), ClientFacingHours: roundNearestHalf(prev + hrsAdd) }
      };
    });
    return { ...p, [id]: { running:false, elapsed, start:null } };
  });

  const resetTimer = id => setTimers(p => {
    const { [id]:_, ...rest } = p;
    return rest;
  });

  /* ── static config ── */
  useEffect(() => { getCalendarLocked().then(setCalendarLocked).catch(() => {}); }, []);

  /* ── fetch clients once per open ── */
  useEffect(() => {
    if (!consultantID || !open) return;
    (async () => {
      try {
        const rows = await getActiveClientsForConsultant(consultantID);
        const uniq = rows.reduce((a,c)=>{                       // DISTINCT (ClientID, ProjectID)
          if (!a.some(x=>x.ClientID===c.ClientID && x.ProjectID===c.ProjectID)) a.push(c);
          return a;
        }, []);
        uniq.sort((a,b)=>a.ClientName.localeCompare(b.ClientName));
        setClients(uniq);
      } catch (e) { console.error(e); }
    })();
  }, [open, consultantID]);

  /* ── fetch lines ── */
  const loadLines = async () => {
    if (!consultantID || !date) return;
    setLoading(true); setError(null);
    try {
      setLines(await getTimecardLinesByDate(
        consultantID,
        dayjs(date).format('YYYY-MM-DD')
      ));
    } catch (e) { setError(e.message || 'Failed to load entries.'); }
    finally     { setLoading(false); }
  };
  useEffect(() => { if (open) loadLines(); }, [open, consultantID, date]);              // eslint-disable-line
  useEffect(() => { if (refreshTrigger && open) loadLines(); }, [refreshTrigger]);      // eslint-disable-line

  /* ── lock rules ── */
  const dayLocked = (() => {
    const d = dayjs(date), today = dayjs().startOf('day');
    if (d.isAfter(today)) return true;                  // future
    if (!calendarLocked) return false;                  // admin override
    const cutoff = d.add((7 - d.day()) % 7, 'day').endOf('day');
    // Only lock if past the week cutoff - individual line locks are handled separately
    return dayjs().isAfter(cutoff);
  })();

  /* ── drafts & editing helpers ── */
  const blankDraft = x => ({
    ClientID:              x.ClientID              || '',
    ProjectID:             x.ProjectID             || '',
    ProjectTask:           x.ProjectTask           || '',
    ClientFacingHours:     x.ClientFacingHours     ?? 0,
    NonClientFacingHours:  x.NonClientFacingHours  ?? 0,
    OtherTaskHours:        x.OtherTaskHours        ?? 0,
    Notes:                 x.Notes                 || ''
  });
  const startEdit  = line => {
    const id = line === 'new' ? 'new' : line.TimecardLineID;
    setEditingId(id);
    setDrafts({ [id]: blankDraft(line === 'new' ? {} : line) });
  };
  const cancelEdit = () => {
    setEditingId(null);
    setDrafts({});
    resetTimer('new');
  };
  const setDraft   = (field, value) =>
    setDrafts(p => ({ ...p, [editingId]: { ...(p[editingId] || {}), [field]: value } }));

  /* ── validation ── */
  const validateDraft = d => {
    if (!d.ClientID)                                             return 'Client is required.';
    if (!d.ProjectID && d.Notes.trim() === '')                  return 'Notes are required when no project is selected.';
    const tot = (+d.ClientFacingHours||0)+(+d.NonClientFacingHours||0)+(+d.OtherTaskHours||0);
    if (tot === 0)                                               return 'At least one hour field must be greater than 0.';
    if (tot > 24)                                                return 'Total hours for a line cannot exceed 24.';
    return null;
  };

  /* ── save handler ── */
  const saveDraft = async () => {
    const d   = drafts[editingId];
    const err = validateDraft(d);
    if (err) { setError(err); return; }

    const matching = clients.find(
  c => c.ClientID === d.ClientID && c.ProjectID === d.ProjectID
);
const projectName = matching?.ProjectName || 'Time Entry';

const payload = {
  TimecardLineID: editingId === 'new' ? undefined : editingId,
  ConsultantID:   consultantID,
  TimesheetDate:  dayjs(date).format('YYYY-MM-DD'),
  ClientID:       d.ClientID,
  ProjectID:      d.ProjectID || null,
  ProjectName:    projectName,                    // ✅ new line added
  ProjectTask:    d.ProjectTask || null,
  ClientFacingHours:    roundNearestHalf(d.ClientFacingHours),
  NonClientFacingHours: roundNearestHalf(d.NonClientFacingHours),
  OtherTaskHours:       roundNearestHalf(d.OtherTaskHours),
  Notes:          d.Notes,
  Status:         'Open'
};


    setSaving(true); setError(null);
    try {
      await addOrUpdateTimecardLine(payload);
      setAlertMsg('Time entry saved.');
      setTimeout(() => setAlertMsg(''), 2000);
      cancelEdit(); loadLines(); onTimeEntryChange?.(true);
    } catch (e) {
      setError(e.response?.data || 'Failed to save entry.');
    } finally {
      setSaving(false);
    }
  };

  /* ── delete line ── */
  const handleDelete = async line => {
    if (!window.confirm('Delete this time entry?')) return;
    try {
      await deleteTimecardLine(line.TimecardLineID);
      resetTimer(line.TimecardLineID);
      loadLines(); onTimeEntryChange?.(true);
    } catch (e) { setError(e.message || 'Delete failed.'); }
  };

  /* auto-add blank row on an empty, unlocked day */
  useEffect(() => {
    if (open && !dayLocked && lines.length === 0 && !editingId) startEdit('new');
  }, [open, lines.length, dayLocked, editingId]); // eslint-disable-line

  /* ── derived data ── */
  const totals = lines.reduce((s,l)=>
      s + (+l.ClientFacingHours||0) + (+l.NonClientFacingHours||0) + (+l.OtherTaskHours||0), 0
    ).toFixed(1);

  const projectsByClient = {};
  clients.forEach(c => {
    if (!projectsByClient[c.ClientID]) projectsByClient[c.ClientID] = [];
    if (c.ProjectID) projectsByClient[c.ClientID].push({ id:c.ProjectID, name:c.ProjectName });
  });

  const dayStatus = (() => {
    if (!lines.length) return 'open';
    const s = lines.map(l => l.Status.toLowerCase());
    if (s.includes('rejected'))           return 'rejected';
    if (s.every(x => x === 'approved'))   return 'approved';
    if (s.includes('submitted'))          return 'submitted';
    return 'open';
  })();
  const statusColor = { open:'primary', submitted:'default', approved:'success', rejected:'error' };

  /* ───────── render ───────── */
  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg"
              PaperProps={{ sx:{ minHeight: 520 } }}>
        <DialogTitle sx={{display:'flex',justifyContent:'space-between',alignItems:'center',pr:1}}>
          <Box sx={{display:'flex',alignItems:'center'}}>
            <Typography variant="h6" sx={{mr:1}}>
              {dayjs(date).format('MMMM D, YYYY')}
            </Typography>
            <Chip size="small" color={statusColor[dayStatus]}
                  label={dayStatus[0].toUpperCase() + dayStatus.slice(1)} />
          </Box>
          <IconButton size="small" onClick={onClose}><CloseIcon/></IconButton>
        </DialogTitle>

<DialogContent dividers sx={{ px: 0 }}>
  {/* 1️⃣  LOADING STATE */}
  {loading ? (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
      <CircularProgress />
    </Box>
  ) : (
    <>
      {/* 2️⃣  TOP BAR (total hrs + buttons) */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          px: 3,
          pb: 2,
        }}
      >
        <Typography variant="body2">
          Total Hours:&nbsp;{totals}
        </Typography>

        {!dayLocked && (
          <Box>
            <Button
              variant="contained"
              size="small"
              sx={{ mr: 1 }}
              startIcon={<AddIcon />}
              disabled={!!editingId}
              onClick={() => startEdit('new')}
            >
              Add New
            </Button>

            {lines.some(l =>
              ['open', 'rejected'].includes(l.Status.toLowerCase())
            ) && (
              <Button
                variant="contained"
                size="small"
                color="success"
                startIcon={<SendIcon />}
                onClick={() => setConfirmOpen(true)}
              >
                Submit All
              </Button>
            )}
          </Box>
        )}
      </Box>

      {/* 3️⃣  FEEDBACK BANNERS */}
      <Collapse in={!!alertMsg}>
        <Alert
          severity="success"
          sx={{ mx: 3, mb: 2 }}
          onClose={() => setAlertMsg('')}
        >
          {alertMsg}
        </Alert>
      </Collapse>

      <Collapse in={!!error}>
        <Alert
          severity="error"
          sx={{ mx: 3, mb: 2 }}
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      </Collapse>

      {/* 4️⃣  MAIN TABLE */}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>Client</TableCell>
              <TableCell sx={{ fontWeight: 600, minWidth: 180 }}>
                Project
              </TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="right">
                CF&nbsp;Hrs
              </TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="right">
                NCF&nbsp;Hrs
              </TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="right">
                Other&nbsp;Hrs
              </TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="right">
                Total
              </TableCell>
              <TableCell sx={{ fontWeight: 600, width: 260 }}>
                Notes
              </TableCell>
              <TableCell
                align="center"
                sx={{ fontWeight: 600, width: 185 }}
              >
                Timer&nbsp;/&nbsp;Actions
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {lines.map(line => {
              const status  = line.Status.toLowerCase();
              const locked  =
                dayLocked ||
                line.IsLocked ||
                ['submitted', 'approved'].includes(status);
              const rowId   = line.TimecardLineID;
              const editing = editingId === rowId;

              return (
                <TableRow
                  key={rowId}
                  sx={{ borderLeft: `4px solid ${statusBorder(status)}` }}
                >
                  {editing
                    ? renderEditable({
                        rowId,
                        draft: drafts[rowId],
                        setDraft,
                        clients,
                        projectsByClient,
                        timer: timers[rowId],
                        startTimer,
                        stopTimer,
                        elapsedSec,
                        onSave: saveDraft,
                        onCancel: cancelEdit,
                        saving,
                      })
                    : renderReadonly({
                        line,
                        locked,
                        onEdit: () => startEdit(line),
                        onDelete: () => handleDelete(line),
                      })}
                </TableRow>
              );
            })}

            {editingId === 'new' && (
              <TableRow>
                {renderEditable({
                  rowId: 'new',
                  draft: drafts.new,
                  setDraft,
                  clients,
                  projectsByClient,
                  timer: timers.new,
                  startTimer,
                  stopTimer,
                  elapsedSec,
                  onSave: saveDraft,
                  onCancel: cancelEdit,
                  saving,
                })}
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  )}
</DialogContent>


      </Dialog>

      {/* confirmation modal */}
      <ConfirmSubmitDialog open={confirmOpen}
        onConfirm={async () => {
          await submitTimesheetForDay(
            consultantID,
            dayjs(date).format('YYYY-MM-DD')
          );
          loadLines(); onTimeEntryChange?.(true); setConfirmOpen(false);
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}

/* ───────── render helpers ───────── */
function renderEditable({
  rowId, draft={}, setDraft,
  clients, projectsByClient,
  timer, startTimer, stopTimer, elapsedSec,
  onSave, onCancel, saving
}) {
  const hourFields = ['ClientFacingHours','NonClientFacingHours','OtherTaskHours'];
  const total = hourFields.reduce((s,f)=>s+roundNearestHalf(draft[f]),0).toFixed(1);
  const running = timer?.running;
  const elapsed = elapsedSec(rowId);

  return (
    <>
      {/* Client */}
      <TableCell>
        <TextField select size="small" value={draft.ClientID}
                   onChange={e=>setDraft('ClientID',e.target.value)} sx={{minWidth:160}}>
          {clients.length===0
            ? <MenuItem disabled>No Active Clients</MenuItem>
            : [...new Map(clients.map(c=>[c.ClientID,c])).values()] // unique by ClientID
                .map(c => <MenuItem key={c.ClientID} value={c.ClientID}>{c.ClientName}</MenuItem>)
          }
        </TextField>
      </TableCell>

      {/* Project */}
      <TableCell>
        <TextField select size="small" value={draft.ProjectID}
                   onChange={e=>setDraft('ProjectID',e.target.value)}
                   disabled={!draft.ClientID}
                   sx={{minWidth:180}}>
          {(projectsByClient[draft.ClientID]||[]).length===0
            ? <MenuItem disabled>No Projects</MenuItem>
            : projectsByClient[draft.ClientID]
                .map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)
          }
        </TextField>
      </TableCell>

      {/* Hours */}
      {hourFields.map(f => (
        <TableCell key={f} align="right">
          <TextField
            type="number"
            size="small"
            value={draft[f]}
            onChange={e=>setDraft(f, e.target.value === '' ? '' : roundNearestHalf(parseFloat(e.target.value)))}
            inputProps={{ min:0, max:99.5, step:0.5 }}
            sx={{ width: 80 }}
          />
        </TableCell>
      ))}

      <TableCell align="right">{total}</TableCell>

      {/* Notes */}
      <TableCell sx={{maxWidth:260,p:'4px'}}>
        <TextField
          size="small" multiline minRows={1} maxRows={5} fullWidth
          value={draft.Notes}
          onChange={e=>setDraft('Notes',e.target.value)}
        />
      </TableCell>

      {/* Timer + actions */}
      <TableCell align="center" sx={{whiteSpace:'nowrap'}}>
        <IconButton size="small" onClick={()=>running?stopTimer(rowId):startTimer(rowId)}>
          {running ? <StopIcon fontSize="small"/> : <PlayArrowIcon fontSize="small"/>}
        </IconButton>
        <Typography variant="caption" sx={{mx:0.5,fontFamily:'monospace'}}>
          {fmtHMS(elapsed)}
        </Typography>
        <IconButton size="small" color="primary" disabled={saving} onClick={onSave}>
          <SaveIcon fontSize="small"/>
        </IconButton>
        <IconButton size="small" disabled={saving} onClick={onCancel}>
          <CancelIcon fontSize="small"/>
        </IconButton>
      </TableCell>
    </>
  );
}

function renderReadonly({ line, locked, onEdit, onDelete }) {
  const total = (+line.ClientFacingHours + (+line.NonClientFacingHours) + (+line.OtherTaskHours)).toFixed(1);
  return (
    <>
      <TableCell>{line.ClientName}</TableCell>
      <TableCell>{line.ProjectName || '—'}</TableCell>
      <TableCell align="right">{(+line.ClientFacingHours    ).toFixed(1)}</TableCell>
      <TableCell align="right">{(+line.NonClientFacingHours ).toFixed(1)}</TableCell>
      <TableCell align="right">{(+line.OtherTaskHours       ).toFixed(1)}</TableCell>
      <TableCell align="right">{total}</TableCell>
      <TableCell sx={{maxWidth:260,whiteSpace:'normal',wordBreak:'break-word'}}>
        {line.Notes || '—'}
      </TableCell>
      <TableCell align="center">
        {!locked && (
          <>
            <IconButton size="small" onClick={onEdit}><EditIcon fontSize="small"/></IconButton>
            <IconButton size="small" onClick={onDelete}><DeleteIcon fontSize="small"/></IconButton>
          </>
        )}
      </TableCell>
    </>
  );
}
