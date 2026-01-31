import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Grid,
  Paper,
  TextField,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Stack,
  Alert,
} from '@mui/material';

const CATEGORY_OPTIONS = [
  { value: 'bug', label: 'Bug / Broken Functionality' },
  { value: 'ui_ux', label: 'UI / UX Issue' },
  { value: 'data', label: 'Data / Reporting Issue' },
  { value: 'access', label: 'Access / Permissions' },
  { value: 'integration', label: 'Integration / Sync' },
  { value: 'performance', label: 'Performance / Slow' },
  { value: 'feature_request', label: 'Feature Request' },
  { value: 'other', label: 'Other' },
];

const PRIORITY_OPTIONS = [
  { value: 'P0', label: 'P0 – Critical (blocking work / payroll / client deliverables)' },
  { value: 'P1', label: 'P1 – High' },
  { value: 'P2', label: 'P2 – Medium' },
  { value: 'P3', label: 'P3 – Low' },
];

const ENV_OPTIONS = [
  { value: 'production', label: 'Production' },
  { value: 'staging', label: 'Staging' },
  { value: 'local', label: 'Local Dev' },
  { value: 'unknown', label: 'Unknown' },
];

function getBrowserInfo() {
  try {
    const ua = navigator.userAgent;
    const lang = navigator.language;
    const screenSize = `${window.screen?.width || '?'}x${window.screen?.height || '?'}`;
    const viewport = `${window.innerWidth || '?'}x${window.innerHeight || '?'}`;
    return { ua, lang, screenSize, viewport };
  } catch {
    return { ua: 'unknown', lang: 'unknown', screenSize: 'unknown', viewport: 'unknown' };
  }
}

export default function TicketForm({ onSubmit }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('bug');
  const [priority, setPriority] = useState('P2');
  const [environment, setEnvironment] = useState('production');
  const [affectedPage, setAffectedPage] = useState('');
  const [affectedFeature, setAffectedFeature] = useState('');

  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState('');
  const [expected, setExpected] = useState('');
  const [actual, setActual] = useState('');

  const [files, setFiles] = useState([]);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const infoChips = useMemo(() => {
    const info = getBrowserInfo();
    return [
      { label: `Lang: ${info.lang}` },
      { label: `Screen: ${info.screenSize}` },
      { label: `Viewport: ${info.viewport}` },
    ];
  }, []);

  const handleSubmit = async () => {
    setError(null);

    const browser = getBrowserInfo();

    const payload = {
      title: title.trim(),
      description: description.trim(),
      category,
      priority,
      affectedPage: affectedPage.trim() || null,
      affectedFeature: affectedFeature.trim() || null,
      stepsToReproduce: steps.trim() || null,
      expectedBehavior: expected.trim() || null,
      actualBehavior: actual.trim() || null,
      environment,
      browserInfo: `${browser.ua} | lang=${browser.lang} | screen=${browser.screenSize} | viewport=${browser.viewport}`,
      appVersion: window?.__APP_VERSION__ || null,
      pageUrl: window.location.href,
      files,
    };

    setSubmitting(true);
    try {
      await onSubmit(payload, files);
      // reset
      setTitle('');
      setCategory('bug');
      setPriority('P2');
      setEnvironment('production');
      setAffectedPage('');
      setAffectedFeature('');
      setDescription('');
      setSteps('');
      setExpected('');
      setActual('');
      setFiles([]);
    } catch (e) {
      setError(e?.message || 'Failed to create ticket');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Create IT Ticket</Typography>
        <Stack direction="row" spacing={1}>
          {infoChips.map((c, idx) => (
            <Chip key={idx} size="small" label={c.label} />
          ))}
        </Stack>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={2}>
        <Grid item xs={12} md={8}>
          <TextField
            fullWidth
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Example: Client Health tab shows blank hours variance"
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <FormControl fullWidth>
            <InputLabel>Priority</InputLabel>
            <Select value={priority} label="Priority" onChange={(e) => setPriority(e.target.value)}>
              {PRIORITY_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} md={4}>
          <FormControl fullWidth>
            <InputLabel>Category</InputLabel>
            <Select value={category} label="Category" onChange={(e) => setCategory(e.target.value)}>
              {CATEGORY_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={4}>
          <FormControl fullWidth>
            <InputLabel>Environment</InputLabel>
            <Select value={environment} label="Environment" onChange={(e) => setEnvironment(e.target.value)}>
              {ENV_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={4}>
          <TextField
            fullWidth
            label="Affected Page / Route"
            value={affectedPage}
            onChange={(e) => setAffectedPage(e.target.value)}
            placeholder="Example: /dashboard/admin/reports"
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Affected Feature"
            value={affectedFeature}
            onChange={(e) => setAffectedFeature(e.target.value)}
            placeholder="Example: 'Include submitted' toggle"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <Button
            variant="outlined"
            component="label"
            fullWidth
            sx={{ height: '56px' }}
          >
            Upload Screenshots / Files
            <input
              type="file"
              hidden
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
            />
          </Button>
        </Grid>

        {files.length > 0 && (
          <Grid item xs={12}>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {files.map((f) => (
                <Chip key={f.name} label={`${f.name} (${Math.round((f.size || 0) / 1024)} KB)`} sx={{ mb: 1 }} />
              ))}
            </Stack>
          </Grid>
        )}

        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            minRows={4}
            placeholder="Describe what is wrong + business impact"
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Steps to Reproduce"
            value={steps}
            onChange={(e) => setSteps(e.target.value)}
            multiline
            minRows={4}
            placeholder="1) Go to ... 2) Click ... 3) Observe ..."
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <TextField
            fullWidth
            label="Expected Behavior"
            value={expected}
            onChange={(e) => setExpected(e.target.value)}
            multiline
            minRows={4}
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <TextField
            fullWidth
            label="Actual Behavior"
            value={actual}
            onChange={(e) => setActual(e.target.value)}
            multiline
            minRows={4}
          />
        </Grid>
      </Grid>

      <Box display="flex" justifyContent="flex-end" mt={3}>
        <Button variant="contained" onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit Ticket'}
        </Button>
      </Box>

      <Box mt={2}>
        <Typography variant="caption" color="text.secondary">
          This form auto-attaches current page URL + browser/screen details. For data issues, include the filter settings (client, consultant, period) used.
        </Typography>
      </Box>
    </Paper>
  );
}

