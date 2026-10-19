/**
 * Notificações sonoras via Web Audio API.
 * ---------------------------------------------------------------------------
 * Recurso adaptado do projeto de referência (Herculano Gestor) para o
 * Delivery_OS: sintetiza os tons no navegador, sem depender de arquivos de
 * áudio externos. É seguro no SSR — todo acesso a `window`/`localStorage` é
 * protegido por checagem de ambiente.
 *
 * Sons disponíveis:
 *  - newOrder    → nova corrida despachada (chime de dois tons)
 *  - delayAlert  → corrida pendente há muito tempo (bipe de atenção)
 *  - completed   → corrida concluída (acorde maior)
 */

const STORAGE_KEY = 'delivery_os_sound_enabled';

type SoundKind = 'newOrder' | 'delayAlert' | 'completed';

class SoundNotificationService {
  private audioCtx: AudioContext | null = null;
  private enabled: boolean;

  constructor() {
    let saved: string | null = null;
    if (typeof window !== 'undefined') {
      try {
        saved = window.localStorage.getItem(STORAGE_KEY);
      } catch {
        saved = null;
      }
    }
    // Habilitado por padrão; só desliga se o usuário tiver desativado.
    this.enabled = saved === null ? true : saved === 'true';
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(value: boolean): void {
    this.enabled = value;
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_KEY, String(value));
      } catch {
        /* armazenamento indisponível — ignora */
      }
    }
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.audioCtx = new Ctor();
    }
    if (this.audioCtx.state === 'suspended') void this.audioCtx.resume();
    return this.audioCtx;
  }

  /** Toca uma sequência de notas. Cada nota é { freq, start, duration, gain }. */
  private playNotes(
    notes: { freq: number; start: number; duration: number; gain: number; type?: OscillatorType }[],
  ): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const base = ctx.currentTime;
      for (const note of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const at = base + note.start;

        osc.type = note.type ?? 'sine';
        osc.frequency.setValueAtTime(note.freq, at);
        gain.gain.setValueAtTime(note.gain, at);
        gain.gain.exponentialRampToValueAtTime(0.001, at + note.duration);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(at);
        osc.stop(at + note.duration);
      }
    } catch {
      /* navegador pode bloquear áudio antes da primeira interação */
    }
  }

  /** Nova corrida despachada — chime brilhante de dois tons (A5 → D6). */
  playNewOrder(): void {
    this.playNotes([
      { freq: 880, start: 0, duration: 0.25, gain: 0.15 },
      { freq: 1174.66, start: 0.12, duration: 0.33, gain: 0.2 },
    ]);
  }

  /** Alerta de pendência — bipe de atenção (D5 → E5, triangular). */
  playDelayAlert(): void {
    this.playNotes([
      { freq: 587.33, start: 0, duration: 0.15, gain: 0.18, type: 'triangle' },
      { freq: 659.25, start: 0.15, duration: 0.2, gain: 0.18, type: 'triangle' },
    ]);
  }

  /** Corrida concluída — acorde maior ascendente (C5, E5, G5). */
  playCompleted(): void {
    this.playNotes([
      { freq: 523.25, start: 0, duration: 0.3, gain: 0.15 },
      { freq: 659.25, start: 0.08, duration: 0.3, gain: 0.15 },
      { freq: 783.99, start: 0.16, duration: 0.3, gain: 0.15 },
    ]);
  }

  /** Atalho por tipo. */
  play(kind: SoundKind): void {
    if (kind === 'newOrder') this.playNewOrder();
    else if (kind === 'delayAlert') this.playDelayAlert();
    else this.playCompleted();
  }
}

export const soundNotification = new SoundNotificationService();
export type { SoundKind };