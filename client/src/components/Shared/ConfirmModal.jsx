// src/components/Shared/ConfirmModal.jsx
import React from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

const ConfirmModal = ({ message, onConfirm, onCancel }) => {
  return (
    <Modal onClose={onCancel}>
      <div className="text-lg mb-4">{message}</div>
      <div className="flex justify-end space-x-2">
        <Button onClick={onCancel} className="bg-gray-500 hover:bg-gray-700">No</Button>
        <Button onClick={onConfirm} className="bg-red-500 hover:bg-red-700">Yes</Button>
      </div>
    </Modal>
  );
};

export default ConfirmModal;
