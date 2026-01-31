// src/components/OnboardingPresentation.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js';
import InputMask from 'react-input-mask';
import {
  Box,
  Typography,
  TextField,
  Select,
  MenuItem,
  Button,
  Grid,
  Card,
  CardContent,
  IconButton,
  Fade,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  RadioGroup,
  FormControlLabel,
  Radio,
  Modal,
  Paper,
  FormControl,
  InputLabel,
  Tooltip,
  FormHelperText,
  InputAdornment,
  Snackbar,
  Alert,
  Checkbox,
} from '@mui/material';
import {
  Add as AddIcon,
  Remove as RemoveIcon,
  Edit as EditIcon,
  ExpandMore as ExpandMoreIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,

} from '@mui/icons-material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

import logo from '../../../assets/logo.png';
import { styled } from '@mui/material/styles';
import StepConnector, { stepConnectorClasses } from '@mui/material/StepConnector';
import { Stepper, Step, StepLabel, LinearProgress } from '@mui/material';
import { updateClientOnboardingStep, getClientById, updateClient } from '../../../api/clients';
import { getContactsByClient, createContact, updateContact, deleteContact } from '../../../api/contacts';
import debounce from 'lodash/debounce';

const STEPS = 8;

const stepLabels = [
  'Welcome',
  'Company',
  'Contacts',
  'Systems',
  'Payment',
  'Management',
  'FAQ',
  'Finish',
];

// --- Custom Stepper styles (connector + icon) ---
const ColorConnector = styled(StepConnector)(({ theme }) => ({
  [`& .${stepConnectorClasses.line}`]: {
    height: 2, // thinner
    border: 0,
    borderRadius: 2,
    background:
      'linear-gradient(90deg, rgba(37,107,169,1) 0%, rgba(94,158,209,1) 100%)',
    opacity: 0.65,
  },
}));

const ColorStepIconRoot = styled('div')(({ theme, ownerState }) => {
  const active = ownerState.active;
  const completed = ownerState.completed;
  return {
    background:
      completed || active
        ? 'linear-gradient(135deg, #256BA9 0%, #5E9ED1 100%)'
        : theme.palette.grey[300],
    color: completed || active ? '#fff' : theme.palette.text.secondary,
    zIndex: 1,
    width: 20,     // smaller icon
    height: 20,    // smaller icon
    display: 'flex',
    borderRadius: '50%',
    justifyContent: 'center',
    alignItems: 'center',
    fontSize: 12,  // smaller label inside icon
    fontWeight: 700,
    boxShadow: completed || active ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
    transition: 'all .2s ease',
  };
});

function ColorStepIcon(props) {
  const { active, completed, className, icon } = props;
  return (
    <ColorStepIconRoot ownerState={{ active, completed }} className={className}>
      {completed ? '✓' : icon}
    </ColorStepIconRoot>
  );
}

// ────────────────────────────────────────────────────────────
//   CONSTANTS
// ────────────────────────────────────────────────────────────

const timezoneOptions = [
  'Los Angeles',
  'Denver',
  'Chicago',
  'New York',
];


// MANAGEMENT TEAM DATA
const managementTeam = [
  {
    name: 'Brian Alvarez',
    title: 'Chief Executive Officer (MBA)',
    email: 'brian@cfo-worx.com',
    imageUrl: 'https://cfoworx.com/wp-content/uploads/2016/05/82nd-Picture-Alvarez-pdf-238x300.jpg'
  },
  {
    name: 'Sydney Judy',
    title: 'Operations Manager (MSIT and MBA)',
    email: 'sydney@cfo-worx.com',
    imageUrl: 'https://cfoworx.com/wp-content/uploads/2025/03/Sydney-1-300x298.png'
  },
  {
    name: 'Rodrigo Pezzi',
    title: 'CFO (MBA)',
    email: 'rodrigo@cfo-worx.com',
    imageUrl: 'https://cfoworx.com/wp-content/uploads/2016/05/Rodrigo-300x300.jpg'
  }
];


// ASSIGNED TEAM (placeholder)
const assignedTeam = [
  { name: 'John Smith', title: 'Senior Accountant' },
  { name: 'Jane Doe', title: 'Onboarding Specialist' },
  { name: 'Mike Johnson', title: 'Tax Consultant' },
  { name: 'Sarah Williams', title: 'Controller' },
];

// FAQS
const faqs = [
  {
    q: 'What happens next in the onboarding process?',
    a: 'As soon as our team has access to your accounting platform and shared drive (if applicable), we’ll start reviewing documents. We’ll also set up a 30-minute call to introduce your assigned team members.'
  },
  {
    q: 'Do I have a dedicated team, or does it change?',
    a: 'You’ll have a consistent team selected based on your company’s needs. We only make changes if you request them or if we need to adjust staffing.'
  },
  {
    q: 'What’s the best way to communicate with my CFO Worx team?',
    a: 'Email is preferred, but we’re flexible. Let us know your preferred platform during the intro call.'
  },
  {
    q: 'What time zone do you work in?',
    a: 'We’re remote but typically run on an EST schedule (9am–5pm EST). We can be flexible based on your company’s needs—just let us know what works best.'
  }
];


// Links to official "grant access / invite user" docs for each selectable app
export const systemAccess = {
  // Financial systems
  'FreshBooks': 'https://support.freshbooks.com/hc/en-us/articles/227346507-How-do-I-invite-and-manage-team-members',            // :contentReference[oaicite:0]{index=0}
  'NetSuite': 'https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_N285436.html',                              // :contentReference[oaicite:1]{index=1}
  'QuickBooks Online': 'https://quickbooks.intuit.com/learn-support/en-us/help-article/manage-users/add-manage-users-quickbooks-online/L1welhiJZ_US_en_US', // :contentReference[oaicite:2]{index=2}
  'QuickBooks Desktop': 'https://quickbooks.intuit.com/learn-support/en-us/help-article/multi-user-mode/hosting-company-data-multi-user-mode-quickbooks/L6vU3qBNE_US_en_US', // :contentReference[oaicite:3]{index=3}
  'Sage 50': 'https://gb-kb.sage.com/portal/app/portlets/results/view2.jsp?k2dockey=200804145851953',                            // :contentReference[oaicite:4]{index=4}
  'Sage Intacct': 'https://datel.info/hubfs/DTL-new/Resources/Intacct%20-%20Creating%20new%20users.pdf?hsLang=en',               // :contentReference[oaicite:5]{index=5}
  'SAP Business One': 'https://help.sap.com/docs/SAP_BUSINESS_ONE_ADMIN_GUIDE_HANA/1a2fc202f7f64336abf9fbc957d9b9ba/9f0740adb99b4714908f0c414ec36a8a.html?version=10.0_SP_2408', // :contentReference[oaicite:6]{index=6}
  'Wave': 'https://support.waveapps.com/hc/en-us/articles/208621236-Invite-or-remove-collaborators-from-your-business',          // :contentReference[oaicite:7]{index=7}
  'Xero': 'https://central.xero.com/s/article/Add-a-new-user-to-your-organisation-US',                                            // :contentReference[oaicite:8]{index=8}
  'Zoho Books': 'https://www.zoho.com/us/books/help/settings/users.html',
    // Additional ERP systems
  'Dynamics GP': 'https://learn.microsoft.com/en-us/troubleshoot/dynamics/gp/frequently-asked-questions-role-based-security',   // Access user security & roles setup guide – Tools → Setup → System → User Security :contentReference[oaicite:8]{index=8}
  'D365 Business Central': 'https://learn.microsoft.com/en-us/dynamics365/business-central/ui-how-users-permissions',        // Guide to adding users and assigning permissions via Microsoft 365 Admin Center :contentReference[oaicite:9]{index=9}
  'D365 Finance': 'https://learn.microsoft.com/en-us/dynamics365/fin-ops-core/dev-itpro/sysadmin/role-based-security',         // Role-based security overview and assigning security roles to users :contentReference[oaicite:10]{index=10}
                                                         // :contentReference[oaicite:9]{index=9}

  // Collaboration tools
  'Email': 'https://support.google.com/mail/answer/138350?hl=en',                                                                // Gmail delegation. :contentReference[oaicite:10]{index=10}
  'Google Meet': 'https://support.google.com/a/answer/33310?hl=en',                                                               // Add a Google Workspace user. :contentReference[oaicite:11]{index=11}
  'Microsoft Teams': 'https://support.microsoft.com/en-us/office/add-members-to-a-team-in-microsoft-teams-aff2249d-b456-4bc3-81e7-52327b6b38e9', // :contentReference[oaicite:12]{index=12}
  'Slack': 'https://slack.com/help/articles/201330256-Invite-new-members-to-your-workspace',                                     // :contentReference[oaicite:13]{index=13}
  'Zoom': 'https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0061789',                                           // Manage/add users. :contentReference[oaicite:14]{index=14}
  'Phone': null // no universal doc — varies by carrier/PBX. Button will be disabled.
};



