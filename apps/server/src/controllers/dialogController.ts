import type { Request, Response } from 'express';
import { showOpenFileDialog } from '../services/nativeDialog';

export function handleOpenFile(req: Request, res: Response): void {
  const { filter, title } = req.body as { filter?: string; title?: string };

  const path = showOpenFileDialog({ title, filter });
  res.json({ path });
}
