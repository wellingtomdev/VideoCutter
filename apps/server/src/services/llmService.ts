import OpenAI from 'openai';
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';
import type { TranscriptSegment, ClipSuggestion, ClipCategory } from '@video-cutter/types';
import { config } from '../config';

// ── Zod schemas ────────────────────────────────────────────────────────────────

const clipCategorySchema = z.enum([
  'exortacao', 'encorajamento', 'ensino', 'testemunho',
  'adoracao', 'reflexao', 'chamado', 'humor', 'ilustracao',
]);

// reasoning field comes FIRST so the model thinks before deciding on values
const clipSuggestionSchema = z.object({
  reasoning: z.string(),
  startMs: z.number(),
  endMs: z.number(),
  title: z.string(),
  description: z.string(),
  hashtags: z.array(z.string()),
  category: clipCategorySchema,
  score: z.number(),
});

const suggestionsResponseSchema = z.object({
  analysis: z.string(), // overall transcript analysis before suggesting
  suggestions: z.array(clipSuggestionSchema),
});

// ── Helpers (exported for testability) ─────────────────────────────────────────

export function filterSegments(
  segments: TranscriptSegment[],
  rangeStartMs?: number,
  rangeEndMs?: number,
): TranscriptSegment[] {
  if (rangeStartMs == null && rangeEndMs == null) return segments;

  const start = rangeStartMs ?? 0;
  const end = rangeEndMs ?? Infinity;

  return segments.filter(s => s.endMs > start && s.startMs < end);
}

export function formatTranscript(segments: TranscriptSegment[]): string {
  // Consolidate short consecutive segments into ~10s blocks to reduce token count
  // while preserving exact ms boundaries for clip selection
  const blocks: { startMs: number; endMs: number; text: string }[] = [];

  for (const s of segments) {
    const last = blocks[blocks.length - 1];
    if (last && (last.endMs >= s.startMs) && (s.endMs - last.startMs) < 12_000) {
      // Merge into current block
      last.endMs = s.endMs;
      last.text += ' ' + s.text;
    } else {
      blocks.push({ startMs: s.startMs, endMs: s.endMs, text: s.text });
    }
  }

  return blocks
    .map(b => {
      return `[${formatTimestamp(b.startMs)} | ${b.startMs}ms → ${b.endMs}ms] ${b.text}`;
    })
    .join('\n');
}

