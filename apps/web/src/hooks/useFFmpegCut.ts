import { useState, useCallback } from 'react';
import { api } from '../services/api';
import type { CutRequest, CutResponse } from '../types';

type CutState = 'idle' | 'cutting' | 'done' | 'error';

export function useFFmpegCut() {
  const [state, setState] = useState<CutState>('idle');
  const [result, setResult] = useState<CutResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cut = useCallback(async (req: CutRequest) => {
    setState('cutting');
    setError(null);
    setResult(null);

    try {
      const response = await api.cutVideo(req);
      setResult(response);
      setState('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState('error');
    }
  }, []);

  const reset = useCallback(() => {
    setState('idle');
    setResult(null);
    setError(null);
  }, []);

  return { state, result, error, cut, reset };
}
