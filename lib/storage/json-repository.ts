/**
 * @fileoverview Repository implementation for storing link data in a JSON file.
 * This implementation includes concurrency control using 'proper-lockfile'.
 */

import { Link, CreateLinkInput } from '@/types';
import { LinkRepository } from './types';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import lockfile from 'proper-lockfile';
import { generateUniqueShortCode } from '@/lib/short-code';
import { isNodeError } from '@/types/errors';

// Default path if not specified in environment variables
const DB_FILE_PATH = process.env.JSON_DB_PATH || './data/links.json';

/**
 * Loads links from the JSON database file.
 * Creates the directory and file if they do not exist.
 * @returns {Promise<Link[]>} A promise that resolves to an array of Link objects.
 */
async function loadLinks(): Promise<Link[]> {
  try {
    await fs.access(DB_FILE_PATH); // Check if file exists
    const data = await fs.readFile(DB_FILE_PATH, 'utf-8');
    const parsedData = JSON.parse(data);
    // Ensure parsed data is an array, otherwise return empty array
    return Array.isArray(parsedData) ? parsedData : [];
  } catch (error: unknown) {
    // If file doesn't exist, create directory and empty file
    if (isNodeError(error) && error.code === 'ENOENT') {
      const dir = path.dirname(DB_FILE_PATH);
      if (process.env.NODE_ENV === 'development') {
        console.log(`Creating directory ${dir} and file ${DB_FILE_PATH}`);
      }
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(DB_FILE_PATH, JSON.stringify([]));
      return [];
    }
    // Rethrow other errors
    if (process.env.NODE_ENV === 'development') {
      console.error(`Error loading links from ${DB_FILE_PATH}:`, error);
    }
    throw error;
  }
}

/**
 * Saves an array of links to the JSON database file.
 * @param {Link[]} links - The array of Link objects to save.
 * @returns {Promise<void>} A promise that resolves when the links are saved.
 */
async function saveLinks(links: Link[]): Promise<void> {
  await fs.writeFile(DB_FILE_PATH, JSON.stringify(links, null, 2), 'utf-8');
}

export class JsonFileRepository implements LinkRepository {
  private releaseLock: (() => Promise<void>) | null = null;

  /** 
   * Acquires a file lock to ensure exclusive access to the JSON file.
   * Only locks for write operations to improve read performance.
   */
  private async acquireLock(): Promise<void> {
    // Ensure file exists before attempting to lock
    await loadLinks();
    
    // Use proper-lockfile v4.x API - lock the actual file, not a separate .lock file
    this.releaseLock = await lockfile.lock(DB_FILE_PATH, {
      retries: {
        retries: 5,
        minTimeout: 100,
        maxTimeout: 500,
      },
      stale: 10000, // Lock expires after 10s if not released
      realpath: false,
    });
  }

  /** Releases the file lock. */
  private async release(): Promise<void> {
    if (this.releaseLock) {
      await this.releaseLock();
      this.releaseLock = null;
    }
  }

  /** @inheritdoc */
  async findAll(): Promise<Link[]> {
    // Read operations don't need locking (atomic file reads in Node.js)
    const links = await loadLinks();
    // Ensure dates are properly formatted as ISO strings
    return links.map(link => ({
      ...link,
      createdAt: new Date(link.createdAt).toISOString(),
      expiresAt: link.expiresAt ? new Date(link.expiresAt).toISOString() : null,
      lastClickedAt: link.lastClickedAt ? new Date(link.lastClickedAt).toISOString() : null,
    }));
  }

  /** @inheritdoc */
  async findByShortCode(code: string): Promise<Link | null> {
    // Read operations don't need locking
    const links = await loadLinks();
    const link = links.find(l => l.shortCode === code);
    if (!link) return null;

    // Ensure dates are properly formatted as ISO strings
    return {
      ...link,
      createdAt: new Date(link.createdAt).toISOString(),
      expiresAt: link.expiresAt ? new Date(link.expiresAt).toISOString() : null,
      lastClickedAt: link.lastClickedAt ? new Date(link.lastClickedAt).toISOString() : null,
    };
  }

  /** @inheritdoc */
  async findById(id: string): Promise<Link | null> {
    // Read operations don't need locking
    const links = await loadLinks();
    const link = links.find(l => l.id === id);
    if (!link) return null;

    // Ensure dates are properly formatted as ISO strings
    return {
      ...link,
      createdAt: new Date(link.createdAt).toISOString(),
      expiresAt: link.expiresAt ? new Date(link.expiresAt).toISOString() : null,
      lastClickedAt: link.lastClickedAt ? new Date(link.lastClickedAt).toISOString() : null,
    };
  }

  /** @inheritdoc */
  async create(data: CreateLinkInput): Promise<Link> {
    // Lock for write operations
    await this.acquireLock();
    try {
      const links = await loadLinks();
      
      // Check for existing custom alias collision
      if (data.customAlias && links.some(l => l.shortCode === data.customAlias)) {
        throw new Error('Custom alias already in use.');
      }

      // Generate short code if custom alias is not provided
      // Use the centralized generateUniqueShortCode function with collision retry logic
      const shortCode = data.customAlias || await generateUniqueShortCode(
        async (code) => links.some(l => l.shortCode === code),
        6 // default length
      );

      const newLink: Link = {
        id: uuidv4(),
        shortCode: shortCode,
        originalUrl: data.originalUrl,
        createdAt: new Date().toISOString(),
        expiresAt: data.expiresInDays ? new Date(Date.now() + data.expiresInDays * 24 * 60 * 60 * 1000).toISOString() : null,
        clickCount: 0,
        lastClickedAt: null,
      };

      links.push(newLink);
      await saveLinks(links);
      return newLink;
    } finally {
      this.release();
    }
  }

  /** @inheritdoc */
  async delete(id: string): Promise<boolean> {
    await this.acquireLock();
    try {
      let links = await loadLinks();
      const initialLength = links.length;
      links = links.filter(l => l.id !== id);
      if (links.length < initialLength) {
        await saveLinks(links);
        return true;
      }
      return false;
    } finally {
      this.release();
    }
  }

  /** @inheritdoc */
  async incrementClick(shortCode: string): Promise<void> {
    await this.acquireLock();
    try {
      const links = await loadLinks();
      const linkIndex = links.findIndex(l => l.shortCode === shortCode);
      
      if (linkIndex !== -1) {
        const link = links[linkIndex];
        
        // Check expiration before incrementing click count
        if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
          console.warn(`Attempted to click expired link with shortCode: ${shortCode}`);
          // Do not increment, just return
          return; 
        }

        // Update click count and last clicked timestamp
        link.clickCount++;
        link.lastClickedAt = new Date().toISOString();
        links[linkIndex] = link; // Update the array
        await saveLinks(links);
      } else {
          console.warn(`Link not found for click increment: ${shortCode}`);
      }
    } finally {
      this.release();
    }
  }

  /** @inheritdoc */
  async existsByShortCode(code: string): Promise<boolean> {
    // Read operations don't need locking (atomic file reads in Node.js)
    const links = await loadLinks();
    // Check if any link has the specified shortCode
    return links.some(l => l.shortCode === code);
  }
}
