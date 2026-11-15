import { useEffect, useMemo, useState } from 'react';
import {
  IMG, ZONAS, personaje, apoyo, evento, MATERIALES, HERRAMIENTAS, EDIFICIOS, ORDEN_EDIFICIOS, MaterialId, ToolId, Slot, SLOT_NOMBRE, exag, mito, dicho,
} from '../game/data';
import {
  Action, GameState, cur, pendiente, puedeAvanzar, mainDisponible, apoyoDisponible, precioApoyo, precioHerramienta, precioMaterial,
  maxCompras, maxIntercambios, puedeConstruir, requisitos, valorVenta, exagJugable, totalGolpe, edificiosOk, limiteMano, Player, cartasEnMano,
} from '../game/engine';
import { ControlSonido, Chat } from './Controles';
import { Mensaje, Anuncio as AnuncioRed } from '../net/red';
import { ApoyoCarta, DichoMini, Icono, MitoCarta, MorralCarta } from './Cartas';
import { Combate } from './Combate';
import { Anuncio, Intercambio, PasaDispositivo, Pensando, PendienteModal, Reglas, Victoria } from './Modales';

const SIGUIENTE: Record<string, string> = { plaza: 'Ir al Monte →', monte: 'Ir al Taller →', taller: 'Ir al Campo →', campo: 'Terminar turno ✓' };

export interface RedProps { yo: number; chat: Mensaje[]; enviarChat: (t: string) => void; anuncio: AnuncioRed | null; cerrarAnuncio: () => void; esHost: boolean; convertirIA: (i: number) => void; conectado: boolean }

