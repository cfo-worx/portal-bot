// client/src/api/benchmarks.js
import axios from 'axios';

const API_BASE = '/api/benchmarks';

/**
 * Fetch all benchmarks for a specific client.
 * @param {string} clientId
 * @returns {Promise<Array>} 
 */
export const getBenchmarksByClient = async (clientId) => {
  try {
    const response = await axios.get(`${API_BASE}/client/${clientId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching benchmarks:', error);
    throw error;
  }
};

/**
 * Create a new benchmark.
 * @param {Object} benchmarkData
 * @returns {Promise<Object>} 
 */
export const createBenchmark = async (benchmarkData) => {
  try {
    const response = await axios.post(`${API_BASE}/`, benchmarkData);
    return response.data;
  } catch (error) {
    console.error('Error creating benchmark:', error);
    throw error;
  }
};

/**
 * Update an existing benchmark.
 * @param {string} benchmarkId
 * @param {Object} benchmarkData
 * @returns {Promise<Object>}
 */
export const updateBenchmark = async (benchmarkId, benchmarkData) => {
  try {
    const response = await axios.put(`${API_BASE}/${benchmarkId}`, benchmarkData);
    return response.data;
  } catch (error) {
    console.error('Error updating benchmark:', error);
    throw error;
  }
};

/**
 * Delete a benchmark.
 * @param {string} benchmarkId
 * @returns {Promise<Object>}
 */
export const deleteBenchmark = async (benchmarkId) => {
  try {
    const response = await axios.delete(`${API_BASE}/${benchmarkId}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting benchmark:', error);
    throw error;
  }
};

/**
 * Get all benchmarks (for bulk management).
 * @returns {Promise<Array>}
 */
export const getAllBenchmarks = async () => {
  try {
    const response = await axios.get(`${API_BASE}/all`);
    return response.data;
  } catch (error) {
    console.error('Error fetching all benchmarks:', error);
    throw error;
  }
};

/**
 * Bulk update distribution types for multiple benchmarks.
 * @param {Array<string>} benchmarkIds
 * @param {string} distributionType
 * @returns {Promise<Object>}
 */
export const bulkUpdateDistributionType = async (benchmarkIds, distributionType) => {
  try {
    const response = await axios.post(`${API_BASE}/bulk-update-distribution`, {
      benchmarkIds,
      distributionType,
    });
    return response.data;
  } catch (error) {
    console.error('Error bulk updating distribution types:', error);
    throw error;
  }
};
