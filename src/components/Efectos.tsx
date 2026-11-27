// Efectos animados de la pantalla de mesa: cartas lanzadas, aparición de mitos,
// dados grandes, resultados de combate, sabotajes y construcciones.
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { IMG, EXAGERACIONES, EQUIPO, COMIDA, mito, EDIFICIOS, BuildingId, TIER_NOMBRE } from '../game/data';
import { GameState, MorralCard } from '../game/engine';
import { Carta, CartaProps, Dado, propsMorral } from './Cartas';
import { posJugador, posDados, posMito, layoutEscena } from './Escena';

type Efecto =
  | { id: number; tipo: 'carta'; de: number; carta: CartaProps; texto: string; color: string }
  | { id: number; tipo: 'mito'; mitoId: string }
  | { id: number; tipo: 'dados'; dados: number[]; texto: string; rotulo?: string }
  | { id: number; tipo: 'resultado'; r: 'gana' | 'pierde' | 'escapa'; texto: string }
  | { id: number; tipo: 'sabotaje'; de: number; d8: number; texto: string; color: string }
  | { id: number; tipo: 'construir'; b: BuildingId; texto: string; color: string }
  | { id: number; tipo: 'cobro'; de: number; texto: string; color: string; guacas: number };

const DURACION: Record<Efecto['tipo'], number> = { carta: 2000, mito: 1900, dados: 1500, resultado: 2100, sabotaje: 1700, construir: 2000, cobro: 2200 };
let sig = 1;

/**
 * El escenario mide 1920×1080 «de base» y se estira para llenar la pantalla:
 * ex / ey = píxeles que se agregaron a lo ancho / a lo alto.
 */
export const EscenarioCtx = createContext({ ex: 0, ey: 0 });

function cartaPorNombre(nombre: string): CartaProps | null {
  const ex = EXAGERACIONES.find(e => e.nombre === nombre);
  if (ex) return propsMorral({ uid: 0, kind: 'exag', id: ex.id });
  const eq = EQUIPO.find(e => e.nombre === nombre);
  if (eq) return propsMorral({ uid: 0, kind: 'equipo', nombre: eq.nombre, slot: eq.slot, golpe: eq.golpe, img: eq.img, nota: eq.nota } as MorralCard);
  const co = COMIDA.find(c => c.nombre === nombre);
  if (co) return propsMorral({ uid: 0, kind: 'comida', nombre: co.nombre, tipo: co.tipo, img: co.img } as MorralCard);
  return null;
}

