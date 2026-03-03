import { describe, it, expect } from 'vitest';
import type { TranscriptSegment, ClipCategory } from '@video-cutter/types';

// Skip by default — run with SKIP_INTEGRATION=false OPENAI_API_KEY=sk-... npm test
const SKIP = process.env.SKIP_INTEGRATION !== 'false';

// Sample sermon transcript (~30 segments covering various themes)
const SAMPLE_TRANSCRIPT: TranscriptSegment[] = [
  { id: 1, startMs: 0, endMs: 8000, text: 'Boa noite a todos, sejam bem-vindos ao nosso culto.' },
  { id: 2, startMs: 8000, endMs: 16000, text: 'Hoje vamos falar sobre algo que transforma vidas.' },
  { id: 3, startMs: 16000, endMs: 24000, text: 'Abram suas bíblias em Romanos capítulo 8, versículo 28.' },
  { id: 4, startMs: 24000, endMs: 32000, text: 'Sabemos que todas as coisas cooperam para o bem daqueles que amam a Deus.' },
  { id: 5, startMs: 32000, endMs: 40000, text: 'Muitas vezes passamos por dificuldades e não entendemos o propósito.' },
  { id: 6, startMs: 40000, endMs: 48000, text: 'Mas Deus tem um plano perfeito para cada um de nós.' },
  { id: 7, startMs: 48000, endMs: 56000, text: 'Eu quero contar um testemunho de algo que aconteceu comigo na semana passada.' },
  { id: 8, startMs: 56000, endMs: 64000, text: 'Eu estava dirigindo e quase sofri um acidente grave.' },
  { id: 9, startMs: 64000, endMs: 72000, text: 'Mas Deus colocou um anjo na minha frente e me livrou.' },
  { id: 10, startMs: 72000, endMs: 80000, text: 'Naquele momento eu entendi que Deus cuida de cada detalhe.' },
  { id: 11, startMs: 80000, endMs: 88000, text: 'Não importa o que você está passando hoje.' },
  { id: 12, startMs: 88000, endMs: 96000, text: 'Deus conhece cada lágrima, cada dor, cada angústia.' },
  { id: 13, startMs: 96000, endMs: 104000, text: 'Ele não te abandonou e nunca vai te abandonar.' },
  { id: 14, startMs: 104000, endMs: 112000, text: 'Sabe por quê? Porque o amor de Deus é incondicional.' },
  { id: 15, startMs: 112000, endMs: 120000, text: 'Vamos olhar o que diz o versículo 31.' },
  { id: 16, startMs: 120000, endMs: 128000, text: 'Se Deus é por nós, quem será contra nós?' },
  { id: 17, startMs: 128000, endMs: 136000, text: 'Essa é a verdade mais poderosa da Bíblia.' },
  { id: 18, startMs: 136000, endMs: 144000, text: 'O inimigo pode tentar, mas ele não vai prevalecer.' },
  { id: 19, startMs: 144000, endMs: 152000, text: 'Eu sei que parece difícil acreditar quando estamos no vale.' },
  { id: 20, startMs: 152000, endMs: 160000, text: 'Mas é justamente no vale que Deus prepara a mesa.' },
  { id: 21, startMs: 160000, endMs: 168000, text: 'Lembra do Salmo 23? Preparas uma mesa perante os meus inimigos.' },
  { id: 22, startMs: 168000, endMs: 176000, text: 'Isso é encorajamento puro, amados!' },
  { id: 23, startMs: 176000, endMs: 184000, text: 'Agora eu quero fazer um desafio para todos vocês.' },
  { id: 24, startMs: 184000, endMs: 192000, text: 'Nesta semana, escolham confiar em Deus em cada situação.' },
  { id: 25, startMs: 192000, endMs: 200000, text: 'Mesmo quando não fizer sentido, confiem.' },
  { id: 26, startMs: 200000, endMs: 208000, text: 'E aqui vai uma ilustração que mudou minha vida.' },
  { id: 27, startMs: 208000, endMs: 216000, text: 'Imagine um tapete sendo tecido. Por baixo é tudo confuso, cheio de fios soltos.' },
  { id: 28, startMs: 216000, endMs: 224000, text: 'Mas quando você vira do lado certo, vê uma obra de arte.' },
  { id: 29, startMs: 224000, endMs: 232000, text: 'A vida é assim. Deus vê o lado bonito que ainda não conseguimos ver.' },
  { id: 30, startMs: 232000, endMs: 240000, text: 'Que Deus abençoe a todos. Amém!' },
];

const VALID_CATEGORIES: ClipCategory[] = [
  'exortacao', 'encorajamento', 'ensino', 'testemunho',
  'adoracao', 'reflexao', 'chamado', 'humor', 'ilustracao',
];

describe.skipIf(SKIP)('llmService integration (real OpenAI)', () => {
  it('generates valid clip suggestions from a sermon transcript', async () => {
    // Dynamic import to avoid mock interference
    const { suggestClips } = await import('../services/llmService');

    const result = await suggestClips({
      segments: SAMPLE_TRANSCRIPT,
    });

    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThanOrEqual(8);

    for (const clip of result) {
      // Timestamps within the transcript range
      expect(clip.startMs).toBeGreaterThanOrEqual(0);
      expect(clip.endMs).toBeLessThanOrEqual(240000);
      expect(clip.startMs).toBeLessThan(clip.endMs);

      // Duration between 5s and 120s
      const duration = clip.endMs - clip.startMs;
      expect(duration).toBeGreaterThanOrEqual(5000);
      expect(duration).toBeLessThanOrEqual(120000);

      // Valid category
      expect(VALID_CATEGORIES).toContain(clip.category);

      // Non-empty title and description
      expect(clip.title.length).toBeGreaterThan(0);
      expect(clip.description.length).toBeGreaterThan(0);

      // Hashtags start with #
      for (const h of clip.hashtags) {
        expect(h.startsWith('#')).toBe(true);
      }
    }
  }, 30000);
});
