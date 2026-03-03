# ROADMAP — VideoCutter

Plano detalhado de melhorias para o projeto VideoCutter.
Cada seção contém descrição, arquivos envolvidos, tipos novos, mudanças de API, passos de implementação, testes e dependências.

---

## Sumário

| # | Melhoria | Categoria |
|---|----------|-----------|
| 1 | Opção de modelo (Rápido vs Preciso) | Sugestões IA |
| 2 | Preview do clip sugerido | Sugestões IA |
| 3 | Regenerar por faixa de tempo | Sugestões IA |
| 4 | Exportar em lote | Sugestões IA |
| 5 | Keyboard shortcuts | UX / Frontend |
| 6 | Undo/Redo na seleção | UX / Frontend |
| 7 | Timeline visual das sugestões | UX / Frontend |
| 8 | Indicador de progresso no export | UX / Frontend |
| 9 | Cache de sugestões por hash | Backend / Infra |
| 10 | Streaming de sugestões (SSE) | Backend / Infra |
| 11 | Transcrição via Whisper | Backend / Infra |
| 12 | Formato vertical (9:16) | Backend / Infra |

---

## 1. Opção de modelo (Rápido vs Preciso)

### Descrição
Permitir ao usuário escolher entre `gpt-4o-mini` (rápido e barato) e `gpt-4o` (mais preciso e com respostas de melhor qualidade) ao gerar sugestões de clips. O frontend exibe um toggle/select no componente de sugestões, e o backend aceita o parâmetro `model` no POST `/suggestions`.

### Arquivos a modificar

| Arquivo | O que mudar |
|---------|-------------|
| `packages/types/src/index.ts` | Adicionar campo `model` em `SuggestClipsRequest` |
| `apps/server/src/services/llmService.ts` | Aceitar `model` em `SuggestClipsParams`, usar no `client.chat.completions.parse()` |
| `apps/server/src/controllers/suggestionsController.ts` | Extrair `model` do body e passar para `suggestClips()` |
| `apps/web/src/components/editor/ClipSuggestions.tsx` | Adicionar toggle de modelo no UI |
| `apps/web/src/services/api/suggestionsApi.ts` | Enviar `model` no body (ja passa `SuggestClipsRequest`, sera automatico) |

### Tipos novos

```typescript
// packages/types/src/index.ts — modificar SuggestClipsRequest
export type SuggestionModel = 'gpt-4o-mini' | 'gpt-4o';

export interface SuggestClipsRequest {
  jobId: string;
  rangeStartMs?: number;
  rangeEndMs?: number;
  categories?: ClipCategory[];
  model?: SuggestionModel;  // NOVO
}
```

### Mudanças de API

- **POST `/suggestions`** — novo campo opcional `model` no body (`'gpt-4o-mini'` | `'gpt-4o'`). Se ausente, usar o valor de `config.openaiModel` (default: `gpt-4o-mini`).

### Passos de implementação

1. **Tipos** — Em `packages/types/src/index.ts`:
   - Criar type `SuggestionModel = 'gpt-4o-mini' | 'gpt-4o'`
   - Adicionar `model?: SuggestionModel` em `SuggestClipsRequest`

2. **LLM Service** — Em `apps/server/src/services/llmService.ts`:
   - Adicionar `model?: string` em `SuggestClipsParams`
   - Na funcao `suggestClips`, usar `params.model ?? config.openaiModel` ao inves de `config.openaiModel` fixo
   - Passar esse valor para `suggestClipsForChunk`
   - Em `suggestClipsForChunk`, receber `model` como parametro e usar em `client.chat.completions.parse({ model, ... })`

   ```typescript
   // Em SuggestClipsParams:
   export interface SuggestClipsParams {
     segments: TranscriptSegment[];
     rangeStartMs?: number;
     rangeEndMs?: number;
     categories?: ClipCategory[];
     model?: string;  // NOVO
   }

   // Em suggestClips:
   const modelToUse = params.model ?? config.openaiModel;

   // Em suggestClipsForChunk — adicionar parametro model:
   async function suggestClipsForChunk(
     client: OpenAI,
     systemPrompt: string,
     segments: TranscriptSegment[],
     chunkIndex: number,
     totalChunks: number,
     model: string,  // NOVO
   ): Promise<ClipSuggestion[]> {
     // ...
     const completion = await client.chat.completions.parse({
       model,  // ANTES: config.openaiModel
       // ...
     });
   }
   ```

3. **Controller** — Em `apps/server/src/controllers/suggestionsController.ts`:
   - Extrair `model` do body: `const { jobId, rangeStartMs, rangeEndMs, categories, model } = req.body as SuggestClipsRequest`
   - Passar para `suggestClips({ ..., model })`

