import React, { useState, useEffect, useMemo, useContext } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  IconButton,
  Drawer,
  TextareaAutosize,
  Snackbar,
  Alert,
  Autocomplete,
  Grid,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import {
  Add as AddIcon,
  Close as CloseIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Note as NoteIcon,
  Phone as PhoneIcon,
  Event as MeetingIcon,
  Email as EmailIcon,
  Message as MessageIcon,
  AttachFile as AttachFileIcon,
  InsertDriveFile as FileIcon,
  CloudUpload as UploadIcon,
  ViewKanban as ViewKanbanIcon,
  TableRows as TableRowsIcon,
} from '@mui/icons-material';
import { getDeals, createDeal, updateDeal, deleteDeal, getDealById, getDealTimeline, createTimelineEntry, getDealAttachments, uploadDealAttachment, downloadDealAttachment, deleteDealAttachment } from '../../../api/crmDeals';
import { getActiveConsultants } from '../../../api/consultants';
import { getStages } from '../../../api/crmSettings';
import { getLeadSources } from '../../../api/crmSettings';
import { getBuySideClients, getBuySideCampaigns, getBuySideCampaignsByClient, createBuySideClient, createBuySideCampaign } from '../../../api/buySide';
import { AuthContext } from '../../../context/AuthContext';

