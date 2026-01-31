import React, { useContext, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import { AuthContext } from '../../../context/AuthContext';
import { getClients, getActiveClients, getActiveClientsForConsultant } from '../../../api/clients';
import { getActiveConsultants } from '../../../api/consultants';
import { getUsers } from '../../../api/users';
import {
  createROIWin,
  deleteROIWin,
  getROISettings,
  getROIWins,
  submitROIWin,
  updateROIWin,
} from '../../../api/roi';
import RoiWinFormDialog from './RoiWinFormDialog';

const RoiWinsTable = ({ role }) => {
  const { auth } = useContext(AuthContext);
  const consultantId = auth?.user?.consultantId;
  const roles = auth?.user?.roles || [];

  const [wins, setWins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState([]);
  const [consultants, setConsultants] = useState([]);
  const [clientOwners, setClientOwners] = useState([]);
  const [settings, setSettings] = useState({ categories: [], activityTags: [], rejectionReasons: [] });

  const [clientFilter, setClientFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [showForm, setShowForm] = useState(false);
  const [editingWin, setEditingWin] = useState(null);

  const canManageAll = roles.includes('Admin') || roles.includes('Manager');
  const canDelete = roles.includes('Admin');

  const loadLookups = async () => {
    try {
      const [settingsData, consultantsData] = await Promise.all([
        getROISettings(),
        getActiveConsultants(),
      ]);
      setSettings(settingsData);
      setConsultants(consultantsData);

      let c = [];
      if (canManageAll) {
        // Admin and Manager should see all active clients
        c = await getActiveClients();
      } else if (consultantId) {
        c = await getActiveClientsForConsultant(consultantId);
      } else {
        c = await getClients();
      }
      // Sort clients alphabetically by ClientName
      const sorted = (c || []).sort((a, b) => 
        (a.ClientName || '').localeCompare(b.ClientName || '')
      );
      setClients(sorted);

      const users = await getUsers();
      // There are no dedicated "Sales Rep" roles in CFO Worx Portal today.
      // For the optional "Client Owner" attribution, default to internal Managers/Admins.
      const internalUsers = users.filter((u) => !u.ClientID);
      setClientOwners(
        internalUsers.filter((u) =>
          (u.Roles || []).some((r) => ['manager', 'admin'].includes(String(r || '').toLowerCase()))
        )
      );
    } catch (e) {
      console.error(e);
    }
  };

  const loadWins = async () => {
    setLoading(true);
    try {
      const params = {};
      if (clientFilter !== 'ALL') params.clientId = clientFilter;
      if (statusFilter !== 'ALL') params.status = statusFilter;
      const data = await getROIWins(params);
      setWins(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLookups();
  }, []);

  useEffect(() => {
    loadWins();
  }, [clientFilter, statusFilter]);

  const columns = useMemo(() => {
    const cols = [
      { field: 'ClientName', headerName: 'Client', flex: 1, minWidth: 150 },
      { field: 'Title', headerName: 'Title', flex: 1.5, minWidth: 220 },
      {
        field: 'ImpactType',
        headerName: 'Type',
        width: 110,
        renderCell: (params) => (
          <Chip size="small" label={params.value === 'Recurring' ? 'Recurring' : 'One‑Time'} />
        ),
      },
      {
        field: 'CategoryName',
        headerName: 'Category',
        width: 170,
      },
      {
        field: 'ImpactDate',
        headerName: 'Impact Date',
        width: 120,
      },
      {
        field: 'ValueDisplay',
        headerName: 'Value',
        width: 140,
      },
      {
        field: 'Status',
        headerName: 'Status',
        width: 120,
        renderCell: (params) => {
          const s = params.value;
          const color = s === 'Approved' ? 'success' : s === 'Rejected' ? 'error' : s === 'Submitted' ? 'warning' : 'default';
          return <Chip size="small" label={s} color={color} variant={s === 'Draft' ? 'outlined' : 'filled'} />;
        },
      },
      {
        field: 'LastEditedAt',
        headerName: 'Updated',
        width: 170,
      },
      {
        field: 'actions',
        headerName: 'Actions',
        width: 260,
        sortable: false,
        renderCell: (params) => {
          const row = params.row;
          const isDraft = row.Status === 'Draft' || row.Status === 'Rejected' || row.Status === 'Approved';
          return (
            <Box sx={{ display: 'flex', gap: 1, paddingTop: '10px' }}>
              <Button size="small" variant="outlined" onClick={() => { setEditingWin(row); setShowForm(true); }}>
                Edit
              </Button>
              <Button
                size="small"
                variant="contained"
                disabled={row.Status !== 'Draft'}
                onClick={async () => {
                  await submitROIWin(row.ROIWinID);
                  loadWins();
                }}
              >
                Submit
              </Button>
              {canDelete && (
                <Button
                  size="small"
                  color="error"
                  onClick={async () => {
                    if (window.confirm('Delete this win? (Soft delete)')) {
                      await deleteROIWin(row.ROIWinID);
                      loadWins();
                    }
                  }}
                >
                  Delete
                </Button>
              )}
            </Box>
          );
        },
      },
    ];

    return cols;
  }, [canDelete]);

  const rows = useMemo(() => {
    return (wins || []).map((w) => {
      const value = w.ImpactType === 'Recurring'
        ? w.RecurringMonthlyAmount
        : w.OneTimeTotalValue;
      const valueDisplay = value != null ? `$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '';

      return {
        ...w,
        id: w.ROIWinID,
        ValueDisplay: valueDisplay,
      };
    });
  }, [wins]);

  const handleCreate = () => {
    setEditingWin(null);
    setShowForm(true);
  };

  const handleSave = async (payload) => {
    if (editingWin?.ROIWinID) {
      await updateROIWin(editingWin.ROIWinID, payload);
    } else {
      await createROIWin(payload);
    }
    setShowForm(false);
    setEditingWin(null);
    loadWins();
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Wins</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>
          Add Win
        </Button>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: 240 }}>
          <InputLabel>Client</InputLabel>
          <Select value={clientFilter} label="Client" onChange={(e) => setClientFilter(e.target.value)}>
            <MenuItem value="ALL">All</MenuItem>
            {clients.map((c) => (
              <MenuItem key={c.ClientID} value={c.ClientID}>{c.ClientName}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Status</InputLabel>
          <Select value={statusFilter} label="Status" onChange={(e) => setStatusFilter(e.target.value)}>
            <MenuItem value="ALL">All</MenuItem>
            <MenuItem value="Draft">Draft</MenuItem>
            <MenuItem value="Submitted">Submitted</MenuItem>
            <MenuItem value="Approved">Approved</MenuItem>
            <MenuItem value="Rejected">Rejected</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <Box sx={{ height: 560, width: '100%' }}>
        <DataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          disableRowSelectionOnClick
          pageSizeOptions={[10, 25, 50]}
          initialState={{
            pagination: { paginationModel: { pageSize: 25, page: 0 } },
            sorting: { sortModel: [{ field: 'LastEditedAt', sort: 'desc' }] },
          }}
        />
      </Box>

      <RoiWinFormDialog
        open={showForm}
        onClose={() => { setShowForm(false); setEditingWin(null); }}
        onSave={handleSave}
        initialWin={editingWin}
        clients={clients}
        consultants={consultants}
        clientOwners={clientOwners}
        categories={settings.categories}
        activityTags={settings.activityTags}
        roles={roles}
        currentConsultantId={consultantId}
      />
    </Box>
  );
};

export default RoiWinsTable;
