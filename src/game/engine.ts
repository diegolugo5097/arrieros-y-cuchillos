// Motor de reglas de Arrieros y Cuchillos (puro, sin React).
// Cada acción recibe un estado, lo clona y devuelve el nuevo estado.
import {
  ApoyoId, BuildingId, Castigo, CharacterId, COMIDA, DichoId, dicho, EDIFICIOS, EQUIPO, EVENTOS, EventoId, EXAGERACIONES,
  ExagId, exag, FoodKind, HERRAMIENTAS, MaterialId, MATERIALES, MITOS, mito, ORDEN_EDIFICIOS, personaje, RECOMPENSA,
  Slot, ToolId, VENTA_COMIDA, APOYOS, apoyo, DICHOS, evento, SLOT_NOMBRE, TIER_NOMBRE,
} from './data';

// ---------------- Tipos ----------------
export type MorralCard =
  | { uid: number; kind: 'equipo'; nombre: string; slot: Slot; golpe: number; img: string; nota?: string }
  | { uid: number; kind: 'comida'; nombre: string; tipo: FoodKind; img: string }
  | { uid: number; kind: 'exag'; id: ExagId };
export type MonteCard = { uid: number; kind: 'mito'; id: string } | { uid: number; kind: 'dicho'; id: DichoId };
export type Phase = 'plaza' | 'monte' | 'taller' | 'campo' | 'fin';
export type BuildState = 'ok' | 'danada';
export type Bundle = Partial<Record<MaterialId | ToolId | 'oro', number>>;

export interface Player {
  id: number; nombre: string; personaje: CharacterId; ia: boolean; color: string;
  oro: number; guacas: number;
  mat: Record<MaterialId, number>; tools: Record<ToolId, number>;
  mano: MorralCard[]; equipo: Partial<Record<Slot, MorralCard & { kind: 'equipo' }>>;
  edificios: Partial<Record<BuildingId, BuildState>>;
  apoyo: ApoyoId | null; apoyoNuevo: boolean; copiaApoyo: ApoyoId | null;
  guardados: DichoId[];
  saltaPlaza: boolean; saltaMonte: boolean; pierdeTurno: boolean; marrano: boolean; tamalDe: number | null;
  ocultas?: number; conectado?: boolean;
}

export interface Option { id: string; label: string; detail?: string; img?: string }
export interface Pending { kind: string; player: number; title: string; text?: string; options: Option[]; data?: any; img?: string }

export interface Combat {
  fighter: number; mitoId: string; source: 'monte' | 'ocasion'; tier: string;
  step: 'decidir' | 'tirada' | 'rivales' | 'victoria' | 'hecho';
  dice: number[]; bonus: number; food: { d8: number; tipo: FoodKind; nombre: string } | null;
  sabotage: { by: number; d8: number; con: string } | null; bizco: boolean; noFlee: boolean;
  /** Respuesta de quien pelea a un sabotaje: +D8 con una comida o licor. */
  respuesta?: { d8: number; con: string; licor: boolean } | null;
  reactQueue: number[]; winQueue: number[]; result: 'gana' | 'pierde' | 'huye' | 'escapa' | null;
  reward: { oro: number; guacas: number } | null; wilsonUsado: boolean;
}

export interface TurnFlags {
  intercambios: number; mainUsada: boolean; apoyoUsada: boolean; compras: number; construcciones: number; tallerExtra: boolean;
  monteHecho: boolean; vendioPrimera: boolean; claudia: 'doble' | 'mas1' | null; guacaErrantes: boolean; exagJugadas: number;
}

export interface GameState {
  version: number; seed: number; players: Player[]; current: number; firstPlayer: number; turnsInRound: number; round: number;
  phase: Phase; monte: MonteCard[]; monteDescarte: MonteCard[]; morral: MorralCard[]; morralDescarte: MorralCard[];
  herramientas: ToolId[]; herramientasDescarte: ToolId[]; reveladas: ToolId[];
  apoyosRevelados: ApoyoId[]; eventos: EventoId[]; evento: EventoId | null; gato: boolean;
  combat: Combat | null; queue: Pending[]; log: { t: string; p?: number; n?: number }[]; logN?: number; winner: number | null;
  monteCount?: number; morralCount?: number;
  turn: TurnFlags; lastMonte: MonteCard | null; anuncio: { titulo: string; texto: string; img?: string } | null;
  /** Orden de turnos decidido con el D6 inicial (ids de jugador). */
  orden?: number[];
  /** Tiradas para el orden: por jugador, la tirada inicial y los desempates. */
  ordenTiradas?: Record<number, number[]>;
  /** Contador de jugadas aplicadas: el servidor rechaza acciones hechas sobre un estado viejo. */
  paso?: number;
}

export type Action =
  | { t: 'next' } | { t: 'explorar' } | { t: 'pelear' } | { t: 'huir' } | { t: 'tirar' } | { t: 'confirmar' }
  | { t: 'comida'; uid: number } | { t: 'lora'; uid: number } | { t: 'choose'; id: string }
  | { t: 'equipar'; uid: number } | { t: 'contratar'; id: ApoyoId } | { t: 'soltarApoyo' } | { t: 'guacaErrantes' }
  | { t: 'intercambio'; partner: number; give: Bundle; get: Bundle }
  | { t: 'habilidad' } | { t: 'habilidadApoyo' } | { t: 'exag'; uid: number }
  | { t: 'comprarHerramienta'; tool: ToolId } | { t: 'construir' } | { t: 'reparar'; b: BuildingId }
  | { t: 'vender'; item: { k: 'mat'; id: MaterialId } | { k: 'tool'; id: ToolId } | { k: 'carta'; uid: number } }
  | { t: 'comprarMaterial'; id: MaterialId } | { t: 'usarTarde' } | { t: 'cerrarAnuncio' };

/** Recursos con los que empieza cada jugador (reglamento: ninguno). */
export const INICIO = { oro: 0, materiales: 0, cartas: 8 };

export const COLORES = ['#c0392b', '#2471a3', '#229954', '#b9770e'];

