// Controles del jugador dentro de la misma mesa: acciones de la zona, combate, decisiones y tirada de orden.
// Todo se juega desde la escena; las ventanas grandes (carta, apoyos, intercambio, pueblo) se abren encima.
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IMG, ZONAS, personaje, HERRAMIENTAS, MATERIALES, EDIFICIOS, ORDEN_EDIFICIOS, MaterialId, ToolId, mito } from '../game/data';
import {
  Action, GameState, Player, pendiente, puedeAvanzar, mainDisponible, apoyoDisponible, precioApoyo, precioHerramienta, precioMaterial,
  maxCompras, maxIntercambios, puedeConstruir, valorVenta, ataqueMito, poderJugador, probVictoria,
} from '../game/engine';
import { SalaInfo } from '../net/red';
import { ApoyoCarta, Carta, Precio, propsMorral, RequisitosConstruccion } from './Cartas';
import { Intercambio } from './Modales';
import { SIGUIENTE, cartaDeOpcion, textoRecompensa } from './Celular';
import { useCuentaRegresiva } from './Mesa';
import { RECOMPENSA } from '../game/data';

/** Candado contra toques dobles: una acción por estado y una pausa corta tras cambiar de zona. */
export function useDispatchSeguro(s: GameState, enviar: (a: Action) => void) {
  const paso = s.paso ?? 0;
  const llegada = useRef({ paso, t: Date.now() });
  const enviado = useRef<{ paso: number; t: number } | null>(null);
  const propia = useRef(0);
  if (llegada.current.paso !== paso) llegada.current = { paso, t: Date.now() };
  const dispatch = (a: Action) => {
    const ahora = Date.now();
    if (a.t === 'next' && ahora - llegada.current.t < 600) return;
    if (enviado.current && enviado.current.paso === paso && ahora - enviado.current.t < 1500) return;
    enviado.current = { paso, t: ahora }; propia.current = ahora; enviar(a);
  };
  return { dispatch, propia };
}

/** Las ventanas grandes se dibujan fuera del escenario escalado, a tamaño de pantalla. */
export const Encima = ({ children }: { children: React.ReactNode }) => createPortal(children, document.body);

