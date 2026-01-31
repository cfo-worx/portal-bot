// src/modules/admin/components/BenchmarkDrawer.jsx

import React, { useState, useEffect } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Button,
  Divider,
  Slide,
  Collapse,
  TextField,
  Snackbar,
  Alert,
  Grid,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import BenchmarkList from './BenchmarkList';
import BenchmarkForm from './BenchmarkForm';
import { updateClient } from '../../../../api/clients';

const BenchmarkDrawer = ({
  open,
  onClose,
  client,
  benchmarks,
  onEditBenchmark,
  onDeleteBenchmark,
  refreshBenchmarks,
  refreshClients,
}) => {
  const [revenue, setRevenue] = useState('');
  const [grossProfitTarget, setGrossProfitTarget] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedBenchmark, setSelectedBenchmark] = useState(null);

  // initialize
  useEffect(() => {
    if (client) {
      setRevenue(client.MonthlyRevenue ?? '');
      setGrossProfitTarget(client.GrossProfitTarget ?? '');
    }
  }, [client]);

  // auto‐save
  const handleClientFieldBlur = async () => {
    try {
      await updateClient(client.ClientID, {
        ...client,
        MonthlyRevenue: parseFloat(revenue) || 0,
        GrossProfitTarget: parseInt(grossProfitTarget, 10) || 0,
      });
      setSnackbar({ open: true, message: 'Client saved', severity: 'success' });
      refreshClients?.();
      refreshBenchmarks?.();
    } catch {
      setSnackbar({ open: true, message: 'Error saving client', severity: 'error' });
    }
  };

  const handleAdd = () => {
    setIsFormOpen(true);
    setIsEditMode(false);
    setSelectedBenchmark(null);
  };
  const handleEdit = bm => {
    setIsFormOpen(true);
    setIsEditMode(true);
    setSelectedBenchmark(bm);
  };
  const handleFormClose = () => {
    setIsFormOpen(false);
    setIsEditMode(false);
    setSelectedBenchmark(null);
  };

  useEffect(() => {
    if (!open) handleFormClose();
  }, [open]);

  // compute gross‐profit dollars
  const profitDollars = (() => {
    const rev = parseFloat(revenue) || 0;
    const pct = parseFloat(grossProfitTarget) / 100 || 0;
    return rev * pct;
  })();

  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={onClose}
        PaperProps={{ sx: { width: '60%' } }}
      >
        <Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">
              Benchmarks for {client?.ClientName}
            </Typography>
            <IconButton onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </Box>
          <Divider sx={{ my: 2 }} />

          {/* Revenue / GPT / Profit $ */}
          <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Monthly Revenue"
                value={revenue}
                onChange={e => setRevenue(e.target.value)}
                onBlur={handleClientFieldBlur}
                type="number"
                fullWidth
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Gross Profit Target (%)"
                value={grossProfitTarget}
                onChange={e => setGrossProfitTarget(e.target.value)}
                onBlur={handleClientFieldBlur}
                type="number"
                fullWidth
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Desired Gross Profit $"
                value={`$${profitDollars.toFixed(2)}`}
                fullWidth
                size="small"
                disabled
              />
            </Grid>
          </Grid>
          <Divider sx={{ mb: 2 }} />

          {/* Add Benchmark */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <Button variant="contained" onClick={handleAdd}>
              Add Benchmark
            </Button>
          </Box>

          {/* Benchmark List */}
          <Collapse in={!isFormOpen} timeout="auto" unmountOnExit sx={{ flexGrow: 1, overflow: 'auto' }}>
            <BenchmarkList
              benchmarks={benchmarks}
              onEditBenchmark={handleEdit}
              onDeleteBenchmark={onDeleteBenchmark}
              monthlyRevenue={parseFloat(revenue) || 0}
              grossProfitTarget={parseFloat(grossProfitTarget) || 0}
            />
          </Collapse>

          {/* Benchmark Form */}
          <Slide direction="up" in={isFormOpen} mountOnEnter unmountOnExit>
            <Box sx={{ mt: 2 }}>
              <BenchmarkForm
                client={client}
                benchmark={selectedBenchmark}
                isEditMode={isEditMode}
                onClose={handleFormClose}
                refreshBenchmarks={refreshBenchmarks}
                allBenchmarks={benchmarks}
              />
            </Box>
          </Slide>
        </Box>
      </Drawer>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </>
  );
};

export default BenchmarkDrawer;
