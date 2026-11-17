// IA heurística de Arrieros y Cuchillos.
import { ApoyoId, EDIFICIOS, exag, HERRAMIENTAS, MaterialId, mito, ORDEN_EDIFICIOS, personaje, Slot, ToolId } from './data';
import {
  Action, ataqueMito, cur, edificiosOk, exagJugable, GameState, mainDisponible, apoyoDisponible, materialQueFalta, objetivosExag,
  pendiente, Pending, Player, poderJugador, precioApoyo, precioHerramienta, precioMaterial, probVictoria, puedeAvanzar,
  puedeConstruir, requisitos, totalGolpe, valorCarta, valorVenta, Bundle, maxCompras,
} from './engine';

export const puntaje = (p: Player) => edificiosOk(p) * 10 + p.mano.length * 0.8 + p.oro * 0.4 + totalGolpe(p) * 0.3;
const lider = (s: GameState, excepto: number, candidatos?: number[]) => {
  const ids = (candidatos ?? s.players.map(p => p.id)).filter(i => i !== excepto);
  return ids.sort((a, b) => puntaje(s.players[b]) - puntaje(s.players[a]))[0];
};
const masDebil = (s: GameState, excepto: number, candidatos: number[]) =>
  candidatos.filter(i => i !== excepto).sort((a, b) => puntaje(s.players[a]) - puntaje(s.players[b]))[0];

/** Herramientas que aún necesita para todos los edificios que faltan. */
function herramientasPendientes(p: Player): Record<ToolId, number> {
  const need: Record<ToolId, number> = { puntilla: 0, martillo: 0, serrucho: 0 };
  for (const b of ORDEN_EDIFICIOS) if (!p.edificios[b]) for (const t of EDIFICIOS[b].herramientas) need[t]++;
  for (const t of Object.keys(need) as ToolId[]) need[t] = Math.max(0, need[t] - p.tools[t]);
  return need;
}
const faltanEdificios = (p: Player) => ORDEN_EDIFICIOS.filter(b => !p.edificios[b]).length;

/** Devuelve la acción de la IA si le toca a una IA; null si debe actuar un humano. */
export function aiAction(s: GameState): Action | null {
  if (s.winner !== null) return null;
  const pnd = pendiente(s);
  if (pnd) return s.players[pnd.player].ia ? { t: 'choose', id: elegir(s, pnd) } : null;
  const p = cur(s);
  if (!p.ia) return null;
  if (s.anuncio) return { t: 'cerrarAnuncio' };
  return turno(s, p);
}

