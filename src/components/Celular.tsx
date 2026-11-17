// Modo mesa: el celular de cada jugador es su mano privada y su control.
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
import { ApoyoCarta, Carta, Dado, Dados, DichoMini, propsMorral } from './Cartas';
import { Chat, ControlSonido } from './Controles';
import { Intercambio, Victoria } from './Modales';
import { useCuentaRegresiva } from './Mesa';

const SIGUIENTE: Record<string, string> = { plaza: 'Ir al Monte →', monte: 'Ir al Taller →', taller: 'Ir al Campo →', campo: 'Terminar turno ✓' };

interface Props { s: GameState; yo: number; sala: SalaInfo; dispatch: (a: Action) => void; chat: Mensaje[]; enviarChat: (t: string) => void; onSalir: () => void; convertirIA: (i: number) => void; espectador?: boolean; onVerMesa: () => void }

const horizontal = () => typeof window !== 'undefined' && window.innerWidth > window.innerHeight;
const anchoPantalla = () => Math.min(typeof window !== 'undefined' ? window.innerWidth : 390, 560);
const altoPantalla = () => (typeof window !== 'undefined' ? window.innerHeight : 800);

export function ControlCelular({ s, yo, sala, dispatch: enviar, chat, enviarChat, onSalir, convertirIA, espectador, onVerMesa }: Props) {
  const me = s.players[yo];
  const pnd = pendiente(s);
  const miTurno = s.current === yo && !pnd && s.winner === null;
  const [pestana, setPestana] = useState<'mano' | 'turno' | 'pueblo'>(() => (s.current === yo && !espectador ? 'turno' : 'mano'));
  const [verCarta, setVerCarta] = useState<number | null>(null);
  const [combateCerrado, setCombateCerrado] = useState('');
  const propia = useRef(0);
  // Candado contra toques dobles: una acción por estado y una pausa corta tras cambiar de zona
  const paso = s.paso ?? 0;
  const llegada = useRef({ paso, t: Date.now() });
  const enviado = useRef<{ paso: number; t: number } | null>(null);
  if (llegada.current.paso !== paso) llegada.current = { paso, t: Date.now() };
  const dispatch = (a: Action) => {
    const ahora = Date.now();
    if (a.t === 'next' && ahora - llegada.current.t < 600) return;
    if (enviado.current && enviado.current.paso === paso && ahora - enviado.current.t < 1500) return;
    enviado.current = { paso, t: ahora }; propia.current = ahora; enviar(a);
  };
  const aviso = useAvisosMano(s, me, propia);
  // Al empezar mi turno, se abre la pestaña del turno
  const claveTurno = s.current === yo && s.orden ? `${s.round}:${s.current}` : '';
  useEffect(() => { if (claveTurno) setPestana('turno'); }, [claveTurno]);
  const c = s.combat;
  const claveCombate = c ? `${s.round}:${s.current}:${c.mitoId}:${c.source}` : '';
  const enCombate = !!c && c.fighter === yo && s.phase === 'monte' && (c.step !== 'hecho' || combateCerrado !== claveCombate);
  const carta = verCarta !== null ? me.mano.find(x => x.uid === verCarta) : undefined;

  let cuerpo: React.ReactNode;
  if (s.winner !== null) cuerpo = <Victoria s={s} onNueva={onSalir} />;
  else if (pnd && pnd.player === yo) cuerpo = pnd.kind === 'orden' ? <CelOrden s={s} me={me} dispatch={dispatch} /> : <CelDecision s={s} me={me} sala={sala} dispatch={dispatch} onVer={setVerCarta} onVerMesa={onVerMesa} />;
  else if (enCombate) cuerpo = <CelCombate s={s} me={me} dispatch={dispatch} onCerrar={() => setCombateCerrado(claveCombate)} />;
  else cuerpo = (
    <div className="cel">
      <CelCabecera s={s} me={me} chip={miTurno ? 'Tu turno' : pnd ? `${s.players[pnd.player].nombre} decide` : `Turno de ${s.players[s.current].nombre}`} />
      <div className="cel-contenido">
      {pestana === 'mano' && <>
        {!miTurno && <CelEspera s={s} me={me} sala={sala} convertirIA={convertirIA} compacta />}
        <CelMano s={s} me={me} onVer={setVerCarta} />
      </>}
      {pestana === 'turno' && (miTurno
        ? <CelZona s={s} me={me} dispatch={dispatch} onVer={setVerCarta} />
        : <section className="cel-turno-espera"><CelEspera s={s} me={me} sala={sala} convertirIA={convertirIA} /><CelTira s={s} me={me} onVer={setVerCarta} /></section>)}
      {pestana === 'pueblo' && <CelPueblo s={s} me={me} dispatch={dispatch} miTurno={miTurno} chat={chat} enviarChat={enviarChat} onSalir={onSalir} />}
      </div>
      <nav className="cel-nav" aria-label="Secciones">
        <button className={pestana === 'mano' ? 'on' : ''} onClick={() => setPestana('mano')}>Mano · {me.mano.length}</button>
        <button className={`${pestana === 'turno' ? 'on' : ''} ${miTurno && pestana !== 'turno' ? 'avisa' : ''}`} onClick={() => setPestana('turno')}>{miTurno ? 'Mi turno' : 'Turno'}</button>
        <button className={`ver-mesa ${espectador ? 'dorado' : ''}`} onClick={onVerMesa}>{espectador ? '← Volver a la mesa' : 'Ver la mesa'}</button>
        <button className={pestana === 'pueblo' ? 'on' : ''} onClick={() => setPestana('pueblo')}>Pueblo</button>
      </nav>
    </div>
  );
  return (
    <>
      {cuerpo}
      {carta && <CartaGrande s={s} me={me} card={carta} miTurno={miTurno} dispatch={dispatch} onCerrar={() => setVerCarta(null)} />}
      {aviso && <div className={`cel-aviso ${aviso.tipo}`} key={aviso.id}>{aviso.texto}</div>}
    </>
  );
}