// ---------------- Acciones de la zona (tu turno) ----------------
export function PanelZona({ s, me, dispatch }: { s: GameState; me: Player; dispatch: (a: Action) => void }) {
  const [hoja, setHoja] = useState<null | 'apoyos' | 'trato'>(null);
  const zona = ZONAS.find(z => z.id === s.phase);
  const pj = personaje(me.personaje);
  let botones: React.ReactNode = null;
  let info: React.ReactNode = null;
  if (s.phase === 'plaza') {
    botones = <>
      <button disabled={!!me.apoyo || s.evento === 'cierre'} onClick={() => setHoja('apoyos')}>{me.apoyo ? 'Ya tienes apoyo' : <>Contratar apoyo · <Precio n={precioApoyo(s)} /></>}</button>
      <button disabled={s.evento === 'cierre' || s.turn.intercambios >= maxIntercambios(s, me)} onClick={() => setHoja('trato')}>Intercambiar</button>
      {pj.momento === 'cualquiera' && <button className="dorado" disabled={!mainDisponible(s)} onClick={() => dispatch({ t: 'habilidad' })}>Habilidad D6</button>}
      {me.apoyo && <button className="dorado" disabled={!apoyoDisponible(s)} onClick={() => dispatch({ t: 'habilidadApoyo' })}>Apoyo D6</button>}
      {me.apoyo && <button className="claro" onClick={() => dispatch({ t: 'soltarApoyo' })}>Dejar ir al apoyo</button>}
      {s.evento === 'errantes' && <button disabled={s.turn.guacaErrantes || me.oro < 5} onClick={() => dispatch({ t: 'guacaErrantes' })}>Guaca por <Precio n={5} /></button>}
    </>;
    info = <div className="acc-nota">Toca una carta de tu mano para equiparla o venderla.</div>;
  } else if (s.phase === 'monte') {
    const last = s.lastMonte;
    if (!s.turn.monteHecho) botones = <button className="rojo ancho" onClick={() => dispatch({ t: 'explorar' })}>Explorar el Monte</button>;
    else info = <div className="acc-nota">{last?.kind === 'mito' && s.combat ? `${mito(s.combat.mitoId).nombre}: ${s.combat.result === 'gana' ? 'lo venciste' : s.combat.result === 'escapa' ? 'escapaste' : 'perdiste'}` : last?.kind === 'dicho' ? 'Salió un dicho' : 'Te saltas el Monte este turno'}</div>;
  } else if (s.phase === 'taller') {
    const sig = ORDEN_EDIFICIOS.find(b => !me.edificios[b]);
    const comprasMax = maxCompras(s) + (s.turn.tallerExtra ? 1 : 0);
    const deMazo = s.evento === 'aprendizaje' ? (['puntilla', 'martillo', 'serrucho'] as ToolId[]).filter(t => s.herramientas.includes(t) && !s.reveladas.includes(t)) : [];
    const danadas = ORDEN_EDIFICIOS.filter(b => me.edificios[b] === 'danada');
    botones = <>
      {[...new Set([...s.reveladas, ...deMazo])].map(t => <button key={t} className="con-img" disabled={s.turn.compras >= comprasMax || me.oro < precioHerramienta(s, me, t)} onClick={() => dispatch({ t: 'comprarHerramienta', tool: t })}><img src={IMG(HERRAMIENTAS[t].img)} alt="" />{HERRAMIENTAS[t].nombre} <Precio n={precioHerramienta(s, me, t)} /></button>)}
      {sig && <button className="dorado ancho" disabled={!puedeConstruir(s)} onClick={() => dispatch({ t: 'construir' })}>Construir {EDIFICIOS[sig].nombre}</button>}
      {danadas.map(b => <button key={b} disabled={s.evento !== 'reparacion' && me.mat.G + me.mat.M + me.mat.B < 1} onClick={() => dispatch({ t: 'reparar', b })}>Reparar {EDIFICIOS[b].nombre}</button>)}
      {me.guardados.includes('tarde') && !s.turn.tallerExtra && <button onClick={() => dispatch({ t: 'usarTarde' })}>Taller doble</button>}
    </>;
    if (sig) info = <RequisitosConstruccion p={me} soloSiguiente />;
  } else if (s.phase === 'campo') {
    const precio = precioMaterial(s, me);
    botones = <>
      {(['G', 'M', 'B'] as MaterialId[]).map(k => <button key={k} className="con-img" disabled={me.oro < precio} onClick={() => dispatch({ t: 'comprarMaterial', id: k })}><img src={IMG(MATERIALES[k].img)} alt="" />Comprar <Precio n={precio} /></button>)}
      {(['G', 'M', 'B'] as MaterialId[]).filter(k => me.mat[k] > 0).map(k => <button key={'v' + k} className="con-img claro" onClick={() => dispatch({ t: 'vender', item: { k: 'mat', id: k } })}><img src={IMG(MATERIALES[k].img)} alt="" />Vender <Precio signo="+" n={valorVenta(s, me, { k: 'mat' })} /></button>)}
      {(['puntilla', 'martillo', 'serrucho'] as ToolId[]).filter(t => me.tools[t] > 0).map(t => <button key={t} className="con-img claro" onClick={() => dispatch({ t: 'vender', item: { k: 'tool', id: t } })}><img src={IMG(HERRAMIENTAS[t].img)} alt="" />Vender <Precio signo="+" n={valorVenta(s, me, { k: 'tool', id: t })} /></button>)}
    </>;
    info = <div className="acc-nota ok">Cosechaste al llegar. Toca una carta de tu mano para venderla.</div>;
  }
  return (
    <aside className="acc-panel" aria-label="Tus acciones">
      <div className="acc-tit"><span>Tu turno</span>{zona?.nombre}</div>
      {info}
      <div className="acc-botones">{botones}</div>
      <button className="acc-siguiente" disabled={!puedeAvanzar(s)} onClick={() => dispatch({ t: 'next' })}>{SIGUIENTE[s.phase]}</button>
      {hoja === 'apoyos' && (
        <Encima>
          <div className="cel-hoja" onClick={() => setHoja(null)}>
            <div className="cel-hoja-caja" onClick={e => e.stopPropagation()}>
              <div className="cel-hoja-tit">Personajes de apoyo <button onClick={() => setHoja(null)}>×</button></div>
              <div className="cel-apoyos">
                {s.apoyosRevelados.map(id => (
                  <ApoyoCarta key={id} id={id} w={160}>
                    <button className="btn chico" disabled={me.oro < precioApoyo(s)} onClick={() => { dispatch({ t: 'contratar', id }); setHoja(null); }}>Contratar · <Precio n={precioApoyo(s)} /></button>
                  </ApoyoCarta>
                ))}
              </div>
            </div>
          </div>
        </Encima>
      )}
      {hoja === 'trato' && <Encima><Intercambio s={s} dispatch={dispatch} onCerrar={() => setHoja(null)} /></Encima>}
    </aside>
  );
}