export function Juego({ s, dispatch, onSalir, red }: { s: GameState; dispatch: (a: Action) => void; onSalir: () => void; red?: RedProps }) {
  const p = cur(s);
  const pnd = pendiente(s);
  const humanos = s.players.filter(x => !x.ia).length;
  const [modal, setModal] = useState<null | 'intercambio' | 'reglas'>(null);
  const [lateral, setLateral] = useState<'registro' | 'chat'>('registro');
  const [lateralAbierto, setLateralAbierto] = useState(false);
  const [combateCerrado, setCombateCerrado] = useState('');
  const [turnoVisto, setTurnoVisto] = useState('');
  const [leidos, setLeidos] = useState(0);
  const yo = red ? red.yo : null;
  const jugador = yo !== null ? s.players[yo] : p;
  const claveTurno = `${s.round}:${s.current}`;
  const claveCombate = s.combat ? `${s.round}:${s.current}:${s.combat.mitoId}:${s.combat.source}:${s.turn.monteHecho}` : '';
  const pedirPase = !red && humanos > 1 && !p.ia && turnoVisto !== claveTurno && s.winner === null;
  const esMiTurno = red ? s.current === yo && !pnd && s.winner === null : !p.ia && !pnd && !pedirPase;
  const decidoYo = !!pnd && (red ? pnd.player === yo : !s.players[pnd.player].ia);
  const peleaYo = !!s.combat && (red ? s.combat.fighter === yo : !s.players[s.combat.fighter].ia);
  const mostrarCombate = !!s.combat && s.phase === 'monte' && (s.combat.step !== 'hecho' || (combateCerrado !== claveCombate && peleaYo));
  const anuncio = red ? red.anuncio : s.anuncio;
  const cerrarAnuncio = red ? red.cerrarAnuncio : () => dispatch({ t: 'cerrarAnuncio' });
  const sinLeer = red ? Math.max(0, red.chat.length - leidos) : 0;
  useEffect(() => { if (lateral === 'chat' && (lateralAbierto || window.innerWidth > 820) && red) setLeidos(red.chat.length); }, [red?.chat.length, lateral, lateralAbierto]);

  useEffect(() => { if (humanos <= 1) setTurnoVisto(claveTurno); }, [claveTurno, humanos]);

  let quienEspera: number | null = null;
  if (pnd && !decidoYo) quienEspera = pnd.player;
  else if (!pnd && !esMiTurno && s.winner === null && !pedirPase && (red || p.ia)) quienEspera = p.id;

  return (
    <div className={`juego ${red ? 'en-red' : ''}`}>
      <BarraSuperior s={s} onReglas={() => setModal('reglas')} onLateral={() => setLateralAbierto(v => !v)} onSalir={onSalir} sinLeer={sinLeer} red={!!red} conectado={red?.conectado ?? true} />
      <div className="juego-cuerpo">
        <PanelJugadores s={s} yo={yo} red={red} />
        <div className="escena" style={{ backgroundImage: `url(${IMG(ZONAS.find(z => z.id === s.phase)?.img ?? 'escenarios/mapa')})` }}>
          <div className="escena-velo" />
          <img className="figura-escena" src={IMG(personaje(p.personaje).img)} alt="" />
          <div className="zona-titulo"><span>{ZONAS.find(z => z.id === s.phase)?.nombre}</span><small>Turno de <b className="pill" style={{ background: p.color }}>{p.nombre}{yo === p.id ? ' (tú)' : ''}</b></small></div>
          <div className="zona-panel">
            {s.phase === 'plaza' && <ZonaPlaza s={s} dispatch={dispatch} activo={esMiTurno} abrirTrato={() => setModal('intercambio')} />}
            {s.phase === 'monte' && <ZonaMonte s={s} dispatch={dispatch} activo={esMiTurno} verCombate={() => setCombateCerrado('')} />}
            {s.phase === 'taller' && <ZonaTaller s={s} dispatch={dispatch} activo={esMiTurno} />}
            {s.phase === 'campo' && <ZonaCampo s={s} dispatch={dispatch} activo={esMiTurno} />}
          </div>
          {esMiTurno && s.phase !== 'fin' && (
            <button className="btn grande siguiente" disabled={!puedeAvanzar(s) || (red && !!anuncio)} onClick={() => dispatch({ t: 'next' })}
              title={!puedeAvanzar(s) && s.phase === 'monte' ? 'Primero explora el Monte' : ''}>{SIGUIENTE[s.phase]}</button>
          )}
        </div>
        <div className={`lateral ${lateralAbierto ? 'abierto' : ''}`}>
          {red && (
            <div className="pestanas">
              <button className={lateral === 'registro' ? 'on' : ''} onClick={() => setLateral('registro')}>Registro</button>
              <button className={lateral === 'chat' ? 'on' : ''} onClick={() => setLateral('chat')}>Chat{sinLeer > 0 && <span className="globo">{sinLeer}</span>}</button>
            </div>
          )}
          <button className="cerrar-lateral" onClick={() => setLateralAbierto(false)}>×</button>
          {(!red || lateral === 'registro') ? <Registro s={s} /> : <Chat chat={red.chat} enviar={red.enviarChat} compacto />}
        </div>
      </div>
      <TableroJugador s={s} jugador={jugador} dispatch={dispatch} activo={esMiTurno && jugador.id === s.current} oculto={!red && (p.ia || pedirPase)} />

      {mostrarCombate && <Combate s={s} dispatch={dispatch} esHumano={peleaYo} onCerrar={() => setCombateCerrado(claveCombate)} />}
      {anuncio && <Anuncio {...anuncio} onCerrar={cerrarAnuncio} />}
      {pnd && decidoYo && !anuncio && <PendienteModal s={s} pnd={pnd} dispatch={dispatch} />}
      {quienEspera !== null && !anuncio && <Pensando s={s} quien={quienEspera} />}
      {pedirPase && !pnd && <PasaDispositivo p={p} onListo={() => setTurnoVisto(claveTurno)} />}
      {modal === 'intercambio' && <Intercambio s={s} dispatch={dispatch} onCerrar={() => setModal(null)} />}
      {modal === 'reglas' && <Reglas onCerrar={() => setModal(null)} />}
      {s.winner !== null && <Victoria s={s} onNueva={onSalir} />}
    </div>
  );
}

