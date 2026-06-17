/**
 * @fileoverview Repository implementation for storing link data in a MySQL database.
 * Utilizes a connection pool for managing database connections efficiently.
 */

import { Link, CreateLinkInput } from '@/types';
import { LinkRepository } from './types';
import mysql, { RowDataPacket } from 'mysql2/promise';
import crypto from 'crypto';
import { generateUniqueShortCode } from '@/lib/short-code';

// --- Connection Pool Singleton ---
let pool: mysql.Pool | null = null;

/**
 * Returns a singleton instance of the MySQL connection pool.
 * Initializes the pool if it doesn't exist, using environment variables for configuration.
 * @returns {mysql.Pool} The MySQL connection pool instance.
 */
function getPool(): mysql.Pool {
  if (!pool) {
    const host = process.env.MYSQL_HOST || 'localhost';
    const port = parseInt(process.env.MYSQL_PORT || '3306', 10);
    const user = process.env.MYSQL_USER || 'root';
    const password = process.env.MYSQL_PASSWORD || '';
    const database = process.env.MYSQL_DATABASE || 'url_shortener';

    // Ensure port is a valid number
    if (isNaN(port)) {
        throw new Error(`Invalid MYSQL_PORT environment variable: ${process.env.MYSQL_PORT}`);
    }

    pool = mysql.createPool({
      host,
      port,
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: 10, // Default connection limit, adjust as needed
      queueLimit: 0, // 0 means unlimited queueing
      // Enable SSL if required, e.g., for managed cloud databases
      // ssl: {
      //   ca: fs.readFileSync('./path/to/ca-certificate.pem'),
      // }
    });
    console.log(`MySQL connection pool created for database '${database}' on ${host}:${port}`);
  }
  return pool;
}

// --- MySQL Repository Implementation ---

export class MySqlRepository implements LinkRepository {
  /** @inheritdoc */
  async findAll(): Promise<Link[]> {
    const query = `
      SELECT id, shortCode, originalUrl, createdAt, expiresAt, clickCount, lastClickedAt 
      FROM links 
      ORDER BY createdAt DESC
    `;
    const [rows] = await getPool().execute<RowDataPacket[]>(query);
    // Map rows to Link objects, ensuring correct date formatting
    return rows.map((row: RowDataPacket) => this.mapRowToLink(row));
  }

  /** @inheritdoc */
  async findByShortCode(code: string): Promise<Link | null> {
    const query = 'SELECT * FROM links WHERE shortCode = ?';
    const [rows] = await getPool().execute<RowDataPacket[]>(query, [code]);
    if (rows.length === 0) return null;
    return this.mapRowToLink(rows[0]);
  }

  /** @inheritdoc */
  async findById(id: string): Promise<Link | null> {
    const query = 'SELECT * FROM links WHERE id = ?';
    const [rows] = await getPool().execute<RowDataPacket[]>(query, [id]);
    if (rows.length === 0) return null;
    return this.mapRowToLink(rows[0]);
  }

  /** @inheritdoc */
  async create(data: CreateLinkInput): Promise<Link> {
    const { originalUrl, customAlias, expiresInDays } = data;
    const id = crypto.randomUUID(); // Use crypto.randomUUID for standard UUID generation
    
    // Generate a short code: use customAlias if provided, otherwise generate a unique one
    // Use the centralized generateUniqueShortCode function with collision retry logic
    const shortCode = customAlias || await generateUniqueShortCode(
      async (code) => this.existsByShortCode(code),
      6 // default length
    );

    const createdAt = new Date();
    const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) : null;

    const query = `
      INSERT INTO links (id, shortCode, originalUrl, createdAt, expiresAt) 
      VALUES (?, ?, ?, ?, ?)
    `;
    
    await getPool().execute(query, [id, shortCode, originalUrl, createdAt, expiresAt]);

    // Return the created link object
    return {
      id,
      shortCode,
      originalUrl,
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
      clickCount: 0,
      lastClickedAt: null,
    };
  }

  /** @inheritdoc */
  async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM links WHERE id = ?';
    const [result] = await getPool().execute<mysql.OkPacket>(query, [id]);
    // Check if any row was affected
    return result.affectedRows > 0;
  }

  /** @inheritdoc */
  async incrementClick(shortCode: string): Promise<void> {
    // First, check if the link exists and is not expired
    const checkQuery = 'SELECT id, expiresAt FROM links WHERE shortCode = ?';
    const [linkRows] = await getPool().execute<RowDataPacket[]>(checkQuery, [shortCode]);

    if (linkRows.length === 0) {
      console.warn(`Link not found for click increment: ${shortCode}`);
      return;
    }

    const linkData = linkRows[0];
    const expiresAt = linkData.expiresAt as Date | null;

    // Check expiration
    if (expiresAt && expiresAt < new Date()) {
      console.warn(`Attempted to click expired link with shortCode: ${shortCode}`);
      return; // Do not increment if expired
    }

    // If valid and not expired, perform the update
    const updateQuery = `
      UPDATE links 
      SET clickCount = clickCount + 1, lastClickedAt = ? 
      WHERE shortCode = ?
    `;
    await getPool().execute(updateQuery, [new Date(), shortCode]);
  }

  /** @inheritdoc */
  async existsByShortCode(code: string): Promise<boolean> {
    const query = 'SELECT COUNT(*) as count FROM links WHERE shortCode = ?';
    const [rows] = await getPool().execute<RowDataPacket[]>(query, [code]);
    // Rows should contain { count: number }
    return rows[0]?.count > 0;
  }

  /**
   * Helper method to map MySQL row to Link object, ensuring correct Date formatting.
   * @param {RowDataPacket} row - The raw row data from the database.
   * @returns {Link} The mapped Link object.
   */
  private mapRowToLink(row: RowDataPacket): Link {
    return {
      id: row.id as string,
      shortCode: row.shortCode as string,
      originalUrl: row.originalUrl as string,
      // Convert Date objects to ISO strings, handle potential nulls
      createdAt: (row.createdAt as Date).toISOString(),
      expiresAt: row.expiresAt ? (row.expiresAt as Date).toISOString() : null,
      clickCount: row.clickCount as number,
      lastClickedAt: row.lastClickedAt ? (row.lastClickedAt as Date).toISOString() : null,
    };
  }
}