/** Avisa en el celular cuando entran cartas a tu mano o cuando otro te las quita. */
function useAvisosMano(s: GameState, me: Player, propia: React.MutableRefObject<number>) {
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
    } else if (entran.length) texto = `${entran.length > 1 ? `+${entran.length} cartas` : 'Nueva carta'}: ${entran.map(nombreCarta).join(', ')}`;
    if (!texto) return;
    setAviso({ id: Date.now(), texto, tipo });
    const t = setTimeout(() => setAviso(null), 4000);
    return () => clearTimeout(t);
  }, [me.mano, s.log, me.nombre, propia]);
  return aviso;
}

/** Tirada inicial del D6 para decidir el orden de turnos. */
function CelOrden({ s, me, dispatch }: { s: GameState; me: Player; dispatch: (a: Action) => void }) {
  const [rodando, setRodando] = useState(false);
  const mias = s.ordenTiradas?.[me.id] ?? [];
  const tirar = () => {
    if (rodando) return;
    setRodando(true);
    try { navigator.vibrate?.([30, 40, 30]); } catch { /* */ }
    setTimeout(() => { dispatch({ t: 'choose', id: 'tirar' }); setRodando(false); }, 700);
  };
  return (
    <div className="cel cel-orden">
      <header className="cel-cab compacta" style={{ background: me.color }}>
        <div className="cel-cab-fila"><img src={IMG(personaje(me.personaje).img)} alt="" /><div className="cel-cab-nom"><div>{me.nombre}</div><span>{personaje(me.personaje).nombre}</span></div></div>
      </header>
      <section className="cel-orden-cuerpo">
        <div className="cel-orden-tit">{mias.length ? '¡Empate! Vuelve a tirar' : '¿Quién empieza?'}</div>
        <div className="cel-nota">Tira el D6. El que saque más arranca y los demás siguen de mayor a menor.</div>
        <button className={`cel-orden-dado ${rodando ? 'rodando' : ''}`} onClick={tirar} aria-label="Tirar el dado">
          <Dado v={rodando ? 1 + Math.floor((Date.now() / 90) % 6) : mias[mias.length - 1] ?? 6} grande />
        </button>
        <button className="cel-boton" disabled={rodando} onClick={tirar}>{rodando ? 'Rodando…' : 'Tirar el D6'}</button>
        <OrdenLista s={s} />
      </section>
    </div>
  );
}
function OrdenLista({ s }: { s: GameState }) {
  return (
    <div className="cel-orden-lista">
      {s.players.map(q => {
        const t = s.ordenTiradas?.[q.id] ?? [];
        return <div key={q.id}><span style={{ color: q.color }}>{q.nombre}</span><b>{t.length ? t.join(' · ') : '—'}</b></div>;
      })}
    </div>
  );
}

