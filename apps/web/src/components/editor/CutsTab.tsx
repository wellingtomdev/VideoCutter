import { useState } from 'react';
import type { JobCutEntry } from '../../types';

interface CutsTabProps {
  cuts: JobCutEntry[];
  onSelect: (cut: JobCutEntry) => void;
  onDelete?: (cut: JobCutEntry) => void;
  onDownload?: (cut: JobCutEntry) => void;
  selectedCutId?: string | null;
}

function formatMs(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function basename(p: string): string {
  return p.replace(/\\/g, '/').split('/').pop() ?? p;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function CutsTab({ cuts, onSelect, onDelete, onDownload, selectedCutId }: CutsTabProps) {
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  return (
    <div className="shrink-0 p-4">
      <div className="grid gap-3 max-w-3xl mx-auto">
        {cuts.map((cut) => {
          const isSelected = selectedCutId === cut.id;
          const isConfirming = confirmingDeleteId === cut.id;
          return (
            <div
              key={cut.id}
              className={`bg-gray-800 rounded-lg p-4 border transition-colors cursor-pointer ${
                isSelected
                  ? 'border-blue-500 ring-1 ring-blue-500/30'
                  : 'border-gray-700 hover:border-gray-600'
              }`}
              onClick={() => onSelect(cut)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className={`font-mono text-sm font-medium ${isSelected ? 'text-blue-400' : 'text-green-400'}`}>
                    {cut.label}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-gray-400">
                    <span>Duração: {formatMs(cut.output.durationMs)}</span>
                    {cut.output.fileSize != null && (
                      <span>Tamanho: {formatFileSize(cut.output.fileSize)}</span>
                    )}
                    {cut.audioOffsetMs !== 0 && (
                      <span className="text-yellow-400/70">
                        Offset: {cut.audioOffsetMs}ms
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1 truncate" title={cut.output.filePath}>
                    {basename(cut.output.filePath)}
                  </p>
                  {cut.createdAt && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatDate(cut.createdAt)}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {onDownload && (
                    <button
                      data-testid={`download-${cut.id}`}
                      onClick={(e) => { e.stopPropagation(); onDownload(cut); }}
                      className="text-xs px-2 py-1.5 rounded bg-gray-700 hover:bg-green-700 text-gray-300 hover:text-white transition-colors"
                      title="Baixar corte"
                    >
                      Baixar
                    </button>
                  )}

                  {onDelete && (
                    isConfirming ? (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          data-testid={`confirm-delete-${cut.id}`}
                          onClick={() => { onDelete(cut); setConfirmingDeleteId(null); }}
                          className="text-xs px-2 py-1.5 rounded bg-red-600 hover:bg-red-500 text-white transition-colors"
                        >
                          Confirmar
                        </button>
                        <button
                          data-testid={`cancel-delete-${cut.id}`}
                          onClick={() => setConfirmingDeleteId(null)}
                          className="text-xs px-2 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        data-testid={`delete-${cut.id}`}
                        onClick={(e) => { e.stopPropagation(); setConfirmingDeleteId(cut.id); }}
                        className="text-xs px-2 py-1.5 rounded bg-gray-700 hover:bg-red-700 text-gray-400 hover:text-white transition-colors"
                        title="Excluir corte"
                      >
                        Excluir
                      </button>
                    )
                  )}

                  <button
                    onClick={(e) => { e.stopPropagation(); onSelect(cut); }}
                    className={`text-xs px-3 py-1.5 rounded transition-colors ${
                      isSelected
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 hover:bg-blue-700 text-gray-300 hover:text-white'
                    }`}
                  >
                    {isSelected ? 'Selecionado' : 'Selecionar'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
