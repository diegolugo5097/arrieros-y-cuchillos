// Sonidos sintetizados con Web Audio (sin archivos externos).
// Efectos: dados, cartas, monedas, construcción, combate, victoria…
// Música: si existen public/musica/pueblo.mp3, monte.mp3 y combate.mp3 se usan esas canciones (en bucle y con fundido);
// si falta alguna, ese tema se toca con la música sintetizada de musica.ts.
import { Musica, Tema } from './musica';

type Ambiente = Tema | null;
const CONF = 'arrieros-y-cuchillos:sonido';

class MotorSonido {
  ctx: AudioContext | null = null;
  master!: GainNode; sfx!: GainNode; musica!: GainNode; reverb!: ConvolverNode; reverbGain!: GainNode;
  volEfectos = 0.8; volMusica = 0.35; efectosOn = true; musicaOn = true;
  private cache = new Map<string, AudioBuffer>();
  private ambiente: Ambiente = null;
  private timer: number | null = null;
  private siguienteTiempo = 0; private paso = 0; private musicaMotor: Musica | null = null;
  /** Canciones en archivo: el buffer decodificado, «no» si no existe, o la promesa mientras carga. */
  private canciones = new Map<Tema, AudioBuffer | 'no' | Promise<AudioBuffer | 'no'>>();
  private sonando: { src: AudioBufferSourceNode; g: GainNode } | null = null;