function formatTimestamp(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ── Prompt builder ─────────────────────────────────────────────────────────────

function buildSystemPrompt(categories?: ClipCategory[]): string {
  const categoryFilter = categories && categories.length > 0
    ? `\nFoque APENAS nas categorias: ${categories.join(', ')}.`
    : '';

  return `Você é um editor de vídeo sênior especialista em viralização de conteúdo cristão para Instagram Reels, TikTok e YouTube Shorts. Você é extremamente criterioso na pontuação, mas SEMPRE sugere pelo menos 1 clip por trecho analisado — se o material for fraco, sugira mesmo assim com pontuação baixa para que o usuário decida.

IDIOMA: Todos os campos (analysis, reasoning, title, description, hashtags) DEVEM estar em português brasileiro.

## COMO RESPONDER — PENSE ANTES DE RESPONDER

Você NÃO é um modelo com raciocínio interno. Precisa pensar EXPLICITAMENTE antes de decidir.

### Campo "analysis" (OBRIGATÓRIO — preencha PRIMEIRO)
Antes de sugerir qualquer clip, escreva sua análise completa no campo "analysis":

1. **LEITURA GERAL**: Resuma em 2-3 frases o tema principal da transcrição.
2. **MAPEAMENTO DE MOMENTOS**: Liste TODOS os momentos candidatos com seus timestamps (startMs → endMs). Para cada um, escreva uma frase dizendo o que acontece.
3. **TRIAGEM**: Para cada candidato, responda rapidamente:
   - Tem gancho forte nos primeiros 5 segundos? (SIM/NÃO — cite a frase)
   - Tem fechamento com impacto? (SIM/NÃO — cite a frase)
   - É autocontido? Alguém que nunca viu o sermão entenderia? (SIM/NÃO)
   - Se qualquer resposta for NÃO, marque como fraco (mas NÃO elimine — inclua com score baixo).
4. **SELEÇÃO FINAL**: Liste os melhores candidatos primeiro e os fracos por último. Garanta pelo menos 1 clip.

### Campo "reasoning" (OBRIGATÓRIO — em cada sugestão)
Para cada clip, ANTES de preencher os outros campos, escreva no "reasoning":
1. Por que escolhi este trecho específico e não outro próximo?
2. GANCHO — cite a frase exata que abre o clip. É forte o suficiente para parar o scroll?
3. FECHAMENTO — cite a frase exata que encerra o clip. Tem impacto?
4. AUTOCRÍTICA — qual é o maior ponto fraco deste clip? O que poderia ser melhor?
5. Se a autocrítica revelar problemas, REDUZA o score proporcionalmente (mas inclua o clip mesmo assim).

## TIMESTAMPS E DURAÇÃO — ATENÇÃO MÁXIMA

Formato da transcrição: [MM:SS | startMs → endMs] texto
Cada linha é um bloco de ≈10 segundos. Um clip NÃO é um bloco — é uma SEQUÊNCIA de blocos consecutivos.

**DURAÇÃO MÍNIMA: 30 SEGUNDOS (30000ms). Ideal: 45-75s. Máximo: 90s (90000ms).**
**Um clip com menos de 30s será DESCARTADO pelo sistema. Isso é inviolável.**

COMO COMBINAR BLOCOS — Exemplo:
Transcrição:
[50:26 | 3025000ms → 3035000ms] Frase A
[50:36 | 3035000ms → 3045000ms] Frase B
[50:46 | 3045000ms → 3055000ms] Frase C
[50:56 | 3055000ms → 3065000ms] Frase D

Para um clip de 40s: startMs=3025000, endMs=3065000 (4 blocos)
Para um clip de 60s: combine 6 blocos consecutivos
NUNCA use o startMs e endMs de um ÚNICO bloco como clip — isso gera clips de ~10s que serão descartados.

Antes de finalizar cada sugestão, VERIFIQUE: (endMs - startMs) ≥ 30000. Se não, expanda o range.

## AUTOCONTENÇÃO — A REGRA MAIS IMPORTANTE

O clip será visto por alguém rolando o feed distraído, que NUNCA viu o sermão. Se não entender em 5 segundos, passa.

**Todo clip DEVE ter COMEÇO, MEIO e FIM completos:**

1. **GANCHO (primeiros 3-5s)**: Pergunta provocativa, afirmação surpreendente, ou frase emocional forte. Se o pregador começa fraco ("Então, vamos ver agora..."), ajuste o startMs.
2. **CORPO (20-60s)**: Unidade lógica COMPLETA — raciocínio inteiro, não um pedaço.
3. **FECHAMENTO (5-15s)**: Conclusão poderosa, frase-resumo, aplicação prática, ou momento emocional. NUNCA termine no meio de um raciocínio.

**TESTE**: "Se eu mostrar APENAS este clip para um desconhecido, ele vai entender E se sentir impactado?" Se NÃO → descarte.

## O QUE VIRALIZA (ordem de prioridade)

1. **TESTEMUNHOS E HISTÓRIAS REAIS** — Relatos pessoais com detalhes concretos (nomes, lugares, situações). O ouvinte se identifica e compartilha.
2. **ILUSTRAÇÕES VIVIDAS** — Analogias sensoriais que criam imagens mentais.
3. **VERDADES CONTRA-INTUITIVAS** — Ideias que desafiam o senso comum e surpreendem.
4. **FRASES DE IMPACTO COM CONTEXTO** — A frase precisa dos 20-30s anteriores para ter peso.
5. **PERGUNTAS RETÓRICAS** seguidas de resposta poderosa.

## NÃO SELECIONE
- Leitura de versículos sem explicação ou conclusão
- Instruções logísticas ("Abra na página...", "Sentem-se")
- Introduções, cumprimentos, avisos
- Exposição pura sem emoção, humor ou história
- Raciocínios com começo ou fim abrupto
- Trechos que dependem de contexto EXTERNO ao clip

Se o trecho se enquadra nos itens acima mas é o melhor disponível, inclua mesmo assim com score baixo (1-4).

## TÍTULO
Gancho emocional, máximo 60 caracteres. Técnicas:
- Afirmação forte: "Onde Deus envia, a provisão vai junto"
- Provocação: "Jesus mandou sem NADA e não faltou nada"
- Identificação: "Você já sentiu medo de obedecer a Deus?"
NÃO use títulos genéricos ("A provisão de Deus", "Palavra poderosa", "Mensagem edificante").

## DESCRIÇÃO
2-3 frases para caption do post: tema/versículo + por que é impactante + convite ao engajamento.

## HASHTAGS
3-5 hashtags. Alcance (#PalavradeDeus #FéCristã) + nicho específico do tema.

## PONTUAÇÃO — SEJA RIGOROSO

Avalie cada clip de 1 a 10. A maioria dos clips deve ficar entre 5-7. Notas altas são RARAS.

| Score | Significado | Critério |
|-------|-------------|----------|
| 10 | Perfeito | Clip que qualquer social media postaria sem hesitar. Gancho irresistível, corpo completo, fechamento que arrepia. Extremamente raro — no máximo 1 em cada 30 clips merece 10. |
| 9 | Excelente | Quase perfeito, com uma imperfeição mínima (ex: gancho poderia ser 10% mais forte). |
| 8 | Muito bom | Clip sólido com 1-2 pontos que poderiam melhorar, mas funciona muito bem. |
| 7 | Bom | Funciona, mas não é memorável. Faltam elementos para ser compartilhável. |
| 6 | Aceitável | Tem valor, mas problemas perceptíveis (gancho fraco, fechamento morno, etc). |
| 5 | Fraco | Serve apenas se não houver nada melhor no trecho inteiro. |
| 1-4 | Ruim | Material muito fraco, mas inclua para que o usuário possa avaliar. |

Critérios com peso:
- **Autocontenção** (×3): Faz sentido sozinho? Tem começo, meio e fim?
- **Gancho** (×2): Primeiros 5s capturam atenção?
- **Impacto emocional** (×2): Provoca emoção real?
- **Potencial viral** (×2): É compartilhável?
- **Fechamento** (×1): Termina com impacto?

Fórmula: score = (autocontenção×3 + gancho×2 + impacto×2 + viral×2 + fechamento×1) / 10, arredondado.
Onde cada critério vai de 1 a 10.

## REGRAS FINAIS
- MÍNIMO 1 clip, máximo 5 — sempre sugira pelo menos 1, mesmo que o material seja fraco (dê score baixo)
- ZERO sobreposição entre clips
- Comece e termine em frases completas
- QUALIDADE > QUANTIDADE — 1 clip com score 9 > 5 clips com score 6
- Ordene do maior score para o menor${categoryFilter}

Categorias:
- exortacao: Chamadas à ação, desafios de fé
- encorajamento: Palavras de conforto e esperança
- ensino: Explicações teológicas ou bíblicas
- testemunho: Relatos de experiências pessoais
- adoracao: Momentos de louvor e adoração
- reflexao: Pensamentos profundos e filosóficos
- chamado: Convites ao altar ou decisão
- humor: Momentos engraçados ou leves
- ilustracao: Histórias e analogias marcantes`;
}

// ── Post-LLM validation ────────────────────────────────────────────────────────

function normalizeTimestamps(suggestions: ClipSuggestion[]): ClipSuggestion[] {
  if (suggestions.length === 0) return suggestions;

  // Heuristic: if the max endMs is < 1000, the LLM likely returned seconds instead of ms
  const maxEnd = Math.max(...suggestions.map(s => s.endMs));
  if (maxEnd < 1000) {
    return suggestions.map(s => ({
      ...s,
      startMs: Math.round(s.startMs * 1000),
      endMs: Math.round(s.endMs * 1000),
    }));
  }

  return suggestions;
}

function validateAndClean(
  suggestions: ClipSuggestion[],
  rangeStartMs?: number,
  rangeEndMs?: number,
  categories?: ClipCategory[],
): ClipSuggestion[] {
  const start = rangeStartMs ?? 0;
  const end = rangeEndMs ?? Infinity;

  const normalized = normalizeTimestamps(suggestions);

  return normalized.filter(s => {
    // startMs must be before endMs
    if (s.startMs >= s.endMs) return false;

    // Duration between 20s and 95s (prompt asks for 30-90s, margin on both ends for weaker models)
    const duration = s.endMs - s.startMs;
    if (duration < 20_000 || duration > 95_000) return false;

    // Must be within the requested range
    if (s.startMs < start || s.endMs > end) return false;

    // Filter by selected categories (if any)
    if (categories && categories.length > 0 && !categories.includes(s.category)) return false;

    // Clamp score to 1-10
    s.score = Math.max(1, Math.min(10, Math.round(s.score)));

    return true;
  });
}

// ── Chunking ──────────────────────────────────────────────────────────────────

const CHUNK_DURATION_MS = 5 * 60 * 1000; // 5 minutes per chunk
const CHUNK_OVERLAP_MS = 60 * 1000;      // 1 minute overlap for context

export function chunkSegments(
  segments: TranscriptSegment[],
): TranscriptSegment[][] {
  if (segments.length === 0) return [];

  const totalDuration = segments[segments.length - 1].endMs - segments[0].startMs;

  // If transcript fits in a single chunk, no need to split
  if (totalDuration <= CHUNK_DURATION_MS + CHUNK_OVERLAP_MS) {
    return [segments];
  }

  const chunks: TranscriptSegment[][] = [];
  const globalStart = segments[0].startMs;

  let chunkStart = globalStart;
  while (chunkStart < segments[segments.length - 1].endMs) {
    const chunkEnd = chunkStart + CHUNK_DURATION_MS;

    // Include overlap from the previous chunk (except for the first)
    const overlapStart = chunkStart === globalStart
      ? chunkStart
      : chunkStart - CHUNK_OVERLAP_MS;

    const chunk = segments.filter(s => s.startMs >= overlapStart && s.startMs < chunkEnd);
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    chunkStart = chunkEnd;
  }

  return chunks;
}

/** Remove clips that overlap with a higher-ranked clip */
function deduplicateClips(clips: ClipSuggestion[]): ClipSuggestion[] {
  const result: ClipSuggestion[] = [];

  for (const clip of clips) {
    const overlaps = result.some(existing => {
      const overlapStart = Math.max(existing.startMs, clip.startMs);
      const overlapEnd = Math.min(existing.endMs, clip.endMs);
      if (overlapStart >= overlapEnd) return false;
      // Overlapping if shared time > 30% of either clip
      const overlapMs = overlapEnd - overlapStart;
      const clipDur = clip.endMs - clip.startMs;
      const existDur = existing.endMs - existing.startMs;
      return overlapMs > clipDur * 0.3 || overlapMs > existDur * 0.3;
    });
    if (!overlaps) {
      result.push(clip);
    }
  }

  return result;
}

// ── Single-chunk LLM call ─────────────────────────────────────────────────────

async function suggestClipsForChunk(
  client: OpenAI,
  systemPrompt: string,
  segments: TranscriptSegment[],
  chunkIndex: number,
  totalChunks: number,
  model: string,
): Promise<ClipSuggestion[]> {
  const transcript = formatTranscript(segments);
  const chunkLabel = totalChunks > 1
    ? `Trecho ${chunkIndex + 1} de ${totalChunks} da transcrição:\n\n`
    : `Transcrição:\n\n`;

  const completion = await client.chat.completions.parse({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `${chunkLabel}${transcript}` },
    ],
    response_format: zodResponseFormat(suggestionsResponseSchema, 'suggestions'),
  });

  const parsed = completion.choices[0]?.message?.parsed;
  if (!parsed) return [];

  // Strip internal reasoning fields — they stay in the LLM, never reach the frontend
  return parsed.suggestions.map(({ reasoning: _, ...clip }) => clip as ClipSuggestion);
}