export default function OnboardingPresentation({
  onFinish,
  clientId,
  onboardingStep,    // new incoming step (number or string)
  onStepChange,      // callback to bubble changes upstream
}) {

  // slide idx
// slide idx (seeded from prop)
const normalize = (v) => {
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
};
// migrate: if value came from the old 9-step flow, shift >=5 down by 1
const migrateOldIndex = (n) => (n >= 5 ? n - 1 : n);
const initialStep = migrateOldIndex(normalize(onboardingStep));
const [step, setStep] = useState(initialStep);

// sync if parent-provided onboardingStep changes
useEffect(() => {
    const normalized = migrateOldIndex(normalize(onboardingStep));
  if (normalized !== step) setStep(normalized);
}, [onboardingStep]);

// ─── Updated goNext with Slide 2 guard ─────────────────

// ─── Updated goNext with full Slide 2 validation ─────────────────

// ── Updated goNext with sequential validation, local state update, and server persist ────────────────────────
const goNext = async () => {
  // Slide 1 (index 1) validation: require all core company fields
  if (step === 1) {
    const errors = {
      name: !company.name.trim(),
      phone: !company.phone?.trim(),
      ein: !company.ein?.trim(),
      structure: !company.structure,
      customStructure:
        company.structure === 'Other'
          ? !(company.customStructure || '').trim()
          : false,
      owner: !company.owner?.trim(),
      primaryPct:
        company.primaryPct === '' || company.primaryPct === null,
      address1: !company.address1?.trim(),
      city: !company.city?.trim(),
      state: !company.state,
      customState:
        company.state === 'Other'
          ? !(company.customState || '').trim()
          : false,
      zip: !company.zip?.trim(),
    };
    setCompanyErrors(errors);
    if (Object.values(errors).some(v => v)) {
      return; // block progression
    }
  }

  // Slide 2 (index 2) validation: at least one contact, all fields filled
  if (step === 2) {
    const noContacts = contacts.length === 0;
    const incompleteContact = contacts.some(c =>
      !c.name.trim() ||
      !c.title.trim() ||
      !c.email.trim() ||
      !c.phone.trim() ||
      !c.tz
    );
    if (noContacts || incompleteContact) {
      setSnackbarOpen(true);
      return; // block progression
    }
  }

  // Slide 3 (index 3) validation: systems + collaboration tools
  if (step === 3) {
    const noSystems = systems.length === 0;
    const incompleteSystem = systems.some(sys =>
      !sys.name ||
      (sys.name === 'Other' && !(sys.customName || '').trim())
    );
    const noComms = comms.length === 0;
    const incompleteComm = comms.some(tool =>
      !tool.name ||
      (tool.name === 'Other' && !(tool.customName || '').trim())
    );
    if (noSystems || incompleteSystem || noComms || incompleteComm) {
      setSnackbarOpen(true);
      return; // block progression
    }
  }

  // Slide 5 (index 4) validation: exactly one payment method
  if (step === 4) {
    if (paymentMethods.length !== 1) {
      setSnackbarOpen(true);
      return; // block progression
    }
  }

  // All validations passed → compute the next step index
  const next = Math.min(step + 1, STEPS - 1);

  // 1) Update local UI
  setStep(next);
  if (onStepChange) {
    onStepChange(next);
  }

  // 2) Persist to server (using your PATCH `/clients/:id/onboarding-step` endpoint)
  if (clientId) {
    try {
      // use 99 in DB when they click Finish (last slide)
      const dbValue = next === STEPS - 1 ? 99 : next;
      await updateClientOnboardingStep(clientId, dbValue);
    } catch (err) {
      console.error('Failed to persist next step', err);
    }
  }
};




const goBack = async () => {
  setStep((s) => {
    const prev = Math.max(s - 1, 0);
    if (onStepChange) onStepChange(prev);
    return prev;
  });

  if (clientId != null) {
    try {
      await updateClientOnboardingStep(clientId, Math.max(step - 1, 0));
    } catch (e) {
      console.error('Failed to persist previous step', e);
    }
  }
};


  // freeze body scroll while overlay is up
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => (document.body.style.overflow = prev);
  }, []);

  /* ─── DATA STATE ────────────────────────────────────────── */
  // ─── COMPANY STATE & INITIAL LOAD ────────────────────────
  const [company, setCompany] = useState({
    name: '',
    structure: '',
    customStructure: '',
    owner: '',
    primaryPct: '',
    secondaryOwner: '',
    secondaryPct: '',
    address1: '',
    address2: '',
    address3: '',
    city: '',
    state: '',
    customState: '',
    zip: '',
    phone: '',
    ein: ''
  });

useEffect(() => {
  if (!clientId) return;
  getClientById(clientId)
    .then(data => {
      // Company mapping (as before)
      setCompany({
        name: data.ClientName || '',
        phone: data.PhoneNumber || '',
        structure: data.EntityType || '',
        customStructure: data.CustomEntity || '',
        owner: data.PrimaryOwner || '',
        primaryPct: data.PrimaryOwnershipPct != null ? String(data.PrimaryOwnershipPct) : '',
        secondaryOwner: data.SecondaryOwner || '',
        secondaryPct: data.SecondaryOwnershipPct != null ? String(data.SecondaryOwnershipPct) : '',
        address1: data.AddressLine1 || '',
        address2: data.AddressLine2 || '',
        address3: data.AddressLine3 || '',
        city: data.City || '',
        state: data.State || '',
        customState: '',
        zip: data.Zip || '',
        ein: data.EIN || ''
      });

      // Contacts - Load from Contact table
      getContactsByClient(clientId)
        .then(dbContacts => {
          if (dbContacts && dbContacts.length > 0) {
            const mappedContacts = dbContacts.map(c => ({
              contactId: c.ContactID,
              name: c.Name || '',
              title: c.Title || '',
              email: c.Email || '',
              phone: c.PhoneNumber || '',
              tz: c.Timezone || '',
            }));
            setContacts(mappedContacts);
          } else {
            setContacts([{ contactId: null, name:'', title:'', email:'', phone:'', tz:'' }]);
          }
        })
        .catch(error => {
          console.error('Error loading contacts:', error);
          setContacts([{ contactId: null, name:'', title:'', email:'', phone:'', tz:'' }]);
        });

      // Financial Systems
      const fromDbSystems = parseArrayJson(data?.FinancialSystemsJson);
      if (fromDbSystems && fromDbSystems.length) {
        setSystems(fromDbSystems);
      } else {
        setSystems([{ name: '', customName: '', notes: '' }]);
      }

            // Payment Method(s)
      const fromDbPM = parsePaymentMethodJson(data?.PaymentMethodJson);
      if (fromDbPM && fromDbPM.length) {
        // Only support single method as your UI enforces exactly one
        setPaymentMethods(fromDbPM);
      } else {
        setPaymentMethods([]); // start empty
      }

      // Collaboration Tools
      const fromDbComms = parseArrayJson(data?.CollaborationToolsJson);
      if (fromDbComms && fromDbComms.length) {
        setComms(fromDbComms);
      } else {
        setComms([{ name: '', customName: '', notes: '' }]);
      }
    })
    .catch(error => {
      console.error('Error loading client:', error);
    });
}, [clientId]);



  const [contacts, setContacts] = useState([{ contactId: null, name:'', title:'', email:'', phone:'', tz:'' }]);
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  const handleRemove = (idx) => {
  if (contacts.length === 1) {
    setSnackbarOpen(true);
  } else {
    const updatedContacts = contacts.filter((_, i) => i !== idx);
    setContacts(updatedContacts);
    saveContactsNow(updatedContacts);
  }
};

const handleAdd = () => {
  const newContacts = [
    ...contacts,
    { contactId: null, name:'', title:'', email:'', phone:'', tz:'' }
  ];
  setContacts(newContacts);
};


// Holds the list of added payment methods
// inside OnboardingPresentation:
const stripe = useStripe();
const elements = useElements();

// replace the previous payment-method state hooks with:
const [paymentMethods, setPaymentMethods] = useState([]);

// The row currently being edited (or null if none)
const [editingMethod, setEditingMethod] = useState(null);

// “Go/no-go” toggle to unblock the Next button
const [allAdded, setAllAdded] = useState(false);

  const [systems,  setSystems]  = useState([{ name:'', entities:'', usage:'' }]);
  const [comms,    setComms]    = useState([{ name:'', usage:'' }]);
  const [bankList, setBankList] = useState([]);        // collapsed list view
  const [bankForm, setBankForm] = useState(null);      // object when adding / editing

  const entityOptions = ['S Corp', 'C Corp', 'LLC', 'Sole Proprietorship', 'Other'];
  const countryOptions = ['United States', 'Canada', 'Mexico', 'Other'];
  const usStates = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY',
  'LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND',
  'OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'
];
  /* ───────────────────────────────────────────────────────── */

 const [companyErrors, setCompanyErrors] = useState({
  name: false,
  phone: false,
  ein: false,
  structure: false,
  customStructure: false, // only relevant if structure === 'Other'
  owner: false,
  primaryPct: false,
  address1: false,
  city: false,
  state: false,
  customState: false, // if state === 'Other'
  zip: false,
});

  /* helpers */
  const DualUnderline = ({ children }) => (
    <Box mb={1}>
      <Typography variant="h5" fontWeight={600}>{children}</Typography>
      <Box
        sx={{
          height: 3, bgcolor: '#256BA9', width: 56, mb: .5,
          '&::after': { content:'""', display:'block', height:1, bgcolor:'#256BA9', width:32, mt:.5 },
        }}
      />
    </Box>
  );

  /* ── Slide 1 helpers: put these INSIDE the component, above the return ── */
const onlyDigits = (s) => (s || '').replace(/\D+/g, '');
const toNumberOrNull = (v) => {
  const str = String(v || '').trim();
  if (str === '') return null;
  const n = Number(str);
  return Number.isFinite(n) ? n : null;
};

// Debounced patch saver. Batches rapid edits into a single API call.
const debouncedSave = useMemo(() => debounce(async (patch) => {
  if (!clientId) return;
  try {
    await updateClient(clientId, { ...patch });
  } catch (e) {
    console.error('Autosave failed', e);
  }
}, 600), [clientId]);

useEffect(() => () => debouncedSave.cancel(), [debouncedSave]);

// Convenience wrappers so handlers read cleanly:
const saveNow = async (patch) => {
  if (!clientId) return;
  try { await updateClient(clientId, patch); } catch (e) { console.error(e); }
};
const saveSoon = (patch) => debouncedSave(patch);


// ─── Contacts helpers ───────────────────────────────────────────────────
const cleanStr = (s) => (s ?? '').toString();

const serializeContacts = (arr) => {
  try { return JSON.stringify(arr || []); } catch { return '[]'; }
};

const parseContactsJson = (s) => {
  if (!s) return null;
  try {
    const parsed = JSON.parse(s);
    return Array.isArray(parsed)
      ? parsed.map(c => ({
          name: cleanStr(c.name),
          title: cleanStr(c.title),
          email: cleanStr(c.email),
          phone: cleanStr(c.phone),
          tz: cleanStr(c.tz),
        }))
      : null;
  } catch {
    return null;
  }
};

// Save contacts to Contact table
const saveContactsNow = async (contactsArray) => {
  if (!clientId) return;
  
  try {
    // Get current contacts from database
    const dbContacts = await getContactsByClient(clientId);
    const dbContactsMap = new Map();
    dbContacts.forEach(c => {
      dbContactsMap.set(c.ContactID, c);
    });

    // Process each contact in the array and collect updates
    const updatedContacts = [...contactsArray];
    let needsStateUpdate = false;

    for (let i = 0; i < updatedContacts.length; i++) {
      const contact = updatedContacts[i];
      const contactData = {
        Name: contact.name || '',
        Title: contact.title || '',
        Email: contact.email || '',
        PhoneNumber: contact.phone || '',
        Timezone: contact.tz || '',
      };

      if (contact.contactId && dbContactsMap.has(contact.contactId)) {
        // Update existing contact
        await updateContact(clientId, contact.contactId, {
          ...contactData,
          UpdatedOn: new Date(),
        });
      } else {
        // Create new contact
        const newContact = await createContact(clientId, {
          ...contactData,
          CreatedOn: new Date(),
          UpdatedOn: new Date(),
        });
        
        // Update the contactId in the local array
        if (newContact && newContact.ContactID) {
          updatedContacts[i] = { ...contact, contactId: newContact.ContactID };
          needsStateUpdate = true;
        }
      }
    }

    // Update state if any new contactIds were assigned
    if (needsStateUpdate) {
      setContacts(updatedContacts);
    }

    // Delete contacts that were removed from the array
    const currentContactIds = new Set(
      updatedContacts
        .map(c => c.contactId)
        .filter(id => id !== null)
    );

    for (const dbContact of dbContacts) {
      if (!currentContactIds.has(dbContact.ContactID)) {
        await deleteContact(clientId, dbContact.ContactID);
      }
    }
  } catch (e) {
    console.error('Contacts save failed', e);
  }
};

