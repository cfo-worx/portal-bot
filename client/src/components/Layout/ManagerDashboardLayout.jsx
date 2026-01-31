import React, { useState, useEffect } from 'react';
import { useNavigate, Outlet } from 'react-router-dom';
import PropTypes from 'prop-types';
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
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { styled, useTheme } from '@mui/material/styles';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import WorkIcon from '@mui/icons-material/Work';       // Example icon for "Projects"
import AssessmentIcon from '@mui/icons-material/Assessment'; // Example icon for "Reports"
import BusinessCenterIcon from '@mui/icons-material/BusinessCenter';
import LogoutIcon from '@mui/icons-material/Logout';

import Logo from '../../assets/logo.png';

// Drawer sizing
const closedDrawerWidthPercentage = 0.08; // 8% of screen width
const openDrawerWidthPercentage = 0.15;  // 15% of screen width
const drawerMinWidth = 50;
const drawerMaxWidth = 200;

const DrawerHeader = styled('div')(({ theme }) => ({
  ...theme.mixins.toolbar,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  padding: theme.spacing(0, 1),
}));

const AppBar = styled(MuiAppBar)(({ theme }) => ({
  backgroundColor: '#FFFFFF',
  borderBottom: '2px solid #90CAF9', // Manager color? (Orange?)
  color: '#1976d2',
  boxShadow: 'none',
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

const ManagerDashboardLayout = ({
  activeRole,
  setActiveRole,
  userRoles,
  onSignOut,
}) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);
  const [screenWidth, setScreenWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );

  // If user picks 'Admin' or 'Consultant' in the dropdown, re-route them
  useEffect(() => {
    if (activeRole === 'Admin') {
      navigate('/dashboard/admin');
    } else if (activeRole === 'Consultant') {
      navigate('/dashboard/consultant');
    }
  }, [activeRole, navigate]);

  useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Drawer widths
  const closedDrawerWidth = Math.max(
    closedDrawerWidthPercentage * screenWidth,
    drawerMinWidth
  );
  const openDrawerWidth = Math.min(
    openDrawerWidthPercentage * screenWidth,
    drawerMaxWidth
  );
  const drawerWidth = open ? openDrawerWidth : closedDrawerWidth;

  const handleDrawerToggle = () => setOpen(!open);

  // If user has multiple roles, show a role-switcher in the top bar
  const shouldShowRoleSwitcher =
    userRoles.includes('Admin') ||
    userRoles.includes('Consultant') ||
    userRoles.includes('Manager');

  // Manager-specific nav items
  const menuItems = [
    {
      text: 'Dashboard',
      icon: <WorkIcon />,
      path: '/dashboard/manager',
    },
    {
      text: 'Projects',
      icon: <WorkIcon />,
      path: '/dashboard/manager/projects',
    },
    {
      text: 'Reports',
      icon: <AssessmentIcon />,
      path: '/dashboard/manager/reports',
    },
    {
      text: 'CRM',
      icon: <BusinessCenterIcon />,
      path: '/dashboard/manager/crm',
    },
    // Add more as needed
  ];

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      {/* Top Bar */}
      <AppBar position="fixed">
        <Toolbar>
          {/* Drawer Toggle */}
          <IconButton
            color="inherit"
            aria-label="toggle drawer"
            onClick={handleDrawerToggle}
            edge="start"
            sx={{ marginRight: 2 }}
          >
            <MenuIcon />
          </IconButton>

          {/* Logo */}
          <Box
            component="img"
            src={Logo}
            alt="Logo"
            sx={{ height: 40, marginRight: 2 }}
          />

          {/* Title */}
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            Manager Portal
          </Typography>

          {/* Role Switcher if the user has multiple roles */}
          {shouldShowRoleSwitcher && (
            <FormControl variant="outlined" size="small" sx={{ minWidth: 120, mr: 2 }}>
              <InputLabel id="role-switcher-label">Role</InputLabel>
              <Select
                labelId="role-switcher-label"
                id="role-switcher"
                value={activeRole}
                onChange={(e) => setActiveRole(e.target.value)}
                label="Role"
              >
                {userRoles.map((role) => (
                  <MenuItem key={role} value={role}>
                    {role}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* Sign Out Button */}
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

      {/* Side Drawer */}
      <Drawer variant="permanent" open={open} drawerWidth={drawerWidth}>
        <DrawerHeader>
          {open && (
            <IconButton onClick={handleDrawerToggle}>
              <ChevronRightIcon />
            </IconButton>
          )}
        </DrawerHeader>
        <Divider />
        <List>
          {menuItems.map((item) => (
            <ListItem
              button
              key={item.text}
              onClick={() => navigate(item.path)}
              sx={{
                justifyContent: open ? 'initial' : 'center',
                px: 2.5,
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 0,
                  mr: open ? 3 : 'auto',
                  justifyContent: 'center',
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.text}
                sx={{ opacity: open ? 1 : 0 }}
              />
            </ListItem>
          ))}
        </List>
      </Drawer>

      {/* Main Content via React Router's <Outlet /> */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          mt: 4,
          ml: `${open ? drawerWidth - 150 : 1}px`,
          maxWidth: 'calc(100% - 10%)',
          overflowX: 'hidden',
          transition: theme.transitions.create(['margin-left', 'width'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.standard,
          }),
        }}
      >
        <DrawerHeader />
        {/* This is where manager pages get rendered */}
        <Outlet />
      </Box>
    </Box>
  );
};

ManagerDashboardLayout.propTypes = {
  activeRole: PropTypes.string.isRequired,
  setActiveRole: PropTypes.func.isRequired,
  userRoles: PropTypes.arrayOf(PropTypes.string).isRequired,
  onSignOut: PropTypes.func.isRequired,
};

export default ManagerDashboardLayout;