/** Carta en grande, a pantalla completa, con su acción. */
function CartaGrande({ s, me, card, miTurno, dispatch, onCerrar }: { s: GameState; me: Player; card: MorralCard; miTurno: boolean; dispatch: (a: Action) => void; onCerrar: () => void }) {
  const [lanzando, setLanzando] = useState(false);
  const acc = accionCarta(s, me, card, miTurno);
  const w = Math.floor(horizontal() ? Math.min(380, (altoPantalla() - 36) * 5 / 7) : Math.min(anchoPantalla() - 48, 380, (altoPantalla() - 190) * 5 / 7));
  const lanzar = () => {
    if (!acc.accion || lanzando) return;
    const a = acc.accion;
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
        <button className={`cel-accion ${acc.tono}`} disabled={!acc.accion || lanzando} onClick={lanzar}>{acc.label}</button>
        <button className="cel-accion claro sec" onClick={onCerrar}>Cerrar</button>
      </div>
    </div>
  );
}

/** Tira horizontal de la mano (en la pestaña del turno y en las decisiones). */
function CelTira({ s: _s, me, onVer }: { s: GameState; me: Player; onVer: (uid: number) => void }) {
  if (!me.mano.length) return null;
  return (
    <section className="cel-tira" aria-label="Tu mano">
      <div className="cel-et claro">Tu mano · toca una carta para verla</div>
      <div className="cel-tira-fila">
        {me.mano.map(cd => <button key={cd.uid} className="cel-mini-btn" aria-label={nombreCarta(cd)} onClick={() => onVer(cd.uid)}><Carta {...propsMorral(cd)} w={96} compacta /></button>)}
      </div>
    </section>
  );
}

function Recursos({ p }: { p: Player }) {
  return (
    <div className="cel-recursos">
      <span><img src={IMG('objetos/oro')} alt="Oro" />{p.oro}</span>
      <span><img src={IMG('objetos/guaca')} alt="Guacas" />{p.guacas}</span>
      {(['G', 'M', 'B'] as MaterialId[]).map(k => <span key={k}><img src={IMG(MATERIALES[k].img)} alt={MATERIALES[k].nombre} />{p.mat[k]}</span>)}
      {(['puntilla', 'martillo', 'serrucho'] as ToolId[]).map(t => p.tools[t] > 0 && <span key={t}><img src={IMG(HERRAMIENTAS[t].img)} alt={HERRAMIENTAS[t].nombre} />{p.tools[t]}</span>)}
    </div>
  );
}

function CelCabecera({ s, me, chip }: { s: GameState; me: Player; chip: string }) {
  return (
    <header className="cel-cab" style={{ background: me.color }}>
      <div className="cel-cab-fila">
        <img src={IMG(personaje(me.personaje).img)} alt="" />
        <div className="cel-cab-nom"><div>{me.nombre}</div><span>{personaje(me.personaje).nombre.replace(/^(Don|Doña) /, '')} · Ronda {s.round}</span></div>
        <div className="cel-chip" style={{ color: me.color }}>{chip}</div>
      </div>
      <Recursos p={me} />
    </header>
  );
}

