/**
 * @fileoverview Mock test for the short-code generator utility.
 * Uses Vitest for running tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateShortCode, generateUniqueShortCode } from '@/lib/short-code';
import crypto from 'crypto';

// Mock crypto module
vi.mock('crypto', async () => {
  const actual = await vi.importActual<typeof import('crypto')>('crypto');
  return {
    ...actual,
    default: {
      ...actual.default,
      randomBytes: vi.fn((size: number) => {
        // Return a predictable buffer based on size
        // For size 3, we want 6 hex chars. Let's mock it to return a known sequence.
        if (size === 3) {
          return Buffer.from([0xde, 0xad, 0xbe]); // Mock buffer representing 'deadbe'
        }
        if (size === 4) {
          return Buffer.from([0xde, 0xad, 0xbe, 0xef]); // Mock buffer for 8 chars
        }
        // Fallback for unexpected sizes
        return Buffer.alloc(size); 
      }),
    },
    randomBytes: vi.fn((size: number) => {
      if (size === 3) {
        return Buffer.from([0xde, 0xad, 0xbe]);
      }
      if (size === 4) {
        return Buffer.from([0xde, 0xad, 0xbe, 0xef]);
      }
      return Buffer.alloc(size); 
    }),
  };
});

describe('Short Code Generation', () => {
  // Test generation of default length short code
  it('should generate a short code of default length (6 characters)', () => {
    const shortCode = generateShortCode();
    expect(shortCode).toBe('deadbe'); // Based on mocked crypto.randomBytes
    expect(shortCode).toHaveLength(6);
  });

  // Test generation with a specified length
  it('should generate a short code of specified length', () => {
    const shortCode = generateShortCode(8); // Requesting 8 characters
    expect(shortCode).toBe('deadbeef'); // Based on mocked crypto.randomBytes
    expect(shortCode).toHaveLength(8);
  });

  // Test generation with zero length (should be empty string)
  it('should generate an empty string for length 0', () => {
    const shortCode = generateShortCode(0);
    expect(shortCode).toBe('');
  });
});

describe('Unique Short Code Generation', () => {
  // Mock the existence check function for testing
  const mockCheckExists = vi.fn();

  // Reset mocks before each test
  beforeEach(() => {
    mockCheckExists.mockClear();
    // Resetting the mock implementation for randomBytes if it was modified globally
    // This is important if other tests also mock crypto
    vi.mocked(crypto.randomBytes).mockImplementation((size: number) => {
      if (size === 3) return Buffer.from([0xde, 0xad, 0xbe]);
      if (size === 4) return Buffer.from([0xde, 0xad, 0xbe, 0xef]);
      return Buffer.alloc(size);
    });
  });

  // Test case where the first generated code is unique
  it('should return a unique short code if the first attempt is unique', async () => {
    mockCheckExists.mockResolvedValue(false); // First code is not found
    
    await expect(generateUniqueShortCode(mockCheckExists)).resolves.toBe('deadbe');
    expect(mockCheckExists).toHaveBeenCalledTimes(1);
    expect(mockCheckExists).toHaveBeenCalledWith('deadbe');
  });

  // Test case with one collision before finding a unique code
  it('should generate a unique code after one collision', async () => {
    // Simulate the first two calls finding the code, third is unique
    mockCheckExists
      .mockResolvedValueOnce(true)  // 'deadbe' exists
      .mockResolvedValueOnce(true)  // next generated code (mocked same) exists
      .mockResolvedValueOnce(false); // third generated code is unique
      
    // Mock randomBytes to return different values on subsequent calls if needed,
    // but for simplicity, let's assume mockCheckExists handles uniqueness logic.
    // If generateShortCode itself needs to produce different values, that mock needs refinement.
    // For now, let's assume the existence check logic forces retries.
    
    // Override randomBytes for this test to simulate different generated codes
    // This indicates that the underlying generateShortCode must also be producing different outputs.
    // Let's refine the crypto mock:
     vi.mocked(crypto.randomBytes).mockImplementation((size: number) => {
       // Cycle through some values
       const callCount = mockCheckExists.mock.calls.length; // Based on how many times check was called
       if (size === 3) {
         if (callCount === 1) return Buffer.from([0xde, 0xad, 0xbe]); // First attempt: deadbe
         if (callCount === 2) return Buffer.from([0xca, 0xfe, 0xba]); // Second attempt: cafebabe
         return Buffer.from([0x12, 0x34, 0x56]); // Third attempt: 123456 (unique)
       }
       return Buffer.alloc(size);
     });

    await expect(generateUniqueShortCode(mockCheckExists)).resolves.toBe('123456'); // Expecting the unique code
    expect(mockCheckExists).toHaveBeenCalledTimes(3); // Called 3 times: 1st (fail), 2nd (fail), 3rd (success)
    expect(mockCheckExists).toHaveBeenNthCalledWith(1, 'deadbe');
    expect(mockCheckExists).toHaveBeenNthCalledWith(2, 'cafebabe');
    expect(mockCheckExists).toHaveBeenNthCalledWith(3, '123456');
  });

  // Test case that reaches the maximum retry limit
  it('should throw an error if max retries are exceeded', async () => {
    mockCheckExists.mockResolvedValue(true); // All generated codes exist

    // Expect the function to throw an error after exceeding retries
    await expect(generateUniqueShortCode(mockCheckExists, 6, 3)).rejects.toThrow('Could not generate a unique short code.');
    
    // Check that the existence function was called maxRetries + 1 times (initial call + retries)
    expect(mockCheckExists).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    expect(mockCheckExists).toHaveBeenNthCalledWith(1, 'deadbe'); // Initial call
    // Subsequent calls will also check 'deadbe' due to the mock implementation, 
    // unless the mock is more sophisticated to return different values per call.
  });

  // Test handling of different short code lengths
  it('should handle unique short code generation for custom lengths', async () => {
    mockCheckExists.mockResolvedValue(false); // Assume unique on first try for simplicity
    
    await expect(generateUniqueShortCode(mockCheckExists, 8)).resolves.toBe('deadbeef'); // Expecting 8 chars from mock
    expect(mockCheckExists).toHaveBeenCalledTimes(1);
    expect(mockCheckExists).toHaveBeenCalledWith('deadbeef');
  });
});
