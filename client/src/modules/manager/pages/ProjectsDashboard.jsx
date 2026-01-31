// src/modules/manager/pages/ProjectsDashboard.jsx

import React, { useEffect, useState, useMemo } from 'react';
import dayjs from 'dayjs';

import {
  Box,
  Grid,
  Card,
  CardHeader,
  CardContent,
  Typography,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
} from '@mui/material';

import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CloseIcon from '@mui/icons-material/Close';
import { projectService } from '../../../api/projects';

// A navy‐blue constant matching your brand palette
const NAVY = '#1f3c88';

const ProjectsDashboard = () => {
  const [rawRows, setRawRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Which category‐modal is currently open: 'Active' | 'Completed' | 'On-Hold' | 'Recurring' | null
  const [openCategory, setOpenCategory] = useState(null);

  // 1) Fetch all “flat” rows (ensure API returns RecurrenceIndex, RecurrenceType, IntervalValue, PeriodCount, etc.)
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const data = await projectService.getAll();
        setRawRows(data);
      } catch (err) {
        console.error(err);
        setError('Failed to load projects');
      } finally {
        setLoading(false);
      }
    };
    loadProjects();
  }, []);

  // 2) Deduplicate into exactly one object per ProjectID
  const uniqueProjects = useMemo(() => {
    const map = new Map();
    rawRows.forEach((row) => {
      const id = row.ProjectID;
      if (!map.has(id)) {
        map.set(id, {
          ProjectID: row.ProjectID,
          ProjectName: row.ProjectName,
          ClientName: row.ClientName,
          StartDate: row.StartDate,             // e.g. '2025-05-30'
          Status: row.Status,                   // 'Active' | 'Completed' | 'On-Hold' | …
          Recurring: row.Recurring === 1 || row.Recurring === true,
          RecurrenceType: row.RecurrenceType,   // 'weekly' | 'biweekly' | 'monthly' | null
          IntervalValue: row.IntervalValue,     // integer or null
          RecurrenceIndex: row.RecurrenceIndex, // integer or null
          PeriodCount: row.PeriodCount,         // integer or null
        });
      }
    });
    return Array.from(map.values());
  }, [rawRows]);

  // 3) Count projects by status + count “Recurring” overall
  const statusCounts = useMemo(() => {
    const counts = { Active: 0, Completed: 0, 'On-Hold': 0, Recurring: 0 };
    uniqueProjects.forEach((p) => {
      if (p.Status === 'Active') counts.Active++;
      else if (p.Status === 'Completed') counts.Completed++;
      else if (p.Status === 'On-Hold') counts['On-Hold']++;
      if (p.Recurring) counts.Recurring++;
    });
    return counts;
  }, [uniqueProjects]);

  // 4) Replicate SQL’s “next run” logic in JS:
  //    CASE
  //      WHEN RecurrenceType IN ('weekly','biweekly') THEN
  //        DATEADD(WEEK, IntervalValue * (RecurrenceIndex+1), StartDate)
  //      WHEN RecurrenceType = 'monthly' THEN
  //        DATEADD(MONTH, IntervalValue * (RecurrenceIndex+1), StartDate)
  //      ELSE NULL
  //    END
  //  Only if Recurring = 1 AND (PeriodCount IS NULL OR RecurrenceIndex < PeriodCount).
  const computeNextRun = (p) => {
    if (
      !p.Recurring ||
      !p.StartDate ||
      p.RecurrenceIndex == null ||
      p.RecurrenceType == null ||
      p.IntervalValue == null
    ) {
      return null;
    }
    // Exclude if RecurrenceIndex ≥ PeriodCount
    if (p.PeriodCount != null && p.RecurrenceIndex >= p.PeriodCount) {
      return null;
    }
    const base = dayjs(p.StartDate, 'YYYY-MM-DD');
    const nextIndex = p.RecurrenceIndex + 1;

    if (p.RecurrenceType === 'weekly' || p.RecurrenceType === 'biweekly') {
      return base.add(p.IntervalValue * nextIndex, 'week');
    }
    if (p.RecurrenceType === 'monthly') {
      return base.add(p.IntervalValue * nextIndex, 'month');
    }
    if (p.RecurrenceType === 'quarterly') {
      const multiplier = p.IntervalValue * nextIndex;
      return base.add(multiplier * 3, 'month'); // quarterly: multiplier * 3 months
    }
    if (p.RecurrenceType === 'yearly') {
      return base.add(p.IntervalValue * nextIndex, 'year');
    }
    return null;
  };

  // 5) “Upcoming recurring” = those whose nextRun is between today and 7 days from today
  const upcomingRecurring = useMemo(() => {
    const now = dayjs();
    const oneWeekLater = now.add(7, 'day');

    return uniqueProjects
      .map((p) => {
        const nextRun = computeNextRun(p);
        // DEBUG:
        console.log(
          p.ProjectID,
          p.ProjectName,
          '→ nextRun =',
          nextRun ? nextRun.format('YYYY-MM-DD') : 'null'
        );
        return { ...p, nextRun };
      })
      .filter((p) => {
        return (
          p.Recurring &&
          p.nextRun &&
          // ≥ today:
          !p.nextRun.isBefore(now.startOf('day')) &&
          // ≤ oneWeekLater:
          !p.nextRun.isAfter(oneWeekLater.endOf('day'))
        );
      })
      .sort((a, b) => a.nextRun.valueOf() - b.nextRun.valueOf());
  }, [uniqueProjects]);

  // 6) Prepare lists for each category so that clicking a tile shows a modal
  const listsByCategory = useMemo(() => {
    return {
      Active: uniqueProjects.filter((p) => p.Status === 'Active'),
      Completed: uniqueProjects.filter((p) => p.Status === 'Completed'),
      'On-Hold': uniqueProjects.filter((p) => p.Status === 'On-Hold'),
      Recurring: uniqueProjects.filter((p) => p.Recurring),
    };
  }, [uniqueProjects]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  const handleCloseModal = () => setOpenCategory(null);

  return (
    <Box sx={{ p: 4, backgroundColor: '#f5f7fa', minHeight: '100vh' }}>
      <Typography variant="h4" gutterBottom>
        Projects Dashboard
      </Typography>

      {/* ===== Summary Cards ===== */}
      <Grid container spacing={3}>
        {['Active', 'Completed', 'On-Hold', 'Recurring'].map((cat) => (
          <Grid item xs={12} sm={6} md={3} key={cat}>
            <Card
              sx={{
                boxShadow: 3,
                cursor: 'pointer',
                '&:hover': { boxShadow: 6 },
                borderTop: `4px solid ${NAVY}`,
              }}
              onClick={() => setOpenCategory(cat)}
            >
              <CardHeader
                title={`${cat} Projects`}
                sx={{
                  '& .MuiCardHeader-title': {
                    color: NAVY,
                    fontWeight: 600,
                  },
                }}
              />
              <CardContent>
                <Typography variant="h3" color={NAVY}>
                  {statusCounts[cat]}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  (Click to view details)
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* ===== Upcoming Recurring Section ===== */}
      <Box sx={{ mt: 4 }}>
        <Typography variant="h5" gutterBottom>
          Upcoming Recurring Projects (Next 7 Days)
        </Typography>

        {upcomingRecurring.length === 0 ? (
          <Typography>No recurring projects due in the next week.</Typography>
        ) : (
          <List sx={{ backgroundColor: '#fff', borderRadius: 1, boxShadow: 1 }}>
            {upcomingRecurring.map((p) => (
              <React.Fragment key={p.ProjectID}>
                <ListItem alignItems="flex-start" sx={{ px: 2, py: 1 }}>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 500, color: NAVY }}>
                          {p.ProjectName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {p.nextRun.format('MMM D, YYYY')}
                        </Typography>
                      </Box>
                    }
                    secondary={
                      <Typography variant="body2" color="text.secondary">
                        Status: {p.Status} | Recurrence: {p.RecurrenceType}
                      </Typography>
                    }
                  />
                </ListItem>
                <Divider component="li" />
              </React.Fragment>
            ))}
          </List>
        )}
      </Box>

      {/* ===== Drill into Recurring Accordion ===== */}
      <Box sx={{ mt: 4 }}>
        <Typography variant="h5" gutterBottom>
          Drill into Recurring Projects
        </Typography>

        <Grid container spacing={3}>
          {uniqueProjects
            .filter(
              (p) =>
                p.Recurring &&
                p.RecurrenceType != null &&
                p.IntervalValue != null &&
                p.RecurrenceIndex != null &&
                (p.PeriodCount == null || p.RecurrenceIndex < p.PeriodCount)
            )
            .map((p) => {
              const nextRun = computeNextRun(p);
              return (
                <Grid item xs={12} sm={6} md={4} key={p.ProjectID}>
                  <Accordion
                    sx={{
                      '& .MuiAccordionSummary-root': {
                        backgroundColor: '#fff',
                        borderBottom: `1px solid ${NAVY}`,
                      },
                      '& .MuiTypography-root': { color: NAVY },
                    }}
                  >
                    <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: NAVY }} />}>
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                          {p.ProjectName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Next Run: {nextRun ? nextRun.format('MMM D, YYYY') : '—'}
                        </Typography>
                      </Box>
                    </AccordionSummary>

                    <AccordionDetails>
                      <Typography variant="body2">
                        <strong>Client:</strong> {p.ClientName}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Start Date:</strong> {dayjs(p.StartDate).format('MMM D, YYYY')}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Recurrence Type:</strong> {p.RecurrenceType}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Interval:</strong> {p.IntervalValue}{' '}
                        {p.RecurrenceType === 'weekly' || p.RecurrenceType === 'biweekly' ? 'week(s)' :
                         p.RecurrenceType === 'monthly' ? 'month(s)' :
                         p.RecurrenceType === 'quarterly' ? 'quarter(s)' :
                         p.RecurrenceType === 'yearly' ? 'year(s)' : 'period(s)'}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Periods Left:</strong>{' '}
                        {p.PeriodCount == null ? 'Unlimited' : p.PeriodCount - p.RecurrenceIndex}
                      </Typography>
                    </AccordionDetails>
                  </Accordion>
                </Grid>
              );
            })}
        </Grid>
      </Box>

      {/* ===== Category Modal (grouped by Client, rolodex style) ===== */}
      <Dialog
        open={Boolean(openCategory)}
        onClose={handleCloseModal}
        fullWidth
        maxWidth="md"
        // Semi-transparent, blurred backdrop
        BackdropProps={{
          sx: {
            backgroundColor: 'rgba(0,0,0,0.3)',
            backdropFilter: 'blur(4px)',
          },
        }}
      >
        <DialogTitle
          sx={{
            backgroundColor: 'rgba(31,60,136,0.75)', // more transparent navy
            color: '#fff',
            fontWeight: 600,
            borderBottom: `2px solid ${NAVY}`,
          }}
        >
          {openCategory} Projects
          <IconButton
            aria-label="close"
            onClick={handleCloseModal}
            sx={{ position: 'absolute', right: 8, top: 8, color: '#fff' }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent
          dividers
          sx={{
            // Vertical scroll with scroll-snap
            maxHeight: '70vh',
            overflowY: 'auto',
            scrollSnapType: 'y mandatory',
            borderLeft: `4px solid ${NAVY}`,
          }}
        >
          {openCategory && listsByCategory[openCategory].length === 0 ? (
            <Typography sx={{ p: 2 }}>No {openCategory.toLowerCase()} projects found.</Typography>
          ) : (
            // Group the selected category’s projects by ClientName
            (() => {
              const categoryProjects = listsByCategory[openCategory] || [];
              // Build { [clientName]: [project, ...] }
              const grouped = categoryProjects.reduce((acc, p) => {
                const client = p.ClientName || 'Unknown Client';
                if (!acc[client]) acc[client] = [];
                acc[client].push(p);
                return acc;
              }, {});

              // Convert to array of [clientName, projectsArray]
              const entries = Object.entries(grouped);

              // Sort clients alphabetically
              entries.sort(([aName], [bName]) => aName.localeCompare(bName));

              return (
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    py: 1,
                    // Ensure each child snaps into view:
                    '& > div': {
                      scrollSnapAlign: 'start',
                    },
                  }}
                >
                  {entries.map(([client, projArray]) => {
                    // Sort that client's projects by StartDate descending
                    projArray.sort((a, b) =>
                      dayjs(b.StartDate).valueOf() - dayjs(a.StartDate).valueOf()
                    );

                    return (
                      <Box key={client} sx={{ scrollSnapAlign: 'start' }}>
                        <Card
                          sx={{
                            boxShadow: 2,
                            border: `1px solid ${NAVY}`,
                            borderRadius: 2,
                          }}
                        >
                          <CardHeader
                            title={client}
                            sx={{
                              backgroundColor: NAVY,
                              color: '#fff',
                              '& .MuiCardHeader-title': {
                                fontWeight: 600,
                                fontSize: '1rem',
                              },
                            }}
                          />
                          <CardContent>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                              {projArray.map((p) => {
                                const nextRun = computeNextRun(p);
                                return (
                                  <Card
                                    key={p.ProjectID}
                                    variant="outlined"
                                    sx={{
                                      mb: 1,
                                      borderRadius: 1,
                                      borderLeft: `4px solid ${NAVY}`,
                                      boxShadow: 6, // stronger shadow for “rolodex” card feel
                                      backgroundColor: '#fff',
                                    }}
                                  >
                                    <CardContent sx={{ py: 1 }}>
                                      <Box
                                        sx={{
                                          display: 'flex',
                                          justifyContent: 'space-between',
                                          alignItems: 'center',
                                        }}
                                      >
                                        <Typography
                                          variant="subtitle2"
                                          sx={{ fontWeight: 500, color: NAVY }}
                                        >
                                          {p.ProjectName}
                                        </Typography>
                                        {p.Recurring && nextRun && (
                                          <Typography
                                            variant="body2"
                                            color="text.secondary"
                                            sx={{ fontStyle: 'italic' }}
                                          >
                                            Next Run: {nextRun.format('MMM D, YYYY')}
                                          </Typography>
                                        )}
                                      </Box>
                                      <Box sx={{ mt: 0.5 }}>
                                        <Typography variant="body2">
                                          <strong>Start Date:</strong>{' '}
                                          {dayjs(p.StartDate).format('MMM D, YYYY')}
                                        </Typography>
                                        <Typography variant="body2">
                                          <strong>Status:</strong> {p.Status}
                                        </Typography>
                                        {p.Recurring && (
                                          <Typography variant="body2">
                                            <strong>Recurrence:</strong> {p.RecurrenceType},{' '}
                                            every {p.IntervalValue}{' '}
                                            {p.RecurrenceType === 'weekly' || p.RecurrenceType === 'biweekly'
                                              ? 'week(s)'
                                              : p.RecurrenceType === 'monthly'
                                              ? 'month(s)'
                                              : p.RecurrenceType === 'quarterly'
                                              ? 'quarter(s)'
                                              : p.RecurrenceType === 'yearly'
                                              ? 'year(s)'
                                              : 'period(s)'},{' '}
                                            {p.PeriodCount == null
                                              ? 'unlimited'
                                              : `${p.PeriodCount - p.RecurrenceIndex} left`}
                                          </Typography>
                                        )}
                                      </Box>
                                    </CardContent>
                                  </Card>
                                );
                              })}
                            </Box>
                          </CardContent>
                        </Card>
                      </Box>
                    );
                  })}
                </Box>
              );
            })()
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default ProjectsDashboard;