const SalesCRM = ({ activeRole, module = 'sales', title, enableClientCampaignFilters = false }) => {
  const { auth } = useContext(AuthContext);
  const resolvedTitle = title || (module === 'sell' ? 'M&A Sell-Side Pipeline' : module === 'buy' ? 'M&A Buy-Side Pipeline' : 'Sales CRM Pipeline');
  const companyLabel = module === 'sell' ? 'Project Name *' : module === 'buy' ? 'Target / Company *' : 'Company *';

  const [deals, setDeals] = useState([]);
  const [stages, setStages] = useState([]);
  const [leadSources, setLeadSources] = useState([]);
  const [consultants, setConsultants] = useState([]);
  const [buySideClients, setBuySideClients] = useState([]);
  const [buySideCampaigns, setBuySideCampaigns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [newDealDialog, setNewDealDialog] = useState(false);
  const [editDealDialog, setEditDealDialog] = useState(false);
  const [editingDeal, setEditingDeal] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('board');
  const [selectedClient, setSelectedClient] = useState('');
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [callDialogOpen, setCallDialogOpen] = useState(false);
  const [callDeal, setCallDeal] = useState(null);
  const [callOutcome, setCallOutcome] = useState('Answered');
  const [callNotes, setCallNotes] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [timelineEntries, setTimelineEntries] = useState([]);
  const [newEntryType, setNewEntryType] = useState('Note');
  const [newEntryBody, setNewEntryBody] = useState('');
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newCampaignForm, setNewCampaignForm] = useState({
    ClientID: '',
    CampaignName: '',
    Description: '',
    Industry: '',
    Location: '',
    HeadcountMin: '',
    HeadcountMax: '',
    RevenueMin: '',
    RevenueMax: '',
  });

  const [newDealForm, setNewDealForm] = useState({
    Company: '',
    CompanyName: '', // For sell-side deals
    BuySideClientID: '', // For buy-side deals
    BuySideCampaignID: '', // For buy-side deals
    Contact: '',
    ContactTitle: '',
    ContactEmail: '',
    ContactPhone: '',
    MRR: '',
    ContractTerm: '',
    OnboardingFee: '',
    // Sell-side phase-specific fields
    PrepMRR: '',
    PrepTerm: '',
    PrepOnboardingFee: '',
    SaleProcessMRR: '',
    SaleProcessTerm: '',
    DueDiligenceMRR: '',
    DueDiligenceTerm: '',
    OwnerID: '',
    LeadSourceID: '',
    StageID: '',
    CompanySize: '',
    Notes: '',
  });

  const [editDealForm, setEditDealForm] = useState({
    Company: '',
    CompanyName: '', // For sell-side deals
    BuySideClientID: '', // For buy-side deals
    BuySideCampaignID: '', // For buy-side deals
    Contact: '',
    ContactTitle: '',
    ContactEmail: '',
    ContactPhone: '',
    MRR: '',
    ContractTerm: '',
    OnboardingFee: '',
    // Sell-side phase-specific fields
    PrepMRR: '',
    PrepTerm: '',
    PrepOnboardingFee: '',
    SaleProcessMRR: '',
    SaleProcessTerm: '',
    DueDiligenceMRR: '',
    DueDiligenceTerm: '',
    OwnerID: '',
    LeadSourceID: '',
    StageID: '',
    CompanySize: '',
    Notes: '',
  });

  // Calculate TCV: MRR × ContractTerm + OnboardingFee (for sales/buy-side)
  const calculateTCV = (mrr, contractTerm, onboardingFee) => {
    const mrrValue = parseFloat(mrr) || 0;
    const termValue = parseInt(contractTerm) || 0;
    const feeValue = parseFloat(onboardingFee) || 0;
    if (mrrValue && termValue) {
      return mrrValue * termValue + feeValue;
    }
    return null;
  };

  // Calculate TCV for sell-side deals (3 phases)
  const calculateSellSideTCV = (prepMRR, prepTerm, prepOnboarding, saleMRR, saleTerm, ddMRR, ddTerm) => {
    let total = 0;
    
    // Prep Phase: MRR × Term + Onboarding Fee
    const prepMRRVal = parseFloat(prepMRR) || 0;
    const prepTermVal = parseInt(prepTerm) || 0;
    const prepOnboardingVal = parseFloat(prepOnboarding) || 0;
    if (prepMRRVal && prepTermVal) {
      total += prepMRRVal * prepTermVal + prepOnboardingVal;
    }
    
    // Sale Process Phase: MRR × Term
    const saleMRRVal = parseFloat(saleMRR) || 0;
    const saleTermVal = parseInt(saleTerm) || 0;
    if (saleMRRVal && saleTermVal) {
      total += saleMRRVal * saleTermVal;
    }
    
    // Due Diligence Phase: MRR × Term (optional)
    const ddMRRVal = parseFloat(ddMRR) || 0;
    const ddTermVal = parseInt(ddTerm) || 0;
    if (ddMRRVal && ddTermVal) {
      total += ddMRRVal * ddTermVal;
    }
    
    return total > 0 ? total : null;
  };

  // Calculate individual phase TCVs for sell-side
  const calculatePhaseTCV = (mrr, term, onboardingFee = 0) => {
    const mrrVal = parseFloat(mrr) || 0;
    const termVal = parseInt(term) || 0;
    const feeVal = parseFloat(onboardingFee) || 0;
    if (mrrVal && termVal) {
      return mrrVal * termVal + feeVal;
    }
    return null;
  };

  const calculatedTCV = module === 'sell' 
    ? calculateSellSideTCV(
        newDealForm.PrepMRR, newDealForm.PrepTerm, newDealForm.PrepOnboardingFee,
        newDealForm.SaleProcessMRR, newDealForm.SaleProcessTerm,
        newDealForm.DueDiligenceMRR, newDealForm.DueDiligenceTerm
      )
    : calculateTCV(newDealForm.MRR, newDealForm.ContractTerm, newDealForm.OnboardingFee);
    
  const calculatedEditTCV = module === 'sell'
    ? calculateSellSideTCV(
        editDealForm.PrepMRR, editDealForm.PrepTerm, editDealForm.PrepOnboardingFee,
        editDealForm.SaleProcessMRR, editDealForm.SaleProcessTerm,
        editDealForm.DueDiligenceMRR, editDealForm.DueDiligenceTerm
      )
    : calculateTCV(editDealForm.MRR, editDealForm.ContractTerm, editDealForm.OnboardingFee);

  useEffect(() => {
    loadData();
  }, []);

  // Reload campaigns when client is selected in create/edit forms
  useEffect(() => {
    if (module === 'buy' && newDealForm.BuySideClientID) {
      getBuySideCampaignsByClient(newDealForm.BuySideClientID).then((campaigns) => {
        setBuySideCampaigns((prev) => {
          // Merge with existing campaigns, avoiding duplicates
          const existing = prev.filter(c => c.ClientID !== newDealForm.BuySideClientID);
          return [...existing, ...campaigns];
        });
      }).catch(console.error);
    }
  }, [newDealForm.BuySideClientID, module]);

  useEffect(() => {
    if (module === 'buy' && editDealForm.BuySideClientID) {
      getBuySideCampaignsByClient(editDealForm.BuySideClientID).then((campaigns) => {
        setBuySideCampaigns((prev) => {
          // Merge with existing campaigns, avoiding duplicates
          const existing = prev.filter(c => c.ClientID !== editDealForm.BuySideClientID);
          return [...existing, ...campaigns];
        });
      }).catch(console.error);
    }
  }, [editDealForm.BuySideClientID, module]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Build filters - if active role is Consultant, include consultantId
      const filters = { module };
      const myConsultantId = auth.user?.consultantId || null;
      if ((activeRole === 'Consultant' || activeRole === 'Sales') && myConsultantId && module !== 'buy') {
        filters.ownerId = myConsultantId;
      }
      
      const promises = [
        getDeals(filters),
        getStages(module),
        getLeadSources(),
        getActiveConsultants(),
      ];
      
      // Load buy-side clients and campaigns if module is 'buy'
      if (module === 'buy') {
        promises.push(getBuySideClients());
        promises.push(getBuySideCampaigns());
      }
      
      const results = await Promise.all(promises);
      const [dealsData, stagesData, sourcesData, consultantsData, clientsData, campaignsData] = results;
      
      setDeals(dealsData || []);
      setStages(stagesData || []);
      setLeadSources(sourcesData || []);
      setConsultants(consultantsData || []);
      
      if (module === 'buy') {
        setBuySideClients(clientsData || []);
        setBuySideCampaigns(campaignsData || []);
      }
    } catch (error) {
      console.error('Error loading CRM data:', error);
      setSnackbar({
        open: true,
        message: 'Failed to load CRM data',
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  // Group deals by stage
  const dealsByStage = useMemo(() => {
    const grouped = {};
    stages.forEach(stage => {
      grouped[stage.StageID] = [];
    });
    
    deals.forEach(deal => {
      if (grouped[deal.StageID]) {
        grouped[deal.StageID].push(deal);
      }
    });
    
    return grouped;
  }, [deals, stages]);


  // Parse DetailsJson (string or object) for buy-side client/campaign filtering
  const parseDetailsJson = (deal) => {
    const raw = deal?.DetailsJson;
    if (!raw) return {};
    if (typeof raw === 'object') return raw;
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  };

  const getBuySideClient = (deal) => {
    const d = parseDetailsJson(deal);
    // Try to get client name from ID first
    if (d.buySideClientID || d.clientID) {
      const clientId = d.buySideClientID || d.clientID;
      const client = buySideClients.find(c => c.ClientID === clientId);
      if (client) return client.ClientName;
    }
    // Fallback to legacy string fields
    return d.buySideClient || d.client || d.clientName || d.client_company || '';
  };

  const getBuySideCampaign = (deal) => {
    const d = parseDetailsJson(deal);
    // Try to get campaign name from ID first
    if (d.buySideCampaignID || d.campaignID) {
      const campaignId = d.buySideCampaignID || d.campaignID;
      const campaign = buySideCampaigns.find(c => c.CampaignID === campaignId);
      if (campaign) return campaign.CampaignName;
    }
    // Fallback to legacy string fields
    return d.campaign || d.campaignName || d.strategy || d.pipeline || '';
  };

  const getBuySideClientId = (deal) => {
    const d = parseDetailsJson(deal);
    return d.buySideClientID || d.clientID || null;
  };

  const getBuySideCampaignId = (deal) => {
    const d = parseDetailsJson(deal);
    return d.buySideCampaignID || d.campaignID || null;
  };

  // Get Company Name for sell-side deals (stored in DetailsJson)
  const getSellSideCompanyName = (deal) => {
    if (module !== 'sell') return null;
    const d = parseDetailsJson(deal);
    return d.companyName || d.company_name || '';
  };

  const buySideClientOptions = useMemo(() => {
    if (!enableClientCampaignFilters) return [];
    // Use actual client list from database
    return buySideClients.map(c => ({ value: c.ClientID, label: c.ClientName }));
  }, [buySideClients, enableClientCampaignFilters]);

  const buySideCampaignOptions = useMemo(() => {
    if (!enableClientCampaignFilters) return [];
    // Filter campaigns by selected client
    let filtered = buySideCampaigns;
    if (selectedClient) {
      filtered = buySideCampaigns.filter(c => c.ClientID === selectedClient);
    }
    return filtered.map(c => ({ value: c.CampaignID, label: c.CampaignName }));
  }, [buySideCampaigns, enableClientCampaignFilters, selectedClient]);

  // Filter deals by search term + optional buy-side client/campaign
  const filteredDealsByStage = useMemo(() => {
    const term = (searchTerm || '').trim().toLowerCase();
    const needsBuySideFilter =
      enableClientCampaignFilters && (selectedClient || selectedCampaign);

    if (!term && !needsBuySideFilter) return dealsByStage;

    const filtered = {};
    Object.keys(dealsByStage).forEach((stageId) => {
      filtered[stageId] = dealsByStage[stageId].filter((deal) => {
        const company = (deal.Company || '').toLowerCase();
        const contact = (deal.Contact || '').toLowerCase();

        const matchesSearch = !term || company.includes(term) || contact.includes(term);
        if (!matchesSearch) return false;

        if (needsBuySideFilter) {
          // Filter by client ID if selected
          if (selectedClient) {
            const dealClientId = getBuySideClientId(deal);
            if (dealClientId !== selectedClient) return false;
          }
          // Filter by campaign ID if selected
          if (selectedCampaign) {
            const dealCampaignId = getBuySideCampaignId(deal);
            if (dealCampaignId !== selectedCampaign) return false;
          }
        }
        return true;
      });
    });
    return filtered;
  }, [dealsByStage, searchTerm, enableClientCampaignFilters, selectedClient, selectedCampaign, buySideClients, buySideCampaigns]);

  const flatFilteredDeals = useMemo(() => {
    // Used by table view; safe even if stages is empty
    return Object.values(filteredDealsByStage || {}).flat();
  }, [filteredDealsByStage]);


  const handleOpenDeal = async (deal) => {
    try {
      const fullDeal = await getDealById(deal.DealID);
      setSelectedDeal(fullDeal);
      setDrawerOpen(true);
      loadTimeline(deal.DealID);
      loadAttachments(deal.DealID);
    } catch (error) {
      console.error('Error loading deal:', error);
    }
  };

  const loadAttachments = async (dealId) => {
    try {
      const atts = await getDealAttachments(dealId);
      setAttachments(atts);
    } catch (error) {
      console.error('Error loading attachments:', error);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      const ext = file.name.split('.').pop().toLowerCase();
      const allowedTypes = ['pdf', 'xls', 'xlsx', 'csv'];
      if (!allowedTypes.includes(ext)) {
        setSnackbar({
          open: true,
          message: 'Only PDF, Excel, and CSV files are allowed',
          severity: 'error',
        });
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedDeal || !selectedFile) return;
    
    setUploadingFile(true);
    try {
      await uploadDealAttachment(selectedDeal.DealID, selectedFile);
      setSelectedFile(null);
      await loadAttachments(selectedDeal.DealID);
      setSnackbar({
        open: true,
        message: 'File uploaded successfully',
        severity: 'success',
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      setSnackbar({
        open: true,
        message: 'Failed to upload file',
        severity: 'error',
      });
    } finally {
      setUploadingFile(false);
    }
  };

  const handleFileClick = async (attachment) => {
    try {
      const blob = await downloadDealAttachment(selectedDeal.DealID, attachment.AttachmentID);
      const url = window.URL.createObjectURL(blob);
      
      // Check if file can be previewed (PDF)
      if (attachment.FileType === 'pdf' || attachment.MimeType === 'application/pdf') {
        window.open(url, '_blank');
      } else {
        // Download for Excel/CSV
        const link = document.createElement('a');
        link.href = url;
        link.download = attachment.FileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error downloading file:', error);
      setSnackbar({
        open: true,
        message: 'Failed to open/download file',
        severity: 'error',
      });
    }
  };

  const handleDeleteAttachment = async (attachmentId) => {
    if (!window.confirm('Are you sure you want to delete this file?')) return;
    
    try {
      await deleteDealAttachment(selectedDeal.DealID, attachmentId);
      await loadAttachments(selectedDeal.DealID);
      setSnackbar({
        open: true,
        message: 'File deleted successfully',
        severity: 'success',
      });
    } catch (error) {
      console.error('Error deleting file:', error);
      setSnackbar({
        open: true,
        message: 'Failed to delete file',
        severity: 'error',
      });
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '—';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (fileType) => {
    switch (fileType?.toLowerCase()) {
      case 'pdf':
        return <FileIcon sx={{ color: '#dc2626' }} />;
      case 'excel':
        return <FileIcon sx={{ color: '#059669' }} />;
      case 'csv':
        return <FileIcon sx={{ color: '#2563eb' }} />;
      default:
        return <FileIcon />;
    }
  };

  const loadTimeline = async (dealId) => {
    setLoadingTimeline(true);
    try {
      const entries = await getDealTimeline(dealId);
      setTimelineEntries(entries);
    } catch (error) {
      console.error('Error loading timeline:', error);
    } finally {
      setLoadingTimeline(false);
    }
  };

  const handleCreateTimelineEntry = async () => {
    if (!selectedDeal || !newEntryBody.trim()) return;
    
    try {
      const entryData = {
        activityType: newEntryType,
        body: newEntryBody,
        CreatedBy: auth.user?.userId || auth.user?.user_id || null,
      };
      
      await createTimelineEntry(selectedDeal.DealID, entryData);
      setNewEntryBody('');
      setNewEntryType('Note');
      await loadTimeline(selectedDeal.DealID);
      
      // Refresh deal to update activity count
      const refreshedDeal = await getDealById(selectedDeal.DealID);
      setSelectedDeal(refreshedDeal);
      setDeals(deals.map(d => d.DealID === selectedDeal.DealID ? refreshedDeal : d));
      
      setSnackbar({
        open: true,
        message: 'Entry added successfully',
        severity: 'success',
      });
    } catch (error) {
      console.error('Error creating timeline entry:', error);
      setSnackbar({
        open: true,
        message: 'Failed to add entry',
        severity: 'error',
      });
    }
  };


  // Quick "Log Call" flow (from a card/table without opening the deal drawer)
  const openQuickCallDialog = (deal) => {
    if (!deal) return;
    setCallDeal(deal);
    setCallOutcome('Answered');
    setCallNotes('');
    setCallDialogOpen(true);
  };

  const handleSubmitQuickCall = async () => {
    if (!callDeal) return;

    try {
      const body = `Outcome: ${callOutcome}${callNotes ? `\nNotes: ${callNotes}` : ''}`;
      const entryData = {
        activityType: 'Call',
        body,
        CreatedBy: auth.user?.userId || auth.user?.user_id || null,
      };

      await createTimelineEntry(callDeal.DealID, entryData);

      // Refresh deal summary (LastActivity/LastActivityDate, etc.)
      const refreshedDeal = await getDealById(callDeal.DealID);
      setDeals((prev) => prev.map((d) => (d.DealID === callDeal.DealID ? refreshedDeal : d)));
      if (selectedDeal?.DealID === callDeal.DealID) {
        setSelectedDeal(refreshedDeal);
        await loadTimeline(callDeal.DealID);
      }

      setSnackbar({
        open: true,
        message: 'Call logged',
        severity: 'success',
      });

      setCallDialogOpen(false);
      setCallDeal(null);
    } catch (error) {
      console.error('Error logging call:', error);
      setSnackbar({
        open: true,
        message: 'Failed to log call',
        severity: 'error',
      });
    }
  };

  const getActivityIcon = (type) => {
    switch (type?.toLowerCase()) {
      case 'call':
        return <PhoneIcon fontSize="small" />;
      case 'meeting':
        return <MeetingIcon fontSize="small" />;
      case 'email':
        return <EmailIcon fontSize="small" />;
      case 'text':
        return <MessageIcon fontSize="small" />;
      default:
        return <NoteIcon fontSize="small" />;
    }
  };

  const getActivityColor = (type) => {
    switch (type?.toLowerCase()) {
      case 'call':
        return '#2563eb';
      case 'meeting':
        return '#059669';
      case 'email':
        return '#dc2626';
      case 'text':
        return '#7c3aed';
      default:
        return '#6b7280';
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '—';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Extract @mentions from text
  const extractMentions = (text) => {
    const mentionRegex = /@(\w+)/g;
    const mentions = [];
    let match;
    while ((match = mentionRegex.exec(text)) !== null) {
      mentions.push(match[1]);
    }
    return mentions;
  };

  // Render text with @mentions highlighted
  const renderTextWithMentions = (text) => {
    if (!text) return '—';
    const parts = text.split(/(@\w+)/g);
    return parts.map((part, index) => {
      if (part.startsWith('@')) {
        return (
          <span key={index} style={{ color: '#2563eb', fontWeight: 500 }}>
            {part}
          </span>
        );
      }
      return part;
    });
  };

  // Get sell-side phase data from DetailsJson
  const getSellSidePhaseData = (deal) => {
    if (module !== 'sell') return {};
    const d = parseDetailsJson(deal);
    return {
      PrepMRR: d.prepMRR || d.prep_mrr || null,
      PrepTerm: d.prepTerm || d.prep_term || null,
      PrepOnboardingFee: d.prepOnboardingFee || d.prep_onboarding_fee || null,
      SaleProcessMRR: d.saleProcessMRR || d.sale_process_mrr || null,
      SaleProcessTerm: d.saleProcessTerm || d.sale_process_term || null,
      DueDiligenceMRR: d.dueDiligenceMRR || d.due_diligence_mrr || null,
      DueDiligenceTerm: d.dueDiligenceTerm || d.due_diligence_term || null,
    };
  };

  const handleOpenEditDeal = async (deal) => {
    try {
      const fullDeal = await getDealById(deal.DealID);
      setEditingDeal(fullDeal);
      const phaseData = module === 'sell' ? getSellSidePhaseData(fullDeal) : {};
      // Convert phase data values to strings for form fields
      const phaseDataStrings = module === 'sell' ? {
        PrepMRR: phaseData.PrepMRR ? String(phaseData.PrepMRR) : '',
        PrepTerm: phaseData.PrepTerm ? String(phaseData.PrepTerm) : '',
        PrepOnboardingFee: phaseData.PrepOnboardingFee ? String(phaseData.PrepOnboardingFee) : '',
        SaleProcessMRR: phaseData.SaleProcessMRR ? String(phaseData.SaleProcessMRR) : '',
        SaleProcessTerm: phaseData.SaleProcessTerm ? String(phaseData.SaleProcessTerm) : '',
        DueDiligenceMRR: phaseData.DueDiligenceMRR ? String(phaseData.DueDiligenceMRR) : '',
        DueDiligenceTerm: phaseData.DueDiligenceTerm ? String(phaseData.DueDiligenceTerm) : '',
      } : {};
      
      // Get buy-side client/campaign IDs
      const buySideData = module === 'buy' ? {
        BuySideClientID: getBuySideClientId(fullDeal) || '',
        BuySideCampaignID: getBuySideCampaignId(fullDeal) || '',
      } : {};
      
      setEditDealForm({
        Company: fullDeal.Company || '',
        CompanyName: module === 'sell' ? getSellSideCompanyName(fullDeal) || '' : '',
        ...buySideData,
        Contact: fullDeal.Contact || '',
        ContactTitle: fullDeal.ContactTitle || '',
        ContactEmail: fullDeal.ContactEmail || '',
        ContactPhone: fullDeal.ContactPhone || '',
        MRR: fullDeal.MRR || '',
        ContractTerm: fullDeal.ContractTerm || '',
        OnboardingFee: fullDeal.OnboardingFee || '',
        ...phaseDataStrings,
        OwnerID: fullDeal.OwnerID || '',
        LeadSourceID: fullDeal.LeadSourceID || '',
        StageID: fullDeal.StageID || '',
        CompanySize: fullDeal.CompanySize || '',
        Notes: fullDeal.Notes || '',
      });
      setEditDealDialog(true);
    } catch (error) {
      console.error('Error loading deal for edit:', error);
    }
  };

  const handleCreateDeal = async () => {
    try {
      if (!newDealForm.Company || !newDealForm.StageID) {
        setSnackbar({
          open: true,
          message: 'Please fill in required fields (Company/Project Name and Stage)',
          severity: 'error',
        });
        return;
      }

      // Build DetailsJson for sell-side and buy-side deals
      let detailsJson = null;
      if (module === 'sell') {
        const details = {};
        if (newDealForm.CompanyName) details.companyName = newDealForm.CompanyName;
        if (newDealForm.PrepMRR) details.prepMRR = parseFloat(newDealForm.PrepMRR) || null;
        if (newDealForm.PrepTerm) details.prepTerm = parseInt(newDealForm.PrepTerm) || null;
        if (newDealForm.PrepOnboardingFee) details.prepOnboardingFee = parseFloat(newDealForm.PrepOnboardingFee) || null;
        if (newDealForm.SaleProcessMRR) details.saleProcessMRR = parseFloat(newDealForm.SaleProcessMRR) || null;
        if (newDealForm.SaleProcessTerm) details.saleProcessTerm = parseInt(newDealForm.SaleProcessTerm) || null;
        if (newDealForm.DueDiligenceMRR) details.dueDiligenceMRR = parseFloat(newDealForm.DueDiligenceMRR) || null;
        if (newDealForm.DueDiligenceTerm) details.dueDiligenceTerm = parseInt(newDealForm.DueDiligenceTerm) || null;
        detailsJson = Object.keys(details).length > 0 ? JSON.stringify(details) : null;
      } else if (module === 'buy') {
        const details = {};
        if (newDealForm.BuySideClientID) details.buySideClientID = newDealForm.BuySideClientID;
        if (newDealForm.BuySideCampaignID) details.buySideCampaignID = newDealForm.BuySideCampaignID;
        detailsJson = Object.keys(details).length > 0 ? JSON.stringify(details) : null;
      }

      const dealData = {
        Module: module,
        Company: newDealForm.Company,
        Contact: newDealForm.Contact || null,
        ContactTitle: newDealForm.ContactTitle || null,
        ContactEmail: newDealForm.ContactEmail || null,
        ContactPhone: newDealForm.ContactPhone || null,
        MRR: module === 'sell' ? null : (newDealForm.MRR ? parseFloat(newDealForm.MRR) : null),
        ContractTerm: module === 'sell' ? null : (newDealForm.ContractTerm ? parseInt(newDealForm.ContractTerm) : null),
        OnboardingFee: module === 'sell' ? null : (newDealForm.OnboardingFee ? parseFloat(newDealForm.OnboardingFee) : null),
        OwnerID: newDealForm.OwnerID || null,
        LeadSourceID: newDealForm.LeadSourceID || null,
        StageID: newDealForm.StageID,
        CompanySize: newDealForm.CompanySize || null,
        Notes: newDealForm.Notes || null,
        DetailsJson: detailsJson,
        Amount: calculatedTCV, // Set TCV based on phase calculations
        CreatedBy: auth.user?.userId || auth.user?.user_id || null,
      };

      const newDeal = await createDeal(dealData);
      setDeals([...deals, newDeal]);
      setNewDealDialog(false);
      setNewDealForm({
        Company: '',
        CompanyName: '',
        BuySideClientID: '',
        BuySideCampaignID: '',
        Contact: '',
        ContactTitle: '',
        ContactEmail: '',
        ContactPhone: '',
        MRR: '',
        ContractTerm: '',
        OnboardingFee: '',
        PrepMRR: '',
        PrepTerm: '',
        PrepOnboardingFee: '',
        SaleProcessMRR: '',
        SaleProcessTerm: '',
        DueDiligenceMRR: '',
        DueDiligenceTerm: '',
        OwnerID: '',
        LeadSourceID: '',
        StageID: '',
        CompanySize: '',
        Notes: '',
      });
      setSnackbar({
        open: true,
        message: 'Deal created successfully',
        severity: 'success',
      });
    } catch (error) {
      console.error('Error creating deal:', error);
      setSnackbar({
        open: true,
        message: 'Failed to create deal',
        severity: 'error',
      });
    }
  };

  const handleUpdateDeal = async (dealId, updates, options = { toast: true }) => {
    try {
      const updatedDeal = await updateDeal(dealId, updates);
      setDeals(deals.map(d => d.DealID === dealId ? updatedDeal : d));
      if (selectedDeal?.DealID === dealId) {
        setSelectedDeal(updatedDeal);
      }
      if (editingDeal?.DealID === dealId) {
        setEditingDeal(updatedDeal);
      }
      if (options?.toast !== false) {
        setSnackbar({
          open: true,
          message: 'Deal updated successfully',
          severity: 'success',
        });
      }
    } catch (error) {
      console.error('Error updating deal:', error);
      if (options?.toast !== false) {
        setSnackbar({
          open: true,
          message: 'Failed to update deal',
          severity: 'error',
        });
      }
    }
  };

  const handleCreateClient = async () => {
    if (!newClientName.trim()) {
      setSnackbar({
        open: true,
        message: 'Please enter a client name',
        severity: 'error',
      });
      return;
    }

    try {
      const client = await createBuySideClient({ ClientName: newClientName.trim() });
      await loadData(); // Reload to get updated client list
      setNewClientName('');
      setClientDialogOpen(false);
      setSnackbar({
        open: true,
        message: 'Client created successfully',
        severity: 'success',
      });
    } catch (error) {
      console.error('Error creating client:', error);
      setSnackbar({
        open: true,
        message: 'Failed to create client',
        severity: 'error',
      });
    }
  };

  const handleCreateCampaign = async () => {
    if (!newCampaignForm.ClientID || !newCampaignForm.CampaignName.trim()) {
      setSnackbar({
        open: true,
        message: 'Please select a client and enter a campaign name',
        severity: 'error',
      });
      return;
    }

    try {
      const campaignData = {
        ClientID: newCampaignForm.ClientID,
        CampaignName: newCampaignForm.CampaignName.trim(),
        Description: newCampaignForm.Description || null,
        Industry: newCampaignForm.Industry || null,
        Location: newCampaignForm.Location || null,
        HeadcountMin: newCampaignForm.HeadcountMin ? parseInt(newCampaignForm.HeadcountMin) : null,
        HeadcountMax: newCampaignForm.HeadcountMax ? parseInt(newCampaignForm.HeadcountMax) : null,
        RevenueMin: newCampaignForm.RevenueMin ? parseFloat(newCampaignForm.RevenueMin) : null,
        RevenueMax: newCampaignForm.RevenueMax ? parseFloat(newCampaignForm.RevenueMax) : null,
      };
      const campaign = await createBuySideCampaign(campaignData);
      await loadData(); // Reload to get updated campaign list
      setNewCampaignForm({
        ClientID: '',
        CampaignName: '',
        Description: '',
        Industry: '',
        Location: '',
        HeadcountMin: '',
        HeadcountMax: '',
        RevenueMin: '',
        RevenueMax: '',
      });
      setCampaignDialogOpen(false);
      setSnackbar({
        open: true,
        message: 'Campaign created successfully',
        severity: 'success',
      });
    } catch (error) {
      console.error('Error creating campaign:', error);
      setSnackbar({
        open: true,
        message: 'Failed to create campaign',
        severity: 'error',
      });
    }
  };

  const handleSaveEditDeal = async () => {
    if (!editingDeal) return;
    
    try {
      // Build DetailsJson for sell-side and buy-side deals
      // Preserve existing DetailsJson data and merge new values
      let detailsJson = editingDeal.DetailsJson || null;
      if (module === 'sell') {
        const existingDetails = parseDetailsJson(editingDeal);
        if (editDealForm.CompanyName) existingDetails.companyName = editDealForm.CompanyName;
        if (editDealForm.PrepMRR) existingDetails.prepMRR = parseFloat(editDealForm.PrepMRR) || null;
        if (editDealForm.PrepTerm) existingDetails.prepTerm = parseInt(editDealForm.PrepTerm) || null;
        if (editDealForm.PrepOnboardingFee) existingDetails.prepOnboardingFee = parseFloat(editDealForm.PrepOnboardingFee) || null;
        if (editDealForm.SaleProcessMRR) existingDetails.saleProcessMRR = parseFloat(editDealForm.SaleProcessMRR) || null;
        if (editDealForm.SaleProcessTerm) existingDetails.saleProcessTerm = parseInt(editDealForm.SaleProcessTerm) || null;
        if (editDealForm.DueDiligenceMRR) existingDetails.dueDiligenceMRR = parseFloat(editDealForm.DueDiligenceMRR) || null;
        if (editDealForm.DueDiligenceTerm) existingDetails.dueDiligenceTerm = parseInt(editDealForm.DueDiligenceTerm) || null;
        detailsJson = JSON.stringify(existingDetails);
      } else if (module === 'buy') {
        const existingDetails = parseDetailsJson(editingDeal);
        if (editDealForm.BuySideClientID) existingDetails.buySideClientID = editDealForm.BuySideClientID;
        else delete existingDetails.buySideClientID;
        if (editDealForm.BuySideCampaignID) existingDetails.buySideCampaignID = editDealForm.BuySideCampaignID;
        else delete existingDetails.buySideCampaignID;
        detailsJson = JSON.stringify(existingDetails);
      }

      const dealData = {
        Company: editDealForm.Company,
        Contact: editDealForm.Contact || null,
        ContactTitle: editDealForm.ContactTitle || null,
        ContactEmail: editDealForm.ContactEmail || null,
        ContactPhone: editDealForm.ContactPhone || null,
        MRR: module === 'sell' ? null : (editDealForm.MRR ? parseFloat(editDealForm.MRR) : null),
        ContractTerm: module === 'sell' ? null : (editDealForm.ContractTerm ? parseInt(editDealForm.ContractTerm) : null),
        OnboardingFee: module === 'sell' ? null : (editDealForm.OnboardingFee ? parseFloat(editDealForm.OnboardingFee) : null),
        OwnerID: editDealForm.OwnerID || null,
        LeadSourceID: editDealForm.LeadSourceID || null,
        StageID: editDealForm.StageID,
        CompanySize: editDealForm.CompanySize || null,
        Notes: editDealForm.Notes || null,
        DetailsJson: detailsJson,
        Amount: calculatedEditTCV, // Set TCV based on phase calculations
      };

      const updatedDeal = await updateDeal(editingDeal.DealID, dealData);
      setDeals(deals.map(d => d.DealID === editingDeal.DealID ? updatedDeal : d));
      
      // Refresh the selected deal in drawer if it's the same deal
      if (selectedDeal?.DealID === editingDeal.DealID) {
        const refreshedDeal = await getDealById(editingDeal.DealID);
        setSelectedDeal(refreshedDeal);
      }
      
      setEditDealDialog(false);
      setEditingDeal(null);
      setSnackbar({
        open: true,
        message: 'Deal updated successfully',
        severity: 'success',
      });
    } catch (error) {
      console.error('Error updating deal:', error);
      setSnackbar({
        open: true,
        message: 'Failed to update deal',
        severity: 'error',
      });
    }
  };

  const handleKillLead = async (deal) => {
    if (!window.confirm(`Are you sure you want to mark "${deal.Company}" as Closed/Lost?`)) return;
    
    try {
      // Find Closed/Lost stage
      const closedLostStage = stages.find(s => s.StageName === 'Closed/Lost');
      if (!closedLostStage) {
        throw new Error('Closed/Lost stage not found');
      }
      
      await handleUpdateDeal(deal.DealID, {
        StageID: closedLostStage.StageID,
        ClosedDate: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error killing lead:', error);
    }
  };

  const handleMoveStage = async (deal, newStageId) => {
    await handleUpdateDeal(deal.DealID, { StageID: newStageId });
  };

  const handleDragEnd = async (result) => {
    const { destination, source, draggableId } = result || {};
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const dealId = draggableId;
    const newStageId = destination.droppableId;
    const prevDeals = deals;

    // Optimistic UI
    setDeals((prev) => prev.map((d) => (d.DealID === dealId ? { ...d, StageID: newStageId } : d)));

    try {
      const updated = await updateDeal(dealId, { StageID: newStageId });
      setDeals((prev) => prev.map((d) => (d.DealID === dealId ? updated : d)));
      if (selectedDeal?.DealID === dealId) setSelectedDeal(updated);
      if (editingDeal?.DealID === dealId) setEditingDeal(updated);
    } catch (error) {
      console.error('Error moving deal stage:', error);
      setDeals(prevDeals);
      setSnackbar({
        open: true,
        message: 'Failed to move deal stage',
        severity: 'error',
      });
    }
  };

  const formatCurrency = (value) => {
    if (!value) return '—';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(value);
  };

  const getInitials = (company) => {
    if (!company) return '?';
    const words = company.split(' ').slice(0, 2);
    return words.map(w => w[0]).join('').toUpperCase();
  };

  const getDaysAgo = (date) => {
    if (!date) return null;
    const days = Math.floor((new Date() - new Date(date)) / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return '1 day ago';
    return `${days} days ago`;
  };

  const tableColumns = useMemo(() => {
    const cols = [
      {
        field: 'Company',
        headerName: module === 'sell' ? 'Project' : 'Company',
        flex: 1,
        minWidth: 220,
      },
      ...(enableClientCampaignFilters
        ? [
            {
              field: '_client',
              headerName: 'Client',
              minWidth: 200,
              valueGetter: (params) => getBuySideClient(params.row) || '—',
            },
            {
              field: '_campaign',
              headerName: 'Campaign',
              minWidth: 200,
              valueGetter: (params) => getBuySideCampaign(params.row) || '—',
            },
          ]
        : []),
      {
        field: 'Contact',
        headerName: 'Contact',
        flex: 1,
        minWidth: 180,
      },
      {
        field: 'StageName',
        headerName: 'Stage',
        minWidth: 160,
        valueGetter: (params) => params?.row?.StageName || stages.find((s) => s.StageID === params.row?.StageID)?.StageName || '—',
      },
      {
        field: 'OwnerName',
        headerName: 'Owner',
        minWidth: 160,
        valueGetter: (params) => params?.row?.OwnerName || '—',
      },
      {
        field: 'LeadSourceName',
        headerName: 'Source',
        minWidth: 140,
        valueGetter: (params) => params?.row?.LeadSourceName || '—',
      },
      {
        field: 'Amount',
        headerName: 'Value',
        minWidth: 120,
        valueFormatter: (params) => formatCurrency(params?.value),
      },
      {
        field: 'LastActivity',
        headerName: 'Last Activity',
        flex: 1,
        minWidth: 220,
        valueGetter: (params) => params?.row?.LastActivity || '—',
      },
      {
        field: 'LastActivityDate',
        headerName: 'Updated',
        minWidth: 160,
        valueGetter: (params) => (params?.row?.LastActivityDate ? formatTimestamp(params?.row?.LastActivityDate) : '—'),
      },
      {
        field: 'actions',
        headerName: '',
        sortable: false,
        filterable: false,
        width: 140,
        renderCell: (params) => (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenDeal(params.row);
              }}
              title="View"
            >
              <NoteIcon fontSize="inherit" />
            </IconButton>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                openQuickCallDialog(params.row);
              }}
              title="Log call"
            >
              <PhoneIcon fontSize="inherit" />
            </IconButton>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenEditDeal(params.row);
              }}
              title="Edit"
            >
              <EditIcon fontSize="inherit" />
            </IconButton>
          </Box>
        ),
      },
    ];

    return cols;
  }, [module, enableClientCampaignFilters, stages]);

  if (loading) {
    return <Typography>Loading {resolvedTitle}...</Typography>;
  }

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="h5">{resolvedTitle}</Typography>

        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {enableClientCampaignFilters && (
            <>
              <Autocomplete
                size="small"
                options={buySideClientOptions}
                getOptionLabel={(option) => typeof option === 'string' ? option : option.label || ''}
                value={buySideClientOptions.find(c => c.value === selectedClient) || null}
                onChange={(e, val) => {
                  setSelectedClient(val?.value || '');
                  setSelectedCampaign('');
                }}
                renderInput={(params) => (
                  <TextField {...params} label="Client" placeholder="All clients" />
                )}
                sx={{ minWidth: 220 }}
              />
              <Autocomplete
                size="small"
                options={buySideCampaignOptions}
                getOptionLabel={(option) => typeof option === 'string' ? option : option.label || ''}
                value={buySideCampaignOptions.find(c => c.value === selectedCampaign) || null}
                onChange={(e, val) => setSelectedCampaign(val?.value || '')}
                renderInput={(params) => (
                  <TextField {...params} label="Campaign" placeholder="All campaigns" />
                )}
                sx={{ minWidth: 220 }}
                disabled={!selectedClient}
              />
              <Button
                size="small"
                variant="text"
                onClick={() => {
                  setSelectedClient('');
                  setSelectedCampaign('');
                }}
              >
                Clear
              </Button>
            </>
          )}

          <Button
            size="small"
            variant={viewMode === 'board' ? 'contained' : 'outlined'}
            startIcon={<ViewKanbanIcon />}
            onClick={() => setViewMode('board')}
          >
            Board
          </Button>
          <Button
            size="small"
            variant={viewMode === 'table' ? 'contained' : 'outlined'}
            startIcon={<TableRowsIcon />}
            onClick={() => setViewMode('table')}
          >
            Table
          </Button>

          <TextField
            placeholder="Search..."
            size="small"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ minWidth: 220 }}
          />

          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setNewDealDialog(true)}
          >
            New Deal
          </Button>
        </Box>
      </Box>

      {/* Board / Table */}
      {viewMode === 'board' ? (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Box
            sx={{
              display: 'flex',
              gap: 2,
              overflowX: 'auto',
              pb: 2,
              '&::-webkit-scrollbar': { width: '8px', height: '8px' },
              '&::-webkit-scrollbar-thumb': { background: '#b3b3b3', borderRadius: '4px' },
              '&::-webkit-scrollbar-track': { background: '#f1f1f1' },
              '&::-webkit-scrollbar-thumb:hover': { background: '#999' },
            }}
          >
            {stages.map((stage) => (
              <Droppable droppableId={stage.StageID} key={stage.StageID}>
                {(provided, snapshot) => (
                  <Box
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    sx={{
                      minWidth: 320,
                      flexShrink: 0,
                      background: snapshot.isDraggingOver ? '#eef2ff' : '#f9fafb',
                      borderRadius: 2,
                      p: 2,
                    }}
                  >
                    <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
                      {stage.StageName} • {filteredDealsByStage[stage.StageID]?.length || 0}
                    </Typography>

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, minHeight: 24 }}>
                      {filteredDealsByStage[stage.StageID]?.map((deal, index) => (
                        <Draggable draggableId={String(deal.DealID)} index={index} key={deal.DealID}>
                          {(provided, snapshot) => (
                            <Card
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              sx={{
                                cursor: 'pointer',
                                opacity: snapshot.isDragging ? 0.85 : 1,
                                '&:hover': { boxShadow: 3 },
                              }}
                              onClick={() => handleOpenDeal(deal)}
                            >
                              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Box
                                      sx={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: '50%',
                                        background: '#f3f4f6',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontWeight: 600,
                                        fontSize: 12,
                                      }}
                                    >
                                      {getInitials(deal.Company)}
                                    </Box>
                                    <Box>
                                      <Typography variant="body2" fontWeight={600}>
                                        {deal.Company}
                                      </Typography>
                                      {module === 'sell' && getSellSideCompanyName(deal) && (
                                        <Typography variant="caption" color="text.secondary">
                                          {getSellSideCompanyName(deal)}
                                        </Typography>
                                      )}
                                      {module === 'buy' && (
                                        <>
                                          {getBuySideClient(deal) && (
                                            <Typography variant="caption" color="text.secondary">
                                              Client: {getBuySideClient(deal)}
                                            </Typography>
                                          )}
                                          {getBuySideCampaign(deal) && (
                                            <Typography variant="caption" color="text.secondary">
                                              Campaign: {getBuySideCampaign(deal)}
                                            </Typography>
                                          )}
                                        </>
                                      )}
                                    </Box>
                                  </Box>
                                  <Box sx={{ textAlign: 'right' }}>
                                    <Typography variant="body2" fontWeight={600}>
                                      {formatCurrency(deal.Amount)}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      MRR {formatCurrency(deal.MRR)}
                                    </Typography>
                                  </Box>
                                </Box>

                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                                  {deal.Contact}
                                  {deal.ContactTitle && ` • ${deal.ContactTitle}`}
                                  {deal.OwnerName && ` • Owner: ${deal.OwnerName}`}
                                </Typography>

                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                  {deal.LeadSourceName && (
                                    <Chip label={deal.LeadSourceName} size="small" sx={{ fontSize: '0.7rem', height: 20 }} />
                                  )}
                                  <Typography variant="caption" color="text.secondary">
                                    {deal.LastActivity || 'No recent activity'}
                                  </Typography>
                                </Box>

                                <Box sx={{ display: 'flex', gap: 1, mt: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenDeal(deal);
                                    }}
                                    sx={{ fontSize: '0.7rem', py: 0.5 }}
                                  >
                                    View
                                  </Button>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenEditDeal(deal);
                                    }}
                                    sx={{ fontSize: '0.7rem', py: 0.5 }}
                                  >
                                    Edit
                                  </Button>

                                  <IconButton
                                    size="small"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openQuickCallDialog(deal);
                                    }}
                                    title="Log call"
                                  >
                                    <PhoneIcon fontSize="small" />
                                  </IconButton>

                                  {stage.StageName === 'Prospect' && (
                                    <Button
                                      size="small"
                                      variant="contained"
                                      color="error"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleKillLead(deal);
                                      }}
                                      sx={{ fontSize: '0.7rem', py: 0.5 }}
                                    >
                                      Kill
                                    </Button>
                                  )}
                                </Box>
                              </CardContent>
                            </Card>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </Box>
                  </Box>
                )}
              </Droppable>
            ))}
          </Box>
        </DragDropContext>
      ) : (
        <Box sx={{ height: 650, width: '100%' }}>
          <DataGrid
            rows={flatFilteredDeals}
            columns={tableColumns}
            getRowId={(row) => row.DealID}
            disableRowSelectionOnClick
            density="compact"
            pageSizeOptions={[10, 25, 50, 100]}
            initialState={{
              pagination: { paginationModel: { page: 0, pageSize: 25 } },
            }}
            onRowClick={(params) => handleOpenDeal(params.row)}
          />
        </Box>
      )}


      {/* Quick Log Call Dialog */}
      <Dialog
        open={callDialogOpen}
        onClose={() => {
          setCallDialogOpen(false);
          setCallDeal(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Log Call{callDeal?.Company ? ` • ${callDeal.Company}` : ''}
        </DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Outcome</InputLabel>
            <Select
              value={callOutcome}
              onChange={(e) => setCallOutcome(e.target.value)}
              label="Outcome"
            >
              <MenuItem value="No answer">No answer</MenuItem>
              <MenuItem value="Voicemail left">Voicemail left</MenuItem>
              <MenuItem value="Answered">Answered</MenuItem>
            </Select>
          </FormControl>

          <TextField
            label="Notes"
            fullWidth
            multiline
            rows={4}
            value={callNotes}
            onChange={(e) => setCallNotes(e.target.value)}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setCallDialogOpen(false);
              setCallDeal(null);
            }}
          >
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSubmitQuickCall} disabled={!callDeal}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Deal Drawer */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{
          sx: { width: { xs: '100%', sm: 600 } },
        }}
      >
        {selectedDeal && (
          <Box sx={{ p: 3, marginTop: '60px' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">Lead</Typography>
                <Typography variant="h5" fontWeight={600}>{selectedDeal.Company}</Typography>
                {module === 'sell' && getSellSideCompanyName(selectedDeal) && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    Company: {getSellSideCompanyName(selectedDeal)}
                  </Typography>
                )}
                {module === 'buy' && (
                  <>
                    {getBuySideClient(selectedDeal) && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        Client: {getBuySideClient(selectedDeal)}
                      </Typography>
                    )}
                    {getBuySideCampaign(selectedDeal) && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        Campaign: {getBuySideCampaign(selectedDeal)}
                      </Typography>
                    )}
                  </>
                )}
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {selectedDeal.Contact}
                  {selectedDeal.ContactTitle && ` • ${selectedDeal.ContactTitle}`}
                  {selectedDeal.OwnerName && ` • Owner: ${selectedDeal.OwnerName}`}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<EditIcon />}
                  onClick={() => handleOpenEditDeal(selectedDeal)}
                >
                  Edit
                </Button>
                <IconButton onClick={() => setDrawerOpen(false)}>
                  <CloseIcon />
                </IconButton>
              </Box>
            </Box>

            {/* Stage Display */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>Stage</Typography>
              <Typography variant="body1" fontWeight={500}>
                {stages.find(s => s.StageID === selectedDeal.StageID)?.StageName || '—'}
              </Typography>
            </Box>

            {/* Section 1: Contact Information */}
            <Box sx={{ mb: 3, pb: 3, borderBottom: '1px solid #e0e0e0' }}>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>Contact Information</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">Name</Typography>
                  <Typography variant="body1">{selectedDeal.Contact || '—'}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">Title / Role</Typography>
                  <Typography variant="body1">{selectedDeal.ContactTitle || '—'}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">Email</Typography>
                  <Typography variant="body1">{selectedDeal.ContactEmail || '—'}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">Phone</Typography>
                  <Typography variant="body1">{selectedDeal.ContactPhone || '—'}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">{module === 'sell' ? 'Project Name' : 'Company'}</Typography>
                  <Typography variant="body1">{selectedDeal.Company || '—'}</Typography>
                </Grid>
                {module === 'sell' && (
                  <Grid item xs={12} sm={6}>
                    <Typography variant="caption" color="text.secondary">Company Name</Typography>
                    <Typography variant="body1">{getSellSideCompanyName(selectedDeal) || '—'}</Typography>
                  </Grid>
                )}
                {module === 'buy' && (
                  <>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="caption" color="text.secondary">Client</Typography>
                      <Typography variant="body1">{getBuySideClient(selectedDeal) || '—'}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="caption" color="text.secondary">Campaign</Typography>
                      <Typography variant="body1">{getBuySideCampaign(selectedDeal) || '—'}</Typography>
                    </Grid>
                  </>
                )}
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">Company Size</Typography>
                  <Typography variant="body1">
                    {selectedDeal.CompanySize || '—'}
                  </Typography>
                </Grid>
              </Grid>
            </Box>

            {/* Section 2: Commercial / Deal Information */}
            <Box sx={{ mb: 3, pb: 3, borderBottom: '1px solid #e0e0e0' }}>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>Commercial / Deal Information</Typography>
              <Grid container spacing={2}>
                {module === 'sell' ? (
                  <>
                    {/* Prep Phase */}
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1, color: 'primary.main' }}>Prep Phase</Typography>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <Typography variant="caption" color="text.secondary">MRR</Typography>
                      <Typography variant="body1">{formatCurrency(getSellSidePhaseData(selectedDeal).PrepMRR)}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <Typography variant="caption" color="text.secondary">Term (months)</Typography>
                      <Typography variant="body1">{getSellSidePhaseData(selectedDeal).PrepTerm || '—'}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <Typography variant="caption" color="text.secondary">Onboarding Fee</Typography>
                      <Typography variant="body1">{formatCurrency(getSellSidePhaseData(selectedDeal).PrepOnboardingFee)}</Typography>
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="caption" color="text.secondary">Prep Phase TCV</Typography>
                      <Typography variant="body1">
                        {formatCurrency(calculatePhaseTCV(
                          getSellSidePhaseData(selectedDeal).PrepMRR,
                          getSellSidePhaseData(selectedDeal).PrepTerm,
                          getSellSidePhaseData(selectedDeal).PrepOnboardingFee
                        ))}
                      </Typography>
                    </Grid>

                    {/* Sale Process Phase */}
                    <Grid item xs={12} sx={{ mt: 1 }}>
                      <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1, color: 'primary.main' }}>Sale Process Phase</Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="caption" color="text.secondary">MRR</Typography>
                      <Typography variant="body1">{formatCurrency(getSellSidePhaseData(selectedDeal).SaleProcessMRR)}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="caption" color="text.secondary">Term (months)</Typography>
                      <Typography variant="body1">{getSellSidePhaseData(selectedDeal).SaleProcessTerm || '—'}</Typography>
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="caption" color="text.secondary">Sale Process Phase TCV</Typography>
                      <Typography variant="body1">
                        {formatCurrency(calculatePhaseTCV(
                          getSellSidePhaseData(selectedDeal).SaleProcessMRR,
                          getSellSidePhaseData(selectedDeal).SaleProcessTerm
                        ))}
                      </Typography>
                    </Grid>

                    {/* Due Diligence Phase */}
                    <Grid item xs={12} sx={{ mt: 1 }}>
                      <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1, color: 'primary.main' }}>Due Diligence Phase (Optional)</Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="caption" color="text.secondary">MRR</Typography>
                      <Typography variant="body1">{formatCurrency(getSellSidePhaseData(selectedDeal).DueDiligenceMRR)}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="caption" color="text.secondary">Term (months)</Typography>
                      <Typography variant="body1">{getSellSidePhaseData(selectedDeal).DueDiligenceTerm || '—'}</Typography>
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="caption" color="text.secondary">Due Diligence Phase TCV</Typography>
                      <Typography variant="body1">
                        {formatCurrency(calculatePhaseTCV(
                          getSellSidePhaseData(selectedDeal).DueDiligenceMRR,
                          getSellSidePhaseData(selectedDeal).DueDiligenceTerm
                        ))}
                      </Typography>
                    </Grid>

                    {/* Total TCV */}
                    <Grid item xs={12} sx={{ mt: 2 }}>
                      <Typography variant="caption" color="text.secondary">Total Contract Value (TCV)</Typography>
                      <Typography variant="body1" fontWeight={600}>
                        {formatCurrency(calculateSellSideTCV(
                          getSellSidePhaseData(selectedDeal).PrepMRR,
                          getSellSidePhaseData(selectedDeal).PrepTerm,
                          getSellSidePhaseData(selectedDeal).PrepOnboardingFee,
                          getSellSidePhaseData(selectedDeal).SaleProcessMRR,
                          getSellSidePhaseData(selectedDeal).SaleProcessTerm,
                          getSellSidePhaseData(selectedDeal).DueDiligenceMRR,
                          getSellSidePhaseData(selectedDeal).DueDiligenceTerm
                        )) || formatCurrency(selectedDeal.Amount)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                        Auto-calculated: Sum of all phases
                      </Typography>
                    </Grid>
                  </>
                ) : (
                  <>
                    <Grid item xs={12} sm={4}>
                      <Typography variant="caption" color="text.secondary">MRR</Typography>
                      <Typography variant="body1">{formatCurrency(selectedDeal.MRR)}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <Typography variant="caption" color="text.secondary">Contract Term (months)</Typography>
                      <Typography variant="body1">{selectedDeal.ContractTerm || '—'}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <Typography variant="caption" color="text.secondary">Onboarding Fee (one-time)</Typography>
                      <Typography variant="body1">{formatCurrency(selectedDeal.OnboardingFee)}</Typography>
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="caption" color="text.secondary">Total Contract Value (TCV)</Typography>
                      <Typography variant="body1" fontWeight={600}>
                        {(() => {
                          const mrr = parseFloat(selectedDeal.MRR) || 0;
                          const term = parseInt(selectedDeal.ContractTerm) || 0;
                          const fee = parseFloat(selectedDeal.OnboardingFee) || 0;
                          if (mrr && term) {
                            return formatCurrency(mrr * term + fee);
                          }
                          return formatCurrency(selectedDeal.Amount);
                        })()}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                        Auto-calculated: MRR × Term + Onboarding Fee
                      </Typography>
                    </Grid>
                  </>
                )}
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">Lead Source</Typography>
                  <Typography variant="body1">{selectedDeal.LeadSourceName || '—'}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">Last Activity</Typography>
                  <Typography variant="body1">{selectedDeal.LastActivity || '—'}</Typography>
                </Grid>
              </Grid>
            </Box>

            {/* Section 3: File Attachments */}
            <Box sx={{ mb: 3, pb: 3, borderBottom: '1px solid #e0e0e0' }}>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>File Attachments</Typography>
              
              {/* Upload Section */}
              <Box sx={{ mb: 2, p: 2, border: '1px dashed #e0e0e0', borderRadius: 2, backgroundColor: '#f9fafb' }}>
                <input
                  type="file"
                  accept=".pdf,.xls,.xlsx,.csv"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                  id="file-upload-input"
                />
                <label htmlFor="file-upload-input">
                  <Button
                    variant="outlined"
                    component="span"
                    startIcon={<UploadIcon />}
                    size="small"
                    disabled={uploadingFile}
                    sx={{ mb: selectedFile ? 1 : 0 }}
                  >
                    {uploadingFile ? 'Uploading...' : 'Select File'}
                  </Button>
                </label>
                {selectedFile && (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        size="small"
                        variant="contained"
                        onClick={handleFileUpload}
                        disabled={uploadingFile}
                      >
                        Upload
                      </Button>
                      <Button
                        size="small"
                        onClick={() => setSelectedFile(null)}
                        disabled={uploadingFile}
                      >
                        Cancel
                      </Button>
                    </Box>
                  </Box>
                )}
              </Box>

              {/* Attachments List */}
              {attachments.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                  No files attached
                </Typography>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {attachments.map((attachment) => (
                    <Box
                      key={attachment.AttachmentID}
                      sx={{
                        p: 1.5,
                        border: '1px solid #e0e0e0',
                        borderRadius: 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        cursor: 'pointer',
                        '&:hover': {
                          backgroundColor: '#f9fafb',
                          borderColor: '#2563eb',
                        },
                      }}
                    >
                      <Box sx={{ color: '#6b7280' }}>
                        {getFileIcon(attachment.FileType)}
                      </Box>
                      <Box
                        sx={{ flex: 1, minWidth: 0 }}
                        onClick={() => handleFileClick(attachment)}
                      >
                        <Typography variant="body2" fontWeight={500} sx={{ wordBreak: 'break-word' }}>
                          {attachment.FileName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatFileSize(attachment.FileSize)} • {attachment.CreatedByName || 'Unknown'} • {formatTimestamp(attachment.CreatedOn)}
                        </Typography>
                      </Box>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteAttachment(attachment.AttachmentID);
                        }}
                        sx={{ color: '#dc2626' }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>

            {/* Section 4: Notes & Activity Timeline */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>Notes & Activities</Typography>
              
              {/* Add New Entry Form */}
              <Box sx={{ mb: 3, p: 2, border: '1px solid #e0e0e0', borderRadius: 2, backgroundColor: '#f9fafb' }}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={3}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Type</InputLabel>
                      <Select
                        value={newEntryType}
                        onChange={(e) => setNewEntryType(e.target.value)}
                        label="Type"
                      >
                        <MenuItem value="Note">Note</MenuItem>
                        <MenuItem value="Call">Call</MenuItem>
                        <MenuItem value="Meeting">Meeting</MenuItem>
                        <MenuItem value="Email">Email</MenuItem>
                        <MenuItem value="Text">Text</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={9}>
                    <TextField
                      fullWidth
                      size="small"
                      multiline
                      rows={2}
                      placeholder={`Add a ${newEntryType.toLowerCase()}... Use @ to mention users`}
                      value={newEntryBody}
                      onChange={(e) => setNewEntryBody(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                          handleCreateTimelineEntry();
                        }
                      }}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                      <Button
                        size="small"
                        onClick={() => {
                          setNewEntryBody('');
                          setNewEntryType('Note');
                        }}
                      >
                        Clear
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        onClick={handleCreateTimelineEntry}
                        disabled={!newEntryBody.trim()}
                      >
                        Add Entry
                      </Button>
                    </Box>
                  </Grid>
                </Grid>
              </Box>

              {/* Timeline */}
              {loadingTimeline ? (
                <Typography variant="body2" color="text.secondary">Loading timeline...</Typography>
              ) : timelineEntries.length === 0 ? (
                <Box
                  sx={{
                    padding: '24px',
                    borderRadius: '4px',
                    border: '1px solid #e0e0e0',
                    backgroundColor: '#f9fafb',
                    textAlign: 'center',
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    No entries yet. Add your first note or activity above.
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {timelineEntries.map((entry) => {
                    const mentions = extractMentions(entry.body);
                    return (
                      <Box
                        key={entry.id}
                        sx={{
                          p: 2,
                          border: '1px solid #e0e0e0',
                          borderRadius: 2,
                          backgroundColor: '#fff',
                          position: 'relative',
                          '&:before': {
                            content: '""',
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            bottom: 0,
                            width: '4px',
                            backgroundColor: getActivityColor(entry.activityType),
                            borderRadius: '2px 0 0 2px',
                          },
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                          <Box
                            sx={{
                              color: getActivityColor(entry.activityType),
                              mt: 0.5,
                            }}
                          >
                            {getActivityIcon(entry.activityType)}
                          </Box>
                          <Box sx={{ flex: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                              <Chip
                                label={entry.activityType}
                                size="small"
                                sx={{
                                  backgroundColor: getActivityColor(entry.activityType) + '20',
                                  color: getActivityColor(entry.activityType),
                                  fontWeight: 500,
                                  height: 20,
                                  fontSize: '0.7rem',
                                }}
                              />
                              <Typography variant="caption" color="text.secondary">
                                {entry.author}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                •
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {formatTimestamp(entry.timestamp)}
                              </Typography>
                            </Box>
                            <Typography
                              variant="body2"
                              sx={{
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                color: '#374151',
                              }}
                            >
                              {renderTextWithMentions(entry.body)}
                            </Typography>
                            {mentions.length > 0 && (
                              <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {mentions.map((mention, idx) => (
                                  <Chip
                                    key={idx}
                                    label={`@${mention}`}
                                    size="small"
                                    sx={{
                                      height: 18,
                                      fontSize: '0.65rem',
                                      backgroundColor: '#eff6ff',
                                      color: '#2563eb',
                                    }}
                                  />
                                ))}
                              </Box>
                            )}
                          </Box>
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              )}
            </Box>
          </Box>
        )}
      </Drawer>

      {/* New Deal Dialog */}
      <Dialog open={newDealDialog} onClose={() => setNewDealDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create New Deal</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {/* Section 1: Contact Information */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>Contact Information</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Name"
                fullWidth
                value={newDealForm.Contact}
                onChange={(e) => setNewDealForm({ ...newDealForm, Contact: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Title / Role"
                fullWidth
                value={newDealForm.ContactTitle}
                onChange={(e) => setNewDealForm({ ...newDealForm, ContactTitle: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Email"
                fullWidth
                type="email"
                value={newDealForm.ContactEmail}
                onChange={(e) => setNewDealForm({ ...newDealForm, ContactEmail: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Phone"
                fullWidth
                value={newDealForm.ContactPhone}
                onChange={(e) => setNewDealForm({ ...newDealForm, ContactPhone: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label={companyLabel}
                fullWidth
                required
                value={newDealForm.Company}
                onChange={(e) => setNewDealForm({ ...newDealForm, Company: e.target.value })}
              />
            </Grid>
            {module === 'sell' && (
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Company Name"
                  fullWidth
                  value={newDealForm.CompanyName}
                  onChange={(e) => setNewDealForm({ ...newDealForm, CompanyName: e.target.value })}
                />
              </Grid>
            )}
            {module === 'buy' && (
              <>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Client</InputLabel>
                    <Select
                      value={newDealForm.BuySideClientID}
                      onChange={(e) => {
                        setNewDealForm({ ...newDealForm, BuySideClientID: e.target.value, BuySideCampaignID: '' });
                      }}
                      label="Client"
                    >
                      <MenuItem value="">None</MenuItem>
                      {buySideClients.map((client) => (
                        <MenuItem key={client.ClientID} value={client.ClientID}>
                          {client.ClientName}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <FormControl fullWidth>
                      <InputLabel>Campaign</InputLabel>
                      <Select
                        value={newDealForm.BuySideCampaignID}
                        onChange={(e) => setNewDealForm({ ...newDealForm, BuySideCampaignID: e.target.value })}
                        label="Campaign"
                        disabled={!newDealForm.BuySideClientID}
                      >
                        <MenuItem value="">None</MenuItem>
                        {buySideCampaigns
                          .filter((c) => c.ClientID === newDealForm.BuySideClientID)
                          .map((campaign) => (
                            <MenuItem key={campaign.CampaignID} value={campaign.CampaignID}>
                              {campaign.CampaignName}
                            </MenuItem>
                          ))}
                      </Select>
                    </FormControl>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => setClientDialogOpen(true)}
                      sx={{ minWidth: 'auto', px: 2 }}
                    >
                      + Client
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => setCampaignDialogOpen(true)}
                      disabled={!newDealForm.BuySideClientID}
                      sx={{ minWidth: 'auto', px: 2 }}
                    >
                      + Campaign
                    </Button>
                  </Box>
                </Grid>
              </>
            )}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Company Size</InputLabel>
                <Select
                  value={newDealForm.CompanySize}
                  onChange={(e) => setNewDealForm({ ...newDealForm, CompanySize: e.target.value })}
                  label="Company Size"
                >
                  <MenuItem value="">None</MenuItem>
                  <MenuItem value="1-10">1-10</MenuItem>
                  <MenuItem value="11-50">11-50</MenuItem>
                  <MenuItem value="51-200">51-200</MenuItem>
                  <MenuItem value="201-500">201-500</MenuItem>
                  <MenuItem value="501-1000">501-1000</MenuItem>
                  <MenuItem value="1001-5000">1001-5000</MenuItem>
                  <MenuItem value="5001+">5001+</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Section 2: Commercial / Deal Information */}
            <Grid item xs={12} sx={{ mt: 2 }}>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>Commercial / Deal Information</Typography>
            </Grid>
            
            {module === 'sell' ? (
              <>
                {/* Prep Phase */}
                <Grid item xs={12}>
                  <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1, color: 'primary.main' }}>Prep Phase</Typography>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="MRR"
                    fullWidth
                    type="number"
                    value={newDealForm.PrepMRR}
                    onChange={(e) => setNewDealForm({ ...newDealForm, PrepMRR: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Term (months)"
                    fullWidth
                    type="number"
                    value={newDealForm.PrepTerm}
                    onChange={(e) => setNewDealForm({ ...newDealForm, PrepTerm: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Onboarding Fee (one-time)"
                    fullWidth
                    type="number"
                    value={newDealForm.PrepOnboardingFee}
                    onChange={(e) => setNewDealForm({ ...newDealForm, PrepOnboardingFee: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Prep Phase TCV"
                    fullWidth
                    value={calculatePhaseTCV(newDealForm.PrepMRR, newDealForm.PrepTerm, newDealForm.PrepOnboardingFee) !== null ? formatCurrency(calculatePhaseTCV(newDealForm.PrepMRR, newDealForm.PrepTerm, newDealForm.PrepOnboardingFee)) : ''}
                    InputProps={{ readOnly: true }}
                    helperText="Auto-calculated: MRR × Term + Onboarding Fee"
                    size="small"
                  />
                </Grid>

                {/* Sale Process Phase */}
                <Grid item xs={12} sx={{ mt: 1 }}>
                  <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1, color: 'primary.main' }}>Sale Process Phase</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="MRR"
                    fullWidth
                    type="number"
                    value={newDealForm.SaleProcessMRR}
                    onChange={(e) => setNewDealForm({ ...newDealForm, SaleProcessMRR: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Term (months)"
                    fullWidth
                    type="number"
                    value={newDealForm.SaleProcessTerm}
                    onChange={(e) => setNewDealForm({ ...newDealForm, SaleProcessTerm: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Sale Process Phase TCV"
                    fullWidth
                    value={calculatePhaseTCV(newDealForm.SaleProcessMRR, newDealForm.SaleProcessTerm) !== null ? formatCurrency(calculatePhaseTCV(newDealForm.SaleProcessMRR, newDealForm.SaleProcessTerm)) : ''}
                    InputProps={{ readOnly: true }}
                    helperText="Auto-calculated: MRR × Term"
                    size="small"
                  />
                </Grid>

                {/* Due Diligence Phase */}
                <Grid item xs={12} sx={{ mt: 1 }}>
                  <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1, color: 'primary.main' }}>Due Diligence Phase (Optional)</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="MRR"
                    fullWidth
                    type="number"
                    value={newDealForm.DueDiligenceMRR}
                    onChange={(e) => setNewDealForm({ ...newDealForm, DueDiligenceMRR: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Term (months)"
                    fullWidth
                    type="number"
                    value={newDealForm.DueDiligenceTerm}
                    onChange={(e) => setNewDealForm({ ...newDealForm, DueDiligenceTerm: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Due Diligence Phase TCV"
                    fullWidth
                    value={calculatePhaseTCV(newDealForm.DueDiligenceMRR, newDealForm.DueDiligenceTerm) !== null ? formatCurrency(calculatePhaseTCV(newDealForm.DueDiligenceMRR, newDealForm.DueDiligenceTerm)) : ''}
                    InputProps={{ readOnly: true }}
                    helperText="Auto-calculated: MRR × Term (optional)"
                    size="small"
                  />
                </Grid>

                {/* Total TCV */}
                <Grid item xs={12} sx={{ mt: 2 }}>
                  <TextField
                    label="Total Contract Value (TCV)"
                    fullWidth
                    value={calculatedTCV !== null ? formatCurrency(calculatedTCV) : ''}
                    InputProps={{ readOnly: true }}
                    helperText="Auto-calculated: Sum of all phases"
                    sx={{ '& .MuiInputBase-input': { fontWeight: 600, fontSize: '1.1rem' } }}
                  />
                </Grid>
              </>
            ) : (
              <>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="MRR"
                    fullWidth
                    type="number"
                    value={newDealForm.MRR}
                    onChange={(e) => setNewDealForm({ ...newDealForm, MRR: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Contract Term (months)"
                    fullWidth
                    type="number"
                    value={newDealForm.ContractTerm}
                    onChange={(e) => setNewDealForm({ ...newDealForm, ContractTerm: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Onboarding Fee (one-time)"
                    fullWidth
                    type="number"
                    value={newDealForm.OnboardingFee}
                    onChange={(e) => setNewDealForm({ ...newDealForm, OnboardingFee: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Total Contract Value (TCV)"
                    fullWidth
                    value={calculatedTCV !== null ? formatCurrency(calculatedTCV) : ''}
                    InputProps={{
                      readOnly: true,
                    }}
                    helperText="Auto-calculated: MRR × Term + Onboarding Fee"
                  />
                </Grid>
              </>
            )}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required>
                <InputLabel>Stage *</InputLabel>
                <Select
                  value={newDealForm.StageID}
                  onChange={(e) => setNewDealForm({ ...newDealForm, StageID: e.target.value })}
                  label="Stage *"
                >
                  {stages.map(stage => (
                    <MenuItem key={stage.StageID} value={stage.StageID}>
                      {stage.StageName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Owner</InputLabel>
                <Select
                  value={newDealForm.OwnerID}
                  onChange={(e) => setNewDealForm({ ...newDealForm, OwnerID: e.target.value })}
                  label="Owner"
                >
                  <MenuItem value="">Unassigned</MenuItem>
                  {consultants.map(consultant => (
                    <MenuItem key={consultant.ConsultantID} value={consultant.ConsultantID}>
                      {consultant.FirstName} {consultant.LastName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Lead Source</InputLabel>
                <Select
                  value={newDealForm.LeadSourceID}
                  onChange={(e) => setNewDealForm({ ...newDealForm, LeadSourceID: e.target.value })}
                  label="Lead Source"
                >
                  <MenuItem value="">None</MenuItem>
                  {leadSources.map(source => (
                    <MenuItem key={source.LeadSourceID} value={source.LeadSourceID}>
                      {source.SourceName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Section 3: Notes */}
            <Grid item xs={12} sx={{ mt: 2 }}>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>Notes</Typography>
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Notes"
                fullWidth
                multiline
                rows={3}
                value={newDealForm.Notes}
                onChange={(e) => setNewDealForm({ ...newDealForm, Notes: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewDealDialog(false)}>Cancel</Button>
          <Button onClick={handleCreateDeal} variant="contained">Create</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Deal Dialog */}
      <Dialog open={editDealDialog} onClose={() => setEditDealDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Edit Deal</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {/* Section 1: Contact Information */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>Contact Information</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Name"
                fullWidth
                value={editDealForm.Contact}
                onChange={(e) => setEditDealForm({ ...editDealForm, Contact: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Title / Role"
                fullWidth
                value={editDealForm.ContactTitle}
                onChange={(e) => setEditDealForm({ ...editDealForm, ContactTitle: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Email"
                fullWidth
                type="email"
                value={editDealForm.ContactEmail}
                onChange={(e) => setEditDealForm({ ...editDealForm, ContactEmail: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Phone"
                fullWidth
                value={editDealForm.ContactPhone}
                onChange={(e) => setEditDealForm({ ...editDealForm, ContactPhone: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label={companyLabel}
                fullWidth
                required
                value={editDealForm.Company}
                onChange={(e) => setEditDealForm({ ...editDealForm, Company: e.target.value })}
              />
            </Grid>
            {module === 'sell' && (
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Company Name"
                  fullWidth
                  value={editDealForm.CompanyName}
                  onChange={(e) => setEditDealForm({ ...editDealForm, CompanyName: e.target.value })}
                />
              </Grid>
            )}
            {module === 'buy' && (
              <>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Client</InputLabel>
                    <Select
                      value={editDealForm.BuySideClientID}
                      onChange={(e) => {
                        setEditDealForm({ ...editDealForm, BuySideClientID: e.target.value, BuySideCampaignID: '' });
                      }}
                      label="Client"
                    >
                      <MenuItem value="">None</MenuItem>
                      {buySideClients.map((client) => (
                        <MenuItem key={client.ClientID} value={client.ClientID}>
                          {client.ClientName}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <FormControl fullWidth>
                      <InputLabel>Campaign</InputLabel>
                      <Select
                        value={editDealForm.BuySideCampaignID}
                        onChange={(e) => setEditDealForm({ ...editDealForm, BuySideCampaignID: e.target.value })}
                        label="Campaign"
                        disabled={!editDealForm.BuySideClientID}
                      >
                        <MenuItem value="">None</MenuItem>
                        {buySideCampaigns
                          .filter((c) => c.ClientID === editDealForm.BuySideClientID)
                          .map((campaign) => (
                            <MenuItem key={campaign.CampaignID} value={campaign.CampaignID}>
                              {campaign.CampaignName}
                            </MenuItem>
                          ))}
                      </Select>
                    </FormControl>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => setClientDialogOpen(true)}
                      sx={{ minWidth: 'auto', px: 2 }}
                    >
                      + Client
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => setCampaignDialogOpen(true)}
                      disabled={!editDealForm.BuySideClientID}
                      sx={{ minWidth: 'auto', px: 2 }}
                    >
                      + Campaign
                    </Button>
                  </Box>
                </Grid>
              </>
            )}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Company Size</InputLabel>
                <Select
                  value={editDealForm.CompanySize}
                  onChange={(e) => setEditDealForm({ ...editDealForm, CompanySize: e.target.value })}
                  label="Company Size"
                >
                  <MenuItem value="">None</MenuItem>
                  <MenuItem value="1-10">1-10</MenuItem>
                  <MenuItem value="11-50">11-50</MenuItem>
                  <MenuItem value="51-200">51-200</MenuItem>
                  <MenuItem value="201-500">201-500</MenuItem>
                  <MenuItem value="501-1000">501-1000</MenuItem>
                  <MenuItem value="1001-5000">1001-5000</MenuItem>
                  <MenuItem value="5001+">5001+</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Section 2: Commercial / Deal Information */}
            <Grid item xs={12} sx={{ mt: 2 }}>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>Commercial / Deal Information</Typography>
            </Grid>
            
            {module === 'sell' ? (
              <>
                {/* Prep Phase */}
                <Grid item xs={12}>
                  <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1, color: 'primary.main' }}>Prep Phase</Typography>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="MRR"
                    fullWidth
                    type="number"
                    value={editDealForm.PrepMRR}
                    onChange={(e) => setEditDealForm({ ...editDealForm, PrepMRR: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Term (months)"
                    fullWidth
                    type="number"
                    value={editDealForm.PrepTerm}
                    onChange={(e) => setEditDealForm({ ...editDealForm, PrepTerm: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Onboarding Fee (one-time)"
                    fullWidth
                    type="number"
                    value={editDealForm.PrepOnboardingFee}
                    onChange={(e) => setEditDealForm({ ...editDealForm, PrepOnboardingFee: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Prep Phase TCV"
                    fullWidth
                    value={calculatePhaseTCV(editDealForm.PrepMRR, editDealForm.PrepTerm, editDealForm.PrepOnboardingFee) !== null ? formatCurrency(calculatePhaseTCV(editDealForm.PrepMRR, editDealForm.PrepTerm, editDealForm.PrepOnboardingFee)) : ''}
                    InputProps={{ readOnly: true }}
                    helperText="Auto-calculated: MRR × Term + Onboarding Fee"
                    size="small"
                  />
                </Grid>

                {/* Sale Process Phase */}
                <Grid item xs={12} sx={{ mt: 1 }}>
                  <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1, color: 'primary.main' }}>Sale Process Phase</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="MRR"
                    fullWidth
                    type="number"
                    value={editDealForm.SaleProcessMRR}
                    onChange={(e) => setEditDealForm({ ...editDealForm, SaleProcessMRR: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Term (months)"
                    fullWidth
                    type="number"
                    value={editDealForm.SaleProcessTerm}
                    onChange={(e) => setEditDealForm({ ...editDealForm, SaleProcessTerm: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Sale Process Phase TCV"
                    fullWidth
                    value={calculatePhaseTCV(editDealForm.SaleProcessMRR, editDealForm.SaleProcessTerm) !== null ? formatCurrency(calculatePhaseTCV(editDealForm.SaleProcessMRR, editDealForm.SaleProcessTerm)) : ''}
                    InputProps={{ readOnly: true }}
                    helperText="Auto-calculated: MRR × Term"
                    size="small"
                  />
                </Grid>

                {/* Due Diligence Phase */}
                <Grid item xs={12} sx={{ mt: 1 }}>
                  <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1, color: 'primary.main' }}>Due Diligence Phase (Optional)</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="MRR"
                    fullWidth
                    type="number"
                    value={editDealForm.DueDiligenceMRR}
                    onChange={(e) => setEditDealForm({ ...editDealForm, DueDiligenceMRR: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Term (months)"
                    fullWidth
                    type="number"
                    value={editDealForm.DueDiligenceTerm}
                    onChange={(e) => setEditDealForm({ ...editDealForm, DueDiligenceTerm: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Due Diligence Phase TCV"
                    fullWidth
                    value={calculatePhaseTCV(editDealForm.DueDiligenceMRR, editDealForm.DueDiligenceTerm) !== null ? formatCurrency(calculatePhaseTCV(editDealForm.DueDiligenceMRR, editDealForm.DueDiligenceTerm)) : ''}
                    InputProps={{ readOnly: true }}
                    helperText="Auto-calculated: MRR × Term (optional)"
                    size="small"
                  />
                </Grid>

                {/* Total TCV */}
                <Grid item xs={12} sx={{ mt: 2 }}>
                  <TextField
                    label="Total Contract Value (TCV)"
                    fullWidth
                    value={calculatedEditTCV !== null ? formatCurrency(calculatedEditTCV) : ''}
                    InputProps={{ readOnly: true }}
                    helperText="Auto-calculated: Sum of all phases"
                    sx={{ '& .MuiInputBase-input': { fontWeight: 600, fontSize: '1.1rem' } }}
                  />
                </Grid>
              </>
            ) : (
              <>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="MRR"
                    fullWidth
                    type="number"
                    value={editDealForm.MRR}
                    onChange={(e) => setEditDealForm({ ...editDealForm, MRR: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Contract Term (months)"
                    fullWidth
                    type="number"
                    value={editDealForm.ContractTerm}
                    onChange={(e) => setEditDealForm({ ...editDealForm, ContractTerm: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Onboarding Fee (one-time)"
                    fullWidth
                    type="number"
                    value={editDealForm.OnboardingFee}
                    onChange={(e) => setEditDealForm({ ...editDealForm, OnboardingFee: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Total Contract Value (TCV)"
                    fullWidth
                    value={calculatedEditTCV !== null ? formatCurrency(calculatedEditTCV) : ''}
                    InputProps={{
                      readOnly: true,
                    }}
                    helperText="Auto-calculated: MRR × Term + Onboarding Fee"
                  />
                </Grid>
              </>
            )}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required>
                <InputLabel>Stage *</InputLabel>
                <Select
                  value={editDealForm.StageID}
                  onChange={(e) => setEditDealForm({ ...editDealForm, StageID: e.target.value })}
                  label="Stage *"
                >
                  {stages.map(stage => (
                    <MenuItem key={stage.StageID} value={stage.StageID}>
                      {stage.StageName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Owner</InputLabel>
                <Select
                  value={editDealForm.OwnerID}
                  onChange={(e) => setEditDealForm({ ...editDealForm, OwnerID: e.target.value })}
                  label="Owner"
                >
                  <MenuItem value="">Unassigned</MenuItem>
                  {consultants.map(consultant => (
                    <MenuItem key={consultant.ConsultantID} value={consultant.ConsultantID}>
                      {consultant.FirstName} {consultant.LastName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Lead Source</InputLabel>
                <Select
                  value={editDealForm.LeadSourceID}
                  onChange={(e) => setEditDealForm({ ...editDealForm, LeadSourceID: e.target.value })}
                  label="Lead Source"
                >
                  <MenuItem value="">None</MenuItem>
                  {leadSources.map(source => (
                    <MenuItem key={source.LeadSourceID} value={source.LeadSourceID}>
                      {source.SourceName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Section 3: Notes */}
            <Grid item xs={12} sx={{ mt: 2 }}>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>Notes</Typography>
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Notes"
                fullWidth
                multiline
                rows={3}
                value={editDealForm.Notes}
                onChange={(e) => setEditDealForm({ ...editDealForm, Notes: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDealDialog(false)}>Cancel</Button>
          <Button onClick={handleSaveEditDeal} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>

      {/* Create Client Dialog */}
      <Dialog open={clientDialogOpen} onClose={() => setClientDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Client</DialogTitle>
        <DialogContent>
          <TextField
            label="Client Name"
            fullWidth
            required
            value={newClientName}
            onChange={(e) => setNewClientName(e.target.value)}
            sx={{ mt: 2 }}
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClientDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateClient} variant="contained">Create</Button>
        </DialogActions>
      </Dialog>

      {/* Create Campaign Dialog */}
      <Dialog open={campaignDialogOpen} onClose={() => setCampaignDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create New Campaign</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth required>
                <InputLabel>Client</InputLabel>
                <Select
                  value={newCampaignForm.ClientID}
                  onChange={(e) => setNewCampaignForm({ ...newCampaignForm, ClientID: e.target.value })}
                  label="Client"
                >
                  <MenuItem value="">Select a client</MenuItem>
                  {buySideClients.map((client) => (
                    <MenuItem key={client.ClientID} value={client.ClientID}>
                      {client.ClientName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Campaign Name"
                fullWidth
                required
                value={newCampaignForm.CampaignName}
                onChange={(e) => setNewCampaignForm({ ...newCampaignForm, CampaignName: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Description"
                fullWidth
                multiline
                rows={2}
                value={newCampaignForm.Description}
                onChange={(e) => setNewCampaignForm({ ...newCampaignForm, Description: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>Campaign Criteria</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Industry"
                fullWidth
                placeholder="e.g., Technology, Healthcare"
                value={newCampaignForm.Industry}
                onChange={(e) => setNewCampaignForm({ ...newCampaignForm, Industry: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Location"
                fullWidth
                placeholder="e.g., TX, CA, NY"
                value={newCampaignForm.Location}
                onChange={(e) => setNewCampaignForm({ ...newCampaignForm, Location: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Headcount Min"
                fullWidth
                type="number"
                value={newCampaignForm.HeadcountMin}
                onChange={(e) => setNewCampaignForm({ ...newCampaignForm, HeadcountMin: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Headcount Max"
                fullWidth
                type="number"
                value={newCampaignForm.HeadcountMax}
                onChange={(e) => setNewCampaignForm({ ...newCampaignForm, HeadcountMax: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Revenue Min ($)"
                fullWidth
                type="number"
                value={newCampaignForm.RevenueMin}
                onChange={(e) => setNewCampaignForm({ ...newCampaignForm, RevenueMin: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Revenue Max ($)"
                fullWidth
                type="number"
                value={newCampaignForm.RevenueMax}
                onChange={(e) => setNewCampaignForm({ ...newCampaignForm, RevenueMax: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCampaignDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateCampaign} variant="contained" disabled={!newCampaignForm.ClientID || !newCampaignForm.CampaignName.trim()}>Create</Button>
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

export default SalesCRM;