const debouncedContactsSave = useMemo(
  () => debounce(async (contactsArray) => {
    await saveContactsNow(contactsArray);
  }, 600),
  [clientId]
);

useEffect(() => () => debouncedContactsSave.cancel(), [debouncedContactsSave]);

const saveContactsSoon = (arr) => debouncedContactsSave(arr);



// ─── Slide 3 helpers ──────────────────────────────────────────────────────
const serializeArray = (arr) => {
  try { return JSON.stringify(arr || []); } catch { return '[]'; }
};
const parseArrayJson = (s) => {
  if (!s) return null;
  try {
    const parsed = JSON.parse(s);
    return Array.isArray(parsed)
      ? parsed.map(x => ({
          name: x.name || '',
          customName: x.customName || '',
          notes: x.notes || ''
        }))
      : null;
  } catch { return null; }
};

// Debouncers
const debouncedSystemsSave = useMemo(() => debounce(async (jsonStr) => {
  if (!clientId) return;
  try { await updateClient(clientId, { FinancialSystemsJson: jsonStr }); }
  catch (e) { console.error('FinancialSystems save failed', e); }
}, 600), [clientId]);

const debouncedCommsSave = useMemo(() => debounce(async (jsonStr) => {
  if (!clientId) return;
  try { await updateClient(clientId, { CollaborationToolsJson: jsonStr }); }
  catch (e) { console.error('CollaborationTools save failed', e); }
}, 600), [clientId]);

useEffect(() => () => {
  debouncedSystemsSave.cancel();
  debouncedCommsSave.cancel();
}, [debouncedSystemsSave, debouncedCommsSave]);

// Save wrappers
const saveSystemsSoon = (arr) => debouncedSystemsSave(serializeArray(arr));
const saveSystemsNow  = async (arr) => {
  if (!clientId) return;
  try { await updateClient(clientId, { FinancialSystemsJson: serializeArray(arr) }); }
  catch (e) { console.error('Systems save failed', e); }
};

const saveCommsSoon = (arr) => debouncedCommsSave(serializeArray(arr));
const saveCommsNow  = async (arr) => {
  if (!clientId) return;
  try { await updateClient(clientId, { CollaborationToolsJson: serializeArray(arr) }); }
  catch (e) { console.error('Comms save failed', e); }
};



// ─── Payment Method helpers (shared-passphrase first, with fallback) ─────────

// 1) JSON (de)serializers
const serializePaymentMethods = (arr) => {
  try { return JSON.stringify(arr || []); } catch { return '[]'; }
};
const parsePaymentMethodJson = (s) => {
  if (!s) return null;
  try {
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) ? parsed : null;
  } catch { return null; }
};

// 2) Save debouncers
const debouncedPaymentSave = useMemo(
  () => debounce(async (jsonStr) => {
    if (!clientId) return;
    try {
      await updateClient(clientId, { PaymentMethodJson: jsonStr });
    } catch (e) {
      console.error('PaymentMethodJson autosave failed', e);
    }
  }, 600),
  [clientId]
);

useEffect(() => () => debouncedPaymentSave.cancel(), [debouncedPaymentSave]);

const savePaymentMethodsSoon = (arr) => debouncedPaymentSave(serializePaymentMethods(arr));
const savePaymentMethodsNow  = async (arr) => {
  if (!clientId) return;
  try {
    const jsonStr = serializePaymentMethods(arr);
    await updateClient(clientId, { PaymentMethodJson: jsonStr });
  } catch (e) {
    console.error('PaymentMethodJson save failed', e);
  }
};

// 3) Crypto utils
const textEnc = new TextEncoder();
const textDec = new TextDecoder();

const SHARED_PASS = import.meta.env.VITE_PM_LEGACY_PASSPHRASE || ''; // "iamjordan"
const SHARED_SALT = import.meta.env.VITE_PM_LEGACY_SALT || 'cfoworx:pm';

// base64 helpers
const b64 = (u8) => btoa(String.fromCharCode(...u8));
const fromB64 = (s) => Uint8Array.from(atob(s), c => c.charCodeAt(0));

// Ensure a persistent client-side secret for local encryption (fallback)
const ensureLocalSecret = () => {
  try {
    const KEY_NAME = 'pm_secret_v1';
    let secret = localStorage.getItem(KEY_NAME);
    if (!secret) {
      const bytes = crypto?.getRandomValues?.(new Uint8Array(32));
      if (bytes) {
        secret = b64(bytes);
        localStorage.setItem(KEY_NAME, secret);
      }
    }
    return secret || null;
  } catch {
    return null;
  }
};

// Derive AES-GCM CryptoKey from the local secret + clientId salt (fallback)
const deriveEphemeralKey = async (secretB64, saltStr) => {
  if (!window.crypto?.subtle) return null;
  try {
    const raw = fromB64(secretB64);
    const baseKey = await crypto.subtle.importKey('raw', raw, { name: 'PBKDF2' }, false, ['deriveKey']);
    return await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: textEnc.encode(`cfoworx:${saltStr}`), iterations: 120000, hash: 'SHA-256' },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt','decrypt']
    );
  } catch { return null; }
};

// Get shared passphrase key (preferred path)
const getSharedKey = async () => {
  if (!SHARED_PASS || !window.crypto?.subtle) return null;
  try {
    const baseKey = await crypto.subtle.importKey(
      'raw',
      textEnc.encode(SHARED_PASS),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
    return await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: textEnc.encode(SHARED_SALT), iterations: 100000, hash: 'SHA-256' },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt','decrypt']
    );
  } catch { return null; }
};

// AES-GCM helpers
const aesGcmEncryptWith = async (key, plaintext) => {
  try {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, textEnc.encode(plaintext));
    return { iv: b64(iv), data: b64(new Uint8Array(ct)) };
  } catch { return null; }
};
const aesGcmDecryptWith = async (key, obj) => {
  try {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(obj.iv) }, key, fromB64(obj.data));
    return textDec.decode(new Uint8Array(pt));
  } catch { return null; }
};

// 4) Sanitizers
const onlyDigitsBank = (s) => (s || '').replace(/\D+/g, '');

// 5) Decrypt helper (for future edit flows if you ever allow editing)
const tryDecryptBank = async (pm) => {
  if (!pm?.enc) return null;

  // v2 shared: {account:{data,iv}, routing:{data,iv}, algo:'AES-GCM-256/shared', v:2}
  if (pm.enc.account?.data && pm.enc.account?.iv && pm.enc.routing?.data && pm.enc.routing?.iv) {
    const shared = await getSharedKey();
    if (shared) {
      const a = await aesGcmDecryptWith(shared, pm.enc.account);
      const r = await aesGcmDecryptWith(shared, pm.enc.routing);
      if (a && r) return { account: a, routing: r };
    }
    // fallback to v1-style derivation if these fields accidentally came from v1
    const secret = ensureLocalSecret();
    const ephKey = secret ? await deriveEphemeralKey(secret, clientId || 'global') : null;
    if (ephKey) {
      const a = await aesGcmDecryptWith(ephKey, pm.enc.account);
      const r = await aesGcmDecryptWith(ephKey, pm.enc.routing);
      if (a && r) return { account: a, routing: r };
    }
  }

  // v1 legacy: account/accountIV & routing/routingIV (strings)
  if (pm.enc.account && pm.enc.accountIV && pm.enc.routing && pm.enc.routingIV) {
    const shared = await getSharedKey();
    if (shared) {
      const a = await aesGcmDecryptWith(shared, { data: pm.enc.account, iv: pm.enc.accountIV });
      const r = await aesGcmDecryptWith(shared, { data: pm.enc.routing, iv: pm.enc.routingIV });
      if (a && r) return { account: a, routing: r };
    }
    const secret = ensureLocalSecret();
    const ephKey = secret ? await deriveEphemeralKey(secret, clientId || 'global') : null;
    if (ephKey) {
      const a = await aesGcmDecryptWith(ephKey, { data: pm.enc.account, iv: pm.enc.accountIV });
      const r = await aesGcmDecryptWith(ephKey, { data: pm.enc.routing, iv: pm.enc.routingIV });
      if (a && r) return { account: a, routing: r };
    }
  }

  return null;
};

