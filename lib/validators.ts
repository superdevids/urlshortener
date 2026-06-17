import { z } from 'zod';

// Regex for validating URLs (basic: scheme://domain/path)
// Note: More comprehensive URL regex can be complex. This covers common cases.
// Security: Only allow http:// and https:// schemes to prevent XSS and open redirect attacks
const urlRegex = z.preprocess(
  (val) => typeof val === 'string' ? val.trim() : val, // Trim whitespace
  z.string({
    required_error: "Original URL is required.",
    invalid_type_error: "Original URL must be a string."
  })
  .url({ message: "Invalid URL format. Must start with http:// or https://." })
  .refine((url) => {
    try {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  }, { message: "Only http:// and https:// URLs are allowed. Dangerous schemes like javascript:, data:, or file: are not permitted." })
);

// Schema for custom alias validation
const customAliasSchema = z.string()
  .min(3, { message: "Custom alias must be at least 3 characters long." })
  .max(20, { message: "Custom alias cannot exceed 20 characters." })
  .regex(/^[a-zA-Z0-9_-]+$/, { message: "Custom alias can only contain alphanumeric characters, underscores, and dashes." });

// Schema for optional expiration in days
const expiresInDaysSchema = z.number({
    invalid_type_error: "Expires in days must be a number.",
    required_error: "Expires in days is required."
  })
  .int({ message: "Expires in days must be a whole number." })
  .positive({ message: "Expires in days must be a positive number." })
  .optional(); // Make it optional

// Main schema for shortening a URL
export const shortenUrlSchema = z.object({
  originalUrl: urlRegex,
  customAlias: customAliasSchema.optional(),
  expiresInDays: expiresInDaysSchema,
});

// Input type inferred from the schema
export type ShortenUrlInput = z.infer<typeof shortenUrlSchema>;
