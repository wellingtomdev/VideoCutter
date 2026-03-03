import { useState } from 'react';
import { useJobs } from '../../contexts/JobsContext';
import { JobList } from '../jobs/JobList';
import { NewJobForm } from '../jobs/NewJobForm';

export function Sidebar() {
  const { jobs, activeJobId, selectJob, deleteJob, loading } = useJobs();
  const [showNewForm, setShowNewForm] = useState(false);

  return (
    <aside className="w-72 bg-gray-800 border-r border-gray-700 flex flex-col shrink-0 overflow-hidden">
      {/* Sidebar header */}
      <div className="px-3 py-2.5 border-b border-gray-700 flex items-center justify-between shrink-0">
        <h2 className="text-sm font-semibold text-gray-300">Trabalhos</h2>
        <button
          onClick={() => setShowNewForm(!showNewForm)}
          className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded transition-colors font-medium"
        >
          {showNewForm ? 'Cancelar' : '+ Novo'}
        </button>
      </div>

      {/* New job form (collapsible) */}
      {showNewForm && (
        <div className="border-b border-gray-700 shrink-0">
          <NewJobForm onCreated={() => setShowNewForm(false)} />
        </div>
      )}

      {/* Job list */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <svg className="animate-spin w-5 h-5 text-gray-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
            </svg>
          </div>
        ) : (
          <JobList
            jobs={jobs}
            activeJobId={activeJobId}
            onSelect={selectJob}
            onDelete={deleteJob}
          />
        )}
      </div>
    </aside>
  );
}
