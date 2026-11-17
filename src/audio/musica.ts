// Música de fondo con sabor andino pero «de videojuego»: melodía pegajosa, bajo con movimiento,
// rasgueo de tiple y percusión (bombo, guacharaca, palmas). Todo sintetizado con Web Audio.
//   · pueblo  — bambuco alegre en Re mayor (Plaza, Taller, Campo)
//   · monte   — misterio en Si menor, pulso de tambor y flauta con eco (explorando el Monte)
//   · combate — 4/4 rápido en Si menor, ostinato, tambores y melodía heroica (pelea contra un mito)

export type Tema = 'pueblo' | 'monte' | 'combate';

/** Nota: [paso dentro del compás, nota MIDI, duración en pasos]. */
type Nota = [number, number, number];
type Compas = { acorde: [number, number[]]; mel?: Nota[]; contra?: Nota[] };

interface DefTema {
  /** Duración de un paso en segundos (corchea en 6/8, semicorchea en 4/4). */
  paso: number;
  pasosPorCompas: number;
  compases: Compas[];
}

const f = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const n = (...xs: Nota[]) => xs;

// Acordes (bajo MIDI, notas del acorde)
const D: [number, number[]] = [50, [62, 66, 69]], G: [number, number[]] = [43, [62, 67, 71]], A: [number, number[]] = [45, [61, 64, 69]];
const A7: [number, number[]] = [45, [61, 64, 67]], Bm: [number, number[]] = [47, [62, 66, 71]], Em: [number, number[]] = [40, [64, 67, 71]];
const Fsm: [number, number[]] = [42, [61, 66, 69]], Fs: [number, number[]] = [42, [61, 66, 70]];

// ---------------- Pueblo: bambuco en 6/8 (6 corcheas por compás) ----------------
const PUEBLO_A: Compas[] = [
  { acorde: D, mel: n([0, 69, 2], [2, 66, 1], [3, 69, 1], [4, 74, 2]) },
  { acorde: G, mel: n([0, 71, 3], [3, 74, 1], [4, 71, 1], [5, 67, 1]) },
  { acorde: A, mel: n([0, 73, 2], [2, 76, 1], [3, 73, 1], [4, 69, 2]) },
  { acorde: D, mel: n([0, 74, 3], [4, 69, 1], [5, 71, 1]) },
  { acorde: Bm, mel: n([0, 74, 2], [2, 78, 1], [3, 76, 1], [4, 74, 1], [5, 71, 1]) },
  { acorde: G, mel: n([0, 79, 2], [2, 78, 1], [3, 76, 1], [4, 74, 2]) },
  { acorde: A7, mel: n([0, 76, 1], [1, 78, 1], [2, 76, 1], [3, 73, 2], [5, 69, 1]) },
  { acorde: D, mel: n([0, 74, 4]) },
];
const PUEBLO_B: Compas[] = [
  { acorde: G, mel: n([0, 71, 1], [1, 74, 1], [2, 79, 2], [4, 78, 1], [5, 76, 1]) },
  { acorde: D, mel: n([0, 78, 2], [2, 74, 1], [3, 69, 3]) },
  { acorde: A, mel: n([0, 76, 1], [1, 73, 1], [2, 69, 1], [3, 73, 1], [4, 76, 1], [5, 79, 1]) },
  { acorde: Bm, mel: n([0, 78, 3], [3, 74, 1], [4, 71, 2]) },
  { acorde: G, mel: n([0, 67, 1], [1, 71, 1], [2, 74, 1], [3, 79, 2], [5, 78, 1]) },
  { acorde: D, mel: n([0, 76, 1], [1, 74, 1], [2, 69, 1], [3, 78, 3]) },
  { acorde: A7, mel: n([0, 76, 2], [2, 74, 1], [3, 73, 1], [4, 71, 1], [5, 73, 1]) },
  { acorde: D, mel: n([0, 74, 5]) },
];
// Puente sin melodía: el tiple puntea arpegios (descanso para el oído)
const PUEBLO_C: Compas[] = [D, G, A, D, Bm, Em, A7, D].map(acorde => ({ acorde, contra: [] }));
const PUEBLO: DefTema = { paso: 0.19, pasosPorCompas: 6, compases: [...PUEBLO_A, ...PUEBLO_B, ...PUEBLO_A, ...PUEBLO_C] };

