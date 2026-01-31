// frontend/src/components/Shared/NotifyModal.jsx

import React from 'react';
import { Modal, Box, Typography } from '@mui/material';

const NotifyModal = ({ open, onClose, message }) => {
  return (
    <Modal
      open={open}
      onClose={onClose}
      aria-labelledby="modal-title"
      aria-describedby="modal-description"
    >
      <Box
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          bgcolor: 'background.paper',
          borderRadius: 2,
          boxShadow: 24,
          p: 4,
          textAlign: 'center',
          width: 300,
        }}
      >
        <Typography id="modal-title" variant="h6" component="h2">
          Notification
        </Typography>
        <Typography id="modal-description" sx={{ mt: 2 }}>
          {message}
        </Typography>
      </Box>
    </Modal>
  );
};

export default NotifyModal;
