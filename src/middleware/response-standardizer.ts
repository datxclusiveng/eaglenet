import { Request, Response, NextFunction } from "express";

/**
 * Middleware to standardize API responses.
 * Adds a helper method res.success() and wraps errors.
 */
export const responseStandardizer = (req: Request, res: Response, next: NextFunction) => {
  // 1. Success wrapper
  (res as any).success = (data: any, message?: string, meta?: any) => {
    return res.status(res.statusCode || 200).json({
      success: true,
      message,
      data,
      meta, // For pagination, etc.
      timestamp: new Date().toISOString(),
      requestId: (req as any).id,
    });
  };

  next();
};
