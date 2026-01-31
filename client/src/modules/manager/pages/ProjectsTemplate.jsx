// client/src/pages/ProjectsTemplate.jsx
import React, { useEffect, useState, useMemo } from 'react';
import dayjs from 'dayjs';

/* ─────────── MUI ─────────── */
import {
  Box, Card, CardHeader, CardContent, Typography,
  CircularProgress, IconButton, Tooltip, Chip,
  Accordion, AccordionSummary, AccordionDetails,
  Dialog, DialogTitle, DialogContent, DialogActions,
  FormControl, InputLabel, Select, MenuItem, TextField,
  Stack, Button
} from '@mui/material';
import ExpandMoreIcon   from '@mui/icons-material/ExpandMore';
import ContentCopyIcon  from '@mui/icons-material/ContentCopy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ArticleIcon      from '@mui/icons-material/Article';
import EditIcon         from '@mui/icons-material/Edit';
import AccessTimeIcon   from '@mui/icons-material/AccessTime';

/* ─────────── API ─────────── */
import { templateService } from '../../../api/templates';
import { getClients }      from '../../../api/clients';

/* theme tokens */
const PRIMARY   = '#1f3c88';
const SECONDARY = '#5a87f2';
const BORDER    = '#e1e4eb';
const ROW_ODD   = '#f7f9fc';
const ROW_EVEN  = '#ffffff';

/* ═════════════════════════════════════ */
/* data helper                           */
/* ═════════════════════════════════════ */
const groupTemplates = (flat) => {
  const map = {};
  flat.forEach(r => {
    if (!map[r.TemplateID]) map[r.TemplateID] = { ...r, Tasks: [] };
    if (r.TemplateTaskID &&
        !map[r.TemplateID].Tasks.some(t => t.TemplateTaskID === r.TemplateTaskID)) {
      map[r.TemplateID].Tasks.push({
        TemplateTaskID : r.TemplateTaskID,
        TaskName       : r.TaskName,
        Sequence       : r.Sequence,
        SubTasks       : []
      });
    }
    if (r.TemplateSubTaskID) {
      const tObj = map[r.TemplateID].Tasks.find(t => t.TemplateTaskID === r.TemplateTaskID);
      if (tObj && !tObj.SubTasks.some(s => s.TemplateSubTaskID === r.TemplateSubTaskID)) {
        tObj.SubTasks.push({
          TemplateSubTaskID: r.TemplateSubTaskID,
          SubTaskName      : r.SubTaskName,
          PlannedHours     : r.PlannedHours,
          Status           : r.Status
        });
      }
    }
  });
  Object.values(map).forEach(t => t.Tasks.sort((a,b) => a.Sequence - b.Sequence));
  return Object.values(map);
};

/* ═════════════════════════════════════ */
/* soft-row                              */
/* ═════════════════════════════════════ */
function SoftRow({ children, index, icon }) {
  const bg = index % 2 ? ROW_ODD : ROW_EVEN;
  return (
    <Box
      sx={{
        mt: 0.75, px: 2, py: 1, borderRadius: 1,
        background: bg, display:'flex', alignItems:'center',
        boxShadow:'inset 0 0 0 1px rgba(0,0,0,.02)'
      }}
    >
      <Box sx={{ mr: 1, color: SECONDARY }}>{icon}</Box>
      {children}
    </Box>
  );
}