function turno(s: GameState, p: Player): Action {
  const c = s.combat;
  if (c && c.step !== 'hecho' && c.fighter === p.id) {
    const ataque = ataqueMito(s, c);
    const tieneComida = p.mano.some(x => x.kind === 'comida');
    if (c.step === 'decidir') {
      if (mainDisponible(s)) return { t: 'habilidad' };
      const prob = probVictoria(s, p, ataque, c.bonus, tieneComida);
      if (prob >= 0.45 || c.noFlee) return { t: 'pelear' };
      return { t: 'huir' };
    }
    if (c.step === 'tirada') {
      const poder = poderJugador(s, c);
      if (poder < ataque) {
        const lora = p.mano.find(x => x.kind === 'exag' && x.id === 'lora');
        const min = Math.min(...c.dice);
        if (lora && poder + (6 - min) >= ataque - 1) return { t: 'lora', uid: lora.uid };
        if (!c.food && ataque - poder <= 8) {
          const comidas = p.mano.filter(x => x.kind === 'comida');
          if (comidas.length) {
            const pref = comidas.find(x => x.kind === 'comida' && x.tipo === 'alimento') ?? comidas[0];
            return { t: 'comida', uid: pref.uid };
          }
        }
      }
      return { t: 'confirmar' };
    }
  }
  if (s.phase === 'plaza') {
    for (const card of p.mano) if (card.kind === 'equipo' && (!p.equipo[card.slot] || p.equipo[card.slot]!.golpe < card.golpe)) return { t: 'equipar', uid: card.uid };
    if (s.evento === 'errantes' && !s.turn.guacaErrantes && p.oro >= 8) return { t: 'guacaErrantes' };
    if (!p.apoyo && s.evento !== 'cierre' && p.oro >= precioApoyo(s) + 4) {
      const pref: ApoyoId[] = [...(p.edificios.iglesia ? [] : ['cura-audemio' as ApoyoId]), 'tulio', 'polonio', 'abuelo', 'benancio', 'genovevo', 'chapolera', 'edilberto'];
      const a = pref.find(x => s.apoyosRevelados.includes(x));
      if (a) return { t: 'contratar', id: a };
    }
    if (mainDisponible(s)) return { t: 'habilidad' };
    if (apoyoDisponible(s)) return { t: 'habilidadApoyo' };
    const ex = exagParaJugar(s, p); if (ex) return ex;
    return { t: 'next' };
  }
  if (s.phase === 'monte') {
    if (!s.turn.monteHecho) return { t: 'explorar' };
    return { t: 'next' };
  }
  if (s.phase === 'taller') {
    if (puedeConstruir(s)) return { t: 'construir' };
    const danado = ORDEN_EDIFICIOS.find(b => p.edificios[b] === 'danada');
    const totalMat = p.mat.G + p.mat.M + p.mat.B;
    if (danado && (s.evento === 'reparacion' || (totalMat > 0 && (totalMat > 3 * Math.min(1, faltanEdificios(p)) || faltanEdificios(p) === 0)))) return { t: 'reparar', b: danado };
    if (s.turn.compras < maxCompras(s) + (s.turn.tallerExtra ? 1 : 0)) {
      const need = herramientasPendientes(p);
      const sig = ORDEN_EDIFICIOS.find(b => !p.edificios[b]);
      const urgentes = sig ? EDIFICIOS[sig].herramientas.filter(t => p.tools[t] < 1) : [];
      const disponibles = (t: ToolId) => s.reveladas.includes(t) || (s.evento === 'aprendizaje' && s.herramientas.includes(t));
      for (const t of [...urgentes, ...(['serrucho', 'martillo', 'puntilla'] as ToolId[]).filter(x => need[x] > 0)]) {
        if (disponibles(t) && p.oro >= precioHerramienta(s, p, t)) return { t: 'comprarHerramienta', tool: t };
      }
    }
    if (p.guardados.includes('tarde') && !s.turn.tallerExtra && s.turn.construcciones >= 1) {
      const b = ORDEN_EDIFICIOS.find(x => !p.edificios[x]);
      if (b && requisitos(s, p, b).ok) return { t: 'usarTarde' };
    }
    const ex = exagParaJugar(s, p); if (ex) return ex;
    return { t: 'next' };
  }
  if (s.phase === 'campo') {
    const sig = ORDEN_EDIFICIOS.find(b => !p.edificios[b]);
    if (sig) {
      for (const k of ['G', 'M', 'B'] as MaterialId[]) if (p.mat[k] < 1 && p.oro >= precioMaterial(s, p)) return { t: 'comprarMaterial', id: k };
    }
    // vender lo que sobra
    for (const card of p.mano) if (card.kind === 'equipo' && p.equipo[card.slot] && p.equipo[card.slot]!.golpe >= card.golpe) return { t: 'vender', item: { k: 'carta', uid: card.uid } };
    const comidas = p.mano.filter(x => x.kind === 'comida');
    const need = herramientasPendientes(p);
    const faltaOro = (['puntilla', 'martillo', 'serrucho'] as ToolId[]).some(t => need[t] > 0 && p.oro < precioHerramienta(s, p, t));
    if (faltaOro && comidas.length > 2) return { t: 'vender', item: { k: 'carta', uid: comidas[0].uid } };
    const sobra = (['G', 'M', 'B'] as MaterialId[]).find(k => p.mat[k] > faltanEdificios(p) + 1);
    if (sobra && faltaOro) return { t: 'vender', item: { k: 'mat', id: sobra } };
    return { t: 'next' };
  }
  return { t: 'next' };
}

function exagParaJugar(s: GameState, p: Player): Action | null {
  if (s.turn.exagJugadas > 0) return null;
  for (const c of p.mano) {
    if (c.kind !== 'exag' || !exagJugable(s, c.uid)) continue;
    if (c.id === 'radio') return { t: 'exag', uid: c.uid };
    const objs = objetivosExag(s, p.id, c.id);
    if (!objs.length) continue;
    const l = lider(s, p.id, objs);
    if (puntaje(s.players[l]) >= puntaje(p) - 3) return { t: 'exag', uid: c.uid };
  }
  return null;
}

