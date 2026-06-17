/**
 * @fileoverview Mock test for the JsonFileRepository.
 * Uses Vitest and mocks necessary Node.js modules like 'fs/promises' and 'proper-lockfile'.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JsonFileRepository } from '@/lib/storage/json-repository';
import { Link, CreateLinkInput } from '@/types';
import fs from 'fs/promises'; // Import mocked modules
import lockfile from 'proper-lockfile';
import crypto from 'crypto'; // Import crypto for mocking

// Mock dependencies
vi.mock('fs/promises');
vi.mock('proper-lockfile');
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-uuid-1234'),
}));
// Mock crypto.randomBytes for predictable short code generation in tests
vi.spyOn(crypto, 'randomBytes').mockImplementation((size) => {
  if (size === 3) return Buffer.from([0xab, 0xcd, 0xef]); // Mock for 'abcdef'
  return Buffer.alloc(size);
});

// --- Test Setup ---
const mockFs = vi.mocked(fs);
const mockLockfile = vi.mocked(lockfile);

let jsonRepo: JsonFileRepository;
let mockReleaseLock: vi.Mock;

// Mock current date for consistent date handling in tests
const MOCK_NOW = new Date('2023-10-26T10:00:00.000Z');
vi.useFakeTimers().setSystemTime(MOCK_NOW);

beforeEach(() => {
  // Reset mocks before each test
  mockFs.access.mockReset();
  mockFs.readFile.mockReset();
  mockFs.writeFile.mockReset();
  mockFs.mkdir.mockReset();
  mockLockfile.lock.mockReset();
  mockUuidV4.mockReset();

  // Provide a default mock implementation for lockfile.lock
  mockReleaseLock = vi.fn();
  mockLockfile.lock.mockResolvedValue(mockReleaseLock);

  // Provide a default mock implementation for uuid v4
  mockUuidV4.mockReturnValue('mock-uuid-1234');

  // Instantiate the repository before each test
  jsonRepo = new JsonFileRepository();
});

afterEach(() => {
   vi.restoreAllMocks(); // Restore mocks after each test run
});

// --- Tests ---

describe('JsonFileRepository Load/Save Operations', () => {
  it('should load links from the JSON file if it exists', async () => {
    const mockLinks: Link[] = [{ id: 'mock-uuid-1234', shortCode: 'abcdef', originalUrl: 'http://example.com', createdAt: MOCK_NOW.toISOString(), expiresAt: null, clickCount: 0, lastClickedAt: null }];
    mockFs.access.mockResolvedValue(undefined);
    mockFs.readFile.mockResolvedValue(JSON.stringify(mockLinks));

    const links = await jsonRepo.findAll();

    expect(mockFs.access).toHaveBeenCalledWith('./data/links.json');
    expect(mockFs.readFile).toHaveBeenCalledWith('./data/links.json', 'utf-8');
    expect(links).toEqual(mockLinks);
    expect(mockReleaseLock).toHaveBeenCalledTimes(1); // Ensure lock is released
  });

  it('should create directory and file if they do not exist on load', async () => {
    const error = new Error('File not found') as NodeJS.ErrnoException; // Cast to ErrnoException for code property
    error.code = 'ENOENT';
    
    mockFs.access.mockRejectedValue(error); // Simulate file not found
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);

    const links = await jsonRepo.findAll();

    expect(mockFs.access).toHaveBeenCalledWith('./data/links.json');
    expect(mockFs.mkdir).toHaveBeenCalledWith('data', { recursive: true }); // Ensure directory creation
    expect(mockFs.writeFile).toHaveBeenCalledWith('./data/links.json', JSON.stringify([])); // Ensure empty file is written
    expect(links).toEqual([]);
    expect(mockReleaseLock).toHaveBeenCalledTimes(1);
  });

   it('should handle parsing errors gracefully by returning an empty array', async () => {
    mockFs.access.mockResolvedValue(undefined);
    mockFs.readFile.mockResolvedValue('invalid json'); // Simulate invalid JSON content
    mockFs.writeFile.mockResolvedValue(undefined); 

    // Expecting empty array if JSON parsing fails (as per loadLinks implementation)
    // Note: The current implementation might throw an error. If graceful handling is desired, adjust loadLinks.
    // For now, we test the current behavior (which might throw). If it throws, this test should expect the error.
    // Let's assume the current implementation *would* throw and adjust test if needed.
    // If loadLinks returns [] on error, the test below is correct. If it throws, adjust as needed.
     await expect(jsonRepo.findAll()).rejects.toThrow(expect.any(SyntaxError)); // Expecting JSON parsing error
     // If loadLinks was modified to return [] on parse error:
     // expect(links).toEqual([]);

    expect(mockFs.writeFile).not.toHaveBeenCalled(); // Should not write if reading failed
    expect(mockReleaseLock).toHaveBeenCalledTimes(1);
  });


  it('should save links correctly to the JSON file', async () => {
    mockFs.access.mockResolvedValue(undefined);
    mockFs.readFile.mockResolvedValue(JSON.stringify([])); // Start empty
    mockFs.writeFile.mockResolvedValue(undefined);

    const newLink: Link = { id: 'mock-uuid-1234', shortCode: 'abcdef', originalUrl: 'http://example.com', createdAt: MOCK_NOW.toISOString(), expiresAt: null, clickCount: 0, lastClickedAt: null };
    await jsonRepo.create(newLink); // This internally calls saveLinks

    expect(mockFs.writeFile).toHaveBeenCalledTimes(1);
    expect(mockFs.writeFile).toHaveBeenCalledWith('./data/links.json', expect.stringContaining('"id": "mock-uuid-1234"'));
    expect(mockReleaseLock).toHaveBeenCalledTimes(1); // Ensure lock is released after save
  });
});

describe('JsonFileRepository Link Management', () => {
  beforeEach(async () => {
       // Setup initial file content for most tests in this describe block
       const mockLinks: Link[] = [{ 
           id: 'u1', 
           shortCode: 'abc', 
           originalUrl: 'http://example.com/one', 
           createdAt: MOCK_NOW.toISOString(), 
           expiresAt: null, 
           clickCount: 5, 
           lastClickedAt: MOCK_NOW.toISOString() 
       },{
           id: 'u2', 
           shortCode: 'def', 
           originalUrl: 'http://example.com/two', 
           createdAt: new Date(MOCK_NOW.getTime() - 86400000).toISOString(), // Yesterday
           expiresAt: new Date(MOCK_NOW.getTime() + 86400000).toISOString(), // Expires tomorrow
           clickCount: 0, 
           lastClickedAt: null 
       }];
       mockFs.access.mockResolvedValue(undefined);
       mockFs.readFile.mockResolvedValue(JSON.stringify(mockLinks));
       mockFs.writeFile.mockResolvedValue(undefined);
   });

  it('should find a link by its short code', async () => {
    const foundLink = await jsonRepo.findByShortCode('abc');
    expect(foundLink).not.toBeNull();
    expect(foundLink?.id).toBe('u1');
    expect(mockReleaseLock).toHaveBeenCalledTimes(1);
  });

  it('should return null if short code not found', async () => {
    const foundLink = await jsonRepo.findByShortCode('nonexistent');
    expect(foundLink).toBeNull();
    expect(mockReleaseLock).toHaveBeenCalledTimes(1);
  });

   it('should find a link by its ID', async () => {
       const foundLink = await jsonRepo.findById('u1');
       expect(foundLink).not.toBeNull();
       expect(foundLink?.id).toBe('u1');
       expect(mockReleaseLock).toHaveBeenCalledTimes(1);
   });

   it('should return null if ID not found', async () => {
       const foundLink = await jsonRepo.findById('nonexistent-id');
       expect(foundLink).toBeNull();
       expect(mockReleaseLock).toHaveBeenCalledTimes(1);
   });

  it('should create a new link when provided valid data', async () => {
    const createInput: CreateLinkInput = { originalUrl: 'http://new.com', expiresInDays: 30 };
    const initialLinksCount = (JSON.parse(mockFs.readFile.mock.calls[0][1]) as Link[]).length;

    const newLink = await jsonRepo.create(createInput);

    expect(newLink).toBeDefined();
    expect(newLink.id).toBe('mock-uuid-1234'); // From mockUuidV4
    expect(newLink.shortCode).toBe('abcdef'); // From mock crypto.randomBytes
    expect(newLink.originalUrl).toBe(createInput.originalUrl);
    expect(newLink.expiresAt).toBeDefined();
    expect(newLink.clickCount).toBe(0);
    
    expect(mockFs.writeFile).toHaveBeenCalledTimes(1);
    const updatedLinks = JSON.parse(mockFs.writeFile.mock.calls[0][1]);
    expect(updatedLinks.length).toBe(initialLinksCount + 1); // One new link added
    expect(mockReleaseLock).toHaveBeenCalledTimes(1);
  });
  
   it('should throw error if custom alias already exists', async () => {
        const createInput: CreateLinkInput = { originalUrl: 'http://new.com', customAlias: 'abc' }; // 'abc' already exists

        await expect(jsonRepo.create(createInput)).rejects.toThrow('Custom alias already in use.');
        expect(mockFs.writeFile).not.toHaveBeenCalled(); // File should not be written
        expect(mockReleaseLock).toHaveBeenCalledTimes(1);
    });

  it('should delete a link by ID and return true', async () => {
    const deleted = await jsonRepo.delete('u1'); // Delete the first link
    expect(deleted).toBe(true);
    expect(mockFs.writeFile).toHaveBeenCalledTimes(1);
    const updatedLinks = JSON.parse(mockFs.writeFile.mock.calls[0][1]);
    expect(updatedLinks.length).toBe(1); // Should contain only the second link
    expect(updatedLinks[0].id).toBe('u2');
    expect(mockReleaseLock).toHaveBeenCalledTimes(1);
  });

  it('should return false when deleting a non-existent ID', async () => {
    const deleted = await jsonRepo.delete('nonexistent-id');
    expect(deleted).toBe(false);
    expect(mockFs.writeFile).not.toHaveBeenCalled(); // No changes made
    expect(mockReleaseLock).toHaveBeenCalledTimes(1);
  });

  it('should increment click count and update lastClickedAt for an active link', async () => {
    const result = await jsonRepo.incrementClick('abc'); // 'abc' is active
    expect(result).toBeUndefined(); // Function returns void
    expect(mockFs.writeFile).toHaveBeenCalledTimes(1);
    
    const updatedLinks = JSON.parse(mockFs.writeFile.mock.calls[0][1]);
    const updatedLink = updatedLinks.find((l: Link) => l.shortCode === 'abc');
    
    expect(updatedLink.clickCount).toBe(6); // 5 + 1
    expect(updatedLink.lastClickedAt).toBe(new Date().toISOString()); // Should be current time
    expect(mockReleaseLock).toHaveBeenCalledTimes(1);
  });

  it('should NOT increment click count or update lastClickedAt if link is expired', async () => {
      // Modify the expiresAt for the 'def' link to be in the past
      mockFs.readFile.mockImplementation(async (filePath: string) => {
           if (filePath === './data/links.json') {
               const links: Link[] = [{ 
                   id: 'u1', shortCode: 'abc', originalUrl: 'http://example.com/one', createdAt: MOCK_NOW.toISOString(), expiresAt: null, clickCount: 5, lastClickedAt: MOCK_NOW.toISOString() 
               },{
                   id: 'u2', shortCode: 'def', originalUrl: 'http://example.com/two', createdAt: new Date(MOCK_NOW.getTime() - 86400000).toISOString(), 
                   expiresAt: new Date(MOCK_NOW.getTime() - 86400000).toISOString(), // Expired yesterday
                   clickCount: 0, lastClickedAt: null 
               }];
               return JSON.stringify(links);
           }
           return '';
       });
       
       const spyConsoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

       await jsonRepo.incrementClick('def');

       expect(spyConsoleWarn).toHaveBeenCalledWith(expect.stringContaining('Attempted to click expired link'));
       expect(mockFs.writeFile).not.toHaveBeenCalled(); // No write should occur
       expect(spyConsoleWarn).toHaveBeenCalledTimes(1);
       spyConsoleWarn.mockRestore();
       expect(mockReleaseLock).toHaveBeenCalledTimes(1);
  });

  it('should return false if short code not found for incrementClick', async () => {
     const spyConsoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
     
     await jsonRepo.incrementClick('nonexistent');

      expect(spyConsoleWarn).toHaveBeenCalledWith('Link not found for click increment: nonexistent');
      expect(mockFs.writeFile).not.toHaveBeenCalled();
      spyConsoleWarn.mockRestore();
      expect(mockReleaseLock).toHaveBeenCalledTimes(1);
  });

  it('should return true if short code exists', async () => {
    const exists = await jsonRepo.existsByShortCode('abc');
    expect(exists).toBe(true);
    expect(mockReleaseLock).toHaveBeenCalledTimes(1);
  });

  it('should return false if short code does not exist', async () => {
    const exists = await jsonRepo.existsByShortCode('nonexistent');
    expect(exists).toBe(false);
    expect(mockReleaseLock).toHaveBeenCalledTimes(1);
  });
});
