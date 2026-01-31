// frontend/src/components/Layout/DashboardLayout.jsx

import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import {
  Box,
  CssBaseline,
  AppBar as MuiAppBar,
  Toolbar,
  Typography,
  IconButton,
  Drawer as MuiDrawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Button,
} from '@mui/material';
import { styled, useTheme } from '@mui/material/styles';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import BusinessIcon from '@mui/icons-material/Business';
import WorkIcon from '@mui/icons-material/Work';
import SettingsIcon from '@mui/icons-material/Settings';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import AssessmentIcon from '@mui/icons-material/Assessment';
import LogoutIcon from '@mui/icons-material/Logout';
import DescriptionIcon from '@mui/icons-material/Description';
import AssignmentIcon from '@mui/icons-material/Assignment';
import BarChartIcon from '@mui/icons-material/BarChart';
import DynamicFeedIcon from '@mui/icons-material/DynamicFeed';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import BusinessCenterIcon from '@mui/icons-material/BusinessCenter';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PaidIcon from '@mui/icons-material/Paid';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import ForumIcon from '@mui/icons-material/Forum';
import GavelIcon from '@mui/icons-material/Gavel';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import FolderSpecialIcon from '@mui/icons-material/FolderSpecial';

import Logo from '../../assets/logo.png';
import OnboardingPresentation from '../../modules/client/pages/OnboardingPresentation';
import ReportsPage from '../../modules/client/pages/ReportsPage';
import { getClientOnboardingStatus } from '../../api/clients';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';

// Define drawer width percentages and min/max widths
const closedDrawerWidthPercentage = 0.08; // 8% of screen width
const openDrawerWidthPercentage = 0.15; // 15% of screen width
const drawerMinWidth = 50; // Minimum width when closed
const drawerMaxWidth = 200; // Maximum width when open

const DrawerHeader = styled('div')(({ theme }) => ({
  ...theme.mixins.toolbar,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  padding: theme.spacing(0, 1),
}));

const AppBar = styled(MuiAppBar)(({ theme, bordercolor }) => ({
  backgroundColor: '#FFFFFF',
  borderBottom: `4px solid ${bordercolor}`,
  color: bordercolor,
  zIndex: theme.zIndex.drawer + 1,
}));

const Drawer = styled(MuiDrawer, {
  shouldForwardProp: (prop) => prop !== 'open' && prop !== 'drawerWidth',
})(({ theme, open, drawerWidth }) => ({
  width: drawerWidth,
  flexShrink: 0,
  whiteSpace: 'nowrap',
  boxSizing: 'border-box',
  '& .MuiDrawer-paper': {
    width: drawerWidth,
    overflowX: 'hidden',
    boxSizing: 'border-box',
  },
}));