// ---------------- Zona actual (mi turno) ----------------
function CelZona({ s, me, dispatch, onVer }: { s: GameState; me: Player; dispatch: (a: Action) => void; onVer: (uid: number) => void }) {
  const [hoja, setHoja] = useState<null | 'apoyos' | 'trato'>(null);
  const zona = ZONAS.find(z => z.id === s.phase);
  const pj = personaje(me.personaje);
  let botones: React.ReactNode = null;
  if (s.phase === 'plaza') {
    botones = <>
      <button disabled={!!me.apoyo || s.evento === 'cierre'} onClick={() => setHoja('apoyos')}>{me.apoyo ? 'Ya tienes apoyo' : `Contratar apoyo`}</button>
      <button disabled={s.evento === 'cierre' || s.turn.intercambios >= maxIntercambios(s, me)} onClick={() => setHoja('trato')}>Intercambiar</button>
      {pj.momento === 'cualquiera' && <button className="dorado" disabled={!mainDisponible(s)} onClick={() => dispatch({ t: 'habilidad' })}>Habilidad D6</button>}
      {me.apoyo && <button className="dorado" disabled={!apoyoDisponible(s)} onClick={() => dispatch({ t: 'habilidadApoyo' })}>Apoyo D6</button>}
      {s.evento === 'errantes' && <button disabled={s.turn.guacaErrantes || me.oro < 5} onClick={() => dispatch({ t: 'guacaErrantes' })}>Guaca por 5 oro</button>}
    </>;
  } else if (s.phase === 'monte') {
    const last = s.lastMonte;
    botones = !s.turn.monteHecho
      ? <button className="rojo ancho" onClick={() => dispatch({ t: 'explorar' })}>Explorar el Monte</button>
      : <div className="cel-zona-info">{last?.kind === 'mito' && s.combat ? `${mito(s.combat.mitoId).nombre}: ${s.combat.result === 'gana' ? 'lo venciste' : s.combat.result === 'escapa' ? 'escapaste' : 'perdiste'}` : last?.kind === 'dicho' ? 'Salió un dicho (míralo en la mesa)' : 'Te saltas el Monte este turno'}</div>;
  } else if (s.phase === 'taller') {
    const sig = ORDEN_EDIFICIOS.find(b => !me.edificios[b]);
    const comprasMax = maxCompras(s) + (s.turn.tallerExtra ? 1 : 0);
    const deMazo = s.evento === 'aprendizaje' ? (['puntilla', 'martillo', 'serrucho'] as ToolId[]).filter(t => s.herramientas.includes(t) && !s.reveladas.includes(t)) : [];
    const danadas = ORDEN_EDIFICIOS.filter(b => me.edificios[b] === 'danada');
    botones = <>
      {[...new Set([...s.reveladas, ...deMazo])].map(t => <button key={t} className="con-img" disabled={s.turn.compras >= comprasMax || me.oro < precioHerramienta(s, me, t)} onClick={() => dispatch({ t: 'comprarHerramienta', tool: t })}><img src={IMG(HERRAMIENTAS[t].img)} alt="" />{HERRAMIENTAS[t].nombre} · {precioHerramienta(s, me, t)}</button>)}
      {sig && <button className="dorado ancho" disabled={!puedeConstruir(s)} onClick={() => dispatch({ t: 'construir' })}>Construir {EDIFICIOS[sig].nombre}</button>}
      {danadas.map(b => <button key={b} disabled={s.evento !== 'reparacion' && me.mat.G + me.mat.M + me.mat.B < 1} onClick={() => dispatch({ t: 'reparar', b })}>Reparar {EDIFICIOS[b].nombre}</button>)}
      {me.guardados.includes('tarde') && !s.turn.tallerExtra && <button onClick={() => dispatch({ t: 'usarTarde' })}>Taller doble</button>}
    </>;
  } else if (s.phase === 'campo') {
    const precio = precioMaterial(s, me);
    botones = <>
      {(['G', 'M', 'B'] as MaterialId[]).map(k => <button key={k} className="con-img" disabled={me.oro < precio} onClick={() => dispatch({ t: 'comprarMaterial', id: k })}><img src={IMG(MATERIALES[k].img)} alt="" />Comprar · {precio}</button>)}
      {(['G', 'M', 'B'] as MaterialId[]).filter(k => me.mat[k] > 0).map(k => <button key={'v' + k} className="con-img claro" onClick={() => dispatch({ t: 'vender', item: { k: 'mat', id: k } })}><img src={IMG(MATERIALES[k].img)} alt="" />Vender +{valorVenta(s, me, { k: 'mat' })}</button>)}
      {(['puntilla', 'martillo', 'serrucho'] as ToolId[]).filter(t => me.tools[t] > 0).map(t => <button key={t} className="con-img claro" onClick={() => dispatch({ t: 'vender', item: { k: 'tool', id: t } })}><img src={IMG(HERRAMIENTAS[t].img)} alt="" />Vender +{valorVenta(s, me, { k: 'tool', id: t })}</button>)}
    </>;
  }
  const sig = ORDEN_EDIFICIOS.find(b => !me.edificios[b]);
  const req = s.phase === 'taller' && sig ? requisitos(s, me, sig) : null;
  return (
    <div className="cel-turno">
    <section className="cel-zona" style={{ backgroundImage: `url(${IMG(zona?.img ?? 'escenarios/mapa')})` }}>
      <div className="cel-zona-velo" />
      <div className="cel-zona-tit">{zona?.nombre}</div>
      {req && sig && (
        <div className="cel-req">
          <span className={req.matsOk ? 'ok' : ''}>G·M·B</span>
          {EDIFICIOS[sig].herramientas.map(t => <span key={t} className={me.tools[t] > 0 ? 'ok' : ''}>{HERRAMIENTAS[t].nombre}</span>)}
          {req.guacas > 0 && <span className={req.guacasOk ? 'ok' : ''}>{req.guacas} guaca{req.guacas > 1 ? 's' : ''}</span>}
        </div>
      )}
      {s.phase === 'campo' && <div className="cel-req"><span className="ok">Cosechaste al llegar</span></div>}
      <div className="cel-zona-botones">{botones}</div>
      {hoja === 'apoyos' && (
        <div className="cel-hoja" onClick={() => setHoja(null)}>
          <div className="cel-hoja-caja" onClick={e => e.stopPropagation()}>
            <div className="cel-hoja-tit">Personajes de apoyo <button onClick={() => setHoja(null)}>×</button></div>
            <div className="cel-apoyos">
              {s.apoyosRevelados.map(id => (
                <ApoyoCarta key={id} id={id} w={160}>
                  <button className="btn chico" disabled={me.oro < precioApoyo(s)} onClick={() => { dispatch({ t: 'contratar', id }); setHoja(null); }}>Contratar ({precioApoyo(s)} oro)</button>
                </ApoyoCarta>
              ))}
            </div>
          </div>
        </div>
      )}
      {hoja === 'trato' && <Intercambio s={s} dispatch={dispatch} onCerrar={() => setHoja(null)} />}
    </section>
    <CelTira s={s} me={me} onVer={onVer} />
    <div className="cel-siguiente-wrap">
      <ZonasProgreso fase={s.phase} />
      <button className="cel-siguiente" disabled={!puedeAvanzar(s)} onClick={() => dispatch({ t: 'next' })}>{SIGUIENTE[s.phase]}</button>
    </div>
    </div>
  );
}
function ZonasProgreso({ fase }: { fase: string }) {
  const k = ZONAS.findIndex(z => z.id === fase);
  return <div className="cel-progreso">{ZONAS.map((z, i) => <span key={z.id} className={i < k ? 'hecha' : i === k ? 'aqui' : ''}>{z.nombre.split(' ')[0]}</span>)}</div>;
}