// ---------------- Azar ----------------
function rand(s: GameState): number {
  s.seed = (s.seed + 0x6d2b79f5) | 0;
  let t = s.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const d = (s: GameState, n: number) => 1 + Math.floor(rand(s) * n);
function shuffle<T>(s: GameState, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rand(s) * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}
const pick = <T>(s: GameState, arr: T[]) => arr[Math.floor(rand(s) * arr.length)];

// ---------------- Utilidades ----------------
let uidCounter = 1;
const log = (s: GameState, t: string, p?: number) => { s.logN = (s.logN ?? 0) + 1; s.log.push({ t, p, n: s.logN }); if (s.log.length > 300) s.log.shift(); };
export const cur = (s: GameState) => s.players[s.current];
export const nombreDe = (s: GameState, i: number) => s.players[i].nombre;
export const rivales = (s: GameState, i: number) => s.players.map((_, k) => k).filter(k => k !== i);
export const totalGolpe = (p: Player) => Object.values(p.equipo).reduce((a, e) => a + (e ? e.golpe : 0), 0);
export const limiteMano = (p: Player) => (p.equipo.prenda?.nombre === 'Carriel' ? 12 : 10);
export const nombreCarta = (c: MorralCard) => (c.kind === 'exag' ? exag(c.id).nombre : c.nombre);
const habilidadesBloqueadas = (s: GameState) => s.gato;
export function pasivaApoyo(p: Player, id: ApoyoId): boolean { return p.apoyo === id || (p.apoyo === 'edilberto' && p.copiaApoyo === id); }
const sumaRes = (p: Player) => p.mat.G + p.mat.M + p.mat.B;

function crearMorral(s: GameState): MorralCard[] {
  const out: MorralCard[] = [];
  for (const e of EQUIPO) for (let i = 0; i < e.copias; i++) out.push({ uid: uidCounter++, kind: 'equipo', nombre: e.nombre, slot: e.slot, golpe: e.golpe, img: e.img, nota: e.nota });
  for (const c of COMIDA) for (let i = 0; i < c.copias; i++) out.push({ uid: uidCounter++, kind: 'comida', nombre: c.nombre, tipo: c.tipo, img: c.img });
  for (const x of EXAGERACIONES) for (let i = 0; i < x.copias; i++) out.push({ uid: uidCounter++, kind: 'exag', id: x.id });
  return shuffle(s, out);
}

function robarMorral(s: GameState): MorralCard | null {
  if (!s.morral.length) { s.morral = shuffle(s, s.morralDescarte); s.morralDescarte = []; }
  return s.morral.pop() ?? null;
}
function darMorral(s: GameState, p: Player, n = 1) { for (let i = 0; i < n; i++) { const c = robarMorral(s); if (c) p.mano.push(c); } }
/**
 * Guacas: son cartas del mazo de Guacas (equipo, comida y exageraciones paisas) que llegan a la mano.
 * p.guacas lleva la cuenta de cuántas ha encontrado el jugador en la partida.
 */
function darGuacas(s: GameState, p: Player, n: number) {
  if (n <= 0) return;
  const antes = p.mano.length; darMorral(s, p, n);
  const nuevas = p.mano.slice(antes);
  p.guacas += nuevas.length;
  if (nuevas.length) log(s, `${p.nombre} recibe ${nuevas.length} guaca${nuevas.length === 1 ? '' : 's'}.`, p.id);
}
function robarMonte(s: GameState): MonteCard | null {
  if (!s.monte.length) { s.monte = shuffle(s, s.monteDescarte); s.monteDescarte = []; }
  return s.monte.pop() ?? null;
}
function robarHerramienta(s: GameState): ToolId | null {
  if (!s.herramientas.length) { s.herramientas = shuffle(s, s.herramientasDescarte); s.herramientasDescarte = []; }
  return s.herramientas.pop() ?? null;
}
function reponerHerramientas(s: GameState) {
  while (s.reveladas.length < 3) { const t = robarHerramienta(s); if (!t) break; s.reveladas.push(t); }
}

export function valorCarta(p: Player, c: MorralCard): number {
  if (c.kind === 'exag') return c.id === 'mama' ? 5 : 3;
  if (c.kind === 'comida') return c.tipo === 'alimento' ? 1.5 : 2.2;
  const eq = p.equipo[c.slot];
  return !eq || c.golpe > eq.golpe ? 2 + c.golpe : 0.5;
}
function quitarPeorCarta(s: GameState, p: Player, aDescarte = true): MorralCard | null {
  if (!p.mano.length) return null;
  let idx = 0;
  p.mano.forEach((c, i) => { if (valorCarta(p, c) < valorCarta(p, p.mano[idx])) idx = i; });
  const [c] = p.mano.splice(idx, 1);
  if (aDescarte) s.morralDescarte.push(c);
  return c;
}
function quitarAlAzar(s: GameState, p: Player): MorralCard | null {
  if (!p.mano.length) return null;
  const [c] = p.mano.splice(Math.floor(rand(s) * p.mano.length), 1);
  return c;
}
function materialMasAbundante(p: Player): MaterialId | null {
  const ks = (['G', 'M', 'B'] as MaterialId[]).filter(k => p.mat[k] > 0);
  if (!ks.length) return null;
  return ks.sort((a, b) => p.mat[b] - p.mat[a])[0];
}
function quitarMaterial(s: GameState, p: Player, n: number) {
  for (let i = 0; i < n; i++) { const k = materialMasAbundante(p); if (!k) return; p.mat[k]--; log(s, `${p.nombre} pierde 1 ${MATERIALES[k].nombre}.`, p.id); }
}
function siguienteEdificio(p: Player): BuildingId | null { return ORDEN_EDIFICIOS.find(b => !p.edificios[b]) ?? null; }
export function edificiosOk(p: Player) { return ORDEN_EDIFICIOS.filter(b => p.edificios[b] === 'ok').length; }

// ---------------- Creación ----------------
export interface SetupPlayer { nombre: string; personaje: CharacterId; ia: boolean }
export function crearPartida(config: SetupPlayer[], seed = Date.now() % 2147483647): GameState {
  const s: GameState = {
    version: 1, seed, players: [], current: 0, firstPlayer: 0, turnsInRound: 0, round: 1, phase: 'plaza',
    monte: [], monteDescarte: [], morral: [], morralDescarte: [], herramientas: [], herramientasDescarte: [], reveladas: [],
    apoyosRevelados: [], eventos: [], evento: null, gato: false, combat: null, queue: [], log: [], winner: null,
    turn: nuevoTurno(), lastMonte: null, anuncio: null,
  };
  // Monte: 27 mitos fijos + 3 ancestrales al azar + 20 dichos
  const anc = shuffle(s, MITOS.filter(m => m.tier === 'ancestral').map(m => m.id)).slice(0, 3);
  for (const m of MITOS) {
    if (m.tier === 'ancestral' && !anc.includes(m.id)) continue;
    for (let i = 0; i < m.copias; i++) s.monte.push({ uid: uidCounter++, kind: 'mito', id: m.id });
  }
  for (const dd of DICHOS) s.monte.push({ uid: uidCounter++, kind: 'dicho', id: dd.id });
  shuffle(s, s.monte);
  s.morral = crearMorral(s);
  s.herramientas = shuffle(s, (['puntilla', 'martillo', 'serrucho'] as ToolId[]).flatMap(t => [t, t, t, t, t]));
  reponerHerramientas(s);
  s.eventos = shuffle(s, EVENTOS.map(e => e.id));
  config.forEach((c, i) => {
    s.players.push({
      id: i, nombre: c.nombre, personaje: c.personaje, ia: c.ia, color: COLORES[i], oro: INICIO.oro, guacas: 0,
      mat: { G: INICIO.materiales, M: INICIO.materiales, B: INICIO.materiales }, tools: { puntilla: 0, martillo: 0, serrucho: 0 }, mano: [], equipo: {}, edificios: {},
      apoyo: null, apoyoNuevo: false, copiaApoyo: null, guardados: [], saltaPlaza: false, saltaMonte: false, pierdeTurno: false,
      marrano: false, tamalDe: null,
    });
  });
  for (const p of s.players) darMorral(s, p, INICIO.cartas);
  revelarApoyos(s);
  // Orden: cada jugador tira un D6 desde su celular; los empates vuelven a tirar
  s.ordenTiradas = {};
  log(s, 'Cada jugador tira un D6: el que saque más empieza.');
  for (const p of s.players) pedirTiradaOrden(s, p.id, false);
  return s;
}
function pedirTiradaOrden(s: GameState, id: number, desempate: boolean) {
  push(s, { kind: 'orden', player: id, title: desempate ? '¡Empate! Vuelve a tirar el dado' : 'Tira el dado para el orden de turnos',
    text: 'El que saque más empieza; luego siguen de mayor a menor.', options: [{ id: 'tirar', label: 'Tirar el D6' }] });
}
const cmpTiradas = (a: number[], b: number[]) => { for (let k = 0; k < Math.max(a.length, b.length); k++) { const d1 = (a[k] ?? 0) - (b[k] ?? 0); if (d1) return d1; } return 0; };
function resolverOrden(s: GameState) {
  const t = s.ordenTiradas!;
  const ids = s.players.map(p => p.id);
  const empatados = ids.filter(i => ids.some(j => j !== i && cmpTiradas(t[i], t[j]) === 0));
  if (empatados.length) {
    log(s, `Empate entre ${empatados.map(i => nombreDe(s, i)).join(' y ')}: vuelven a tirar.`);
    for (const i of empatados) pedirTiradaOrden(s, i, true);
    return;
  }
  s.orden = [...ids].sort((a, b) => cmpTiradas(t[b], t[a]));
  s.firstPlayer = s.orden[0]; s.current = s.orden[0];
  const nombres = s.orden.map(i => nombreDe(s, i));
  log(s, `Orden de turnos: ${nombres.join(' → ')}.`);
  s.anuncio = { titulo: 'Orden de turnos', texto: nombres.map((n, k) => `${k + 1}. ${n}`).join('   ') };
  iniciarTurno(s);
}
/** Orden de turnos (partidas viejas sin tirada: por asiento). */
export const ordenDe = (s: GameState) => s.orden ?? s.players.map(p => p.id);
const siguienteEnOrden = (s: GameState, id: number) => { const o = ordenDe(s); return o[(o.indexOf(id) + 1) % o.length]; };
function nuevoTurno(): TurnFlags {
  return { intercambios: 0, mainUsada: false, apoyoUsada: false, compras: 0, construcciones: 0, tallerExtra: false,
    monteHecho: false, vendioPrimera: false, claudia: null, guacaErrantes: false, exagJugadas: 0 };
}
function revelarApoyos(s: GameState) {
  const tomados = new Set(s.players.map(p => p.apoyo).filter(Boolean));
  const libres = shuffle(s, APOYOS.map(a => a.id).filter(id => !tomados.has(id)));
  s.apoyosRevelados = libres.slice(0, s.players.length + 1);
}

// ---------------- Turnos ----------------
function iniciarTurno(s: GameState) {
  const p = cur(s);
  s.turn = nuevoTurno();
  s.combat = null; s.lastMonte = null;
  if (p.pierdeTurno) {
    p.pierdeTurno = false; log(s, `${p.nombre} pierde este turno (La Llorona).`, p.id);
    finTurno(s); return;
  }
  s.phase = 'plaza';
  log(s, `— Turno de ${p.nombre} —`, p.id);
  if (p.saltaPlaza) { p.saltaPlaza = false; log(s, `${p.nombre} está enguayabado y se salta la Plaza.`, p.id); entrarMonte(s); return; }
  entrarPlaza(s);
}
function entrarPlaza(s: GameState) {
  const p = cur(s);
  if (p.apoyo && !p.apoyoNuevo) {
    if (p.oro >= 1) push(s, { kind: 'mantener', player: p.id, title: `Mantener a ${apoyo(p.apoyo).nombre}`, text: 'Pagar 1 oro para conservarlo este turno.', img: apoyo(p.apoyo).img,
      options: [{ id: 'si', label: 'Pagar 1 oro' }, { id: 'no', label: 'Dejarlo ir' }] });
    else { log(s, `${p.nombre} no puede pagar a ${apoyo(p.apoyo).nombre}, que vuelve a la Plaza.`, p.id); p.apoyo = null; p.copiaApoyo = null; }
  }
  p.apoyoNuevo = false;
  robarEnPlaza(s);
}
function robarEnPlaza(s: GameState) {
  const p = cur(s);
  if (pasivaApoyo(p, 'chapolera') && !habilidadesBloqueadas(s)) {
    const a = robarMorral(s), b = robarMorral(s);
    const cs = [a, b].filter(Boolean) as MorralCard[];
    if (cs.length === 2) {
      push(s, { kind: 'chapolera', player: p.id, title: 'La Chapolera: elige 1 carta', data: { cartas: cs },
        options: cs.map(c => ({ id: String(c.uid), label: nombreCarta(c), img: imgCarta(c) })) });
      return;
    }
    cs.forEach(c => p.mano.push(c));
  } else darMorral(s, p, 1);
}
export function imgCarta(c: MorralCard): string | undefined { return c.kind === 'exag' ? undefined : c.img; }

function entrarMonte(s: GameState) {
  s.phase = 'monte';
  const p = cur(s);
  if (p.saltaMonte) { p.saltaMonte = false; s.turn.monteHecho = true; log(s, `${p.nombre} se salta el Monte este turno.`, p.id); }
}
function entrarTaller(s: GameState) { s.phase = 'taller'; }
function entrarCampo(s: GameState) {
  s.phase = 'campo';
  const p = cur(s);
  if (s.evento === 'sequia') { log(s, 'Sequía: no hay cosecha.', p.id); return; }
  let c = 1 + edificiosOk(p);
  if (s.evento === 'cosecha') c *= 2;
  p.oro += c; log(s, `${p.nombre} cosecha ${c} oro.`, p.id);
}
function finTurno(s: GameState) {
  const p = cur(s);
  const lim = limiteMano(p);
  if (p.mano.length > lim) {
    push(s, { kind: 'limite', player: p.id, title: `Límite de mano: descarta ${p.mano.length - lim}`, text: `Puedes tener ${lim} cartas.`,
      options: p.mano.map(c => ({ id: String(c.uid), label: nombreCarta(c), img: imgCarta(c) })) });
    return;
  }
  p.marrano = false;
  s.turnsInRound++;
  if (s.turnsInRound >= s.players.length) finRonda(s);
  else s.current = siguienteEnOrden(s, s.current);
  iniciarTurno(s);
}
function finRonda(s: GameState) {
  s.turnsInRound = 0;
  s.herramientasDescarte.push(...s.reveladas); s.reveladas = []; reponerHerramientas(s);
  revelarApoyos(s);
  // El orden de turnos es fijo toda la partida (el que sacó más en el D6 empieza cada ronda)
  s.firstPlayer = ordenDe(s)[0]; s.current = s.firstPlayer;
  s.round++; s.gato = false; s.evento = null;
  log(s, `===== Ronda ${s.round} =====`);
  if (s.round > 1 && s.round % 3 === 1) {
    if (!s.eventos.length) s.eventos = shuffle(s, EVENTOS.map(e => e.id));
    const e = s.eventos.pop()!; s.evento = e;
    const ev = evento(e);
    log(s, `Evento: ${ev.nombre}. ${ev.texto}`);
    s.anuncio = { titulo: `Evento: ${ev.nombre}`, texto: ev.texto, img: 'cartas/ilustracion-eventos' };
    if (e === 'chequeo' || e === 'lluvia') for (const p of s.players) { const k = (['G', 'M', 'B'] as MaterialId[])[d(s, 3) - 1]; p.mat[k]++; }
    if (e === 'vendimia') for (const p of s.players) { p.oro += 2; darMorral(s, p, 1); }
    if (e === 'robo') { const max = Math.max(...s.players.map(p => p.oro)); const r = s.players.find(p => p.oro === max)!; r.oro = Math.max(0, r.oro - 3); log(s, `${r.nombre} pierde 3 oro.`, r.id); }
  }
}

// ---------------- Victoria ----------------
export function cumpleVictoria(p: Player) {
  return ORDEN_EDIFICIOS.every(b => p.edificios[b] === 'ok') && p.mano.some(c => c.kind === 'comida') && p.oro >= 1;
}
function revisarVictoria(s: GameState) {
  if (s.winner !== null) return;
  const p = cur(s);
  if (cumpleVictoria(p)) { s.winner = p.id; s.phase = 'fin'; s.queue = []; log(s, `¡${p.nombre} es el Gran Fundador del Quindío!`, p.id); }
}

// ---------------- Cola de decisiones ----------------
function push(s: GameState, pnd: Pending) { s.queue.push(pnd); }
export const pendiente = (s: GameState) => s.queue[0] ?? null;

// ---------------- Precios ----------------
export function precioHerramienta(s: GameState, p: Player, t: ToolId) {
  let v = HERRAMIENTAS[t].precio;
  if (p.personaje === 'fernando' && !habilidadesBloqueadas(s)) v -= 1;
  if (s.evento === 'reforma') v -= 1;
  if (s.evento === 'rebaja') v = Math.max(2, v - 2);
  return Math.max(1, v);
}
export function precioMaterial(s: GameState, p: Player) {
  if (s.evento === 'lluvia') return 1;
  if (pasivaApoyo(p, 'polonio') && !habilidadesBloqueadas(s)) return 1;
  return 2;
}
export function precioApoyo(s: GameState) { return s.evento === 'chequeo' ? 1 : 3; }
export function maxCompras(s: GameState) { return (s.evento === 'reforma' ? 2 : 1); }
export function maxIntercambios(s: GameState, p: Player) { return p.personaje === 'jose-maria' && !habilidadesBloqueadas(s) ? 2 : 1; }
export function valorVenta(s: GameState, p: Player, item: { k: 'mat' } | { k: 'tool'; id: ToolId } | { k: 'carta'; c: MorralCard }): number {
  let v = 0;
  const clem = p.personaje === 'clementina' && !habilidadesBloqueadas(s);
  if (item.k === 'mat') v = 1 + (clem ? 1 : 0);
  else if (item.k === 'tool') v = Math.floor(HERRAMIENTAS[item.id].precio / 2);
  else if (item.c.kind === 'comida') v = VENTA_COMIDA[item.c.tipo] + (clem ? 1 : 0);
  else if (item.c.kind === 'equipo') v = Math.max(1, Math.ceil(item.c.golpe / 2)); // el equipo vale según su golpe
  else v = 0;
  if (s.evento === 'auge') v *= 2;
  return v;
}

// ---------------- Construcción ----------------
export function requisitos(s: GameState, p: Player, b: BuildingId) {
  const def = EDIFICIOS[b];
  const guacas = 0; void def;
  const faltanTools = def.herramientas.filter(t => p.tools[t] < 1);
  const comodin = p.mano.find(c => c.kind === 'exag' && c.id === 'mama');
  const toolsOk = faltanTools.length === 0 || (faltanTools.length === 1 && !!comodin);
  const matsOk = p.mat.G >= 1 && p.mat.M >= 1 && p.mat.B >= 1;
  return { guacas, faltanTools, comodin, toolsOk, matsOk, guacasOk: true, ok: toolsOk && matsOk };
}
export function puedeConstruir(s: GameState) {
  const p = cur(s);
  const b = siguienteEdificio(p);
  if (!b || s.phase !== 'taller') return null;
  if (s.turn.construcciones >= 1 + (s.turn.tallerExtra ? 1 : 0)) return null;
  const r = requisitos(s, p, b);
  return r.ok ? b : null;
}

// ---------------- Combate ----------------
export function ataqueMito(s: GameState, c: Combat) {
  let a = mito(c.mitoId).ataque;
  if (s.evento === 'zorros') a += 2;
  if (s.evento === 'madremonte') a += 3;
  if (c.bizco) a *= 2;
  return a + (c.sabotage?.d8 ?? 0);
}
export function dadosUsados(c: Combat) {
  if (c.dice.length === 3) { const s = [...c.dice].sort((a, b) => b - a); return s.slice(0, 2); }
  return c.dice;
}
export function bonoComida(s: GameState, p: Player, c: Combat) {
  if (!c.food) return 0;
  let v = c.food.d8;
  if (c.food.tipo === 'licor' && pasivaApoyo(p, 'genovevo') && !habilidadesBloqueadas(s)) v += 1;
  if (c.food.tipo === 'carne' && pasivaApoyo(p, 'benancio') && !habilidadesBloqueadas(s)) v += 1;
  return v;
}
export function poderJugador(s: GameState, c: Combat) {
  const p = s.players[c.fighter];
  return dadosUsados(c).reduce((a, b) => a + b, 0) + totalGolpe(p) + c.bonus + bonoComida(s, p, c) + (c.respuesta?.d8 ?? 0);
}
/** Probabilidad aproximada de vencer (para IA y ayuda en pantalla). */
export function probVictoria(s: GameState, p: Player, ataque: number, extraBonus = 0, conComida = false): number {
  const wilson = p.personaje === 'wilson' && !habilidadesBloqueadas(s);
  const base = totalGolpe(p) + extraBonus;
  let win = 0, tot = 0;
  const caras = [1, 2, 3, 4, 5, 6];
  const comidas = conComida ? [1, 2, 3, 4, 5, 6, 7, 8] : [0];
  for (const a of caras) for (const b of caras) for (const c of (wilson ? caras : [0])) for (const f of comidas) {
    const ds = wilson ? [a, b, c].sort((x, y) => y - x).slice(0, 2) : [a, b];
    tot++; if (ds[0] + ds[1] + base + f >= ataque) win++;
  }
  return win / tot;
}

function iniciarCombate(s: GameState, fighter: number, mitoId: string, source: 'monte' | 'ocasion', noFlee = false) {
  const m = mito(mitoId);
  s.combat = { fighter, mitoId, source, tier: m.tier, step: 'decidir', dice: [], bonus: 0, food: null, sabotage: null, bizco: false,
    noFlee: noFlee || source === 'ocasion', reactQueue: [], winQueue: [], result: null, reward: null, wilsonUsado: false };
  log(s, `${nombreDe(s, fighter)} enfrenta a ${m.nombre} (ataque ${m.ataque}).`, fighter);
}
function tirarCombate(s: GameState) {
  const c = s.combat!; const p = s.players[c.fighter];
  const n = p.personaje === 'wilson' && !habilidadesBloqueadas(s) ? 3 : 2;
  c.dice = Array.from({ length: n }, () => d(s, 6));
  c.step = 'tirada';
  log(s, `${p.nombre} lanza ${c.dice.join(' + ')}${n === 3 ? ' (descarta el más bajo)' : ''}.`, p.id);
}
function abrirReacciones(s: GameState) {
  const c = s.combat!;
  c.step = 'rivales';
  const order: number[] = [];
  for (let k = 1; k < s.players.length; k++) order.push((c.fighter + k) % s.players.length);
  c.reactQueue = order;
  siguienteReaccion(s);
}
function opcionesReaccion(s: GameState, i: number): Option[] {
  const c = s.combat!; const r = s.players[i];
  const ops: Option[] = [];
  if (!c.sabotage) {
    const vistos = new Set<string>();
    for (const card of r.mano) {
      if (card.kind === 'comida' && !vistos.has(card.tipo)) { vistos.add(card.tipo); ops.push({ id: `food:${card.uid}`, label: `Sabotear con ${card.nombre}`, detail: '+D8 al ataque del mito', img: card.img }); }
      if (card.kind === 'exag' && card.id === 'perro') ops.push({ id: `perro:${card.uid}`, label: exag('perro').nombre, detail: '+D8 al mito sin gastar comida' });
    }
  }
  if (!c.bizco) { const b = r.mano.find(x => x.kind === 'exag' && x.id === 'bizco'); if (b) ops.push({ id: `bizco:${b.uid}`, label: exag('bizco').nombre, detail: 'Duplica ataque y recompensa' }); }
  return ops;
}
/** Tras un sabotaje (o «Bizco»), quien pelea puede responder una vez por combate. Devuelve true si quedó esperando la respuesta. */
function pedirRespuesta(s: GameState, autor: number): boolean {
  const c = s.combat!; const f = s.players[c.fighter];
  if (c.respuesta) return false;
  const ops: Option[] = [];
  const vistos = new Set<string>();
  for (const card of f.mano) {
    if (card.kind === 'comida' && !vistos.has(card.nombre)) { vistos.add(card.nombre); ops.push({ id: `resp:${card.uid}`, label: `Responder con ${card.nombre}`, detail: card.tipo === 'licor' ? '+D8 a tu poder (si pierdes, te enguayabas)' : '+D8 a tu poder', img: card.img }); }
  }
  const lora = f.mano.find(x => x.kind === 'exag' && x.id === 'lora');
  if (lora && Math.min(...c.dice) < 6) ops.push({ id: `lora:${lora.uid}`, label: exag('lora').nombre, detail: 'Tu dado más bajo pasa a 6' });
  if (!ops.length) return false;
  const poder = poderJugador(s, c), ataque = ataqueMito(s, c);
  push(s, { kind: 'respuesta', player: c.fighter, title: `¡${nombreDe(s, autor)} te sabotea! ¿Respondes?`,
    text: `Ahora tienes ${poder} contra ${ataque} de ${mito(c.mitoId).nombre}.`, img: `mitos/${c.mitoId}`,
    options: [...ops, { id: 'pasar', label: 'No responder' }] });
  return true;
}
function siguienteReaccion(s: GameState) {
  const c = s.combat!;
  while (c.reactQueue.length) {
    const i = c.reactQueue.shift()!;
    const ops = opcionesReaccion(s, i);
    if (!ops.length) continue;
    const poder = poderJugador(s, c), ataque = ataqueMito(s, c);
    push(s, { kind: 'reaccion', player: i, title: `${nombreDe(s, i)}: ¿intervienes en el combate?`,
      text: `${nombreDe(s, c.fighter)} tiene ${poder} contra ${ataque} de ${mito(c.mitoId).nombre}.`, img: `mitos/${c.mitoId}`,
      options: [...ops, { id: 'pasar', label: 'No intervenir' }] });
    return;
  }
  resolverCombate(s);
}
function resolverCombate(s: GameState) {
  const c = s.combat!; const p = s.players[c.fighter];
  const poder = poderJugador(s, c), ataque = ataqueMito(s, c);
  const m = mito(c.mitoId);
  if (poder >= ataque) {
    c.result = 'gana';
    const rec = RECOMPENSA[m.tier];
    let oro = rec.oro, guacas = rec.guacas;
    if (s.evento === 'zorros' || s.evento === 'madremonte') oro *= 2;
    if (s.evento === 'madremonte') guacas += 1;
    if (c.bizco) { oro *= 2; guacas *= 2; }
    if (c.source === 'ocasion') oro *= 2;
    if (s.turn.claudia === 'doble') oro *= 2; else if (s.turn.claudia === 'mas1') oro += 1;
    if (c.fighter === s.current && s.turn.claudia) s.turn.claudia = null;
    c.reward = { oro, guacas };
    log(s, `¡${p.nombre} vence a ${m.nombre}! (${poder} contra ${ataque})`, p.id);
    c.step = 'victoria';
    c.winQueue = rivales(s, c.fighter);
    siguienteVictoria(s);
  } else {
    c.result = 'pierde';
    log(s, `${p.nombre} pierde contra ${m.nombre} (${poder} contra ${ataque}).`, p.id);
    if ((c.food?.tipo === 'licor' || c.respuesta?.licor) && !(pasivaApoyo(p, 'genovevo') && !habilidadesBloqueadas(s))) { p.saltaPlaza = true; log(s, `${p.nombre} queda enguayabado.`, p.id); }
    preguntarCastigo(s, c.fighter, m.castigo, m.nombre);
    terminarCombate(s);
  }
}
function siguienteVictoria(s: GameState) {
  const c = s.combat!;
  while (c.winQueue.length) {
    const i = c.winQueue.shift()!;
    const r = s.players[i];
    const ops: Option[] = [];
    const t = r.mano.find(x => x.kind === 'exag' && x.id === 'mato-tigre');
    const f = r.mano.find(x => x.kind === 'exag' && x.id === 'filo');
    if (t) ops.push({ id: `tigre:${t.uid}`, label: exag('mato-tigre').nombre, detail: 'Anula el oro y las guacas' });
    if (f && c.reward!.oro > 0) ops.push({ id: `filo:${f.uid}`, label: exag('filo').nombre, detail: `Te quedas con ${c.reward!.oro} oro` });
    if (!ops.length) continue;
    push(s, { kind: 'victoria-rival', player: i, title: `${nombreDe(s, i)}: ${nombreDe(s, c.fighter)} venció`,
      text: `Recompensa: ${c.reward!.oro} oro y ${c.reward!.guacas} guacas.`, options: [...ops, { id: 'pasar', label: 'Dejarlo cobrar' }] });
    return;
  }
  cobrarRecompensa(s);
}
function cobrarRecompensa(s: GameState) {
  const c = s.combat!; const p = s.players[c.fighter];
  const r = c.reward!;
  p.oro += r.oro;
  if (r.oro) log(s, `${p.nombre} gana ${r.oro} oro.`, p.id);
  darGuacas(s, p, r.guacas);
  // material
  if (pasivaApoyo(p, 'tulio') && !habilidadesBloqueadas(s) && !p.ia) {
    push(s, { kind: 'material-gratis', player: p.id, title: 'Tulio: elige tu material', options: matOptions() });
  } else {
    let k: MaterialId;
    if (pasivaApoyo(p, 'tulio') && !habilidadesBloqueadas(s)) k = materialQueFalta(p);
    else { const r6 = d(s, 6); k = r6 <= 2 ? 'G' : r6 <= 4 ? 'M' : 'B'; }
    p.mat[k]++; log(s, `${p.nombre} recoge 1 ${MATERIALES[k].nombre}.`, p.id);
  }
  // Jairo
  if (p.personaje === 'jairo' && c.fighter === s.current && !s.turn.mainUsada && !habilidadesBloqueadas(s)) {
    push(s, { kind: 'jairo', player: p.id, title: 'Don Jairo: ¿lanzar Intuición al vencer?', text: '6–5: +1 guaca · 4–3: +1 oro · 2: nada · 1: pierde 1 oro',
      options: [{ id: 'si', label: 'Lanzar D6' }, { id: 'no', label: 'No' }] });
  }
  terminarCombate(s);
}
export function materialQueFalta(p: Player): MaterialId {
  return (['G', 'M', 'B'] as MaterialId[]).sort((a, b) => p.mat[a] - p.mat[b])[0];
}
const matOptions = (): Option[] => (['G', 'M', 'B'] as MaterialId[]).map(k => ({ id: k, label: MATERIALES[k].nombre, img: MATERIALES[k].img }));
function terminarCombate(s: GameState) {
  const c = s.combat!;
  c.step = 'hecho';
  s.monteDescarte.push({ uid: uidCounter++, kind: 'mito', id: c.mitoId });
}

// ---------------- Castigos ----------------
function preguntarCastigo(s: GameState, i: number, castigo: Castigo, origen: string) {
  const p = s.players[i];
  if (p.guardados.includes('zorro')) {
    p.guardados.splice(p.guardados.indexOf('zorro'), 1);
    s.monteDescarte.push({ uid: uidCounter++, kind: 'dicho', id: 'zorro' });
    log(s, `${p.nombre} usa «Zorro viejo no cae en trampa» y evita el castigo.`, i); return;
  }
  const ops: Option[] = [{ id: 'aceptar', label: 'Aceptar el castigo' }];
  if (p.guardados.includes('mal-tiempo')) ops.push({ id: 'mal-tiempo', label: 'Usar «A mal tiempo, buena cara»' });
  const comida = p.mano.find(c => c.kind === 'comida');
  if (p.personaje === 'claudia' && comida && !habilidadesBloqueadas(s)) ops.push({ id: 'claudia', label: 'Remedios de Monte: descartar 1 comida' });
  if (ops.length === 1) { aplicarCastigo(s, i, castigo); return; }
  push(s, { kind: 'castigo', player: i, title: `Castigo de ${origen}`, text: textoCastigo(castigo), data: { castigo }, options: ops });
}
const textoCastigo = (c: Castigo) => MITOS.find(m => JSON.stringify(m.castigo) === JSON.stringify(c))?.texto ?? '';
function aplicarCastigo(s: GameState, i: number, c: Castigo) {
  const p = s.players[i];
  switch (c.t) {
    case 'descartaMano': for (let k = 0; k < c.n; k++) { const x = quitarPeorCarta(s, p); if (x) log(s, `${p.nombre} descarta ${nombreCarta(x)}.`, i); } break;
    case 'descartaComida': {
      const idx = p.mano.findIndex(x => x.kind === 'comida');
      if (idx >= 0) { const [x] = p.mano.splice(idx, 1); s.morralDescarte.push(x); log(s, `${p.nombre} descarta ${nombreCarta(x)}.`, i); }
      else { const x = quitarPeorCarta(s, p); if (x) log(s, `${p.nombre} descarta ${nombreCarta(x)}.`, i); }
      break;
    }
    case 'descartaMaterial': quitarMaterial(s, p, c.n); break;
    case 'descartaEquipo': {
      const slots = (Object.keys(p.equipo) as Slot[]).filter(k => p.equipo[k]);
      if (slots.length) { const k = slots.sort((a, b) => p.equipo[a]!.golpe - p.equipo[b]!.golpe)[0]; s.morralDescarte.push(p.equipo[k]!); log(s, `${p.nombre} pierde ${p.equipo[k]!.nombre}.`, i); delete p.equipo[k]; }
      break;
    }
    case 'descartaHerramienta': {
      const t = (['puntilla', 'martillo', 'serrucho'] as ToolId[]).find(k => p.tools[k] > 0);
      if (t) { p.tools[t]--; s.herramientasDescarte.push(t); log(s, `${p.nombre} pierde su ${HERRAMIENTAS[t].nombre}.`, i); } else quitarMaterial(s, p, 1);
      break;
    }
    case 'danaCasa': if (p.edificios.casa === 'ok') { p.edificios.casa = 'danada'; log(s, `La Casa de ${p.nombre} queda dañada.`, i); } break;
    case 'danaMejor': { const b = [...ORDEN_EDIFICIOS].reverse().find(x => p.edificios[x] === 'ok'); if (b) { p.edificios[b] = 'danada'; log(s, `${EDIFICIOS[b].nombre} de ${p.nombre} queda dañada.`, i); } break; }
    case 'saltaMonte': p.saltaMonte = true; log(s, `${p.nombre} se saltará el Monte.`, i); break;
    case 'descartaTodaMano': s.morralDescarte.push(...p.mano); log(s, `${p.nombre} descarta toda su mano (${p.mano.length}).`, i); p.mano = []; break;
    case 'entregaMejorEquipo': {
      const slots = (Object.keys(p.equipo) as Slot[]).filter(k => p.equipo[k]);
      if (!slots.length) break;
      const k = slots.sort((a, b) => p.equipo[b]!.golpe - p.equipo[a]!.golpe)[0];
      const eq = p.equipo[k]!; delete p.equipo[k];
      const otros = rivales(s, i).sort((a, b) => totalGolpe(s.players[a]) - totalGolpe(s.players[b]));
      const r = s.players[otros[0]];
      if (!r.equipo[eq.slot] || r.equipo[eq.slot]!.golpe < eq.golpe) { if (r.equipo[eq.slot]) r.mano.push(r.equipo[eq.slot]!); r.equipo[eq.slot] = eq; } else r.mano.push(eq);
      log(s, `${p.nombre} entrega ${eq.nombre} a ${r.nombre}.`, i); break;
    }
    case 'pierdeTurno': p.pierdeTurno = true; log(s, `${p.nombre} perderá su próximo turno.`, i); break;
    case 'reparteMano': {
      let k = 1;
      while (p.mano.length && k < s.players.length) { const r = s.players[(i - k + s.players.length) % s.players.length]; r.mano.push(p.mano.pop()!); k++; if (k >= s.players.length && p.mano.length) k = 1; }
      log(s, `${p.nombre} reparte su mano entre los rivales.`, i); break;
    }
    case 'danaTodos': for (const b of ORDEN_EDIFICIOS) if (p.edificios[b] === 'ok') p.edificios[b] = 'danada'; log(s, `Todos los edificios de ${p.nombre} quedan dañados.`, i); break;
    case 'descartaTodosMateriales': log(s, `${p.nombre} pierde todos sus materiales.`, i); p.mat = { G: 0, M: 0, B: 0 }; break;
  }
}

// ---------------- Dichos ----------------
function resolverDicho(s: GameState, id: DichoId) {
  const p = cur(s); const n = s.players.length;
  const dd = dicho(id);
  log(s, `Dicho: «${dd.nombre}»`, p.id);
  s.anuncio = { titulo: dd.nombre, texto: dd.texto, img: 'cartas/ilustracion-dichos' };
  const descartar = () => s.monteDescarte.push({ uid: uidCounter++, kind: 'dicho', id });
  if (dd.guardable) { p.guardados.push(id); log(s, `${p.nombre} guarda la carta.`, p.id); return; }
  descartar();
  switch (id) {
    case 'cria-fama': {
      p.oro += 2;
      const mitos = s.monteDescarte.filter(c => c.kind === 'mito');
      if (mitos.length) push(s, { kind: 'cria-fama', player: p.id, title: 'Elige el mito que queda encima del Monte',
        options: dedupe(mitos.map(c => ({ id: String(c.uid), label: mito((c as any).id).nombre, detail: `Ataque ${mito((c as any).id).ataque}`, img: `mitos/${(c as any).id}` }))) });
      break;
    }
    case 'herrero': for (const q of s.players) quitarMaterial(s, q, 1); break;
    case 'caballo': {
      const pool = s.morralDescarte.slice(-8);
      if (pool.length) push(s, { kind: 'tomar-descarte', player: p.id, title: 'Toma 1 guaca del descarte', options: pool.map(c => ({ id: String(c.uid), label: nombreCarta(c), img: imgCarta(c) })) });
      break;
    }
    case 'lobos': { const r = d(s, 6); log(s, `${p.nombre} saca ${r}.`, p.id); if (r >= 5) darGuacas(s, p, 1); break; }
    case 'abarca': for (const q of s.players) { const x = quitarPeorCarta(s, q); if (x) log(s, `${q.nombre} descarta ${nombreCarta(x)}.`, q.id); } break;
    case 'arbol': for (const q of s.players) { const r = d(s, 6); const g = r <= 2 ? 1 : r <= 4 ? 2 : 3; q.oro += g; log(s, `${q.nombre} saca ${r} y gana ${g} oro.`, q.id); } break;
    case 'fiesta': for (const k of rivales(s, p.id)) { const x = quitarPeorCarta(s, p, false); if (x) { s.players[k].mano.push(x); log(s, `${p.nombre} regala ${nombreCarta(x)} a ${nombreDe(s, k)}.`, p.id); } } break;
    case 'gato': s.gato = true; log(s, 'Nadie puede usar habilidades de personajes hasta el final de la ronda.'); break;
    case 'pollo': {
      const dados: { from: number; eq: MorralCard & { kind: 'equipo' } }[] = [];
      for (const q of s.players) {
        const slots = (Object.keys(q.equipo) as Slot[]).filter(k => q.equipo[k]);
        if (!slots.length) continue;
        const k = slots.sort((a, b) => q.equipo[b]!.golpe - q.equipo[a]!.golpe)[0];
        dados.push({ from: q.id, eq: q.equipo[k]! }); delete q.equipo[k];
      }
      const eqs = shuffle(s, dados.map(x => x.eq));
      dados.forEach((x, k) => { const q = s.players[x.from]; const e = eqs[k]; if (!q.equipo[e.slot]) q.equipo[e.slot] = e; else q.mano.push(e); log(s, `${q.nombre} recibe ${e.nombre}.`, q.id); });
      break;
    }
    case 'mal-que': {
      const cs = s.monte.slice(-n);
      if (cs.length > 1) push(s, { kind: 'mal-que', player: p.id, title: 'Elige la carta que queda encima del Monte', options: cs.map(c => ({ id: String(c.uid), label: c.kind === 'mito' ? mito(c.id).nombre : dicho(c.id).nombre, img: c.kind === 'mito' ? `mitos/${c.id}` : undefined, detail: c.kind === 'mito' ? `Mito · ataque ${mito(c.id).ataque}` : 'Dicho' })) });
      break;
    }
    case 'llora': {
      const cs: MorralCard[] = []; for (let k = 0; k < n; k++) { const c = robarMorral(s); if (c) cs.push(c); }
      const orden = Array.from({ length: n }, (_, k) => (p.id + k) % n);
      siguienteLlora(s, cs, orden);
      break;
    }
    case 'dime': {
      const ops = rivales(s, p.id).filter(k => s.players[k].mano.length).map(k => ({ id: String(k), label: nombreDe(s, k), detail: `${s.players[k].mano.length} cartas` }));
      if (ops.length) push(s, { kind: 'robar-a', player: p.id, title: '¿A quién le robas una carta?', options: ops });
      break;
    }
    case 'palo': {
      let best = -1, who = 0;
      for (const q of s.players) { const r = d(s, 6); log(s, `${q.nombre} saca ${r}.`, q.id); if (r > best) { best = r; who = q.id; } }
      const q = s.players[who];
      const poder = d(s, 6) + d(s, 6) + totalGolpe(q);
      if (poder >= 6) { q.oro += 3; log(s, `${q.nombre} pelea (${poder} contra 6) y gana 3 oro.`, who); darGuacas(s, q, 1); }
      else log(s, `${q.nombre} pelea (${poder} contra 6) y pierde, sin castigo.`, who);
      break;
    }
    case 'borrachos': {
      const pasa = s.players.map(q => { const a = quitarAlAzar(s, q); const b = quitarAlAzar(s, q); return [a, b].filter(Boolean) as MorralCard[]; });
      s.players.forEach((q, k) => { const der = s.players[(k - 1 + n) % n]; der.mano.push(...pasa[k]); });
      log(s, 'Todos pasan 2 cartas al jugador de la derecha.');
      break;
    }
    case 'gratis': for (const q of s.players) { darMorral(s, q, 1); q.oro += 1; } log(s, 'Todos roban 1 carta y ganan 1 oro.'); break;
    case 'consejos': {
      if (p.mano.length) push(s, { kind: 'consejos-carta', player: p.id, title: 'Descarta 1 carta de tu mano', options: [...p.mano.map(c => ({ id: String(c.uid), label: nombreCarta(c), img: imgCarta(c) })), { id: 'no', label: 'No usar' }] });
      break;
    }
    case 'ocasion': {
      const mitos = s.monteDescarte.filter(c => c.kind === 'mito');
      if (mitos.length) push(s, { kind: 'ocasion', player: p.id, title: 'Elige un mito del descarte para pelear (doble oro)',
        options: dedupe(mitos.map(c => ({ id: String(c.uid), label: mito((c as any).id).nombre, detail: `Ataque ${mito((c as any).id).ataque}`, img: `mitos/${(c as any).id}` }))) });
      break;
    }
  }
}
function dedupe(ops: Option[]): Option[] { const seen = new Set<string>(); return ops.filter(o => (seen.has(o.label) ? false : (seen.add(o.label), true))); }
function siguienteLlora(s: GameState, cartas: MorralCard[], orden: number[]) {
  if (!cartas.length || !orden.length) { s.morralDescarte.push(...cartas); return; }
  const who = orden[0];
  push(s, { kind: 'llora', player: who, title: `${nombreDe(s, who)}: toma una carta`, data: { cartas, orden },
    options: cartas.map(c => ({ id: String(c.uid), label: nombreCarta(c), img: imgCarta(c) })) });
}

// ---------------- Habilidades ----------------
function rollHabilidad(s: GameState, quien: string, p: Player) { const r = d(s, 6); log(s, `${p.nombre} lanza la habilidad de ${quien}: ${r}.`, p.id); return r; }
const nivel = (r: number) => (r >= 5 ? 0 : r >= 3 ? 1 : r === 1 ? 2 : -1); // índice en activa[]
function tomarDelDescarte(s: GameState, p: Player, filtro: (c: MorralCard) => boolean, n: number) {
  let tomadas = 0;
  for (let k = s.morralDescarte.length - 1; k >= 0 && tomadas < n; k--) {
    if (filtro(s.morralDescarte[k])) { const [c] = s.morralDescarte.splice(k, 1); p.mano.push(c); tomadas++; log(s, `${p.nombre} toma ${nombreCarta(c)} del descarte.`, p.id); }
  }
}
function descartarComida(s: GameState, p: Player) {
  const idx = p.mano.findIndex(c => c.kind === 'comida');
  if (idx >= 0) { const [c] = p.mano.splice(idx, 1); s.morralDescarte.push(c); log(s, `${p.nombre} descarta ${nombreCarta(c)}.`, p.id); }
}
function activaPersonaje(s: GameState, p: Player, id: CharacterId, r: number) {
  const lv = nivel(r);
  if (lv < 0) { log(s, 'Sin efecto.', p.id); return; }
  const ops = (f: (k: number) => boolean) => rivales(s, p.id).filter(f).map(k => ({ id: String(k), label: nombreDe(s, k) }));
  switch (id) {
    case 'jose-maria':
      if (lv === 0) { const o = ops(k => s.players[k].mano.length > 0); if (o.length) push(s, { kind: 'robar-a', player: p.id, title: '¿A quién le robas una carta?', options: o }); }
      else if (lv === 1) tomarDelDescarte(s, p, () => true, 1);
      else { const o = ops(() => true); if (p.mano.length) push(s, { kind: 'dar-carta', player: p.id, title: '¿A quién le das una carta?', options: o }); }
      break;
    case 'clementina':
      if (lv === 0) tomarDelDescarte(s, p, c => c.kind === 'comida', 2);
      else if (lv === 1) tomarDelDescarte(s, p, c => c.kind === 'comida', 1);
      else descartarComida(s, p);
      break;
    case 'fernando':
      if (lv === 0) {
        const o: Option[] = [];
        for (const k of ['G', 'M', 'B'] as MaterialId[]) if (p.mat[k] > 0) for (const t of ['puntilla', 'martillo'] as ToolId[]) o.push({ id: `${k}>${t}`, label: `${MATERIALES[k].nombre} → ${HERRAMIENTAS[t].nombre}`, img: HERRAMIENTAS[t].img });
        if (o.length) push(s, { kind: 'convertir', player: p.id, title: 'Convierte 1 material en herramienta', options: o });
      } else if (lv === 1) {
        const o = cambiosMaterial(p); if (o.length) push(s, { kind: 'cambiar-material', player: p.id, title: 'Cambia 1 material por otro', options: o });
      } else quitarMaterial(s, p, 1);
      break;
    case 'claudia':
      if (lv === 0) { s.turn.claudia = 'doble'; log(s, 'El próximo mito que venza este turno da el doble de oro.', p.id); }
      else if (lv === 1) { s.turn.claudia = 'mas1'; log(s, 'El próximo mito que venza este turno da +1 oro.', p.id); }
      else if (p.oro > 0) push(s, { kind: 'dar-oro', player: p.id, title: '¿A quién le das 1 oro?', options: ops(() => true) });
      break;
    case 'jairo':
      if (lv === 0) darGuacas(s, p, 1);
      else if (lv === 1) { p.oro++; log(s, `${p.nombre} gana 1 oro.`, p.id); }
      else { p.oro = Math.max(0, p.oro - 1); log(s, `${p.nombre} pierde 1 oro.`, p.id); }
      break;
    case 'wilson':
      if (s.combat && s.combat.step === 'decidir') { s.combat.bonus += lv === 0 ? 3 : lv === 1 ? 1 : -2; log(s, `Bono de golpe: ${s.combat.bonus >= 0 ? '+' : ''}${s.combat.bonus}.`, p.id); }
      break;
  }
}
function cambiosMaterial(p: Player): Option[] {
  const o: Option[] = [];
  for (const a of ['G', 'M', 'B'] as MaterialId[]) if (p.mat[a] > 0) for (const b of ['G', 'M', 'B'] as MaterialId[]) if (a !== b) o.push({ id: `${a}>${b}`, label: `${MATERIALES[a].nombre} → ${MATERIALES[b].nombre}`, img: MATERIALES[b].img });
  return o;
}
function activaApoyo(s: GameState, p: Player, r: number) {
  let lv = nivel(r);
  if (p.marrano) lv = r === 6 ? 0 : -1;
  if (lv < 0) { log(s, 'Sin efecto.', p.id); return; }
  switch (p.apoyo) {
    case 'chapolera':
      if (lv === 0) darMorral(s, p, 1); else if (lv === 1) tomarDelDescarte(s, p, () => true, 1); else { const x = quitarPeorCarta(s, p); if (x) log(s, `${p.nombre} descarta ${nombreCarta(x)}.`, p.id); }
      break;
    case 'tulio':
      if (lv === 0) push(s, { kind: 'material-gratis', player: p.id, title: 'Elige 1 material', options: matOptions() });
      else if (lv === 1) { const o = cambiosMaterial(p); if (o.length) push(s, { kind: 'cambiar-material', player: p.id, title: 'Cambia 1 material', options: o }); }
      else quitarMaterial(s, p, 1);
      break;
    case 'abuelo':
      if (lv === 0) { const cs = s.monte.slice(-3); if (cs.length > 1) push(s, { kind: 'mal-que', player: p.id, title: 'El Abuelo: elige la carta de arriba del Monte', options: cs.map(c => ({ id: String(c.uid), label: c.kind === 'mito' ? mito(c.id).nombre : dicho(c.id).nombre, img: c.kind === 'mito' ? `mitos/${c.id}` : undefined, detail: c.kind === 'mito' ? `Ataque ${mito(c.id).ataque}` : 'Dicho' })) }); }
      else if (lv === 1) { const c = s.monte[s.monte.length - 1]; if (c) push(s, { kind: 'info', player: p.id, title: 'El Abuelo te cuenta lo que viene', text: c.kind === 'mito' ? `${mito(c.id).nombre} (ataque ${mito(c.id).ataque})` : `Dicho: ${dicho(c.id).nombre}`, img: c.kind === 'mito' ? `mitos/${c.id}` : undefined, options: [{ id: 'ok', label: 'Entendido' }] }); }
      else { const x = quitarPeorCarta(s, p); if (x) log(s, `${p.nombre} descarta ${nombreCarta(x)}.`, p.id); }
      break;
    case 'genovevo':
      if (lv === 0) { tomarDelDescarte(s, p, c => c.kind === 'comida' && c.tipo === 'licor', 1); darMorral(s, p, 1); }
      else if (lv === 1) tomarDelDescarte(s, p, c => c.kind === 'comida', 1);
      else p.oro = Math.max(0, p.oro - 1);
      break;
    case 'benancio':
      if (lv === 0) tomarDelDescarte(s, p, c => c.kind === 'comida' && c.tipo === 'carne', 2);
      else if (lv === 1) tomarDelDescarte(s, p, c => c.kind === 'comida' && c.tipo === 'carne', 1);
      else descartarComida(s, p);
      break;
    case 'edilberto':
      if (lv === 0) {
        const o = rivales(s, p.id).filter(k => ['jose-maria', 'clementina', 'fernando', 'claudia'].includes(s.players[k].personaje))
          .map(k => ({ id: s.players[k].personaje, label: `${personaje(s.players[k].personaje).nombre}`, detail: personaje(s.players[k].personaje).activa[0] }));
        if (o.length) push(s, { kind: 'edilberto', player: p.id, title: 'Edilberto: ¿qué habilidad copias?', options: o });
        else darMorral(s, p, 1);
      } else if (lv === 1) darMorral(s, p, 1);
      else { const x = quitarPeorCarta(s, p); if (x) log(s, `${p.nombre} descarta ${nombreCarta(x)}.`, p.id); }
      break;
    case 'cura-audemio':
      if (lv === 0) darGuacas(s, p, 1); else if (lv === 1) p.oro++; else p.oro = Math.max(0, p.oro - 1);
      break;
    case 'polonio':
      if (lv === 0) p.oro += 2; else if (lv === 1) p.oro++; else p.oro = Math.max(0, p.oro - 1);
      break;
  }
}

// ---------------- Exageraciones ----------------
function jugarExagContra(s: GameState, autor: number, id: ExagId, objetivo: number, extra?: string) {
  const t = s.players[objetivo];
  const otro = t.mano.find(c => c.kind === 'exag' && c.id === 'otro-perro');
  if (otro && !extra?.startsWith('redir')) {
    const ops = rivales(s, objetivo).filter(k => k !== autor || true).map(k => ({ id: String(k), label: `Pasárselo a ${nombreDe(s, k)}` }));
    push(s, { kind: 'otro-perro', player: objetivo, title: `${t.nombre}: te atacan con «${exag(id).nombre}»`, text: 'Puedes usar «A otro perro con ese hueso».', data: { autor, id, extra },
      options: [...ops, { id: 'no', label: 'Recibir el efecto' }] });
    return;
  }
  efectoExag(s, autor, id, objetivo, extra?.replace(/^redir:?/, ''));
}
function efectoExag(s: GameState, autor: number, id: ExagId, objetivo: number, extra?: string) {
  const a = s.players[autor], t = s.players[objetivo];
  switch (id) {
    case 'bravo': aplicarCastigo(s, objetivo, { t: 'descartaEquipo' }); break;
    case 'lombriz': t.saltaMonte = true; log(s, `${t.nombre} se saltará el Monte.`, objetivo); break;
    case 'poncho': { const x = quitarAlAzar(s, t); if (x) { s.morralDescarte.push(x); log(s, `${t.nombre} descarta ${nombreCarta(x)}.`, objetivo); } a.oro++; break; }
    case 'marrano': t.marrano = true; log(s, `El apoyo de ${t.nombre} solo funcionará con 6.`, objetivo); break;
    case 'gorgojo': quitarMaterial(s, t, 1); break;
    case 'tamal': t.tamalDe = autor; log(s, `La próxima venta de ${t.nombre} será para ${a.nombre}.`, objetivo); break;
    case 'carro': {
      const b = (extra as BuildingId) || (['plaza', 'casa'] as BuildingId[]).find(x => t.edificios[x] === 'ok');
      if (b && t.edificios[b] === 'ok') { t.edificios[b] = 'danada'; log(s, `${EDIFICIOS[b].nombre} de ${t.nombre} queda dañada.`, objetivo); }
      break;
    }
    case 'aburrido': {
      const slot = (extra as Slot) || (['arma', 'prenda', 'montura'] as Slot[]).find(k => t.equipo[k] && a.equipo[k]);
      if (slot && t.equipo[slot] && a.equipo[slot]) { const x = t.equipo[slot]!; t.equipo[slot] = a.equipo[slot]; a.equipo[slot] = x; log(s, `${a.nombre} cambia su ${SLOT_NOMBRE[slot].toLowerCase()} con ${t.nombre}.`, autor); }
      break;
    }
  }
}
export function objetivosExag(s: GameState, autor: number, id: ExagId): number[] {
  const a = s.players[autor];
  return rivales(s, autor).filter(k => {
    const t = s.players[k];
    switch (id) {
      case 'bravo': return Object.values(t.equipo).some(Boolean);
      case 'aburrido': return (['arma', 'prenda', 'montura'] as Slot[]).some(x => t.equipo[x] && a.equipo[x]);
      case 'poncho': return t.mano.length > 0;
      case 'marrano': return !!t.apoyo;
      case 'gorgojo': return sumaRes(t) > 0;
      case 'carro': return t.edificios.casa === 'ok' || t.edificios.plaza === 'ok';
      default: return true;
    }
  });
}
export function exagJugable(s: GameState, uid: number): boolean {
  const p = cur(s); const c = p.mano.find(x => x.uid === uid);
  if (!c || c.kind !== 'exag' || s.queue.length || s.winner !== null) return false;
  const def = exag(c.id);
  if (def.momento === 'turno') {
    if (s.combat && s.combat.step !== 'hecho') return false;
    if (c.id === 'radio') return ORDEN_EDIFICIOS.some(b => p.edificios[b] === 'danada');
    return objetivosExag(s, p.id, c.id).length > 0;
  }
  if (def.momento === 'combate-propio') return !!s.combat && s.combat.step === 'tirada' && s.combat.fighter === p.id;
  return false;
}

// ---------------- Acciones válidas ----------------
export function puedeAvanzar(s: GameState): boolean {
  if (s.queue.length || s.winner !== null || s.anuncio) return false;
  if (s.phase === 'monte') return s.turn.monteHecho && (!s.combat || s.combat.step === 'hecho');
  return true;
}
export function mainDisponible(s: GameState): boolean {
  const p = cur(s);
  if (s.turn.mainUsada || habilidadesBloqueadas(s) || s.queue.length) return false;
  const m = personaje(p.personaje).momento;
  if (m === 'cualquiera') return !s.combat || s.combat.step === 'hecho';
  if (m === 'combate-antes') return !!s.combat && s.combat.step === 'decidir' && s.combat.fighter === p.id && !s.combat.wilsonUsado;
  return false;
}
export function apoyoDisponible(s: GameState): boolean {
  const p = cur(s);
  return !!p.apoyo && !s.turn.apoyoUsada && !habilidadesBloqueadas(s) && !s.queue.length && (!s.combat || s.combat.step === 'hecho');
}

// ---------------- Reducer ----------------
export function aplicar(prev: GameState, a: Action): GameState {
  const s = aplicarJugada(prev, a);
  if (s !== prev) s.paso = (prev.paso ?? 0) + 1;
  return s;
}
function aplicarJugada(prev: GameState, a: Action): GameState {
  const s: GameState = structuredClone(prev);
  if (s.winner !== null) return prev;
  if (a.t === 'cerrarAnuncio') { s.anuncio = null; return s; }
  const pnd = pendiente(s);
  if (pnd && a.t !== 'choose') return prev;
  const p = cur(s);
  switch (a.t) {
    case 'choose': if (!pnd || !pnd.options.some(o => o.id === a.id)) return prev; s.queue.shift(); resolverEleccion(s, pnd, a.id); break;
    case 'next': {
      if (!puedeAvanzar(s)) return prev;
      if (s.phase === 'plaza') entrarMonte(s);
      else if (s.phase === 'monte') entrarTaller(s);
      else if (s.phase === 'taller') entrarCampo(s);
      else if (s.phase === 'campo') finTurno(s);
      break;
    }
    case 'explorar': {
      if (s.phase !== 'monte' || s.turn.monteHecho) return prev;
      if (p.personaje === 'jairo' && !habilidadesBloqueadas(s)) {
        const top = s.monte[s.monte.length - 1] ?? (s.monte = shuffle(s, s.monteDescarte), s.monteDescarte = [], s.monte[s.monte.length - 1]);
        if (top) {
          const label = top.kind === 'mito' ? `${mito(top.id).nombre} (ataque ${mito(top.id).ataque})` : `Dicho: ${dicho(top.id).nombre}`;
          push(s, { kind: 'jairo-mira', player: p.id, title: 'Intuición Mítica: la carta de arriba es…', text: label, img: top.kind === 'mito' ? `mitos/${top.id}` : 'cartas/ilustracion-dichos',
            options: [{ id: 'dejar', label: 'Dejarla y robarla' }, { id: 'fondo', label: 'Ponerla al fondo (no podrás huir de la siguiente)' }] });
          break;
        }
      }
      explorar(s, false);
      break;
    }
    case 'pelear': { const c = s.combat; if (!c || c.step !== 'decidir' || c.fighter !== s.current) return prev; tirarCombate(s); break; }
    case 'huir': {
      const c = s.combat; if (!c || c.step !== 'decidir' || c.noFlee) return prev;
      const r = d(s, 6); const min = pasivaApoyo(p, 'abuelo') && !habilidadesBloqueadas(s) ? 4 : 5;
      if (r >= min) { c.result = 'escapa'; log(s, `${p.nombre} huye (saca ${r}) sin castigo.`, p.id); terminarCombate(s); }
      else { c.result = 'huye'; log(s, `${p.nombre} intenta huir y saca ${r}: no lo logra.`, p.id); preguntarCastigo(s, p.id, mito(c.mitoId).castigo, mito(c.mitoId).nombre); terminarCombate(s); }
      break;
    }
    case 'comida': {
      const c = s.combat; if (!c || c.step !== 'tirada' || c.food) return prev;
      const idx = p.mano.findIndex(x => x.uid === a.uid && x.kind === 'comida'); if (idx < 0) return prev;
      const [card] = p.mano.splice(idx, 1) as (MorralCard & { kind: 'comida' })[]; s.morralDescarte.push(card);
      c.food = { d8: d(s, 8), tipo: card.tipo, nombre: card.nombre };
      log(s, `${p.nombre} come ${card.nombre}: +${bonoComida(s, p, c)}.`, p.id);
      break;
    }
    case 'lora': {
      const c = s.combat; if (!c || c.step !== 'tirada') return prev;
      const idx = p.mano.findIndex(x => x.uid === a.uid && x.kind === 'exag' && x.id === 'lora'); if (idx < 0) return prev;
      s.morralDescarte.push(p.mano.splice(idx, 1)[0]);
      const min = c.dice.indexOf(Math.min(...c.dice)); c.dice[min] = 6;
      log(s, `${p.nombre} juega «Más cagao que parapeto de lora»: un dado pasa a 6.`, p.id);
      break;
    }
    case 'confirmar': { const c = s.combat; if (!c || c.step !== 'tirada') return prev; abrirReacciones(s); break; }
    case 'equipar': {
      const idx = p.mano.findIndex(x => x.uid === a.uid && x.kind === 'equipo'); if (idx < 0 || s.phase !== 'plaza') return prev;
      const [card] = p.mano.splice(idx, 1) as (MorralCard & { kind: 'equipo' })[];
      const old = p.equipo[card.slot]; if (old) s.morralDescarte.push(old);
      p.equipo[card.slot] = card; log(s, `${p.nombre} se equipa ${card.nombre} (+${card.golpe}).`, p.id);
      break;
    }
    case 'contratar': {
      if (s.phase !== 'plaza' || p.apoyo || s.evento === 'cierre' || !s.apoyosRevelados.includes(a.id) || p.oro < precioApoyo(s)) return prev;
      p.oro -= precioApoyo(s); p.apoyo = a.id; p.apoyoNuevo = false;
      s.apoyosRevelados = s.apoyosRevelados.filter(x => x !== a.id);
      log(s, `${p.nombre} contrata a ${apoyo(a.id).nombre}.`, p.id);
      if (a.id === 'edilberto') {
        const o = rivales(s, p.id).filter(k => s.players[k].apoyo && s.players[k].apoyo !== 'edilberto').map(k => ({ id: s.players[k].apoyo!, label: apoyo(s.players[k].apoyo!).nombre, detail: apoyo(s.players[k].apoyo!).pasiva }));
        if (o.length) push(s, { kind: 'edilberto-copia', player: p.id, title: 'Edilberto: ¿qué pasiva copias?', options: o });
      }
      break;
    }
    case 'soltarApoyo': if (!p.apoyo) return prev; log(s, `${p.nombre} deja ir a ${apoyo(p.apoyo).nombre}.`, p.id); p.apoyo = null; p.copiaApoyo = null; break;
    case 'guacaErrantes': if (s.evento !== 'errantes' || s.phase !== 'plaza' || s.turn.guacaErrantes || p.oro < 5) return prev; p.oro -= 5; s.turn.guacaErrantes = true; log(s, `${p.nombre} le compra una guaca a los arrieros errantes.`, p.id); darGuacas(s, p, 1); break;
    case 'intercambio': {
      if (s.phase !== 'plaza' || s.evento === 'cierre' || s.turn.intercambios >= maxIntercambios(s, p)) return prev;
      const q = s.players[a.partner]; if (!q || q.id === p.id) return prev;
      if (!tiene(p, a.give) || !tiene(q, a.get) || vacio(a.give) && vacio(a.get)) return prev;
      push(s, { kind: 'intercambio', player: q.id, title: `${p.nombre} te propone un trato`, text: `Te da: ${textoBundle(a.give) || 'nada'}. Pide: ${textoBundle(a.get) || 'nada'}.`, data: { from: p.id, give: a.give, get: a.get },
        options: [{ id: 'si', label: 'Aceptar' }, { id: 'no', label: 'Rechazar' }] });
      s.turn.intercambios++;
      break;
    }
    case 'habilidad': {
      if (!mainDisponible(s)) return prev;
      s.turn.mainUsada = true;
      if (p.personaje === 'wilson' && s.combat) s.combat.wilsonUsado = true;
      activaPersonaje(s, p, p.personaje, rollHabilidad(s, personaje(p.personaje).nombre, p));
      break;
    }
    case 'habilidadApoyo': {
      if (!apoyoDisponible(s)) return prev;
      s.turn.apoyoUsada = true;
      activaApoyo(s, p, rollHabilidad(s, apoyo(p.apoyo!).nombre, p));
      break;
    }
    case 'exag': {
      if (!exagJugable(s, a.uid)) return prev;
      const c = p.mano.find(x => x.uid === a.uid) as MorralCard & { kind: 'exag' };
      if (c.id === 'lora') return aplicar(prev, { t: 'lora', uid: a.uid });
      p.mano = p.mano.filter(x => x.uid !== a.uid); s.morralDescarte.push(c);
      s.turn.exagJugadas++;
      log(s, `${p.nombre} juega «${exag(c.id).nombre}».`, p.id);
      if (c.id === 'radio') {
        const ds = ORDEN_EDIFICIOS.filter(b => p.edificios[b] === 'danada');
        if (ds.length === 1) { p.edificios[ds[0]] = 'ok'; log(s, `${p.nombre} repara ${EDIFICIOS[ds[0]].nombre}.`, p.id); }
        else push(s, { kind: 'reparar-gratis', player: p.id, title: '¿Qué edificio reparas?', options: ds.map(b => ({ id: b, label: EDIFICIOS[b].nombre, img: EDIFICIOS[b].imgDanada })) });
        break;
      }
      const objs = objetivosExag(s, p.id, c.id);
      push(s, { kind: 'exag-objetivo', player: p.id, title: `¿Contra quién juegas «${exag(c.id).nombre}»?`, data: { id: c.id },
        options: objs.map(k => ({ id: String(k), label: nombreDe(s, k) })) });
      break;
    }
    case 'comprarHerramienta': {
      if (s.phase !== 'taller' || s.turn.compras >= maxCompras(s) + (s.turn.tallerExtra ? 1 : 0)) return prev;
      const enMazo = s.evento === 'aprendizaje' && s.herramientas.includes(a.tool);
      if (!s.reveladas.includes(a.tool) && !enMazo) return prev;
      const v = precioHerramienta(s, p, a.tool); if (p.oro < v) return prev;
      p.oro -= v; p.tools[a.tool]++; s.turn.compras++;
      if (s.reveladas.includes(a.tool)) { s.reveladas.splice(s.reveladas.indexOf(a.tool), 1); reponerHerramientas(s); }
      else s.herramientas.splice(s.herramientas.indexOf(a.tool), 1);
      log(s, `${p.nombre} compra ${HERRAMIENTAS[a.tool].nombre} por ${v} oro.`, p.id);
      break;
    }
    case 'construir': {
      const b = puedeConstruir(s); if (!b) return prev;
      const r = requisitos(s, p, b);
      p.mat.G--; p.mat.M--; p.mat.B--;
      for (const t of EDIFICIOS[b].herramientas) {
        if (p.tools[t] > 0) { p.tools[t]--; s.herramientasDescarte.push(t); }
        else if (r.comodin) { p.mano = p.mano.filter(x => x.uid !== r.comodin!.uid); s.morralDescarte.push(r.comodin); log(s, `${p.nombre} usa «Más feo que pegarle a la mamá» como ${HERRAMIENTAS[t].nombre}.`, p.id); }
      }
      void r; p.edificios[b] = 'ok'; s.turn.construcciones++;
      log(s, `¡${p.nombre} construye ${EDIFICIOS[b].nombre}!`, p.id);
      if (pasivaApoyo(p, 'cura-audemio') && !habilidadesBloqueadas(s)) { log(s, `El Cura Audemio bendice la obra.`, p.id); darGuacas(s, p, 1); }
      break;
    }
    case 'reparar': {
      if (s.phase !== 'taller' || p.edificios[a.b] !== 'danada') return prev;
      if (s.evento !== 'reparacion') { const k = materialMasAbundante(p); if (!k) return prev; p.mat[k]--; }
      p.edificios[a.b] = 'ok'; log(s, `${p.nombre} repara ${EDIFICIOS[a.b].nombre}.`, p.id);
      break;
    }
    case 'vender': {
      // Materiales y herramientas se venden en el Campo; las cartas de la mano también en la Plaza
      if (s.phase !== 'campo' && !(s.phase === 'plaza' && a.item.k === 'carta')) return prev;
      let v = 0; let que = '';
      if (a.item.k === 'mat') { if (p.mat[a.item.id] < 1) return prev; p.mat[a.item.id]--; v = valorVenta(s, p, { k: 'mat' }); que = MATERIALES[a.item.id].nombre; }
      else if (a.item.k === 'tool') { if (p.tools[a.item.id] < 1) return prev; p.tools[a.item.id]--; s.herramientasDescarte.push(a.item.id); v = valorVenta(s, p, { k: 'tool', id: a.item.id }); que = HERRAMIENTAS[a.item.id].nombre; }
      else { const uid = a.item.uid; const c = p.mano.find(x => x.uid === uid); if (!c || c.kind === 'exag') return prev; p.mano = p.mano.filter(x => x.uid !== uid); s.morralDescarte.push(c); v = valorVenta(s, p, { k: 'carta', c }); que = nombreCarta(c); }
      if (p.personaje === 'jose-maria' && !s.turn.vendioPrimera && !habilidadesBloqueadas(s)) v += 1;
      s.turn.vendioPrimera = true;
      if (p.tamalDe !== null) { const q = s.players[p.tamalDe]; q.oro += v; log(s, `${p.nombre} vende ${que}, pero ${q.nombre} se queda con los ${v} oro (tamal).`, p.id); p.tamalDe = null; }
      else { p.oro += v; log(s, `${p.nombre} vende ${que} por ${v} oro.`, p.id); }
      break;
    }
    case 'comprarMaterial': {
      if (s.phase !== 'campo') return prev; const v = precioMaterial(s, p); if (p.oro < v) return prev;
      p.oro -= v; p.mat[a.id]++; log(s, `${p.nombre} compra 1 ${MATERIALES[a.id].nombre} por ${v} oro.`, p.id);
      break;
    }
    case 'usarTarde': {
      if (s.phase !== 'taller' || !p.guardados.includes('tarde') || s.turn.tallerExtra) return prev;
      p.guardados.splice(p.guardados.indexOf('tarde'), 1); s.monteDescarte.push({ uid: uidCounter++, kind: 'dicho', id: 'tarde' });
      s.turn.tallerExtra = true; log(s, `${p.nombre} usa «Más vale tarde que nunca»: Taller doble.`, p.id);
      break;
    }
  }
  revisarVictoria(s);
  return s;
}

function explorar(s: GameState, noFlee: boolean) {
  const p = cur(s);
  s.turn.monteHecho = true;
  const c = robarMonte(s); if (!c) return;
  s.lastMonte = c;
  if (c.kind === 'dicho') resolverDicho(s, c.id);
  else iniciarCombate(s, p.id, c.id, 'monte', noFlee);
}

export const vacio = (b: Bundle) => !Object.values(b).some(v => (v ?? 0) > 0);
export function tiene(p: Player, b: Bundle): boolean {
  return Object.entries(b).every(([k, v]) => !v || (k === 'oro' ? p.oro >= v : k in p.mat ? p.mat[k as MaterialId] >= v : p.tools[k as ToolId] >= v));
}
function mover(from: Player, to: Player, b: Bundle) {
  for (const [k, v] of Object.entries(b)) {
    if (!v) continue;
    if (k === 'oro') { from.oro -= v; to.oro += v; }
    else if (k in from.mat) { from.mat[k as MaterialId] -= v; to.mat[k as MaterialId] += v; }
    else { from.tools[k as ToolId] -= v; to.tools[k as ToolId] += v; }
  }
}
export function textoBundle(b: Bundle): string {
  const nom: Record<string, string> = { oro: 'oro', G: 'Guadua', M: 'Madera', B: 'Barro', puntilla: 'Puntilla', martillo: 'Martillo', serrucho: 'Serrucho' };
  return Object.entries(b).filter(([, v]) => v).map(([k, v]) => `${v} ${nom[k]}`).join(', ');
}

// ---------------- Elecciones ----------------
function resolverEleccion(s: GameState, pnd: Pending, id: string) {
  const p = s.players[pnd.player];
  const take = (uid: number, arr: MorralCard[]) => { const i = arr.findIndex(c => c.uid === uid); return i >= 0 ? arr.splice(i, 1)[0] : null; };
  switch (pnd.kind) {
    case 'mantener':
      if (id === 'si') { p.oro--; log(s, `${p.nombre} paga 1 oro a ${apoyo(p.apoyo!).nombre}.`, p.id); }
      else { log(s, `${apoyo(p.apoyo!).nombre} vuelve a la Plaza.`, p.id); p.apoyo = null; p.copiaApoyo = null; }
      break;
    case 'chapolera': {
      const cs: MorralCard[] = pnd.data.cartas;
      for (const c of cs) { if (String(c.uid) === id) p.mano.push(c); else s.morralDescarte.push(c); }
      break;
    }
    case 'jairo-mira':
      if (id === 'fondo') { const top = s.monte.pop(); if (top) s.monte.unshift(top); log(s, `${p.nombre} pone la carta al fondo del Monte.`, p.id); explorar(s, true); }
      else explorar(s, false);
      break;
    case 'jairo': if (id === 'si') { s.turn.mainUsada = true; activaPersonaje(s, p, 'jairo', rollHabilidad(s, 'Don Jairo', p)); } break;
    case 'reaccion': {
      const c = s.combat!;
      if (id !== 'pasar') {
        const [k, uidS] = id.split(':'); const card = take(Number(uidS), p.mano);
        if (card) {
          s.morralDescarte.push(card);
          if (k === 'food' || k === 'perro') { c.sabotage = { by: p.id, d8: d(s, 8), con: nombreCarta(card) }; log(s, `${p.nombre} sabotea con ${nombreCarta(card)}: +${c.sabotage.d8} al mito.`, p.id); }
          if (k === 'bizco') { c.bizco = true; log(s, `${p.nombre} juega «${exag('bizco').nombre}»: ataque y recompensa dobles.`, p.id); }
          // Quien pelea puede responder al sabotaje
          if (pedirRespuesta(s, p.id)) break;
        }
      }
      siguienteReaccion(s);
      break;
    }
    case 'respuesta': {
      const c = s.combat!;
      if (id !== 'pasar') {
        const [k, uidS] = id.split(':'); const card = take(Number(uidS), p.mano);
        if (card) {
          s.morralDescarte.push(card);
          if (k === 'resp' && card.kind === 'comida') {
            c.respuesta = { d8: d(s, 8), con: card.nombre, licor: card.tipo === 'licor' };
            log(s, `${p.nombre} responde con ${card.nombre}: +${c.respuesta.d8} a su poder.`, p.id);
          }
          if (k === 'lora') {
            const min = c.dice.indexOf(Math.min(...c.dice)); c.dice[min] = 6;
            log(s, `${p.nombre} juega «Más cagao que parapeto de lora»: un dado pasa a 6.`, p.id);
          }
        }
      }
      siguienteReaccion(s);
      break;
    }
    case 'victoria-rival': {
      const c = s.combat!;
      if (id !== 'pasar') {
        const [k, uidS] = id.split(':'); const card = take(Number(uidS), p.mano);
        if (card) {
          s.morralDescarte.push(card);
          if (k === 'tigre') { c.reward = { oro: 0, guacas: 0 }; log(s, `${p.nombre} juega «${exag('mato-tigre').nombre}»: sin recompensa.`, p.id); }
          if (k === 'filo') { p.oro += c.reward!.oro; log(s, `${p.nombre} juega «${exag('filo').nombre}» y se queda con ${c.reward!.oro} oro.`, p.id); c.reward = { ...c.reward!, oro: 0 }; }
        }
      }
      siguienteVictoria(s);
      break;
    }
    case 'castigo': {
      const castigo: Castigo = pnd.data.castigo;
      if (id === 'mal-tiempo') { p.guardados.splice(p.guardados.indexOf('mal-tiempo'), 1); s.monteDescarte.push({ uid: uidCounter++, kind: 'dicho', id: 'mal-tiempo' }); log(s, `${p.nombre} usa «A mal tiempo, buena cara».`, p.id); }
      else if (id === 'claudia') { descartarComida(s, p); log(s, `${p.nombre} se cura con remedios de monte.`, p.id); }
      else aplicarCastigo(s, p.id, castigo);
      break;
    }
    case 'material-gratis': p.mat[id as MaterialId]++; log(s, `${p.nombre} toma 1 ${MATERIALES[id as MaterialId].nombre}.`, p.id); break;
    case 'cambiar-material': { const [x, y] = id.split('>') as MaterialId[]; p.mat[x]--; p.mat[y]++; log(s, `${p.nombre} cambia ${MATERIALES[x].nombre} por ${MATERIALES[y].nombre}.`, p.id); break; }
    case 'convertir': { const [x, t] = id.split('>') as [MaterialId, ToolId]; p.mat[x]--; p.tools[t]++; log(s, `${p.nombre} convierte ${MATERIALES[x].nombre} en ${HERRAMIENTAS[t].nombre}.`, p.id); break; }
    case 'robar-a': { const q = s.players[Number(id)]; const c = quitarAlAzar(s, q); if (c) { p.mano.push(c); log(s, `${p.nombre} le roba una carta a ${q.nombre}.`, p.id); } break; }
    case 'dar-carta': { const q = s.players[Number(id)]; const c = quitarPeorCarta(s, p, false); if (c) { q.mano.push(c); log(s, `${p.nombre} le da ${nombreCarta(c)} a ${q.nombre}.`, p.id); } break; }
    case 'dar-oro': { const q = s.players[Number(id)]; if (p.oro > 0) { p.oro--; q.oro++; log(s, `${p.nombre} le da 1 oro a ${q.nombre}.`, p.id); } break; }
    case 'edilberto': activaPersonaje(s, p, id as CharacterId, rollHabilidad(s, 'Edilberto', p)); break;
    case 'edilberto-copia': p.copiaApoyo = id as ApoyoId; log(s, `Edilberto copia la pasiva de ${apoyo(id as ApoyoId).nombre}.`, p.id); break;
    case 'cria-fama': {
      const i = s.monteDescarte.findIndex(c => String(c.uid) === id);
      if (i >= 0) { const [c] = s.monteDescarte.splice(i, 1); s.monte.push(c); log(s, `${p.nombre} pone ${mito((c as any).id).nombre} encima del Monte.`, p.id); }
      break;
    }
    case 'ocasion': {
      const i = s.monteDescarte.findIndex(c => String(c.uid) === id);
      if (i >= 0) { const [c] = s.monteDescarte.splice(i, 1); iniciarCombate(s, p.id, (c as any).id, 'ocasion'); }
      break;
    }
    case 'tomar-descarte': { const c = take(Number(id), s.morralDescarte); if (c) { p.mano.push(c); log(s, `${p.nombre} toma ${nombreCarta(c)} del descarte.`, p.id); } break; }
    case 'mal-que': {
      const i = s.monte.findIndex(c => String(c.uid) === id);
      if (i >= 0) { const [c] = s.monte.splice(i, 1); s.monte.push(c); log(s, `${p.nombre} reordena el Monte.`, p.id); }
      break;
    }
    case 'llora': {
      const cartas: MorralCard[] = pnd.data.cartas; const orden: number[] = pnd.data.orden;
      const c = take(Number(id), cartas); if (c) { p.mano.push(c); log(s, `${p.nombre} toma ${nombreCarta(c)}.`, p.id); }
      siguienteLlora(s, cartas, orden.slice(1));
      break;
    }
    case 'consejos-carta': {
      if (id === 'no') break;
      const c = take(Number(id), p.mano); if (c) s.morralDescarte.push(c);
      push(s, { kind: 'consejos-rival', player: p.id, title: '¿Qué rival descarta?', options: rivales(s, p.id).map(k => ({ id: String(k), label: nombreDe(s, k) })) });
      break;
    }
    case 'consejos-rival': {
      const q = s.players[Number(id)];
      const ops: Option[] = [];
      if (Object.values(q.equipo).some(Boolean)) ops.push({ id: `eq:${q.id}`, label: 'Que descarte 1 equipo' });
      if (q.mano.length) ops.push({ id: `mano:${q.id}`, label: 'Que descarte 1 carta al azar de su mano' });
      if (ops.length) push(s, { kind: 'consejos-modo', player: p.id, title: `${q.nombre} descarta…`, options: ops });
      break;
    }
    case 'consejos-modo': {
      const [k, qi] = id.split(':'); const q = s.players[Number(qi)];
      if (k === 'eq') aplicarCastigo(s, q.id, { t: 'descartaEquipo' });
      else { const c = quitarAlAzar(s, q); if (c) { s.morralDescarte.push(c); log(s, `${q.nombre} descarta ${nombreCarta(c)}.`, q.id); } }
      break;
    }
    case 'exag-objetivo': {
      const objetivo = Number(id); const eid: ExagId = pnd.data.id; const t = s.players[objetivo];
      if (eid === 'carro') {
        const bs = (['casa', 'plaza'] as BuildingId[]).filter(b => t.edificios[b] === 'ok');
        if (bs.length > 1) { push(s, { kind: 'exag-extra', player: p.id, title: '¿Qué edificio dañas?', data: { id: eid, objetivo }, options: bs.map(b => ({ id: b, label: EDIFICIOS[b].nombre, img: EDIFICIOS[b].img })) }); break; }
        jugarExagContra(s, p.id, eid, objetivo, bs[0]); break;
      }
      if (eid === 'aburrido') {
        const sl = (['arma', 'prenda', 'montura'] as Slot[]).filter(k => t.equipo[k] && p.equipo[k]);
        if (sl.length > 1) { push(s, { kind: 'exag-extra', player: p.id, title: '¿Qué espacio cambias?', data: { id: eid, objetivo }, options: sl.map(k => ({ id: k, label: `${SLOT_NOMBRE[k]}: tu ${p.equipo[k]!.nombre} por su ${t.equipo[k]!.nombre}` })) }); break; }
        jugarExagContra(s, p.id, eid, objetivo, sl[0]); break;
      }
      jugarExagContra(s, p.id, eid, objetivo);
      break;
    }
    case 'exag-extra': jugarExagContra(s, p.id, pnd.data.id, pnd.data.objetivo, id); break;
    case 'otro-perro': {
      const { autor, id: eid, extra } = pnd.data;
      if (id === 'no') { efectoExag(s, autor, eid, p.id, extra); break; }
      const card = p.mano.find(c => c.kind === 'exag' && c.id === 'otro-perro');
      if (card) { p.mano = p.mano.filter(c => c.uid !== card.uid); s.morralDescarte.push(card); }
      const nuevo = Number(id);
      log(s, `${p.nombre} responde «A otro perro con ese hueso» y se lo pasa a ${nombreDe(s, nuevo)}.`, p.id);
      // el nuevo objetivo no puede rebotarlo de nuevo con la misma jugada
      const t = s.players[nuevo];
      let extra2 = extra;
      if (eid === 'carro' && t.edificios[extra as BuildingId] !== 'ok') extra2 = undefined;
      if (eid === 'aburrido') extra2 = undefined;
      jugarExagContra(s, autor, eid, nuevo, `redir:${extra2 ?? ''}`);
      break;
    }
    case 'reparar-gratis': p.edificios[id as BuildingId] = 'ok'; log(s, `${p.nombre} repara ${EDIFICIOS[id as BuildingId].nombre}.`, p.id); break;
    case 'intercambio': {
      const { from, give, get } = pnd.data; const q = s.players[from];
      if (id === 'si' && tiene(q, give) && tiene(p, get)) { mover(q, p, give); mover(p, q, get); log(s, `${p.nombre} acepta el trato de ${q.nombre}.`, p.id); }
      else log(s, `${p.nombre} rechaza el trato de ${q.nombre}.`, p.id);
      break;
    }
    case 'limite': {
      const c = take(Number(id), p.mano); if (c) { s.morralDescarte.push(c); log(s, `${p.nombre} descarta ${nombreCarta(c)}.`, p.id); }
      finTurno(s);
      break;
    }
    case 'info': break;
    case 'orden': {
      const r = d(s, 6);
      (s.ordenTiradas![p.id] ??= []).push(r);
      log(s, `${p.nombre} lanza ${r}.`, p.id);
      if (!s.queue.some(q => q.kind === 'orden')) resolverOrden(s);
      break;
    }
  }
}

export const etiquetaTier = (t: string) => TIER_NOMBRE[t as keyof typeof TIER_NOMBRE];

/** Ajusta el contador de ids al restaurar una partida guardada. */
export function restaurar(s: GameState): GameState {
  let max = 0;
  const ver = (x: any) => { if (x && typeof x === 'object') { if (typeof x.uid === 'number') max = Math.max(max, x.uid); for (const v of Object.values(x)) ver(v); } };
  ver(s);
  uidCounter = Math.max(uidCounter, max + 1);
  return s;
}

/** Vista de la partida para un jugador en red: oculta manos ajenas, el orden de los mazos y la semilla. */
export function vistaPara(s: GameState, yo: number | null): GameState {
  const v: GameState = { ...s, seed: 0, monte: [], morral: [], monteCount: s.monte.length, morralCount: s.morral.length, players: s.players.map(p => (p.id === yo ? p : { ...p, mano: [], ocultas: p.mano.length })) };
  v.queue = s.queue.map(q => (q.player === yo ? q : { ...q, options: q.options.map(o => ({ id: o.id, label: '' })), data: undefined, text: q.text }));
  return v;
}
export const cartasEnMano = (p: Player) => p.ocultas ?? p.mano.length;