// 6) Build stored BANK object (prefers shared passphrase)
const buildStoredBankPM = async (editing) => {
  const acctRaw = onlyDigitsBank(String(editing.account || ''));
  const routingRaw = onlyDigitsBank(String(editing.routing || ''));
  const last4 = acctRaw.slice(-4);
  const routingLast2 = routingRaw.slice(-2);

  let enc = null;
  try {
    // Preferred: shared passphrase
    const sharedKey = await getSharedKey();
    if (sharedKey && acctRaw && routingRaw) {
      const encAcct = await aesGcmEncryptWith(sharedKey, acctRaw);
      const encRouting = await aesGcmEncryptWith(sharedKey, routingRaw);
      if (encAcct && encRouting) {
        enc = { account: encAcct, routing: encRouting, algo: 'AES-GCM-256/shared', v: 2 };
      }
    }

    // Fallback: per-device key
    if (!enc && acctRaw && routingRaw) {
      const secret = ensureLocalSecret();
      const ephKey = secret ? await deriveEphemeralKey(secret, clientId || 'global') : null;
      if (ephKey) {
        const encAcct = await aesGcmEncryptWith(ephKey, acctRaw);
        const encRouting = await aesGcmEncryptWith(ephKey, routingRaw);
        if (encAcct && encRouting) {
          enc = {
            account: encAcct.data, accountIV: encAcct.iv,
            routing: encRouting.data, routingIV: encRouting.iv,
            algo: 'AES-GCM-256/PBKDF2',
            v: 1
          };
        }
      }
    }
  } catch (e) {
    console.warn('Encryption skipped (non-fatal):', e);
  }

  return {
    type: 'Bank',
    bankName: (editing.bankName || '').trim(),
    address: (editing.address || '').trim(),
    authorized: !!editing.authorized,
    // presentation
    last4,
    routingLast2,
    maskedAccount: last4 ? `••••${last4}` : '••••',
    maskedRouting: routingLast2 ? `••••••${routingLast2}` : '••••••',
    // encrypted payload (optional)
    enc, // may be null if crypto unavailable
  };
};



  // ╔══════════════════════════════════════════════════════╗
  // ║                       RENDER                        ║
  // ╚══════════════════════════════════════════════════════╝
  return (
    <Box
      position="fixed"
      top={0} left={0} width="100vw" height="100vh"
      display="flex" alignItems="center" justifyContent="center"
      sx={{
        background: 'linear-gradient(135deg,#256BA9 0%,#5E9ED1 100%)',
        zIndex: 1300,
      }}
    >
      {/* CARD FRAME (fixed size) */}
      <Card
        elevation={10}
        sx={{
          width: { xs: '94%', md: '60%' },
          height: { xs: '85vh', md: '90vh' },
          display: 'flex', flexDirection: 'column',
          px: 4, py: 3, position: 'relative',
        }}
      >
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
  <Box component="img" src={logo} alt="logo" sx={{ height: 44 }} />
  {clientId && (
    <Typography
      variant="caption"
      sx={{ color: 'text.secondary', fontWeight: 500 }}
    >
      Client ID: {clientId}
    </Typography>
  )}
</Box>
        <Divider sx={{ mb: 2 }} />

        {/* CONTENT */}
        <Box
          flex={1}
          display="flex"
          flexDirection="column"
          px={1}
          sx={{ overflowY: 'auto' }}
        >
          <Fade in timeout={400}>
            <Box
              key={step}
              width="100%"
              maxWidth={750}
              mx="auto"
              display="flex"
              flexDirection="column"
            >
              {/* ---------------------------- Slide 0 --------------------------- */}
              {step === 0 && (
                <Box textAlign="center" sx={{ py: 4 }}>
                  {/* Business-Professional Word-Art Title */}
                  <Typography
                    variant="h2"
                    sx={{
                      fontFamily: '"Montserrat", sans-serif',
                      fontWeight: 700,
                      color: '#256BA9',  // navy blue
                      letterSpacing: 1,
                      mb: 2,
                      textTransform: 'uppercase',
                    }}
                  >
                    Welcome to CFO Worx
                  </Typography>

                  {/* CEO Introduction */}
                  <Typography
                    variant="body1"
                    color="text.secondary"
                    sx={{ mb: 2, px: { xs: 2, md: 0 } }}
                  >
                    We’re glad you’re here. Our team looks forward to getting to know your business and building a strong working relationship. 
                    This onboarding process is designed to make it easy to share the key details we’ll need, all in one secure location.
                    <br />
                    You’ll be guided through a few sections in order:
                  </Typography>

                  {/* Styled Bullet List */}
                  <Box sx={{ display: 'inline-block', textAlign: 'left' }}>
                    {[
                      'About your company',
                      'Important contacts',
                      'Systems you use',
                      'Banking details',
                      'Our management team',
                      'FAQ'
                    ].map((item, i) => (
                      <Box key={i} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Box
                          component="span"
                          sx={{
                            width: 8, height: 8,
                            bgcolor: '#256BA9',
                            transform: 'rotate(45deg)',
                            mr: 1.5,
                          }}
                        />
                        <Typography variant="body1" color="#555">
                          {item}
                        </Typography>
                      </Box>
                    ))}
                  </Box>

                  <Typography
                    variant="body1"
                    color="text.secondary"
                    sx={{ mt: 2, px: { xs: 2, md: 0 } }}
                  >
                    At any point, you can save your progress and return later. If you run into questions or need help, our team is ready to assist. Since this information is important for getting started smoothly, we encourage you to complete it as soon as possible. 
                  </Typography>
                </Box>
              )}


       {/* ---------------- Slide 1 – Company Info ---------------- */}

{/* ---------------- Slide 1 – Company Info ---------------- */}
{step === 1 && (
  <>
    <DualUnderline sx={{ mb: '75px', fontSize: '1.25rem' }}>
      Tell us about your company
    </DualUnderline>
    <Typography
      variant="body1"
      color="text.secondary"
      sx={{ mb: 2, px: { xs: 2, md: 0 } }}
    >
      This section helps us understand the basics of your business. By sharing details such as ownership, entity type, and contact information, we’ll be able to set up your account correctly and keep everything organized in one secure place. 
    </Typography>
    <Grid container spacing={2} sx={{ maxWidth: 600, mx: 'auto' }}>
      {/* Row 1: Company name + Phone */}
      <Grid item xs={8}>
        <TextField
          fullWidth
          required
          size="small"
          label="Company name"
          value={company.name}
          error={companyErrors.name}
          InputLabelProps={{ sx: { fontSize: '0.75rem' } }}
          InputProps={{
            sx: { fontSize: '0.75rem' },
            inputProps: { style: { fontSize: '0.75rem' } }
          }}
          onChange={e => {
            const name = e.target.value;
            setCompany({ ...company, name });
            if (companyErrors.name && name.trim()) {
              setCompanyErrors((c) => ({ ...c, name: false }));
            }
            // Debounced autosave
            saveSoon({ ClientName: name || null });
          }}
          onBlur={e => {
            const name = e.target.value;
            // Ensure we flush the latest value on blur
            saveNow({ ClientName: name || null });
          }}
        />
      </Grid>
      <Grid item xs={4}>
        <InputMask
          mask="(999) 999-9999"
          value={company.phone || ''}
          onChange={e => {
            const formatted = e.target.value;
            setCompany({ ...company, phone: formatted });
            if (companyErrors.phone && formatted.trim()) {
              setCompanyErrors((c) => ({ ...c, phone: false }));
            }
            // Save digits only
            const phoneDigits = onlyDigits(formatted);
            saveSoon({ PhoneNumber: phoneDigits || null });
          }}
          onBlur={e => {
            const phoneDigits = onlyDigits(e.target.value);
            saveNow({ PhoneNumber: phoneDigits || null });
          }}
        >
          {props => (
            <TextField
              {...props}
              fullWidth
              required
              size="small"
              label="Phone"
              error={companyErrors.phone}
              InputLabelProps={{ sx: { fontSize: '0.75rem' } }}
              InputProps={{
                sx: { fontSize: '0.75rem' },
                inputProps: { style: { fontSize: '0.75rem' } }
              }}
            />
          )}
        </InputMask>
      </Grid>

      {/* Row 2: EIN + Entity + Specify entity */}
      <Grid item xs={4}>
        <InputMask
          mask="99-9999999"
          value={company.ein || ''}
          onChange={e => {
            const v = e.target.value;
            setCompany({ ...company, ein: v });
            if (companyErrors.ein && v.trim()) {
              setCompanyErrors((c) => ({ ...c, ein: false }));
            }
            // Save digits only
            saveSoon({ EIN: onlyDigits(v) || null });
          }}
          onBlur={e => saveNow({ EIN: onlyDigits(e.target.value) || null })}
        >
          {props => (
            <TextField
              {...props}
              fullWidth
              required
              size="small"
              label="EIN"
              error={companyErrors.ein}
              InputLabelProps={{ sx: { fontSize: '0.75rem' } }}
              InputProps={{
                sx: { fontSize: '0.75rem' },
                inputProps: { style: { fontSize: '0.75rem' } }
              }}
            />
          )}
        </InputMask>
      </Grid>
      <Grid item xs={4}>
        <FormControl fullWidth required size="small" error={companyErrors.structure}>
          <InputLabel sx={{ fontSize: '0.75rem' }}>Entity</InputLabel>
          <Select
            value={company.structure}
            label="Entity"
            size="small"
            sx={{ fontSize: '0.75rem' }}
            onChange={e => {
              const structure = e.target.value;
              const next = { ...company, structure, customStructure: '' };
              setCompany(next);
              if (companyErrors.structure && structure) {
                setCompanyErrors((c) => ({ ...c, structure: false }));
              }
              if (companyErrors.customStructure) {
                setCompanyErrors((c) => ({ ...c, customStructure: false }));
              }
              // Save immediately: EntityType + (maybe) CustomEntity
              if (structure === 'Other') {
                saveNow({ EntityType: 'Other', CustomEntity: null });
              } else {
                saveNow({ EntityType: structure || null, CustomEntity: null });
              }
            }}
          >
            <MenuItem value="" disabled>Choose…</MenuItem>
            {entityOptions.map(o => (
              <MenuItem key={o} value={o}>{o}</MenuItem>
            ))}
            <MenuItem value="Other">Other</MenuItem>
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={4}>
        {company.structure === 'Other' && (
          <TextField
            fullWidth
            required
            size="small"
            label="Specify entity"
            value={company.customStructure || ''}
            error={companyErrors.customStructure}
            InputLabelProps={{ sx: { fontSize: '0.75rem' } }}
            InputProps={{
              sx: { fontSize: '0.75rem' },
              inputProps: { style: { fontSize: '0.75rem' } }
            }}
            onChange={e => {
              const v = e.target.value;
              setCompany({ ...company, customStructure: v });
              if (companyErrors.customStructure && v.trim()) {
                setCompanyErrors((c) => ({ ...c, customStructure: false }));
              }
              // Save as CustomEntity
              saveSoon({ CustomEntity: v || null });
            }}
            onBlur={e => saveNow({ CustomEntity: (e.target.value || null) })}
          />
        )}
      </Grid>

      {/* Row 3: Primary & Secondary owner + % */}
      <Grid item xs={4}>
        <TextField
          fullWidth
          required
          size="small"
          label="Primary owner"
          value={company.owner}
          error={companyErrors.owner}
          InputLabelProps={{ sx: { fontSize: '0.75rem' } }}
          InputProps={{
            sx: { fontSize: '0.75rem' },
            inputProps: { style: { fontSize: '0.75rem' } }
          }}
          onChange={e => {
            const v = e.target.value;
            setCompany({ ...company, owner: v });
            if (companyErrors.owner && v.trim()) {
              setCompanyErrors((c) => ({ ...c, owner: false }));
            }
            saveSoon({ PrimaryOwner: v || null });
          }}
          onBlur={e => saveNow({ PrimaryOwner: e.target.value || null })}
        />
      </Grid>
      <Grid item sx={{ width: 80 }}>
        <TextField
          fullWidth
          required
          size="small"
          label="%"
          value={company.primaryPct || ''}
          error={companyErrors.primaryPct}
          InputLabelProps={{ sx: { fontSize: '0.75rem' } }}
          InputProps={{
            sx: { fontSize: '0.75rem' },
            inputProps: {
              inputMode: 'numeric',
              pattern: '[0-9]*',
              style: { fontSize: '0.75rem' }
            }
          }}
          onChange={e => {
            const v = e.target.value;
            setCompany({ ...company, primaryPct: v });
            if (companyErrors.primaryPct && v !== '') {
              setCompanyErrors((c) => ({ ...c, primaryPct: false }));
            }
            saveSoon({ PrimaryOwnershipPct: toNumberOrNull(v) });
          }}
          onBlur={e => saveNow({ PrimaryOwnershipPct: toNumberOrNull(e.target.value) })}
        />
      </Grid>
      <Grid item xs={4}>
        <TextField
          fullWidth
          size="small"
          label="Secondary owner"
          value={company.secondaryOwner || ''}
          InputLabelProps={{ sx: { fontSize: '0.75rem' } }}
          InputProps={{
            sx: { fontSize: '0.75rem' },
            inputProps: { style: { fontSize: '0.75rem' } }
          }}
          onChange={e => {
            const v = e.target.value;
            setCompany({ ...company, secondaryOwner: v });
            saveSoon({ SecondaryOwner: v || null });
          }}
          onBlur={e => saveNow({ SecondaryOwner: e.target.value || null })}
        />
      </Grid>
      <Grid item sx={{ width: 80 }}>
        <TextField
          fullWidth
          size="small"
          label="%"
          value={company.secondaryPct || ''}
          InputLabelProps={{ sx: { fontSize: '0.75rem' } }}
          InputProps={{
            sx: { fontSize: '0.75rem' },
            inputProps: {
              inputMode: 'numeric',
              pattern: '[0-9]*',
              style: { fontSize: '0.75rem' }
            }
          }}
          onChange={e => {
            const v = e.target.value;
            setCompany({ ...company, secondaryPct: v });
            saveSoon({ SecondaryOwnershipPct: toNumberOrNull(v) });
          }}
          onBlur={e => saveNow({ SecondaryOwnershipPct: toNumberOrNull(e.target.value) })}
        />
      </Grid>

      {/* Row 4: Address lines 1–3 */}
      <Grid item xs={12}>
        <TextField
          fullWidth
          required
          size="small"
          label="Address Line 1"
          value={company.address1 || ''}
          error={companyErrors.address1}
          InputLabelProps={{ sx: { fontSize: '0.75rem' } }}
          InputProps={{
            sx: { fontSize: '0.75rem' },
            inputProps: { style: { fontSize: '0.75rem' } }
          }}
          onChange={e => {
            const v = e.target.value;
            setCompany({ ...company, address1: v });
            if (companyErrors.address1 && v.trim()) {
              setCompanyErrors((c) => ({ ...c, address1: false }));
            }
            saveSoon({ AddressLine1: v || null });
          }}
          onBlur={e => saveNow({ AddressLine1: e.target.value || null })}
        />
      </Grid>
      <Grid item xs={6}>
        <TextField
          fullWidth
          size="small"
          label="Address Line 2"
          value={company.address2 || ''}
          InputLabelProps={{ sx: { fontSize: '0.75rem' } }}
          InputProps={{
            sx: { fontSize: '0.75rem' },
            inputProps: { style: { fontSize: '0.75rem' } }
          }}
          onChange={e => {
            const v = e.target.value;
            setCompany({ ...company, address2: v });
            saveSoon({ AddressLine2: v || null });
          }}
          onBlur={e => saveNow({ AddressLine2: e.target.value || null })}
        />
      </Grid>
      <Grid item xs={6}>
        <TextField
          fullWidth
          size="small"
          label="Address Line 3"
          value={company.address3 || ''}
          InputLabelProps={{ sx: { fontSize: '0.75rem' } }}
          InputProps={{
            sx: { fontSize: '0.75rem' },
            inputProps: { style: { fontSize: '0.75rem' } }
          }}
          onChange={e => {
            const v = e.target.value;
            setCompany({ ...company, address3: v });
            saveSoon({ AddressLine3: v || null });
          }}
          onBlur={e => saveNow({ AddressLine3: e.target.value || null })}
        />
      </Grid>

      {/* Row 5: City, State (+Other), Zip */}
      <Grid item xs={4}>
        <TextField
          fullWidth
          required
          size="small"
          label="City"
          value={company.city || ''}
          error={companyErrors.city}
          InputLabelProps={{ sx: { fontSize: '0.75rem' } }}
          InputProps={{
            sx: { fontSize: '0.75rem' },
            inputProps: { style: { fontSize: '0.75rem' } }
          }}
          onChange={e => {
            const v = e.target.value;
            setCompany({ ...company, city: v });
            if (companyErrors.city && v.trim()) {
              setCompanyErrors((c) => ({ ...c, city: false }));
            }
            saveSoon({ City: v || null });
          }}
          onBlur={e => saveNow({ City: e.target.value || null })}
        />
      </Grid>
      <Grid item xs={4}>
        <FormControl fullWidth required size="small" error={companyErrors.state}>
          <InputLabel sx={{ fontSize: '0.75rem' }}>State</InputLabel>
          <Select
            value={company.state}
            label="State"
            size="small"
            sx={{ fontSize: '0.75rem' }}
            onChange={e => {
              const stateVal = e.target.value;
              const next = { ...company, state: stateVal };
              if (stateVal !== 'Other') next.customState = '';
              setCompany(next);
              if (companyErrors.state && stateVal) {
                setCompanyErrors((c) => ({ ...c, state: false }));
              }
              if (companyErrors.customState) {
                setCompanyErrors((c) => ({ ...c, customState: false }));
              }
              // If not "Other", save directly into State
              if (stateVal !== 'Other') {
                saveNow({ State: stateVal || null });
              } else {
                // Defer until customState is entered
                saveNow({ State: null });
              }
            }}
          >
            <MenuItem value="" disabled>Choose…</MenuItem>
            {usStates.map(s => (
              <MenuItem key={s} value={s}>{s}</MenuItem>
            ))}
            <MenuItem value="Other">Other</MenuItem>
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={4}>
        {company.state === 'Other' ? (
          <TextField
            fullWidth
            required
            size="small"
            label="Specify state/region"
            value={company.customState || ''}
            error={companyErrors.customState}
            InputLabelProps={{ sx: { fontSize: '0.75rem' } }}
            InputProps={{
              sx: { fontSize: '0.75rem' },
              inputProps: { style: { fontSize: '0.75rem' } }
            }}
            onChange={e => {
              const v = e.target.value;
              setCompany({ ...company, customState: v });
              if (companyErrors.customState && v.trim()) {
                setCompanyErrors((c) => ({ ...c, customState: false }));
              }
              // Save into State column since DB has no CustomState
              saveSoon({ State: v || null });
            }}
            onBlur={e => saveNow({ State: e.target.value || null })}
          />
        ) : (
          <TextField
            fullWidth
            required
            size="small"
            label="Zip"
            value={company.zip || ''}
            error={companyErrors.zip}
            InputLabelProps={{ sx: { fontSize: '0.75rem' } }}
            InputProps={{
              sx: { fontSize: '0.75rem' },
              inputProps: { style: { fontSize: '0.75rem' } }
            }}
            onChange={e => {
              const v = e.target.value;
              setCompany({ ...company, zip: v });
              if (companyErrors.zip && v.trim()) {
                setCompanyErrors((c) => ({ ...c, zip: false }));
              }
              saveSoon({ Zip: onlyDigits(v) || v || null });
            }}
            onBlur={e => saveNow({ Zip: onlyDigits(e.target.value) || e.target.value || null })}
          />
        )}
      </Grid>

      {/* If state === Other, show Zip on a new full row */}
      {company.state === 'Other' && (
        <Grid item xs={4}>
          <TextField
            fullWidth
            required
            size="small"
            label="Zip"
            value={company.zip || ''}
            error={companyErrors.zip}
            InputLabelProps={{ sx: { fontSize: '0.75rem' } }}
            InputProps={{
              sx: { fontSize: '0.75rem' },
              inputProps: { style: { fontSize: '0.75rem' } }
            }}
            onChange={e => {
              const v = e.target.value;
              setCompany({ ...company, zip: v });
              if (companyErrors.zip && v.trim()) {
                setCompanyErrors((c) => ({ ...c, zip: false }));
              }
              saveSoon({ Zip: onlyDigits(v) || v || null });
            }}
            onBlur={e => saveNow({ Zip: onlyDigits(e.target.value) || e.target.value || null })}
          />
        </Grid>
      )}
    </Grid>
  </>
)}

{/* ---------------------------- Slide 2 - Contacts --------------------------- */}
{step === 2 && (
  <>
    

    <DualUnderline sx={{ mb: 1, fontSize: '1.25rem' }}>Key Contacts</DualUnderline>

    {/* Description */}
    <Typography
      variant="body2"
      color="text.secondary"
      sx={{ mb: 2, fontSize: '0.875rem' }}
    >
      Here you’ll add the key people we’ll be working with. Listing the right contacts makes sure our team can reach the right person quickly. 
    </Typography>

    {/* Header */}
    <Grid
      container
      spacing={1}
      sx={{
        bgcolor: '#256BA9',
        color: '#fff',
        borderRadius: 1,
        px: 1,
        py: 0.5,
        fontSize: '0.75rem',
        fontWeight: 600,
      }}
    >
      {['Name', 'Title', 'Email', 'Phone', 'Time zone', ''].map(
        (label, i) => (
          <Grid item xs={[2, 2, 3, 2, 2, 1][i]} key={i} textAlign="center">
            {label}
          </Grid>
        )
      )}
    </Grid>

    {/* Contact Rows */}
    {contacts.map((contact, idx) => {
      const hasError =
        !contact.name.trim() ||
        !contact.title.trim() ||
        !contact.email.trim() ||
        !contact.phone.trim() ||
        !contact.tz;
      return (
        <Grid
          container
          spacing={1}
          alignItems="center"
          sx={{
            mt: 1,
            border: '1px solid #e0e0e0',
            borderRadius: 1,
            p: 1,
            backgroundColor: hasError ? 'rgba(255,0,0,0.03)' : 'transparent',
          }}
          key={idx}
        >
          <Grid item xs={2}>
            <TextField
              required
              size="small"
              fullWidth
              placeholder="Name"
              value={contact.name}
              error={!contact.name.trim()}
              InputLabelProps={{ sx: { fontSize: '0.75rem' } }}
              InputProps={{
                sx: { fontSize: '0.75rem' },
                inputProps: { style: { fontSize: '0.75rem' } },
              }}
              onChange={(e) => {
                const u = [...contacts];
                u[idx].name = e.target.value;
                setContacts(u);
                saveContactsSoon(u);
              }}
              onBlur={() => saveContactsNow(contacts)}
            />
          </Grid>
          <Grid item xs={2}>
            <TextField
              required
              size="small"
              fullWidth
              placeholder="Title"
              value={contact.title}
              error={!contact.title.trim()}
              InputLabelProps={{ sx: { fontSize: '0.75rem' } }}
              InputProps={{
                sx: { fontSize: '0.75rem' },
                inputProps: { style: { fontSize: '0.75rem' } },
              }}
              onChange={(e) => {
                const u = [...contacts];
                u[idx].title = e.target.value;
                setContacts(u);
                saveContactsSoon(u);
              }}
              onBlur={() => saveContactsNow(contacts)}
            />
          </Grid>
          <Grid item xs={3}>
            <TextField
              required
              size="small"
              fullWidth
              placeholder="Email"
              type="email"
              value={contact.email}
              error={!contact.email.trim()}
              InputLabelProps={{ sx: { fontSize: '0.75rem' } }}
              InputProps={{
                sx: { fontSize: '0.75rem' },
                inputProps: { style: { fontSize: '0.75rem' } },
              }}
              onChange={(e) => {
                const u = [...contacts];
                u[idx].email = e.target.value;
                setContacts(u);
                saveContactsSoon(u);
              }}
              onBlur={() => saveContactsNow(contacts)}
            />
          </Grid>
          <Grid item xs={2}>
            <InputMask
              mask="(999) 999-9999"
              value={contact.phone}
              onChange={(e) => {
                const u = [...contacts];
                u[idx].phone = e.target.value;
                setContacts(u);
                saveContactsSoon(u);
              }}
              onBlur={() => saveContactsNow(contacts)}
            >
              {(props) => (
                <TextField
                  {...props}
                  required
                  size="small"
                  fullWidth
                  placeholder="Phone"
                  error={!contact.phone.trim()}
                  InputLabelProps={{ sx: { fontSize: '0.75rem' } }}
                  InputProps={{
                    sx: { fontSize: '0.75rem' },
                    inputProps: { style: { fontSize: '0.75rem' } },
                  }}
                />
              )}
            </InputMask>
          </Grid>
          <Grid item xs={2}>
            <FormControl fullWidth size="small" error={!contact.tz}>
              <Select
                displayEmpty
                value={contact.tz}
                sx={{ fontSize: '0.75rem' }}
                onChange={(e) => {
                  const u = [...contacts];
                  u[idx].tz = e.target.value;
                  setContacts(u);
                  // Save immediately on select change (less typing here)
                  saveContactsNow(u);
                }}
              >
                <MenuItem value="" disabled sx={{ fontSize: '0.75rem' }}>
                  TZ
                </MenuItem>
                {timezoneOptions.map((z) => (
                  <MenuItem key={z} value={z} sx={{ fontSize: '0.75rem' }}>
                    {z}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={1} textAlign="center">
            <IconButton
              size="small"
              onClick={() => {
                if (contacts.length === 1) {
                  setSnackbarOpen(true);
                  return;
                }
                const u = contacts.filter((_, i) => i !== idx);
                setContacts(u);
                // Save immediately on delete
                saveContactsNow(u);
              }}
            >
              <RemoveIcon fontSize="inherit" />
            </IconButton>
          </Grid>
        </Grid>
      );
    })}

    {/* Add Contact */}
    <Box textAlign="center" sx={{ mt: 2 }}>
      <Button
        size="small"
        variant="outlined"
        startIcon={<AddIcon />}
        sx={{ fontSize: '0.75rem', width: 140 }}
        onClick={() => {
          const u = [
            ...contacts,
            { name:'', title:'', email:'', phone:'', tz:'' }
          ];
          setContacts(u);
          // Save immediately on add (creates the placeholder row in DB)
          saveContactsNow(u);
        }}
      >
        Add contact
      </Button>
    </Box>

    {/* Snackbar */}
    <Snackbar
      open={snackbarOpen}
      autoHideDuration={4000}
      onClose={() => setSnackbarOpen(false)}
    >
      <Alert severity="warning" onClose={() => setSnackbarOpen(false)}>
        Please add at least one contact and fill in every field to proceed.
      </Alert>
    </Snackbar>
  </>
)}

{/* ---------------- Slide 3 – Systems ---------------- */}
{step === 3 && (
  <>
    <DualUnderline sx={{ mb: 1, fontSize: '1.25rem' }}>
      Systems You Use
    </DualUnderline>

    <Typography
      variant="body2"
      color="text.secondary"
      sx={{ mb: 2, fontSize: '0.875rem' }}
    >
      Every business runs on tools and software. Let us know the systems you currently use so we can align with your processes and make integration easier.
    </Typography>

    {/* Financial Systems */}
    <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontSize: '0.875rem' }}>
      Financial Systems
    </Typography>

    <Box sx={{ maxHeight: 240, overflowY: 'auto' }}>
      {/* Header */}
      <Grid container spacing={1} sx={{
        bgcolor: '#256BA9', color: '#fff', borderRadius: 1,
        px: 1, py: 0.5, fontSize: '0.75rem', fontWeight: 600,
      }}>
        {['System', 'Notes', 'Grant Access', ''].map((label, i) => (
          <Grid item xs={[4, 6, 1.5, 0.5][i]} key={i} textAlign="center">{label}</Grid>
        ))}
      </Grid>

      {/* Rows */}
      {systems.map((sys, i) => {
        const hasError = !sys.name || (sys.name === 'Other' && !(sys.customName || '').trim());
        const selectedName = sys.name === 'Other' ? (sys.customName || '').trim() : sys.name;
        const accessUrl = systemAccess[selectedName] || systemAccess[sys.name] || null;

        return (
          <Grid
            container
            spacing={1}
            alignItems="center"
            sx={{
              mt: 1,
              border: '1px solid #e0e0e0',
              borderRadius: 1,
              p: 1,
              backgroundColor: hasError ? 'rgba(255,0,0,0.03)' : 'transparent',
            }}
            key={i}
          >
            {/* System select + "Other" text */}
            <Grid item xs={4}>
              <FormControl fullWidth size="small" error={hasError}>
                <Select
                  displayEmpty
                  value={sys.name}
                  sx={{ fontSize: '0.75rem' }}
                  onChange={(e) => {
                    const u = [...systems];
                    u[i].name = e.target.value;
                    if (e.target.value !== 'Other') u[i].customName = '';
                    setSystems(u);
                    saveSystemsNow(u);
                  }}
                >
                  <MenuItem value="" disabled>Choose…</MenuItem>
                  {[
                     'FreshBooks','NetSuite','QuickBooks Online','QuickBooks Desktop',
                     'Sage 50','Sage Intacct','SAP Business One','Wave',
                     'Xero','Zoho Books',
                     'Dynamics GP','D365 Business Central','D365 Finance',
                  ].sort().map((o) => (
                    <MenuItem key={o} value={o}>{o}</MenuItem>
                  ))}
                  <MenuItem value="Other">Other</MenuItem>
                </Select>
              </FormControl>

              {sys.name === 'Other' && (
                <TextField
                  size="small"
                  fullWidth
                  placeholder="Specify"
                  value={sys.customName || ''}
                  sx={{ mt: 0.5 }}
                  error={!sys.customName?.trim()}
                  InputProps={{ sx: { fontSize: '0.75rem' } }}
                  InputLabelProps={{ sx: { fontSize: '0.75rem' } }}
                  onChange={(e) => {
                    const u = [...systems]; u[i].customName = e.target.value;
                    setSystems(u); saveSystemsSoon(u);
                  }}
                  onBlur={() => saveSystemsNow(systems)}
                />
              )}
            </Grid>

            {/* Notes */}
            <Grid item xs={6}>
              <TextField
                size="small"
                fullWidth
                placeholder="Notes (optional)"
                value={sys.notes || ''}
                onChange={(e) => {
                  const u = [...systems]; u[i].notes = e.target.value;
                  setSystems(u); saveSystemsSoon(u);
                }}
                onBlur={() => saveSystemsNow(systems)}
                InputProps={{ sx: { fontSize: '0.75rem' } }}
                InputLabelProps={{ sx: { fontSize: '0.75rem' } }}
              />
            </Grid>

            {/* Grant Access (icon) */}
            <Grid item xs={1.5} textAlign="center">
              <Tooltip title={accessUrl ? 'Open grant-access steps' : 'No public guide available'}>
                <span>
                  <IconButton
                    size="small"
                    component={accessUrl ? 'a' : 'button'}
                    href={accessUrl || undefined}
                    target={accessUrl ? '_blank' : undefined}
                    rel={accessUrl ? 'noopener' : undefined}
                    disabled={!accessUrl}
                    aria-label="Open grant-access guide"
                  >
                    <OpenInNewIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Grid>

            {/* Delete */}
            <Grid item xs={0.5} textAlign="center">
              <IconButton size="small" onClick={() => {
                const u = systems.filter((_, idx2) => idx2 !== i);
                const next = u.length ? u : [{ name: '', customName: '', notes: '' }];
                setSystems(next); saveSystemsNow(next);
              }}>
                <RemoveIcon fontSize="inherit" />
              </IconButton>
            </Grid>
          </Grid>
        );
      })}

      {/* Add System */}
      <Box textAlign="center" sx={{ mt: 2 }}>
        <Button
          size="small"
          variant="outlined"
          startIcon={<AddIcon />}
          sx={{ fontSize: '0.75rem', width: 140 }}
          onClick={() => {
            const u = [...systems, { name: '', customName: '', notes: '' }];
            setSystems(u); saveSystemsNow(u);
          }}
        >
          Add system
        </Button>
      </Box>
    </Box>

    {/* Collaboration Tools */}
    <Typography variant="body2" color="text.secondary" sx={{ mt: 3, mb: 1, fontSize: '0.875rem' }}>
      Collaboration Tools
    </Typography>

    <Box sx={{ maxHeight: 240, overflowY: 'auto' }}>
      {/* Header */}
      <Grid container spacing={1} sx={{
        bgcolor: '#256BA9', color: '#fff', borderRadius: 1,
        px: 1, py: 0.5, fontSize: '0.75rem', fontWeight: 600,
      }}>
        {['Tool', 'Notes', 'Grant Access', ''].map((label, i) => (
          <Grid item xs={[4, 6, 1.5, 0.5][i]} key={i} textAlign="center">{label}</Grid>
        ))}
      </Grid>

      {/* Rows */}
      {comms.map((c, i) => {
        const hasError = !c.name || (c.name === 'Other' && !(c.customName || '').trim());
        const selectedName = c.name === 'Other' ? (c.customName || '').trim() : c.name;
        const accessUrl = systemAccess[selectedName] || systemAccess[c.name] || null;

        return (
          <Grid
            container
            spacing={1}
            alignItems="center"
            sx={{
              mt: 1,
              border: '1px solid #e0e0e0',
              borderRadius: 1,
              p: 1,
              backgroundColor: hasError ? 'rgba(255,0,0,0.03)' : 'transparent',
            }}
            key={i}
          >
            {/* Tool select + "Other" text */}
            <Grid item xs={4}>
              <FormControl fullWidth size="small" error={hasError}>
                <Select
                  displayEmpty
                  value={c.name}
                  sx={{ fontSize: '0.75rem' }}
                  onChange={(e) => {
                    const u = [...comms];
                    u[i].name = e.target.value;
                    if (e.target.value !== 'Other') u[i].customName = '';
                    setComms(u); saveCommsNow(u);
                  }}
                >
                  <MenuItem value="" disabled>Choose…</MenuItem>
                  {['Email','Google Meet','Microsoft Teams','Phone','Slack','Zoom']
                    .sort().map((o) => (
                      <MenuItem key={o} value={o}>{o}</MenuItem>
                    ))}
                  <MenuItem value="Other">Other</MenuItem>
                </Select>
              </FormControl>

              {c.name === 'Other' && (
                <TextField
                  size="small"
                  fullWidth
                  placeholder="Specify"
                  value={c.customName || ''}
                  sx={{ mt: 0.5 }}
                  error={!c.customName?.trim()}
                  InputProps={{ sx: { fontSize: '0.75rem' } }}
                  InputLabelProps={{ sx: { fontSize: '0.75rem' } }}
                  onChange={(e) => {
                    const u = [...comms]; u[i].customName = e.target.value;
                    setComms(u); saveCommsSoon(u);
                  }}
                  onBlur={() => saveCommsNow(comms)}
                />
              )}
            </Grid>

            {/* Notes */}
            <Grid item xs={6}>
              <TextField
                size="small"
                fullWidth
                placeholder="Notes (optional)"
                value={c.notes || ''}
                onChange={(e) => {
                  const u = [...comms]; u[i].notes = e.target.value;
                  setComms(u); saveCommsSoon(u);
                }}
                onBlur={() => saveCommsNow(comms)}
                InputProps={{ sx: { fontSize: '0.75rem' } }}
                InputLabelProps={{ sx: { fontSize: '0.75rem' } }}
              />
            </Grid>

            {/* Grant Access (icon) */}
            <Grid item xs={1.5} textAlign="center">
              <Tooltip title={accessUrl ? 'Open grant-access steps' : 'No public guide available'}>
                <span>
                  <IconButton
                    size="small"
                    component={accessUrl ? 'a' : 'button'}
                    href={accessUrl || undefined}
                    target={accessUrl ? '_blank' : undefined}
                    rel={accessUrl ? 'noopener' : undefined}
                    disabled={!accessUrl}
                    aria-label="Open grant-access guide"
                  >
                    <OpenInNewIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Grid>

            {/* Delete */}
            <Grid item xs={0.5} textAlign="center">
              <IconButton size="small" onClick={() => {
                const u = comms.filter((_, idx2) => idx2 !== i);
                const next = u.length ? u : [{ name: '', customName: '', notes: '' }];
                setComms(next); saveCommsNow(next);
              }}>
                <RemoveIcon fontSize="inherit" />
              </IconButton>
            </Grid>
          </Grid>
        );
      })}

      {/* Add Tool */}
      <Box textAlign="center" sx={{ mt: 2 }}>
        <Button
          size="small"
          variant="outlined"
          startIcon={<AddIcon />}
          sx={{ fontSize: '0.75rem', width: 140 }}
          onClick={() => {
            const u = [...comms, { name: '', customName: '', notes: '' }];
            setComms(u); saveCommsNow(u);
          }}
        >
          Add tool
        </Button>
      </Box>
    </Box>

    {/* Snackbar */}
    <Snackbar
      open={snackbarOpen}
      autoHideDuration={4000}
      onClose={() => setSnackbarOpen(false)}
    >
      <Alert severity="warning" onClose={() => setSnackbarOpen(false)}>
        Please add at least one system and one collaboration tool, and complete all required fields.
      </Alert>
    </Snackbar>
  </>
)}


{/* ---------------- Slide 5 – Banking ---------------- */}
{step === 4 && (
  <>
    <DualUnderline sx={{ mb: 1, fontSize: '1.25rem' }}>
      Client Payment Method
    </DualUnderline>

    <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontSize: '0.875rem' }}>
      Add one payment method (bank or card) and authorize CFO Worx to withdraw funds.
    </Typography>
    <Typography variant="caption" color="text.secondary" sx={{ mb: 2, fontSize: '0.75rem' }}>
      Your credit card data is vaulted in Stripe—we never store full card numbers. Bank numbers are encrypted before saving.
    </Typography>

    {/* Stored Method */}
    {paymentMethods.length > 0 && (
      <Box sx={{ mb: 2 }}>
        <Grid container spacing={1} sx={{
          bgcolor: '#256BA9', color: '#fff', borderRadius: 1, px: 1, py: 0.5,
          fontSize: '0.75rem', fontWeight: 600
        }}>
          {['Type', 'Details', 'Authorized', ''].map((label, i) => (
            <Grid item xs={[3, 6, 2, 1][i]} key={i} textAlign="center">
              {label}
            </Grid>
          ))}
        </Grid>

        {paymentMethods.map((pm, idx) => (
          <Grid
            container
            spacing={1}
            alignItems="center"
            sx={{ mt: 1, border: '1px solid #e0e0e0', borderRadius: 1, p: 1 }}
            key={idx}
          >
            <Grid item xs={3}>{pm.type}</Grid>
            <Grid item xs={6}>
              {pm.type === 'Bank'
                ? `${pm.bankName || 'Bank'} ${pm.maskedAccount || (pm.last4 ? `••••${pm.last4}` : '')}`
                : `${pm.brand ? `${pm.brand} ` : ''}${pm.last4 ? `••••${pm.last4}` : ''}`}
            </Grid>
            <Grid item xs={2} textAlign="center">
              {pm.authorized ? 'Yes' : 'No'}
            </Grid>
            <Grid item xs={1} textAlign="center">
              <IconButton
                size="small"
                aria-label="Remove payment method"
                onClick={async () => {
                  setPaymentMethods([]);
                  await savePaymentMethodsNow([]);
                }}
              >
                <RemoveIcon fontSize="inherit" />
              </IconButton>
            </Grid>
          </Grid>
        ))}
      </Box>
    )}

    {/* Add / Edit Form */}
    {editingMethod ? (
      <Box
        sx={{
          mb: 3, maxWidth: 520, minWidth: 320, mx: 'auto', p: 2,
          border: '1px solid #e0e0e0', borderRadius: 2, minHeight: 300,
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
        }}
      >
        {/* Toggle */}
        <RadioGroup
          row
          value={editingMethod.type}
          onChange={e =>
            setEditingMethod({
              type: e.target.value,
              authorized: false,
              ...(e.target.value === 'Bank'
                ? { bankName: '', routing: '', account: '', address: '' }
                : {})
            })
          }
          sx={{ mb: 2 }}
        >
          <FormControlLabel
            value="Bank"
            control={<Radio size="small" />}
            label={<Typography sx={{ fontSize: '0.75rem' }}>Bank account</Typography>}
          />
          <FormControlLabel
            value="Card"
            control={<Radio size="small" />}
            label={<Typography sx={{ fontSize: '0.75rem' }}>Credit card</Typography>}
          />
        </RadioGroup>

        <Box sx={{ position: 'relative', flexGrow: 1 }}>
          {/* Bank Form */}
          <Fade in={editingMethod.type === 'Bank'} timeout={200} unmountOnExit>
            <Box sx={{ maxWidth: 480, mx: 'auto' }}>
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <TextField
                    size="small" fullWidth
                    label="Bank name"
                    value={editingMethod.bankName}
                    InputLabelProps={{ sx: { fontSize: '0.75rem' } }}
                    InputProps={{
                      sx: { fontSize: '0.75rem' },
                      inputProps: { style: { fontSize: '0.75rem' }, maxLength: 64 }
                    }}
                    onChange={e => setEditingMethod(m => ({ ...m, bankName: e.target.value }))}
                  />
                </Grid>
                <Grid item xs={3}>
                  <TextField
                    size="small" fullWidth
                    label="Routing #"
                    value={editingMethod.routing}
                    InputLabelProps={{ sx: { fontSize: '0.75rem' } }}
                    InputProps={{
                      sx: { fontSize: '0.75rem' },
                      inputProps: { style: { fontSize: '0.75rem' }, inputMode: 'numeric', pattern: '[0-9]*', maxLength: 9 }
                    }}
                    onChange={e => setEditingMethod(m => ({ ...m, routing: e.target.value.replace(/\D+/g, '').slice(0,9) }))}
                  />
                </Grid>
                <Grid item xs={3}>
                  <TextField
                    size="small" fullWidth
                    label="Account #"
                    value={editingMethod.account}
                    InputLabelProps={{ sx: { fontSize: '0.75rem' } }}
                    InputProps={{
                      sx: { fontSize: '0.75rem' },
                      inputProps: { style: { fontSize: '0.75rem' }, inputMode: 'numeric', pattern: '[0-9]*', maxLength: 20 }
                    }}
                    onChange={e => setEditingMethod(m => ({ ...m, account: e.target.value.replace(/\D+/g, '').slice(0,20) }))}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    size="small" fullWidth
                    label="Bank address"
                    value={editingMethod.address}
                    InputLabelProps={{ sx: { fontSize: '0.75rem' } }}
                    InputProps={{
                      sx: { fontSize: '0.75rem' },
                      inputProps: { style: { fontSize: '0.75rem' }, maxLength: 200 }
                    }}
                    onChange={e => setEditingMethod(m => ({ ...m, address: e.target.value }))}
                  />
                </Grid>
              </Grid>
            </Box>
          </Fade>

          {/* Card Form */}
          <Fade in={editingMethod.type === 'Card'} timeout={200} unmountOnExit>
            <Box sx={{ maxWidth: 480, mx: 'auto' }}>
              <Box
                sx={{ p: 2, border: '1px solid #ccc', borderRadius: 1, backgroundColor: '#fff', boxShadow: 1 }}
              >
                <Typography variant="subtitle2" sx={{ mb: 1, fontSize: '0.875rem' }}>
                  Card details
                </Typography>
                <CardElement
                  options={{
                    style: {
                      base: {
                        fontSize: '1rem',
                        color: '#223',
                        fontFamily: '"Helvetica Neue",Helvetica,sans-serif',
                        '::placeholder': { color: '#999' }
                      },
                      invalid: { color: '#e74c3c' }
                    }
                  }}
                />
              </Box>
            </Box>
          </Fade>
        </Box>

        {/* Authorize + Actions */}
        <Box>
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={editingMethod.authorized}
                onChange={e => setEditingMethod(m => ({ ...m, authorized: e.target.checked }))}
              />
            }
            label={<Typography sx={{ fontSize: '0.75rem' }}>Authorize withdrawals</Typography>}
            sx={{ mb: 1 }}
          />

          <Box display="flex" justifyContent="flex-end" gap={1}>
            <Button size="small" sx={{ fontSize: '0.75rem' }} onClick={() => setEditingMethod(null)}>
              Cancel
            </Button>
            <Button
              size="small"
              variant="contained"
              sx={{ fontSize: '0.875rem', px: 2 }}
              disabled={
                editingMethod.type === 'Bank'
                  ? !editingMethod.bankName?.trim() ||
                    !editingMethod.routing ||
                    editingMethod.routing.length !== 9 ||
                    !editingMethod.account ||
                    editingMethod.account.length < 4 ||
                    !editingMethod.address?.trim() ||
                    !editingMethod.authorized
                  : !editingMethod.authorized
              }
              onClick={async () => {
                if (editingMethod.type === 'Card') {
                  // Tokenize to safely read brand/last4 (still not persisting)
                  try {
                    const { token, error } = await stripe.createToken(elements.getElement(CardElement));
                    if (error) {
                      console.error('Stripe token error', error);
                      return;
                    }
                    const last4 = token?.card?.last4 || '';
                    const brand = token?.card?.brand || '';
                    const newPM = [{ type: 'Card', brand, last4, authorized: true }];
                    setPaymentMethods(newPM);
                    // Intentionally NOT persisting card; remove if you later vault server-side.
                  } catch (e) {
                    console.error('Card handling failed', e);
                    return;
                  }
                } else {
                  // BANK: build stored object with masked + encrypted numbers, then persist
                  const stored = await buildStoredBankPM(editingMethod);
                  const newPM = [stored];
                  setPaymentMethods(newPM);
                  await savePaymentMethodsNow(newPM);
                }
                setEditingMethod(null);
              }}
            >
              Save
            </Button>
          </Box>
        </Box>
      </Box>
    ) : (
      paymentMethods.length === 0 && (
        <Box textAlign="center" sx={{ mt: 2 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<AddIcon />}
            sx={{ fontSize: '0.75rem' }}
            onClick={() => setEditingMethod({
              type: 'Bank',
              bankName: '',
              routing: '',
              account: '',
              address: '',
              authorized: false
            })}
          >
            Add payment method
          </Button>
        </Box>
      )
    )}

    {/* Snackbar for Slide 5 */}
    <Snackbar open={snackbarOpen} autoHideDuration={4000} onClose={() => setSnackbarOpen(false)}>
      <Alert severity="warning" onClose={() => setSnackbarOpen(false)}>
        You must add one payment method to proceed.
      </Alert>
    </Snackbar>
  </>
)}