function BarraSuperior({ s, onReglas, onLateral, onSalir, sinLeer, red, conectado }: { s: GameState; onReglas: () => void; onLateral: () => void; onSalir: () => void; sinLeer: number; red: boolean; conectado: boolean }) {
  const fases = ['plaza', 'monte', 'taller', 'campo'];
  const idx = fases.indexOf(s.phase);
  const proxEvento = 3 - ((s.round - 1) % 3);
  return (
    <div className="barra">
      <div className="barra-logo">Arrieros <span>y</span> Cuchillos</div>
      <div className="barra-ronda">Ronda {s.round}</div>
      <div className="fases">
        {ZONAS.map((z, i) => <div key={z.id} className={`fase ${i === idx ? 'actual' : i < idx ? 'hecha' : ''}`}><span>{i + 1}</span>{z.nombre}</div>)}
      </div>
      <div className="barra-evento" title={s.evento ? evento(s.evento).texto : ''}>
        {s.evento ? <>Evento: <b>{evento(s.evento).nombre}</b></> : <>Próximo evento en {proxEvento === 3 ? 3 : proxEvento} ronda{proxEvento === 1 ? '' : 's'}</>}
        {s.gato && <span className="chip">Habilidades anuladas</span>}
      </div>
      <div className="barra-botones">
        {red && !conectado && <span className="chip err">Reconectando…</span>}
        <ControlSonido />
        <button className="btn chico sec" onClick={onReglas}>Reglas</button>
        <button className="btn chico sec boton-lateral" onClick={onLateral}>{red ? 'Chat' : 'Registro'}{sinLeer > 0 && <span className="globo">{sinLeer}</span>}</button>
        <button className="btn chico sec" onClick={onSalir}>Salir</button>
      </div>
    </div>
  );
}

function PanelJugadores({ s, yo, red }: { s: GameState; yo: number | null; red?: RedProps }) {
  return (
    <div className="panel-jugadores">
      {s.players.map(q => (
        <div key={q.id} className={`ficha-jugador ${q.id === s.current ? 'actual' : ''}`} style={{ borderColor: q.color }}>
          <div className="fj-cabeza">
            <img src={IMG(personaje(q.personaje).img)} alt="" />
            <div>
              <div className="fj-nombre" style={{ color: q.color }}>{red && !q.ia && <span className={q.conectado ? 'ok-txt' : 'err-txt'} title={q.conectado ? 'Conectado' : 'Desconectado'}>● </span>}{q.nombre}{q.ia && <small> IA</small>}{yo === q.id && <small> TÚ</small>}</div>
              <div className="fj-pj">{personaje(q.personaje).nombre}</div>
            </div>
            {q.id === s.firstPlayer && <img className="fj-primero" src={IMG('objetos/primer-jugador')} title="Primer jugador" alt="" />}
          </div>
          <div className="fj-recursos">
            <span><Icono src="objetos/oro" size={18} />{q.oro}</span>
            <span><Icono src="objetos/guaca" size={18} />{q.guacas}</span>
            <span title="Golpe de equipo"><Icono src="objetos/machete" size={18} />+{totalGolpe(q)}</span>
            <span title="Cartas en la mano"><Icono src="objetos/carriel" size={18} />{cartasEnMano(q)}</span>
          </div>
          <div className="fj-recursos">
            {(['G', 'M', 'B'] as MaterialId[]).map(k => <span key={k}><Icono src={MATERIALES[k].img} size={18} title={MATERIALES[k].nombre} />{q.mat[k]}</span>)}
            {(['puntilla', 'martillo', 'serrucho'] as ToolId[]).map(t => q.tools[t] > 0 && <span key={t}><Icono src={HERRAMIENTAS[t].img} size={18} title={HERRAMIENTAS[t].nombre} />{q.tools[t]}</span>)}
          </div>
          <div className="fj-edificios">
            {ORDEN_EDIFICIOS.map(b => <img key={b} className={`edif ${q.edificios[b] ?? 'no'}`} src={IMG(q.edificios[b] === 'danada' ? EDIFICIOS[b].imgDanada : EDIFICIOS[b].img)} title={`${EDIFICIOS[b].nombre}${q.edificios[b] === 'danada' ? ' (dañada)' : q.edificios[b] ? '' : ' (sin construir)'}`} alt="" />)}
          </div>
          {q.apoyo && <div className="fj-apoyo"><img src={IMG(apoyo(q.apoyo).img)} alt="" />{apoyo(q.apoyo).nombre}</div>}
          <div className="fj-estados">
            {q.saltaPlaza && <span className="chip">Enguayabado</span>}
            {q.saltaMonte && <span className="chip">Se salta el Monte</span>}
            {q.pierdeTurno && <span className="chip">Pierde turno</span>}
            {q.marrano && <span className="chip">Apoyo solo con 6</span>}
            {q.tamalDe !== null && <span className="chip">Tamal de {s.players[q.tamalDe].nombre}</span>}
            {q.guardados.map((g, i) => <DichoMini key={i} id={g} />)}
          </div>
          {red?.esHost && !q.ia && !q.conectado && <button className="btn mini sec" onClick={() => red.convertirIA(q.id)}>Reemplazar por IA</button>}
        </div>
      ))}
    </div>
  );
}

