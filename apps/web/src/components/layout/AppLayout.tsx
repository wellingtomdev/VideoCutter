import { Sidebar } from './Sidebar';
import { EditorPanel } from '../editor/EditorPanel';
import { useJobs } from '../../contexts/JobsContext';

export function AppLayout() {
  const { activeJob } = useJobs();

  return (
    <div className="h-screen bg-gray-900 text-gray-100 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-gray-800 px-4 py-2.5 flex items-center justify-between border-b border-gray-700 shrink-0">
        <h1 className="text-lg font-bold text-white">Video Cutter</h1>
        {activeJob && (
          <span className="text-sm text-gray-400 truncate max-w-[400px]">
            {activeJob.title}
          </span>
        )}
      </header>

      {/* Main: Sidebar + Editor */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        <Sidebar />

        <main className="flex-1 min-w-0 min-h-0 overflow-hidden">
          {activeJob ? (
            <EditorPanel job={activeJob} />
          ) : (
            <WelcomePanel />
          )}
        </main>
      </div>
    </div>
  );
}

function WelcomePanel() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-8">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="w-20 h-20 text-gray-700 mb-6">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="M10 9l5 3-5 3V9z" fill="currentColor" />
      </svg>
      <h2 className="text-xl font-semibold text-gray-400 mb-2">
        Nenhum trabalho selecionado
      </h2>
      <p className="text-gray-500 text-sm max-w-md">
        Crie um novo trabalho usando o botao "+ Novo" na barra lateral ou selecione um trabalho existente para comecar a editar.
      </p>
    </div>
  );
}
