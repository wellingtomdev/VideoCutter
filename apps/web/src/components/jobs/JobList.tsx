import { useState } from 'react';
import type { Job } from '../../types';
import { JobCard } from './JobCard';

interface JobListProps {
  jobs: Job[];
  activeJobId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export function JobList({ jobs, activeJobId, onSelect, onDelete }: JobListProps) {
  const [search, setSearch] = useState('');

  const filtered = search.trim()
    ? jobs.filter(j => {
        const q = search.toLowerCase();
        return j.title.toLowerCase().includes(q)
          || (j.source.youtubeUrl?.toLowerCase().includes(q))
          || (j.source.path?.toLowerCase().includes(q));
      })
    : jobs;

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
        <p className="text-sm text-gray-500">Nenhum trabalho ainda.</p>
        <p className="text-xs text-gray-600 mt-1">
          Clique em "+ Novo" para comecar.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Search */}
      {jobs.length > 3 && (
        <div className="px-3 py-2 shrink-0">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar trabalhos..."
            className="w-full bg-gray-700/50 border border-gray-600 rounded px-2.5 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      )}

      {/* Cards */}
      <div className="divide-y divide-gray-700/50">
        {filtered.map(job => (
          <JobCard
            key={job.id}
            job={job}
            isActive={job.id === activeJobId}
            onSelect={onSelect}
            onDelete={onDelete}
          />
        ))}
      </div>

      {search && filtered.length === 0 && (
        <p className="text-xs text-gray-500 text-center py-4">
          Nenhum resultado para "{search}"
        </p>
      )}
    </div>
  );
}
