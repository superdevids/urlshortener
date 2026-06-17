/**
 * @fileoverview Test suite for the MySQLRepository.
 * Uses Vitest and mocks the 'mysql2/promise' library.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MySqlRepository } from '@/lib/storage/mysql-repository';
import { Link, CreateLinkInput } from '@/types';
import type mysql from 'mysql2/promise';

// Mock the mysql2/promise library
vi.mock('mysql2/promise', () => ({
  default: {
    createPool: vi.fn(),
  },
}));

// Mock crypto.randomUUID for predictable IDs in tests
vi.mock('crypto', async () => {
  const actual = await vi.importActual<typeof import('crypto')>('crypto');
  return {
    ...actual,
    default: {
      ...actual.default,
      randomUUID: vi.fn(() => 'mock-uuid-1234'),
    },
    randomUUID: vi.fn(() => 'mock-uuid-1234'),
  };
});

// --- Test Setup ---
let mockConnection: any;
let mockPool: any;

// Mock current date for consistent date handling
const MOCK_NOW = new Date('2023-10-26T10:00:00.000Z');
vi.useFakeTimers().setSystemTime(MOCK_NOW);

// Mock Database Seed Data
const MOCK_LINKS: Link[] = [
  {
    id: 'mock-uuid-1234-a',
    shortCode: 'abc',
    originalUrl: 'http://example.com/one',
    createdAt: MOCK_NOW.toISOString(),
    expiresAt: null,
    clickCount: 5,
    lastClickedAt: MOCK_NOW.toISOString(),
  },
  {
    id: 'mock-uuid-1234-b',
    shortCode: 'def',
    originalUrl: 'http://example.com/two',
    createdAt: new Date(MOCK_NOW.getTime() - 86400000).toISOString(), // Yesterday
    expiresAt: new Date(MOCK_NOW.getTime() + 86400000).toISOString(), // Expires tomorrow
    clickCount: 0,
    lastClickedAt: null,
  },
];

// Helper to mock a MySQL result row based on Link type
const mockLinkToRow = (link: Link): mysql.Row => ({
    ...link,
    createdAt: new Date(link.createdAt),
    expiresAt: link.expiresAt ? new Date(link.expiresAt) : null,
    lastClickedAt: link.lastClickedAt ? new Date(link.lastClickedAt) : null,
});

beforeEach(() => {
  // Mock the connection pool and its methods
  mockConnection = {
    execute: vi.fn(),
    release: vi.fn(),
    query: vi.fn(), // Add query mock
  } as vi.Mocked<mysql.Connection>;

  mockPool = {
    getConnection: vi.fn().mockResolvedValue(mockConnection),
    promise: { // Mock the promise interface if needed, or directly mock execute
        execute: mockConnection.execute,
        query: mockConnection.query,
    },
    end: vi.fn(),
    on: vi.fn(),
  } as vi.Mocked<mysql.Pool>;

  mockMysql.createPool.mockReturnValue(mockPool);
  
  // Mock crypto.randomUUID
  vi.mocked(crypto.randomUUID).mockReturnValue('mock-uuid-1234');

  // Instantiate the repository
  // NOTE: Ensure env vars are set or handled if MySqlRepository relies on them directly in constructor,
  // otherwise the createPool mock might need to be more sophisticated.
  // For now, assume getPool() is mocked or configured implicitly.
});

afterEach(() => {
  vi.restoreAllMocks(); // Restore all mocks after each test
});

describe('MySqlRepository - Data Retrieval', () => {
  it('findAll should retrieve all links and format dates correctly', async () => {
    mockConnection.execute.mockResolvedValue([MOCK_LINKS.map(mockLinkToRow), []]); // Resolve with mock data

    const repo = new MySqlRepository();
    const links = await repo.findAll();

    expect(mockPool.getConnection).toHaveBeenCalledTimes(1);
    expect(mockConnection.execute).toHaveBeenCalledTimes(1);
    expect(mockConnection.execute).toHaveBeenCalledWith(expect.stringContaining('SELECT'), []); // Check query pattern
    expect(links).toHaveLength(MOCK_LINKS.length);
    expect(links[0].createdAt).toBe(MOCK_NOW.toISOString()); // Check date formatting
    expect(links[1].expiresAt).toBeDefined();
    expect(mockConnection.release).toHaveBeenCalledTimes(1);
  });

  it('findAll should return an empty array if no links exist', async () => {
    mockConnection.execute.mockResolvedValue([[], []]); // Simulate empty result set

    const repo = new MySqlRepository();
    const links = await repo.findAll();

    expect(links).toEqual([]);
    expect(mockConnection.release).toHaveBeenCalledTimes(1);
  });

  it('findByShortCode should return a link if found', async () => {
    const targetLink = MOCK_LINKS.find(l => l.shortCode === 'abc')!;
    mockConnection.execute.mockResolvedValue([[mockLinkToRow(targetLink)], []]);

    const repo = new MySqlRepository();
    const link = await repo.findByShortCode('abc');

    expect(link).not.toBeNull();
    expect(link?.id).toBe(targetLink.id);
    expect(mockConnection.release).toHaveBeenCalledTimes(1);
  });

  it('findByShortCode should return null if link not found', async () => {
    mockConnection.execute.mockResolvedValue([[], []]); // Simulate empty result set

    const repo = new MySqlRepository();
    const link = await repo.findByShortCode('nonexistent');

    expect(link).toBeNull();
    expect(mockConnection.release).toHaveBeenCalledTimes(1);
  });

  it('findById should return a link if found', async () => {
    const targetLink = MOCK_LINKS.find(l => l.id === 'mock-uuid-1234-a')!;
    mockConnection.execute.mockResolvedValue([[mockLinkToRow(targetLink)], []]);

    const repo = new MySqlRepository();
    const link = await repo.findById('mock-uuid-1234-a');

    expect(link).not.toBeNull();
    expect(link?.shortCode).toBe(targetLink.shortCode);
    expect(mockConnection.release).toHaveBeenCalledTimes(1);
  });

  it('findById should return null if ID not found', async () => {
    mockConnection.execute.mockResolvedValue([[], []]);

    const repo = new MySqlRepository();
    const link = await repo.findById('nonexistent-id');

    expect(link).toBeNull();
    expect(mockConnection.release).toHaveBeenCalledTimes(1);
  });
});

describe('MySqlRepository - Link Creation and Deletion', () => {
  it('create should insert a new link into the database', async () => {
    const createInput: CreateLinkInput = { originalUrl: 'http://new.com', expiresInDays: 30 };
    const expectedLink: Link = { // Match the output structure
        id: 'mock-uuid-1234', // From mock crypto.randomUUID
        shortCode: expect.any(String), // Short code will be generated
        originalUrl: createInput.originalUrl,
        createdAt: MOCK_NOW.toISOString(),
        expiresAt: new Date(MOCK_NOW.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        clickCount: 0,
        lastClickedAt: null,
    };
    
    // Mock the execute call for INSERT
    // The actual implementation inserts, the mock should just confirm it was called.
    // We don't necessarily need to return the inserted row if the function doesn't use it directly.
    mockConnection.execute.mockResolvedValue([[expect.anything()], expect.anything()]); // Mock OkPacket result

    const repo = new MySqlRepository();
    const createdLink = await repo.create(createInput);

    expect(createdLink.id).toBe('mock-uuid-1234');
    expect(createdLink.originalUrl).toBe(createInput.originalUrl);
    expect(createdLink.createdAt).toBe(MOCK_NOW.toISOString());
    expect(createdLink.expiresAt).toBe(expectedLink.expiresAt);
    expect(createdLink.clickCount).toBe(0);
    
    expect(mockConnection.execute).toHaveBeenCalledTimes(1);
    expect(mockConnection.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO links'),
      expect.arrayContaining([
          'mock-uuid-1234', // id
          expect.any(String), // shortCode (generated)
          createInput.originalUrl, // originalUrl
          expect.any(Date), // createdAt
          expect.any(Date) // expiresAt
      ])
    );
    expect(createdLink.shortCode).toHaveLength(6); // Default length test

    expect(mockConnection.release).toHaveBeenCalledTimes(1);
  });
  
    it('create should use custom alias if provided', async () => {
        const createInput: CreateLinkInput = { originalUrl: 'http://custom.com', customAlias: 'myalias' };
        
        mockConnection.execute.mockResolvedValue([[expect.anything()], expect.anything()]); 

        const repo = new MySqlRepository();
        const createdLink = await repo.create(createInput);

        expect(createdLink.shortCode).toBe('myalias');
        expect(mockConnection.execute).toHaveBeenCalledTimes(1);
         expect(mockConnection.execute).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO links'),
            expect.arrayContaining([
                'mock-uuid-1234', // id
                'myalias', // shortCode should be the custom alias
                createInput.originalUrl, // originalUrl
                expect.any(Date), // createdAt
                expect.any(Date) // expiresAt or null
            ])
        );
        expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });


  it('delete should remove a link by ID and return true', async () => {
    mockConnection.execute.mockResolvedValue([[ { affectedRows: 1 } ], []]); // Mock successful deletion

    const repo = new MySqlRepository();
    const deleted = await repo.delete('mock-uuid-1234-a');

    expect(deleted).toBe(true);
    expect(mockConnection.execute).toHaveBeenCalledTimes(1);
    expect(mockConnection.execute).toHaveBeenCalledWith('DELETE FROM links WHERE id = ?', ['mock-uuid-1234-a']);
    expect(mockConnection.release).toHaveBeenCalledTimes(1);
  });

  it('delete should return false if link ID not found', async () => {
    mockConnection.execute.mockResolvedValue([[ { affectedRows: 0 } ], []]); // Mock deletion with no rows affected

    const repo = new MySqlRepository();
    const deleted = await repo.delete('nonexistent-id');

    expect(deleted).toBe(false);
    expect(mockConnection.execute).toHaveBeenCalledWith('DELETE FROM links WHERE id = ?', ['nonexistent-id']);
    expect(mockConnection.release).toHaveBeenCalledTimes(1);
  });
});

describe('MySqlRepository - Click Increment and Existence Check', () => {
  const linkToIncrement = MOCK_LINKS.find(l => l.shortCode === 'abc')!; // Active link

  beforeEach(() => {
      // Mock the SELECT for incrementClick specifically
      mockConnection.execute.mockImplementation(async (query: string, params?: any[]) => {
          if (query.includes('SELECT * FROM links WHERE shortCode = ?')) {
              // Simulate finding the link
              return [[mockLinkToRow(linkToIncrement)], []];
          } else if (query.includes('UPDATE links')) {
              // Simulate successful update
              return [[{ affectedRows: 1, changedRows: 1 }], []];
          } else if (query.includes('COUNT(*)')) {
              // Simulate existence check result
              return [[{ count: 1 } /* or 0 if not found */ ] , []];
          }
          return [[], []]; // Default empty result
      });
  });

  it('incrementClick should update click count and lastClickedAt for an active link', async () => {
    const repo = new MySqlRepository();
    await repo.incrementClick('abc');

    expect(mockConnection.execute).toHaveBeenCalledTimes(2); // One SELECT, one UPDATE
    // Check the UPDATE query parameters
    expect(mockConnection.execute).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE links SET clickCount = clickCount + 1, lastClickedAt = ? WHERE shortCode = ?'),
      [expect.any(Date), 'abc'] // Expecting current date and the shortCode
    );
    expect(mockConnection.release).toHaveBeenCalledTimes(1);
  });

  it('incrementClick should not update if link is expired', async () => {
      // Mock link data to be expired
      const expiredLinkData = {
          ...linkToIncrement,
          expiresAt: new Date(MOCK_NOW.getTime() - 1000), // Expired 1 second ago
      };
      mockConnection.execute.mockImplementation(async (query: string, params?: any[]) => {
          if (query.includes('SELECT * FROM links WHERE shortCode = ?')) {
              return [[mockLinkToRow(expiredLinkData)], []]; // Return expired link
          }
          return [[], []]; // Should not reach UPDATE
      });

      const spyConsoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const repo = new MySqlRepository();
      await repo.incrementClick('abc');

      expect(mockConnection.execute).toHaveBeenCalledTimes(1); // Only SELECT should be called
      expect(spyConsoleWarn).toHaveBeenCalledWith(expect.stringContaining('Attempted to click expired link'));
      spyConsoleWarn.mockRestore();
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
  });


  it('incrementClick should handle non-existent short code gracefully', async () => {
    // Mock SELECT to return no rows
     mockConnection.execute.mockImplementation(async (query: string, params?: any[]) => {
          if (query.includes('SELECT * FROM links WHERE shortCode = ?')) {
              return [[], []]; // No rows found
          }
          return [[], []];
      });
      
    const spyConsoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const repo = new MySqlRepository();
    await repo.incrementClick('nonexistent');

    expect(mockConnection.execute).toHaveBeenCalledTimes(1); // Only SELECT
    expect(spyConsoleWarn).toHaveBeenCalledWith('Link not found for click increment: nonexistent');
    spyConsoleWarn.mockRestore();
    expect(mockConnection.release).toHaveBeenCalledTimes(1);
  });

  it('existsByShortCode should return true if short code exists', async () => {
    mockConnection.execute.mockResolvedValue([[{ count: 1 }], []]); // Count is 1

    const repo = new MySqlRepository();
    const exists = await repo.existsByShortCode('abc');

    expect(exists).toBe(true);
    expect(mockConnection.execute).toHaveBeenCalledTimes(1);
    expect(mockConnection.execute).toHaveBeenCalledWith('SELECT COUNT(*) as count FROM links WHERE shortCode = ?', ['abc']);
    expect(mockConnection.release).toHaveBeenCalledTimes(1);
  });

  it('existsByShortCode should return false if short code does not exist', async () => {
    mockConnection.execute.mockResolvedValue([[{ count: 0 } ], []]); // Count is 0

    const repo = new MySqlRepository();
    const exists = await repo.existsByShortCode('nonexistent');

    expect(exists).toBe(false);
    expect(mockConnection.execute).toHaveBeenCalledTimes(1);
    expect(mockConnection.execute).toHaveBeenCalledWith('SELECT COUNT(*) as count FROM links WHERE shortCode = ?', ['nonexistent']);
    expect(mockConnection.release).toHaveBeenCalledTimes(1);
  });
});