// ---------------- Esperando (turno de otro) ----------------
function CelEspera({ s, me, sala, convertirIA, compacta }: { s: GameState; me: Player; sala: SalaInfo; convertirIA: (i: number) => void; compacta?: boolean }) {
  const p = s.players[s.current];
  const c = s.combat;
  const desconectados = sala.soyHost ? s.players.filter(q => !q.ia && q.conectado === false && q.id !== me.id) : [];
  return (
    <section className={`cel-espera ${compacta ? 'compacta' : ''}`}>
      {s.ordenTiradas && !s.orden ? (
        <div className="cel-espera-caja"><div style={{ flex: 1 }}><div className="cel-espera-tit">Tirada para el orden</div><div className="cel-nota">Cada jugador tira un D6 en su celular.</div><OrdenLista s={s} /></div></div>
      ) : (
      <div className="cel-espera-caja">
        <img src={IMG(personaje(p.personaje).img)} alt="" />
        <div>
          <div className="cel-espera-tit" style={{ color: p.color }}>Turno de {p.nombre}</div>
          <div>{c && s.phase === 'monte' && c.step !== 'hecho' ? `Pelea contra ${mito(c.mitoId).nombre}.` : `Está en ${ZONAS.find(z => z.id === s.phase)?.nombre}.`}</div>
          {!compacta && <div className="cel-nota">Mira la mesa para seguir el juego. Si puedes reaccionar, te avisamos aquí.</div>}
        </div>
      </div>
      )}
      {desconectados.map(q => <button key={q.id} className="btn chico sec" onClick={() => convertirIA(q.id)}>{q.nombre} está desconectado: reemplazar por IA</button>)}
    </section>
  );
}

