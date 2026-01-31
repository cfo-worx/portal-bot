import sql from 'mssql';
import config from './config.js'; // Import config.js

const dbConfig = {
  user: config.DB_USER,
  password: config.DB_PASSWORD,
  server: config.DB_HOST, // Use DB_HOST from .env as the server
  port: parseInt(config.DB_PORT, 10) || 1433, // Default to 1433 if not set
  database: config.DB_NAME,
  options: {
    encrypt: true, // Required for Azure
    trustServerCertificate: false, // Only set to true for local development
  },
};

export const poolPromise = new sql.ConnectionPool(dbConfig)
  .connect()
  .then((pool) => {
    console.log('Connected to SQL Azure');
    return pool;
  })
  .catch((err) => {
    console.error('Database Connection Failed! Bad Config:', err);
    throw err;
  });

export { sql };
