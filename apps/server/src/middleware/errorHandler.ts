import type { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(err: AppError | Error, _req: Request, res: Response, _next: NextFunction): void {
  console.error(err);
  const statusCode = 'statusCode' in err ? err.statusCode : 500;
  res.status(statusCode).json({ error: err.message });
}