  constructor() {
    try { const c = JSON.parse(localStorage.getItem(CONF) ?? '{}'); Object.assign(this, c); } catch { /* sin config */ }
  }
  guardar() {
    try { localStorage.setItem(CONF, JSON.stringify({ volEfectos: this.volEfectos, volMusica: this.volMusica, efectosOn: this.efectosOn, musicaOn: this.musicaOn })); } catch { /* */ }
  }
  /** Debe llamarse tras un gesto del usuario (clic). */
  despertar() {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext; if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.9; this.master.connect(this.ctx.destination);
      this.sfx = this.ctx.createGain(); this.sfx.connect(this.master);
      this.musica = this.ctx.createGain(); this.musica.connect(this.master);
      this.reverb = this.ctx.createConvolver(); this.reverb.buffer = this.impulso(1.8);
      this.reverbGain = this.ctx.createGain(); this.reverbGain.gain.value = 0.25;
      this.reverb.connect(this.reverbGain); this.reverbGain.connect(this.master);
      this.aplicarVolumen();
      // Si ya había un ambiente pedido antes del primer toque, arranca la música ahora
      const a = this.ambiente; this.ambiente = null; if (a) this.setAmbiente(a);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }
  aplicarVolumen() {
    if (!this.ctx) return;
    this.sfx.gain.value = this.efectosOn ? this.volEfectos : 0;
    this.musica.gain.value = this.musicaOn ? this.volMusica : 0;
    this.guardar();
  }
  private impulso(seg: number) {
    const c = this.ctx!; const n = c.sampleRate * seg; const b = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3); }
    return b;
  }
  private ruido(seg: number) {
    const c = this.ctx!; const n = Math.floor(c.sampleRate * seg); const b = c.createBuffer(1, n, c.sampleRate);
    const d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return b;
  }
  /** Cuerda pulsada Karplus-Strong precalculada. */
  private cuerda(freq: number, dur = 1.6, brillo = 0.5): AudioBuffer {
    const k = `${freq.toFixed(1)}:${dur}:${brillo}`;
    const c = this.cache.get(k); if (c) return c;
    const ctx = this.ctx!; const sr = ctx.sampleRate; const n = Math.floor(sr * dur);
    const buf = ctx.createBuffer(1, n, sr); const d = buf.getChannelData(0);
    const per = Math.max(2, Math.round(sr / freq)); const linea = new Float32Array(per);
    for (let i = 0; i < per; i++) linea[i] = Math.random() * 2 - 1;
    let idx = 0; const amort = 0.996 - (1 - brillo) * 0.006;
    for (let i = 0; i < n; i++) {
      const a = linea[idx], b = linea[(idx + 1) % per];
      const v = (a * (0.5 + brillo * 0.25) + b * (0.5 - brillo * 0.25)) * amort;
      linea[idx] = v; d[i] = a; idx = (idx + 1) % per;
    }
    this.cache.set(k, buf); return buf;
  }
  private tocarBuffer(buf: AudioBuffer, t: number, vol: number, destino: AudioNode, rev = 0.3, pan = 0) {
    const c = this.ctx!; const src = c.createBufferSource(); src.buffer = buf;
    const g = c.createGain(); g.gain.value = vol;
    const p = c.createStereoPanner(); p.pan.value = pan;
    src.connect(g); g.connect(p); p.connect(destino);
    if (rev > 0) { const r = c.createGain(); r.gain.value = rev; g.connect(r); r.connect(this.reverb); }
    src.start(t);
  }
  private tono(f: number, t: number, dur: number, vol: number, tipo: OscillatorType = 'sine', destino?: AudioNode, fFin?: number) {
    const c = this.ctx!; const o = c.createOscillator(); o.type = tipo; o.frequency.setValueAtTime(f, t);
    if (fFin) o.frequency.exponentialRampToValueAtTime(fFin, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(destino ?? this.sfx); const r = c.createGain(); r.gain.value = 0.25; g.connect(r); r.connect(this.reverb);
    o.start(t); o.stop(t + dur + 0.05);
  }
  private golpeRuido(t: number, dur: number, vol: number, freq: number, q = 1, tipo: BiquadFilterType = 'bandpass') {
    const c = this.ctx!; const src = c.createBufferSource(); src.buffer = this.ruido(dur + 0.05);
    const f = c.createBiquadFilter(); f.type = tipo; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.sfx); src.start(t); src.stop(t + dur + 0.05);
  }

  // ---------------- Efectos ----------------
  efecto(nombre: string) {
    if (!this.ctx || !this.efectosOn) return;
    const t = this.ctx.currentTime + 0.01;
    const nota = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
    switch (nombre) {
      case 'clic': this.golpeRuido(t, 0.04, 0.4, 2500, 3); break;
      case 'dados':
        for (let i = 0; i < 7; i++) { const dt = i * 0.055 + Math.random() * 0.03; this.golpeRuido(t + dt, 0.05, 0.5 - i * 0.05, 1800 + Math.random() * 1500, 4); this.tono(300 + Math.random() * 200, t + dt, 0.04, 0.08, 'square'); }
        break;
      case 'carta': this.golpeRuido(t, 0.18, 0.35, 3500, 0.7, 'highpass'); this.golpeRuido(t + 0.05, 0.12, 0.2, 1200, 1); break;
      case 'monedas':
        [0, 0.07, 0.15].forEach((dt, i) => { this.tono(2400 + i * 300, t + dt, 0.25, 0.12, 'sine'); this.tono(3600 + i * 400, t + dt, 0.18, 0.06, 'sine'); });
        break;
      case 'construir':
        [0, 0.22, 0.44].forEach(dt => { this.golpeRuido(t + dt, 0.12, 0.7, 180, 1, 'lowpass'); this.golpeRuido(t + dt, 0.05, 0.4, 3000, 5); });
        [72, 76, 79].forEach((m, i) => this.tocarBuffer(this.cuerda(nota(m), 1.2, 0.7), t + 0.7 + i * 0.09, 0.5, this.sfx));
        break;
      case 'reparar': [0, 0.18].forEach(dt => { this.golpeRuido(t + dt, 0.1, 0.6, 220, 1, 'lowpass'); this.golpeRuido(t + dt, 0.04, 0.3, 2800, 5); }); break;
      case 'equipar': this.golpeRuido(t, 0.25, 0.3, 4500, 8); this.tono(1800, t, 0.4, 0.06, 'triangle', undefined, 1500); break;
      case 'espada': this.golpeRuido(t, 0.3, 0.5, 5000, 0.8, 'highpass'); this.tono(2200, t + 0.02, 0.6, 0.08, 'sawtooth', undefined, 1900); break;
      case 'mito': this.tono(70, t, 1.4, 0.35, 'sawtooth', undefined, 55); this.golpeRuido(t, 1.2, 0.25, 400, 0.6, 'lowpass'); this.tono(311, t + 0.1, 1.2, 0.06, 'triangle', undefined, 293); break;
      case 'ancestral': this.tono(49, t, 2.2, 0.45, 'sawtooth', undefined, 41); this.tono(98, t, 2, 0.15, 'square', undefined, 82); this.golpeRuido(t, 1.8, 0.35, 300, 0.5, 'lowpass'); this.tono(466, t + 0.3, 1.6, 0.05, 'sine', undefined, 440); break;
      case 'gana': [67, 71, 74, 79].forEach((m, i) => this.tocarBuffer(this.cuerda(nota(m), 1.5, 0.75), t + i * 0.1, 0.6, this.sfx, 0.4)); this.tono(nota(83), t + 0.42, 0.6, 0.06, 'triangle'); break;
      case 'pierde': [62, 58, 55, 50].forEach((m, i) => this.tocarBuffer(this.cuerda(nota(m), 1.6, 0.3), t + i * 0.16, 0.55, this.sfx, 0.4)); this.tono(80, t + 0.5, 0.8, 0.2, 'sawtooth', undefined, 50); break;
      case 'huye': this.golpeRuido(t, 0.5, 0.35, 900, 0.5, 'bandpass'); [0, 0.08, 0.16, 0.24].forEach(dt => this.golpeRuido(t + dt, 0.04, 0.3, 600, 2)); break;
      case 'turno': this.tocarBuffer(this.cuerda(nota(74), 1.4, 0.6), t, 0.45, this.sfx, 0.5); this.tocarBuffer(this.cuerda(nota(79), 1.4, 0.6), t + 0.14, 0.45, this.sfx, 0.5); break;
      case 'evento': [0, 0.6].forEach(dt => [1, 2.76, 5.4, 8.9].forEach((k, i) => this.tono(392 * k, t + dt, 2.2 - i * 0.4, 0.12 / (i + 1), 'sine'))); break;
      case 'dicho': this.golpeRuido(t, 0.2, 0.3, 3000, 0.7, 'highpass'); [76, 79, 81].forEach((m, i) => this.tocarBuffer(this.cuerda(nota(m), 0.9, 0.8), t + 0.1 + i * 0.07, 0.35, this.sfx)); break;
      case 'sabotaje': this.tono(220, t, 0.5, 0.25, 'square', undefined, 110); this.tono(233, t, 0.5, 0.15, 'square', undefined, 116); break;
      case 'exag': this.tono(523, t, 0.15, 0.15, 'square'); this.tono(415, t + 0.12, 0.25, 0.15, 'square'); this.golpeRuido(t, 0.15, 0.25, 2000, 2); break;
      case 'castigo': this.tono(150, t, 0.6, 0.3, 'sawtooth', undefined, 70); this.golpeRuido(t, 0.4, 0.3, 500, 1, 'lowpass'); break;
      case 'mensaje': this.tono(880, t, 0.12, 0.1, 'sine'); this.tono(1320, t + 0.08, 0.15, 0.08, 'sine'); break;
      case 'fanfarria': {
        const mel = [67, 72, 76, 79, 76, 79, 84];
        mel.forEach((m, i) => { this.tocarBuffer(this.cuerda(nota(m), 2, 0.8), t + i * 0.16, 0.6, this.sfx, 0.5); this.tono(nota(m), t + i * 0.16, 0.3, 0.05, 'triangle'); });
        [48, 55, 60, 64].forEach(m => this.tocarBuffer(this.cuerda(nota(m), 3, 0.5), t + 1.15, 0.5, this.sfx, 0.6));
        break;
      }
    }
  }

  // ---------------- Música ----------------
  /** Carga public/musica/<tema>.mp3 (una sola vez). Si no existe o no se puede leer, queda la música sintetizada. */
  private cancion(tema: Tema): Promise<AudioBuffer | 'no'> {
    const ya = this.canciones.get(tema);
    if (ya) return Promise.resolve(ya);
    const url = `${import.meta.env?.BASE_URL ?? './'}musica/${tema}.mp3`;
    const p = fetch(url)
      .then(r => (r.ok && !(r.headers.get('content-type') ?? '').includes('text/html') ? r.arrayBuffer() : Promise.reject()))
      .then(b => this.ctx!.decodeAudioData(b))
      .catch(() => 'no' as const)
      .then(v => { this.canciones.set(tema, v); return v; });
    this.canciones.set(tema, p);
    return p;
  }
  /** Apaga la canción en archivo que esté sonando, con un fundido corto. */
  private soltarCancion(seg = 1.2) {
    if (!this.sonando || !this.ctx) return;
    const { src, g } = this.sonando; const t = this.ctx.currentTime;
    g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + seg);
    try { src.stop(t + seg + 0.05); } catch { /* */ }
    this.sonando = null;
  }
  setAmbiente(a: Ambiente) {
    if (a === this.ambiente) return;
    this.ambiente = a;
    if (!this.ctx) return;
    this.soltarCancion();
    if (a) {
      // Primero se intenta la canción en archivo; mientras carga (o si no hay), suena la sintetizada
      this.cancion(a).then(buf => {
        if (buf === 'no' || this.ambiente !== a || !this.ctx || this.sonando) return;
        if (this.timer !== null) { clearInterval(this.timer); this.timer = null; }
        const src = this.ctx.createBufferSource(); src.buffer = buf; src.loop = true;
        const g = this.ctx.createGain(); const t = this.ctx.currentTime;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + 1.2);
        src.connect(g); g.connect(this.musica); src.start(t);
        this.sonando = { src, g };
      });
      if (this.canciones.get(a) instanceof AudioBuffer) return;
    }
    this.musicaMotor ??= new Musica(this.ctx, this.musica, this.reverb);
    // Cada tema arranca desde su primer compás
    this.paso = 0; this.siguienteTiempo = this.ctx.currentTime + 0.15;
    if (a && this.timer === null) this.timer = window.setInterval(() => this.programar(), 50);
    if (!a && this.timer !== null) { clearInterval(this.timer); this.timer = null; }
  }
  private programar() {
    if (!this.ctx || !this.ambiente || !this.musicaMotor) return;
    const def = Musica.def(this.ambiente);
    while (this.siguienteTiempo < this.ctx.currentTime + 0.3) {
      if (this.musicaOn) this.musicaMotor.tocar(this.ambiente, this.paso, this.siguienteTiempo);
      this.siguienteTiempo += def.paso; this.paso++;
    }
  }
}

