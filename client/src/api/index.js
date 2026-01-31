// frontend/src/api/index.js

import axios from 'axios';

// Create an Axios instance with base URL
const instance = axios.create({
  baseURL: 'https://portal.cfoworx.com/api', // Ensure this matches your server's base URL
  timeout: 5000, // Optional timeout setting
});

// Add a request interceptor to include JWT token
instance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token'); // Retrieve token from localStorage
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`; // Set the token in Authorization header
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default instance;
