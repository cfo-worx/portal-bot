// client/src/modules/admin/pages/ClientForm.jsx

import React, { useState, useEffect, useRef } from 'react';
import {
  TextField,
  Checkbox,
  FormControlLabel,
  Button,
  Grid,
  Typography,
  Divider,
  Snackbar,
  Alert,
  Tabs,
  Tab,
  Box,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Card,
  CardContent,
  CardActions,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
} from '@mui/material';
import { Autocomplete, Tooltip } from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, AttachFile as AttachFileIcon, ExpandMore as ExpandMoreIcon, PictureAsPdf as PictureAsPdfIcon, OpenInNew as OpenInNewIcon } from '@mui/icons-material';
import Modal from '../../../../components/Shared/Modal';
import { validateClient } from '../../../../utils/validation';
import { addClient, updateClient } from '../../../../api/clients';
import { 
  getContractsByClientId, 
  createContract, 
  updateContract, 
  deleteContract,
  uploadContractPDF,
  deleteContractPDF,
  getContractPDFs,
  getContractPDFUrl
} from '../../../../api/contracts';
import { getActiveConsultants } from '../../../../api/consultants';
import axios from '../../../../api/index'; // for optionally persisting new industries
import { systemAccess } from '../../../client/pages/OnboardingPresentation';

// 1) Import the industry list JSON
import rawIndustryList from '../../data/industry.json';

// Extract financial systems and collaboration tools from systemAccess
const financialSystems = Object.keys(systemAccess).filter(key => 
  ['FreshBooks','NetSuite','QuickBooks Online','QuickBooks Desktop',
   'Sage 50','Sage Intacct','SAP Business One','Wave',
   'Xero','Zoho Books',
   'Dynamics GP','D365 Business Central','D365 Finance'].includes(key)
).sort();

const collaborationTools = Object.keys(systemAccess).filter(key => 
  ['Email','Google Meet','Microsoft Teams','Phone','Slack','Zoom'].includes(key)
).sort();

