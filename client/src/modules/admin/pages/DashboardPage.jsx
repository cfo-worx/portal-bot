// frontend/src/pages/DashboardPage.jsx

import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  IconButton,
  FormControlLabel,
  RadioGroup,
  Radio,
  Button,
  TextField,
  Tooltip,
} from '@mui/material';
import { DataGrid, GridToolbar } from '@mui/x-data-grid';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
dayjs.extend(isBetween);

import { getTimecardLinesWithDetails } from '../../../api/timecards';
import './DashboardPage.css';

const DashboardPage = () => {
  // Data states
  const [allLines, setAllLines] = useState([]); // Full fetched data (approved only)
  const [rawLines, setRawLines] = useState([]); // Data after date filtering
  const [rows, setRows] = useState([]);         // Transformed hierarchy
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Grouping toggle: 'consultant' or 'client'
  const [groupBy, setGroupBy] = useState('consultant');

  // Expand/Collapse sets for group rows
  const [expandedGroupOne, setExpandedGroupOne] = useState(new Set());
  const [expandedGroupTwo, setExpandedGroupTwo] = useState(new Set());
  const [allExpanded, setAllExpanded] = useState(false);

  // Radio selection for export
  const [selectedGroupRowId, setSelectedGroupRowId] = useState(null);

  // Date filter states (stored as strings in YYYY-MM-DD)
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Debug panel toggle
  const [showDebugPanel, setShowDebugPanel] = useState(false);

  useEffect(() => {
    fetchLineDetails();
  }, []);

  // Instead of checking if (rawLines.length > 0), always update rows:
  useEffect(() => {
    const transformed = transformData(rawLines); // This works even if rawLines is empty
    setRows(transformed);
    // Reset expansions, selection, and global toggle when the rawLines change:
    setExpandedGroupOne(new Set());
    setExpandedGroupTwo(new Set());
    setSelectedGroupRowId(null);
    setAllExpanded(false);
  }, [groupBy, rawLines]);

  // When startDate, endDate, or allLines change, apply date filtering
  useEffect(() => {
    applyDateFilter(allLines);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, allLines]);

  // Fetch detailed lines from API (only approved)
  const fetchLineDetails = async () => {
    try {
      const lines = await getTimecardLinesWithDetails();
      // Filter to approved records only
      const approvedLines = lines.filter(
        (line) => line.Status && line.Status.toLowerCase() === 'approved'
      );
      setAllLines(approvedLines);
      // Immediately apply date filter
      applyDateFilter(approvedLines);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching line details:', err);
      setError(true);
      setLoading(false);
    }
  };

  // Apply date filter using dayjs (inclusive). If a date is blank, assume earliest/latest.
  const applyDateFilter = (lines) => {
    const start = startDate ? dayjs(startDate, 'YYYY-MM-DD') : dayjs('1900-01-01');
    const end = endDate ? dayjs(endDate, 'YYYY-MM-DD') : dayjs('2199-12-31');

    const filtered = lines.filter((line) => {
      const d = dayjs(line.TimesheetDate).add(1, 'day').startOf('day');
      return d.isBetween(start, end, 'day', '[]'); // Inclusive of endpoints
    });
    
    // 🔑 Sort oldest → newest once, before grouping functions walk the list
filtered.sort((a, b) =>
    dayjs(a.TimesheetDate).diff(dayjs(b.TimesheetDate))
  );
  
  setRawLines(filtered);


    console.log(`Filtering lines between ${start.format('YYYY-MM-DD')} and ${end.format('YYYY-MM-DD')}.`);
    console.log(`Total lines: ${lines.length}, Filtered lines: ${filtered.length}`);
  };

  // Handlers for date changes with validation
  const handleStartDateChange = (e) => {
    const newStartVal = e.target.value; // e.g. "2025-02-01"
    const newStartDate = newStartVal ? dayjs(newStartVal, 'YYYY-MM-DD') : null;

    if (endDate && newStartDate) {
      const endDateParsed = dayjs(endDate, 'YYYY-MM-DD');
      if (newStartDate.isAfter(endDateParsed)) {
        alert("Start date cannot be after End date");
        return;
      }
    }
    setStartDate(newStartVal);
  };

  const handleEndDateChange = (e) => {
    const newEndVal = e.target.value;
    const newEndDate = newEndVal ? dayjs(newEndVal, 'YYYY-MM-DD') : null;

    if (startDate && newEndDate) {
      const startDateParsed = dayjs(startDate, 'YYYY-MM-DD');
      if (newEndDate.isBefore(startDateParsed)) {
        alert("End date cannot be before Start date");
        return;
      }
    }
    setEndDate(newEndVal);
  };

  // Toggle global expand/collapse for all groups
  const handleToggleExpandAll = () => {
    if (allExpanded) {
      setExpandedGroupOne(new Set());
      setExpandedGroupTwo(new Set());
      setAllExpanded(false);
    } else {
      const groupOneIds = new Set(rows.filter(row => row.isGroupOne).map(row => row.id));
      const groupTwoIds = new Set(rows.filter(row => row.isGroupTwo).map(row => row.id));
      setExpandedGroupOne(groupOneIds);
      setExpandedGroupTwo(groupTwoIds);
      setAllExpanded(true);
    }
  };

  // Toggle debug panel visibility
  const toggleDebugPanel = () => {
    setShowDebugPanel((prev) => !prev);
  };

  // ✅ UPDATED: include 'role' branch
const transformData = (lines) => {
  if (groupBy === 'consultant') return groupByConsultantThenClient(lines);
  if (groupBy === 'client') return groupByClientThenConsultant(lines);
  // 'role'
  return groupByRoleThenConsultant(lines);
};


  // Summation helper for client, non-client, other hours
  const sumHours = (records) => {
    let cf = 0, nc = 0, ot = 0;
    records.forEach((r) => {
      cf += parseFloat(r.ClientFacingHours) || 0;
      nc += parseFloat(r.NonClientFacingHours) || 0;
      ot += parseFloat(r.OtherTaskHours) || 0;
    });
    return {
      clientHrs: cf,
      nonClientHrs: nc,
      otherHrs: ot,
      totalHrs: cf + nc + ot,
    };
  };

  // Format date for display in the table cells
// Format date for display in the table cells (+1 day to offset the UTC stamp)
const formatDate = (isoString) => {
  if (!isoString) return '';

  const d = dayjs(isoString).add(1, 'day');   // bump forward one day
  if (!d.isValid()) return '';

  return d.format('MMM D, YYYY');              // e.g. “May 1, 2025”
};


  // Group by consultant => client => detail
  const groupByConsultantThenClient = (lines) => {
    const consultantGroups = {};

    lines.forEach((line) => {
      const consName = `${line.FirstName} ${line.LastName}`.trim() || 'Unknown';
      if (!consultantGroups[consName]) {
        consultantGroups[consName] = [];
      }
      consultantGroups[consName].push(line);
    });

    const transformedRows = [];

    Object.entries(consultantGroups)
      .sort(([nameA], [nameB]) => nameA.localeCompare(nameB)) // Sort consultants alphabetically
      .forEach(([consultantName, cLines]) => {
        const sums = sumHours(cLines);
        const consultantId = cLines[0].ConsultantID || `unknown-consultant-${consultantName}`;

        // Level 0 row (groupOne)
        transformedRows.push({
          id: `consultant-${consultantId}`,
          level: 0,
          isGroupOne: true,
          groupOneId: consultantId,
          groupOneName: consultantName,
          aggClientHrs: sums.clientHrs,
          aggNonClientHrs: sums.nonClientHrs,
          aggOtherHrs: sums.otherHrs,
          aggTotalHrs: sums.totalHrs,
        });

        // Then group by client
        const clientGroups = {};
        cLines.forEach((line) => {
          const clName = line.ClientName || 'Unknown Client';
          if (!clientGroups[clName]) {
            clientGroups[clName] = [];
          }
          clientGroups[clName].push(line);
        });

        Object.entries(clientGroups)
          .sort(([clientA], [clientB]) => clientA.localeCompare(clientB)) // Sort clients alphabetically
          .forEach(([clientName, clientLines]) => {
            const clientSums = sumHours(clientLines);
            const clientId = `${consultantId}-${clientName}`;

            // Level 1 row (groupTwo)
            transformedRows.push({
              id: `client-${clientId}`,
              level: 1,
              isGroupTwo: true,
              parentId: `consultant-${consultantId}`,
              groupTwoName: clientName,
              aggClientHrs: clientSums.clientHrs,
              aggNonClientHrs: clientSums.nonClientHrs,
              aggOtherHrs: clientSums.otherHrs,
              aggTotalHrs: clientSums.totalHrs,
            });

            // Detail rows (level 2)
            clientLines.forEach((line) => {
              transformedRows.push({
                id: `line-${line.TimecardLineID}`,
                level: 2,
                parentId: `client-${clientId}`,
                isDetail: true,
                TimesheetDate: formatDate(line.TimesheetDate),
                projectName: line.ProjectName || '',
                projectTask: line.ProjectTask || '',
                clientFacingHours: parseFloat(line.ClientFacingHours) || 0,
                nonClientFacingHours: parseFloat(line.NonClientFacingHours) || 0,
                otherTaskHours: parseFloat(line.OtherTaskHours) || 0,
                totalHours: (
                  (parseFloat(line.ClientFacingHours) || 0) +
                  (parseFloat(line.NonClientFacingHours) || 0) +
                  (parseFloat(line.OtherTaskHours) || 0)
                ).toFixed(2),
                ConsultantName: consultantName,
                ClientName: clientName,
              });
            });
          });
      });

    return transformedRows;
  };

  // Group by client => consultant => detail
  const groupByClientThenConsultant = (lines) => {
    const clientGroups = {};

    lines.forEach((line) => {
      const clName = line.ClientName || 'Unknown Client';
      if (!clientGroups[clName]) {
        clientGroups[clName] = [];
      }
      clientGroups[clName].push(line);
    });

    const transformedRows = [];

    Object.entries(clientGroups)
      .sort(([clientA], [clientB]) => clientA.localeCompare(clientB)) // Sort clients alphabetically
      .forEach(([clientName, cLines]) => {
        const sums = sumHours(cLines);
        const clientId = `client-${clientName}`;

        // Level 0 row (groupOne)
        transformedRows.push({
          id: clientId,
          level: 0,
          isGroupOne: true,
          groupOneId: clientId,
          groupOneName: clientName,
          aggClientHrs: sums.clientHrs,
          aggNonClientHrs: sums.nonClientHrs,
          aggOtherHrs: sums.otherHrs,
          aggTotalHrs: sums.totalHrs,
        });

        // Then group by consultant
        const consultantGroups = {};
        cLines.forEach((line) => {
          const consName = `${line.FirstName} ${line.LastName}`.trim() || 'Unknown';
          if (!consultantGroups[consName]) {
            consultantGroups[consName] = [];
          }
          consultantGroups[consName].push(line);
        });

        Object.entries(consultantGroups)
          .sort(([nameA], [nameB]) => nameA.localeCompare(nameB)) // Sort consultants alphabetically
          .forEach(([consultantName, consultantLines]) => {
            const sums2 = sumHours(consultantLines);
            const consultantId =
              consultantLines[0].ConsultantID || `unknown-consultant-${consultantName}`;

            // Level 1 row (groupTwo)
            transformedRows.push({
              id: `consultant-${clientId}-${consultantId}`,
              level: 1,
              isGroupTwo: true,
              parentId: clientId,
              groupTwoName: consultantName,
              aggClientHrs: sums2.clientHrs,
              aggNonClientHrs: sums2.nonClientHrs,
              aggOtherHrs: sums2.otherHrs,
              aggTotalHrs: sums2.totalHrs,
            });

            // Detail rows (level 2)
            consultantLines.forEach((line) => {
              transformedRows.push({
                id: `line-${line.TimecardLineID}`,
                level: 2,
                parentId: `consultant-${clientId}-${consultantId}`,
                isDetail: true,
                TimesheetDate: formatDate(line.TimesheetDate),
                projectName: line.ProjectName || '',
                projectTask: line.ProjectTask || '',
                clientFacingHours: parseFloat(line.ClientFacingHours) || 0,
                nonClientFacingHours: parseFloat(line.NonClientFacingHours) || 0,
                otherTaskHours: parseFloat(line.OtherTaskHours) || 0,
                totalHours: (
                  (parseFloat(line.ClientFacingHours) || 0) +
                  (parseFloat(line.NonClientFacingHours) || 0) +
                  (parseFloat(line.OtherTaskHours) || 0)
                ).toFixed(2),
                ConsultantName: consultantName,
                ClientName: clientName,
              });
            });
          });
      });

    return transformedRows;
  };

  // ✅ NEW: group by JobTitle (Role) => detail rows
// ✅ NEW: group by JobTitle (Role) => Consultant => detail rows
const groupByRoleThenConsultant = (lines) => {
  const roleGroups = {};

  // Bucket by role
  lines.forEach((line) => {
    const roleName = (line.JobTitle && String(line.JobTitle).trim()) || 'Unknown Role';
    if (!roleGroups[roleName]) roleGroups[roleName] = [];
    roleGroups[roleName].push(line);
  });

  const transformedRows = [];

  // Sort roles alphabetically for stable UX
  Object.entries(roleGroups)
    .sort(([roleA], [roleB]) => roleA.localeCompare(roleB))
    .forEach(([roleName, roleLines]) => {
      // Top-level sums per role
      const roleSums = sumHours(roleLines);
      const roleId = `role-${roleName}`;

      // Level 0 (groupOne)
      transformedRows.push({
        id: roleId,
        level: 0,
        isGroupOne: true,
        groupOneId: roleId,
        groupOneName: roleName, // shows in Description col
        aggClientHrs: roleSums.clientHrs,
        aggNonClientHrs: roleSums.nonClientHrs,
        aggOtherHrs: roleSums.otherHrs,
        aggTotalHrs: roleSums.totalHrs,
      });

      // Now group within each role by consultant
      const consultantGroups = {};
      roleLines.forEach((line) => {
        const consultantName = `${line.FirstName || ''} ${line.LastName || ''}`.trim() || 'Unknown';
        if (!consultantGroups[consultantName]) consultantGroups[consultantName] = [];
        consultantGroups[consultantName].push(line);
      });

      // Sort consultants alphabetically
      Object.entries(consultantGroups)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([consultantName, consultantLines]) => {
          const sums = sumHours(consultantLines);
          const consultantId = consultantLines[0].ConsultantID || `unknown-consultant-${consultantName}`;
          const roleConsultantId = `consultant-${roleId}-${consultantId}`;

          // Level 1 (groupTwo)
          transformedRows.push({
            id: roleConsultantId,
            level: 1,
            isGroupTwo: true,
            parentId: roleId,
            groupTwoName: consultantName, // shows in Description col
            aggClientHrs: sums.clientHrs,
            aggNonClientHrs: sums.nonClientHrs,
            aggOtherHrs: sums.otherHrs,
            aggTotalHrs: sums.totalHrs,
          });

          // Level 2 detail rows under each consultant
          consultantLines.forEach((line) => {
            transformedRows.push({
              id: `line-${line.TimecardLineID}`,
              level: 2,
              parentId: roleConsultantId,
              isDetail: true,
              TimesheetDate: formatDate(line.TimesheetDate),
              projectName: line.ProjectName || '',
              projectTask: line.ProjectTask || '',
              clientFacingHours: parseFloat(line.ClientFacingHours) || 0,
              nonClientFacingHours: parseFloat(line.NonClientFacingHours) || 0,
              otherTaskHours: parseFloat(line.OtherTaskHours) || 0,
              totalHours: (
                (parseFloat(line.ClientFacingHours) || 0) +
                (parseFloat(line.NonClientFacingHours) || 0) +
                (parseFloat(line.OtherTaskHours) || 0)
              ).toFixed(2),
              ConsultantName: consultantName,
              ClientName: line.ClientName || '',
              RoleName: roleName,
            });
          });
        });
    });

  return transformedRows;
};


