// Web Audio API sound effects — no external files needed

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  return ctx;
}

function playTone(
  frequency: number,
  type: OscillatorType = "sine",
  duration = 0.12,
  gain = 0.18,
  startDelay = 0,
  decayFactor = 8,
) {
  try {
    const ac = getCtx();
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.connect(g);
    g.connect(ac.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ac.currentTime + startDelay);
    g.gain.setValueAtTime(gain, ac.currentTime + startDelay);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + startDelay + duration);
    osc.start(ac.currentTime + startDelay);
    osc.stop(ac.currentTime + startDelay + duration + 0.02);
  } catch {
    // Ignore errors (autoplay policy, etc.)
  }
}

// ─── Public sound functions ────────────────────────────────────────────────

/** Heart pop when you like a post */
export function playLike() {
  playTone(880, "sine", 0.08, 0.14);
  playTone(1100, "sine", 0.06, 0.10, 0.05);
}

/** Un-like click */
export function playUnlike() {
  playTone(660, "sine", 0.07, 0.10);
}

/** Message sent whoosh */
export function playSend() {
  playTone(440, "sine", 0.06, 0.12);
  playTone(660, "sine", 0.07, 0.14, 0.04);
  playTone(880, "sine", 0.05, 0.10, 0.09);
}

/** Incoming message ping */
export function playReceive() {
  playTone(980, "sine", 0.07, 0.12);
  playTone(1200, "sine", 0.06, 0.10, 0.08);
}

/** Notification ding */
export function playNotification() {
  playTone(1046, "sine", 0.07, 0.15);
  playTone(1318, "sine", 0.07, 0.12, 0.1);
}

/** Follow button click */
export function playFollow() {
  playTone(523, "sine", 0.06, 0.13);
  playTone(659, "sine", 0.06, 0.12, 0.07);
  playTone(784, "sine", 0.06, 0.11, 0.14);
}

/** Live stream go-live fanfare */
export function playGoLive() {
  playTone(440, "sawtooth", 0.06, 0.15);
  playTone(554, "sine", 0.07, 0.18, 0.08);
  playTone(659, "sine", 0.08, 0.20, 0.17);
  playTone(880, "sine", 0.09, 0.22, 0.27);
}

/** Post upload success */
export function playUploadSuccess() {
  playTone(523, "sine", 0.06, 0.14);
  playTone(659, "sine", 0.06, 0.14, 0.08);
  playTone(784, "sine", 0.06, 0.14, 0.16);
  playTone(1046, "sine", 0.08, 0.18, 0.25);
}

/** Error / wrong OTP */
export function playError() {
  playTone(220, "sawtooth", 0.12, 0.18);
  playTone(180, "sawtooth", 0.12, 0.18, 0.12);
}

/** Camera shutter */
export function playShutter() {
  playTone(2000, "square", 0.02, 0.1);
  playTone(1000, "square", 0.03, 0.08, 0.02);
}
