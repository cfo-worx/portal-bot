// frontend/src/components/Layout/ConsultantDashboardLayout.jsx

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
import WorkIcon from '@mui/icons-material/Work';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import AssignmentIcon from '@mui/icons-material/Assignment';
import LogoutIcon from '@mui/icons-material/Logout';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import BusinessCenterIcon from '@mui/icons-material/BusinessCenter';


import Logo from '../../assets/logo.png';

// Define drawer width percentages and min/max widths
const closedDrawerWidthPercentage = 0.08; // 8% of screen width
const openDrawerWidthPercentage = 0.15;  // 15% of screen width
const drawerMinWidth = 50;               // Minimum width when closed
const drawerMaxWidth = 200;              // Maximum width when open

const DrawerHeader = styled('div')(({ theme }) => ({
  ...theme.mixins.toolbar,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  padding: theme.spacing(0, 1),
}));

const AppBar = styled(MuiAppBar)(({ theme }) => ({
  backgroundColor: '#FFFFFF',
  borderBottom: '4px solid #0D47A1', // Blue bottom border
  color: '#0D47A1',                   // Blue text
  boxShadow: 'none',                 // Remove default shadow
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

const ConsultantDashboardLayout = ({
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

  // If user chooses "Admin" in the role switcher, send them to /dashboard/admin
  useEffect(() => {
    if (activeRole === 'Admin') {
      navigate('/dashboard/admin');
    }
  }, [activeRole, navigate]);

  // Adjust drawer width on window resize
  useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Drawer toggle
  const handleDrawerToggle = () => {
    setOpen((prevOpen) => !prevOpen);
  };

  // Calculate drawer width
  const closedDrawerWidth = Math.max(
    closedDrawerWidthPercentage * screenWidth,
    drawerMinWidth
  );
  const openDrawerWidth = Math.min(
    openDrawerWidthPercentage * screenWidth,
    drawerMaxWidth
  );
  const drawerWidth = open ? openDrawerWidth : closedDrawerWidth;

  // Show role switcher only if user has both Admin & Consultant roles
  const shouldShowRoleSwitcher =
    userRoles.includes('Admin') && userRoles.includes('Consultant');

  // Minimal Consultant nav: Just Calendar
  const menuItems = [
    { text: 'Calendar', icon: <AssignmentIcon />, path: '/dashboard/consultant/calendar' },
    { text: 'Feed', icon: <ChatBubbleOutlineIcon />, path: '/dashboard/consultant/feed' },
    { text: 'Projects', icon: <WorkIcon />, path: '/dashboard/consultant/projects' },
    { text: 'CRM', icon: <BusinessCenterIcon />, path: '/dashboard/consultant/crm' },

    // If you still want Timecard History or Settings:
    // { text: 'Timecard History', icon: <AssignmentIcon />, path: '/dashboard/consultant/history' },
    // { text: 'Settings', icon: <SettingsIcon />, path: '/dashboard/consultant/settings' },
  ];

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      {/* Top Bar */}
      <AppBar position="fixed">
        <Toolbar>
          {/* Drawer toggle button */}
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
            sx={{
              height: 40,
              marginRight: 2,
            }}
          />

          {/* Consultant Portal Text */}
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            Consultant Portal v1.6
          </Typography>

          {/* Role Switcher if user has multiple roles */}
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

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 1,
          ml: `${drawerWidth}px`,
          //maxWidth: 'calc(100% - 10%)',
          overflowX: 'hidden',
          transition: theme.transitions.create(['margin-left', 'width'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.standard,
          }),
        }}
      >
     
        <Outlet />
      </Box>
    </Box>
  );
};

ConsultantDashboardLayout.propTypes = {
  activeRole: PropTypes.string.isRequired,
  setActiveRole: PropTypes.func.isRequired,
  userRoles: PropTypes.arrayOf(PropTypes.string).isRequired,
  onSignOut: PropTypes.func.isRequired,
};

export default ConsultantDashboardLayout;