// ---------------- Mano en abanico ----------------
function accionCarta(s: GameState, me: Player, card: MorralCard, miTurno: boolean): { label: string; accion?: Action; tono: 'dorado' | 'rojo' | 'claro' } {
  if (card.kind === 'equipo') {
    if (miTurno && s.phase === 'plaza') return { label: `Equipar (+${card.golpe})`, accion: { t: 'equipar', uid: card.uid }, tono: 'dorado' };
    if (miTurno && s.phase === 'campo') return { label: `Vender (+${valorVenta(s, me, { k: 'carta', c: card })} oro)`, accion: { t: 'vender', item: { k: 'carta', uid: card.uid } }, tono: 'claro' };
    return { label: 'Se equipa en la Plaza', tono: 'claro' };
  }
  if (card.kind === 'comida') {
    if (miTurno && s.phase === 'campo') return { label: `Vender (+${valorVenta(s, me, { k: 'carta', c: card })} oro)`, accion: { t: 'vender', item: { k: 'carta', uid: card.uid } }, tono: 'claro' };
    return { label: 'Guárdala para el combate', tono: 'claro' };
  }
  if (miTurno && exagJugable(s, card.uid)) return { label: 'Jugar en la mesa', accion: { t: 'exag', uid: card.uid }, tono: 'rojo' };
  const m = exag(card.id).momento;
  const cuando = m === 'victoria-rival' ? 'Se juega cuando un rival vence (te avisamos)' : m === 'combate-rival' ? 'Se juega en el combate de un rival (te avisamos)' : m === 'combate-propio' ? 'Se juega en tu combate' : m === 'construir' ? 'Se usa sola al construir' : m === 'objetivo' ? 'Se usa cuando te atacan (te avisamos)' : 'Se juega en tu turno';
  return { label: cuando, tono: 'claro' };
}
function CelMano({ s: _s, me, onVer }: { s: GameState; me: Player; onVer: (uid: number) => void }) {
  const mano = me.mano;
  if (!mano.length) return <section className="cel-mano vacia"><div>Tu mano está vacía.</div><div className="cel-nota">Robas 1 carta del Morral cada vez que pasas por la Plaza.</div></section>;
  const w = horizontal() ? Math.max(130, Math.min(190, Math.floor((altoPantalla() - 60) * 5 / 7))) : Math.floor((anchoPantalla() - 14 * 2 - 12) / 2);
  return (
    <section className="cel-mano" aria-label="Tu mano">
      <div className="cel-mano-grid">
        {mano.map(cd => (
          <button key={cd.uid} className="cel-mano-carta" aria-label={`Ver ${nombreCarta(cd)}`} onClick={() => onVer(cd.uid)}>
            <Carta {...propsMorral(cd)} w={w} />
          </button>
        ))}
      </div>
      <div className="cel-mano-pie">{mano.length}/{limiteMano(me)} cartas · toca una para verla en grande{me.guardados.length > 0 && <> · guardados: {me.guardados.map((g, i) => <DichoMini key={i} id={g} />)}</>}</div>
    </section>
  );
}

