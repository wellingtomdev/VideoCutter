import { useState } from 'react';
import type { Job, JobStatus } from '../../types';

interface JobCardProps {
  job: Job;
  isActive: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

const STATUS_CONFIG: Record<JobStatus, { label: string; color: string }> = {
  setup: { label: 'Configurando', color: 'bg-gray-600 text-gray-300' },
  ready: { label: 'Pronto', color: 'bg-blue-900 text-blue-300' },
  preparing: { label: 'Preparando', color: 'bg-yellow-900 text-yellow-300' },
  cutting: { label: 'Cortando', color: 'bg-orange-900 text-orange-300' },
  done: { label: 'Concluido', color: 'bg-green-900 text-green-300' },
  error: { label: 'Erro', color: 'bg-red-900 text-red-300' },
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}m${String(s).padStart(2, '0')}s` : `${s}s`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function JobCard({ job, isActive, onSelect, onDelete }: JobCardProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const status = STATUS_CONFIG[job.status];

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (showConfirm) {
      onDelete(job.id);
      setShowConfirm(false);
    } else {
      setShowConfirm(true);
    }
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowConfirm(false);
  };

  return (
    <div
      data-testid="job-card"
      onClick={() => onSelect(job.id)}
      className={`px-3 py-2.5 cursor-pointer border-l-2 transition-colors group ${
        isActive
          ? 'bg-gray-700/60 border-blue-500'
          : 'border-transparent hover:bg-gray-700/30'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-200 truncate" title={job.title}>
            {job.title}
          </p>
          <div className="flex items-center gap-2 mt-1">
            {/* Source icon */}
            <span className="text-xs text-gray-500">
              {job.source.type === 'youtube' ? 'YT' : 'Local'}
            </span>
            {/* Status badge */}
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${status.color}`}>
              {status.label}
            </span>
          </div>
          {/* Cuts count for jobs with multiple cuts */}
          {job.cuts && job.cuts.length > 0 && (
            <div className="flex items-center gap-1.5 mt-1">
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-green-500 shrink-0">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
              </svg>
              <span className="text-[10px] text-gray-400">
                {job.cuts.length} {job.cuts.length === 1 ? 'corte' : 'cortes'}
              </span>
            </div>
          )}
          {/* Cut info for legacy completed jobs (no cuts array) */}
          {job.status === 'done' && job.output && !job.cuts?.length && (
            <div className="flex items-center gap-1.5 mt-1">
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-green-500 shrink-0">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
              </svg>
              <span className="text-[10px] text-gray-400">
                {formatDuration(job.output.durationMs)}
                {job.output.fileSize ? ` · ${formatFileSize(job.output.fileSize)}` : ''}
              </span>
            </div>
          )}
          {/* Cut range for jobs with cut data */}
          {job.cut && job.status !== 'setup' && (
            <p className="text-[10px] text-gray-500 font-mono mt-0.5">
              {formatDuration(job.cut.startMs)} → {formatDuration(job.cut.endMs)}
            </p>
          )}
          <p className="text-[11px] text-gray-500 mt-0.5">
            {formatDate(job.createdAt)}
          </p>
        </div>

        {/* Delete button */}
        <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {showConfirm ? (
            <div className="flex gap-1">
              <button
                onClick={handleDelete}
                className="text-[10px] bg-red-700 hover:bg-red-600 text-white px-1.5 py-0.5 rounded"
              >
                Sim
              </button>
              <button
                onClick={handleCancelDelete}
                className="text-[10px] bg-gray-600 hover:bg-gray-500 text-white px-1.5 py-0.5 rounded"
              >
                Nao
              </button>
            </div>
          ) : (
            <button
              onClick={handleDelete}
              className="p-1 text-gray-500 hover:text-red-400 transition-colors"
              title="Excluir trabalho"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 01.7.797l-.5 6a.75.75 0 01-1.497-.124l.5-6a.75.75 0 01.797-.672zm3.54.797a.75.75 0 10-1.497.126l.5 6a.75.75 0 101.497-.126l-.5-6z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
