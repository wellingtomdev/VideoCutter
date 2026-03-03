import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { Job, CreateJobRequest, UpdateJobRequest } from '../types';
import { api } from '../services/api';

interface JobsContextValue {
  jobs: Job[];
  activeJobId: string | null;
  activeJob: Job | null;
  loading: boolean;
  error: string | null;
  loadJobs: () => Promise<void>;
  createJob: (data: CreateJobRequest) => Promise<Job>;
  selectJob: (id: string | null) => void;
  updateJob: (id: string, data: UpdateJobRequest) => Promise<Job>;
  refreshJob: (id: string) => Promise<Job>;
  deleteJob: (id: string) => Promise<void>;
}

const JobsContext = createContext<JobsContextValue | null>(null);

export function JobsProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeJob = jobs.find(j => j.id === activeJobId) ?? null;

  const loadJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listJobs();
      setJobs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCreateJob = useCallback(async (data: CreateJobRequest): Promise<Job> => {
    const job = await api.createJob(data);
    setJobs(prev => [job, ...prev]);
    setActiveJobId(job.id);
    return job;
  }, []);

  const selectJob = useCallback((id: string | null) => {
    setActiveJobId(id);
  }, []);

  const handleUpdateJob = useCallback(async (id: string, data: UpdateJobRequest): Promise<Job> => {
    const updated = await api.updateJob(id, data);
    setJobs(prev => prev.map(j => j.id === id ? updated : j));
    return updated;
  }, []);

  const handleRefreshJob = useCallback(async (id: string): Promise<Job> => {
    const fresh = await api.getJob(id);
    setJobs(prev => prev.map(j => j.id === id ? fresh : j));
    return fresh;
  }, []);

  const handleDeleteJob = useCallback(async (id: string): Promise<void> => {
    await api.deleteJob(id);
    setJobs(prev => prev.filter(j => j.id !== id));
    setActiveJobId(prev => prev === id ? null : prev);
  }, []);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  return (
    <JobsContext.Provider
      value={{
        jobs,
        activeJobId,
        activeJob,
        loading,
        error,
        loadJobs,
        createJob: handleCreateJob,
        selectJob,
        updateJob: handleUpdateJob,
        refreshJob: handleRefreshJob,
        deleteJob: handleDeleteJob,
      }}
    >
      {children}
    </JobsContext.Provider>
  );
}

export function useJobs(): JobsContextValue {
  const ctx = useContext(JobsContext);
  if (!ctx) {
    throw new Error('useJobs must be used within a JobsProvider');
  }
  return ctx;
}