function ZonaPlaza({ s, dispatch, activo, abrirTrato }: { s: GameState; dispatch: (a: Action) => void; activo: boolean; abrirTrato: () => void }) {
  const p = cur(s);
  const precio = precioApoyo(s);
  return (
    <div>
      <h3>Personajes de apoyo</h3>
      {s.evento === 'cierre' && <p className="nota">La Plaza está cerrada: no hay contrataciones ni intercambios.</p>}
      <div className="fila-cartas">
        {s.apoyosRevelados.map(id => (
          <ApoyoCarta key={id} id={id} w={150}>
            {activo && <button className="btn chico" disabled={!!p.apoyo || p.oro < precio || s.evento === 'cierre'} onClick={() => dispatch({ t: 'contratar', id })}>Contratar ({precio} oro)</button>}
          </ApoyoCarta>
        ))}
      </div>
      {activo && (
        <div className="fila-botones">
          <button className="btn sec" disabled={s.evento === 'cierre' || s.turn.intercambios >= maxIntercambios(s, p)} onClick={abrirTrato}>Proponer intercambio</button>
          {s.evento === 'errantes' && <button className="btn sec" disabled={s.turn.guacaErrantes || p.oro < 5} onClick={() => dispatch({ t: 'guacaErrantes' })}>Comprar 1 guaca (5 oro)</button>}
        </div>
      )}
      {activo && p.mano.some(c => c.kind === 'equipo') && <p className="nota">Equípate desde tu mano: toca «Equipar» en las cartas de equipo.</p>}
    </div>
  );
}

function ZonaMonte({ s, dispatch, activo, verCombate }: { s: GameState; dispatch: (a: Action) => void; activo: boolean; verCombate: () => void }) {
  const p = cur(s);
  const last = s.lastMonte;
  return (
    <div className="zona-monte">
      <div className="mazo-monte">
        <img src={IMG('cartas/dorso-monte')} alt="Mazo del Monte" />
        <small>{s.monte.length} cartas</small>
      </div>
      <div>
        {!s.turn.monteHecho && activo && <button className="btn grande rojo" onClick={() => dispatch({ t: 'explorar' })}>Explorar el Monte</button>}
        {!s.turn.monteHecho && !activo && <p>Esperando…</p>}
        {p.personaje === 'jairo' && !s.turn.monteHecho && <p className="nota">Intuición Mítica: verás la carta de arriba antes de robarla.</p>}
        {s.turn.monteHecho && !last && <p>{p.nombre} se salta el Monte este turno.</p>}
        {last?.kind === 'dicho' && <p>Salió un dicho: <b>«{dicho(last.id).nombre}»</b></p>}
        {last?.kind === 'mito' && s.combat && (
          <div className="fila">
            <MitoCarta id={s.combat.mitoId} w={150} />
            <div>
              <p><b>{s.combat.step === 'hecho' ? (s.combat.result === 'gana' ? 'Venciste' : s.combat.result === 'escapa' ? 'Escapaste' : 'Perdiste') : 'Combate en curso'}</b></p>
              <button className="btn sec chico" onClick={verCombate}>Ver combate</button>
            </div>
          </div>
        )}
        {s.combat && s.combat.source === 'ocasion' && last?.kind === 'dicho' && <button className="btn sec chico" onClick={verCombate}>Ver combate</button>}
      </div>
    </div>
  );
}

