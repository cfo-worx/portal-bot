import express from 'express';
import {
  getAllContracts,
  getContractsByClientId,
  getContractById,
  createContract,
  updateContract,
  deleteContract,
  deleteContractsByClientId,
  uploadContractPDF,
  getContractPDF,
  getContractPDFs,
  deleteContractPDF
} from '../controllers/contractController.js';
import { uploadContractPDF as uploadMiddleware } from '../utils/upload.js';

const router = express.Router();

// Get all contracts
router.get('/', getAllContracts);

// Get contracts by client ID
router.get('/client/:clientId', getContractsByClientId);

// PDF routes - must come before generic :id routes
// Get all PDFs for a contract
router.get('/:contractId/pdfs', getContractPDFs);

// Upload PDF for a contract
router.post('/:contractId/pdf', uploadMiddleware.single('pdf'), uploadContractPDF);

// Get PDF file for a contract
router.get('/:contractId/pdf/:filename', getContractPDF);

// Delete a specific PDF
router.delete('/pdf/:pdfId', deleteContractPDF);

// Get contract by ID
router.get('/:id', getContractById);

// Create new contract
router.post('/', createContract);

// Update contract
router.put('/:id', updateContract);

// Delete contract
router.delete('/:id', deleteContract);

// Delete all contracts for a client
router.delete('/client/:clientId', deleteContractsByClientId);

export default router;