import { randomBytes } from "crypto";

/**
 * Generates a unique EagleNet ID with the given suffix prefix.
 * Format: EGL-<TYPE>-<TIMESTAMP><RANDOM>
 * e.g. EGL-TRK-1709500000001A2B
 */
export function generateEglId(type: "TRK" | "SHIP" | "PAY" | "REF"): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = randomBytes(3).toString("hex").toUpperCase();
  return `EGL-${type}-${timestamp}${random}`;
}

/**
 * Build pagination metadata
 */
export function paginate(total: number, page: number, limit: number) {
  const totalPages = Math.ceil(total / limit);
  return {
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

/**
 * Parse and sanitise pagination query params
 */
export function parsePagination(query: Record<string, any>) {
  const page = Math.max(1, parseInt(query.page as string) || 1);
  const limit = Math.min(
    100,
    Math.max(1, parseInt(query.limit as string) || 10),
  );
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}