function ZonaTaller({ s, dispatch, activo }: { s: GameState; dispatch: (a: Action) => void; activo: boolean }) {
  const p = cur(s);
  const sig = ORDEN_EDIFICIOS.find(b => !p.edificios[b]);
  const req = sig ? requisitos(s, p, sig) : null;
  const comprasMax = maxCompras(s) + (s.turn.tallerExtra ? 1 : 0);
  const puedeComprar = activo && s.turn.compras < comprasMax;
  const danadas = ORDEN_EDIFICIOS.filter(b => p.edificios[b] === 'danada');
  const tieneMat = p.mat.G + p.mat.M + p.mat.B > 0;
  const deMazo = s.evento === 'aprendizaje' ? (['puntilla', 'martillo', 'serrucho'] as ToolId[]).filter(t => s.herramientas.includes(t) && !s.reveladas.includes(t)) : [];
  return (
    <div className="zona-taller">
      <div>
        <h3>Herramientas reveladas <small>({s.turn.compras}/{comprasMax} compras)</small></h3>
        <div className="fila-cartas">
          {[...s.reveladas, ...deMazo].map((t, i) => (
            <div key={t + i} className="carta-herramienta">
              <img src={IMG(HERRAMIENTAS[t].img)} alt="" />
              <div className="carta-titulo chico">{HERRAMIENTAS[t].nombre}{i >= s.reveladas.length && <small> (del mazo)</small>}</div>
              <button className="btn chico" disabled={!puedeComprar || p.oro < precioHerramienta(s, p, t)} onClick={() => dispatch({ t: 'comprarHerramienta', tool: t })}>Comprar · {precioHerramienta(s, p, t)} oro</button>
            </div>
          ))}
          {!s.reveladas.length && <p className="nota">No quedan herramientas: negocia con otros jugadores.</p>}
        </div>
      </div>
      <div className="construccion">
        {sig && req ? (
          <>
            <h3>Próximo edificio: {EDIFICIOS[sig].nombre}</h3>
            <div className="fila">
              <img className="edif-grande" src={IMG(EDIFICIOS[sig].img)} alt="" />
              <ul className="checklist">
                <li className={req.matsOk ? 'ok' : ''}>Guadua, Madera y Barro</li>
                {EDIFICIOS[sig].herramientas.map(t => <li key={t} className={p.tools[t] > 0 ? 'ok' : req.faltanTools.length === 1 && req.comodin && req.faltanTools[0] === t ? 'comodin' : ''}>{HERRAMIENTAS[t].nombre}</li>)}
                {req.guacas > 0 && <li className={req.guacasOk ? 'ok' : ''}>{req.guacas} guaca{req.guacas > 1 ? 's' : ''} (tienes {p.guacas})</li>}
              </ul>
            </div>
            {activo && <button className="btn grande" disabled={!puedeConstruir(s)} onClick={() => dispatch({ t: 'construir' })}>Construir {EDIFICIOS[sig].nombre}</button>}
          </>
        ) : <h3>¡Tus tres edificios están construidos!</h3>}
        {danadas.length > 0 && activo && (
          <div className="fila-botones">
            {danadas.map(b => <button key={b} className="btn sec" disabled={s.evento !== 'reparacion' && !tieneMat} onClick={() => dispatch({ t: 'reparar', b })}>Reparar {EDIFICIOS[b].nombre} ({s.evento === 'reparacion' ? 'gratis' : '1 material'})</button>)}
          </div>
        )}
        {activo && p.guardados.includes('tarde') && !s.turn.tallerExtra && <button className="btn sec" onClick={() => dispatch({ t: 'usarTarde' })}>Usar «Más vale tarde que nunca» (Taller doble)</button>}
      </div>
    </div>
  );
}

