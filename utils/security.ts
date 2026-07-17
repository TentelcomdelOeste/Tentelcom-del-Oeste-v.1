import DOMPurify from 'dompurify';
import { Timestamp } from 'firebase/firestore';

/**
 * Sanitizes a string to prevent XSS attacks.
 * @param text The string to sanitize.
 * @returns The sanitized string.
 */
export const sanitize = (text: string): string => {
  if (!text) return '';
  return DOMPurify.sanitize(text, {
    ALLOWED_TAGS: [], // No tags allowed for basic text inputs
    ALLOWED_ATTR: []
  });
};

/**
 * Sanitizes an object's string properties.
 * @param obj The object to sanitize.
 * @returns A new object with sanitized string properties.
 */
export const sanitizeObject = <T extends object>(obj: T): T => {
  // Protect Firebase Timestamps from being flattened into plain objects
  if (obj instanceof Timestamp) {
    return obj;
  }

  const sanitized = { ...obj } as any;
  for (const key in sanitized) {
    const value = sanitized[key];

    if (value instanceof Timestamp) {
      // Keep Timestamp as is
      continue;
    }

    if (typeof value === 'string') {
      sanitized[key] = sanitize(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((item: any) => 
        typeof item === 'string' ? sanitize(item) : (typeof item === 'object' && item !== null ? sanitizeObject(item) : item)
      );
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    }
  }
  return sanitized;
};
