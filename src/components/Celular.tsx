// Modo mesa: el celular de cada jugador es su mano privada y su control.
import { useEffect, useState } from 'react';
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

interface Props { s: GameState; yo: number; sala: SalaInfo; dispatch: (a: Action) => void; chat: Mensaje[]; enviarChat: (t: string) => void; onSalir: () => void; convertirIA: (i: number) => void }

export function ControlCelular({ s, yo, sala, dispatch, chat, enviarChat, onSalir, convertirIA }: Props) {
  const me = s.players[yo];
  const pnd = pendiente(s);
  const miTurno = s.current === yo && !pnd && s.winner === null;
  const [pestana, setPestana] = useState<'mano' | 'pueblo'>('mano');
  const [combateCerrado, setCombateCerrado] = useState('');
  const c = s.combat;
  const claveCombate = c ? `${s.round}:${s.current}:${c.mitoId}:${c.source}` : '';
  const enCombate = !!c && c.fighter === yo && s.phase === 'monte' && (c.step !== 'hecho' || combateCerrado !== claveCombate);

  if (s.winner !== null) return <Victoria s={s} onNueva={onSalir} />;
  if (pnd && pnd.player === yo) return <CelDecision s={s} me={me} sala={sala} dispatch={dispatch} />;
  if (enCombate) return <CelCombate s={s} me={me} dispatch={dispatch} onCerrar={() => setCombateCerrado(claveCombate)} />;

  return (
    <div className="cel">
      <CelCabecera s={s} me={me} chip={miTurno ? 'Tu turno' : pnd ? `${s.players[pnd.player].nombre} decide` : `Turno de ${s.players[s.current].nombre}`} />
      {pestana === 'mano' ? (
        <>
          {miTurno ? <CelZona s={s} me={me} dispatch={dispatch} /> : <CelEspera s={s} me={me} sala={sala} convertirIA={convertirIA} />}
          <CelMano s={s} me={me} dispatch={dispatch} miTurno={miTurno} />
        </>
      ) : <CelPueblo s={s} me={me} dispatch={dispatch} miTurno={miTurno} chat={chat} enviarChat={enviarChat} onSalir={onSalir} />}
      <nav className="cel-nav" aria-label="Secciones">
        <button className={pestana === 'mano' ? 'on' : ''} onClick={() => setPestana('mano')}>Mano</button>
        <button className={pestana === 'pueblo' ? 'on' : ''} onClick={() => setPestana('pueblo')}>Mi pueblo</button>
        {miTurno && s.phase !== 'fin'
          ? <button className="sig" disabled={!puedeAvanzar(s)} onClick={() => { setPestana('mano'); dispatch({ t: 'next' }); }}>{SIGUIENTE[s.phase]}</button>
          : <button className={pestana === 'pueblo' ? '' : ''} onClick={() => setPestana('pueblo')}>Chat{chat.length ? ` (${chat.length})` : ''}</button>}
      </nav>
    </div>
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
function CelZona({ s, me, dispatch }: { s: GameState; me: Player; dispatch: (a: Action) => void }) {
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
  );
}

// ---------------- Esperando (turno de otro) ----------------
function CelEspera({ s, me, sala, convertirIA }: { s: GameState; me: Player; sala: SalaInfo; convertirIA: (i: number) => void }) {
  const p = s.players[s.current];
  const c = s.combat;
  const desconectados = sala.soyHost ? s.players.filter(q => !q.ia && q.conectado === false && q.id !== me.id) : [];
  return (
    <section className="cel-espera">
      <div className="cel-espera-caja">
        <img src={IMG(personaje(p.personaje).img)} alt="" />
        <div>
          <div className="cel-espera-tit" style={{ color: p.color }}>Turno de {p.nombre}</div>
          <div>{c && s.phase === 'monte' && c.step !== 'hecho' ? `Pelea contra ${mito(c.mitoId).nombre}.` : `Está en ${ZONAS.find(z => z.id === s.phase)?.nombre}.`}</div>
          <div className="cel-nota">Mira la mesa para seguir el juego. Si puedes reaccionar, te avisamos aquí.</div>
        </div>
      </div>
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
function CelMano({ s, me, dispatch, miTurno }: { s: GameState; me: Player; dispatch: (a: Action) => void; miTurno: boolean }) {
  const [sel, setSel] = useState(0);
  const [lanzando, setLanzando] = useState<number | null>(null);
  const mano = me.mano;
  useEffect(() => { if (sel >= mano.length) setSel(Math.max(0, mano.length - 1)); }, [mano.length, sel]);
  const card = mano[sel];
  const n = mano.length;
  if (!card) return <section className="cel-sel vacia"><div>Tu mano está vacía.</div><div className="cel-nota">Robas 1 carta del Morral cada vez que pasas por la Plaza.</div></section>;
  const acc = accionCarta(s, me, card, miTurno);
  const lanzar = () => {
    if (!acc.accion || lanzando !== null) return;
    const a = acc.accion;
    setLanzando(card.uid);
    try { navigator.vibrate?.(40); } catch { /* sin vibración */ }
    setTimeout(() => { dispatch(a); setLanzando(null); }, 480);
  };
  return (
    <>
      <section className="cel-sel">
        <div className={`cel-carta-wrap ${lanzando === card.uid ? 'lanzada' : ''}`} key={card.uid}>
          <Carta {...propsMorral(card)} w={200} />
        </div>
        {lanzando === card.uid && <div className="cel-a-la-mesa">¡A la mesa!</div>}
        <button className={`cel-accion ${acc.tono}`} disabled={!acc.accion || lanzando !== null} onClick={lanzar}>{acc.label}</button>
      </section>
      <section className="cel-abanico" aria-label="Tu mano">
        <div className="cel-abanico-fila">
          {mano.map((cd, i) => {
            const ang = (i - (n - 1) / 2) * Math.min(8, 40 / Math.max(1, n));
            const elegida = i === sel;
            const ancho = Math.min(typeof window !== 'undefined' ? window.innerWidth : 390, 560) - 24;
            const pasoX = n > 1 ? Math.min(84, (ancho - 88) / (n - 1)) : 88;
            const margen = (pasoX - 88) / 2;
            return (
              <button key={cd.uid} className={`cel-mini-btn ${elegida ? 'sel' : ''}`} aria-label={nombreCarta(cd)} onClick={() => setSel(i)}
                style={{ transform: `rotate(${ang}deg) translateY(${elegida ? -20 : Math.abs(i - (n - 1) / 2) * 4}px)`, marginLeft: margen, marginRight: margen, zIndex: i }}>
                <Carta {...propsMorral(cd)} w={88} compacta sel={elegida} />
              </button>
            );
          })}
        </div>
        <div className="cel-abanico-pie">{n}/{limiteMano(me)} cartas{me.guardados.length > 0 && <> · guardados: {me.guardados.map((g, i) => <DichoMini key={i} id={g} />)}</>}</div>
      </section>
    </>
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
          <div className="cel-et">Comer antes de confirmar (+D8)</div>
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
          {lora && <button className="cel-boton claro" onClick={() => dispatch({ t: 'lora', uid: lora.uid })}>«Parapeto de lora»: dado bajo → 6</button>}
          <button className="cel-boton" onClick={() => dispatch({ t: 'confirmar' })}>Confirmar tirada</button>
        </>}
        {c.step === 'hecho' && <button className="cel-boton" onClick={onCerrar}>Continuar</button>}
      </div>
    </div>
  );
}

// ---------------- Decisiones y reacciones ----------------
function CelDecision({ s, me, sala, dispatch }: { s: GameState; me: Player; sala: SalaInfo; dispatch: (a: Action) => void }) {
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
        <div className="cel-et claro">Tu mano · {me.mano.length} cartas</div>
        <div className="cel-mano-mini-fila">
          {me.mano.map(cd => <Carta key={cd.uid} {...propsMorral(cd)} w={78} compacta />)}
        </div>
      </section>
    </div>
  );
}