function ZonaCampo({ s, dispatch, activo }: { s: GameState; dispatch: (a: Action) => void; activo: boolean }) {
  const p = cur(s);
  const precio = precioMaterial(s, p);
  return (
    <div className="zona-campo">
      <div>
        <h3>Comprar materiales <small>({precio} oro c/u)</small></h3>
        <div className="fila-botones">
          {(['G', 'M', 'B'] as MaterialId[]).map(k => <button key={k} className="btn sec con-img" disabled={!activo || p.oro < precio} onClick={() => dispatch({ t: 'comprarMaterial', id: k })}><img src={IMG(MATERIALES[k].img)} alt="" />{MATERIALES[k].nombre}</button>)}
        </div>
      </div>
      <div>
        <h3>Vender al Fondo del Pueblo {s.evento === 'auge' && <small>(paga doble)</small>}</h3>
        <div className="fila-botones">
          {(['G', 'M', 'B'] as MaterialId[]).filter(k => p.mat[k] > 0).map(k => <button key={k} className="btn sec chico con-img" disabled={!activo} onClick={() => dispatch({ t: 'vender', item: { k: 'mat', id: k } })}><img src={IMG(MATERIALES[k].img)} alt="" />{MATERIALES[k].nombre} · +{valorVenta(s, p, { k: 'mat' })}</button>)}
          {(['puntilla', 'martillo', 'serrucho'] as ToolId[]).filter(t => p.tools[t] > 0).map(t => <button key={t} className="btn sec chico con-img" disabled={!activo} onClick={() => dispatch({ t: 'vender', item: { k: 'tool', id: t } })}><img src={IMG(HERRAMIENTAS[t].img)} alt="" />{HERRAMIENTAS[t].nombre} · +{valorVenta(s, p, { k: 'tool', id: t })}</button>)}
        </div>
        <p className="nota">Las cartas de comida y equipo se venden desde tu mano. Recuerda: para ganar necesitas 1 comida en la mano.</p>
      </div>
    </div>
  );
}