export function useEfectosMesa(s: GameState) {
  const ultimo = useRef<number>(-1);
  const [cola, setCola] = useState<Efecto[]>([]);
  const [temblor, setTemblor] = useState(0);

  useEffect(() => {
    const n = s.logN ?? 0;
    if (ultimo.current < 0) { ultimo.current = n; return; }
    const nuevas = s.log.filter(l => (l.n ?? 0) > ultimo.current);
    ultimo.current = n;
    const out: Efecto[] = [];
    const color = (p?: number) => (p !== undefined ? s.players[p].color : '#e0a526');
    const nombre = (p?: number) => (p !== undefined ? s.players[p].nombre : '');
    // Cobro de la recompensa tras vencer un mito (oro, guacas y material juntos en un solo efecto)
    const cobro: Record<number, string[]> = {}; const guacasDe: Record<number, number> = {};
    for (const l of nuevas) {
      let m: RegExpMatchArray | null;
      if (l.p !== undefined && (m = l.t.match(/ gana (\d+) oro\.$/))) { (cobro[l.p] ??= []).push(`+${m[1]} oro`); continue; }
      if (l.p !== undefined && (m = l.t.match(/ recibe (\d+) guacas?\.$/))) { (cobro[l.p] ??= []).push(`+${m[1]} guaca${m[1] === '1' ? '' : 's'}`); guacasDe[l.p] = Number(m[1]); continue; }
      if (l.p !== undefined && cobro[l.p] && (m = l.t.match(/ recoge 1 (.+)\.$/))) { cobro[l.p].push(`+1 ${m[1]}`); continue; }
      if ((m = l.t.match(/ juega «(.+?)»/))) {
        const c = cartaPorNombre(m[1]); if (c) out.push({ id: sig++, tipo: 'carta', de: l.p ?? 0, carta: c, texto: `${nombre(l.p)} lanza una exageración`, color: color(l.p) });
      } else if ((m = l.t.match(/ sabotea con (.+?): \+(\d+)/))) {
        const c = cartaPorNombre(m[1]);
        if (c) out.push({ id: sig++, tipo: 'carta', de: l.p ?? 0, carta: c, texto: `${nombre(l.p)} sabotea`, color: color(l.p) });
        out.push({ id: sig++, tipo: 'sabotaje', de: l.p ?? 0, d8: Number(m[2]), texto: `¡Sabotaje de ${nombre(l.p)}! +${m[2]} al mito`, color: color(l.p) });
      } else if ((m = l.t.match(/ responde con (.+?): \+(\d+)/))) {
        const c = cartaPorNombre(m[1]); if (c) out.push({ id: sig++, tipo: 'carta', de: l.p ?? 0, carta: c, texto: `¡${nombre(l.p)} responde! +${m[2]} a su poder`, color: color(l.p) });
      } else if ((m = l.t.match(/ come (.+?): \+/))) {
        const c = cartaPorNombre(m[1]); if (c) out.push({ id: sig++, tipo: 'carta', de: l.p ?? 0, carta: c, texto: `${nombre(l.p)} come para pelear`, color: color(l.p) });
      } else if ((m = l.t.match(/ se equipa (.+?) \(/))) {
        const c = cartaPorNombre(m[1]); if (c) out.push({ id: sig++, tipo: 'carta', de: l.p ?? 0, carta: c, texto: `${nombre(l.p)} se equipa`, color: color(l.p) });
      } else if (l.t.includes(' enfrenta a ') && s.combat) {
        out.push({ id: sig++, tipo: 'mito', mitoId: s.combat.mitoId });
      } else if ((m = l.t.match(/ lanza la habilidad de (.+?): (\d)(?: → (.+?))?\.$/))) {
        // Dado de habilidad (personaje o apoyo): sale girando encima del personaje
        out.push({ id: sig++, tipo: 'dados', dados: [Number(m[2])], texto: nombre(l.p), rotulo: `${nombre(l.p)} · habilidad de ${m[1]}: ${m[2]}${m[3] ? ` → ${m[3]}` : ''}` });
      } else if ((m = l.t.match(/ lanza (\d[\d + ]*)(?: \(|\.)/)) && !l.t.includes('habilidad')) {
        out.push({ id: sig++, tipo: 'dados', dados: m[1].split(' + ').map(Number), texto: nombre(l.p) });
      } else if (l.t.includes(' vence a ')) {
        out.push({ id: sig++, tipo: 'resultado', r: 'gana', texto: l.t.replace(/^¡|!.*$/g, '') });
      } else if (l.t.includes(' pierde contra ') || l.t.includes('no lo logra')) {
        out.push({ id: sig++, tipo: 'resultado', r: 'pierde', texto: nombre(l.p) });
      } else if (/ huye \(saca/.test(l.t)) {
        out.push({ id: sig++, tipo: 'resultado', r: 'escapa', texto: nombre(l.p) });
      } else if ((m = l.t.match(/ construye (.+)!/))) {
        const b = (Object.keys(EDIFICIOS) as BuildingId[]).find(k => EDIFICIOS[k].nombre === m![1]);
        if (b) out.push({ id: sig++, tipo: 'construir', b, texto: `¡${nombre(l.p)} construye ${EDIFICIOS[b].nombre}!`, color: color(l.p) });
      }
    }
    for (const k of Object.keys(cobro)) {
      const p = Number(k);
      out.push({ id: sig++, tipo: 'cobro', de: p, texto: `${nombre(p)} cobra: ${cobro[p].join(' · ')}`, color: color(p), guacas: guacasDe[p] ?? 0 });
    }
    if (out.length) setCola(c => [...c, ...out].slice(-6));
  }, [s]);

  const actual = cola[0] ?? null;
  useEffect(() => {
    if (!actual) return;
    if (actual.tipo === 'mito' || (actual.tipo === 'resultado' && actual.r === 'pierde')) setTemblor(t => t + 1);
    // Si hay cola, los efectos se aceleran para no quedarse atrás del juego
    const dur = DURACION[actual.tipo] * (cola.length > 2 ? 0.6 : 1);
    const id = setTimeout(() => setCola(c => c.slice(1)), dur);
    return () => clearTimeout(id);
  }, [actual?.id]);

  return { actual, temblor, rapido: cola.length > 2 };
}

export function CapaEfectos({ s, efecto, rapido, yo }: { s: GameState; efecto: ReturnType<typeof useEfectosMesa>['actual']; rapido: boolean; yo?: number }) {
  const esc = useContext(EscenarioCtx);
  if (!efecto) return null;
  const n = s.players.length;
  const origenJugador = (i: number) => posJugador(i, n, yo, esc.ex, esc.ey);
  const L = layoutEscena(esc.ex, esc.ey);
  // Las cartas lanzadas caen en el centro de la escena; sabotajes y cobros salen del mito
  const CENTRO_MAPA = { x: L.W / 2, y: L.suelo - 330 };
  const PANEL_COMBATE = posMito(esc.ex, esc.ey);
  const DADOS = posDados(esc.ex, esc.ey);
  const vel = rapido ? { animationDuration: '1.2s' } : undefined;
  switch (efecto.tipo) {
    case 'carta': {
      const o = origenJugador(efecto.de);
      const st = { '--x0': `${o.x}px`, '--y0': `${o.y}px`, '--x1': `${CENTRO_MAPA.x}px`, '--y1': `${CENTRO_MAPA.y}px`, ...vel } as React.CSSProperties;
      return (
        <div className="fx-capa" key={efecto.id}>
          <div className="fx-carta" style={st}>
            <div className="fx-onda" />
            <Carta {...efecto.carta} w={250} />
          </div>
          <div className="fx-rotulo" style={{ borderColor: efecto.color, ...vel }}>{efecto.texto}</div>
        </div>
      );
    }
    case 'mito': {
      const m = mito(efecto.mitoId);
      return (
        <div className={`fx-capa fx-mito-capa tier-${m.tier}`} key={efecto.id}>
          <div className="fx-destello" />
          <img className="fx-mito" src={IMG(`mitos/${m.id}`)} alt="" />
          <div className="fx-mito-nombre"><small>¡Aparece un mito {TIER_NOMBRE[m.tier].toLowerCase()}!</small>{m.nombre}<span>Ataque {m.ataque}</span></div>
        </div>
      );
    }
    case 'dados':
      return (
        <div className="fx-capa" key={efecto.id}>
          {/* Los dados salen girando encima del personaje de turno (en la tirada de orden ya se ven en el recuadro) */}
          {!(s.ordenTiradas && !s.orden) && <div className="fx-dados encima" style={{ left: DADOS.x, top: DADOS.y }}>
            {efecto.dados.map((v, i) => <div key={i} className="fx-dado gira" style={{ animationDelay: `${i * 90}ms`, ['--dx' as string]: `${(i - (efecto.dados.length - 1) / 2) * 120}px` }}><Dado v={v} grande /></div>)}
          </div>}
          <div className="fx-rotulo">{efecto.rotulo ?? `${efecto.texto} lanza los dados: ${efecto.dados.join(' + ')}`}</div>
        </div>
      );
    case 'resultado':
      return (
        <div className={`fx-capa fx-res fx-${efecto.r}`} key={efecto.id}>
          {efecto.r === 'gana' && <><div className="fx-rayos" /><div className="fx-cortes"><i /><i /><i /></div>{Array.from({ length: 14 }, (_, i) => <img key={i} className="fx-moneda" src={IMG(i % 3 ? 'objetos/oro' : 'objetos/guaca')} alt="" style={{ ['--a' as string]: `${(i / 14) * 360}deg`, ['--r' as string]: `${260 + (i % 4) * 60}px`, animationDelay: `${(i % 5) * 40}ms` }} />)}</>}
          {efecto.r === 'pierde' && <div className="fx-grietas" />}
          <div className="fx-res-texto">{efecto.r === 'gana' ? '¡Victoria!' : efecto.r === 'pierde' ? '¡Derrota!' : '¡Escapó!'}</div>
          <div className="fx-res-sub">{efecto.r === 'gana' ? efecto.texto : efecto.r === 'pierde' ? `${efecto.texto} sufre el castigo del mito` : `${efecto.texto} huye por el sendero`}</div>
        </div>
      );
    case 'sabotaje': {
      const o = origenJugador(efecto.de);
      const st = { '--x0': `${o.x}px`, '--y0': `${o.y}px`, '--x1': `${PANEL_COMBATE.x}px`, '--y1': `${PANEL_COMBATE.y}px` } as React.CSSProperties;
      return (
        <div className="fx-capa" key={efecto.id}>
          <div className="fx-d8" style={st}><Dado v={efecto.d8} color="azul" grande /></div>
          <div className="fx-rotulo azul" style={{ borderColor: efecto.color }}>{efecto.texto}</div>
        </div>
      );
    }
    case 'cobro': {
      // Las monedas y las guacas vuelan del combate al pueblo de quien cobra
      const o = origenJugador(efecto.de);
      return (
        <div className="fx-capa" key={efecto.id}>
          {Array.from({ length: 9 }, (_, i) => (
            <img key={i} className="fx-cobro" src={IMG(i < efecto.guacas * 2 ? 'cartas/dorso-morral' : 'objetos/oro')} alt=""
              style={{ ['--x0' as string]: `${PANEL_COMBATE.x + (i % 3 - 1) * 40}px`, ['--y0' as string]: `${PANEL_COMBATE.y + (i % 2) * 30}px`, ['--x1' as string]: `${o.x + (i % 3 - 1) * 50}px`, ['--y1' as string]: `${o.y}px`, animationDelay: `${i * 90}ms` }} />
          ))}
          <div className="fx-rotulo" style={{ borderColor: efecto.color }}>{efecto.texto}</div>
        </div>
      );
    }
    case 'construir':
      return (
        <div className="fx-capa" key={efecto.id}>
          <div className="fx-edificio"><div className="fx-chispas">{Array.from({ length: 10 }, (_, i) => <i key={i} style={{ ['--a' as string]: `${i * 36}deg` }} />)}</div><img src={IMG(EDIFICIOS[efecto.b].img)} alt="" /></div>
          <div className="fx-rotulo" style={{ borderColor: efecto.color }}>{efecto.texto}</div>
        </div>
      );
  }
}
