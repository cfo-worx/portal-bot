import sql from 'mssql'; // Import mssql

const dbConfig = {
  user: 'cfoadmin',
  password: 'SonyVizio9898!',
  server: 'cfoworx-server.database.windows.net',
  port: 1433,
  database: 'cfoworx',
  options: {
    encrypt: true, // Use encryption for Azure
    trustServerCertificate: false, // Only set to true for local dev
  },
};

const testConnection = async () => {
  try {
    const pool = await sql.connect(dbConfig); // Connect to the database
    console.log('Connected to SQL Azure');
    const result = await pool.request().query('SELECT 1 AS test'); // Test query
    console.log('Query Result:', result.recordset);
    pool.close(); // Close the connection pool
  } catch (err) {
    console.error('SQL Connection Error:', err);
  }
};

testConnection();