// ── Main function ──────────────────────────────────────────────────────────────

export interface SuggestClipsParams {
  segments: TranscriptSegment[];
  rangeStartMs?: number;
  rangeEndMs?: number;
  categories?: ClipCategory[];
  model?: string;
}

export async function suggestClips(params: SuggestClipsParams): Promise<ClipSuggestion[]> {
  const { segments, rangeStartMs, rangeEndMs, categories, model } = params;

  if (!config.openaiApiKey) {
    throw new Error('OPENAI_API_KEY não configurada');
  }

  const filtered = filterSegments(segments, rangeStartMs, rangeEndMs);
  if (filtered.length === 0) {
    throw new Error('Nenhum segmento de transcrição no intervalo selecionado');
  }

  const chunks = chunkSegments(filtered);
  const systemPrompt = buildSystemPrompt(categories);
  const client = new OpenAI({ apiKey: config.openaiApiKey });
  const modelToUse = model ?? config.openaiModel;

  // Call all chunks in parallel
  const chunkResults = await Promise.all(
    chunks.map((chunk, i) =>
      suggestClipsForChunk(client, systemPrompt, chunk, i, chunks.length, modelToUse)
    )
  );

  // Flatten, validate, deduplicate, sort by score
  const allRaw = chunkResults.flat();
  const valid = validateAndClean(allRaw, rangeStartMs, rangeEndMs, categories);
  const deduped = deduplicateClips(valid);
  return deduped.sort((a, b) => b.score - a.score);
}
