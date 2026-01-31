// src/components/Shared/Modal.jsx
import React from 'react';
import { Modal, Box } from '@mui/material';

const style = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '80%',
  maxWidth: 600,
  bgcolor: 'background.paper',
  boxShadow: 24,
  p: 4,
};

const CustomModal = ({ open, onClose, children, customStyle = {} }) => {
  return (
    <Modal open={open} onClose={onClose}>
      <Box sx={{ ...style, ...customStyle }}>{children}</Box>
    </Modal>
  );
};

export default CustomModal;
  