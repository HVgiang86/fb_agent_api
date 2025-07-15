/**
 * Safely formats a date to ISO string
 * Handles cases where value might be string, Date, or null/undefined
 */
export function formatDateToISO(
  date: Date | string | null | undefined,
): string | null {
  if (!date) {
    return null;
  }

  try {
    // If it's already a Date object
    if (date instanceof Date) {
      return date.toISOString();
    }

    // If it's a string, try to parse it
    if (typeof date === 'string') {
      const parsedDate = new Date(date);
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate.toISOString();
      }
    }

    return null;
  } catch (error) {
    console.error('Error formatting date:', error);
    return null;
  }
}

/**
 * Safely formats a date to date-only string (YYYY-MM-DD)
 * Handles cases where value might be string, Date, or null/undefined
 */
export function formatDateOnly(
  date: Date | string | null | undefined,
): string | null {
  if (!date) {
    return null;
  }

  try {
    // If it's already a Date object
    if (date instanceof Date) {
      return date.toISOString().split('T')[0];
    }

    // If it's a string, try to parse it
    if (typeof date === 'string') {
      const parsedDate = new Date(date);
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate.toISOString().split('T')[0];
      }
    }

    return null;
  } catch (error) {
    console.error('Error formatting date:', error);
    return null;
  }
}