4. **Frontend** — Em `apps/web/src/components/editor/ClipSuggestions.tsx`:
   - Adicionar state: `const [model, setModel] = useState<'gpt-4o-mini' | 'gpt-4o'>('gpt-4o-mini')`
   - Renderizar toggle entre os botoes "Gerar Sugestoes" e os filtros de categoria:
   ```tsx
   <div className="flex items-center gap-3 text-xs">
     <span className="text-gray-400">Modelo:</span>
     <button
       onClick={() => setModel('gpt-4o-mini')}
       className={`px-2 py-1 rounded text-xs ${model === 'gpt-4o-mini' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'}`}
     >
       Rapido (4o-mini)
     </button>
     <button
       onClick={() => setModel('gpt-4o')}
       className={`px-2 py-1 rounded text-xs ${model === 'gpt-4o' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-400'}`}
     >
       Preciso (4o)
     </button>
   </div>
   ```
   - Em `handleGenerate`, passar `model` no request: `await api.suggestClips({ jobId, ..., model })`

### Testes necessarios

- **`apps/server/src/__tests__/llmService.test.ts`** — Testar que `suggestClips` passa o modelo recebido para a API OpenAI (mock). Testar fallback para `config.openaiModel` quando `model` nao fornecido.
- **`apps/server/src/__tests__/suggestionsController.test.ts`** — Testar que o campo `model` do body e extraido e repassado.
- **`apps/web/src/__tests__/ClipSuggestions.test.tsx`** — Testar que clicar no toggle muda o modelo. Testar que `api.suggestClips` e chamado com o modelo selecionado.

### Dependências

Nenhuma. Pode ser implementada de forma independente.

---

## 2. Preview do clip sugerido

### Descrição
O botao "Visualizar" de cada sugestao atualmente apenas faz `seek(startMs)`. A melhoria e fazer o player reproduzir do `startMs` ao `endMs` e parar automaticamente (preview com loop ou stop), reutilizando a logica de loop que ja existe no `EditorPanel`.

### Arquivos a modificar

| Arquivo | O que mudar |
|---------|-------------|
| `apps/web/src/components/editor/EditorPanel.tsx` | Gerenciar estado de preview (previewRange) e passar para efeito de loop |
| `apps/web/src/components/editor/ClipSuggestions.tsx` | Chamar novo callback `onPreview(startMs, endMs)` ao inves de `onSeek(startMs)` |
| `apps/web/src/hooks/useYouTubePlayer.ts` | Expor `togglePlay` (ja exporta) e `playVideo` |

### Tipos novos

Nenhum tipo novo no pacote `types`. Apenas estado local no componente.

### Mudanças de API

Nenhuma mudanca de API no backend. Apenas frontend.

### Passos de implementação

1. **Hook do player** — Em `apps/web/src/hooks/useYouTubePlayer.ts`:
   - O hook ja exporta `togglePlay`. Adicionar funcao `play` que chama `playerRef.current?.playVideo()`:
   ```typescript
   const play = useCallback(() => {
     playerRef.current?.playVideo();
   }, []);

   return { containerRef, currentTimeMs, durationMs, isPlaying, ready, seek, togglePlay, play };
   ```

2. **EditorPanel** — Em `apps/web/src/components/editor/EditorPanel.tsx`:
   - Adicionar estado de preview:
   ```typescript
   const [previewRange, setPreviewRange] = useState<{ startMs: number; endMs: number } | null>(null);
   ```
   - Modificar o useEffect do loop para considerar `previewRange`:
   ```typescript
   useEffect(() => {
     if (!isPlaying) return;
     const effectiveEnd = previewRange ? previewRange.endMs : endMs;
     const effectiveStart = previewRange ? previewRange.startMs : startMs;

     if (effectiveEnd < durationMs && currentTimeMs >= effectiveEnd) {
       if (previewRange) {
         // Preview: parar no final em vez de loopar
         togglePlay();  // pausa
         setPreviewRange(null);
       } else {
         seek(effectiveStart);
       }
     }
   }, [currentTimeMs, endMs, startMs, durationMs, isPlaying, seek, previewRange, togglePlay]);
   ```
   - Criar handler `handlePreview`:
   ```typescript
   const handlePreview = (start: number, end: number) => {
     setPreviewRange({ startMs: start, endMs: end });
     seek(start);
     play();
   };
   ```
   - Passar `onPreview={handlePreview}` para `<ClipSuggestions>`.

3. **ClipSuggestions** — Em `apps/web/src/components/editor/ClipSuggestions.tsx`:
   - Adicionar prop `onPreview: (startMs: number, endMs: number) => void` na interface.
   - No botao "Visualizar", trocar `onSeek(s.startMs)` por `onPreview(s.startMs, s.endMs)`.
   ```tsx
   <button
     onClick={(e) => { e.stopPropagation(); onPreview(s.startMs, s.endMs); }}
     className="px-2 py-1 text-xs bg-gray-600 hover:bg-gray-500 text-gray-200 rounded transition-colors"
   >
     ▶ Visualizar
   </button>
   ```

4. **Feedback visual** — Opcionalmente, mostrar indicador de "Preview em andamento" no `ClipSuggestions` ou no player, usando o estado `previewRange !== null`.

### Testes necessarios

- **`apps/web/src/__tests__/EditorPanel.test.tsx`** — Testar que `handlePreview` seta o `previewRange`, faz `seek` e `play`. Testar que ao atingir `endMs` durante preview, o player pausa e limpa o `previewRange`.
- **`apps/web/src/__tests__/ClipSuggestions.test.tsx`** — Testar que o botao "Visualizar" chama `onPreview(startMs, endMs)`.

### Dependências

Nenhuma. Pode ser implementada de forma independente.

---

## 3. Regenerar por faixa de tempo

### Descrição
Permitir regenerar sugestoes apenas para um intervalo especifico sem refazer tudo. O backend ja aceita `rangeStartMs`/`rangeEndMs`. O que falta e uma UI no frontend que permita "regenerar este trecho" para uma faixa especifica, fazendo merge das novas sugestoes com as existentes (substituindo somente as que caem dentro do range).

### Arquivos a modificar

| Arquivo | O que mudar |
|---------|-------------|
| `packages/types/src/index.ts` | Adicionar campo `mergeMode` em `SuggestClipsRequest` |
| `apps/server/src/controllers/suggestionsController.ts` | Implementar logica de merge (remover sugestoes do range antigo, adicionar novas) |
| `apps/web/src/components/editor/ClipSuggestions.tsx` | Adicionar botao "Regenerar trecho" e inputs de range |

### Tipos novos

```typescript
// packages/types/src/index.ts
export interface SuggestClipsRequest {
  jobId: string;
  rangeStartMs?: number;
  rangeEndMs?: number;
  categories?: ClipCategory[];
  model?: SuggestionModel;
  mergeMode?: 'replace_all' | 'merge_range';  // NOVO
}
```

### Mudanças de API

- **POST `/suggestions`** — novo campo opcional `mergeMode`:
  - `'replace_all'` (default): substitui todas as sugestoes do job
  - `'merge_range'`: remove sugestoes existentes que caem dentro de `[rangeStartMs, rangeEndMs]` e adiciona as novas

### Passos de implementação

1. **Tipos** — Adicionar `mergeMode?: 'replace_all' | 'merge_range'` em `SuggestClipsRequest`.

2. **Controller** — Em `apps/server/src/controllers/suggestionsController.ts`:
   ```typescript
   const { jobId, rangeStartMs, rangeEndMs, categories, model, mergeMode } = req.body as SuggestClipsRequest;

   const newSuggestions = await suggestClips({ segments: job.transcript, rangeStartMs, rangeEndMs, categories, model });

   let finalSuggestions: ClipSuggestion[];
   if (mergeMode === 'merge_range' && rangeStartMs != null && rangeEndMs != null) {
     // Manter sugestoes fora do range, substituir as de dentro
     const existing = job.suggestions ?? [];
     const outsideRange = existing.filter(s => s.endMs <= rangeStartMs || s.startMs >= rangeEndMs);
     finalSuggestions = [...outsideRange, ...newSuggestions]
       .sort((a, b) => a.startMs - b.startMs);
   } else {
     finalSuggestions = newSuggestions;
   }

   await updateJob(jobId, { suggestions: finalSuggestions });
   res.json({ suggestions: finalSuggestions });
   ```

3. **Frontend** — Em `apps/web/src/components/editor/ClipSuggestions.tsx`:
   - Adicionar estado `regenerateRange`:
   ```typescript
   const [regenerateMode, setRegenerateMode] = useState(false);
   const [regenStartMs, setRegenStartMs] = useState(0);
   const [regenEndMs, setRegenEndMs] = useState(0);
   ```
   - Quando `suggestions.length > 0`, mostrar botao "Regenerar trecho" que abre inputs de tempo (minuto:segundo) para definir o range.
   - O botao de gerar nesse modo chama:
   ```typescript
   await api.suggestClips({
     jobId,
     rangeStartMs: regenStartMs,
     rangeEndMs: regenEndMs,
     categories: selectedCategories.length > 0 ? selectedCategories : undefined,
     model,
     mergeMode: 'merge_range',
   });
   ```
   - Alternativamente, pre-preencher `regenStartMs`/`regenEndMs` com o `startMs`/`endMs` da selecao atual na timeline.

### Testes necessarios

- **`apps/server/src/__tests__/suggestionsController.test.ts`** — Testar merge: sugestoes existentes fora do range sao mantidas, sugestoes dentro do range sao substituidas.
- **`apps/web/src/__tests__/ClipSuggestions.test.tsx`** — Testar que o botao "Regenerar trecho" envia `mergeMode: 'merge_range'` e os ranges corretos.

### Dependências

- Depende da melhoria **1** (Opção de modelo) se quiser incluir o campo `model` no request de regeneracao. Pode ser implementada sem, usando o modelo default.

---

## 4. Exportar em lote

### Descrição
Botao "Exportar selecionados" que corta multiplas sugestoes de uma vez. O usuario seleciona sugestoes (checkbox), clica em exportar, e cada clip e cortado sequencialmente usando o fluxo `cut/prepare` + `cut/finalize` existente. Progresso agregado exibido no UI.

### Arquivos a modificar/criar

| Arquivo | O que mudar |
|---------|-------------|
| `packages/types/src/index.ts` | Adicionar `BatchExportRequest`, `BatchExportProgress` |
| `apps/server/src/controllers/cutController.ts` | Nova funcao `handleBatchExport` |
| `apps/server/src/routes/cut.ts` | Nova rota `POST /cut/batch` |
| `apps/web/src/components/editor/ClipSuggestions.tsx` | Checkboxes de selecao + botao "Exportar selecionados" |
| `apps/web/src/components/editor/EditorPanel.tsx` | Handler de export em lote + estado de progresso |
| `apps/web/src/services/api/cutApi.ts` | Nova funcao `batchExport` |

### Tipos novos

```typescript
// packages/types/src/index.ts
export interface BatchExportRequest {
  jobId: string;
  clips: Array<{
    startMs: number;
    endMs: number;
    title?: string;
  }>;
  source: 'youtube' | 'local';
  youtubeUrl?: string;
  videoPath?: string;
}

export interface BatchExportProgress {
  total: number;
  completed: number;
  current: number;
  currentLabel: string;
  error?: string;
}
```

### Mudanças de API

- **POST `/cut/batch`** — Recebe `BatchExportRequest`, processa cada clip sequencialmente, retorna SSE com progresso.
- **GET `/cut/batch/progress/:jobId`** — SSE de progresso do batch (ou reutilizar a rota existente `/cut/progress/:jobId`).

### Passos de implementação

1. **Tipos** — Adicionar `BatchExportRequest` e `BatchExportProgress` em `packages/types/src/index.ts`.

2. **Backend — Controller** — Em `apps/server/src/controllers/cutController.ts`, adicionar `handleBatchExport`:
   ```typescript
   export async function handleBatchExport(req: Request, res: Response): Promise<void> {
     const { jobId, clips, source, youtubeUrl, videoPath } = req.body as BatchExportRequest;

     if (!jobId || !clips || clips.length === 0) {
       res.status(400).json({ error: 'jobId e clips sao obrigatorios' });
       return;
     }

     // SSE headers
     res.setHeader('Content-Type', 'text/event-stream');
     res.setHeader('Cache-Control', 'no-cache');
     res.setHeader('Connection', 'keep-alive');

     const results: CutResponse[] = [];

     for (let i = 0; i < clips.length; i++) {
       const clip = clips[i];
       const label = clip.title ?? `${formatMsToTime(clip.startMs)} → ${formatMsToTime(clip.endMs)}`;

       res.write(`data: ${JSON.stringify({
         total: clips.length, completed: i, current: i + 1, currentLabel: label,
       })}\n\n`);

       try {
         // Reutilizar logica de prepare + finalize para cada clip
         const outputDir = getJobDir(jobId);
         const outputName = `clip_${formatMsToFilename(clip.startMs)}-${formatMsToFilename(clip.endMs)}.mp4`;

         let result: { outputPath: string };
         if (source === 'youtube' && youtubeUrl) {
           result = await cutYoutubeVideo({ youtubeUrl, startMs: clip.startMs, endMs: clip.endMs, outputDir, outputName });
         } else if (videoPath) {
           result = await cutVideo({ videoPath, outputDir, startMs: clip.startMs, endMs: clip.endMs, outputName });
         } else {
           throw new Error('Source invalido');
         }

         // Adicionar cut entry no job
         const fileSize = fs.existsSync(result.outputPath) ? fs.statSync(result.outputPath).size : undefined;
         await updateJob(jobId, {
           newCutEntry: {
             label,
             startMs: clip.startMs,
             endMs: clip.endMs,
             audioOffsetMs: 0,
             output: { filePath: result.outputPath, durationMs: clip.endMs - clip.startMs, fileSize },
           },
         });

         results.push({ outputPath: result.outputPath, durationMs: clip.endMs - clip.startMs });
       } catch (err) {
         res.write(`data: ${JSON.stringify({
           total: clips.length, completed: i, current: i + 1, currentLabel: label,
           error: String(err),
         })}\n\n`);
       }
     }

     res.write(`data: ${JSON.stringify({ total: clips.length, completed: clips.length, current: clips.length, currentLabel: 'Concluido', done: true })}\n\n`);
     res.end();
   }
   ```

3. **Backend — Rota** — Em `apps/server/src/routes/cut.ts`:
   ```typescript
   cutRouter.post('/batch', handleBatchExport);
   ```

4. **Frontend — API** — Em `apps/web/src/services/api/cutApi.ts`, adicionar:
   ```typescript
   batchExport: async (
     req: BatchExportRequest,
     onProgress: (progress: BatchExportProgress) => void,
   ): Promise<void> => {
     const response = await fetch(`${BASE}/cut/batch`, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify(req),
     });

     const reader = response.body!.getReader();
     const decoder = new TextDecoder();
     let buffer = '';

     while (true) {
       const { done, value } = await reader.read();
       if (done) break;
       buffer += decoder.decode(value, { stream: true });

       const lines = buffer.split('\n');
       buffer = lines.pop() ?? '';

       for (const line of lines) {
         if (line.startsWith('data: ')) {
           onProgress(JSON.parse(line.slice(6)));
         }
       }
     }
   },
   ```

5. **Frontend — ClipSuggestions** — Adicionar checkboxes:
   ```typescript
   const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

   const toggleSelection = (idx: number) => {
     setSelectedIndices(prev => {
       const next = new Set(prev);
       next.has(idx) ? next.delete(idx) : next.add(idx);
       return next;
     });
   };
   ```
   - Renderizar checkbox em cada card de sugestao.
   - Botao "Exportar selecionados (N)" que chama `onBatchExport(selectedSuggestions)`.
   - Nova prop: `onBatchExport: (clips: ClipSuggestion[]) => void`.

6. **Frontend — EditorPanel** — Handler:
   ```typescript
   const handleBatchExport = async (clips: ClipSuggestion[]) => {
     setCutState('preparing');
     setPreparingLabel(`Exportando ${clips.length} clips...`);
     setActiveTab('cortes');

     await api.batchExport(
       {
         jobId: job.id,
         clips: clips.map(c => ({ startMs: c.startMs, endMs: c.endMs, title: c.title })),
         source: job.source.type,
         youtubeUrl: job.source.youtubeUrl,
         videoPath: localVideoPath ?? undefined,
       },
       (progress) => {
         setPreparingLabel(`Clip ${progress.current}/${progress.total}: ${progress.currentLabel}`);
       },
     );

     await refreshJob(job.id);
     setCutState('idle');
     setPreparingLabel(null);
   };
   ```

### Testes necessarios

- **`apps/server/src/__tests__/cutController.test.ts`** — Testar `handleBatchExport`: processa N clips, retorna SSE com progresso, cria cut entries.
- **`apps/web/src/__tests__/ClipSuggestions.test.tsx`** — Testar selecao/deselecao de clips, botao desabilitado quando nenhum selecionado.
- **`apps/web/src/__tests__/EditorPanel.test.tsx`** — Testar fluxo de batch export com mock da API.

### Dependências

- Depende da melhoria **8** (Indicador de progresso) para ter feedback visual completo, mas pode funcionar com o `preparingLabel` basico sem ela.

---

## 5. Keyboard shortcuts

### Descrição
Atalhos de teclado globais no editor: `I` = marcar inicio, `O` = marcar fim, `Space` = play/pause, `[`/`]` = pular entre segmentos da transcricao, `J`/`K`/`L` = rewind/pause/forward.

### Arquivos a modificar/criar

| Arquivo | O que mudar |
|---------|-------------|
| `apps/web/src/hooks/useKeyboardShortcuts.ts` | **CRIAR** — hook dedicado para atalhos |
| `apps/web/src/components/editor/EditorPanel.tsx` | Usar o hook, passar callbacks |

### Tipos novos

Nenhum.

### Mudanças de API

Nenhuma. Apenas frontend.

### Passos de implementação

1. **Criar hook** — `apps/web/src/hooks/useKeyboardShortcuts.ts`:
   ```typescript
   import { useEffect } from 'react';

   interface KeyboardShortcutsParams {
     enabled: boolean;
     currentTimeMs: number;
     durationMs: number;
     segments: TranscriptSegment[];
     onSetStart: (ms: number) => void;
     onSetEnd: (ms: number) => void;
     onSeek: (ms: number) => void;
     onTogglePlay: () => void;
   }

   export function useKeyboardShortcuts(params: KeyboardShortcutsParams) {
     const { enabled, currentTimeMs, durationMs, segments, onSetStart, onSetEnd, onSeek, onTogglePlay } = params;

     useEffect(() => {
       if (!enabled) return;

       const handler = (e: KeyboardEvent) => {
         // Ignorar se estiver em input/textarea
         const target = e.target as HTMLElement;
         if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

         switch (e.key.toLowerCase()) {
           case 'i':
             e.preventDefault();
             onSetStart(currentTimeMs);
             break;
           case 'o':
             e.preventDefault();
             onSetEnd(currentTimeMs);
             break;
           case ' ':
             e.preventDefault();
             onTogglePlay();
             break;
           case '[': {
             e.preventDefault();
             // Pular para segmento anterior
             const prev = [...segments].reverse().find(s => s.startMs < currentTimeMs - 500);
             if (prev) onSeek(prev.startMs);
             break;
           }
           case ']': {
             e.preventDefault();
             // Pular para proximo segmento
             const next = segments.find(s => s.startMs > currentTimeMs + 500);
             if (next) onSeek(next.startMs);
             break;
           }
           case 'j':
             e.preventDefault();
             onSeek(Math.max(0, currentTimeMs - 5000)); // -5s
             break;
           case 'k':
             e.preventDefault();
             onTogglePlay();
             break;
           case 'l':
             e.preventDefault();
             onSeek(Math.min(durationMs, currentTimeMs + 5000)); // +5s
             break;
         }
       };

       window.addEventListener('keydown', handler);
       return () => window.removeEventListener('keydown', handler);
     }, [enabled, currentTimeMs, durationMs, segments, onSetStart, onSetEnd, onSeek, onTogglePlay]);
   }
   ```

2. **EditorPanel** — Em `apps/web/src/components/editor/EditorPanel.tsx`:
   - Importar `useKeyboardShortcuts`.
   - Obter `togglePlay` do `useYouTubePlayer` (ja retorna).
   - Chamar o hook:
   ```typescript
   const { containerRef, currentTimeMs, durationMs, isPlaying, ready, seek, togglePlay } =
     useYouTubePlayer(videoId);

   useKeyboardShortcuts({
     enabled: ready && activeTab === 'recortar',
     currentTimeMs,
     durationMs,
     segments,
     onSetStart: setStartMs,
     onSetEnd: setEndMs,
     onSeek: seek,
     onTogglePlay: togglePlay,
   });
   ```

3. **Feedback visual** — Opcionalmente, mostrar tooltip ou legenda com atalhos disponiveis abaixo da timeline ou no CutPanel:
   ```tsx
   <div className="text-xs text-gray-500 flex gap-3">
     <span><kbd>I</kbd> Inicio</span>
     <span><kbd>O</kbd> Fim</span>
     <span><kbd>Space</kbd> Play</span>
     <span><kbd>J/L</kbd> -5s/+5s</span>
     <span><kbd>[/]</kbd> Segmentos</span>
   </div>
   ```

### Testes necessarios

- **`apps/web/src/__tests__/useKeyboardShortcuts.test.ts`** — Testar cada tecla: `I` chama `onSetStart`, `O` chama `onSetEnd`, `Space` chama `onTogglePlay`, `[`/`]` fazem seek para segmentos corretos, `J`/`L` fazem seek relativo. Testar que nao dispara quando `target` e input/textarea. Testar que nao dispara quando `enabled` e false.

### Dependências

Nenhuma. Pode ser implementada de forma independente.

---

## 6. Undo/Redo na seleção

### Descrição
Historico de ranges (startMs/endMs) com Ctrl+Z para desfazer e Ctrl+Shift+Z para refazer. Modificar `useCutHandles` para manter stack de estados.

### Arquivos a modificar

| Arquivo | O que mudar |
|---------|-------------|
| `apps/web/src/hooks/useCutHandles.ts` | Adicionar stacks de undo/redo, expor `undo`/`redo`/`canUndo`/`canRedo` |
| `apps/web/src/hooks/useKeyboardShortcuts.ts` | Adicionar handlers para Ctrl+Z e Ctrl+Shift+Z |
| `apps/web/src/components/editor/EditorPanel.tsx` | Passar `undo`/`redo` para o hook de atalhos |

### Tipos novos

Nenhum tipo no pacote compartilhado. Tipo interno no hook:

```typescript
interface RangeState {
  startMs: number;
  endMs: number;
}
```

### Mudanças de API

Nenhuma. Apenas frontend.

### Passos de implementação

1. **useCutHandles** — Em `apps/web/src/hooks/useCutHandles.ts`:
   ```typescript
   import { useState, useCallback, useRef } from 'react';

   interface RangeState { startMs: number; endMs: number; }
   const MAX_HISTORY = 50;

   export function useCutHandles(durationMs: number) {
     const [startMs, setStartMs] = useState(0);
     const [endMs, setEndMs] = useState(durationMs);

     const undoStack = useRef<RangeState[]>([]);
     const redoStack = useRef<RangeState[]>([]);

     // Salvar estado atual no undo stack antes de cada mudanca
     const pushUndo = useCallback(() => {
       undoStack.current.push({ startMs, endMs });
       if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift();
       redoStack.current = []; // Limpar redo ao fazer nova acao
     }, [startMs, endMs]);

     const clamp = (value: number, min: number, max: number) =>
       Math.max(min, Math.min(max, value));

     const setStart = useCallback((ms: number) => {
       pushUndo();
       setStartMs(clamp(ms, 0, endMs - 1));
     }, [endMs, pushUndo]);

     const setEnd = useCallback((ms: number) => {
       pushUndo();
       setEndMs(clamp(ms, startMs + 1, durationMs));
     }, [startMs, durationMs, pushUndo]);

     const setRange = useCallback((start: number, end: number) => {
       pushUndo();
       const s = clamp(start, 0, durationMs - 1);
       const e = clamp(end, s + 1, durationMs);
       setStartMs(s);
       setEndMs(e);
     }, [durationMs, pushUndo]);

     const undo = useCallback(() => {
       if (undoStack.current.length === 0) return;
       redoStack.current.push({ startMs, endMs });
       const prev = undoStack.current.pop()!;
       setStartMs(prev.startMs);
       setEndMs(prev.endMs);
     }, [startMs, endMs]);

     const redo = useCallback(() => {
       if (redoStack.current.length === 0) return;
       undoStack.current.push({ startMs, endMs });
       const next = redoStack.current.pop()!;
       setStartMs(next.startMs);
       setEndMs(next.endMs);
     }, [startMs, endMs]);

     const canUndo = undoStack.current.length > 0;
     const canRedo = redoStack.current.length > 0;

     const reset = useCallback(() => {
       undoStack.current = [];
       redoStack.current = [];
       setStartMs(0);
       setEndMs(durationMs);
     }, [durationMs]);

     return {
       startMs, endMs,
       setStartMs: setStart, setEndMs: setEnd, setRange,
       pixelToTime: useCallback(/* ... manter existente */),
       reset, undo, redo, canUndo, canRedo,
     };
   }
   ```

2. **useKeyboardShortcuts** — Adicionar handlers:
   ```typescript
   // Dentro do switch/case do handler
   if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
     e.preventDefault();
     onUndo?.();
     return;
   }
   if (e.ctrlKey && e.shiftKey && e.key === 'Z') {
     e.preventDefault();
     onRedo?.();
     return;
   }
   ```
   - Adicionar `onUndo?: () => void` e `onRedo?: () => void` na interface de params.

3. **EditorPanel** — Passar `undo`/`redo`:
   ```typescript
   const { startMs, endMs, setStartMs, setEndMs, setRange, reset, undo, redo, canUndo, canRedo } =
     useCutHandles(durationMs);

   useKeyboardShortcuts({
     // ... existente
     onUndo: undo,
     onRedo: redo,
   });
   ```

### Testes necessarios

- **`apps/web/src/__tests__/useCutHandles.test.ts`** — Testar: setStart empurra estado anterior para undoStack; undo restaura; redo refaz; undo em stack vazio nao quebra; redo limpa ao fazer nova acao; reset limpa stacks.
- **`apps/web/src/__tests__/useKeyboardShortcuts.test.ts`** — Testar Ctrl+Z chama `onUndo`, Ctrl+Shift+Z chama `onRedo`.

### Dependências

- Depende da melhoria **5** (Keyboard shortcuts) para a integracao de Ctrl+Z/Ctrl+Shift+Z. Pode ser implementada sem o hook de atalhos, mas o undo/redo so via teclado faz mais sentido com o hook.

---

## 7. Timeline visual das sugestões

### Descrição
Renderizar faixas coloridas (por categoria) na Timeline para cada sugestao. As faixas sao clicaveis e ao clicar selecionam o range correspondente.

### Arquivos a modificar/criar

| Arquivo | O que mudar |
|---------|-------------|
| `apps/web/src/components/timeline/Timeline.tsx` | Aceitar prop `suggestions`, renderizar faixas |
| `apps/web/src/components/timeline/SuggestionBars.tsx` | **CRIAR** — componente que renderiza as barras coloridas |
| `apps/web/src/components/editor/EditorPanel.tsx` | Passar `suggestions` para `<Timeline>` |

### Tipos novos

Nenhum.

### Mudanças de API

Nenhuma. Apenas frontend.

### Passos de implementação

1. **Criar SuggestionBars** — `apps/web/src/components/timeline/SuggestionBars.tsx`:
   ```typescript
   import type { ClipSuggestion, ClipCategory } from '../../types';

   interface SuggestionBarsProps {
     suggestions: ClipSuggestion[];
     durationMs: number;
     onSelectRange: (startMs: number, endMs: number) => void;
   }

   // Cores de fundo por categoria (opacidade baixa para nao poluir a timeline)
   const BAR_COLORS: Record<ClipCategory, string> = {
     exortacao: 'bg-red-500/30 hover:bg-red-500/50',
     encorajamento: 'bg-green-500/30 hover:bg-green-500/50',
     ensino: 'bg-blue-500/30 hover:bg-blue-500/50',
     testemunho: 'bg-yellow-500/30 hover:bg-yellow-500/50',
     adoracao: 'bg-purple-500/30 hover:bg-purple-500/50',
     reflexao: 'bg-gray-400/30 hover:bg-gray-400/50',
     chamado: 'bg-orange-500/30 hover:bg-orange-500/50',
     humor: 'bg-pink-500/30 hover:bg-pink-500/50',
     ilustracao: 'bg-teal-500/30 hover:bg-teal-500/50',
   };

   export function SuggestionBars({ suggestions, durationMs, onSelectRange }: SuggestionBarsProps) {
     if (durationMs === 0) return null;

     return (
       <>
         {suggestions.map((s, i) => {
           const left = (s.startMs / durationMs) * 100;
           const width = ((s.endMs - s.startMs) / durationMs) * 100;
           return (
             <div
               key={i}
               className={`absolute bottom-0 h-2 rounded-sm cursor-pointer transition-colors ${BAR_COLORS[s.category]}`}
               style={{ left: `${left}%`, width: `${width}%` }}
               title={`${s.title} (${s.category})`}
               onClick={(e) => {
                 e.stopPropagation();
                 onSelectRange(s.startMs, s.endMs);
               }}
             />
           );
         })}
       </>
     );
   }
   ```

2. **Timeline** — Em `apps/web/src/components/timeline/Timeline.tsx`:
   - Adicionar props:
   ```typescript
   interface TimelineProps {
     // ... existente
     suggestions?: ClipSuggestion[];
     onSetRange?: (startMs: number, endMs: number) => void;
   }
   ```
   - Importar e renderizar `<SuggestionBars>` dentro do container, antes do `<Playhead>`:
   ```tsx
   {suggestions && suggestions.length > 0 && onSetRange && (
     <SuggestionBars
       suggestions={suggestions}
       durationMs={durationMs}
       onSelectRange={onSetRange}
     />
   )}
   ```

3. **EditorPanel** — Passar dados:
   ```tsx
   <Timeline
     segments={segments}
     durationMs={durationMs}
     currentTimeMs={currentTimeMs}
     startMs={startMs}
     endMs={endMs}
     onSeek={seek}
     onStartChange={setStartMs}
     onEndChange={setEndMs}
     suggestions={job.suggestions}
     onSetRange={setRange}
   />
   ```

4. **Legenda (opcional)** — Adicionar mini-legenda abaixo da timeline mostrando cores por categoria (apenas quando ha sugestoes).

### Testes necessarios

- **`apps/web/src/__tests__/SuggestionBars.test.tsx`** — Testar que renderiza uma barra por sugestao, com posicao/largura corretas. Testar que click chama `onSelectRange` com os ms corretos.
- **`apps/web/src/__tests__/Timeline.test.tsx`** — Testar que `<SuggestionBars>` e renderizado quando `suggestions` e passado.

### Dependências

Nenhuma. Pode ser implementada de forma independente.

---

## 8. Indicador de progresso no export

### Descrição
Integrar o SSE de `/cut/progress/:jobId` no fluxo de export do EditorPanel, mostrando barra de progresso real em vez de apenas spinner.

### Arquivos a modificar

| Arquivo | O que mudar |
|---------|-------------|
| `apps/web/src/components/editor/EditorPanel.tsx` | Consumir SSE de progresso durante prepare/finalize |
| `apps/web/src/services/api/cutApi.ts` | Adicionar funcao `subscribeProgress` para consumir SSE |
| `apps/server/src/controllers/cutController.ts` | Melhorar `handleProgress` para ser SSE real (polling continuo, nao snapshot unico) |
| `apps/server/src/services/progressStore.ts` | Adicionar suporte a listeners para notificacao em tempo real |

### Tipos novos

```typescript
// packages/types/src/index.ts
export interface CutProgress {
  progress: number;    // 0-100
  done: boolean;
  error?: string;
  outputPath?: string;
  stage?: 'downloading' | 'cutting' | 'merging' | 'finalizing';
}
```

### Mudanças de API

- **GET `/cut/progress/:jobId`** — Mudar de snapshot unico para SSE real que envia eventos conforme o progresso muda. Manter conexao aberta e enviar `data:` a cada update.

### Passos de implementação

1. **progressStore** — Em `apps/server/src/services/progressStore.ts`:
   ```typescript
   type ProgressListener = (data: ProgressEntry) => void;
   const listeners = new Map<string, Set<ProgressListener>>();

   export function setProgress(jobId: string, data: ProgressEntry): void {
     jobs.set(jobId, data);
     // Notificar listeners
     const jobListeners = listeners.get(jobId);
     if (jobListeners) {
       for (const fn of jobListeners) fn(data);
     }
   }

   export function onProgress(jobId: string, listener: ProgressListener): () => void {
     if (!listeners.has(jobId)) listeners.set(jobId, new Set());
     listeners.get(jobId)!.add(listener);
     return () => {
       listeners.get(jobId)?.delete(listener);
       if (listeners.get(jobId)?.size === 0) listeners.delete(jobId);
     };
   }
   ```

2. **cutController** — Em `handleProgress`:
   ```typescript
   export function handleProgress(req: Request, res: Response): void {
     const { jobId } = req.params;

     res.setHeader('Content-Type', 'text/event-stream');
     res.setHeader('Cache-Control', 'no-cache');
     res.setHeader('Connection', 'keep-alive');

     // Enviar estado atual
     const current = getProgress(jobId);
     if (current) {
       res.write(`data: ${JSON.stringify(current)}\n\n`);
       if (current.done) { res.end(); return; }
     }

     // Escutar mudancas
     const unsubscribe = onProgress(jobId, (data) => {
       res.write(`data: ${JSON.stringify(data)}\n\n`);
       if (data.done) { unsubscribe(); res.end(); }
     });

     req.on('close', () => unsubscribe());
   }
   ```

3. **Frontend — API** — Em `apps/web/src/services/api/cutApi.ts`:
   ```typescript
   subscribeProgress: (jobId: string, onUpdate: (progress: CutProgress) => void): (() => void) => {
     const controller = new AbortController();
     const url = `${BASE}/cut/progress/${jobId}`;

     fetch(url, { signal: controller.signal }).then(async (response) => {
       const reader = response.body!.getReader();
       const decoder = new TextDecoder();
       let buffer = '';

       while (true) {
         const { done, value } = await reader.read();
         if (done) break;
         buffer += decoder.decode(value, { stream: true });

         const lines = buffer.split('\n');
         buffer = lines.pop() ?? '';

         for (const line of lines) {
           if (line.startsWith('data: ')) {
             try { onUpdate(JSON.parse(line.slice(6))); } catch {}
           }
         }
       }
     }).catch(() => {});

     return () => controller.abort();
   },
   ```

4. **EditorPanel** — Adicionar estado de progresso e conectar ao SSE:
   ```typescript
   const [exportProgress, setExportProgress] = useState<number | null>(null);

   // Dentro de handleCut, apos iniciar prepare:
   const unsubscribe = api.subscribeProgress(job.id, (progress) => {
     setExportProgress(progress.progress);
   });
   // ... ao final: unsubscribe(); setExportProgress(null);
   ```
   - Renderizar barra de progresso no indicador "Preparando corte...":
   ```tsx
   {cutState === 'preparing' && (
     <div className="...">
       {/* ... spinner existente ... */}
       {exportProgress !== null && (
         <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
           <div
             className="bg-blue-500 h-2 rounded-full transition-all"
             style={{ width: `${exportProgress}%` }}
           />
         </div>
       )}
     </div>
   )}
   ```

### Testes necessarios

- **`apps/server/src/__tests__/progressStore.test.ts`** — Testar `onProgress` listener: recebe atualizacoes, unsubscribe para de receber.
- **`apps/server/src/__tests__/cutController.test.ts`** — Testar que `handleProgress` envia SSE com progresso e fecha quando `done: true`.
- **`apps/web/src/__tests__/EditorPanel.test.tsx`** — Testar que barra de progresso aparece durante export e desaparece ao finalizar.

### Dependências

Nenhuma. Pode ser implementada de forma independente.

---

## 9. Cache de sugestões por hash

### Descrição
Criar hash de (transcricao + range + categorias + model) para evitar chamadas repetidas a API OpenAI. Salvar cache em disco junto ao job.

### Arquivos a modificar/criar

| Arquivo | O que mudar |
|---------|-------------|
| `apps/server/src/services/suggestionsCache.ts` | **CRIAR** — servico de cache baseado em hash |
| `apps/server/src/controllers/suggestionsController.ts` | Verificar cache antes de chamar LLM, salvar no cache apos |
| `apps/server/src/services/jobStore.ts` | (opcional) Adicionar campo `suggestionsCache` no metadata |

### Tipos novos

```typescript
// Interno ao servidor (nao precisa ir no pacote types)
interface SuggestionsCacheEntry {
  hash: string;
  suggestions: ClipSuggestion[];
  model: string;
  createdAt: string;
}
```

### Mudanças de API

Nenhuma mudanca de API publica. O cache e transparente ao frontend.

### Passos de implementação

1. **Criar servico de cache** — `apps/server/src/services/suggestionsCache.ts`:
   ```typescript
   import crypto from 'crypto';
   import fs from 'fs';
   import path from 'path';
   import type { ClipSuggestion, ClipCategory, TranscriptSegment } from '@video-cutter/types';
   import { getJobDir } from './jobStore';

   interface CacheParams {
     transcriptHash: string;
     rangeStartMs?: number;
     rangeEndMs?: number;
     categories?: ClipCategory[];
     model: string;
   }

   export function computeHash(
     segments: TranscriptSegment[],
     rangeStartMs?: number,
     rangeEndMs?: number,
     categories?: ClipCategory[],
     model?: string,
   ): string {
     const payload = JSON.stringify({
       segments: segments.map(s => `${s.startMs}-${s.endMs}-${s.text}`),
       rangeStartMs,
       rangeEndMs,
       categories: categories?.sort(),
       model,
     });
     return crypto.createHash('sha256').update(payload).digest('hex').slice(0, 16);
   }

   export function getCached(jobId: string, hash: string): ClipSuggestion[] | null {
     const cacheFile = path.join(getJobDir(jobId), 'suggestions_cache.json');
     if (!fs.existsSync(cacheFile)) return null;

     try {
       const data = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
       if (Array.isArray(data)) {
         const entry = data.find((e: any) => e.hash === hash);
         return entry ? entry.suggestions : null;
       }
     } catch {}
     return null;
   }

   export function setCache(jobId: string, hash: string, suggestions: ClipSuggestion[], model: string): void {
     const cacheFile = path.join(getJobDir(jobId), 'suggestions_cache.json');
     let entries: any[] = [];

     if (fs.existsSync(cacheFile)) {
       try { entries = JSON.parse(fs.readFileSync(cacheFile, 'utf-8')); } catch {}
     }

     // Remover entrada antiga com mesmo hash
     entries = entries.filter((e: any) => e.hash !== hash);
     entries.push({ hash, suggestions, model, createdAt: new Date().toISOString() });

     // Manter no maximo 10 entradas
     if (entries.length > 10) entries = entries.slice(-10);

     fs.writeFileSync(cacheFile, JSON.stringify(entries, null, 2));
   }
   ```

2. **Controller** — Em `apps/server/src/controllers/suggestionsController.ts`:
   ```typescript
   import { computeHash, getCached, setCache } from '../services/suggestionsCache';

   // Antes de chamar suggestClips:
   const hash = computeHash(job.transcript, rangeStartMs, rangeEndMs, categories, model);
   const cached = getCached(jobId, hash);

   if (cached) {
     // Aplicar merge se necessario
     const finalSuggestions = mergeMode === 'merge_range' ? /* merge logic */ : cached;
     await updateJob(jobId, { suggestions: finalSuggestions });
     res.json({ suggestions: finalSuggestions, cached: true });
     return;
   }

   // ... chamar suggestClips normalmente ...

   // Apos obter resultado:
   setCache(jobId, hash, newSuggestions, model ?? config.openaiModel);
   ```

### Testes necessarios

- **`apps/server/src/__tests__/suggestionsCache.test.ts`** — Testar `computeHash` retorna mesmo hash para mesmos inputs. Testar `getCached`/`setCache` gravam e recuperam do disco. Testar que entradas antigas sao descartadas (limite de 10).
- **`apps/server/src/__tests__/suggestionsController.test.ts`** — Testar que cache hit nao chama `suggestClips`. Testar que cache miss chama `suggestClips` e salva no cache.

### Dependências

- Se implementada junto com a melhoria **1** (modelo), o hash deve incluir o campo `model`.
- Se implementada junto com a melhoria **3** (merge range), a logica de merge deve funcionar com resultados cacheados.

---

## 10. Streaming de sugestões (SSE)

### Descrição
Em vez de esperar TODOS os chunks da LLM finalizarem, enviar sugestoes via SSE conforme cada chunk de transcricao retorna resultados. Nova rota `GET /suggestions/stream/:jobId`.

### Arquivos a modificar/criar

| Arquivo | O que mudar |
|---------|-------------|
| `apps/server/src/services/llmService.ts` | Criar variante `suggestClipsStream` que emite via callback |
| `apps/server/src/controllers/suggestionsController.ts` | Nova funcao `handleSuggestClipsStream` |
| `apps/server/src/routes/suggestions.ts` | Nova rota `POST /suggestions/stream` |
| `apps/web/src/services/api/suggestionsApi.ts` | Nova funcao `suggestClipsStream` que consome SSE |
| `apps/web/src/components/editor/ClipSuggestions.tsx` | Usar stream, exibir sugestoes conforme chegam |

### Tipos novos

```typescript
// packages/types/src/index.ts
export interface SuggestionStreamEvent {
  type: 'chunk_start' | 'suggestions' | 'done' | 'error';
  chunkIndex?: number;
  totalChunks?: number;
  suggestions?: ClipSuggestion[];
  error?: string;
}
```

### Mudanças de API

- **POST `/suggestions/stream`** — Mesmo body que `POST /suggestions`, mas retorna SSE em vez de JSON. Eventos:
  - `chunk_start`: indica inicio do processamento de um chunk
  - `suggestions`: sugestoes parciais de um chunk (ja validadas)
  - `done`: todas as sugestoes finais (deduplicadas)
  - `error`: erro no processamento

### Passos de implementação

1. **LLM Service** — Em `apps/server/src/services/llmService.ts`:
   ```typescript
   export async function suggestClipsStream(
     params: SuggestClipsParams,
     onChunkStart: (chunkIndex: number, totalChunks: number) => void,
     onChunkResult: (suggestions: ClipSuggestion[]) => void,
   ): Promise<ClipSuggestion[]> {
     const { segments, rangeStartMs, rangeEndMs, categories, model } = params;

     if (!config.openaiApiKey) throw new Error('OPENAI_API_KEY nao configurada');

     const filtered = filterSegments(segments, rangeStartMs, rangeEndMs);
     if (filtered.length === 0) throw new Error('Nenhum segmento no intervalo');

     const chunks = chunkSegments(filtered);
     const systemPrompt = buildSystemPrompt(categories);
     const client = new OpenAI({ apiKey: config.openaiApiKey });
     const modelToUse = model ?? config.openaiModel;
     const allRaw: ClipSuggestion[] = [];

     for (let i = 0; i < chunks.length; i++) {
       onChunkStart(i, chunks.length);
       const chunkResult = await suggestClipsForChunk(client, systemPrompt, chunks[i], i, chunks.length, modelToUse);
       const valid = validateAndClean(chunkResult, rangeStartMs, rangeEndMs);
       allRaw.push(...valid);
       onChunkResult(valid);
     }

     return deduplicateClips(allRaw);
   }
   ```

2. **Controller** — Em `apps/server/src/controllers/suggestionsController.ts`:
   ```typescript
   export async function handleSuggestClipsStream(req: Request, res: Response, next: NextFunction): Promise<void> {
     try {
       const { jobId, rangeStartMs, rangeEndMs, categories, model } = req.body as SuggestClipsRequest;

       // Validacoes (mesmo que handleSuggestClips)...

       res.setHeader('Content-Type', 'text/event-stream');
       res.setHeader('Cache-Control', 'no-cache');
       res.setHeader('Connection', 'keep-alive');

       const finalSuggestions = await suggestClipsStream(
         { segments: job.transcript, rangeStartMs, rangeEndMs, categories, model },
         (chunkIndex, totalChunks) => {
           res.write(`data: ${JSON.stringify({ type: 'chunk_start', chunkIndex, totalChunks })}\n\n`);
         },
         (suggestions) => {
           res.write(`data: ${JSON.stringify({ type: 'suggestions', suggestions })}\n\n`);
         },
       );

       await updateJob(jobId, { suggestions: finalSuggestions });
       res.write(`data: ${JSON.stringify({ type: 'done', suggestions: finalSuggestions })}\n\n`);
       res.end();
     } catch (err) {
       if (!res.headersSent) { next(err); return; }
       res.write(`data: ${JSON.stringify({ type: 'error', error: String(err) })}\n\n`);
       res.end();
     }
   }
   ```

3. **Rota** — Em `apps/server/src/routes/suggestions.ts`:
   ```typescript
   suggestionsRouter.post('/stream', handleSuggestClipsStream);
   ```

4. **Frontend — API** — Em `apps/web/src/services/api/suggestionsApi.ts`:
   ```typescript
   suggestClipsStream: async (
     data: SuggestClipsRequest,
     onEvent: (event: SuggestionStreamEvent) => void,
   ): Promise<void> => {
     const response = await fetch(`${BASE}/suggestions/stream`, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify(data),
     });

     const reader = response.body!.getReader();
     const decoder = new TextDecoder();
     let buffer = '';

     while (true) {
       const { done, value } = await reader.read();
       if (done) break;
       buffer += decoder.decode(value, { stream: true });

       const lines = buffer.split('\n');
       buffer = lines.pop() ?? '';

       for (const line of lines) {
         if (line.startsWith('data: ')) {
           try { onEvent(JSON.parse(line.slice(6))); } catch {}
         }
       }
     }
   },
   ```

5. **Frontend — ClipSuggestions** — Usar stream:
   ```typescript
   const [streamingSuggestions, setStreamingSuggestions] = useState<ClipSuggestion[]>([]);
   const [streamProgress, setStreamProgress] = useState<string | null>(null);

   const handleGenerateStream = async () => {
     setLoading(true);
     setError(null);
     setStreamingSuggestions([]);

     await api.suggestClipsStream(
       { jobId, rangeStartMs: useSelection ? startMs : undefined, rangeEndMs: useSelection ? endMs : undefined, categories, model },
       (event) => {
         if (event.type === 'chunk_start') {
           setStreamProgress(`Analisando trecho ${(event.chunkIndex ?? 0) + 1} de ${event.totalChunks}...`);
         } else if (event.type === 'suggestions' && event.suggestions) {
           setStreamingSuggestions(prev => [...prev, ...event.suggestions!]);
         } else if (event.type === 'done') {
           setStreamProgress(null);
           onSuggestionsGenerated();
         } else if (event.type === 'error') {
           setError(event.error ?? 'Erro desconhecido');
         }
       },
     );

     setLoading(false);
   };
   ```

### Testes necessarios

- **`apps/server/src/__tests__/llmService.test.ts`** — Testar `suggestClipsStream`: callbacks sao chamados na ordem correta.
- **`apps/server/src/__tests__/suggestionsController.test.ts`** — Testar que `handleSuggestClipsStream` envia eventos SSE corretos.
- **`apps/web/src/__tests__/ClipSuggestions.test.tsx`** — Testar que sugestoes aparecem incrementalmente durante stream.

### Dependências

- Depende da melhoria **1** (modelo) se quiser passar `model` no stream.
- Pode ser combinada com a melhoria **9** (cache) para cache hit evitar o streaming.

---

## 11. Transcrição via Whisper

### Descrição
Integrar a API OpenAI Whisper como alternativa as legendas do YouTube. Util para videos locais sem legenda ou quando as legendas automaticas do YouTube sao de baixa qualidade. Nova rota `POST /files/transcribe` que envia o audio para a API Whisper e retorna `TranscriptSegment[]`.

### Arquivos a modificar/criar

| Arquivo | O que mudar |
|---------|-------------|
| `apps/server/src/services/whisperService.ts` | **CRIAR** — servico de transcricao via Whisper |
| `apps/server/src/controllers/filesController.ts` | Nova funcao `handleTranscribe` |
| `apps/server/src/routes/files.ts` | Nova rota `POST /files/transcribe` |
| `apps/web/src/services/api/filesApi.ts` | Nova funcao `transcribe` |
| `apps/web/src/components/editor/EditorPanel.tsx` | Botao "Transcrever com IA" quando nao ha transcricao |
| `apps/web/src/components/jobs/NewJobForm.tsx` | (opcional) Opcao de transcrever ao criar job |
| `packages/types/src/index.ts` | Tipo `TranscribeRequest`, `TranscribeResponse` |

### Tipos novos

```typescript
// packages/types/src/index.ts
export interface TranscribeRequest {
  jobId: string;
  videoPath?: string;       // para videos locais
  youtubeUrl?: string;      // para videos do YouTube (extrair audio)
  language?: string;         // default: 'pt'
}

