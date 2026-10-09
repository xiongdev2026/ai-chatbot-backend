import { z } from 'zod';

// Basic sanitization function to remove potentially harmful HTML/script tags
// For more robust sanitization, consider using a library like 'xss'
export const sanitizeString = (input: string): string => {
  if (!input) return input;
  // Remove script tags
  let sanitized = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  // Remove common event handlers
  sanitized = sanitized.replace(/on\w+="[^"]*"/gi, '');
  // Remove data: URIs
  sanitized = sanitized.replace(/data:[^;]*;base64[^"]*/gi, '');
  return sanitized;
};

// Zod refinement for sanitization
export const sanitizedString = z.string().transform((val) => sanitizeString(val));

// Example of how to use it in a Zod schema:
// const mySchema = z.object({
//   name: sanitizedString,
//   description: z.string().transform((val) => sanitizeString(val)),
// });