{/* ---------------- Slide 7 – Management ---------------- */}
{step === 5 && (
  <>
    <DualUnderline sx={{ mb: '75px' }}>Our Management Team</DualUnderline>

    <Typography
      variant="body2"
      color="text.secondary"
      sx={{ mb: 2, fontSize: '0.875rem' }}
    >
      Meet the CFO Worx leadership team. This section introduces you to the people guiding your engagement, so you know who’s supporting your business behind the scenes.
    </Typography>
    
    <Grid container spacing={2} justifyContent="center">
      {managementTeam.map((m) => (
        <Grid
          item
          xs={12}
          sm={6}
          md={4}
          key={m.name}
          sx={{ display: 'flex', justifyContent: 'center' }}
        >
          <Card variant="outlined" sx={{ textAlign: 'center', py: 2, width: '100%', maxWidth: 300 }}>
            <Box
              component="img"
              src={m.imageUrl}
              alt={m.name}
              sx={{
                width: 120,
                height: 120,
                borderRadius: '50%',
                mb: 1,
                mx: 'auto',
                objectFit: 'cover'
              }}
            />
            <Typography fontWeight={600}>{m.name}</Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              {m.title}
            </Typography>

            {/* Clickable email */}
            {m.email && (
              <Typography
                variant="caption"
                component="a"
                href={`mailto:${m.email}`}
                display="block"
                sx={{
                  mt: 0.5,
                  color: 'primary.main',
                  textDecoration: 'none',
                  wordBreak: 'break-all',
                  '&:hover': { textDecoration: 'underline' }
                }}
                aria-label={`Email ${m.name}`}
              >
                {m.email}
              </Typography>
            )}
          </Card>
        </Grid>
      ))}
    </Grid>

    {/* Project Team Note (Slide 8 removed) */}
    {/* <Box textAlign="center" sx={{ mt: 4 }}>
      <Typography variant="body2" color="text.secondary">
        Your dedicated project team will be assigned shortly once we finalize your onboarding.
      </Typography>
    </Box> */}
  </>
)}

              {/* ---------------- Slide 9 – FAQ ---------------- */}
              {step === 6 && (
                <>
                  <DualUnderline sx={{ mb: '75px' }}>FAQ</DualUnderline>

                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 2, fontSize: '0.875rem' }}
                  >
                    Find answers to common questions about onboarding and working with CFO Worx.
                  </Typography>
                  
                  {faqs.map((f,i)=>(
                    <Accordion key={i} sx={{ mb:1 }}>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography fontWeight={600}>{f.q}</Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Typography>{f.a}</Typography>
                      </AccordionDetails>
                    </Accordion>
                  ))}
                </>
              )}
 {/* ---------------- Slide 10 – Thank You ---------------- */}
{step === 7 && (
  <Box
    textAlign="center"
    maxWidth={800}
    mx="auto"
    sx={{ py: 4 }}
  >
    {/* Word-Art Title */}
    <Typography
      variant="h2"
      sx={{
        fontFamily: '"Montserrat", sans-serif',
        fontWeight: 700,
        color: '#0A2E5D',
        letterSpacing: 1,
        textTransform: 'uppercase',
        mb: 2,
      }}
    >
      Thank You!
    </Typography>

    {/* Closing Message */}
    <Typography
      variant="body1"
      color="text.secondary"
      sx={{ mb: 3, px: { xs: 2, md: 0 } }}
    >
      We’re excited to move forward with you. Here’s what happens next:
    </Typography>

    {/* Next Steps List */}
    <Box
      component="ol"
      sx={{
        textAlign: 'left',
        display: 'inline-block',
        mb: 3,
        pl: 3,
        '& li': {
          mb: 1.5,
          fontSize: '1rem',
          color: '#333',
        }
      }}
    >
      <li>
        <Typography component="span" fontWeight={600}>
          Set up a kickoff meeting
        </Typography>
        <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
          We’ll schedule a video call to align on goals.
        </Typography>
      </li>
      <li>
        <Typography component="span" fontWeight={600}>
          Introduce your financial professionals
        </Typography>
        <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
          Meet your dedicated accountant and strategist.
        </Typography>
      </li>
      <li>
        <Typography component="span" fontWeight={600}>
          Get started on your books
        </Typography>
        <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
          We’ll import and organize your financial data.
        </Typography>
      </li>
    </Box>

    {/* Final Encouragement */}
    <Typography
      variant="body1"
      color="text.secondary"
      sx={{ mt: 2, px: { xs: 2, md: 0 } }}
    >
      If you have questions before our kickoff, just reach out—we’re here to help.
    </Typography>
  </Box>
)}

            </Box>
          </Fade>
        </Box>

        {/* FOOTER NAV (inside card; stepper is outside) */}
        <Divider sx={{ mt: 1, mb: 1 }} />
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <IconButton onClick={goBack} disabled={step === 0}>
            <ArrowBackIcon />
          </IconButton>
          {step < STEPS - 1 ? (
            <Button
              variant="contained"
              endIcon={<ArrowForwardIcon />}
              onClick={goNext}
            >
              Next
            </Button>
          ) : (
           <Button
  variant="contained"
  onClick={async () => {
    if (onStepChange) onStepChange(99);
    if (clientId != null) {
      try {
        await updateClientOnboardingStep(clientId, 99);
      } catch (e) {
        console.error('Failed to persist finish step', e);
      }
    }
    if (onFinish) await onFinish();
    // then reload the page
    window.location.reload();
  }}
>
  Finish
</Button>


          )}
        </Box>

        {/* Save & Exit */}
        {step < STEPS - 1 && (
          <Box mt={1} textAlign="center">
            <Button
              size="small"
              onClick={() =>
                console.log('Save & exit draft', {
                  step,
                  company,
                  contacts,
                  systems,
                  comms,
                  bankList,
                })
              }
            >
              Save & Exit
            </Button>
          </Box>
        )}
      </Card>

      {/* BOTTOM-DOCKED, ULTRA-COMPACT STEPPER (outside the card) */}
      <Box
        sx={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 5,               // ~5px from bottom
          zIndex: 1400,
          px: { xs: 0.5, md: 2 },
        }}
      >
        <Paper
          elevation={6}
          sx={{
            mx: 'auto',
            maxWidth: 880,
            borderRadius: 999,     // pill look
            backdropFilter: 'saturate(120%) blur(6px)',
            backgroundColor: 'rgba(255,255,255,0.92)',
            px: { xs: 1, md: 1.25 },
            py: { xs: 0.25, md: 0.35 }, // very tight
          }}
        >
          {/* Inline-label stepper: label sits right of the number bubble */}
          <Stepper
            activeStep={step}
            connector={<ColorConnector />}
            // key style changes: no alternativeLabel, compress paddings, inline labels
            sx={{
              p: 0,
              minHeight: 14,
              '& .MuiStep-root': {
                p: 0,
                mx: { xs: 0.25, md: 0.5 },   // tighter between steps
              },
              '& .MuiStepConnector-root': {
                top: '50%',                  // center connector between small icons
              },
              '& .MuiStepLabel-root': {
                alignItems: 'center',        // force inline alignment of bubble + text
              },
              '& .MuiStepLabel-iconContainer': {
                p: 0,                        // remove default padding around icon
                mr: 0.5,                     // small gap between bubble and text
              },
              '& .MuiStepLabel-labelContainer': {
                // keep label inline and tight
                display: 'inline-flex',
                alignItems: 'center',
              },
              '& .MuiStepLabel-label': {
                typography: 'caption',
                fontSize: 10,                // small label
                color: 'text.secondary',
                letterSpacing: 0.2,
                whiteSpace: 'nowrap',
                maxWidth: { xs: 56, sm: 96, md: 'unset' }, // constrain on phones
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              },
            }}
          >
            {stepLabels.map((label, i) => (
              <Step key={label}>
               <StepLabel
  StepIconComponent={ColorStepIcon}
  sx={{
    '& .MuiStepLabel-label': {
      color: i === step ? 'text.primary' : 'text.secondary',
      fontWeight: i === step ? 600 : 400,
    },
  }}
>
  {label}
</StepLabel>

              </Step>
            ))}
          </Stepper>
          {/* Removed the LinearProgress filler line to save vertical space */}
        </Paper>
      </Box>
    </Box>
  );
}
