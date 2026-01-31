// frontend/src/modules/admin/pages/SettingsPage.jsx

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Switch,
  Divider,
  CircularProgress,
} from '@mui/material';
import { getCalendarLocked, setCalendarLocked } from '../../../api/globalSettings';

const SettingsPage = () => {
  const [calendarLocked, setCalendarLockedState] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load the current setting on mount
  useEffect(() => {
    (async () => {
      try {
        const locked = await getCalendarLocked();
        setCalendarLockedState(locked);
      } catch (err) {
        console.error('Failed to load settings', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Toggle handler
  const handleToggle = async (event) => {
    const newValue = event.target.checked;
    setSaving(true);
    try {
      await setCalendarLocked(newValue);
      setCalendarLockedState(newValue);
    } catch (err) {
      console.error('Failed to save setting', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>
      <Typography variant="subtitle1" gutterBottom>
        Configure global platform behavior
      </Typography>

      <Paper variant="outlined">
        <List>
          <ListItem>
            <ListItemText
              primary="Calendar Lock"
              secondary="When enabled, past weeks auto-lock and future days are blocked."
            />
            <ListItemSecondaryAction>
              <Switch
                edge="end"
                checked={calendarLocked}
                onChange={handleToggle}
                disabled={saving}
                inputProps={{ 'aria-label': 'Calendar locked' }}
              />
            </ListItemSecondaryAction>
          </ListItem>
          <Divider />
          {/* Future settings go here */}
        </List>
      </Paper>
    </Box>
  );
};

export default SettingsPage;