const ClientForm = ({ client, onClose, refreshClients }) => {
  // ────────────────────────────────────────────────────────────
  // State
  // ────────────────────────────────────────────────────────────
  const [formData, setFormData] = useState({
    ClientName: '',
    ClientAddress: '',
    BillingEmail: '',
    PhoneNumber: '',
    InitialContractLength: '',
    MonthlyRevenue: '',
    OnboardingFee: '',
    AccountingSystem: '',
    RevenueRange: '',
    ActiveStatus: false,
    GrossProfitTarget: '',
    Industry: '',
    BankName: '',
    BankAddress: '',
    BankRouting: '',
    BankAccount: '',
    BankAuthorized: false,
    BankMaskedAccount: '',
    BankMaskedRouting: '',
    // Onboarding fields - Company Information
    EIN: '',
    EntityType: '',
    CustomEntity: '',
    PrimaryOwner: '',
    PrimaryOwnershipPct: '',
    SecondaryOwner: '',
    SecondaryOwnershipPct: '',
    AddressLine1: '',
    AddressLine2: '',
    AddressLine3: '',
    City: '',
    State: '',
    Zip: '',
    // Systems
    FinancialSystemsJson: [],
    CollaborationToolsJson: [],
  });

  const [contracts, setContracts] = useState([]);

  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [industries, setIndustries] = useState([]);
  const [consultants, setConsultants] = useState([]);
  const [activeTab, setActiveTab] = useState(0);
  const industryInputRef = useRef();

  // ────────────────────────────────────────────────────────────
  // Crypto helpers (b64, shared-passphrase, ephemeral, legacy v1)
  // ────────────────────────────────────────────────────────────
  const b64 = (u8) => btoa(String.fromCharCode(...u8));
  const fromB64 = (str) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0));

  const SHARED_PASS = import.meta.env.VITE_PM_LEGACY_PASSPHRASE || '';
  const SHARED_SALT = import.meta.env.VITE_PM_LEGACY_SALT || 'cfoworx:pm';

  // ---- Shared-passphrase key (preferred) ----
  async function getSharedKey() {
    if (!SHARED_PASS || !window.crypto?.subtle) return null;
    const te = new TextEncoder();
    const passKey = await crypto.subtle.importKey('raw', te.encode(SHARED_PASS), { name: 'PBKDF2' }, false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: te.encode(SHARED_SALT), iterations: 100_000, hash: 'SHA-256' },
      passKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async function encryptWithShared(plain) {
    const key = await getSharedKey();
    if (!key) return null;
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(String(plain)));
    return { data: b64(new Uint8Array(enc)), iv: b64(iv) };
  }

  async function decryptWithShared(encObj) {
    try {
      const key = await getSharedKey();
      if (!key) return null;
      const iv = fromB64(encObj.iv);
      const data = fromB64(encObj.data);
      const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
      return new TextDecoder().decode(new Uint8Array(plainBuf));
    } catch {
      return null;
    }
  }

  // ---- Ephemeral per-browser key (fallback) ----
  async function getEphemeralKeyForEncrypt() {
    const cacheKey = '_pm_ephemeral_b64';
    let raw = localStorage.getItem(cacheKey);
    if (!raw) {
      const rand = crypto.getRandomValues(new Uint8Array(32));
      raw = b64(rand);
      localStorage.setItem(cacheKey, raw);
    }
    const keyRaw = fromB64(raw);
    const baseKey = await crypto.subtle.importKey('raw', keyRaw, { name: 'PBKDF2' }, false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: new TextEncoder().encode('cfoworx:admin-card'), iterations: 100_000, hash: 'SHA-256' },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async function getEphemeralKeyForDecrypt() {
    const cacheKey = '_pm_ephemeral_b64';
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return null;
    const keyRaw = fromB64(raw);
    const baseKey = await crypto.subtle.importKey('raw', keyRaw, { name: 'PBKDF2' }, false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: new TextEncoder().encode('cfoworx:admin-card'), iterations: 100_000, hash: 'SHA-256' },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
  }

  async function encryptWithEphemeral(plain) {
    const key = await getEphemeralKeyForEncrypt();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(String(plain)));
    return { data: b64(new Uint8Array(enc)), iv: b64(iv) };
  }

  async function decryptEphemeral(encObj) {
    try {
      const key = await getEphemeralKeyForDecrypt();
      if (!key) return null;
      const iv = fromB64(encObj.iv);
      const data = fromB64(encObj.data);
      const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
      return new TextDecoder().decode(new Uint8Array(plainBuf));
    } catch {
      return null;
    }
  }

  // ---- Legacy v1 decrypt (flat strings: account/accountIV, routing/routingIV) ----
  async function decryptLegacyPBKDF2(cipherB64, ivB64) {
    if (!SHARED_PASS) return null;
    try {
      const te = new TextEncoder();
      const passKey = await crypto.subtle.importKey('raw', te.encode(SHARED_PASS), { name: 'PBKDF2' }, false, ['deriveKey']);
      const aesKey = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: te.encode(SHARED_SALT), iterations: 100_000, hash: 'SHA-256' },
        passKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );
      const iv = fromB64(ivB64);
      const data = fromB64(cipherB64);
      const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, data);
      return new TextDecoder().decode(new Uint8Array(plainBuf));
    } catch {
      return null;
    }
  }

  // ────────────────────────────────────────────────────────────
  // Payment method JSON helpers
  // ────────────────────────────────────────────────────────────
  const parsePaymentMethodJson = (s) => {
    if (!s) return null;
    try {
      const arr = JSON.parse(s);
      if (!Array.isArray(arr) || !arr.length) return null;
      const first = arr[0];
      return first?.type === 'Bank' ? first : null;
    } catch {
      return null;
    }
  };

  // Try to decrypt any known format. Returns { account, routing } or null.
  async function tryDecryptBank(pm) {
    if (!pm?.enc) return null;

    const isV2Obj =
      pm.enc.account?.data && pm.enc.account?.iv &&
      pm.enc.routing?.data && pm.enc.routing?.iv;

    // v2 object shape (preferred today) — try SHARED first, then ephemeral fallback
    if (isV2Obj) {
      // shared passphrase (env)
      const aShared = await decryptWithShared(pm.enc.account);
      const rShared = await decryptWithShared(pm.enc.routing);
      if (aShared && rShared) return { account: aShared, routing: rShared };

      // ephemeral fallback
      const aEph = await decryptEphemeral(pm.enc.account);
      const rEph = await decryptEphemeral(pm.enc.routing);
      if (aEph && rEph) return { account: aEph, routing: rEph };
    }

    // v1 legacy (flat strings)
    if (pm.enc.account && pm.enc.accountIV && pm.enc.routing && pm.enc.routingIV) {
      // shared legacy
      const aLegacy = await decryptLegacyPBKDF2(pm.enc.account, pm.enc.accountIV);
      const rLegacy = await decryptLegacyPBKDF2(pm.enc.routing, pm.enc.routingIV);
      if (aLegacy && rLegacy) return { account: aLegacy, routing: rLegacy };

      // ephemeral fallback in v1 shape (rare)
      const aEph = await decryptEphemeral({ data: pm.enc.account, iv: pm.enc.accountIV });
      const rEph = await decryptEphemeral({ data: pm.enc.routing, iv: pm.enc.routingIV });
      if (aEph && rEph) return { account: aEph, routing: rEph };
    }

    return null;
  }

  // Build stored PM array for saving (Bank only; masked + encrypted)
  // Uses shared-passphrase first (v2/shared), with ephemeral fallback (v2/ephemeral-like)
  async function buildPaymentMethodJsonFromForm(f) {
    const account = (f.BankAccount || '').trim();
    const routing = (f.BankRouting || '').trim();
    if (!account || !routing) return null;

    const last4 = account.slice(-4);
    const routingLast2 = routing.slice(-2);
    const maskedAccount = `••••${last4}`;
    const maskedRouting = `••••••${routingLast2}`;

    // Preferred: shared-passphrase encryption (env)
    let encAccount = await encryptWithShared(account);
    let encRouting = await encryptWithShared(routing);
    let algo = 'AES-GCM-256/shared';
    let v = 2;

    // Fallback: ephemeral encryption if shared key not available
    if (!encAccount || !encRouting) {
      encAccount = await encryptWithEphemeral(account);
      encRouting = await encryptWithEphemeral(routing);
      algo = 'AES-GCM-256/ephemeral';
      v = 2; // still v2 because it's {data,iv} object shape
    }

    return [
      {
        type: 'Bank',
        bankName: f.BankName || '',
        address: f.BankAddress || '',
        authorized: !!f.BankAuthorized,
        last4,
        routingLast2,
        maskedAccount,
        maskedRouting,
        enc: {
          account: encAccount,
          routing: encRouting,
          algo,
          v,
        },
      },
    ];
  }

  // ────────────────────────────────────────────────────────────
  // Effects (load industries; hydrate + attempt decrypt)
  // ────────────────────────────────────────────────────────────
  useEffect(() => {
    const sorted = [...rawIndustryList].sort((a, b) => a.localeCompare(b));
    setIndustries(sorted);

    // Load consultants
    const loadConsultants = async () => {
      try {
        const consultantsData = await getActiveConsultants();
        setConsultants(consultantsData || []);
      } catch (error) {
        console.error('Error loading consultants:', error);
      }
    };
    loadConsultants();

    if (client) {
      const pm = parsePaymentMethodJson(client?.PaymentMethodJson);
      
      // Parse FinancialSystemsJson
      let financialSystems = [];
      try {
        if (client.FinancialSystemsJson) {
          financialSystems = JSON.parse(client.FinancialSystemsJson);
          if (!Array.isArray(financialSystems)) financialSystems = [];
        }
      } catch (e) {
        console.error('Error parsing FinancialSystemsJson:', e);
      }
      
      // Parse CollaborationToolsJson
      let collaborationTools = [];
      try {
        if (client.CollaborationToolsJson) {
          collaborationTools = JSON.parse(client.CollaborationToolsJson);
          if (!Array.isArray(collaborationTools)) collaborationTools = [];
        }
      } catch (e) {
        console.error('Error parsing CollaborationToolsJson:', e);
      }

      // Base — masked only
      setFormData((prev) => ({
        ...prev,
        ClientName: client.ClientName || '',
        ClientAddress: client.ClientAddress || '',
        BillingEmail: client.BillingEmail || '',
        PhoneNumber: client.PhoneNumber || '',
        InitialContractLength: client.InitialContractLength || '',
        MonthlyRevenue: client.MonthlyRevenue || '',
        OnboardingFee: client.OnboardingFee || '',
        AccountingSystem: client.AccountingSystem || '',
        RevenueRange: client.RevenueRange || '',
        ActiveStatus: client.ActiveStatus || false,
        GrossProfitTarget: client.GrossProfitTarget || '',
        Industry: client.Industry || '',
        BankName: pm?.bankName || '',
        BankAddress: pm?.address || '',
        BankAuthorized: !!pm?.authorized,
        BankRouting: '',
        BankAccount: '',
        BankMaskedAccount: pm?.maskedAccount || '',
        BankMaskedRouting: pm?.maskedRouting || '',
        // Onboarding fields
        EIN: client.EIN || '',
        EntityType: client.EntityType || '',
        CustomEntity: client.CustomEntity || '',
        PrimaryOwner: client.PrimaryOwner || '',
        PrimaryOwnershipPct: client.PrimaryOwnershipPct != null ? String(client.PrimaryOwnershipPct) : '',
        SecondaryOwner: client.SecondaryOwner || '',
        SecondaryOwnershipPct: client.SecondaryOwnershipPct != null ? String(client.SecondaryOwnershipPct) : '',
        AddressLine1: client.AddressLine1 || '',
        AddressLine2: client.AddressLine2 || '',
        AddressLine3: client.AddressLine3 || '',
        City: client.City || '',
        State: client.State || '',
        Zip: client.Zip || '',
        FinancialSystemsJson: financialSystems,
        CollaborationToolsJson: collaborationTools,
      }));

      // Load contracts separately if client exists
      if (client?.ClientID) {
        loadContractsForClient(client.ClientID);
      }

      // Best-effort async decrypt to prefill inputs
      (async () => {
        const dec = await tryDecryptBank(pm);
        if (dec?.account || dec?.routing) {
          setFormData((prev) => ({
            ...prev,
            BankAccount: dec.account || prev.BankAccount,
            BankRouting: dec.routing || prev.BankRouting,
          }));
        }
      })();
    }
  }, [client]);

  // ────────────────────────────────────────────────────────────
  // Handlers
  // ────────────────────────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleIndustryChange = (event, newValue) => {
    setFormData((prev) => ({ ...prev, Industry: newValue || '' }));
  };

  const handleIndustryBlur = () => {
    const typed = industryInputRef.current?.value?.trim();
    if (!typed) return;
    if (!industries.includes(typed)) {
      const updated = [...industries, typed].sort((a, b) => a.localeCompare(b));
      setIndustries(updated);
      setFormData((prev) => ({ ...prev, Industry: typed }));
      // Optionally persist: axios.post('/industries', { name: typed }).catch(...)
    }
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  // Load contracts for a client
  const loadContractsForClient = async (clientId) => {
    try {
      const contractsData = await getContractsByClientId(clientId);
      // Transform database fields (PascalCase) to form fields (camelCase)
      const transformedContracts = await Promise.all(contractsData.map(async (contract) => {
        // Load PDFs for this contract
        let pdfs = [];
        if (contract.ContractID) {
          try {
            pdfs = await getContractPDFs(contract.ContractID);
          } catch (error) {
            console.error('Error loading PDFs for contract:', error);
          }
        }
        
        return {
          id: contract.ContractID || Date.now(),
          ContractID: contract.ContractID, // Keep original for updates/deletes
          contractName: contract.ContractName || '',
          contractType: contract.ContractType || 'Project',
          contractLength: contract.ContractLength || '',
          onboardingFee: contract.OnboardingFee || '',
          assignedCFO: contract.AssignedCFO || '',
          assignedCFORate: contract.AssignedCFORate || '',
          assignedController: contract.AssignedController || '',
          assignedControllerRate: contract.AssignedControllerRate || '',
          assignedSeniorAccountant: contract.AssignedSeniorAccountant || '',
          assignedSeniorAccountantRate: contract.AssignedSeniorAccountantRate || '',
          assignedSoftware: contract.AssignedSoftware || '',
          assignedSoftwareRate: contract.AssignedSoftwareRate || '',
          assignedSoftwareQuantity: contract.AssignedSoftwareQuantity || '',
          contractPDFs: pdfs, // Array of PDFs
          contractStartDate: contract.ContractStartDate ? contract.ContractStartDate.split('T')[0] : '', // Convert date to YYYY-MM-DD format
          contractEndDate: contract.ContractEndDate ? contract.ContractEndDate.split('T')[0] : '',
          contractEndReason: contract.ContractEndReason || '',
          // Revenue fields based on contract type
          totalProjectFee: contract.TotalProjectFee || '',
          percentageOfCompanySale: contract.PercentageOfCompanySale || '',
          hourlyRateLow: contract.HourlyRateLow || '',
          hourlyRateHigh: contract.HourlyRateHigh || '',
          monthlyFee: contract.MonthlyFee || '',
          monthlyFeeLow: contract.MonthlyFeeLow || '',
          monthlyFeeHigh: contract.MonthlyFeeHigh || '',
          // Additional staff
          additionalStaff: contract.AdditionalStaff && typeof contract.AdditionalStaff === 'string' 
            ? (() => {
                try {
                  return JSON.parse(contract.AdditionalStaff);
                } catch {
                  return [];
                }
              })()
            : Array.isArray(contract.AdditionalStaff) 
              ? contract.AdditionalStaff 
              : [],
        };
      }));
      setContracts(transformedContracts);
    } catch (error) {
      console.error('Error loading contracts:', error);
      setSnackbar({ open: true, message: 'Failed to load contracts', severity: 'error' });
    }
  };

  // Contract management functions
  const addContract = () => {
    const newContract = {
      id: Date.now(), // temporary ID
      contractName: '',
      contractType: 'Project',
      contractLength: '',
      onboardingFee: '',
      assignedCFO: '',
      assignedCFORate: '',
      assignedController: '',
      assignedControllerRate: '',
      assignedSeniorAccountant: '',
      assignedSeniorAccountantRate: '',
      assignedSoftware: '',
      assignedSoftwareRate: '',
      assignedSoftwareQuantity: '',
      contractPDFs: [], // Array of PDFs
      contractStartDate: '',
      contractEndDate: '',
      contractEndReason: '',
      // Revenue fields based on contract type
      totalProjectFee: '',
      percentageOfCompanySale: '',
      hourlyRateLow: '',
      hourlyRateHigh: '',
      monthlyFee: '',
      monthlyFeeLow: '',
      monthlyFeeHigh: '',
      // Additional staff
      additionalStaff: [],
    };
    setContracts([...contracts, newContract]);
  };

  const removeContract = async (contractId) => {
    // If it's a saved contract (has ContractID), delete from database
    const contract = contracts.find(c => c.id === contractId);
    if (contract?.ContractID) {
      try {
        await deleteContract(contract.ContractID);
      } catch (error) {
        console.error('Error deleting contract:', error);
        setSnackbar({ open: true, message: 'Failed to delete contract', severity: 'error' });
        return;
      }
    }
    
    // Remove from local state
    setContracts(contracts.filter(contract => contract.id !== contractId));
  };

  const updateContractField = (contractId, field, value) => {
    setContracts(contracts.map(contract => 
      contract.id === contractId ? { ...contract, [field]: value } : contract
    ));
  };

  const addAdditionalStaff = (contractId) => {
    setContracts(contracts.map(contract => 
      contract.id === contractId 
        ? { 
            ...contract, 
            additionalStaff: [...(contract.additionalStaff || []), { id: Date.now(), name: '', role: '', rate: '' }]
          } 
        : contract
    ));
  };

  const removeAdditionalStaff = (contractId, staffId) => {
    setContracts(contracts.map(contract => 
      contract.id === contractId 
        ? { 
            ...contract, 
            additionalStaff: (contract.additionalStaff || []).filter(staff => staff.id !== staffId)
          } 
        : contract
    ));
  };

  const updateAdditionalStaffField = (contractId, staffId, field, value) => {
    setContracts(contracts.map(contract => 
      contract.id === contractId 
        ? { 
            ...contract, 
            additionalStaff: (contract.additionalStaff || []).map(staff => 
              staff.id === staffId ? { ...staff, [field]: value } : staff
            )
          } 
        : contract
    ));
  };

  const getRateLabel = (contractType) => {
    switch(contractType) {
      case 'Project':
        return 'Rate';
      case 'M&A':
        return 'Rate';
      case 'Hourly':
        return 'Hourly Rate';
      case 'Recurring':
        return 'Monthly Rate';
      default:
        return 'Rate';
    }
  };

  // Helper function to format consultant display
  const formatConsultantDisplay = (consultant) => {
    if (!consultant) return '';
    const name = `${consultant.FirstName || ''} ${consultant.LastName || ''}`.trim();
    const jobTitle = consultant.JobTitle || '';
    return jobTitle ? `${name}(${jobTitle})` : name;
  };

  // Helper function to get consultant by name (for finding existing values)
  const getConsultantByName = (name) => {
    if (!name) return null;
    return consultants.find(c => {
      const fullName = `${c.FirstName || ''} ${c.LastName || ''}`.trim();
      return fullName === name || formatConsultantDisplay(c) === name;
    });
  };

  const handleFileUpload = (contractId, event) => {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      const reader = new FileReader();
      reader.onload = (e) => {
        updateContractField(contractId, 'attachment', e.target.result);
        updateContractField(contractId, 'attachmentName', file.name);
      };
      reader.readAsDataURL(file);
    }
  };

  const viewPDF = (attachment) => {
    if (attachment) {
      const newWindow = window.open();
      newWindow.document.write(`
        <html>
          <head><title>Contract Attachment</title></head>
          <body style="margin:0; padding:0;">
            <embed src="${attachment}" type="application/pdf" width="100%" height="100%" />
          </body>
        </html>
      `);
    }
  };

  // Save contracts for a client
  const saveContracts = async (clientId) => {
    try {
      for (const contract of contracts) {
        const contractData = {
          ClientID: clientId,
          ContractName: contract.contractName && contract.contractName.trim() ? contract.contractName.trim() : null,
          ContractType: contract.contractType || 'Project',
          ContractLength: contract.contractLength ? parseInt(contract.contractLength) : null,
          OnboardingFee: contract.onboardingFee ? parseFloat(contract.onboardingFee) : null,
          AssignedCFO: contract.assignedCFO || null,
          AssignedCFORate: contract.assignedCFORate ? parseFloat(contract.assignedCFORate) : null,
          AssignedController: contract.assignedController || null,
          AssignedControllerRate: contract.assignedControllerRate ? parseFloat(contract.assignedControllerRate) : null,
          AssignedSeniorAccountant: contract.assignedSeniorAccountant || null,
          AssignedSeniorAccountantRate: contract.assignedSeniorAccountantRate ? parseFloat(contract.assignedSeniorAccountantRate) : null,
          AssignedSoftware: contract.assignedSoftware || null,
          AssignedSoftwareRate: contract.assignedSoftwareRate ? parseFloat(contract.assignedSoftwareRate) : null,
          AssignedSoftwareQuantity: contract.assignedSoftwareQuantity || null,
          ContractStartDate: contract.contractStartDate || null,
          ContractEndDate: contract.contractEndDate || null,
          ContractEndReason: contract.contractEndReason || null,
          // Revenue fields based on contract type
          TotalProjectFee: contract.totalProjectFee ? parseFloat(contract.totalProjectFee) : null,
          PercentageOfCompanySale: contract.percentageOfCompanySale ? parseFloat(contract.percentageOfCompanySale) : null,
          HourlyRateLow: contract.hourlyRateLow ? parseFloat(contract.hourlyRateLow) : null,
          HourlyRateHigh: contract.hourlyRateHigh ? parseFloat(contract.hourlyRateHigh) : null,
          MonthlyFee: contract.monthlyFee ? parseFloat(contract.monthlyFee) : null,
          MonthlyFeeLow: contract.monthlyFeeLow ? parseFloat(contract.monthlyFeeLow) : null,
          MonthlyFeeHigh: contract.monthlyFeeHigh ? parseFloat(contract.monthlyFeeHigh) : null,
          // Additional staff as JSON
          AdditionalStaff: contract.additionalStaff && contract.additionalStaff.length > 0 
            ? JSON.stringify(contract.additionalStaff) 
            : null,
        };

        if (contract.ContractID) {
          // Update existing contract
          await updateContract(contract.ContractID, contractData);
        } else {
          // Create new contract
          await createContract(contractData);
        }
      }
    } catch (error) {
      console.error('Error saving contracts:', error);
      setSnackbar({ open: true, message: 'Failed to save contracts', severity: 'error' });
      throw error;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = validateClient(formData);
    if (errors.length > 0) {
      setSnackbar({ open: true, message: errors.join('\n'), severity: 'error' });
      return;
    }

    let parsedGPT = parseInt(formData.GrossProfitTarget, 10);
    if (Number.isNaN(parsedGPT)) parsedGPT = 0;

    const dataToSend = {
      ClientName: formData.ClientName,
      ClientAddress: formData.ClientAddress,
      BillingEmail: formData.BillingEmail,
      PhoneNumber: formData.PhoneNumber,
      InitialContractLength: formData.InitialContractLength ? parseInt(formData.InitialContractLength, 10) : null,
      MonthlyRevenue: formData.MonthlyRevenue ? parseFloat(formData.MonthlyRevenue) : null,
      OnboardingFee: formData.OnboardingFee ? parseFloat(formData.OnboardingFee) : null,
      AccountingSystem: formData.AccountingSystem,
      RevenueRange: formData.RevenueRange,
      ActiveStatus: formData.ActiveStatus,
      GrossProfitTarget: parsedGPT,
      Industry: formData.Industry || null,
      // Onboarding fields
      EIN: formData.EIN || null,
      EntityType: formData.EntityType || null,
      CustomEntity: formData.CustomEntity || null,
      PrimaryOwner: formData.PrimaryOwner || null,
      PrimaryOwnershipPct: formData.PrimaryOwnershipPct ? parseFloat(formData.PrimaryOwnershipPct) : null,
      SecondaryOwner: formData.SecondaryOwner || null,
      SecondaryOwnershipPct: formData.SecondaryOwnershipPct ? parseFloat(formData.SecondaryOwnershipPct) : null,
      AddressLine1: formData.AddressLine1 || null,
      AddressLine2: formData.AddressLine2 || null,
      AddressLine3: formData.AddressLine3 || null,
      City: formData.City || null,
      State: formData.State || null,
      Zip: formData.Zip || null,
      FinancialSystemsJson: formData.FinancialSystemsJson && formData.FinancialSystemsJson.length > 0 
        ? JSON.stringify(formData.FinancialSystemsJson) 
        : null,
      CollaborationToolsJson: formData.CollaborationToolsJson && formData.CollaborationToolsJson.length > 0 
        ? JSON.stringify(formData.CollaborationToolsJson) 
        : null,
      UpdatedOn: new Date(),
    };

    // Build PaymentMethodJson (masked + encrypted)
    // Always include PaymentMethodJson when updating to allow clearing bank details
    const pmArr = await buildPaymentMethodJsonFromForm(formData);
    if (pmArr) {
      dataToSend.PaymentMethodJson = JSON.stringify(pmArr);
    } else if (client) {
      // When updating and bank details are cleared, explicitly set to null to clear the field
      dataToSend.PaymentMethodJson = null;
    }
    // For new clients, if pmArr is null, PaymentMethodJson won't be included (which is fine)

    try {
      let savedClient;
      if (client) {
        savedClient = await updateClient(client.ClientID, dataToSend);
        setSnackbar({ open: true, message: 'Client updated successfully.', severity: 'success' });
      } else {
        savedClient = await addClient(dataToSend);
        setSnackbar({ open: true, message: 'Client added successfully.', severity: 'success' });
      }

      // Save contracts separately
      await saveContracts(savedClient.ClientID);
      
      refreshClients();
      onClose();
    } catch (error) {
      console.error('Error submitting client form:', error);
      setSnackbar({ open: true, message: 'Failed to submit the form. Please try again.', severity: 'error' });
    }
  };

  const formTitle = client ? 'Edit Client' : 'Add Client';


  return (
    <Modal open={true} onClose={onClose} customStyle={{ maxWidth: '80vw'}}>
      <Box sx={{ 
        width: '100%', 
        overflow: 'auto',
        fontSize: '0.85rem' 
      }}>
        {/* Title & Divider */}
        <Typography variant="h6" style={{ marginBottom: '0.25rem' }}>
          {formTitle}
        </Typography>
        {client && (
          <Typography variant="body2" style={{ marginBottom: '1rem' }}>
            {client.ClientName}
          </Typography>
        )}
        <Divider style={{ marginBottom: '1rem' }} />

        <form onSubmit={handleSubmit}>
          {/* Tabs */}
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
            <Tabs value={activeTab} onChange={handleTabChange}>
              <Tab label="General Information" />
              <Tab label="Contract Information" />
              <Tab label="Financial Information" />
            </Tabs>
          </Box>

          {/* Tab Content */}
          {activeTab === 0 && (
            <Grid container spacing={2} sx={{ maxHeight: '60vh', overflow: 'auto' }}>
              {/* Company Information Section */}
              <Grid item xs={12}>
                <Typography variant="h6" sx={{ mb: 2, mt: 1 }}>Company Information</Typography>
                <Divider sx={{ mb: 2 }} />
              </Grid>

              {/* Client Name */}
              <Grid item xs={12} sm={4} md={4}>
                <TextField
                  label="Client Name"
                  name="ClientName"
                  value={formData.ClientName}
                  onChange={handleChange}
                  fullWidth
                  required
                  variant="outlined"
                  size="small"
                  InputLabelProps={{ style: { fontSize: '0.85rem' } }}
                  InputProps={{ style: { fontSize: '0.85rem' } }}
                />
              </Grid>

              {/* Phone Number */}
              <Grid item xs={12} sm={4} md={4}>
                <TextField
                  label="Phone Number"
                  name="PhoneNumber"
                  value={formData.PhoneNumber}
                  onChange={handleChange}
                  fullWidth
                  variant="outlined"
                  size="small"
                  InputLabelProps={{ style: { fontSize: '0.85rem' } }}
                  InputProps={{ style: { fontSize: '0.85rem' } }}
                />
              </Grid>

              {/* Billing Email */}
              <Grid item xs={12} sm={4} md={4}>
                <TextField
                  label="Billing Email"
                  name="BillingEmail"
                  value={formData.BillingEmail}
                  onChange={handleChange}
                  fullWidth
                  type="email"
                  variant="outlined"
                  size="small"
                  InputLabelProps={{ style: { fontSize: '0.85rem' } }}
                  InputProps={{ style: { fontSize: '0.85rem' } }}
                />
              </Grid>

              {/* EIN */}
              <Grid item xs={12} sm={4} md={4}>
                <TextField
                  label="EIN"
                  name="EIN"
                  value={formData.EIN}
                  onChange={handleChange}
                  fullWidth
                  variant="outlined"
                  size="small"
                  placeholder="XX-XXXXXXX"
                  InputLabelProps={{ style: { fontSize: '0.85rem' } }}
                  InputProps={{ style: { fontSize: '0.85rem' } }}
                />
              </Grid>

              {/* Entity Type */}
              <Grid item xs={12} sm={4} md={4}>
                <FormControl fullWidth size="small">
                  <InputLabel style={{ fontSize: '0.85rem' }}>Entity Type</InputLabel>
                  <Select
                    name="EntityType"
                    value={formData.EntityType}
                    onChange={handleChange}
                    label="Entity Type"
                    style={{ fontSize: '0.85rem' }}
                  >
                    <MenuItem value="">None</MenuItem>
                    <MenuItem value="S Corp">S Corp</MenuItem>
                    <MenuItem value="C Corp">C Corp</MenuItem>
                    <MenuItem value="LLC">LLC</MenuItem>
                    <MenuItem value="Sole Proprietorship">Sole Proprietorship</MenuItem>
                    <MenuItem value="Other">Other</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Custom Entity (if Other selected) */}
              <Grid item xs={12} sm={4} md={4}>
                {formData.EntityType === 'Other' && (
                  
                    <TextField
                      label="Specify Entity"
                      name="CustomEntity"
                      value={formData.CustomEntity}
                      onChange={handleChange}
                      fullWidth
                      variant="outlined"
                      size="small"
                      InputLabelProps={{ style: { fontSize: '0.85rem' } }}
                      InputProps={{ style: { fontSize: '0.85rem' } }}
                    />
                  
                )}
              </Grid>

              {/* Primary Owner */}
              <Grid item xs={12} sm={4} md={4}>
                <TextField
                  label="Primary Owner"
                  name="PrimaryOwner"
                  value={formData.PrimaryOwner}
                  onChange={handleChange}
                  fullWidth
                  variant="outlined"
                  size="small"
                  InputLabelProps={{ style: { fontSize: '0.85rem' } }}
                  InputProps={{ style: { fontSize: '0.85rem' } }}
                />
              </Grid>

              {/* Primary Ownership % */}
              <Grid item xs={12} sm={2} md={2}>
                <TextField
                  label="Primary %"
                  name="PrimaryOwnershipPct"
                  value={formData.PrimaryOwnershipPct}
                  onChange={handleChange}
                  fullWidth
                  type="number"
                  variant="outlined"
                  size="small"
                  InputLabelProps={{ style: { fontSize: '0.85rem' } }}
                  InputProps={{ style: { fontSize: '0.85rem' }, inputProps: { min: 0, max: 100, step: 0.01 } }}
                />
              </Grid>

              {/* Secondary Owner */}
              <Grid item xs={12} sm={4} md={4}>
                <TextField
                  label="Secondary Owner"
                  name="SecondaryOwner"
                  value={formData.SecondaryOwner}
                  onChange={handleChange}
                  fullWidth
                  variant="outlined"
                  size="small"
                  InputLabelProps={{ style: { fontSize: '0.85rem' } }}
                  InputProps={{ style: { fontSize: '0.85rem' } }}
                />
              </Grid>

              {/* Secondary Ownership % */}
              <Grid item xs={12} sm={2} md={2}>
                <TextField
                  label="Secondary %"
                  name="SecondaryOwnershipPct"
                  value={formData.SecondaryOwnershipPct}
                  onChange={handleChange}
                  fullWidth
                  type="number"
                  variant="outlined"
                  size="small"
                  InputLabelProps={{ style: { fontSize: '0.85rem' } }}
                  InputProps={{ style: { fontSize: '0.85rem' }, inputProps: { min: 0, max: 100, step: 0.01 } }}
                />
              </Grid>

              {/* Address Line 1 */}
              <Grid item xs={12}>
                <TextField
                  label="Address Line 1"
                  name="AddressLine1"
                  value={formData.AddressLine1}
                  onChange={handleChange}
                  fullWidth
                  variant="outlined"
                  size="small"
                  InputLabelProps={{ style: { fontSize: '0.85rem' } }}
                  InputProps={{ style: { fontSize: '0.85rem' } }}
                />
              </Grid>

              {/* Address Line 2 */}
              <Grid item xs={12} sm={6} md={6}>
                <TextField
                  label="Address Line 2"
                  name="AddressLine2"
                  value={formData.AddressLine2}
                  onChange={handleChange}
                  fullWidth
                  variant="outlined"
                  size="small"
                  InputLabelProps={{ style: { fontSize: '0.85rem' } }}
                  InputProps={{ style: { fontSize: '0.85rem' } }}
                />
              </Grid>

              {/* Address Line 3 */}
              <Grid item xs={12} sm={6} md={6}>
                <TextField
                  label="Address Line 3"
                  name="AddressLine3"
                  value={formData.AddressLine3}
                  onChange={handleChange}
                  fullWidth
                  variant="outlined"
                  size="small"
                  InputLabelProps={{ style: { fontSize: '0.85rem' } }}
                  InputProps={{ style: { fontSize: '0.85rem' } }}
                />
              </Grid>

              {/* City */}
              <Grid item xs={12} sm={4} md={4}>
                <TextField
                  label="City"
                  name="City"
                  value={formData.City}
                  onChange={handleChange}
                  fullWidth
                  variant="outlined"
                  size="small"
                  InputLabelProps={{ style: { fontSize: '0.85rem' } }}
                  InputProps={{ style: { fontSize: '0.85rem' } }}
                />
              </Grid>

              {/* State */}
              <Grid item xs={12} sm={4} md={4}>
                <FormControl fullWidth size="small">
                  <InputLabel style={{ fontSize: '0.85rem' }}>State</InputLabel>
                  <Select
                    name="State"
                    value={formData.State}
                    onChange={handleChange}
                    label="State"
                    style={{ fontSize: '0.85rem' }}
                  >
                    <MenuItem value="">None</MenuItem>
                    {['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY',
                      'LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND',
                      'OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'].map(state => (
                      <MenuItem key={state} value={state}>{state}</MenuItem>
                    ))}
                    <MenuItem value="Other">Other</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Zip */}
              <Grid item xs={12} sm={4} md={4}>
                <TextField
                  label="Zip"
                  name="Zip"
                  value={formData.Zip}
                  onChange={handleChange}
                  fullWidth
                  variant="outlined"
                  size="small"
                  InputLabelProps={{ style: { fontSize: '0.85rem' } }}
                  InputProps={{ style: { fontSize: '0.85rem' } }}
                />
              </Grid>

              {/* Active Status */}
              <Grid item xs={12} sm={6} md={6}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.ActiveStatus}
                      onChange={handleChange}
                      name="ActiveStatus"
                      sx={{ '& .MuiSvgIcon-root': { fontSize: 18 } }}
                    />
                  }
                  label={<span style={{ fontSize: '0.85rem' }}>Active Status</span>}
                />
              </Grid>

              {/* Client Address (legacy field - keeping for backward compatibility) */}
              {/* <Grid item xs={12} sm={6} md={6}>
                <TextField
                  label="Client Address (Legacy)"
                  name="ClientAddress"
                  value={formData.ClientAddress}
                  onChange={handleChange}
                  fullWidth
                  variant="outlined"
                  size="small"
                  InputLabelProps={{ style: { fontSize: '0.85rem' } }}
                  InputProps={{ style: { fontSize: '0.85rem' } }}
                />
              </Grid> */}

              {/* Systems Section */}
              <Grid item xs={12}>
                <Typography variant="h6" sx={{ mb: 2, mt: 3 }}>Financial Systems</Typography>
                <Divider sx={{ mb: 2 }} />
              </Grid>

              {/* Financial Systems List */}
              {formData.FinancialSystemsJson && formData.FinancialSystemsJson.length > 0 && formData.FinancialSystemsJson.map((system, idx) => (
                <>
                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth size="small">
                      <InputLabel style={{ fontSize: '0.85rem' }}>System</InputLabel>
                      <Select
                        value={system.name || ''}
                        onChange={(e) => {
                          const updated = [...formData.FinancialSystemsJson];
                          updated[idx] = { ...updated[idx], name: e.target.value };
                          if (e.target.value !== 'Other') updated[idx].customName = '';
                          setFormData({ ...formData, FinancialSystemsJson: updated });
                        }}
                        label="System"
                        style={{ fontSize: '0.85rem' }}
                      >
                        <MenuItem value="">None</MenuItem>
                        {financialSystems.map(sys => (
                          <MenuItem key={sys} value={sys}>{sys}</MenuItem>
                        ))}
                        <MenuItem value="Other">Other</MenuItem>
                      </Select>
                    </FormControl>
                    {system.name === 'Other' && (
                      <TextField
                        label="Specify System"
                        value={system.customName || ''}
                        onChange={(e) => {
                          const updated = [...formData.FinancialSystemsJson];
                          updated[idx] = { ...updated[idx], customName: e.target.value };
                          setFormData({ ...formData, FinancialSystemsJson: updated });
                        }}
                        fullWidth
                        size="small"
                        sx={{ mt: 1 }}
                        InputLabelProps={{ style: { fontSize: '0.85rem' } }}
                        InputProps={{ style: { fontSize: '0.85rem' } }}
                      />
                    )}
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Notes"
                      value={system.notes || ''}
                      onChange={(e) => {
                        const updated = [...formData.FinancialSystemsJson];
                        updated[idx] = { ...updated[idx], notes: e.target.value };
                        setFormData({ ...formData, FinancialSystemsJson: updated });
                      }}
                      fullWidth
                      size="small"
                      InputLabelProps={{ style: { fontSize: '0.85rem' } }}
                      InputProps={{ style: { fontSize: '0.85rem' } }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={1}>
                    <Tooltip title={(() => {
                      const selectedName = system.name === 'Other' ? (system.customName || '').trim() : system.name;
                      const accessUrl = systemAccess[selectedName] || systemAccess[system.name] || null;
                      return accessUrl ? 'Open grant-access steps' : 'No public guide available';
                    })()}>
                      <span>
                        <IconButton
                          component={(() => {
                            const selectedName = system.name === 'Other' ? (system.customName || '').trim() : system.name;
                            const accessUrl = systemAccess[selectedName] || systemAccess[system.name] || null;
                            return accessUrl ? 'a' : 'button';
                          })()}
                          href={(() => {
                            const selectedName = system.name === 'Other' ? (system.customName || '').trim() : system.name;
                            return systemAccess[selectedName] || systemAccess[system.name] || undefined;
                          })()}
                          target={(() => {
                            const selectedName = system.name === 'Other' ? (system.customName || '').trim() : system.name;
                            return systemAccess[selectedName] || systemAccess[system.name] ? '_blank' : undefined;
                          })()}
                          rel={(() => {
                            const selectedName = system.name === 'Other' ? (system.customName || '').trim() : system.name;
                            return systemAccess[selectedName] || systemAccess[system.name] ? 'noopener' : undefined;
                          })()}
                          disabled={(() => {
                            const selectedName = system.name === 'Other' ? (system.customName || '').trim() : system.name;
                            return !(systemAccess[selectedName] || systemAccess[system.name]);
                          })()}
                          size="small"
                          aria-label="Open grant-access guide"
                        >
                          <OpenInNewIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Grid>
                  <Grid item xs={12} sm={1}>
                    <IconButton
                      onClick={() => {
                        const updated = formData.FinancialSystemsJson.filter((_, i) => i !== idx);
                        setFormData({ ...formData, FinancialSystemsJson: updated });
                      }}
                      size="small"
                      color="error"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Grid>
                </>
              ))}
              <Grid item xs={12}>
                <Button
                  startIcon={<AddIcon />}
                  onClick={() => {
                    setFormData({
                      ...formData,
                      FinancialSystemsJson: [...(formData.FinancialSystemsJson || []), { name: '', customName: '', notes: '' }]
                    });
                  }}
                  variant="outlined"
                  size="small"
                >
                  Add Financial System
                </Button>
              </Grid>

              {/* Collaboration Tools Section */}
              <Grid item xs={12}>
                <Typography variant="h6" sx={{ mb: 2, mt: 3 }}>Collaboration Tools</Typography>
                <Divider sx={{ mb: 2 }} />
              </Grid>

              {/* Collaboration Tools List */}
              {formData.CollaborationToolsJson && formData.CollaborationToolsJson.length > 0 && formData.CollaborationToolsJson.map((tool, idx) => (
                <>
                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth size="small">
                      <InputLabel style={{ fontSize: '0.85rem' }}>Tool</InputLabel>
                      <Select
                        value={tool.name || ''}
                        onChange={(e) => {
                          const updated = [...formData.CollaborationToolsJson];
                          updated[idx] = { ...updated[idx], name: e.target.value };
                          if (e.target.value !== 'Other') updated[idx].customName = '';
                          setFormData({ ...formData, CollaborationToolsJson: updated });
                        }}
                        label="Tool"
                        style={{ fontSize: '0.85rem' }}
                      >
                        <MenuItem value="">None</MenuItem>
                        {collaborationTools.map(t => (
                          <MenuItem key={t} value={t}>{t}</MenuItem>
                        ))}
                        <MenuItem value="Other">Other</MenuItem>
                      </Select>
                    </FormControl>
                    {tool.name === 'Other' && (
                      <TextField
                        label="Specify Tool"
                        value={tool.customName || ''}
                        onChange={(e) => {
                          const updated = [...formData.CollaborationToolsJson];
                          updated[idx] = { ...updated[idx], customName: e.target.value };
                          setFormData({ ...formData, CollaborationToolsJson: updated });
                        }}
                        fullWidth
                        size="small"
                        sx={{ mt: 1 }}
                        InputLabelProps={{ style: { fontSize: '0.85rem' } }}
                        InputProps={{ style: { fontSize: '0.85rem' } }}
                      />
                    )}
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Notes"
                      value={tool.notes || ''}
                      onChange={(e) => {
                        const updated = [...formData.CollaborationToolsJson];
                        updated[idx] = { ...updated[idx], notes: e.target.value };
                        setFormData({ ...formData, CollaborationToolsJson: updated });
                      }}
                      fullWidth
                      size="small"
                      InputLabelProps={{ style: { fontSize: '0.85rem' } }}
                      InputProps={{ style: { fontSize: '0.85rem' } }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={1}>
                    <Tooltip title={(() => {
                      const selectedName = tool.name === 'Other' ? (tool.customName || '').trim() : tool.name;
                      const accessUrl = systemAccess[selectedName] || systemAccess[tool.name] || null;
                      return accessUrl ? 'Open grant-access steps' : 'No public guide available';
                    })()}>
                      <span>
                        <IconButton
                          component={(() => {
                            const selectedName = tool.name === 'Other' ? (tool.customName || '').trim() : tool.name;
                            const accessUrl = systemAccess[selectedName] || systemAccess[tool.name] || null;
                            return accessUrl ? 'a' : 'button';
                          })()}
                          href={(() => {
                            const selectedName = tool.name === 'Other' ? (tool.customName || '').trim() : tool.name;
                            return systemAccess[selectedName] || systemAccess[tool.name] || undefined;
                          })()}
                          target={(() => {
                            const selectedName = tool.name === 'Other' ? (tool.customName || '').trim() : tool.name;
                            return systemAccess[selectedName] || systemAccess[tool.name] ? '_blank' : undefined;
                          })()}
                          rel={(() => {
                            const selectedName = tool.name === 'Other' ? (tool.customName || '').trim() : tool.name;
                            return systemAccess[selectedName] || systemAccess[tool.name] ? 'noopener' : undefined;
                          })()}
                          disabled={(() => {
                            const selectedName = tool.name === 'Other' ? (tool.customName || '').trim() : tool.name;
                            return !(systemAccess[selectedName] || systemAccess[tool.name]);
                          })()}
                          size="small"
                          aria-label="Open grant-access guide"
                        >
                          <OpenInNewIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Grid>
                  <Grid item xs={12} sm={1}>
                    <IconButton
                      onClick={() => {
                        const updated = formData.CollaborationToolsJson.filter((_, i) => i !== idx);
                        setFormData({ ...formData, CollaborationToolsJson: updated });
                      }}
                      size="small"
                      color="error"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Grid>
                </>
              ))}
              <Grid item xs={12}>
                <Button
                  startIcon={<AddIcon />}
                  onClick={() => {
                    setFormData({
                      ...formData,
                      CollaborationToolsJson: [...(formData.CollaborationToolsJson || []), { name: '', customName: '', notes: '' }]
                    });
                  }}
                  variant="outlined"
                  size="small"
                >
                  Add Collaboration Tool
                </Button>
              </Grid>

            </Grid>
          )}

          {activeTab === 1 && (
            <Box>
              {/* Add Contract Button */}
              <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">Contracts</Typography>
                <Button
                  startIcon={<AddIcon />}
                  onClick={addContract}
                  variant="outlined"
                  size="small"
                >
                  Add Contract
                </Button>
              </Box>

              {/* Contracts List */}
              <Box sx={{ maxHeight: '60vh', overflow: 'auto' }}>
                {contracts.map((contract, index) => {
                  // Check if contract is closed based on end reason only
                  const isClosed = contract.contractEndReason && contract.contractEndReason.trim() !== '';
                  
                  // Get display reason for closed contracts
                  const getClosedReason = () => {
                    if (isClosed) {
                      return contract.contractEndReason;
                    }
                    return '';
                  };
                  
                  // Generate meaningful contract label
                  const getContractLabel = () => {
                    const contractName = contract.contractName && contract.contractName.trim() 
                      ? contract.contractName.trim() 
                      : 'Untitled';
                    const contractType = contract.contractType || 'Project';
                    
                    return `${contractName} [${contractType}]`;
                  };
                  
                  return (
                  <Accordion 
                    key={contract.id} 
                    sx={{ 
                      mb: 2, 
                      border: '2px solid',
                      borderColor: index % 3 === 0 ? 'primary.main' 
                        : index % 3 === 1 ? 'secondary.main' 
                        : 'success.main',
                      borderRadius: 2,
                      '&:before': { display: 'none' },
                      boxShadow: 3
                    }}
                  >
                    <AccordionSummary
                      expandIcon={<ExpandMoreIcon />}
                      sx={{ 
                        backgroundColor: index % 3 === 0 ? 'primary.light' 
                          : index % 3 === 1 ? 'secondary.light' 
                          : 'success.light',
                        color: 'white',
                        fontWeight: 'bold',
                        borderRadius: '8px 8px 0 0'
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', pr: 2 }}>
                        <Box sx={{ flex: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'nowrap' }}>
                            <Typography 
                              variant="subtitle1" 
                              sx={{ 
                                fontWeight: 'bold',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}
                            >
                              {getContractLabel()}
                            </Typography>
                            {isClosed && (
                              <Chip 
                                label="CLOSED" 
                                size="small" 
                                color="error"
                                sx={{ 
                                  fontWeight: 'bold',
                                  fontSize: '0.7rem',
                                  height: '20px',
                                  flexShrink: 0
                                }}
                              />
                            )}
                          </Box>
                          <Typography variant="caption" sx={{ opacity: 0.9, display: 'block' }}>
                            {contract.contractStartDate ? `Start: ${contract.contractStartDate}` : 'No start date set'} 
                            {contract.contractEndDate && ` • End: ${contract.contractEndDate}`}
                            {isClosed && ` • Reason: ${getClosedReason()}`}
                          </Typography>
                        </Box>
                        <IconButton 
                          onClick={(e) => {
                            e.stopPropagation();
                            removeContract(contract.id);
                          }}
                          sx={{ 
                            color: 'white', 
                            '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' } 
                          }}
                          size="small"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails sx={{ p: 3 }}>
                      <Grid container spacing={2}>
                        {/* Line 1: Contract Name */}
                        <Grid item xs={12} sm={6}>
                          <TextField
                            label="Contract Name"
                            value={contract.contractName || ''}
                            onChange={(e) => updateContractField(contract.id, 'contractName', e.target.value)}
                            fullWidth
                            size="small"
                            placeholder="e.g., Q1 2024 Engagement, Annual Retainer"
                          />
                        </Grid>
                        
                        {/* Line 2: Contract Type Selection */}
                        <Grid item xs={12} sm={6}>
                          <FormControl fullWidth size="small">
                            <InputLabel>Contract Type</InputLabel>
                            <Select
                              value={contract.contractType || 'Project'}
                              onChange={(e) => updateContractField(contract.id, 'contractType', e.target.value)}
                              label="Contract Type"
                            >
                              <MenuItem value="Project">Project</MenuItem>
                              <MenuItem value="M&A">M&A</MenuItem>
                              <MenuItem value="Hourly">Hourly</MenuItem>
                              <MenuItem value="Recurring">Recurring</MenuItem>
                            </Select>
                          </FormControl>
                        </Grid>

                        {/* Revenue Section */}
                        <Grid item xs={12}>
                          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                            Revenue
                          </Typography>
                        </Grid>
                        
                        {contract.contractType === 'Project' && (
                          <>
                            <Grid item xs={12} sm={6}>
                              <TextField
                                label="Total Project Fee"
                                value={contract.totalProjectFee || ''}
                                onChange={(e) => updateContractField(contract.id, 'totalProjectFee', e.target.value)}
                                fullWidth
                                type="number"
                                size="small"
                                InputProps={{ inputProps: { min: 0, step: 0.01 } }}
                              />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                              <TextField
                                label="Onboarding Fee"
                                value={contract.onboardingFee || ''}
                                onChange={(e) => updateContractField(contract.id, 'onboardingFee', e.target.value)}
                                fullWidth
                                type="number"
                                size="small"
                                InputProps={{ inputProps: { min: 0, step: 0.01 } }}
                              />
                            </Grid>
                          </>
                        )}

                        {contract.contractType === 'M&A' && (
                          <>
                            <Grid item xs={12} sm={4}>
                              <TextField
                                label="Total Project Fee"
                                value={contract.totalProjectFee || ''}
                                onChange={(e) => updateContractField(contract.id, 'totalProjectFee', e.target.value)}
                                fullWidth
                                type="number"
                                size="small"
                                InputProps={{ inputProps: { min: 0, step: 0.01 } }}
                              />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                              <TextField
                                label="Percentage of Company Sale"
                                value={contract.percentageOfCompanySale || ''}
                                onChange={(e) => updateContractField(contract.id, 'percentageOfCompanySale', e.target.value)}
                                fullWidth
                                type="number"
                                size="small"
                                InputProps={{ inputProps: { min: 0, step: 0.01 } }}
                              />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                              <TextField
                                label="Onboarding Fee"
                                value={contract.onboardingFee || ''}
                                onChange={(e) => updateContractField(contract.id, 'onboardingFee', e.target.value)}
                                fullWidth
                                type="number"
                                size="small"
                                InputProps={{ inputProps: { min: 0, step: 0.01 } }}
                              />
                            </Grid>
                          </>
                        )}

                        {contract.contractType === 'Hourly' && (
                          <>
                            <Grid item xs={12} sm={4}>
                              <TextField
                                label="Monthly Fee (Low)"
                                value={contract.monthlyFeeLow || ''}
                                onChange={(e) => updateContractField(contract.id, 'monthlyFeeLow', e.target.value)}
                                fullWidth
                                type="number"
                                size="small"
                                InputProps={{ inputProps: { min: 0, step: 0.01 } }}
                              />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                              <TextField
                                label="Monthly Fee (High)"
                                value={contract.monthlyFeeHigh || ''}
                                onChange={(e) => updateContractField(contract.id, 'monthlyFeeHigh', e.target.value)}
                                fullWidth
                                type="number"
                                size="small"
                                InputProps={{ inputProps: { min: 0, step: 0.01 } }}
                              />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                              <TextField
                                label="Onboarding Fee"
                                value={contract.onboardingFee || ''}
                                onChange={(e) => updateContractField(contract.id, 'onboardingFee', e.target.value)}
                                fullWidth
                                type="number"
                                size="small"
                                InputProps={{ inputProps: { min: 0, step: 0.01 } }}
                              />
                            </Grid>
                          </>
                        )}

                        {contract.contractType === 'Recurring' && (
                          <>
                            <Grid item xs={12} sm={6}>
                              <TextField
                                label="Monthly Fee"
                                value={contract.monthlyFee || ''}
                                onChange={(e) => updateContractField(contract.id, 'monthlyFee', e.target.value)}
                                fullWidth
                                type="number"
                                size="small"
                                InputProps={{ inputProps: { min: 0, step: 0.01 } }}
                              />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                              <TextField
                                label="Onboarding Fee"
                                value={contract.onboardingFee || ''}
                                onChange={(e) => updateContractField(contract.id, 'onboardingFee', e.target.value)}
                                fullWidth
                                type="number"
                                size="small"
                                InputProps={{ inputProps: { min: 0, step: 0.01 } }}
                              />
                            </Grid>
                          </>
                        )}

                        {/* Contract Information Section */}
                        <Grid item xs={12}>
                          <Divider sx={{ my: 2 }} />
                          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                            Contract Information
                          </Typography>
                        </Grid>

                        {/* Contract Start Date and End Date in one line */}
                        <Grid item xs={12} sm={6}>
                          <TextField
                            label="Contract Start Date"
                            type="date"
                            value={contract.contractStartDate || ''}
                            onChange={(e) => updateContractField(contract.id, 'contractStartDate', e.target.value)}
                            fullWidth
                            size="small"
                            required
                            InputLabelProps={{ shrink: true }}
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            label="Contract End Date"
                            type="date"
                            value={contract.contractEndDate || ''}
                            onChange={(e) => updateContractField(contract.id, 'contractEndDate', e.target.value)}
                            fullWidth
                            size="small"
                            InputLabelProps={{ shrink: true }}
                          />
                        </Grid>

                        {/* Contract Length and Contract End Reason in one line */}
                        <Grid item xs={12} sm={6}>
                          <TextField
                            label="Contract Length (months)"
                            value={contract.contractLength || ''}
                            onChange={(e) => updateContractField(contract.id, 'contractLength', e.target.value)}
                            fullWidth
                            type="number"
                            size="small"
                            InputProps={{ inputProps: { min: 0 } }}
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <FormControl fullWidth size="small">
                            <InputLabel>Contract End Reason</InputLabel>
                            <Select
                              value={contract.contractEndReason || ''}
                              onChange={(e) => updateContractField(contract.id, 'contractEndReason', e.target.value)}
                              label="Contract End Reason"
                            >
                              <MenuItem value="">Select Reason</MenuItem>
                              <MenuItem value="Change in Scope – Retained">Change in Scope – Retained</MenuItem>
                              <MenuItem value="Service Completed – Satisfied">Service Completed – Satisfied</MenuItem>
                              <MenuItem value="Service Completed – Unsatisfied">Service Completed – Unsatisfied</MenuItem>
                              <MenuItem value="Client Engagement Issue">Client Engagement Issue</MenuItem>
                              <MenuItem value="Undesirable Customer">Undesirable Customer</MenuItem>
                              <MenuItem value="Agreement Termination">Agreement Termination</MenuItem>
                              <MenuItem value="Non-Payment">Non-Payment</MenuItem>
                              <MenuItem value="Other">Other</MenuItem>
                            </Select>
                          </FormControl>
                        </Grid>

                        {/* Staff Section */}
                        <Grid item xs={12}>
                          <Divider sx={{ my: 2 }} />
                          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                            Staff
                          </Typography>
                        </Grid>

                        {/* Assigned CFO and Rate in one line */}
                        <Grid item xs={12} sm={6}>
                          <Autocomplete
                            options={consultants}
                            getOptionLabel={(option) => formatConsultantDisplay(option)}
                            isOptionEqualToValue={(option, value) => 
                              option?.ConsultantID === value?.ConsultantID
                            }
                            value={getConsultantByName(contract.assignedCFO) || null}
                            onChange={(event, newValue) => {
                              const name = newValue ? `${newValue.FirstName || ''} ${newValue.LastName || ''}`.trim() : '';
                              updateContractField(contract.id, 'assignedCFO', name);
                            }}
                            renderInput={(params) => (
                              <TextField
                                {...params}
                                label="Assigned CFO"
                                size="small"
                                fullWidth
                              />
                            )}
                            size="small"
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            label={`Assigned CFO ${getRateLabel(contract.contractType)}`}
                            value={contract.assignedCFORate || ''}
                            onChange={(e) => updateContractField(contract.id, 'assignedCFORate', e.target.value)}
                            fullWidth
                            type="number"
                            size="small"
                            InputProps={{ inputProps: { min: 0, step: 0.01 } }}
                          />
                        </Grid>

                        {/* Assigned Controller and Rate in one line */}
                        <Grid item xs={12} sm={6}>
                          <Autocomplete
                            options={consultants}
                            getOptionLabel={(option) => formatConsultantDisplay(option)}
                            isOptionEqualToValue={(option, value) => 
                              option?.ConsultantID === value?.ConsultantID
                            }
                            value={getConsultantByName(contract.assignedController) || null}
                            onChange={(event, newValue) => {
                              const name = newValue ? `${newValue.FirstName || ''} ${newValue.LastName || ''}`.trim() : '';
                              updateContractField(contract.id, 'assignedController', name);
                            }}
                            renderInput={(params) => (
                              <TextField
                                {...params}
                                label="Assigned Controller"
                                size="small"
                                fullWidth
                              />
                            )}
                            size="small"
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            label={`Assigned Controller ${getRateLabel(contract.contractType)}`}
                            value={contract.assignedControllerRate || ''}
                            onChange={(e) => updateContractField(contract.id, 'assignedControllerRate', e.target.value)}
                            fullWidth
                            type="number"
                            size="small"
                            InputProps={{ inputProps: { min: 0, step: 0.01 } }}
                          />
                        </Grid>

                        {/* Assigned Senior Accountant and Rate in one line */}
                        <Grid item xs={12} sm={6}>
                          <Autocomplete
                            options={consultants}
                            getOptionLabel={(option) => formatConsultantDisplay(option)}
                            isOptionEqualToValue={(option, value) => 
                              option?.ConsultantID === value?.ConsultantID
                            }
                            value={getConsultantByName(contract.assignedSeniorAccountant) || null}
                            onChange={(event, newValue) => {
                              const name = newValue ? `${newValue.FirstName || ''} ${newValue.LastName || ''}`.trim() : '';
                              updateContractField(contract.id, 'assignedSeniorAccountant', name);
                            }}
                            renderInput={(params) => (
                              <TextField
                                {...params}
                                label="Assigned Senior Accountant"
                                size="small"
                                fullWidth
                              />
                            )}
                            size="small"
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            label={`Assigned Senior Accountant ${getRateLabel(contract.contractType)}`}
                            value={contract.assignedSeniorAccountantRate || ''}
                            onChange={(e) => updateContractField(contract.id, 'assignedSeniorAccountantRate', e.target.value)}
                            fullWidth
                            type="number"
                            size="small"
                            InputProps={{ inputProps: { min: 0, step: 0.01 } }}
                          />
                        </Grid>

                        {/* Additional Staff List */}
                        {(contract.additionalStaff || []).map((staff) => (
                          <Grid item xs={12} key={staff.id}>
                            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                              <Grid container spacing={2} sx={{ flex: 1 }}>
                                <Grid item xs={12} sm={4}>
                                  <Autocomplete
                                    options={consultants}
                                    getOptionLabel={(option) => formatConsultantDisplay(option)}
                                    isOptionEqualToValue={(option, value) => 
                                      option.ConsultantID === value.ConsultantID
                                    }
                                    value={getConsultantByName(staff.name) || null}
                                    onChange={(event, newValue) => {
                                      const name = newValue ? `${newValue.FirstName || ''} ${newValue.LastName || ''}`.trim() : '';
                                      updateAdditionalStaffField(contract.id, staff.id, 'name', name);
                                    }}
                                    renderInput={(params) => (
                                      <TextField
                                        {...params}
                                        label="Staff Name"
                                        size="small"
                                        fullWidth
                                      />
                                    )}
                                    size="small"
                                  />
                                </Grid>
                                <Grid item xs={12} sm={4}>
                                  <TextField
                                    label="Role"
                                    value={staff.role || ''}
                                    onChange={(e) => updateAdditionalStaffField(contract.id, staff.id, 'role', e.target.value)}
                                    fullWidth
                                    size="small"
                                  />
                                </Grid>
                                <Grid item xs={12} sm={4}>
                                  <TextField
                                    label={getRateLabel(contract.contractType)}
                                    value={staff.rate || ''}
                                    onChange={(e) => updateAdditionalStaffField(contract.id, staff.id, 'rate', e.target.value)}
                                    fullWidth
                                    type="number"
                                    size="small"
                                    InputProps={{ inputProps: { min: 0, step: 0.01 } }}
                                  />
                                </Grid>
                              </Grid>
                              <IconButton
                                onClick={() => removeAdditionalStaff(contract.id, staff.id)}
                                color="error"
                                size="small"
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Box>
                          </Grid>
                        ))}

                        {/* Add Additional Staff Button - Always at the bottom */}
                        <Grid item xs={12}>
                          <Button
                            startIcon={<AddIcon />}
                            onClick={() => addAdditionalStaff(contract.id)}
                            variant="outlined"
                            size="small"
                          >
                            Add Additional Staff
                          </Button>
                        </Grid>

                        {/* Software Section */}
                        <Grid item xs={12}>
                          <Divider sx={{ my: 2 }} />
                          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                            Software
                          </Typography>
                        </Grid>

                        {/* Assigned Software, Rate, and Quantity */}
                        <Grid item xs={12} sm={4}>
                          <TextField
                            label="Assigned Software"
                            value={contract.assignedSoftware || ''}
                            onChange={(e) => updateContractField(contract.id, 'assignedSoftware', e.target.value)}
                            fullWidth
                            size="small"
                          />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <TextField
                            label="Assigned Software Rate"
                            value={contract.assignedSoftwareRate || ''}
                            onChange={(e) => updateContractField(contract.id, 'assignedSoftwareRate', e.target.value)}
                            fullWidth
                            type="number"
                            size="small"
                            InputProps={{ inputProps: { min: 0, step: 0.01 } }}
                          />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <TextField
                            label="Quantity"
                            value={contract.assignedSoftwareQuantity || ''}
                            onChange={(e) => updateContractField(contract.id, 'assignedSoftwareQuantity', e.target.value)}
                            fullWidth
                            type="number"
                            size="small"
                            InputProps={{ inputProps: { min: 0, step: 1 } }}
                          />
                        </Grid>

                        {/* PDF Attachment Section */}
                        <Grid item xs={12}>
                          <Divider sx={{ my: 2 }} />
                          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                            Contract PDFs
                          </Typography>
                        </Grid>

                        <Grid item xs={12}>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                              <input
                                accept="application/pdf"
                                style={{ display: 'none' }}
                                id={`pdf-upload-${contract.id}`}
                                type="file"
                                onChange={async (e) => {
                                  const file = e.target.files[0];
                                  if (file && contract.ContractID) {
                                    try {
                                      const result = await uploadContractPDF(contract.ContractID, file);
                                      // Reload PDFs for this contract
                                      const pdfs = await getContractPDFs(contract.ContractID);
                                      updateContractField(contract.id, 'contractPDFs', pdfs);
                                      setSnackbar({
                                        open: true,
                                        message: 'PDF uploaded successfully',
                                        severity: 'success',
                                      });
                                    } catch (error) {
                                      setSnackbar({
                                        open: true,
                                        message: 'Failed to upload PDF',
                                        severity: 'error',
                                      });
                                    }
                                  } else if (!contract.ContractID) {
                                    setSnackbar({
                                      open: true,
                                      message: 'Please save the contract first before uploading PDF',
                                      severity: 'warning',
                                    });
                                  }
                                  e.target.value = ''; // Reset input
                                }}
                              />
                              <label htmlFor={`pdf-upload-${contract.id}`}>
                                <Button
                                  variant="outlined"
                                  component="span"
                                  startIcon={<AttachFileIcon />}
                                  size="small"
                                  disabled={!contract.ContractID}
                                >
                                  Upload PDF
                                </Button>
                              </label>
                            </Box>

                            {/* List of PDFs */}
                            {contract.contractPDFs && contract.contractPDFs.length > 0 && (
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                {contract.contractPDFs.map((pdf) => {
                                  const filename = pdf.FilePath.split('/').pop();
                                  return (
                                    <Box
                                      key={pdf.PDFID}
                                      sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1,
                                        p: 1,
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        borderRadius: 1,
                                      }}
                                    >
                                      <PictureAsPdfIcon color="error" />
                                      <Typography
                                        variant="body2"
                                        sx={{
                                          flex: 1,
                                          cursor: 'pointer',
                                          '&:hover': { textDecoration: 'underline' },
                                        }}
                                        onClick={() => {
                                          const pdfUrl = getContractPDFUrl(contract.ContractID, filename);
                                          window.open(pdfUrl, '_blank');
                                        }}
                                      >
                                        {pdf.FileName || filename}
                                      </Typography>
                                      <IconButton
                                        size="small"
                                        color="error"
                                        onClick={async () => {
                                          try {
                                            await deleteContractPDF(pdf.PDFID);
                                            // Reload PDFs for this contract
                                            const pdfs = await getContractPDFs(contract.ContractID);
                                            updateContractField(contract.id, 'contractPDFs', pdfs);
                                            setSnackbar({
                                              open: true,
                                              message: 'PDF deleted successfully',
                                              severity: 'success',
                                            });
                                          } catch (error) {
                                            setSnackbar({
                                              open: true,
                                              message: 'Failed to delete PDF',
                                              severity: 'error',
                                            });
                                          }
                                        }}
                                      >
                                        <DeleteIcon />
                                      </IconButton>
                                    </Box>
                                  );
                                })}
                              </Box>
                            )}
                          </Box>
                        </Grid>
                      </Grid>
                    </AccordionDetails>
                  </Accordion>
                  );
                })}
              </Box>

              {contracts.length === 0 && (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    No contracts added yet. Click "Add Contract" to get started.
                  </Typography>
                </Box>
              )}
            </Box>
          )}

          {activeTab === 2 && (
            <Grid container spacing={2}>
              {/* Business Information Section */}
              <Grid item xs={12}>
                <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold' }}>
                  Business Information
                </Typography>
              </Grid>

              {/* Accounting System */}
              <Grid item xs={12} sm={6} md={6}>
                <TextField
                  label="Accounting System"
                  name="AccountingSystem"
                  value={formData.AccountingSystem}
                  onChange={handleChange}
                  fullWidth
                  variant="outlined"
                  size="small"
                  InputLabelProps={{ style: { fontSize: '0.85rem' } }}
                  InputProps={{ style: { fontSize: '0.85rem' } }}
                />
              </Grid>

              {/* Revenue Range */}
              <Grid item xs={12} sm={6} md={6}>
                <TextField
                  label="Revenue Range"
                  name="RevenueRange"
                  value={formData.RevenueRange}
                  onChange={handleChange}
                  fullWidth
                  variant="outlined"
                  size="small"
                  InputLabelProps={{ style: { fontSize: '0.85rem' } }}
                  InputProps={{ style: { fontSize: '0.85rem' } }}
                />
              </Grid>

              {/* Industry (new Autocomplete) */}
              <Grid item xs={12} sm={6} md={6}>
                <Autocomplete
                  freeSolo
                  options={industries}
                  value={formData.Industry}
                  onChange={handleIndustryChange}
                  onBlur={handleIndustryBlur}
                  inputValue={formData.Industry}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Industry"
                      name="Industry"
                      variant="outlined"
                      size="small"
                      inputRef={industryInputRef}
                      InputLabelProps={{ style: { fontSize: '0.85rem' } }}
                      InputProps={{
                        ...params.InputProps,
                        style: { fontSize: '0.85rem' },
                      }}
                    />
                  )}
                />
              </Grid>

              {/* GrossProfitTarget (as an integer/%) */}
              <Grid item xs={12} sm={6} md={6}>
                <TextField
                  label="Gross Profit Target (%)"
                  name="GrossProfitTarget"
                  value={formData.GrossProfitTarget}
                  onChange={handleChange}
                  fullWidth
                  type="number"
                  variant="outlined"
                  size="small"
                  InputProps={{
                    style: { fontSize: '0.85rem' },
                    inputProps: { min: 0, step: 1 },
                  }}
                  InputLabelProps={{ style: { fontSize: '0.85rem' } }}
                />
              </Grid>

              {/* Banking Information Section */}
              <Grid item xs={12}>
                <Typography variant="subtitle2" sx={{ mb: 2, mt: 2, fontWeight: 'bold' }}>
                  Banking Details
                </Typography>
              </Grid>

              <Grid item xs={12} sm={6} md={6}>
                <TextField
                  label="Bank Name"
                  name="BankName"
                  value={formData.BankName}
                  onChange={handleChange}
                  fullWidth
                  variant="outlined"
                  size="small"
                  InputLabelProps={{ style: { fontSize: '0.85rem' } }}
                  InputProps={{ style: { fontSize: '0.85rem' } }}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={6}>
                <TextField
                  label="Bank Address"
                  name="BankAddress"
                  value={formData.BankAddress}
                  onChange={handleChange}
                  fullWidth
                  variant="outlined"
                  size="small"
                  InputLabelProps={{ style: { fontSize: '0.85rem' } }}
                  InputProps={{ style: { fontSize: '0.85rem' } }}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={6}>
                <TextField
                  label="Routing #"
                  name="BankRouting"
                  value={formData.BankRouting}
                  onChange={handleChange}
                  fullWidth
                  variant="outlined"
                  size="small"
                  InputLabelProps={{ style: { fontSize: '0.85rem' } }}
                  InputProps={{ style: { fontSize: '0.85rem' } }}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={6}>
                <TextField
                  label="Account #"
                  name="BankAccount"
                  value={formData.BankAccount}
                  onChange={handleChange}
                  fullWidth
                  variant="outlined"
                  size="small"
                  InputLabelProps={{ style: { fontSize: '0.85rem' } }}
                  InputProps={{ style: { fontSize: '0.85rem' } }}
                />
              </Grid>

              {/* Authorization Section */}
              <Grid item xs={12}>
                <Typography variant="subtitle2" sx={{ mb: 2, mt: 2, fontWeight: 'bold' }}>
                  Withdrawal Authorization
                </Typography>
              </Grid>

              <Grid item xs={12} sm={6} md={6}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.BankAuthorized}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, BankAuthorized: e.target.checked }))
                      }
                      sx={{ '& .MuiSvgIcon-root': { fontSize: 18 } }}
                    />
                  }
                  label={<span style={{ fontSize: '0.85rem' }}>Authorized for withdrawals</span>}
                />
              </Grid>

              {/* Show existing masked information if available */}
              {(formData.BankMaskedAccount || formData.BankMaskedRouting) && (
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">
                    On file:&nbsp;
                    {formData.BankMaskedAccount ? `Account ${formData.BankMaskedAccount}` : ''}
                    {formData.BankMaskedAccount && formData.BankMaskedRouting ? ' · ' : ''}
                    {formData.BankMaskedRouting ? `Routing ${formData.BankMaskedRouting}` : ''}
                  </Typography>
                </Grid>
              )}
            </Grid>
          )}

          {/* Submit Button - Always visible */}
          <Grid item xs={12} sx={{ mt: 3 }}>
            <div style={{ textAlign: 'right' }}>
              <Button type="submit" variant="contained" color="primary">
                {client ? 'Update' : 'Save'}
              </Button>
            </div>
          </Grid>
        </form>
      </Box>

      {/* Snackbar for user feedback */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Modal>
  );
};

export default ClientForm;
