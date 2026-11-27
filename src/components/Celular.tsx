// Piezas de control que se abren encima de la mesa: carta en grande, tu pueblo, avisos de la mano.
import { useEffect, useRef, useState } from 'react';
import {
  IMG, ZONAS, personaje, apoyo, HERRAMIENTAS, MATERIALES, EDIFICIOS, ORDEN_EDIFICIOS, MaterialId, ToolId, Slot, SLOT_NOMBRE, exag, mito,
  TIER_FONDO, RECOMPENSA, FOOD_NOMBRE,
} from '../game/data';
import {
  Action, GameState, MorralCard, Player, pendiente, puedeAvanzar, mainDisponible, apoyoDisponible, precioApoyo, precioHerramienta, precioMaterial,
  maxCompras, maxIntercambios, puedeConstruir, requisitos, valorVenta, exagJugable, totalGolpe, limiteMano, ataqueMito, poderJugador, dadosUsados,
  probVictoria, nombreCarta,
} from '../game/engine';
import { SalaInfo, Mensaje } from '../net/red';
import { ApoyoCarta, Carta, Dado, Dados, DichoMini, PersonajeCarta, Precio, propsMorral, RequisitosConstruccion } from './Cartas';
import { Chat, ControlSonido } from './Controles';
import { Intercambio, Victoria } from './Modales';
import { useCuentaRegresiva } from './Mesa';

export const SIGUIENTE: Record<string, string> = { plaza: 'Ir al Monte →', monte: 'Ir al Taller →', taller: 'Ir al Campo →', campo: 'Terminar turno ✓' };


const horizontal = () => typeof window !== 'undefined' && window.innerWidth > window.innerHeight;
const anchoPantalla = () => Math.min(typeof window !== 'undefined' ? window.innerWidth : 390, 560);
const altoPantalla = () => (typeof window !== 'undefined' ? window.innerHeight : 800);

/** Avisa en el celular cuando entran cartas a tu mano o cuando otro te las quita. */
export function useAvisosMano(s: GameState, me: Player, propia: React.MutableRefObject<number>) {
  const antes = useRef<Map<number, MorralCard> | null>(null);
  const logVisto = useRef(s.log.length ? s.log[s.log.length - 1].n ?? s.log.length : 0);
  const [aviso, setAviso] = useState<{ id: number; texto: string; tipo: 'gana' | 'pierde' } | null>(null);
  useEffect(() => {
    const ahora = new Map(me.mano.map(c => [c.uid, c] as const));
    const prev = antes.current; antes.current = ahora;
    const ultimo = s.log.length ? s.log[s.log.length - 1].n ?? s.log.length : 0;
    const nuevos = s.log.filter((e, k) => (e.n ?? k + 1) > logVisto.current).map(e => e.t);
    logVisto.current = ultimo;
    if (!prev) return;
    const entran = me.mano.filter(c => !prev.has(c.uid));
    const salen = [...prev.values()].filter(c => !ahora.has(c.uid));
    const mia = Date.now() - propia.current < 2500;
    let texto = '', tipo: 'gana' | 'pierde' = 'gana';

    if (salen.length && !mia) {
      const razon = [...nuevos].reverse().find(t => (t.includes(me.nombre) || /^Todos/.test(t)) && /roba|descarta|pasan|pierde|quita|da /.test(t));
      texto = `Se fue de tu mano: ${salen.map(nombreCarta).join(', ')}${entran.length ? ` · Recibiste: ${entran.map(nombreCarta).join(', ')}` : ''}${razon ? ` — ${razon}` : ''}`; tipo = 'pierde';
    } else if (entran.length) texto = `${entran.length > 1 ? `+${entran.length} guacas` : 'Nueva guaca'} a tu mano: ${entran.map(nombreCarta).join(', ')}`;
    // Recompensa de un combate: oro y material (las guacas ya van arriba)
    const cobro = nuevos.filter(t => t.startsWith(me.nombre + ' ')).map(t => t.match(/ gana (\d+) oro\.$/)?.[1] ? `+${t.match(/ gana (\d+) oro\.$/)![1]} oro` : t.match(/ recoge 1 (.+)\.$/) ? `+1 ${t.match(/ recoge 1 (.+)\.$/)![1]}` : '').filter(Boolean);
    if (cobro.length) { texto = `Cobraste: ${cobro.join(' · ')}${texto && tipo === 'gana' ? ` · ${texto}` : ''}`; tipo = 'gana'; }
    if (!texto) return;
    setAviso({ id: Date.now(), texto, tipo });
    const t = setTimeout(() => setAviso(null), 4000);
    return () => clearTimeout(t);
  }, [me.mano, s.log, me.nombre, propia]);
  return aviso;
}