function TableroJugador({ s, jugador, dispatch, activo, oculto }: { s: GameState; jugador: Player; dispatch: (a: Action) => void; activo: boolean; oculto: boolean }) {
  const p = jugador;
  const pj = personaje(p.personaje);
  const c = s.combat;
  const enTirada = !!c && c.step === 'tirada' && c.fighter === p.id;
  return (
    <div className="tablero" style={{ borderTopColor: p.color }}>
      <div className="tab-perfil">
        <img src={IMG(pj.img)} alt="" />
        <div>
          <div className="tab-nombre"><span className="punto" style={{ background: p.color }} />{p.nombre}</div>
          <div className="tab-pj">{pj.nombre} · {pj.rol}</div>
          <div className="tab-recursos">
            <span><Icono src="objetos/oro" size={24} /> {p.oro}</span>
            <span><Icono src="objetos/guaca" size={24} /> {p.guacas}</span>
            {(['G', 'M', 'B'] as MaterialId[]).map(k => <span key={k}><Icono src={MATERIALES[k].img} size={24} title={MATERIALES[k].nombre} /> {p.mat[k]}</span>)}
            {(['puntilla', 'martillo', 'serrucho'] as ToolId[]).map(t => <span key={t} className={p.tools[t] ? '' : 'cero'}><Icono src={HERRAMIENTAS[t].img} size={24} title={HERRAMIENTAS[t].nombre} /> {p.tools[t]}</span>)}
          </div>
          <div className="fila-botones">
            {activo && pj.momento === 'cualquiera' && <button className="btn chico" disabled={!mainDisponible(s)} title={pj.pasiva} onClick={() => dispatch({ t: 'habilidad' })}>Habilidad de {pj.nombre.split(' ').slice(0, 2).join(' ')} (D6)</button>}
            {activo && p.apoyo && <button className="btn chico" disabled={!apoyoDisponible(s)} onClick={() => dispatch({ t: 'habilidadApoyo' })}>Habilidad de {apoyo(p.apoyo).nombre.split(' ').slice(0, 2).join(' ')} (D6)</button>}
            {activo && p.apoyo && s.phase === 'plaza' && <button className="btn chico sec" onClick={() => dispatch({ t: 'soltarApoyo' })}>Dejar ir apoyo</button>}
          </div>
        </div>
      </div>
      <div className="tab-equipo">
        <div className="tab-titulo">Equipo · golpe +{totalGolpe(p)}</div>
        <div className="slots">
          {(['arma', 'prenda', 'montura'] as Slot[]).map(k => (
            <div key={k} className="slot" title={SLOT_NOMBRE[k]}>
              {p.equipo[k] ? <><img src={IMG(p.equipo[k]!.img)} alt="" /><span>{p.equipo[k]!.nombre} +{p.equipo[k]!.golpe}</span></> : <span className="vacio">{SLOT_NOMBRE[k]}</span>}
            </div>
          ))}
        </div>
        <div className="tab-titulo">Pueblo</div>
        <div className="slots">
          {ORDEN_EDIFICIOS.map(b => (
            <div key={b} className={`slot edif-slot ${p.edificios[b] ?? 'no'}`}>
              <img src={IMG(p.edificios[b] === 'danada' ? EDIFICIOS[b].imgDanada : EDIFICIOS[b].img)} alt="" />
              <span>{EDIFICIOS[b].nombre}{p.edificios[b] === 'danada' ? ' (dañada)' : ''}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="tab-mano">
        <div className="tab-titulo">Mano ({p.mano.length}/{limiteMano(p)}) {p.guardados.map((g, i) => <DichoMini key={i} id={g} />)}</div>
        <div className="mano">
          {oculto ? p.mano.map(card => <div key={card.uid} className="carta-dorso" style={{ backgroundImage: `url(${IMG('cartas/dorso-morral')})` }} />) :
            p.mano.map(card => {
              let accion: React.ReactNode = null;
              if (activo) {
                if (card.kind === 'equipo' && s.phase === 'plaza') accion = <button className="btn mini" onClick={() => dispatch({ t: 'equipar', uid: card.uid })}>Equipar</button>;
                else if (card.kind === 'comida' && enTirada && !c!.food) accion = <button className="btn mini" onClick={() => dispatch({ t: 'comida', uid: card.uid })}>Comer</button>;
                else if (card.kind !== 'exag' && s.phase === 'campo' && !c?.step?.match(/decidir|tirada|rivales|victoria/)) accion = <button className="btn mini sec" onClick={() => dispatch({ t: 'vender', item: { k: 'carta', uid: card.uid } })}>Vender +{valorVenta(s, p, { k: 'carta', c: card })}</button>;
                else if (card.kind === 'exag' && exagJugable(s, card.uid)) accion = <button className="btn mini rojo" onClick={() => dispatch({ t: 'exag', uid: card.uid })}>Jugar</button>;
              }
              return <MorralCarta key={card.uid} card={card} w={118} accion={accion} />;
            })}
          {!p.mano.length && <span className="nota">Sin cartas</span>}
        </div>
      </div>
    </div>
  );
}

function Registro({ s }: { s: GameState }) {
  const items = useMemo(() => s.log.slice(-80).reverse(), [s.log]);
  return (
    <div className="registro">
      <div className="tab-titulo">Registro</div>
      {items.map((l, i) => <div key={i} className={`log ${l.t.startsWith('—') || l.t.startsWith('=') ? 'log-sep' : ''}`} style={{ borderLeftColor: l.p !== undefined ? s.players[l.p].color : 'transparent' }}>{l.t}</div>)}
    </div>
  );
}