// ---------------- Monte: 6/8 lento, misterio ----------------
const MONTE: DefTema = {
  paso: 0.25, pasosPorCompas: 6,
  compases: [
    { acorde: Bm, mel: n([0, 78, 3], [3, 76, 1], [4, 74, 2]) },
    { acorde: G, mel: n([0, 71, 6]) },
    { acorde: A, mel: n([0, 73, 2], [2, 76, 2], [4, 73, 2]) },
    { acorde: Fsm, mel: n([0, 69, 5]) },
    { acorde: Bm, mel: n([0, 71, 1], [1, 74, 1], [2, 78, 4]) },
    { acorde: Em, mel: n([0, 79, 2], [2, 78, 1], [3, 76, 3]) },
    { acorde: Fs, mel: n([0, 73, 2], [2, 70, 2], [4, 73, 2]) },
    { acorde: Bm, mel: n([0, 71, 6]) },
    { acorde: Bm }, { acorde: G }, { acorde: Em }, { acorde: Fs },
  ],
};

// ---------------- Combate: 4/4 a ~150 BPM (16 semicorcheas por compás) ----------------
const COMBATE_A: Compas[] = [
  { acorde: Bm, mel: n([0, 71, 2], [2, 74, 2], [4, 78, 4], [8, 76, 2], [10, 74, 2], [12, 76, 4]) },
  { acorde: Bm, mel: n([0, 78, 3], [3, 83, 3], [6, 81, 2], [8, 78, 4], [12, 74, 4]) },
  { acorde: G, mel: n([0, 79, 2], [2, 78, 2], [4, 76, 4], [8, 74, 2], [10, 76, 2], [12, 79, 4]) },
  { acorde: A, mel: n([0, 81, 4], [4, 79, 2], [6, 78, 2], [8, 76, 8]) },
  { acorde: Bm, mel: n([0, 71, 2], [2, 74, 2], [4, 78, 4], [8, 76, 2], [10, 74, 2], [12, 76, 4]) },
  { acorde: Bm, mel: n([0, 78, 3], [3, 83, 3], [6, 81, 2], [8, 78, 4], [12, 74, 4]) },
  { acorde: G, mel: n([0, 79, 2], [2, 81, 2], [4, 83, 4], [8, 81, 2], [10, 79, 2], [12, 78, 4]) },
  { acorde: Fs, mel: n([0, 82, 4], [4, 85, 4], [8, 78, 8]) },
];
const COMBATE_B: Compas[] = [
  { acorde: Em, contra: n([0, 64, 4], [4, 67, 4], [8, 71, 6]) },
  { acorde: Bm, contra: n([0, 66, 4], [4, 71, 4], [8, 74, 6]) },
  { acorde: G, contra: n([0, 67, 4], [4, 71, 4], [8, 74, 4], [12, 76, 4]) },
  { acorde: Fs, contra: n([0, 73, 8], [8, 70, 8]) },
  { acorde: Em, contra: n([0, 64, 4], [4, 67, 4], [8, 71, 6]) },
  { acorde: Bm, contra: n([0, 66, 4], [4, 71, 4], [8, 74, 6]) },
  { acorde: G, contra: n([0, 79, 4], [4, 78, 4], [8, 76, 4], [12, 74, 4]) },
  { acorde: Fs, contra: n([0, 73, 4], [4, 70, 4], [8, 66, 8]) },
];
const COMBATE: DefTema = { paso: 0.1, pasosPorCompas: 16, compases: [...COMBATE_A, ...COMBATE_B] };

const TEMAS: Record<Tema, DefTema> = { pueblo: PUEBLO, monte: MONTE, combate: COMBATE };

/** Secuenciador de la música. Funciona con AudioContext (en vivo) u OfflineAudioContext (para exportar muestras). */
export class Musica {
  private ruidoBuf: AudioBuffer;
  private cuerdas = new Map<string, AudioBuffer>();
  private eco: DelayNode; private ecoGain: GainNode;