export interface TranscribeResponse {
  segments: TranscriptSegment[];
  language: string;
  duration: number;
}
```

### Mudanças de API

- **POST `/files/transcribe`** — Recebe `TranscribeRequest`, extrai audio do video, envia para Whisper API, retorna `TranscribeResponse`. Salva transcricao no job.

### Passos de implementação

1. **Criar whisperService** — `apps/server/src/services/whisperService.ts`:
   ```typescript
   import OpenAI from 'openai';
   import ffmpeg from 'fluent-ffmpeg';
   import fs from 'fs';
   import path from 'path';
   import os from 'os';
   import type { TranscriptSegment } from '@video-cutter/types';
   import { config } from '../config';

   // Extrair audio para MP3 (Whisper aceita max 25MB)
   async function extractAudio(videoPath: string): Promise<string> {
     const outputPath = path.join(os.tmpdir(), `whisper_${Date.now()}.mp3`);

     return new Promise((resolve, reject) => {
       ffmpeg(videoPath)
         .noVideo()
         .audioCodec('libmp3lame')
         .audioBitrate('64k')       // Baixo bitrate para reduzir tamanho
         .audioChannels(1)           // Mono
         .audioFrequency(16000)      // 16kHz (suficiente para fala)
         .output(outputPath)
         .on('end', () => resolve(outputPath))
         .on('error', (err) => reject(new Error(`Audio extraction failed: ${err.message}`)))
         .run();
     });
   }

   // Dividir audio longo em chunks de ~20min (limite Whisper: 25MB)
   // Para simplificar, confiamos no bitrate baixo (64kbps mono = ~5.7MB/15min)

   export async function transcribe(videoPath: string, language = 'pt'): Promise<TranscriptSegment[]> {
     if (!config.openaiApiKey) throw new Error('OPENAI_API_KEY nao configurada');

     const audioPath = await extractAudio(videoPath);

     try {
       const client = new OpenAI({ apiKey: config.openaiApiKey });

       const response = await client.audio.transcriptions.create({
         file: fs.createReadStream(audioPath),
         model: 'whisper-1',
         language,
         response_format: 'verbose_json',
         timestamp_granularities: ['segment'],
       });

       // Converter formato Whisper para TranscriptSegment[]
       const segments: TranscriptSegment[] = (response as any).segments.map(
         (seg: any, idx: number) => ({
           id: idx,
           startMs: Math.round(seg.start * 1000),
           endMs: Math.round(seg.end * 1000),
           text: seg.text.trim(),
         })
       );

       return segments;
     } finally {
       // Limpar arquivo temporario
       try { fs.unlinkSync(audioPath); } catch {}
     }
   }
   ```

2. **Controller** — Em `apps/server/src/controllers/filesController.ts`:
   ```typescript
   import { transcribe } from '../services/whisperService';
   import { getJob, updateJob, getJobDir } from '../services/jobStore';

   export async function handleTranscribe(req: Request, res: Response, next: NextFunction): Promise<void> {
     try {
       const { jobId, videoPath, youtubeUrl, language } = req.body;

       if (!jobId) throw new AppError('jobId obrigatorio', 400);

       const job = await getJob(jobId);

       let filePath: string;
       if (videoPath) {
         filePath = videoPath;
       } else if (youtubeUrl) {
         // Baixar video inteiro para transcricao (ou usar audio-only)
         // Reutilizar youtubeDownloadService para baixar audio
         throw new AppError('Transcricao de YouTube via Whisper ainda nao implementada', 501);
       } else {
         throw new AppError('videoPath ou youtubeUrl obrigatorio', 400);
       }

       const segments = await transcribe(filePath, language ?? 'pt');

       await updateJob(jobId, { transcript: segments } as any);

       res.json({ segments, language: language ?? 'pt', duration: segments.length > 0 ? segments[segments.length - 1].endMs : 0 });
     } catch (err) {
       next(err);
     }
   }
   ```

   **Nota:** Para adicionar `transcript` ao `UpdateJobRequest`, adicionar o campo:
   ```typescript
   // packages/types/src/index.ts — em UpdateJobRequest
   transcript?: TranscriptSegment[];
   ```

3. **Rota** — Em `apps/server/src/routes/files.ts`:
   ```typescript
   import { handleTranscribe } from '../controllers/filesController';
   filesRouter.post('/transcribe', handleTranscribe);
   ```

4. **jobStore** — Em `apps/server/src/services/jobStore.ts`, garantir que `updateJob` suporta o campo `transcript`.

5. **Frontend — API** — Em `apps/web/src/services/api/filesApi.ts`:
   ```typescript
   transcribe: async (data: TranscribeRequest): Promise<TranscribeResponse> => {
     return fetchJson<TranscribeResponse>(`${BASE}/files/transcribe`, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify(data),
     });
   },
   ```

6. **Frontend — EditorPanel** — Quando `segments.length === 0`, mostrar botao "Transcrever com IA":
   ```tsx
   {segments.length === 0 && (
     <button onClick={handleTranscribe} className="...">
       Transcrever com IA (Whisper)
     </button>
   )}
   ```

### Testes necessarios

- **`apps/server/src/__tests__/whisperService.test.ts`** — Mock da OpenAI API. Testar que `transcribe` extrai audio, chama Whisper, converte para `TranscriptSegment[]`.
- **`apps/server/src/__tests__/filesController.test.ts`** — Testar `handleTranscribe`: valida params, chama servico, salva no job.
- **Teste de integracao** — `whisperService.integration.test.ts` com `SKIP_INTEGRATION=true`.

### Dependências

Nenhuma. Pode ser implementada de forma independente.

---

## 12. Formato vertical (9:16)

### Descrição
Crop automatico para Reels/TikTok/Shorts. Detecta regiao de interesse (centro do frame por padrao) e corta para 9:16. Novo parametro no `cut/finalize`.

### Arquivos a modificar

| Arquivo | O que mudar |
|---------|-------------|
| `packages/types/src/index.ts` | Tipos `CropOptions`, estender `CutRequest` |
| `apps/server/src/services/ffmpegService.ts` | Adicionar logica de crop no `cutVideo` |
| `apps/server/src/controllers/cutController.ts` | Aceitar `cropOptions` no finalize |
| `apps/web/src/components/editor/CutPanel.tsx` | Toggle "Formato vertical" + preview do crop |
| `apps/web/src/components/editor/EditorPanel.tsx` | Passar cropOptions para o fluxo de export |

### Tipos novos

```typescript
// packages/types/src/index.ts
export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:5';

