import Contract from '../models/Contract.js';
import ContractPDF from '../models/ContractPDF.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { uploadsDir } from '../utils/upload.js';

// Get all contracts
export const getAllContracts = async (req, res) => {
  try {
    const contracts = await Contract.getAll();
    res.json(contracts);
  } catch (error) {
    console.error('Error fetching contracts:', error);
    res.status(500).json({ error: 'Failed to fetch contracts' });
  }
};

// Get contracts by client ID
export const getContractsByClientId = async (req, res) => {
  try {
    const { clientId } = req.params;
    const contracts = await Contract.getByClientId(clientId);
    res.json(contracts);
  } catch (error) {
    console.error('Error fetching contracts for client:', error);
    res.status(500).json({ error: 'Failed to fetch contracts for client' });
  }
};

// Get contract by ID
export const getContractById = async (req, res) => {
  try {
    const { id } = req.params;
    const contract = await Contract.getById(id);
    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }
    res.json(contract);
  } catch (error) {
    console.error('Error fetching contract:', error);
    res.status(500).json({ error: 'Failed to fetch contract' });
  }
};

// Create new contract
export const createContract = async (req, res) => {
  try {
    const contractData = {
      ContractID: uuidv4(),
      ...req.body,
      CreatedOn: new Date(),
      UpdatedOn: new Date()
    };
    
    const contract = await Contract.create(contractData);
    res.status(201).json(contract);
  } catch (error) {
    console.error('Error creating contract:', error);
    res.status(500).json({ error: 'Failed to create contract' });
  }
};

// Update contract
export const updateContract = async (req, res) => {
  try {
    const { id } = req.params;
    const contractData = {
      ...req.body,
      UpdatedOn: new Date()
    };
    
    const contract = await Contract.update(id, contractData);
    res.json(contract);
  } catch (error) {
    console.error('Error updating contract:', error);
    res.status(500).json({ error: 'Failed to update contract' });
  }
};

// Delete contract
export const deleteContract = async (req, res) => {
  try {
    const { id } = req.params;
    await Contract.delete(id);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting contract:', error);
    res.status(500).json({ error: 'Failed to delete contract' });
  }
};

// Delete all contracts for a client
export const deleteContractsByClientId = async (req, res) => {
  try {
    const { clientId } = req.params;
    await Contract.deleteByClientId(clientId);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting contracts for client:', error);
    res.status(500).json({ error: 'Failed to delete contracts for client' });
  }
};

// Upload PDF for a contract
export const uploadContractPDF = async (req, res) => {
  try {
    const { contractId } = req.params;
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filename = req.file.filename;
    const originalName = req.file.originalname;
    const fileSize = req.file.size;
    const filePath = `/api/contracts/${contractId}/pdf/${filename}`;

    // Create PDF record in database
    const pdfRecord = await ContractPDF.create({
      ContractID: contractId,
      FilePath: filePath,
      FileName: originalName,
      FileSize: fileSize,
      CreatedOn: new Date()
    });

    res.json({ 
      message: 'PDF uploaded successfully',
      pdfId: pdfRecord.PDFID,
      filePath: filePath,
      filename: filename,
      fileName: originalName
    });
  } catch (error) {
    console.error('Error uploading PDF:', error);
    res.status(500).json({ error: 'Failed to upload PDF' });
  }
};

// Get PDF for a contract
export const getContractPDF = async (req, res) => {
  try {
    const { contractId, filename } = req.params;
    const filePath = path.join(uploadsDir, filename);

    // Verify file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'PDF not found' });
    }

    // Verify the file belongs to this contract
    if (!filename.startsWith(`${contractId}_`)) {
      return res.status(403).json({ error: 'Unauthorized access' });
    }

    // Get PDF record to get original filename
    const pdfs = await ContractPDF.getByContractId(contractId);
    const pdfRecord = pdfs.find(pdf => pdf.FilePath.includes(filename));

    const displayName = pdfRecord?.FileName || filename;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${displayName}"`);
    res.sendFile(filePath);
  } catch (error) {
    console.error('Error retrieving PDF:', error);
    res.status(500).json({ error: 'Failed to retrieve PDF' });
  }
};

// Get all PDFs for a contract
export const getContractPDFs = async (req, res) => {
  try {
    const { contractId } = req.params;
    const pdfs = await ContractPDF.getByContractId(contractId);
    res.json(pdfs);
  } catch (error) {
    console.error('Error fetching PDFs:', error);
    res.status(500).json({ error: 'Failed to fetch PDFs' });
  }
};

// Delete PDF for a contract
export const deleteContractPDF = async (req, res) => {
  try {
    const { pdfId } = req.params;
    
    // Get PDF record
    const pdfRecord = await ContractPDF.getById(pdfId);
    if (!pdfRecord) {
      return res.status(404).json({ error: 'PDF not found' });
    }

    // Extract filename from path
    const filename = pdfRecord.FilePath.split('/').pop();
    const filePath = path.join(uploadsDir, filename);

    // Delete file from filesystem
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete from database
    await ContractPDF.delete(pdfId);

    res.json({ message: 'PDF deleted successfully' });
  } catch (error) {
    console.error('Error deleting PDF:', error);
    res.status(500).json({ error: 'Failed to delete PDF' });
  }
};