  constructor(private ctx: BaseAudioContext, private destino: AudioNode, private reverb: AudioNode) {
    const len = ctx.sampleRate; this.ruidoBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.ruidoBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // Eco para la flauta del monte
    this.eco = ctx.createDelay(1); this.eco.delayTime.value = 0.375;
    this.ecoGain = ctx.createGain(); this.ecoGain.gain.value = 0.35;
    this.eco.connect(this.ecoGain); this.ecoGain.connect(this.eco); this.ecoGain.connect(destino);
  }

  static def(t: Tema) { return TEMAS[t]; }
  /** Pasos que dura una vuelta completa del tema. */
  static pasosVuelta(t: Tema) { const d = TEMAS[t]; return d.compases.length * d.pasosPorCompas; }

  /** Toca el paso número «paso» del tema en el instante t. */
  tocar(tema: Tema, paso: number, t: number) {
    const def = TEMAS[tema];
    const total = def.compases.length * def.pasosPorCompas;
    const p = paso % total;
    const ci = Math.floor(p / def.pasosPorCompas), s = p % def.pasosPorCompas;
    const c = def.compases[ci];
    const [bajo, acorde] = c.acorde;
    const dur = (pasos: number) => pasos * def.paso;
    if (tema === 'pueblo') this.pueblo(c, ci, s, t, bajo, acorde, dur);
    else if (tema === 'monte') this.monte(c, ci, s, t, bajo, acorde, dur);
    else this.combate(c, ci, s, t, bajo, acorde, dur);
  }

  private pueblo(c: Compas, ci: number, s: number, t: number, bajo: number, acorde: number[], dur: (p: number) => number) {
    // Percusión: bombo en 1, palmas en 4, guacharaca en cada corchea
    if (s === 0) this.bombo(t, 0.55);
    if (s === 3) this.palma(t, 0.16);
    this.guacharaca(t, s === 0 || s === 3 ? 0.11 : 0.06);
    // Bajo: raíz en 1, quinta en 4, nota de paso al final del compás
    if (s === 0) this.bajo(f(bajo), t, dur(2.5), 0.32);
    if (s === 3) this.bajo(f(bajo + 7), t, dur(1.8), 0.24);
    if (s === 5 && ci % 2 === 1) this.bajo(f(bajo + 9), t, dur(1), 0.16);
    // Tiple: rasgueo en 3 y 6 (contratiempo del bambuco)
    if (s === 2 || s === 5) acorde.forEach((m, i) => this.cuerda(f(m), t + i * 0.012, 0.5, 0.075, (i - 1) * 0.35, 0.85));
    // Puente: arpegio punteado
    if (c.contra) { const m = acorde[[0, 1, 2, 1, 2, 1][s]] + 12; this.cuerda(f(m), t, 0.9, 0.12, s % 2 ? 0.3 : -0.3, 0.9); }
    // Melodía: tiple brillante + «ocarina» que la dobla
    for (const [ps, m, d] of c.mel ?? []) if (ps === s) {
      this.cuerda(f(m), t, 1.2, 0.2, 0.1, 0.95);
      this.voz(f(m), t, dur(d) * 0.92, 0.07, 'triangle', 0.25, d >= 3);
      this.voz(f(m) * 2, t, dur(d) * 0.6, 0.012, 'square', 0.2, false, 2400);
    }
  }

  private monte(c: Compas, ci: number, s: number, t: number, bajo: number, acorde: number[], dur: (p: number) => number) {
    // Tambor grave como latido en 1 y 4, maraca suave
    if (s === 0) this.bombo(t, 0.5, 48);
    if (s === 3) this.bombo(t, 0.3, 44);
    if (s === 1 || s === 4) this.guacharaca(t, 0.035);
    // Dron grave al inicio de cada compás
    if (s === 0) { this.voz(f(bajo - 12), t, dur(6), 0.055, 'sine', 0.1); this.voz(f(bajo), t, dur(6), 0.03, 'sawtooth', 0.1, false, 500); }
    // Arpegio de tiple oscuro
    const m = acorde[[0, 1, 2, 1, 0, 2][s]];
    this.cuerda(f(m), t, 1.6, 0.11, s % 2 ? 0.4 : -0.4, 0.55);
    // Flauta con eco
    for (const [ps, mm, d] of c.mel ?? []) if (ps === s) this.voz(f(mm), t, dur(d) * 0.95, 0.06, 'sine', 0.5, true, undefined, true);
    if (ci >= 8 && s === 0) this.cuerda(f(acorde[2] + 12), t, 2, 0.08, 0, 0.6);
  }

