import { poolPromise } from '../db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration(migrationFile) {
  try {
    // Check if migration file is provided
    if (!migrationFile) {
      console.error('❌ Please specify a migration file');
      console.log('Usage: node run-migration.js <migration-file.sql>');
      process.exit(1);
    }

    // Check if file exists
    const migrationPath = path.join(__dirname, migrationFile);
    if (!fs.existsSync(migrationPath)) {
      console.error(`❌ Migration file not found: ${migrationFile}`);
      console.log('Available migration files:');
      const files = fs.readdirSync(__dirname).filter(file => file.endsWith('.sql'));
      files.forEach(file => console.log(`  - ${file}`));
      process.exit(1);
    }

    console.log(`🚀 Running migration: ${migrationFile}`);
    
    // Read and execute the specified migration file
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    const result = await poolPromise.then(pool => pool.request().query(migrationSQL));
    
    console.log(`✅ Migration completed successfully: ${migrationFile}`);
    
    // Show affected rows if available
    if (result.rowsAffected && result.rowsAffected.length > 0) {
      const totalAffected = result.rowsAffected.reduce((sum, count) => sum + count, 0);
      console.log(`📊 Rows affected: ${totalAffected}`);
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  }
}

// Get migration file from command line arguments
const migrationFile = process.argv[2];
runMigration(migrationFile);