/* ═════════════════════════════════════ */
/* component                             */
/* ═════════════════════════════════════ */
export default function ProjectsTemplate() {
  const [templates,   setTemplates]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);

  const [expandedIds, setExpandedIds] = useState({});
  const [dlgOpen,     setDlgOpen]     = useState(false);
  const [tmplToClone, setTmplToClone] = useState(null);

  const [clientList,  setClientList]  = useState([]);
  const [form, setForm] = useState({ ClientID:'', StartDate:dayjs().format('YYYY-MM-DD') });

  /* load once */
  useEffect(()=>{ (async()=>{
    try{
      const [tData,cData] = await Promise.all([templateService.getAll(), getClients()]);
      setTemplates(groupTemplates(tData));
      setClientList(cData);
    }catch(err){ setError(err.message);}
    finally{ setLoading(false);}
  })();},[]);

  const refreshTemplates = async()=>{ setTemplates(groupTemplates(await templateService.getAll())); };

  /* actions */
  const openClone = (tmpl)=>{ setTmplToClone(tmpl); setForm(f=>({...f,ClientID:clientList[0]?.ClientID||''})); setDlgOpen(true); };
  const confirmClone = async()=>{
    try{
      await templateService.clone(tmplToClone.TemplateID,{
        ProjectName:tmplToClone.TemplateName, ClientID:form.ClientID, StartDate:form.StartDate, Status:'Active'
      }); setDlgOpen(false); alert('Project created!');
    }catch{ setError('Clone failed'); }
  };
  const deleteTemplate = async(tmpl)=>{
    if(!window.confirm(`Delete template "${tmpl.TemplateName}"?`)) return;
    try{ await templateService.delete(tmpl.TemplateID); await refreshTemplates();}
    catch{ setError('Delete failed');}
  };

  const list = useMemo(()=>templates,[templates]);

  if(loading) return <Box sx={{p:4,textAlign:'center'}}><CircularProgress/></Box>;
  if(error)   return <Typography color="error">{error}</Typography>;

  return (
    <Box sx={{ p:2 }}>
      {list.map(tmpl=>{
        const totalSub = tmpl.Tasks.reduce((s,t)=>s+t.SubTasks.length,0);
        const totalHrs = tmpl.Tasks.reduce((s,t)=>s+t.SubTasks.reduce((ss,st)=>ss+(st.PlannedHours||0),0),0);

        return(
          <Card key={tmpl.TemplateID} sx={{ mb:2, border:`1px solid ${BORDER}`, borderRadius:2, boxShadow:'0 1px 4px rgba(31,60,136,.12)' }}>
            <CardHeader
              onClick={()=>setExpandedIds(p=>({...p,[tmpl.TemplateID]:!p[tmpl.TemplateID]}))}
              title={
                <Stack direction="row" spacing={1} alignItems="center">
                  <ExpandMoreIcon sx={{ transform:expandedIds[tmpl.TemplateID]?'rotate(180deg)':'none', transition:'0.25s', color:PRIMARY }} />
                  <Typography variant="subtitle1" sx={{ color:PRIMARY,fontWeight:500 }}>{tmpl.TemplateName}</Typography>
                </Stack>
              }
              subheader={
                <Stack direction="row" spacing={1} sx={{ mt:0.5, pb:1 }}>
                  <Chip variant="outlined" size="small"
                        icon={<ArticleIcon sx={{ fontSize:16 }} />}
                        label={`${tmpl.Tasks.length} tasks`}
                        sx={{ borderColor:PRIMARY,color:PRIMARY, px:1 }} />
                  <Chip variant="outlined" size="small"
                        icon={<EditIcon sx={{ fontSize:16 }} />}
                        label={`${totalSub} sub`}
                        sx={{ borderColor:PRIMARY,color:PRIMARY, px:1 }} />
                  {totalHrs>0 && (
                    <Chip variant="outlined" size="small"
                          icon={<AccessTimeIcon sx={{ fontSize:16 }} />}
                          label={`${totalHrs} h`}
                          sx={{ borderColor:PRIMARY,color:PRIMARY, px:1 }} />
                  )}
                </Stack>
              }
              sx={{ cursor:'pointer', '&:hover':{background:'#f5f7fa'}, pb:0 }}
              action={
                <Box>
                  <Tooltip title="Create Project from Template">
                    <IconButton size="small" sx={{color:SECONDARY, mr:0.5}}
                                onClick={e=>{e.stopPropagation();openClone(tmpl);}}>
                      <ContentCopyIcon fontSize="small"/>
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete Template">
                    <IconButton size="small" sx={{color:'#e53e3e'}}
                                onClick={e=>{e.stopPropagation();deleteTemplate(tmpl);}}>
                      <DeleteOutlineIcon fontSize="small"/>
                    </IconButton>
                  </Tooltip>
                </Box>
              }
            />

            {expandedIds[tmpl.TemplateID] && (
              <CardContent sx={{ pt:1.25 }}>
                {tmpl.Tasks.map((task,i)=>{
                  const hrs = task.SubTasks.reduce((s,st)=>s+(st.PlannedHours||0),0);
                  return(
                    <Accordion key={task.TemplateTaskID} disableGutters
                               sx={{ mb:1, background:'transparent', border:'none','&:before':{display:'none'} }}>
                      <AccordionSummary expandIcon={<ExpandMoreIcon sx={{color:SECONDARY}}/>}
                                        sx={{ px:0, '& .MuiAccordionSummary-content':{alignItems:'center'} }}>
                        <SoftRow index={i} icon={<ArticleIcon/>}>
                          <Typography sx={{ flexGrow:1, fontSize:'0.9rem', color:'#333' }}>{task.TaskName}</Typography>
                          <Chip variant="outlined" size="small" icon={<EditIcon sx={{fontSize:14}} />}
                                label={`${task.SubTasks.length}`} sx={{ mr:0.5, borderColor:SECONDARY, color:SECONDARY, fontSize:'0.7rem', height:22 }} />
                          {hrs>0 && (
                            <Chip variant="outlined" size="small" icon={<AccessTimeIcon sx={{fontSize:14}} />}
                                  label={`${hrs}h`} sx={{ borderColor:SECONDARY,color:SECONDARY, fontSize:'0.7rem', height:22 }} />
                          )}
                        </SoftRow>
                      </AccordionSummary>

                      <AccordionDetails sx={{ pt:1 }}>
                        {task.SubTasks.map((st,j)=>(
                          <SoftRow key={st.TemplateSubTaskID} index={j} icon={<EditIcon/>}>
                            <Typography sx={{ flexGrow:1, fontSize:'0.85rem', color:'#333' }}>
                              {st.SubTaskName}
                            </Typography>
                            <Typography sx={{ fontSize:'0.78rem', color:st.PlannedHours?'#555':'#bbb' }}>
                              {st.PlannedHours ? `${st.PlannedHours}h` : '—'}
                            </Typography>
                          </SoftRow>
                        ))}
                        {task.SubTasks.length===0 && (
                          <Typography variant="body2" sx={{ fontStyle:'italic', color:'#888', mt:0.5 }}>
                            No subtasks
                          </Typography>
                        )}
                      </AccordionDetails>
                    </Accordion>
                  );
                })}
              </CardContent>
            )}
          </Card>
        );
      })}

      {/* clone dialog */}
      <Dialog open={dlgOpen} onClose={()=>setDlgOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize:'1rem', fontWeight:500 }}>New Project from Template</DialogTitle>
        <DialogContent>
          <FormControl fullWidth size="small" sx={{ my:2 }}>
            <InputLabel>Client</InputLabel>
            <Select label="Client" value={form.ClientID}
                    onChange={e=>setForm({...form,ClientID:e.target.value})}>
              {[...clientList].sort((a,b)=>a.ClientName.localeCompare(b.ClientName))
                .map(c=>(
                  <MenuItem key={c.ClientID} value={c.ClientID}>{c.ClientName}</MenuItem>
                ))}
            </Select>
          </FormControl>
          <TextField label="Start Date" type="date" fullWidth size="small"
                     value={form.StartDate} onChange={e=>setForm({...form,StartDate:e.target.value})}
                     InputLabelProps={{shrink:true}} />
        </DialogContent>
        <DialogActions>
          <Button onClick={()=>setDlgOpen(false)} sx={{ textTransform:'none' }}>Cancel</Button>
          <Button variant="contained" onClick={confirmClone}
                  sx={{ textTransform:'none', backgroundColor:PRIMARY }}>
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