  private combate(c: Compas, ci: number, s: number, t: number, bajo: number, acorde: number[], dur: (p: number) => number) {
    // Batería: bombo en 1, 3 y en la «y» del 4; redoblante en 2 y 4; guacharaca en corcheas
    if (s === 0 || s === 8 || s === 14) this.bombo(t, 0.7);
    if (s === 4 || s === 12) this.redoble(t, 0.28);
    if (s % 2 === 0) this.guacharaca(t, s % 4 === 0 ? 0.09 : 0.05);
    // Redoble de tambores al final de cada frase
    if (ci % 4 === 3 && s >= 12) this.tom(t, 0.3, 140 - (s - 12) * 15);
    // Bajo en ostinato de corcheas
    if (s % 2 === 0) { const pat = [0, 0, 12, 0, 7, 0, 12, 10]; this.bajo(f(bajo + pat[s / 2]), t, dur(1.6), s === 0 ? 0.3 : 0.2, true); }
    // Golpes de acorde (tiple) en el contratiempo
    if (s === 6 || s === 10) acorde.forEach((m, i) => this.cuerda(f(m), t + i * 0.008, 0.35, 0.07, (i - 1) * 0.4, 0.9));
    // Melodía heroica: tiple + voz cuadrada filtrada (sabor de videojuego)
    for (const [ps, m, d] of c.mel ?? []) if (ps === s) {
      this.voz(f(m), t, dur(d) * 0.9, 0.05, 'square', 0.2, d >= 4, 3200);
      this.voz(f(m), t, dur(d) * 0.9, 0.05, 'triangle', 0.2, d >= 4);
      this.cuerda(f(m), t, 0.8, 0.14, 0.15, 0.95);
    }
    // Contramelodía grave en la sección B, con arpegio rápido encima
    for (const [ps, m, d] of c.contra ?? []) if (ps === s) this.voz(f(m), t, dur(d) * 0.95, 0.06, 'sawtooth', 0.25, true, 1400);
    if (c.contra && s % 2 === 1) this.cuerda(f(acorde[(s >> 1) % 3] + 12), t, 0.4, 0.08, s % 4 === 1 ? 0.35 : -0.35, 0.9);
  }

  // ---------------- Instrumentos ----------------
  private salida(vol: number, pan: number, rev: number) {
    const c = this.ctx; const g = c.createGain(); g.gain.value = vol;
    const p = c.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(this.destino);
    if (rev > 0) { const r = c.createGain(); r.gain.value = rev; g.connect(r); r.connect(this.reverb); }
    return g;
  }

  /** Cuerda pulsada (Karplus-Strong) precalculada: el tiple. */
  private cuerda(freq: number, t: number, segs: number, vol: number, pan = 0, brillo = 0.7) {
    const k = `${freq.toFixed(1)}:${segs}:${brillo}`;
    let buf = this.cuerdas.get(k);
    if (!buf) {
      const sr = this.ctx.sampleRate, len = Math.floor(sr * segs);
      buf = this.ctx.createBuffer(1, len, sr); const d = buf.getChannelData(0);
      const per = Math.max(2, Math.round(sr / freq)); const linea = new Float32Array(per);
      for (let i = 0; i < per; i++) linea[i] = Math.random() * 2 - 1;
      let idx = 0; const amort = 0.996 - (1 - brillo) * 0.006;
      for (let i = 0; i < len; i++) {
        const a = linea[idx], b = linea[(idx + 1) % per];
        linea[idx] = (a * (0.5 + brillo * 0.25) + b * (0.5 - brillo * 0.25)) * amort; d[i] = a; idx = (idx + 1) % per;
      }
      this.cuerdas.set(k, buf);
    }
    const src = this.ctx.createBufferSource(); src.buffer = buf; src.connect(this.salida(vol, pan, 0.25)); src.start(t);
  }