// ---------------- Tu combate ----------------
export function AccionesCombate({ s, me, dispatch, x, y }: { s: GameState; me: Player; dispatch: (a: Action) => void; x: number; y: number }) {
  const c = s.combat!;
  const m = mito(c.mitoId);
  const ataque = ataqueMito(s, c);
  const poder = c.dice.length ? poderJugador(s, c) : null;
  const comidas = me.mano.filter(k => k.kind === 'comida');
  const lora = me.mano.find(k => k.kind === 'exag' && k.id === 'lora');
  const rec = c.reward ?? RECOMPENSA[m.tier];
  let cuerpo: React.ReactNode = null;
  if (c.step === 'decidir') {
    const prob = probVictoria(s, me, ataque, c.bonus, false), probC = probVictoria(s, me, ataque, c.bonus, true);
    cuerpo = <>
      <div className="acc-nota">Probabilidad de ganar: <b>{Math.round(prob * 100)}%</b>{comidas.length > 0 && <> · con comida <b>{Math.round(probC * 100)}%</b></>}</div>
      <div className="acc-fila">
        {mainDisponible(s) && <button className="dorado" onClick={() => dispatch({ t: 'habilidad' })}>Bendición de Don Wilson (D6)</button>}
        <button className="rojo grande" onClick={() => dispatch({ t: 'pelear' })}>¡Pelear!</button>
        {!c.noFlee && <button className="claro" onClick={() => dispatch({ t: 'huir' })}>Huir (D6: {me.apoyo === 'abuelo' || me.copiaApoyo === 'abuelo' ? '4' : '5'}+)</button>}
      </div>
    </>;
  } else if (c.step === 'tirada') {
    // El botón de confirmar va primero para que siempre se vea; las comidas quedan debajo en una cuadrícula compacta
    cuerpo = <>
      <div className="acc-nota">{poder! >= ataque ? `Vas ganando ${poder} contra ${ataque}.` : `Vas ${poder} contra ${ataque}: te faltan ${ataque - poder!}.`}</div>
      <div className="acc-fila">
        <button className="dorado grande" onClick={() => dispatch({ t: 'confirmar' })}>{c.food ? 'Confirmar tirada' : (comidas.length > 0 || lora) ? 'Seguir sin comer →' : 'Confirmar tirada'}</button>
      </div>
      {!c.food && (comidas.length > 0 || lora) && <div className="acc-sub">O come algo para sumar 1 D8:</div>}
      {!c.food && comidas.length > 0 && (
        <div className="acc-comidas">
          {comidas.map(k => k.kind === 'comida' && <button key={k.uid} onClick={() => dispatch({ t: 'comida', uid: k.uid })} title={`${k.nombre}: +1 D8`}><img src={IMG(k.img)} alt="" /><span>{k.nombre}</span></button>)}
        </div>
      )}
      {lora && <div className="acc-fila"><button className="claro" onClick={() => dispatch({ t: 'lora', uid: lora.uid })}>«Parapeto de lora» (dado bajo → 6)</button></div>}
    </>;
  } else if (c.step === 'rivales') cuerpo = <div className="acc-nota">Tus rivales deciden si sabotean…</div>;
  else if (c.step === 'victoria') cuerpo = <div className="acc-nota">Recompensa en espera: los rivales con «Mató el tigre» o «Filo» deciden si te la quitan…</div>;
  else cuerpo = <div className={`acc-nota ${c.result === 'gana' || c.result === 'escapa' ? 'ok' : 'mal'}`}>{c.result === 'gana' ? textoRecompensa(s, c, rec) : c.result === 'escapa' ? 'Escapaste sin castigo' : `Perdiste: ${m.texto}`}</div>;
  return <div className="acc-combate" style={{ left: x, top: y }}>{cuerpo}</div>;
}

// ---------------- Decisiones y reacciones ----------------
export function PanelDecision({ s, me, sala, dispatch }: { s: GameState; me: Player; sala: SalaInfo; dispatch: (a: Action) => void }) {
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
  const salida = pnd.options.filter(o => o.id === 'pasar' || o.id === 'no');
  const ops = pnd.options.filter(o => !salida.includes(o));
  return (
    <div className="acc-decision" role="dialog" aria-label={pnd.title} key={pnd.title + (s.paso ?? 0)}>
      <div className="acc-decision-cab">
        <div className="acc-decision-tit">{pnd.title}</div>
        {restante !== null && <div className="acc-reloj" aria-label={`Quedan ${restante} segundos`}>{restante}</div>}
      </div>
      {(pnd.img || pnd.text) && <div className="acc-decision-info">{pnd.img && <img src={IMG(pnd.img)} alt="" />}{pnd.text && <div>{pnd.text}</div>}</div>}
      <div className="acc-opciones">
        {ops.map(o => {
          const carta = cartaDeOpcion(o.id, me);
          return (
            <button key={o.id} className={`acc-opcion ${carta ? 'con-carta' : ''} ${elegida === o.id ? 'lanzada' : ''}`} onClick={() => elegir(o.id, /^(food|perro|bizco|tigre|filo|resp|lora):/.test(o.id) || pnd.kind === 'exag-objetivo')}>
              {carta ? <Carta {...propsMorral(carta)} w={96} compacta /> : o.img ? <img src={IMG(o.img)} alt="" /> : null}
              <span><b>{o.label}</b>{o.detail && <small>{o.detail}</small>}</span>
            </button>
          );
        })}
      </div>
      {salida.length > 0 && <div className="acc-fila">{salida.map(o => <button key={o.id} className="claro" onClick={() => elegir(o.id, false)}>{o.label}</button>)}</div>}
      {me.mano.length > 0 && <div className="acc-nota chica">Puedes tocar las cartas de tu mano para verlas.</div>}
    </div>
  );
}
