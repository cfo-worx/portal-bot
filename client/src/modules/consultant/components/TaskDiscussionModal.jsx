import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, TextField, Button,
  Card, CardContent, Avatar, IconButton, Divider, Paper
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import CloseIcon   from '@mui/icons-material/Close';
import SendIcon    from '@mui/icons-material/Send';
import CommentIcon from '@mui/icons-material/ModeCommentOutlined';
import dayjs       from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
dayjs.extend(relativeTime);

import { AuthContext } from '../../../context/AuthContext';
import {
  getTaskPosts,
  addPost,
  addComment,
  addReply
} from '../../../api/discussionService';

/* ═══════════════════════════════════════════════════════════════ */

export default function TaskDiscussionModal({ open, onClose, taskId }) {
  /* ─ user context ────────────────────────────────────────────── */
  const { auth }   = useContext(AuthContext);
  const userId     = auth?.user?.UserID ?? auth?.user?.userId ?? auth?.user?.id ?? null;
  const userName   = `${auth?.user?.FirstName ?? ''} ${auth?.user?.LastName ?? ''}`.trim();

  /* ─ state ───────────────────────────────────────────────────── */
  const [posts,   setPosts]   = useState([]);
  const [newPost, setNewPost] = useState('');
  const endRef = useRef(null);

  /* ─ fetch feed ──────────────────────────────────────────────── */
  useEffect(() => { if (open) refresh(); }, [open, taskId]);
  async function refresh() {
    if (!taskId) return;
    const data = await getTaskPosts(taskId);
    const sorted = data
      .sort((a,b)=>new Date(b.CreatedAt)-new Date(a.CreatedAt))
      .map(p=>({
        ...p,
        comments:(p.comments||[])
          .sort((a,b)=>new Date(a.CreatedAt)-new Date(b.CreatedAt))
          .map(c=>({
            ...c,
            replies:(c.replies||[])
              .sort((a,b)=>new Date(a.CreatedAt)-new Date(b.CreatedAt))
          }))
      }));
    setPosts(sorted);
    setTimeout(()=>endRef.current?.scrollIntoView({behavior:'smooth'}),0);
  }

  /* ─ helpers (optimistic UI) ─────────────────────────────────── */
  async function handleAddPost() {
    if (!newPost.trim()) return;
    const tempId = `tmp-${Date.now()}`;
    setPosts(p=>[{
      PostID:tempId, UserID:userId, UserName:userName,
      Message:newPost.trim(), CreatedAt:new Date().toISOString(), comments:[]
    }, ...p]);
    setNewPost('');
    try{ await addPost(taskId,userId,newPost.trim()); refresh(); } catch{ refresh(); }
  }
  async function handleAddComment(postId,text) {
    if (!text.trim()) return;
    setPosts(p=>p.map(post=>
      post.PostID!==postId?post:{
        ...post,
        comments:[...post.comments,{
          CommentID:`tmp-${Date.now()}`,PostID:postId,
          UserID:userId,UserName:userName,Message:text.trim(),
          CreatedAt:new Date().toISOString(),replies:[]
        }]
      }));
    try{ await addComment(postId,userId,text.trim()); refresh(); }catch{ refresh(); }
  }
  async function handleAddReply(commentId,text) {
    if (!text.trim()) return;
    setPosts(p=>p.map(po=>({
      ...po,
      comments:po.comments.map(c=>
        c.CommentID!==commentId?c:{
          ...c,
          replies:[...c.replies,{
            ReplyID:`tmp-${Date.now()}`,CommentID:commentId,
            UserID:userId,UserName:userName,Message:text.trim(),
            CreatedAt:new Date().toISOString()
          }]
        })
    })));
    try{ await addReply(commentId,userId,text.trim()); refresh(); }catch{ refresh(); }
  }

  /* ═════════════════════════ UI ════════════════════════════════ */
  const theme = useTheme();
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" PaperProps={{sx:{borderRadius:3}}}>
      {/* ‣ header */}
      <DialogTitle sx={{m:0,p:2,bgcolor:theme.palette.background.default,borderBottom:`1px solid ${theme.palette.divider}`}}>
        <Typography variant="h6">Task Discussion</Typography>
        <IconButton
          aria-label="close" size="small" onClick={onClose}
          sx={{position:'absolute',right:8,top:8}}
        >
          <CloseIcon fontSize="small"/>
        </IconButton>
      </DialogTitle>

      {/* ‣ feed */}
      <DialogContent dividers sx={{maxHeight:'60vh',p:3,pt:2,bgcolor:alpha(theme.palette.background.default,0.4)}}>
        {posts.map(post=>(
          <FeedCard
            key={post.PostID}
            post={post}
            onComment={handleAddComment}
            onReply={handleAddReply}
          />
        ))}
        <div ref={endRef}/>
      </DialogContent>

      {/* ‣ composer */}
      <DialogActions sx={{px:3,py:2,bgcolor:theme.palette.background.default}}>
        <TextField
          placeholder="Write a post…"
          value={newPost}
          onChange={e=>setNewPost(e.target.value)}
          fullWidth multiline minRows={1} maxRows={4} size="small"
          sx={{flexGrow:1,mr:1,bgcolor:'white',borderRadius:1}}
        />
        <Button variant="contained" endIcon={<SendIcon/>}
          onClick={handleAddPost} disabled={!newPost.trim()}
        >
          Post
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/* Feed Card component – Post ▸ Comments ▸ Replies               */
function FeedCard({ post, onComment, onReply }) {
  const theme = useTheme();
  const commentBg = alpha(theme.palette.primary.main,0.05);
  const replyBg   = alpha(theme.palette.primary.main,0.03);
  return (
    <Card elevation={3} sx={{mb:3,borderRadius:3,boxShadow:`0 2px 8px ${alpha('#000',0.08)}`}}>
      <CardContent sx={{p:3,'&:last-child':{pb:3}}}>
        {/* post header */}
        <Box display="flex" alignItems="center" mb={1}>
          <Avatar sx={{width:32,height:32,mr:1.5,bgcolor:alpha(theme.palette.primary.main,0.85)}}>
            {post.UserName?.match(/\b\w/g)?.join('').toUpperCase() ?? '?'}
          </Avatar>
          <Typography variant="subtitle2" color="text.secondary">
            {post.UserName} • {dayjs(post.CreatedAt).fromNow()}
          </Typography>
        </Box>

        {/* post message */}
        <Typography variant="body1" sx={{whiteSpace:'pre-wrap',fontSize:'0.95rem'}} mb={2}>
          {post.Message}
        </Typography>

        {/* comments */}
        {post.comments.map(comment=>(
          <Paper key={comment.CommentID} variant="outlined" sx={{ml:4,mb:2,p:2,bgcolor:commentBg,borderRadius:2}}>
            <Typography variant="subtitle2" color="primary" sx={{mb:0.5}}>
              {comment.UserName} • {dayjs(comment.CreatedAt).fromNow()}
            </Typography>
            <Typography variant="body2" sx={{whiteSpace:'pre-wrap'}} mb={1.5}>
              {comment.Message}
            </Typography>

            {/* replies */}
            {comment.replies.map(reply=>(
              <Paper key={reply.ReplyID} elevation={0} sx={{ml:4,mb:1,p:1.5,bgcolor:replyBg,borderLeft:`3px solid ${alpha(theme.palette.primary.main,0.4)}`,borderRadius:1}}>
                <Typography variant="subtitle2" color="primary" sx={{mb:0.25}}>
                  {reply.UserName} • {dayjs(reply.CreatedAt).fromNow()}
                </Typography>
                <Typography variant="body2" sx={{whiteSpace:'pre-wrap'}}>
                  {reply.Message}
                </Typography>
              </Paper>
            ))}

            {/* reply input */}
            <InlineInput
              placeholder="Reply…"
              onSubmit={txt=>onReply(comment.CommentID,txt)}
              inset
            />
          </Paper>
        ))}

        {/* comment input */}
        <Divider sx={{my:2}}/>
        <InlineInput
          placeholder="Add a comment…"
          onSubmit={txt=>onComment(post.PostID,txt)}
        />
      </CardContent>
    </Card>
  );
}

/* small reusable inline input */
function InlineInput({ placeholder, onSubmit, inset=false }) {
  const [txt,setTxt] = useState('');
  return (
    <Box sx={{ml: inset?4:0}}>
      <TextField
        placeholder={placeholder}
        value={txt}
        onChange={e=>setTxt(e.target.value)}
        fullWidth size="small" multiline maxRows={4}
        sx={{bgcolor:'white',borderRadius:1}}
      />
      <Box textAlign="right" mt={0.75}>
        <Button size="small" endIcon={<SendIcon fontSize="small"/>}
          onClick={()=>{onSubmit(txt);setTxt('');}}
          disabled={!txt.trim()}
        >
          Send
        </Button>
      </Box>
    </Box>
  );
}
