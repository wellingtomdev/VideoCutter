import type { CreateJobRequest, Job, UpdateJobRequest } from '../../types';
import { BASE, fetchJson } from './client';

export const jobsApi = {
  listJobs: async (): Promise<Job[]> => {
    return fetchJson<Job[]>(`${BASE}/jobs`);
  },

  getJob: async (id: string): Promise<Job> => {
    return fetchJson<Job>(`${BASE}/jobs/${encodeURIComponent(id)}`);
  },

  createJob: async (data: CreateJobRequest): Promise<Job> => {
    return fetchJson<Job>(`${BASE}/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  updateJob: async (id: string, data: UpdateJobRequest): Promise<Job> => {
    return fetchJson<Job>(`${BASE}/jobs/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  deleteJob: async (id: string): Promise<void> => {
    const res = await fetch(`${BASE}/jobs/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error((d as { error?: string }).error ?? `HTTP ${res.status}`);
    }
  },
};
