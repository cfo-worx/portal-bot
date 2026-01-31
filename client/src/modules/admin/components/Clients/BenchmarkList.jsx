// src/modules/admin/components/BenchmarkList.jsx

import React, { useState, useEffect } from 'react';
import { DataGrid } from '@mui/x-data-grid';
import { IconButton, Tooltip, CircularProgress, Box } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { getActiveConsultants } from '../../../../api/consultants';

const BenchmarkList = ({
  benchmarks,
  onEditBenchmark,
  onDeleteBenchmark,
  monthlyRevenue,
  grossProfitTarget
}) => {
  const [consultants, setConsultants] = useState([]);
  const [loading, setLoading] = useState(true);

  // load pay rates
  useEffect(() => {
    let mounted = true;
    getActiveConsultants()
      .then(data => { if (mounted) setConsultants(data); })
      .catch(console.error)
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false };
  }, []);

  const findRate = id => {
    const consultant = consultants.find(c => c.ConsultantID === id);
    if (!consultant) return 0;
    
    // For Hourly consultants, use PayRate (which is already hourly)
    // For Salary consultants, use HourlyRate field
    if (consultant.PayType === 'Salary') {
      return consultant.HourlyRate ?? 0;
    }
    // Default to PayRate for Hourly or any other pay type
    return consultant.PayRate ?? 0;
  };

  if (loading) {
    return (
      <Box sx={{ width:'100%', py:4, textAlign:'center' }}>
        <CircularProgress/>
      </Box>
    );
  }

  // 1) net profit dollars
 const netAvailableForController = monthlyRevenue * ((100 - grossProfitTarget) / 100);


  // 2) total cost of non-controller consultants
  const costNonBench = benchmarks
    .filter(r => !r.calculatedBenchmark)
    .reduce((sum, r) => sum + findRate(r.ConsultantID) * r.TargetHours, 0);

  // 3) controller pay rate & hours
  const controllerRow = benchmarks.find(r => r.calculatedBenchmark);
  const controllerRate = controllerRow
    ? findRate(controllerRow.ConsultantID)
    : 0;
  const controllerHours =
  controllerRow && controllerRate > 0
    ? (netAvailableForController - costNonBench) / controllerRate
    : null;

  const columns = [
    {
      field: 'ConsultantName',
      headerName: 'Consultant',
      flex: 1,
      renderCell: params => {
        if(!params.row) return null;
        const dot = params.row.calculatedBenchmark
          ? <span style={{
              width:8, height:8, borderRadius:'50%',
              backgroundColor:'green', marginRight:6
            }}/>
          : null;
        return <span style={{display:'flex',alignItems:'center'}}>{dot}{params.value}</span>;
      }
    },
    {
      field: 'Rate',
      headerName: 'Rate',
      flex: 0.5,
      type: 'number',
      headerAlign:'right',
      align:'right',
      renderCell: params => {
        if(!params.row) return null;
        const rate = findRate(params.row.ConsultantID);
        return rate ? `$${rate.toFixed(2)}` : '';
      }
    },
    { field: 'Role', headerName: 'Role', flex:1 },
    { field: 'LowRangeHours', headerName: 'Low', flex:0.7, type:'number' },
    {
      field: 'TargetHours',
      headerName: 'Target',
      flex:0.7,
      type:'number',
      renderCell: params => {
        if(!params.row) return null;
        if (params.row.calculatedBenchmark) {
          // show computed controller hours
          return controllerHours != null
            ? controllerHours.toFixed(2)
            : <span style={{color:'red'}}>—</span>;
        }
        return params.value;
      }
    },
    { field: 'HighRangeHours', headerName: 'High', flex:0.7, type:'number' },
    {
      field: 'actions',
      headerName: 'Actions',
      flex:0.6,
      sortable:false,
      renderCell: params => {
        if(!params.row) return null;
        return (
          <>
            <Tooltip title="Edit">
              <IconButton size="small" onClick={()=>onEditBenchmark(params.row)}>
                <EditIcon fontSize="small"/>
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete">
              <IconButton size="small" onClick={()=>onDeleteBenchmark(params.row)}>
                <DeleteIcon fontSize="small"/>
              </IconButton>
            </Tooltip>
          </>
        );
      }
    }
  ];

  return (
    <div style={{height:400,width:'100%'}}>
      <DataGrid
        rows={benchmarks||[]}
        columns={columns}
        pageSize={5}
        getRowId={r=>r.BenchmarkID}
        disableSelectionOnClick
        sx={{
          '& .MuiDataGrid-cell': { fontSize:'0.85rem', padding:'4px 8px' },
          '& .MuiDataGrid-columnHeaderTitle': { fontSize:'0.9rem' }
        }}
      />
    </div>
  );
};

export default BenchmarkList;
