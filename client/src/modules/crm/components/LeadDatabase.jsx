import React, { useMemo, useState, useEffect, useContext } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Typography,
  Snackbar,
  Alert,
  Chip,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Autocomplete,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import {
  UploadFile as UploadFileIcon,
  Close as CloseIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import { getLeads, updateLead, deleteLead, importLeads, getImportBatches, getImportBatchErrors, getDuplicateGroups } from '../../../api/leads';
import { AuthContext } from '../../../context/AuthContext';

const LeadDatabase = ({ activeRole }) => {
  const { auth } = useContext(AuthContext);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    industry: '',
    domain: '',
    isDuplicate: undefined,
  });
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importErrors, setImportErrors] = useState([]);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState([]);
  const [selectedDuplicateGroup, setSelectedDuplicateGroup] = useState(null);
  const [editingCell, setEditingCell] = useState(null);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'info',
  });

  useEffect(() => {
    loadLeads();
    loadDuplicateGroups();
  }, [search, filters]);

  const loadLeads = async () => {
    setLoading(true);
    try {
      const leadsData = await getLeads({
        search: search || undefined,
        industry: filters.industry || undefined,
        domain: filters.domain || undefined,
        isDuplicate: filters.isDuplicate,
      });
      setLeads(leadsData || []);
    } catch (error) {
      console.error('Error loading leads:', error);
      setSnackbar({
        open: true,
        message: 'Failed to load leads',
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadDuplicateGroups = async () => {
    try {
      const groups = await getDuplicateGroups();
      setDuplicateGroups(groups || []);
    } catch (error) {
      console.error('Error loading duplicate groups:', error);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      const allowed = ['csv', 'xls', 'xlsx'];
      if (!allowed.includes(ext)) {
        setSnackbar({
          open: true,
          message: 'Please upload a CSV, XLS, or XLSX file.',
          severity: 'warning',
        });
        return;
      }
      setImportFile(file);
    }
  };

  const handleImport = async () => {
    if (!importFile) return;

    setImporting(true);
    setImportResult(null);
    setImportErrors([]);

    try {
      const result = await importLeads(importFile);
      setImportResult(result);
      
      if (result.errors && result.errors.length > 0) {
        setImportErrors(result.errors);
      }

      setSnackbar({
        open: true,
        message: `Import completed: ${result.importedRows} imported, ${result.duplicateRows} duplicates, ${result.errorRows} errors`,
        severity: result.errorRows > 0 ? 'warning' : 'success',
      });

      // Reload leads and duplicate groups
      await loadLeads();
      await loadDuplicateGroups();

      // Close dialog after a delay if successful
      if (result.errorRows === 0) {
        setTimeout(() => {
          setImportDialogOpen(false);
          setImportFile(null);
          setImportResult(null);
          setImportErrors([]);
        }, 3000);
      }
    } catch (error) {
      console.error('Error importing leads:', error);
      setSnackbar({
        open: true,
        message: error.response?.data?.error || 'Failed to import leads',
        severity: 'error',
      });
    } finally {
      setImporting(false);
    }
  };

  const handleCellEdit = async (params, newValue) => {
    try {
      const field = params.field;
      const updates = { [field]: newValue };
      
      await updateLead(params.id, updates);
      
      // Update local state
      setLeads(leads.map(lead => 
        lead.LeadID === params.id ? { ...lead, [field]: newValue } : lead
      ));

      setSnackbar({
        open: true,
        message: 'Lead updated successfully',
        severity: 'success',
      });
    } catch (error) {
      console.error('Error updating lead:', error);
      setSnackbar({
        open: true,
        message: 'Failed to update lead',
        severity: 'error',
      });
    }
  };

  const handleDeleteLead = async (id) => {
    if (!window.confirm('Are you sure you want to delete this lead?')) return;

    try {
      await deleteLead(id);
      // Reload leads from server to ensure consistency
      await loadLeads();
      setSnackbar({
        open: true,
        message: 'Lead deleted successfully',
        severity: 'success',
      });
    } catch (error) {
      console.error('Error deleting lead:', error);
      setSnackbar({
        open: true,
        message: 'Failed to delete lead',
        severity: 'error',
      });
    }
  };

  const handleReviewDuplicates = async (group) => {
    setSelectedDuplicateGroup(group);
    // Load all leads in this duplicate group
    try {
      const duplicateLeads = await getLeads({
        domain: group.Domain,
        email: group.Email,
      });
      setSelectedDuplicateGroup({ ...group, leads: duplicateLeads });
      setDuplicateDialogOpen(true);
    } catch (error) {
      console.error('Error loading duplicate leads:', error);
    }
  };

  const handleMergeDuplicates = async (keepLeadId, duplicateLeadIds) => {
    // Mark duplicates as inactive and set DuplicateOfLeadID
    try {
      for (const dupId of duplicateLeadIds) {
        await updateLead(dupId, {
          IsDuplicate: true,
          DuplicateOfLeadID: keepLeadId,
          IsActive: false,
        });
      }
      
      setSnackbar({
        open: true,
        message: 'Duplicates merged successfully',
        severity: 'success',
      });
      
      setDuplicateDialogOpen(false);
      setSelectedDuplicateGroup(null);
      await loadLeads();
      await loadDuplicateGroups();
    } catch (error) {
      console.error('Error merging duplicates:', error);
      setSnackbar({
        open: true,
        message: 'Failed to merge duplicates',
        severity: 'error',
      });
    }
  };

  // Get unique industries for filter
  const industries = useMemo(() => {
    const unique = [...new Set(leads.map(l => l.Industry).filter(Boolean))].sort();
    return unique;
  }, [leads]);

  // Get unique domains for filter
  const domains = useMemo(() => {
    const unique = [...new Set(leads.map(l => l.Domain).filter(Boolean))].sort();
    return unique;
  }, [leads]);

  const columns = useMemo(() => [
    {
      field: 'CompanyName',
      headerName: 'Company',
      flex: 1,
      minWidth: 180,
      editable: true,
    },
    {
      field: 'Email',
      headerName: 'Email',
      flex: 1,
      minWidth: 200,
      editable: true,
    },
    {
      field: 'Domain',
      headerName: 'Domain',
      flex: 0.8,
      minWidth: 150,
    },
    {
      field: 'FullName',
      headerName: 'Contact Name',
      flex: 1,
      minWidth: 150,
      editable: true,
      valueGetter: (params) => {
        if (!params || !params.row) return '';
        return params.row.FullName || `${params.row.FirstName || ''} ${params.row.LastName || ''}`.trim();
      },
    },
    {
      field: 'Title',
      headerName: 'Title',
      flex: 0.8,
      minWidth: 120,
      editable: true,
    },
    {
      field: 'Phone',
      headerName: 'Phone',
      flex: 0.8,
      minWidth: 120,
      editable: true,
    },
    {
      field: 'Industry',
      headerName: 'Industry',
      flex: 0.8,
      minWidth: 120,
      editable: true,
    },
    {
      field: 'Revenue',
      headerName: 'Revenue',
      flex: 0.8,
      minWidth: 120,
      editable: true,
      type: 'number',
      valueFormatter: (params) => {
        if (!params || params.value === null || params.value === undefined) return '—';
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
        }).format(params.value);
      },
    },
    {
      field: 'EmployeeCount',
      headerName: 'Employees',
      flex: 0.6,
      minWidth: 100,
      editable: true,
      type: 'number',
    },
    {
      field: 'City',
      headerName: 'City',
      flex: 0.7,
      minWidth: 100,
      editable: true,
    },
    {
      field: 'State',
      headerName: 'State',
      flex: 0.6,
      minWidth: 80,
      editable: true,
    },
    {
      field: 'IsDuplicate',
      headerName: 'Status',
      flex: 0.6,
      minWidth: 100,
      renderCell: (params) => (
        params.row.IsDuplicate ? (
          <Chip label="Duplicate" size="small" color="warning" />
        ) : (
          <Chip label="Active" size="small" color="success" />
        )
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      sortable: false,
      width: 100,
      renderCell: (params) => (
        <IconButton
          size="small"
          color="error"
          onClick={() => handleDeleteLead(params.row.LeadID)}
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      ),
    },
  ], []);

  const filteredLeads = useMemo(() => {
    let filtered = leads;
    
    // Apply search filter
    if (search && search.trim()) {
      const searchTerm = search.trim().toLowerCase();
      filtered = filtered.filter(lead => {
        const searchableFields = [
          lead.Email,
          lead.CompanyName,
          lead.Domain,
          lead.FullName,
          lead.FirstName,
          lead.LastName,
          lead.Industry,
          lead.City,
          lead.State,
          lead.Phone,
          lead.Title,
        ].filter(Boolean).join(' ').toLowerCase();
        return searchableFields.includes(searchTerm);
      });
    }
    
    // Apply duplicate filter
    if (filters.isDuplicate !== undefined) {
      filtered = filtered.filter(lead => lead.IsDuplicate === filters.isDuplicate);
    }
    
    // Apply industry filter
    if (filters.industry) {
      filtered = filtered.filter(lead => lead.Industry === filters.industry);
    }
    
    // Apply domain filter
    if (filters.domain) {
      filtered = filtered.filter(lead => lead.Domain === filters.domain);
    }
    
    return filtered;
  }, [leads, filters, search]);

  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="h6" sx={{ mb: 1 }}>
        Lead Database
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Manage your lead database with import, filtering, and deduplication capabilities.
      </Typography>

      {/* Filters and Actions */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                size="small"
                fullWidth
                placeholder="Search leads..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Industry</InputLabel>
                <Select
                  value={filters.industry}
                  onChange={(e) => setFilters({ ...filters, industry: e.target.value })}
                  label="Industry"
                >
                  <MenuItem value="">All</MenuItem>
                  {industries.map(ind => (
                    <MenuItem key={ind} value={ind}>{ind}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  value={filters.isDuplicate === undefined ? '' : filters.isDuplicate ? 'duplicate' : 'active'}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFilters({
                      ...filters,
                      isDuplicate: val === '' ? undefined : val === 'duplicate',
                    });
                  }}
                  label="Status"
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="duplicate">Duplicates</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <Button
                variant="contained"
                startIcon={<UploadFileIcon />}
                onClick={() => setImportDialogOpen(true)}
                fullWidth
              >
                Import
              </Button>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Button
                variant="outlined"
                onClick={() => {
                  setDuplicateDialogOpen(true);
                  loadDuplicateGroups();
                }}
                fullWidth
                disabled={duplicateGroups.length === 0}
              >
                Review Duplicates ({duplicateGroups.length})
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Leads Table */}
      <Box sx={{ height: 650, width: '100%' }}>
        <DataGrid
          rows={filteredLeads}
          columns={columns}
          getRowId={(row) => row.LeadID}
          loading={loading}
          disableRowSelectionOnClick
          density="compact"
          pageSizeOptions={[25, 50, 100, 250]}
          initialState={{
            pagination: { paginationModel: { page: 0, pageSize: 50 } },
          }}
          processRowUpdate={handleCellEdit}
          onProcessRowUpdateError={(error) => {
            console.error('Error updating row:', error);
            setSnackbar({
              open: true,
              message: 'Failed to update lead',
              severity: 'error',
            });
          }}
        />
      </Box>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onClose={() => !importing && setImportDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Import Leads</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <input
              type="file"
              accept=".csv,.xls,.xlsx"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              id="lead-import-file-input"
            />
            <label htmlFor="lead-import-file-input">
              <Button
                variant="outlined"
                component="span"
                startIcon={<UploadFileIcon />}
                fullWidth
                sx={{ mb: 2 }}
              >
                {importFile ? importFile.name : 'Select CSV/Excel File'}
              </Button>
            </label>

            {importResult && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>Import Results:</Typography>
                <Typography variant="body2">
                  • Total Rows: {importResult.totalRows}
                  <br />
                  • Imported: {importResult.importedRows}
                  <br />
                  • Duplicates: {importResult.duplicateRows}
                  <br />
                  • Errors: {importResult.errorRows}
                </Typography>
              </Box>
            )}

            {importErrors.length > 0 && (
              <Box sx={{ mt: 2, maxHeight: 300, overflow: 'auto' }}>
                <Typography variant="subtitle2" gutterBottom>Import Errors:</Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Row</TableCell>
                        <TableCell>Error</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {importErrors.slice(0, 50).map((error, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{error.rowNumber}</TableCell>
                          <TableCell>{error.errorMessage}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                {importErrors.length > 50 && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                    Showing first 50 of {importErrors.length} errors
                  </Typography>
                )}
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setImportDialogOpen(false);
            setImportFile(null);
            setImportResult(null);
            setImportErrors([]);
          }} disabled={importing}>
            {importResult ? 'Close' : 'Cancel'}
          </Button>
          <Button
            variant="contained"
            onClick={handleImport}
            disabled={!importFile || importing}
            startIcon={importing ? <CircularProgress size={16} /> : <UploadFileIcon />}
          >
            {importing ? 'Importing...' : 'Import'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Duplicate Review Dialog */}
      <Dialog open={duplicateDialogOpen} onClose={() => setDuplicateDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          Review Duplicates
          <IconButton
            onClick={() => setDuplicateDialogOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {selectedDuplicateGroup ? (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Domain: {selectedDuplicateGroup.Domain} | Email: {selectedDuplicateGroup.Email}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Found {selectedDuplicateGroup.leads?.length || 0} duplicate leads. Select one to keep and merge the others.
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Keep</TableCell>
                      <TableCell>Company</TableCell>
                      <TableCell>Contact</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Industry</TableCell>
                      <TableCell>Created</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedDuplicateGroup.leads?.map((lead) => (
                      <TableRow key={lead.LeadID}>
                        <TableCell>
                          <IconButton
                            size="small"
                            onClick={() => {
                              const otherIds = selectedDuplicateGroup.leads
                                .filter(l => l.LeadID !== lead.LeadID)
                                .map(l => l.LeadID);
                              handleMergeDuplicates(lead.LeadID, otherIds);
                            }}
                          >
                            <CheckCircleIcon color="primary" />
                          </IconButton>
                        </TableCell>
                        <TableCell>{lead.CompanyName || '—'}</TableCell>
                        <TableCell>{lead.FullName || `${lead.FirstName || ''} ${lead.LastName || ''}`.trim() || '—'}</TableCell>
                        <TableCell>{lead.Email || '—'}</TableCell>
                        <TableCell>{lead.Industry || '—'}</TableCell>
                        <TableCell>{lead.CreatedOn ? new Date(lead.CreatedOn).toLocaleDateString() : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          ) : (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Select a duplicate group to review:
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Domain</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Count</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {duplicateGroups.map((group, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{group.Domain}</TableCell>
                        <TableCell>{group.Email}</TableCell>
                        <TableCell>{group.DuplicateCount}</TableCell>
                        <TableCell>
                          <Button
                            size="small"
                            onClick={() => handleReviewDuplicates(group)}
                          >
                            Review
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setDuplicateDialogOpen(false);
            setSelectedDuplicateGroup(null);
          }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default LeadDatabase;