  /** Voz sostenida (ocarina, flauta, sintetizador) con envolvente, vibrato y filtro opcionales. */
  private voz(freq: number, t: number, d: number, vol: number, tipo: OscillatorType, rev: number, vibrato = false, corte?: number, eco = false) {
    const c = this.ctx; const o = c.createOscillator(); o.type = tipo; o.frequency.value = freq;
    if (vibrato) {
      const lfo = c.createOscillator(); lfo.frequency.value = 5.5; const lg = c.createGain(); lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(freq * 0.012, t + Math.min(0.35, d));
      lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + d + 0.2);
    }
    const g = c.createGain(); const ataque = Math.min(0.02, d / 4);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + ataque);
    g.gain.setValueAtTime(vol, t + Math.max(ataque, d - 0.06)); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.08);
    let ultimo: AudioNode = o;
    if (corte) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = corte; o.connect(fl); ultimo = fl; }
    ultimo.connect(g); g.connect(this.salida(1, 0, rev));
    if (eco) g.connect(this.eco);
    o.start(t); o.stop(t + d + 0.15);
  }

  /** Bajo: triángulo con un poco de pulso (y un leve «pluck» opcional). */
  private bajo(freq: number, t: number, d: number, vol: number, seco = false) {
    const c = this.ctx; const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = freq;
    const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq / 2;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(vol * (seco ? 0.2 : 0.5), t + d * 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    const g2 = c.createGain(); g2.gain.value = 0.5; o2.connect(g2); g2.connect(g);
    o.connect(g); g.connect(this.salida(1, 0, 0.05)); o.start(t); o2.start(t); o.stop(t + d + 0.05); o2.stop(t + d + 0.05);
  }

  private bombo(t: number, vol: number, base = 55) {
    const c = this.ctx; const o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(base * 2.6, t); o.frequency.exponentialRampToValueAtTime(base, t + 0.12);
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    o.connect(g); g.connect(this.salida(1, 0, 0.08)); o.start(t); o.stop(t + 0.4);
  }

  private ruido(t: number, d: number, vol: number, tipo: BiquadFilterType, freq: number, q: number, pan = 0, rev = 0.1) {
    const c = this.ctx; const src = c.createBufferSource(); src.buffer = this.ruidoBuf;
    const fl = c.createBiquadFilter(); fl.type = tipo; fl.frequency.value = freq; fl.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    src.connect(fl); fl.connect(g); g.connect(this.salida(1, pan, rev));
    src.start(t, Math.random() * 0.8); src.stop(t + d + 0.02);
  }
  /** Guacharaca / maraca: ruido agudo muy corto. */
  private guacharaca(t: number, vol: number) { this.ruido(t, 0.05, vol, 'highpass', 6500, 0.8, 0.25, 0.05); }
  private palma(t: number, vol: number) { this.ruido(t, 0.12, vol, 'bandpass', 1600, 1.2, -0.15, 0.25); }
  private redoble(t: number, vol: number) { this.ruido(t, 0.16, vol, 'bandpass', 2200, 0.7, 0, 0.2); this.bombo(t, vol * 0.5, 180); }
  private tom(t: number, vol: number, base: number) {
    const c = this.ctx; const o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(base * 1.6, t); o.frequency.exponentialRampToValueAtTime(base, t + 0.1);
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.connect(g); g.connect(this.salida(1, 0, 0.15)); o.start(t); o.stop(t + 0.3);
  }
}

/** Renderiza unos segundos de un tema a un AudioBuffer (para probar la mezcla o exportar una muestra). */
export async function renderizarTema(tema: Tema, segundos: number, sampleRate = 44100) {
  const ctx = new OfflineAudioContext(2, Math.floor(sampleRate * segundos), sampleRate);
  const master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
  const musica = ctx.createGain(); musica.gain.value = 0.6; musica.connect(master);
  const reverb = ctx.createConvolver(); const imp = ctx.createBuffer(2, sampleRate * 1.8, sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = imp.getChannelData(ch); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3); }
  reverb.buffer = imp; const rg = ctx.createGain(); rg.gain.value = 0.25; reverb.connect(rg); rg.connect(master);
  const m = new Musica(ctx, musica, reverb);
  const def = Musica.def(tema);
  for (let i = 0, t = 0.05; t < segundos - 0.5; i++, t += def.paso) m.tocar(tema, i, t);
  return ctx.startRendering();
}