export interface CropOptions {
  aspectRatio: AspectRatio;
  /** Posicao X do centro do crop (0.0 a 1.0, default 0.5) */
  centerX?: number;
  /** Posicao Y do centro do crop (0.0 a 1.0, default 0.5) */
  centerY?: number;
}

// Adicionar em CutRequest:
export interface CutRequest {
  // ... existente
  crop?: CropOptions;
}
```

### Mudanças de API

- **POST `/cut/finalize`** — Novo campo opcional `crop: CropOptions` no body. Quando presente, o FFmpeg aplica filtro de crop + scale antes de copiar.

### Passos de implementação

1. **Tipos** — Adicionar `AspectRatio`, `CropOptions` em `packages/types/src/index.ts`. Adicionar `crop?: CropOptions` em `CutRequest`.

2. **ffmpegService** — Em `apps/server/src/services/ffmpegService.ts`, adicionar funcao de calculo do crop:
   ```typescript
   function calculateCropFilter(
     sourceWidth: number,
     sourceHeight: number,
     aspectRatio: AspectRatio,
     centerX = 0.5,
     centerY = 0.5,
   ): string {
     const ratios: Record<AspectRatio, [number, number]> = {
       '16:9': [16, 9],
       '9:16': [9, 16],
       '1:1': [1, 1],
       '4:5': [4, 5],
     };

     const [rw, rh] = ratios[aspectRatio];
     const targetRatio = rw / rh;
     const sourceRatio = sourceWidth / sourceHeight;

     let cropW: number, cropH: number;
     if (sourceRatio > targetRatio) {
       // Video mais largo que o alvo: cortar laterais
       cropH = sourceHeight;
       cropW = Math.round(sourceHeight * targetRatio);
     } else {
       // Video mais alto que o alvo: cortar topo/base
       cropW = sourceWidth;
       cropH = Math.round(sourceWidth / targetRatio);
     }

     // Garantir valores pares (requisito FFmpeg)
     cropW = cropW - (cropW % 2);
     cropH = cropH - (cropH % 2);

     // Calcular posicao com base no centro
     const maxX = sourceWidth - cropW;
     const maxY = sourceHeight - cropH;
     const x = Math.round(Math.max(0, Math.min(maxX, centerX * sourceWidth - cropW / 2)));
     const y = Math.round(Math.max(0, Math.min(maxY, centerY * sourceHeight - cropH / 2)));

     return `crop=${cropW}:${cropH}:${x}:${y}`;
   }
   ```

3. **cutController** — Em `handleFinalize`, aceitar `crop` no body:
   ```typescript
   const { sourcePath, trimStartMs, trimDurationMs, audioOffsetMs, outputDir, outputName, jobId, crop } = req.body;
   ```
   - Quando `crop` esta presente, usar filtro de video em vez de `-c copy`:
   ```typescript
   if (crop) {
     // Precisamos saber as dimensoes do source
     const info = await getVideoInfo(sourcePath);

     const cropFilter = calculateCropFilter(info.width, info.height, crop.aspectRatio, crop.centerX, crop.centerY);
     // Escalar para resolucao padrao (ex: 1080x1920 para 9:16)
     const scaleFilter = crop.aspectRatio === '9:16' ? ',scale=1080:1920'
       : crop.aspectRatio === '1:1' ? ',scale=1080:1080'
       : crop.aspectRatio === '4:5' ? ',scale=1080:1350'
       : '';

     const videoFilter = `${cropFilter}${scaleFilter}`;

     ffmpegLib(sourcePath)
       .setStartTime(trimStartSec)
       .setDuration(trimDurationSec)
       .videoFilters(videoFilter)
       .outputOptions(['-c:v libx264', '-preset fast', '-crf 23', '-c:a aac', '-b:a 128k'])
       .output(outputPath)
       .on('end', () => resolve())
       .on('error', (err) => reject(new Error(`FFmpeg error: ${err.message}`)))
       .run();
   }
   ```
   **IMPORTANTE:** Com crop, NAO e possivel usar `-c copy`. Precisa re-encode. Avisar no frontend que o processo sera mais lento.

4. **Frontend — CutPanel** — Adicionar toggle de formato:
   ```tsx
   const [cropMode, setCropMode] = useState<AspectRatio | null>(null);

   <div className="flex items-center gap-2 text-xs">
     <span className="text-gray-400">Formato:</span>
     {(['16:9', '9:16', '1:1', '4:5'] as const).map(ratio => (
       <button
         key={ratio}
         onClick={() => setCropMode(cropMode === ratio ? null : ratio)}
         className={`px-2 py-1 rounded ${cropMode === ratio ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'}`}
       >
         {ratio}
       </button>
     ))}
   </div>
   ```
   - Novo prop: `cropOptions: CropOptions | undefined` passado para cima.

5. **EditorPanel** — Incluir `crop` no request de finalize:
   ```typescript
   const finalResult = await api.finalize({
     sourcePath: result.filePath,
     trimStartMs: result.paddingBeforeMs,
     trimDurationMs: result.originalDurationMs,
     audioOffsetMs: 0,
     jobId: job.id,
     crop: cropMode ? { aspectRatio: cropMode } : undefined,
   });
   ```

6. **Preview visual (opcional avancado)** — Mostrar overlay de crop no player para que o usuario veja a area que sera cortada. Isso requer calcular as dimensoes do crop e sobrepor um `<div>` semi-transparente sobre as areas excluidas.

### Testes necessarios

- **`apps/server/src/__tests__/ffmpegService.test.ts`** — Testar `calculateCropFilter`: para video 1920x1080 com 9:16, deve gerar crop correto (608:1080:656:0 para centro). Testar diferentes aspect ratios e posicoes de centro.
- **`apps/server/src/__tests__/cutController.test.ts`** — Testar que `handleFinalize` com `crop` usa filtros de video (mock ffmpeg).
- **`apps/web/src/__tests__/CutPanel.test.tsx`** — Testar toggle de formato, valor correto passado para cima.

### Dependências

Nenhuma. Pode ser implementada de forma independente. Porem, se combinada com a melhoria **4** (export em lote), cada clip do batch pode ter crop individual.

---

## Ordem sugerida de implementação

Considerando dependências entre melhorias, valor agregado imediato para o usuario, e complexidade de implementação:

### Fase 1 — Fundações (baixa complexidade, alto impacto)

| Prioridade | Melhoria | Justificativa |
|------------|----------|---------------|
| 1 | **5. Keyboard shortcuts** | Impacto imediato na produtividade, implementacao simples, sem dependencias |
| 2 | **1. Opção de modelo** | Mudanca minima (1 campo novo), desbloqueia qualidade de sugestoes |
| 3 | **2. Preview do clip sugerido** | UX crucial para avaliar sugestoes, reutiliza logica existente |

### Fase 2 — UX avancada (complexidade media)

| Prioridade | Melhoria | Justificativa |
|------------|----------|---------------|
| 4 | **6. Undo/Redo** | Depende levemente do #5 (atalhos), melhora muito a experiencia de selecao |
| 5 | **7. Timeline visual** | Complemento visual para sugestoes, melhora descoberta de clips |
| 6 | **8. Indicador de progresso** | Feedback essencial durante exports longos |

### Fase 3 — Backend robusto (complexidade media-alta)

| Prioridade | Melhoria | Justificativa |
|------------|----------|---------------|
| 7 | **9. Cache de sugestões** | Economia de custos OpenAI, melhora tempo de resposta |
| 8 | **3. Regenerar por faixa** | Depende do #1 (modelo) e beneficia-se do #9 (cache) |
| 9 | **10. Streaming SSE** | Depende do #1 (modelo), melhora percepcao de velocidade |

### Fase 4 — Features avancadas (complexidade alta)

| Prioridade | Melhoria | Justificativa |
|------------|----------|---------------|
| 10 | **4. Exportar em lote** | Beneficia-se do #8 (progresso), automacao poderosa |
| 11 | **11. Transcrição Whisper** | Feature standalone, desbloqueia uso para videos sem legenda |
| 12 | **12. Formato vertical** | Re-encode e lento, melhor ter o fluxo basico otimizado antes |

### Diagrama de dependências

```
(independente) 5. Keyboard shortcuts
                    └─> 6. Undo/Redo

(independente) 1. Modelo
                    ├─> 3. Regenerar por faixa
                    └─> 10. Streaming SSE

(independente) 2. Preview
(independente) 7. Timeline visual

(independente) 8. Progresso
                    └─> 4. Export em lote

(independente) 9. Cache
                    └─> 3. Regenerar por faixa (beneficia-se)
                    └─> 10. Streaming SSE (pode integrar)

(independente) 11. Whisper
(independente) 12. Formato vertical
```

### Estimativa de esforço

| Melhoria | Esforço estimado |
|----------|------------------|
| 1. Modelo | ~2h |
| 2. Preview | ~3h |
| 3. Regenerar | ~4h |
| 4. Export lote | ~8h |
| 5. Atalhos | ~3h |
| 6. Undo/Redo | ~4h |
| 7. Timeline visual | ~3h |
| 8. Progresso | ~5h |
| 9. Cache | ~4h |
| 10. Streaming | ~6h |
| 11. Whisper | ~6h |
| 12. Formato vertical | ~8h |
| **Total** | **~56h** |
