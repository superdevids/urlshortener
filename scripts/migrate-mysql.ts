/**
 * @fileoverview Migration script for creating the 'links' table in MySQL.
 * Uses the 'mysql2' library for database operations.
 */

import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { isMySQLError } from '@/types/errors';

// --- Configuration ---
// Reads database connection details from environment variables.
// Provides default values for local development.
const dbConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3306', 10),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'url_shortener',
};

// Path to the SQL migration file.
const migrationFilePath = path.join(process.cwd(), 'migrations', '001_create_links_table.sql');

async function runMigration() {
  let connection: mysql.Connection | null = null;
  try {
    // Establish a connection to the MySQL server (without specifying a database initially)
    // This allows creating the database if it doesn't exist.
    connection = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
    });

    // Create the database if it doesn't exist
    await connection.query(`CREATE DATABASE IF NOT EXISTS ??`, [dbConfig.database]);
    console.log(`Database "${dbConfig.database}" ensured.`);
    
    // Close the initial connection and establish a new one to the specific database
    await connection.end();
    connection = await mysql.createConnection(dbConfig);

    // Read the SQL migration file content
    const migrationSql = fs.readFileSync(migrationFilePath, 'utf-8');

    // Execute the SQL statement(s) from the migration file
    await connection.query(migrationSql);
    console.log(`Migration applied successfully: "${migrationFilePath}"`);

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error during MySQL migration:', errorMessage);
    
    // Provide specific feedback based on error codes if possible
    if (isMySQLError(error)) {
      if (error.code === 'ER_ACCESS_DENIED_ERROR') {
        console.error('Access denied. Check your MYSQL_USER and MYSQL_PASSWORD environment variables.');
      } else if (error.code === 'ECONNREFUSED') {
        console.error(`Connection refused. Is the MySQL server running at ${dbConfig.host}:${dbConfig.port}?`);
      } else if (error.code === 'ER_BAD_DB_ERROR') {
        console.error(`Database "${dbConfig.database}" not found. Ensure it exists or check MYSQL_DATABASE env var.`);
      } else if (error.code === 'ER_NO_SUCH_TABLE') {
        console.error(`Table not found. Ensure the migration SQL is correct or the database is empty.`);
      }
    }
    
    // Exit with error status
    process.exit(1);
  } finally {
    // Ensure the connection is closed in all cases
    if (connection) {
      await connection.end();
      console.log('MySQL connection closed.');
    }
  }
}

// Execute the migration function
runMigration();
