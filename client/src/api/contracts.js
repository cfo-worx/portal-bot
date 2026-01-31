// src/api/contracts.js
import axios from './index';

export const getContractsByClientId = async (clientId) => {
  try {
    const response = await axios.get(`/contracts/client/${clientId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching contracts:', error);
    throw error;
  }
};

export const createContract = async (contractData) => {
  try {
    const response = await axios.post('/contracts', contractData);
    return response.data;
  } catch (error) {
    console.error('Error creating contract:', error);
    throw error;
  }
};

export const updateContract = async (contractId, contractData) => {
  try {
    const response = await axios.put(`/contracts/${contractId}`, contractData);
    return response.data;
  } catch (error) {
    console.error('Error updating contract:', error);
    throw error;
  }
};

export const deleteContract = async (contractId) => {
  try {
    await axios.delete(`/contracts/${contractId}`);
    return true;
  } catch (error) {
    console.error('Error deleting contract:', error);
    throw error;
  }
};

export const uploadContractPDF = async (contractId, file) => {
  try {
    const formData = new FormData();
    formData.append('pdf', file);
    
    const response = await axios.post(`/contracts/${contractId}/pdf`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error uploading PDF:', error);
    throw error;
  }
};

export const getContractPDFs = async (contractId) => {
  try {
    const response = await axios.get(`/contracts/${contractId}/pdfs`);
    return response.data;
  } catch (error) {
    console.error('Error fetching PDFs:', error);
    throw error;
  }
};

export const getContractPDFUrl = (contractId, filename) => {
  const baseURL = axios.defaults.baseURL || 'http://localhost:5000/api';
  return `${baseURL}/contracts/${contractId}/pdf/${filename}`;
};

export const deleteContractPDF = async (pdfId) => {
  try {
    const response = await axios.delete(`/contracts/pdf/${pdfId}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting PDF:', error);
    throw error;
  }
};