/** Tirada inicial del D6 para decidir el orden de turnos. */
export function CartaGrande({ s, me, card, miTurno, dispatch, onCerrar }: { s: GameState; me: Player; card: MorralCard; miTurno: boolean; dispatch: (a: Action) => void; onCerrar: () => void }) {
  const [lanzando, setLanzando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const acc = accionCarta(s, me, card, miTurno);
  // Si ya tienes algo equipado en esa ranura, se pregunta antes de reemplazarlo
  const actual = card.kind === 'equipo' ? me.equipo[card.slot] : undefined;
  // En la Plaza, el equipo de la mano también se puede vender (además de equiparlo)
  const venta: Action | null = miTurno && s.phase === 'plaza' && card.kind === 'equipo' ? { t: 'vender', item: { k: 'carta', uid: card.uid } } : null;
  const w = Math.floor(horizontal() ? Math.min(380, (altoPantalla() - 36) * 5 / 7) : Math.min(anchoPantalla() - 48, 380, (altoPantalla() - 190) * 5 / 7));
  const lanzar = (otra?: Action) => {
    const a = otra ?? acc.accion;
    if (!a || lanzando) return;
    setLanzando(true);
    try { navigator.vibrate?.(40); } catch { /* */ }
    setTimeout(() => { dispatch(a); onCerrar(); }, 480);
  };
  return (
    <div className="cel-verla" role="dialog" aria-label={nombreCarta(card)} onClick={onCerrar}>
      <div className={`cel-carta-wrap ${lanzando ? 'lanzada' : ''}`} onClick={e => e.stopPropagation()}>
        <Carta {...propsMorral(card)} w={w} />
      </div>
      {lanzando && <div className="cel-a-la-mesa">¡A la mesa!</div>}
      <div className="cel-verla-botones" onClick={e => e.stopPropagation()}>
        {confirmar && actual && card.kind === 'equipo' ? (
          <div className="cel-reemplazo">
            <div className="cel-reemplazo-tit">¿Reemplazar tu {SLOT_NOMBRE[card.slot].toLowerCase()}?</div>
            <div className="cel-reemplazo-cmp">
              <div><img src={IMG(actual.img)} alt="" /><b>{actual.nombre}</b><span>+{actual.golpe}</span><em>Se descarta</em></div>
              <i aria-hidden="true">→</i>
              <div className="nuevo"><img src={IMG(card.img)} alt="" /><b>{card.nombre}</b><span>+{card.golpe}</span><em>{card.golpe > actual.golpe ? `Ganas +${card.golpe - actual.golpe}` : card.golpe < actual.golpe ? `Pierdes ${actual.golpe - card.golpe}` : 'Igual golpe'}</em></div>
            </div>
            <button className="cel-accion dorado" onClick={() => lanzar()}>Sí, reemplazar</button>
            <button className="cel-accion claro sec" onClick={() => setConfirmar(false)}>No, dejar el {actual.nombre}</button>
          </div>
        ) : <>
          <button className={`cel-accion ${acc.tono}`} disabled={!acc.accion || lanzando} onClick={() => (actual && acc.accion?.t === 'equipar' ? setConfirmar(true) : lanzar())}>
            {actual && acc.accion?.t === 'equipar' ? `Equipar (reemplaza ${actual.nombre})` : acc.label}
          </button>
          {venta && <button className="cel-accion claro" disabled={lanzando} onClick={() => lanzar(venta)}>Vender <Precio signo="+" n={valorVenta(s, me, { k: 'carta', c: card })} /></button>}
          <button className="cel-accion claro sec" onClick={onCerrar}>Cerrar</button>
        </>}
      </div>
    </div>
  );
}

/** Tira horizontal de la mano (en la pestaña del turno y en las decisiones). */
export function Recursos({ p }: { p: Player }) {
  return (
    <div className="cel-recursos">
      <span><img src={IMG('objetos/oro')} alt="Oro" />{p.oro}</span>
      {(['G', 'M', 'B'] as MaterialId[]).map(k => <span key={k}><img src={IMG(MATERIALES[k].img)} alt={MATERIALES[k].nombre} />{p.mat[k]}</span>)}
      {(['puntilla', 'martillo', 'serrucho'] as ToolId[]).map(t => p.tools[t] > 0 && <span key={t}><img src={IMG(HERRAMIENTAS[t].img)} alt={HERRAMIENTAS[t].nombre} />{p.tools[t]}</span>)}
    </div>
  );
}

export function accionCarta(s: GameState, me: Player, card: MorralCard, miTurno: boolean): { label: React.ReactNode; accion?: Action; tono: 'dorado' | 'rojo' | 'claro' } {
  if (card.kind === 'equipo') {
    if (miTurno && s.phase === 'plaza') return { label: `Equipar (+${card.golpe})`, accion: { t: 'equipar', uid: card.uid }, tono: 'dorado' };
    if (miTurno && s.phase === 'campo') return { label: <>Vender <Precio signo="+" n={valorVenta(s, me, { k: 'carta', c: card })} /></>, accion: { t: 'vender', item: { k: 'carta', uid: card.uid } }, tono: 'claro' };
    return { label: 'Se equipa o se vende en la Plaza', tono: 'claro' };
  }
  if (card.kind === 'comida') {
    if (miTurno && (s.phase === 'campo' || s.phase === 'plaza')) return { label: <>Vender <Precio signo="+" n={valorVenta(s, me, { k: 'carta', c: card })} /></>, accion: { t: 'vender', item: { k: 'carta', uid: card.uid } }, tono: 'claro' };
    return { label: 'Guárdala para el combate', tono: 'claro' };
  }
  if (miTurno && exagJugable(s, card.uid)) return { label: 'Jugar en la mesa', accion: { t: 'exag', uid: card.uid }, tono: 'rojo' };
  const m = exag(card.id).momento;
  const cuando = m === 'victoria-rival' ? 'Se juega cuando un rival vence (te avisamos)' : m === 'combate-rival' ? 'Se juega en el combate de un rival (te avisamos)' : m === 'combate-propio' ? 'Se juega en tu combate' : m === 'construir' ? 'Se usa sola al construir' : m === 'objetivo' ? 'Se usa cuando te atacan (te avisamos)' : 'Se juega en tu turno';
  return { label: cuando, tono: 'claro' };
}
// ---------------- Mi pueblo ----------------
export function CelPueblo({ s, me, dispatch, miTurno, chat, enviarChat, onSalir }: { s: GameState; me: Player; dispatch: (a: Action) => void; miTurno: boolean; chat: Mensaje[]; enviarChat: (t: string) => void; onSalir: () => void }) {
  return (
    <section className="cel-pueblo">
      <h3>Equipo · golpe +{totalGolpe(me)}</h3>
      <div className="cel-slots">
        {(['arma', 'prenda', 'montura'] as Slot[]).map(k => <div key={k} className="cel-slot">{me.equipo[k] ? <><img src={IMG(me.equipo[k]!.img)} alt="" /><span>{me.equipo[k]!.nombre} +{me.equipo[k]!.golpe}</span></> : <span className="vacio">{SLOT_NOMBRE[k]}</span>}</div>)}
      </div>
      <h3>Pueblo</h3>
      <div className="cel-slots">
        {ORDEN_EDIFICIOS.map(b => <div key={b} className={`cel-slot edif ${me.edificios[b] ?? 'no'}`}><img src={IMG(me.edificios[b] === 'danada' ? EDIFICIOS[b].imgDanada : EDIFICIOS[b].img)} alt="" /><span>{EDIFICIOS[b].nombre}{me.edificios[b] === 'danada' ? ' (dañada)' : ''}</span></div>)}
      </div>
      <h3>Para construir</h3>
      <RequisitosConstruccion p={me} />
      <h3>Tu personaje</h3>
      <div className="cel-pj-carta"><PersonajeCarta id={me.personaje} w={210} /></div>
      {me.apoyo && (
        <>
          <h3>Apoyo</h3>
          <div className="cel-apoyo-fila">
            <img src={IMG(apoyo(me.apoyo).img)} alt="" />
            <div><b>{apoyo(me.apoyo).nombre}</b><div className="cel-nota">{apoyo(me.apoyo).pasiva}</div></div>
          </div>
          {miTurno && <div className="fila-botones"><button className="btn chico" disabled={!apoyoDisponible(s)} onClick={() => dispatch({ t: 'habilidadApoyo' })}>Habilidad del apoyo (D6)</button>{s.phase === 'plaza' && <button className="btn chico sec" onClick={() => dispatch({ t: 'soltarApoyo' })}>Dejarlo ir</button>}</div>}
        </>
      )}
      <h3>Chat de la mesa</h3>
      <Chat chat={chat} enviar={enviarChat} />
      <div className="fila-botones"><ControlSonido /><button className="btn chico sec" onClick={onSalir}>Salir de la mesa</button></div>
    </section>
  );
}

// ---------------- Combate ----------------
/** Texto de la recompensa, contando si un rival la anuló («Mató el tigre…») o se quedó con el oro («Filo»). */
export function textoRecompensa(s: GameState, c: NonNullable<GameState['combat']>, rec: { oro: number; guacas: number }) {
  const recientes = s.log.slice(-14).map(e => e.t);
  const anulo = [...recientes].reverse().find(t => t.includes('sin recompensa'));
  const robo = [...recientes].reverse().find(t => t.includes('se queda con'));
  const partes = [rec.oro ? `+${rec.oro} oro` : '', rec.guacas ? `+${rec.guacas} guaca${rec.guacas === 1 ? '' : 's'} (cartas a tu mano)` : '', '+1 material'].filter(Boolean).join(', ');
  let extra = '';
  if (anulo) extra = ` · ${anulo.split(' juega')[0]} te anuló el oro y las guacas con «Mató el tigre».`;
  else if (robo) extra = ` · ${robo.split(' juega')[0]} se quedó con tu oro con «Filo».`;
  void c;
  return `¡Victoria! ${partes}${extra}`;
}

// ---------------- Decisiones y reacciones ----------------
/** Si la opción se refiere a una carta de la mano (p. ej. «food:12», «filo:30» o el uid solo), devuelve esa carta. */
export function cartaDeOpcion(id: string, me: Player): MorralCard | undefined {
  const uid = Number(id.split(':').pop());
  return Number.isFinite(uid) && uid > 0 ? me.mano.find(c => c.uid === uid) : undefined;
}