// ---------------- Mi pueblo ----------------
function CelPueblo({ s, me, dispatch, miTurno, chat, enviarChat, onSalir }: { s: GameState; me: Player; dispatch: (a: Action) => void; miTurno: boolean; chat: Mensaje[]; enviarChat: (t: string) => void; onSalir: () => void }) {
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
      <h3>{personaje(me.personaje).nombre}</h3>
      <p className="cel-nota">{personaje(me.personaje).pasiva}</p>
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
function CelCombate({ s, me, dispatch, onCerrar }: { s: GameState; me: Player; dispatch: (a: Action) => void; onCerrar: () => void }) {
  const c = s.combat!;
  const m = mito(c.mitoId);
  const ataque = ataqueMito(s, c);
  const poder = c.dice.length ? poderJugador(s, c) : null;
  const rec = c.reward ?? RECOMPENSA[m.tier];
  const comidas = me.mano.filter(x => x.kind === 'comida');
  const lora = me.mano.find(x => x.kind === 'exag' && x.id === 'lora');
  const prob = probVictoria(s, me, ataque, c.bonus, false), probC = probVictoria(s, me, ataque, c.bonus, true);
  return (
    <div className="cel cel-combate" style={{ backgroundImage: `url(${IMG('escenarios/zona-monte')})` }}>
      <header className="cel-combate-cab"><span>¡A pelear!</span><b style={{ background: me.color }}>{me.nombre} · El Monte</b></header>
      <section className={`cel-combate-arte ${c.step === 'hecho' ? 'fx-' + c.result : ''} ${c.sabotage ? 'saboteada' : ''}`} key={`${c.mitoId}-${c.step === 'hecho'}`}>
        <img className="fondo" src={IMG(TIER_FONDO[m.tier])} alt="" />
        <img className="mito" src={IMG(`mitos/${m.id}`)} alt={m.nombre} />
        <div className="mesa-ataque chico">{ataque}</div>
        {c.step === 'hecho' && c.result === 'gana' && <div className="fx-cortes chico"><i /><i /><i /></div>}
        {c.step === 'hecho' && <div className={`cel-sello ${c.result}`}>{c.result === 'gana' ? '¡Victoria!' : c.result === 'escapa' ? '¡Escapaste!' : '¡Derrota!'}</div>}
        <div className="cel-combate-barra"><span>{m.nombre}</span><span><img src={IMG('objetos/oro')} alt="Oro" />{rec.oro} <img src={IMG('objetos/guaca')} alt="Guaca" />{rec.guacas}</span></div>
      </section>
      <section className="cel-combate-panel">
        <div className="mesa-marcador chico"><div className="verde">{poder ?? '?'}</div><span>contra</span><div className="rojo">{ataque}</div></div>
        {c.dice.length > 0 && <div className="cel-dados" key={c.dice.join("-")}><Dados valores={c.dice} descartado={c.dice.length === 3 ? Math.min(...c.dice) : undefined} /><span>{dadosUsados(c).join(' + ')} + {totalGolpe(me)} de equipo{c.bonus ? ` ${c.bonus > 0 ? '+' : '−'} ${Math.abs(c.bonus)}` : ''}{c.food ? <> + <Dado v={c.food.d8} color="azul" /></> : null}</span></div>}
        {c.sabotage && <div className="cel-nota"><Dado v={c.sabotage.d8} color="azul" /> sabotaje de {s.players[c.sabotage.by].nombre}</div>}
        {c.step === 'decidir' && <div className="cel-nota">Probabilidad de ganar: <b>{Math.round(prob * 100)}%</b>{comidas.length > 0 && <> · con comida <b>{Math.round(probC * 100)}%</b></>}</div>}
        {c.step === 'tirada' && <div className="cel-nota">{poder! >= ataque ? 'Vas ganando.' : `Te faltan ${ataque - poder!}.`} Cuando confirmes, tus rivales tendrán unos segundos para sabotear.</div>}
        {(c.step === 'rivales' || c.step === 'victoria') && <div className="cel-nota">Tus rivales deciden en sus celulares…</div>}
        {c.step === 'hecho' && <div className={`cel-resultado ${c.result === 'gana' || c.result === 'escapa' ? 'ok-txt' : 'err-txt'}`}>{c.result === 'gana' ? `¡Victoria! +${rec.oro} oro, +${rec.guacas} guaca${rec.guacas === 1 ? '' : 's'} y 1 material` : c.result === 'escapa' ? 'Escapaste sin castigo' : `Perdiste: ${m.texto}`}</div>}
      </section>
      {c.step === 'tirada' && !c.food && comidas.length > 0 && (
        <section className="cel-comer">
          <div className="cel-et">Potenciadores · opcional</div>
          <div className="cel-nota cel-pot-nota">Come algo para sumar 1 D8, o sigue sin usar nada.</div>
          <div className="cel-comer-grid">
            {comidas.map(x => x.kind === 'comida' && <button key={x.uid} onClick={() => dispatch({ t: 'comida', uid: x.uid })}><img src={IMG(x.img)} alt="" />{x.nombre}</button>)}
          </div>
        </section>
      )}
      <div className="cel-combate-acciones">
        {c.step === 'decidir' && <>
          {mainDisponible(s) && <button className="cel-boton claro" onClick={() => dispatch({ t: 'habilidad' })}>Bendición de Don Wilson (D6)</button>}
          <button className="cel-boton rojo" onClick={() => dispatch({ t: 'pelear' })}>¡Pelear!</button>
          {!c.noFlee && <button className="cel-boton claro" onClick={() => dispatch({ t: 'huir' })}>Huir (D6: {me.apoyo === 'abuelo' || me.copiaApoyo === 'abuelo' ? '4' : '5'} o más)</button>}
        </>}
        {c.step === 'tirada' && <>
          {lora && <button className="cel-boton claro" onClick={() => dispatch({ t: 'lora', uid: lora.uid })}>Potenciador: «Parapeto de lora» (dado bajo → 6)</button>}
          <button className="cel-boton" onClick={() => dispatch({ t: 'confirmar' })}>
            {c.food ? 'Confirmar tirada' : (comidas.length > 0 || lora) ? 'Seguir sin potenciador →' : 'Confirmar tirada'}
          </button>
          <div className="cel-nota cel-pot-ayuda">{poder! >= ataque ? `Vas ganando ${poder} contra ${ataque}.` : `Vas ${poder} contra ${ataque}: te faltan ${ataque - poder!}.`}</div>
        </>}
        {c.step === 'hecho' && <button className="cel-boton" onClick={onCerrar}>Continuar</button>}
      </div>
    </div>
  );
}

// ---------------- Decisiones y reacciones ----------------
function CelDecision({ s, me, sala, dispatch, onVer, onVerMesa }: { s: GameState; me: Player; sala: SalaInfo; dispatch: (a: Action) => void; onVer: (uid: number) => void; onVerMesa: () => void }) {
  const pnd = pendiente(s)!;
  const [elegida, setElegida] = useState<string | null>(null);
  const elegir = (id: string, lanzar: boolean) => {
    if (elegida) return;
    if (!lanzar) { dispatch({ t: 'choose', id }); return; }
    setElegida(id);
    try { navigator.vibrate?.(40); } catch { /* */ }
    setTimeout(() => { dispatch({ t: 'choose', id }); setElegida(null); }, 420);
  };
  const restante = useCuentaRegresiva(sala.limite && sala.limite.player === me.id ? sala.limite.hasta : null);
  const p = s.players[s.current];
  const salida = pnd.options.filter(o => o.id === 'pasar' || o.id === 'no');
  const ops = pnd.options.filter(o => !salida.includes(o));
  return (
    <div className="cel">
      <header className="cel-cab compacta" style={{ background: me.color }}>
        <div className="cel-cab-fila">
          <img src={IMG(personaje(me.personaje).img)} alt="" />
          <div className="cel-cab-nom"><div>{me.nombre}</div><span>{s.current === me.id ? 'Tu turno' : `Turno de ${p.nombre}`}</span></div>
          <button className="cel-chip cel-ver-mesa" onClick={onVerMesa}>Ver la mesa</button>
        </div>
      </header>
      <section className="cel-decision">
        <div className="cel-decision-cab">
          <div className="cel-decision-tit">{pnd.title}</div>
          {restante !== null && <div className="cel-reloj" aria-label={`Quedan ${restante} segundos`}>{restante}</div>}
        </div>
        {(pnd.img || pnd.text) && <div className="cel-decision-info">{pnd.img && <img src={IMG(pnd.img)} alt="" />}{pnd.text && <div>{pnd.text}</div>}</div>}
        {pnd.kind === 'reaccion' && <div className="cel-nota">Solo un rival puede sabotear cada combate.</div>}
      </section>
      <section className="cel-opciones">
        {ops.length > 0 && <div className="cel-et">{pnd.kind === 'reaccion' || pnd.kind === 'victoria-rival' ? 'Lanza una carta a la mesa' : 'Elige'}</div>}
        {ops.map(o => (
          <button key={o.id} className={`cel-opcion ${elegida === o.id ? 'lanzada' : ''}`} onClick={() => elegir(o.id, /^(food|perro|bizco|tigre|filo):/.test(o.id) || pnd.kind === 'exag-objetivo')}>
            {o.img ? <img src={IMG(o.img)} alt="" /> : (o.label.startsWith('«') || o.id.startsWith('bizco') || o.id.startsWith('perro') || o.id.startsWith('tigre') || o.id.startsWith('filo')) ? <span className="cel-opcion-exag" style={{ backgroundImage: `url(${IMG('cartas/ilustracion-exageraciones')})` }} /> : null}
            <span><b>{o.label}</b>{o.detail && <span>{o.detail}</span>}</span>
          </button>
        ))}
        {salida.map(o => <button key={o.id} className="cel-opcion salida" onClick={() => elegir(o.id, false)}>{o.label}</button>)}
      </section>
      <section className="cel-mano-mini" aria-label="Tu mano">
        <div className="cel-et claro">Tu mano · {me.mano.length} cartas · toca para ver</div>
        <div className="cel-mano-mini-fila">
          {me.mano.map(cd => <button key={cd.uid} className="cel-mini-btn" onClick={() => onVer(cd.uid)}><Carta {...propsMorral(cd)} w={78} compacta /></button>)}
        </div>
      </section>
    </div>
  );
}
