import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
  FormControlLabel,
  Switch,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { getROISettings, upsertROIActivityTag } from '../../../api/roi';

export default function RoiSettings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);

  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const s = await getROISettings();
      setSettings(s);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const tags = settings?.activityTags || [];

  const openAdd = () => {
    setEdit(null);
    setName('');
    setIsActive(true);
    setOpen(true);
  };

  const openEdit = (row) => {
    setEdit(row);
    setName(row.Name);
    setIsActive(!!row.IsActive);
    setOpen(true);
  };

  const save = async () => {
    try {
      await upsertROIActivityTag({
        activityTagId: edit?.ActivityTagID,
        name,
        isActive,
      });
      setOpen(false);
      await load();
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.message || 'Failed to save tag');
    }
  };

  const handleToggleActive = async (row) => {
    try {
      await upsertROIActivityTag({
        activityTagId: row.ActivityTagID,
        name: row.Name,
        isActive: !row.IsActive,
      });
      await load();
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.message || 'Failed to update tag');
    }
  };

  const columns = [
    { field: 'Name', headerName: 'Tag', flex: 1, minWidth: 220 },
    {
      field: 'IsActive',
      headerName: 'Active',
      width: 120,
      sortable: false,
      renderCell: (params) => (
        <Switch
          checked={!!params.value}
          onChange={() => handleToggleActive(params.row)}
          size="small"
        />
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 140,
      sortable: false,
      renderCell: (params) => (
        <Button size="small" variant="outlined" onClick={() => openEdit(params.row)}>
          Edit
        </Button>
      ),
    },
  ];

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        ROI Tracker Settings
      </Typography>
      <Typography sx={{ mb: 2 }} color="text.secondary">
        Manage Activity Tags used to classify wins. Categories and rejection reasons can be added later.
      </Typography>

      <Box sx={{ mb: 2 }}>
        <Button variant="contained" onClick={openAdd}>
          Add Activity Tag
        </Button>
      </Box>

      <Box sx={{ height: 420, width: '100%' }}>
        <DataGrid
          rows={tags}
          getRowId={(r) => r.ActivityTagID}
          columns={columns}
          loading={loading}
          pageSizeOptions={[10, 25, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 10, page: 0 } } }}
        />
      </Box>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{edit ? 'Edit Activity Tag' : 'Add Activity Tag'}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Tag name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            sx={{ mt: 1, mb: 2 }}
          />
          <Box sx={{ mt: 2, mb: 1 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  color="primary"
                />
              }
              label={isActive ? 'Active (Yes)' : 'Active (No)'}
            />
            <Typography variant="caption" display="block" sx={{ mt: 1, color: 'text.secondary' }}>
              Set to inactive to hide a tag from selection
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={save}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
