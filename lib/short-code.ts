/**
 * @fileoverview Utility functions for generating and ensuring uniqueness of short codes.
 */

import crypto from 'crypto';

// Default length for generated short codes
const DEFAULT_SHORT_CODE_LENGTH = 6;

/**
 * Generates a random short code of a specified length (default 6 characters).
 * Uses hexadecimal encoding for randomness.
 * @param {number} [length=6] - The desired length of the short code.
 * @returns {string} A randomly generated short code.
 */
export function generateShortCode(length: number = DEFAULT_SHORT_CODE_LENGTH): string {
  // Calculate bytes needed: length * 3 / 2 for hex encoding (each 3 bytes -> 6 hex chars)
  const bytesNeeded = Math.ceil(length / 2); 
  return crypto.randomBytes(bytesNeeded).toString('hex').substring(0, length);
}

/**
 * Generates a unique short code by repeatedly generating codes until one is found
 * that does not exist according to the provided existence check function.
 * @param {(code: string) => Promise<boolean>} checkShortCodeExists - An async function that returns true if the code exists, false otherwise.
 * @param {number} [length=6] - The desired length of the short code.
 * @param {number} [maxRetries=10] - Maximum number of retries before throwing an error.
 * @returns {Promise<string>} A promise that resolves to a unique short code.
 * @throws {Error} If a unique short code cannot be generated within the allowed retries.
 */
export async function generateUniqueShortCode(
  checkShortCodeExists: (code: string) => Promise<boolean>,
  length: number = DEFAULT_SHORT_CODE_LENGTH,
  maxRetries: number = 10
): Promise<string> {
  let attempts = 0;
  let shortCode: string;

  do {
    shortCode = generateShortCode(length);
    if (attempts++ >= maxRetries) {
      console.error(`Failed to generate unique short code after ${maxRetries} attempts.`);
      throw new Error('Could not generate a unique short code. Please try again later.');
    }
  } while (await checkShortCodeExists(shortCode));
  
  return shortCode;
}
