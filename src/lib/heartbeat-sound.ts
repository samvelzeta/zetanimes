/**
 * Genera un sonido sintético de latido de corazón ("thump-thump")
 * usando Web Audio API. Sin necesidad de archivos de audio.
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) {
      const AC =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  } catch {
    return null;
  }
}

function thump(time: number, gain = 0.6) {
  const audio = getCtx();
  if (!audio) return;

  // Oscilador de baja frecuencia (60-90Hz) — sensación de "golpe" grave
  const osc = audio.createOscillator();
  const env = audio.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(90, time);
  osc.frequency.exponentialRampToValueAtTime(40, time + 0.18);

  env.gain.setValueAtTime(0.0001, time);
  env.gain.exponentialRampToValueAtTime(gain, time + 0.02);
  env.gain.exponentialRampToValueAtTime(0.0001, time + 0.22);

  osc.connect(env);
  env.connect(audio.destination);

  osc.start(time);
  osc.stop(time + 0.25);
}

/**
 * Reproduce un único patrón de latido: TUM-tum (dos golpes, el segundo más suave).
 * Llamar al hacer click en "Ver Ahora" / play del Hero.
 */
export function playHeartbeat() {
  const audio = getCtx();
  if (!audio) return;
  const t = audio.currentTime;
  thump(t, 0.65);
  thump(t + 0.18, 0.4);
}