// lightweight JWT payload extractor (no signature verification)
function safeDecodeJwt(token) {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    let base64 = parts[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    // pad to multiple of 4
    while (base64.length % 4) {
      base64 += '=';
    }
    const decodedStr = atob(base64);
    // handle utf-8
    const json = decodeURIComponent(
      Array.prototype.map
        .call(decodedStr, (c) =>
          '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
        )
        .join('')
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}


export default function DashboardLayout({
  activeRole,
  setActiveRole,
  userRoles,
  onSignOut,
}) {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [screenWidth, setScreenWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );

  

  const [clientId, setClientId] = useState(null);
  const [onboardingStep, setOnboardingStep] = useState(null);

 useEffect(() => {
  const token = localStorage.getItem('token');
  if (!token) return;

  try {
    const decoded = safeDecodeJwt(token);
    const cid = decoded?.clientId;

    if (cid) {
      setClientId(cid);

      getClientOnboardingStatus(cid)
  .then((step) => {
    console.log('DashboardLayout Debug — raw onboardingStep from API:', step);
    setOnboardingStep(step);
  })
  .catch((err) => {
    console.error('Failed to fetch onboarding step:', err);
  });
    }
  } catch (e) {
    console.error('Failed to decode JWT:', e);
  }
}, []);


  const stripePromise = loadStripe(
    'pk_test_51IW8vEB2VVReBGDXnn7GYjL07pPE17sztxLahJGlDPNmXVGfqOybM4hNUHWRUQ1c3zqNkojS7lfhxmJJv9oEpw61008pPpVBNs'
  );

  // Role-based redirect
  useEffect(() => {
    if (
      activeRole === 'Consultant' &&
      !location.pathname.startsWith('/dashboard/consultant')
    ) {
      navigate('/dashboard/consultant');
    }
    if (
      activeRole === 'Manager' &&
      !location.pathname.startsWith('/dashboard/manager')
    ) {
      navigate('/dashboard/manager');
    }
    if (activeRole === 'Admin' && !location.pathname.startsWith('/dashboard/admin')) {
      navigate('/dashboard/admin');
    }
    if (activeRole === 'Sales' && !location.pathname.startsWith('/dashboard/sales')) {
      navigate('/dashboard/sales');
    }
    if (activeRole === 'Client' && !location.pathname.startsWith('/dashboard/client')) {
      navigate('/dashboard/client');
    }
  }, [activeRole, location.pathname, navigate]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleDrawerToggle = () => setDrawerOpen((o) => !o);

  const closedWidth = Math.max(closedDrawerWidthPercentage * screenWidth, drawerMinWidth);
  const openWidth = Math.min(openDrawerWidthPercentage * screenWidth, drawerMaxWidth);
  const drawerWidth = drawerOpen ? openWidth : closedWidth;

  const getBorderColor = () => '#0D47A1';
  const getPortalTitle = () => {
    switch (activeRole) {
      case 'Admin':
        return 'Admin Portal v1.5';
      case 'Consultant':
        return 'Consultant Portal v1.5';
      case 'Manager':
        return 'Manager Portal v1.5';
      case 'Sales':
        return 'Sales Portal v1.5';
      case 'Client':
        return 'Client Portal v1.5';
      default:
        return 'Portal v1.5';
    }
  };

  const adminMenuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard/admin' },
    { text: 'Clients', icon: <BusinessIcon />, path: '/dashboard/admin/clients' },
    { text: 'Team', icon: <PeopleIcon />, path: '/dashboard/admin/team' },
    {
      text: 'Users',
      icon: <PersonOutlineIcon />,
      path: '/dashboard/admin/users',
    },
    {
      text: 'Timesheets',
      icon: <AccessTimeIcon />,
      path: '/dashboard/admin/timesheets',
    },
    {
      text: 'Payroll',
      icon: <PaidIcon />,
      path: '/dashboard/admin/payroll',
    },
    {
      text: 'Reports',
      icon: <AssessmentIcon />,
      path: '/dashboard/admin/reports',
    },
    {
      text: 'Financial Reporting',
      icon: <AccountBalanceIcon />,
      path: '/dashboard/admin/financial-reporting',
    },
    {
      text: 'Client Work',
      icon: <FolderSpecialIcon />,
      path: '/dashboard/admin/client-work',
    },
    { text: 'CRM', icon: <BusinessCenterIcon />, path: '/dashboard/admin/crm' },
    { text: 'Commissions', icon: <AttachMoneyIcon />, path: '/dashboard/admin/commissions' },
    { text: 'Collaboration', icon: <ForumIcon />, path: '/dashboard/admin/collaboration' },
    {
      text: 'ROI Tracker',
      icon: <TrendingUpIcon />,
      path: '/dashboard/admin/roi-tracker',
    },
    {
      text: 'Governance',
      icon: <GavelIcon />,
      path: '/dashboard/admin/governance',
    },
    { text: 'Settings', icon: <SettingsIcon />, path: '/dashboard/admin/settings' },
    { text: 'Help', icon: <SupportAgentIcon />, path: '/dashboard/admin/helpdesk' },
  ];

  const consultantMenuItems = [
    { text: 'Feed', icon: <DynamicFeedIcon />, path: '/dashboard/consultant/feed' },
    {
      text: 'Calendar',
      icon: <AssignmentIcon />,
      path: '/dashboard/consultant/calendar',
    },
    { text: 'Projects', icon: <WorkIcon />, path: '/dashboard/consultant/projects' },
    {
      text: 'Client Work',
      icon: <FolderSpecialIcon />,
      path: '/dashboard/consultant/client-work',
    },
    { text: 'CRM', icon: <BusinessCenterIcon />, path: '/dashboard/consultant/crm' },
    {
      text: 'ROI Tracker',
      icon: <TrendingUpIcon />,
      path: '/dashboard/consultant/roi-tracker',
    },
    { text: 'Help', icon: <SupportAgentIcon />, path: '/dashboard/consultant/helpdesk' },
  ];

  const managerMenuItems = [
    {
      text: 'Dashboard',
      icon: <BarChartIcon />,
      path: '/dashboard/manager/projectsDashboard',
    },
    { text: 'Projects', icon: <WorkIcon />, path: '/dashboard/manager/projects' },
    {
      text: 'Templates',
      icon: <DescriptionIcon />,
      path: '/dashboard/manager/templates',
    },
    {
      text: 'Reports',
      icon: <AssessmentIcon />,
      path: '/dashboard/manager/reports',
    },
    {
      text: 'Client Work',
      icon: <FolderSpecialIcon />,
      path: '/dashboard/manager/client-work',
    },
    { text: 'CRM', icon: <BusinessCenterIcon />, path: '/dashboard/manager/crm' },
    {
      text: 'Commissions',
      icon: <AttachMoneyIcon />,
      path: '/dashboard/manager/commissions',
    },
    {
      text: 'Collaboration',
      icon: <ForumIcon />,
      path: '/dashboard/manager/collaboration',
    },
    {
      text: 'ROI Tracker',
      icon: <TrendingUpIcon />,
      path: '/dashboard/manager/roi-tracker',
    },
    {
      text: 'Governance',
      icon: <GavelIcon />,
      path: '/dashboard/manager/governance',
    },
    { text: 'Help', icon: <SupportAgentIcon />, path: '/dashboard/manager/helpdesk' },
  ];


  const salesMenuItems = [
    { text: 'CRM', icon: <BusinessCenterIcon />, path: '/dashboard/sales/crm' },
    { text: 'Commissions', icon: <AttachMoneyIcon />, path: '/dashboard/sales/commissions' },
    { text: 'Timesheets', icon: <AccessTimeIcon />, path: '/dashboard/sales/history' },
    { text: 'Help', icon: <SupportAgentIcon />, path: '/dashboard/sales/helpdesk' },
  ];

  const clientMenuItems = [
    { text: 'Reports', icon: <AssessmentIcon />, path: '/dashboard/client/reports' },
    { text: 'Help', icon: <SupportAgentIcon />, path: '/dashboard/client/helpdesk' },
  ];

  const getMenuItems = () => {
    switch (activeRole) {
      case 'Admin':
        return adminMenuItems;
      case 'Consultant':
        return consultantMenuItems;
      case 'Manager':
        return managerMenuItems;
      case 'Sales':
        return salesMenuItems;
      case 'Client':
        return clientMenuItems;
      default:
        return [];
    }
  };

  const recognizedRoles = userRoles.filter((r) =>
    ['Admin', 'Consultant', 'Manager', 'Sales', 'Client'].includes(r)
  );
  const shouldShowRoleSwitcher = recognizedRoles.length > 1;

  const onboardingComplete = Number(onboardingStep) === 99;
  const showOnboarding = activeRole === 'Client';

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />

      <AppBar position="fixed" bordercolor={getBorderColor()}>
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="toggle drawer"
            onClick={handleDrawerToggle}
            edge="start"
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>

          <Box component="img" src={Logo} alt="Logo" sx={{ height: 40, mr: 2 }} />
         <Box sx={{ flexGrow: 1 }}>
  <Typography variant="h6" noWrap>
    {getPortalTitle()}
  </Typography>
  {/*
  {clientId && (
    <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
      Client ID: {clientId} {' — '} Onboarding Complete:{' '}
      {onboardingComplete ? 'Yes' : `Step ${onboardingStep ?? '0'}`}
    </Typography>
  )}
  */}
</Box>

          {shouldShowRoleSwitcher && (
            <FormControl variant="outlined" size="small" sx={{ minWidth: 120, mr: 2 }}>
              <InputLabel id="role-switcher-label">Role</InputLabel>
              <Select
                labelId="role-switcher-label"
                value={activeRole}
                onChange={(e) => setActiveRole(e.target.value)}
                label="Role"
              >
                {recognizedRoles.map((role) => (
                  <MenuItem key={role} value={role}>
                    {role}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <Button
            color="inherit"
            startIcon={<LogoutIcon />}
            onClick={onSignOut}
            sx={{ textTransform: 'none' }}
          >
            Sign Out
          </Button>
        </Toolbar>
      </AppBar>

      <Drawer variant="permanent" open={drawerOpen} drawerWidth={drawerWidth}>
        <DrawerHeader>
          {drawerOpen && (
            <IconButton onClick={handleDrawerToggle}>
              <ChevronRightIcon />
            </IconButton>
          )}
        </DrawerHeader>
        <Divider />
        <List>
          {getMenuItems().map((item) => (
            <ListItem
              button
              key={item.text}
              onClick={() => navigate(item.path)}
              sx={{
                justifyContent: drawerOpen ? 'initial' : 'center',
                px: 2.5,
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 0,
                  mr: drawerOpen ? 3 : 'auto',
                  justifyContent: 'center',
                  color: getBorderColor(),
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.text} sx={{ opacity: drawerOpen ? 1 : 0 }} />
            </ListItem>
          ))}
        </List>
      </Drawer>

      {/* Always show onboarding overlay for Clients unless complete */}
      {/* Client landing: either ReportsPage (if onboarding complete) or onboarding flow */}




      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          ml: `${drawerOpen ? drawerWidth - 150 : theme.spacing(1) + 1}px`,
          maxWidth: 'calc(100% - 10%)',
          overflowX: 'hidden',
          transition: theme.transitions.create(['margin-left', 'width'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.standard,
          }),
        }}
      >
        <DrawerHeader />
        <Outlet context={{ clientId, onboardingStep }} />
      </Box>
    </Box>
  );
}

DashboardLayout.propTypes = {
  activeRole: PropTypes.string.isRequired,
  setActiveRole: PropTypes.func.isRequired,
  userRoles: PropTypes.arrayOf(PropTypes.string).isRequired,
  onSignOut: PropTypes.func.isRequired,
};
