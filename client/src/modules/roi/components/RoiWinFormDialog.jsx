import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  TextField,
  Typography,
  Chip,
  OutlinedInput,
  IconButton,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';

const emptySplit = (consultantId = '') => ({ consultantId, percentSplit: 100 });

const RoiWinFormDialog = ({
  open,
  onClose,
  onSave,
  initialWin,
  clients,
  consultants,
  clientOwners,
  categories,
  activityTags,
  roles,
  currentConsultantId,
}) => {
  const isEdit = Boolean(initialWin && (initialWin.roiWinId || initialWin.ROIWinID));

  const [form, setForm] = useState({
    clientId: '',
    title: '',
    categoryId: '',
    impactType: 'Recurring',
    impactDate: '',
    recurringMonthlyAmount: '',
    recurringStartDate: '',
    recurringEndDate: '',
    oneTimeTotalValue: '',
    oneTimeSpreadMonths: 1,
    activityTags: [],
    consultantSplits: [emptySplit(currentConsultantId || '')],
    clientOwnerUserId: '',
    externalNotes: '',
    internalNotes: '',
    correctionNote: '',
  });

  useEffect(() => {
    if (!open) return;

    if (isEdit) {
      // Handle both PascalCase (from API) and camelCase formats
      const win = initialWin || {};
      const formatDate = (dateValue) => {
        if (!dateValue) return '';
        if (dateValue instanceof Date) {
          return dateValue.toISOString().slice(0, 10);
        }
        if (typeof dateValue === 'string') {
          return dateValue.slice(0, 10);
        }
        return '';
      };

      setForm({
        clientId: win.ClientID || win.clientId || '',
        title: win.Title || win.title || '',
        categoryId: win.CategoryID || win.categoryId || '',
        impactType: win.ImpactType || win.impactType || 'Recurring',
        impactDate: formatDate(win.ImpactDate || win.impactDate),
        recurringMonthlyAmount: win.RecurringMonthlyAmount ?? win.recurringMonthlyAmount ?? '',
        recurringStartDate: formatDate(win.RecurringStartDate || win.recurringStartDate),
        recurringEndDate: formatDate(win.RecurringEndDate || win.recurringEndDate),
        oneTimeTotalValue: win.OneTimeTotalValue ?? win.oneTimeTotalValue ?? '',
        oneTimeSpreadMonths: win.OneTimeSpreadMonths ?? win.oneTimeSpreadMonths ?? 1,
        activityTags: (win.ActivityTags || win.activityTags || []).map((t) => t.ActivityTagID || t.activityTagID),
        consultantSplits: (win.Consultants || win.consultantSplits || []).map((c) => ({
          consultantId: c.ConsultantID || c.consultantId || '',
          percentSplit: c.PercentSplit ?? c.percentSplit ?? 0,
        })),
        clientOwnerUserId: win.ClientOwnerUserID || win.clientOwnerUserId || '',
        externalNotes: win.ExternalNotes || win.externalNotes || '',
        internalNotes: win.InternalNotes || win.internalNotes || '',
        correctionNote: win.CorrectionNote || win.correctionNote || '',
      });
    } else {
      setForm((prev) => ({
        ...prev,
        clientId: '',
        title: '',
        categoryId: categories?.[0]?.CategoryID || '',
        impactType: 'Recurring',
        impactDate: '',
        recurringMonthlyAmount: '',
        recurringStartDate: '',
        recurringEndDate: '',
        oneTimeTotalValue: '',
        oneTimeSpreadMonths: 1,
        activityTags: [],
        consultantSplits: [emptySplit(currentConsultantId || '')],
        clientOwnerUserId: '',
        externalNotes: '',
        internalNotes: '',
        correctionNote: '',
      }));
    }
  }, [open, isEdit, initialWin, categories, currentConsultantId]);

  const selectedTags = useMemo(() => {
    const map = new Map(activityTags.map((t) => [t.ActivityTagID, t.Name]));
    return form.activityTags.map((id) => ({ id, name: map.get(id) || String(id) }));
  }, [activityTags, form.activityTags]);

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSplitChange = (idx, field) => (e) => {
    const value = e.target.value;
    setForm((prev) => {
      const next = [...prev.consultantSplits];
      next[idx] = { ...next[idx], [field]: field === 'percentSplit' ? Number(value) : value };
      return { ...prev, consultantSplits: next };
    });
  };

  const addSplit = () => {
    setForm((prev) => ({
      ...prev,
      consultantSplits: [...prev.consultantSplits, emptySplit('')],
    }));
  };

  const removeSplit = (idx) => {
    setForm((prev) => ({
      ...prev,
      consultantSplits: prev.consultantSplits.filter((_, i) => i !== idx),
    }));
  };

  const sumSplit = useMemo(() => {
    return (form.consultantSplits || []).reduce((sum, s) => sum + (Number(s.percentSplit) || 0), 0);
  }, [form.consultantSplits]);

  const onSubmit = () => {
    const payload = {
      clientId: form.clientId,
      title: form.title,
      categoryId: form.categoryId,
      impactType: form.impactType,
      impactDate: form.impactDate,
      recurringMonthlyAmount: form.recurringMonthlyAmount === '' ? null : Number(form.recurringMonthlyAmount),
      recurringStartDate: form.recurringStartDate || null,
      recurringEndDate: form.recurringEndDate || null,
      oneTimeTotalValue: form.oneTimeTotalValue === '' ? null : Number(form.oneTimeTotalValue),
      oneTimeSpreadMonths: Number(form.oneTimeSpreadMonths) || 1,
      activityTags: form.activityTags,
      consultantSplits: form.consultantSplits,
      clientOwnerUserId: form.clientOwnerUserId || null,
      externalNotes: form.externalNotes || null,
      internalNotes: form.internalNotes || null,
      correctionNote: form.correctionNote || null,
    };

    onSave(payload);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{isEdit ? 'Edit ROI Win' : 'Add ROI Win'}</DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Client</InputLabel>
              <Select value={form.clientId} label="Client" onChange={handleChange('clientId')}>
                {[...clients]
                  .sort((a, b) => 
                    (a.ClientName || a.clientName || '').localeCompare(b.ClientName || b.clientName || '')
                  )
                  .map((c) => (
                    <MenuItem key={c.ClientID || c.clientId} value={c.ClientID || c.clientId}>
                      {c.ClientName || c.clientName}
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField fullWidth label="Win Title" value={form.title} onChange={handleChange('title')} />
          </Grid>

          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Impact Category</InputLabel>
              <Select value={form.categoryId} label="Impact Category" onChange={handleChange('categoryId')}>
                {categories.map((c) => (
                  <MenuItem key={c.CategoryID} value={c.CategoryID}>
                    {c.Name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Activity Tags (multi)</InputLabel>
              <Select
                multiple
                value={form.activityTags}
                onChange={handleChange('activityTags')}
                input={<OutlinedInput label="Activity Tags (multi)" />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selectedTags.map((t) => (
                      <Chip key={t.id} label={t.name} />
                    ))}
                  </Box>
                )}
              >
                {activityTags
                  .filter((t) => t.IsActive)
                  .map((t) => (
                    <MenuItem key={t.ActivityTagID} value={t.ActivityTagID}>
                      {t.Name}
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12}>
            <FormControl>
              <RadioGroup row value={form.impactType} onChange={handleChange('impactType')}>
                <FormControlLabel value="Recurring" control={<Radio />} label="Recurring" />
                <FormControlLabel value="OneTime" control={<Radio />} label="One-Time" />
              </RadioGroup>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              type="date"
              label="Impact Date"
              InputLabelProps={{ shrink: true }}
              value={form.impactDate}
              onChange={handleChange('impactDate')}
              helperText="Month reporting is grouped by this date"
            />
          </Grid>

          {form.impactType === 'Recurring' ? (
            <>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  type="number"
                  label="Monthly Amount (USD)"
                  value={form.recurringMonthlyAmount}
                  onChange={handleChange('recurringMonthlyAmount')}
                  inputProps={{ min: 0, step: 0.01 }}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  type="date"
                  label="Start Date"
                  InputLabelProps={{ shrink: true }}
                  value={form.recurringStartDate}
                  onChange={handleChange('recurringStartDate')}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  type="date"
                  label="End Date (optional)"
                  InputLabelProps={{ shrink: true }}
                  value={form.recurringEndDate}
                  onChange={handleChange('recurringEndDate')}
                />
              </Grid>
            </>
          ) : (
            <>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  type="number"
                  label="One-Time Value (USD)"
                  value={form.oneTimeTotalValue}
                  onChange={handleChange('oneTimeTotalValue')}
                  inputProps={{ min: 0, step: 0.01 }}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>Spread Months</InputLabel>
                  <Select
                    value={form.oneTimeSpreadMonths}
                    label="Spread Months"
                    onChange={handleChange('oneTimeSpreadMonths')}
                  >
                    {[1, 2, 3].map((n) => (
                      <MenuItem key={n} value={n}>
                        {n}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </>
          )}

          {(roles.includes('Admin') || roles.includes('Manager')) && (
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Client Owner (optional)</InputLabel>
                <Select
                  value={form.clientOwnerUserId}
                  label="Client Owner (optional)"
                  onChange={handleChange('clientOwnerUserId')}
                >
                  <MenuItem value="">None</MenuItem>
                  {clientOwners.map((u) => (
                    <MenuItem key={u.UserID} value={u.UserID}>
                      {u.FirstName} {u.LastName} {((u.Roles || []).length ? `(${(u.Roles || []).join(', ')})` : '')}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          )}

          <Grid item xs={12}>
            <Typography variant="subtitle1" sx={{ mt: 1 }}>
              Consultants & % Split (must total 100 at submit)
            </Typography>
            {form.consultantSplits.map((s, idx) => (
              <Box
                key={idx}
                sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 1, flexWrap: 'wrap' }}
              >
                <FormControl sx={{ minWidth: 260 }}>
                  <InputLabel>Consultant</InputLabel>
                  <Select
                    value={s.consultantId}
                    label="Consultant"
                    onChange={handleSplitChange(idx, 'consultantId')}
                  >
                    {consultants.map((c) => (
                      <MenuItem key={c.ConsultantID} value={c.ConsultantID}>
                        {c.FirstName} {c.LastName}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <TextField
                  type="number"
                  label="%"
                  value={s.percentSplit}
                  onChange={handleSplitChange(idx, 'percentSplit')}
                  inputProps={{ min: 0, max: 100, step: 0.01 }}
                  sx={{ width: 120 }}
                />

                <IconButton onClick={() => removeSplit(idx)} disabled={form.consultantSplits.length <= 1}>
                  <DeleteIcon />
                </IconButton>
              </Box>
            ))}

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
              <Button size="small" startIcon={<AddIcon />} onClick={addSplit}>
                Add Consultant
              </Button>
              <Typography variant="body2">Current Total: {sumSplit.toFixed(2)}%</Typography>
            </Box>
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="External Notes (client-ready)"
              multiline
              minRows={4}
              value={form.externalNotes}
              onChange={handleChange('externalNotes')}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Internal Notes"
              multiline
              minRows={4}
              value={form.internalNotes}
              onChange={handleChange('internalNotes')}
            />
          </Grid>

          {isEdit && (
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Correction Note (required when editing after submit/approval)"
                multiline
                minRows={2}
                value={form.correctionNote}
                onChange={handleChange('correctionNote')}
              />
            </Grid>
          )}
        </Grid>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={onSubmit}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RoiWinFormDialog;