function elegir(s: GameState, pnd: Pending): string {
  const p = s.players[pnd.player];
  const ids = pnd.options.map(o => o.id);
  const has = (id: string) => ids.includes(id);
  const masValiosa = (cartas: { uid: number }[]) => {
    const cs = p.mano.concat(cartas as any);
    let best = ids[0], bv = -1;
    for (const id of ids) { const c = (cartas as any[]).find(x => String(x.uid) === id) ?? s.morralDescarte.find(x => String(x.uid) === id); if (!c) continue; const v = valorCarta(p, c); if (v > bv) { bv = v; best = id; } }
    return best;
  };
  switch (pnd.kind) {
    case 'mantener': return p.oro >= 3 ? 'si' : 'no';
    case 'chapolera': return masValiosa(pnd.data.cartas);
    case 'llora': return masValiosa(pnd.data.cartas);
    case 'tomar-descarte': return masValiosa(s.morralDescarte);
    case 'jairo-mira': {
      const top = s.monte[s.monte.length - 1];
      if (top && top.kind === 'mito' && probVictoria(s, p, mito(top.id).ataque, 0, p.mano.some(c => c.kind === 'comida')) < 0.4) return 'fondo';
      return 'dejar';
    }
    case 'jairo': return 'si';
    case 'reaccion': {
      const c = s.combat!; const f = s.players[c.fighter];
      const poder = poderJugador(s, c), ataque = ataqueMito(s, c);
      const amenaza = puntaje(f) >= puntaje(p) - 4 || edificiosOk(f) >= 2;
      if (!amenaza) return 'pasar';
      const bizco = ids.find(i => i.startsWith('bizco'));
      if (bizco && poder >= ataque && poder < ataque * 2) return bizco;
      const margen = poder - ataque;
      if (margen >= 0 && margen <= 5) {
        const perro = ids.find(i => i.startsWith('perro')); if (perro) return perro;
        const comidas = ids.filter(i => i.startsWith('food'));
        const nComida = p.mano.filter(x => x.kind === 'comida').length;
        if (comidas.length && nComida >= 2) return comidas[0];
      }
      return 'pasar';
    }
    case 'victoria-rival': {
      const c = s.combat!; const f = s.players[c.fighter];
      const tigre = ids.find(i => i.startsWith('tigre')); const filo = ids.find(i => i.startsWith('filo'));
      if (tigre && (c.reward!.guacas >= 2 || edificiosOk(f) >= 2)) return tigre;
      if (filo && c.reward!.oro >= 3) return filo;
      return 'pasar';
    }
    case 'castigo': {
      const t = pnd.data.castigo.t;
      const grave = ['danaTodos', 'danaMejor', 'danaCasa', 'pierdeTurno', 'descartaTodaMano', 'descartaTodosMateriales', 'entregaMejorEquipo', 'reparteMano'].includes(t);
      if (grave && has('mal-tiempo')) return 'mal-tiempo';
      if (has('claudia') && (grave || p.mano.filter(x => x.kind === 'comida').length >= 3)) return 'claudia';
      return 'aceptar';
    }
    case 'material-gratis': return materialQueFalta(p);
    case 'cambiar-material': {
      const max = (['G', 'M', 'B'] as MaterialId[]).sort((a, b) => p.mat[b] - p.mat[a])[0];
      const id = `${max}>${materialQueFalta(p)}`; return has(id) ? id : ids[0];
    }
    case 'convertir': {
      const need = herramientasPendientes(p);
      const max = (['G', 'M', 'B'] as MaterialId[]).sort((a, b) => p.mat[b] - p.mat[a])[0];
      const t: ToolId = need.martillo > 0 ? 'martillo' : 'puntilla';
      const id = `${max}>${t}`; return has(id) ? id : ids[0];
    }
    case 'robar-a': case 'consejos-rival': case 'exag-objetivo': return String(lider(s, p.id, ids.map(Number)));
    case 'dar-oro': case 'dar-carta': return String(masDebil(s, p.id, ids.map(Number)));
    case 'otro-perro': {
      const opts = ids.filter(i => i !== 'no').map(Number);
      return opts.length ? String(lider(s, p.id, opts)) : 'no';
    }
    case 'cria-fama': return pnd.options.slice().sort((a, b) => num(b.detail) - num(a.detail))[0].id;
    case 'ocasion': return pnd.options.slice().sort((a, b) => num(a.detail) - num(b.detail))[0].id;
    case 'mal-que': {
      const paraMi = s.current === p.id && !s.turn.monteHecho;
      const mitos = pnd.options.filter(o => o.detail?.includes('taque'));
      const dichos = pnd.options.filter(o => !o.detail?.includes('taque'));
      if (paraMi) return (dichos[0] ?? mitos.sort((a, b) => num(a.detail) - num(b.detail))[0]).id;
      return (mitos.sort((a, b) => num(b.detail) - num(a.detail))[0] ?? pnd.options[0]).id;
    }
    case 'consejos-carta': {
      if (p.mano.length < 2) return 'no';
      let best = ids[0], bv = 99;
      for (const id of ids) { const c = p.mano.find(x => String(x.uid) === id); if (c && valorCarta(p, c) < bv) { bv = valorCarta(p, c); best = id; } }
      return best;
    }
    case 'consejos-modo': return ids.find(i => i.startsWith('eq')) ?? ids[0];
    case 'exag-extra': return has('plaza') ? 'plaza' : ids[0];
    case 'intercambio': {
      const { give, get } = pnd.data as { give: Bundle; get: Bundle };
      return valor(give) >= valor(get) + 0.5 ? 'si' : 'no';
    }
    case 'limite': {
      let best = ids[0], bv = 99;
      for (const id of ids) { const c = p.mano.find(x => String(x.uid) === id); if (c && valorCarta(p, c) < bv) { bv = valorCarta(p, c); best = id; } }
      return best;
    }
    default: return ids[0];
  }
}
const num = (t?: string) => Number((t ?? '').replace(/\D+/g, ' ').trim().split(' ').pop() || 0);
function valor(b: Bundle): number {
  let v = 0;
  for (const [k, n] of Object.entries(b)) { if (!n) continue; v += n * (k === 'oro' ? 1 : k in HERRAMIENTAS ? HERRAMIENTAS[k as ToolId].precio * 0.7 : 1.8); }
  return v;
}