// ✅ UPDATED: generic two-level expansion logic for all modes
const getVisibleRows = () => {
  const visible = [];
  rows.forEach((row) => {
    if (row.isGroupOne) {
      visible.push(row);
    } else if (row.isGroupTwo) {
      if (expandedGroupOne.has(row.parentId)) {
        visible.push(row);
      }
    } else if (row.isDetail) {
      const groupTwoRow = rows.find((r) => r.id === row.parentId);
      if (groupTwoRow) {
        const groupOneRow = rows.find((r) => r.id === groupTwoRow.parentId);
        if (
          expandedGroupOne.has(groupOneRow?.id) &&
          expandedGroupTwo.has(groupTwoRow.id)
        ) {
          visible.push(row);
        }
      }
    }
  });
  return visible;
};



  // Expand/collapse groupOne (level 0)
  const toggleExpandGroupOne = (rowId) => {
    const newSet = new Set(expandedGroupOne);
    if (expandedGroupOne.has(rowId)) {
      newSet.delete(rowId);
    } else {
      newSet.add(rowId);
    }
    setExpandedGroupOne(newSet);
  };

  // Expand/collapse groupTwo (level 1)
  const toggleExpandGroupTwo = (rowId) => {
    const newSet = new Set(expandedGroupTwo);
    if (expandedGroupTwo.has(rowId)) {
      newSet.delete(rowId);
    } else {
      newSet.add(rowId);
    }
    setExpandedGroupTwo(newSet);
  };

  // GroupBy radio change handler
  const handleGroupByChange = (e) => {
    setGroupBy(e.target.value);
  };

  // Radio selection for export
  const handleSelectGroupRow = (rowId) => {
    setSelectedGroupRowId((prev) => (prev === rowId ? null : rowId));
  };

  // Export detail rows under selected group row to CSV
  const handleExportToExcel = () => {
    if (!selectedGroupRowId) {
      alert('No group row selected. Please select a group row first.');
      return;
    }

    const detailRows = getDetailRowsUnderSelected(selectedGroupRowId);
    if (detailRows.length === 0) {
      alert('No detail records under this group to export.');
      return;
    }

    const headers = [
      'TimesheetDate',
      'ProjectName',
      'ProjectTask',
      'ClientFacingHours',
      'NonClientFacingHours',
      'OtherTaskHours',
      'TotalHours',
      'ConsultantName',
      'ClientName',
    ];
    const csvRows = [headers.join(',')];

    detailRows.forEach((row) => {
      const csvData = [
        row.TimesheetDate || '',
        row.projectName || '',
        row.projectTask || '',
        row.clientFacingHours,
        row.nonClientFacingHours,
        row.otherTaskHours,
        row.totalHours,
        row.ConsultantName || '',
        row.ClientName || '',
      ].map((val) => `"${val}"`); // quote each field to keep alignment
      csvRows.push(csvData.join(','));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'dashboard_export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Gather detail rows under selected group row
  const getDetailRowsUnderSelected = (selectedId) => {
    const selectedRow = rows.find((r) => r.id === selectedId);
    if (!selectedRow) return [];

    const result = [];
    if (selectedRow.isGroupOne) {
      const groupTwoRows = rows.filter(
        (r) => r.isGroupTwo && r.parentId === selectedRow.id
      );
      groupTwoRows.forEach((g2) => {
        const detail = rows.filter((d) => d.isDetail && d.parentId === g2.id);
        result.push(...detail);
      });
    } else if (selectedRow.isGroupTwo) {
      const detail = rows.filter((d) => d.isDetail && d.parentId === selectedRow.id);
      result.push(...detail);
    }
    return result;
  };

  // DataGrid Columns definition
  const columns = [
    {
      field: 'select',
      headerName: '',
      width: 50,
      sortable: false,
      renderCell: (params) => {
        const { row } = params;
        if (row.isGroupOne || row.isGroupTwo) {
          const isSelected = selectedGroupRowId === row.id;
          return (
            <IconButton
              size="small"
              onClick={() => handleSelectGroupRow(row.id)}
              color={isSelected ? 'primary' : 'default'}
            >
              {isSelected ? <RadioButtonCheckedIcon /> : <RadioButtonUncheckedIcon />}
            </IconButton>
          );
        }
        return null;
      },
    },
    {
      field: 'description',
      headerName: 'Description',
      flex: 2,
      renderCell: (params) => {
        const { row } = params;
        const indent = row.level * 20;
        const style = {
          marginLeft: indent,
          fontWeight: row.isGroupOne || row.isGroupTwo ? 'bold' : 'normal',
        };

        if (row.isGroupOne) {
          const isExpanded = expandedGroupOne.has(row.id);
          return (
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <IconButton size="small" onClick={() => toggleExpandGroupOne(row.id)}>
                {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
              <div style={style}>{row.groupOneName}</div>
            </div>
          );
        }
        if (row.isGroupTwo) {
          const isExpanded = expandedGroupTwo.has(row.id);
          return (
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <IconButton size="small" onClick={() => toggleExpandGroupTwo(row.id)}>
                {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
              <div style={style}>{row.groupTwoName}</div>
            </div>
          );
        }
        if (row.isDetail) {
          return (
            <div style={style}>
              {`Project: ${row.projectName}`}
            </div>
          );
        }
        return null;
      },
    },
    {
      field: 'TimesheetDate',
      headerName: 'Date',
      width: 110,
      renderCell: (params) => {
        const { row } = params;
        return row.isDetail ? row.TimesheetDate : '';
      },
    },
    {
      field: 'aggClientHrs',
      headerName: 'Client Hrs',
      width: 100,
      headerAlign: 'right',
      align: 'right',
      renderCell: (params) => {
        const { row } = params;
        if (row.isGroupOne || row.isGroupTwo) {
          return row.aggClientHrs?.toFixed(2) || '';
        }
        if (row.isDetail) {
          return row.clientFacingHours.toFixed(2);
        }
        return '';
      },
    },
    {
      field: 'aggNonClientHrs',
      headerName: 'Non-Client Hrs',
      width: 110,
      headerAlign: 'right',
      align: 'right',
      renderCell: (params) => {
        const { row } = params;
        if (row.isGroupOne || row.isGroupTwo) {
          return row.aggNonClientHrs?.toFixed(2) || '';
        }
        if (row.isDetail) {
          return row.nonClientFacingHours.toFixed(2);
        }
        return '';
      },
    },
    {
      field: 'aggOtherHrs',
      headerName: 'Other Hrs',
      width: 90,
      headerAlign: 'right',
      align: 'right',
      renderCell: (params) => {
        const { row } = params;
        if (row.isGroupOne || row.isGroupTwo) {
          return row.aggOtherHrs?.toFixed(2) || '';
        }
        if (row.isDetail) {
          return row.otherTaskHours.toFixed(2);
        }
        return '';
      },
    },
    {
      field: 'aggTotalHrs',
      headerName: 'Total Hrs',
      width: 90,
      headerAlign: 'right',
      align: 'right',
      renderCell: (params) => {
        const { row } = params;
        if (row.isGroupOne || row.isGroupTwo) {
          return row.aggTotalHrs?.toFixed(2) || '';
        }
        if (row.isDetail) {
          return row.totalHours;
        }
        return '';
      },
    },
  ];

  return (
    <Box className="dashboard-container" sx={{ p: 2 }}>
      {/* Header and Export Button */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2,
        }}
      >
        <Typography variant="h4">Timesheet Dashboard</Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<FileDownloadIcon />}
          onClick={handleExportToExcel}
        >
          Export to Excel
        </Button>
      </Box>

      {/* Date Filters, Global Expand/Collapse, and Debug Toggle */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <TextField
          label="Start Date"
          type="date"
          value={startDate}
          onChange={handleStartDateChange}
          InputLabelProps={{ shrink: true }}
          size="small"
        />
        <TextField
          label="End Date"
          type="date"
          value={endDate}
          onChange={handleEndDateChange}
          InputLabelProps={{ shrink: true }}
          size="small"
        />
        <Tooltip title={allExpanded ? "Collapse All" : "Expand All"}>
          <IconButton onClick={handleToggleExpandAll}>
            {allExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Tooltip>
        <Button variant="outlined" onClick={toggleDebugPanel}>
          {showDebugPanel ? "Hide Debug Panel" : "Show Debug Panel"}
        </Button>
      </Box>

      {/* Debug Panel */}
      {showDebugPanel && (
        <Box sx={{ p: 2, border: '1px dashed gray', mb: 2 }}>
          <Typography variant="subtitle1" gutterBottom>Debug Panel</Typography>
          <Typography variant="body2">
            Selected Start Date (raw): {startDate || 'Not set'}
          </Typography>
          <Typography variant="body2">
            Selected End Date (raw): {endDate || 'Not set'}
          </Typography>
          <Typography variant="body2">
            Parsed Start Date: {startDate ? dayjs(startDate, 'YYYY-MM-DD').format('YYYY-MM-DD') : '1900-01-01'}
          </Typography>
          <Typography variant="body2">
            Parsed End Date: {endDate ? dayjs(endDate, 'YYYY-MM-DD').format('YYYY-MM-DD') : '2199-12-31'}
          </Typography>
          <Typography variant="body2">
            Total Fetched Lines (Approved): {allLines.length}
          </Typography>
          <Typography variant="body2">
            Filtered Lines (After Date Filter): {rawLines.length}
          </Typography>
        </Box>
      )}

      {/* Group By Radio */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle1" sx={{ mr: 2 }}>
          Group By:
        </Typography>
        <RadioGroup
  row
  name="groupBy"
  value={groupBy}
  onChange={handleGroupByChange}
>
  <FormControlLabel value="consultant" control={<Radio />} label="Consultant" />
  <FormControlLabel value="client" control={<Radio />} label="Client" />
  {/* ✅ NEW */}
  <FormControlLabel value="role" control={<Radio />} label="Role" />
</RadioGroup>
      </Box>

      {/* Main Content */}
      {loading ? (
        <Box sx={{ textAlign: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error" sx={{ mt: 2 }}>
          Failed to load timesheet data. Please try again later.
        </Alert>
      ) : rows.length === 0 ? (
        <Alert severity="info" sx={{ mt: 2 }}>
          No timesheet data available.
        </Alert>
      ) : (
        <div style={{ width: '100%' }}>
          <DataGrid
            rows={getVisibleRows()}
            columns={columns}
            components={{ Toolbar: GridToolbar }}
            disableSelectionOnClick
            autoHeight
            pageSize={10}
            rowsPerPageOptions={[10, 20, 50]}
            sx={{
              '& .MuiDataGrid-root': {
                fontSize: '0.75rem',
              },
              '& .MuiDataGrid-cell': {
                fontSize: '0.75rem',
                padding: '4px',
                '&:focus': {
                  outline: 'none',
                },
              },
              '& .MuiDataGrid-columnHeaders': {
                fontSize: '0.85rem',
                fontWeight: 'bold',
              },
              '& .MuiDataGrid-row': {
                maxHeight: '40px',
                '&:hover': {
                  backgroundColor: 'inherit !important',
                },
                '&.Mui-selected': {
                  backgroundColor: 'inherit !important',
                },
              },
              '& .MuiDataGrid-toolbarContainer': {
                minHeight: '40px',
              },
            }}
          />
        </div>
      )}
    </Box>
  );
};

export default DashboardPage;
