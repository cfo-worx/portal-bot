import React, { useContext, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Snackbar,
  Alert,
  TextField,
  Typography,
  IconButton,
  Tooltip,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { Refresh as RefreshIcon, PersonAdd as ClaimIcon } from '@mui/icons-material';

import { AuthContext } from '../../../context/AuthContext';
import { getDeals, updateDeal } from '../../../api/crmDeals';

const ProspectQueue = ({ activeRole }) => {
  const { auth } = useContext(AuthContext);

  const [loading, setLoading] = useState(true);
  const [allDeals, setAllDeals] = useState([]);
  const [search, setSearch] = useState('');

  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'info',
  });

  const myConsultantId = auth.user?.consultantId || null;
  const canClaim = !!myConsultantId;

  const load = async () => {
    setLoading(true);
    try {
      const deals = await getDeals({ module: 'sales' });
      setAllDeals(deals || []);
    } catch (err) {
      console.error('Error loading prospect queue:', err);
      setSnackbar({
        open: true,
        message: 'Failed to load prospect queue',
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const queueDeals = useMemo(() => {
    const term = (search || '').trim().toLowerCase();

    return (allDeals || [])
      .filter((d) => !d.OwnerID) // unassigned pool
      .filter((d) => (d.StageName || '').toLowerCase() === 'prospect') // prospect stage
      .filter((d) => {
        if (!term) return true;
        return (
          (d.Company || '').toLowerCase().includes(term) ||
          (d.Contact || '').toLowerCase().includes(term) ||
          (d.LeadSourceName || '').toLowerCase().includes(term)
        );
      })
      .sort((a, b) => {
        const ad = a.LastActivityDate ? new Date(a.LastActivityDate).getTime() : 0;
        const bd = b.LastActivityDate ? new Date(b.LastActivityDate).getTime() : 0;
        return bd - ad;
      });
  }, [allDeals, search]);

  const handleClaim = async (deal) => {
    if (!deal?.DealID) return;
    if (!canClaim) {
      setSnackbar({
        open: true,
        message: 'Your user is missing consultantId; cannot claim leads.',
        severity: 'warning',
      });
      return;
    }

    try {
      const updated = await updateDeal(deal.DealID, { OwnerID: myConsultantId });
      setAllDeals((prev) => prev.map((d) => (d.DealID === deal.DealID ? updated : d)));

      setSnackbar({
        open: true,
        message: 'Prospect claimed',
        severity: 'success',
      });
    } catch (err) {
      console.error('Error claiming prospect:', err);
      setSnackbar({
        open: true,
        message: 'Failed to claim prospect',
        severity: 'error',
      });
    }
  };

  const columns = useMemo(
    () => [
      { field: 'Company', headerName: 'Company', flex: 1, minWidth: 220 },
      {
        field: 'Contact',
        headerName: 'Contact',
        flex: 1,
        minWidth: 180,
        valueGetter: (p) => p.row.Contact || '—',
      },
      {
        field: 'LeadSourceName',
        headerName: 'Source',
        minWidth: 160,
        valueGetter: (p) => p.row.LeadSourceName || '—',
      },
      {
        field: 'LastActivity',
        headerName: 'Last Activity',
        flex: 1,
        minWidth: 240,
        valueGetter: (p) => p.row.LastActivity || '—',
      },
      {
        field: 'actions',
        headerName: '',
        sortable: false,
        filterable: false,
        width: 150,
        renderCell: (params) => (
          <Button
            size="small"
            variant="contained"
            startIcon={<ClaimIcon fontSize="small" />}
            onClick={(e) => {
              e.stopPropagation();
              handleClaim(params.row);
            }}
            disabled={!canClaim}
          >
            Claim
          </Button>
        ),
      },
    ],
    [canClaim]
  );

  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="h6" sx={{ mb: 1 }}>
        Prospect Queue
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Unassigned prospects that need review. Sales reps can claim items into their pipeline.
      </Typography>

      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap', mb: 2 }}>
        <TextField
          size="small"
          placeholder="Search prospects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: 260 }}
        />

        <Tooltip title="Refresh">
          <IconButton onClick={load} disabled={loading}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>

        {!canClaim && (
          <Typography variant="caption" color="text.secondary">
            (Claim disabled: missing consultantId on this user)
          </Typography>
        )}
      </Box>

      <Box sx={{ height: 620, width: '100%' }}>
        <DataGrid
          rows={queueDeals}
          columns={columns}
          getRowId={(row) => row.DealID}
          loading={loading}
          disableRowSelectionOnClick
          density="compact"
          pageSizeOptions={[10, 25, 50, 100]}
          initialState={{
            pagination: { paginationModel: { page: 0, pageSize: 25 } },
          }}
        />
      </Box>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
      >
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default ProspectQueue;
