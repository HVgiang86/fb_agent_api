import { ValueTransformer } from 'typeorm';

/**
 * Transformer to ensure MySQL date/datetime fields are always converted to Date objects
 */
export const DateTransformer: ValueTransformer = {
  to: (value: Date | string | null): Date | string | null => {
    // When saving to database
    if (!value) {
      return null;
    }

    if (value instanceof Date) {
      return value;
    }

    if (typeof value === 'string') {
      return new Date(value);
    }

    return value;
  },

  from: (value: string | Date | null): Date | null => {
    // When reading from database
    if (!value) {
      return null;
    }

    if (value instanceof Date) {
      return value;
    }

    if (typeof value === 'string') {
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : date;
    }

    return null;
  },
};