export const sonido = new MotorSonido();

/** Traduce una línea del registro a un efecto. */
export function efectoDeLog(t: string, ancestrales: string[]): string | null {
  if (t.includes('Gran Fundador')) return 'fanfarria';
  if (t.startsWith('— Turno')) return 'turno';
  if (t.startsWith('Evento:')) return 'evento';
  if (t.startsWith('Dicho:')) return 'dicho';
  if (t.includes(' enfrenta a ')) return ancestrales.some(n => t.includes(n)) ? 'ancestral' : 'mito';
  if (t.includes(' vence a ')) return 'gana';
  if (t.includes(' pierde contra ') || t.includes('no lo logra')) return 'pierde';
  if (t.includes(' huye ')) return 'huye';
  if (t.includes(' lanza ')) return 'dados';
  if (t.includes(' sabotea ')) return 'sabotaje';
  if (t.includes(' construye ')) return 'construir';
  if (t.includes(' repara ')) return 'reparar';
  if (t.includes(' se equipa ')) return 'equipar';
  if (t.includes(' juega «')) return 'exag';
  if (/ (compra|vende|cosecha|gana \d+ oro|paga)/.test(t)) return 'monedas';
  if (/(dañada|pierde|descarta)/.test(t)) return 'castigo';
  if (/ (toma|roba|recibe)/.test(t)) return 'carta';
  return null;
}
