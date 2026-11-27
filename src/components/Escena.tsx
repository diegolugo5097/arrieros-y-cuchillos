// Vista de la mesa al estilo de los juegos de cartas digitales:
// insignias de los rivales arriba, la escena de la zona en el centro con el personaje de turno (y su apoyo),
// el mito de frente durante el combate, tu insignia abajo a la izquierda y tu mano en abanico abajo.
// Solo cambia cómo se ve la partida: las reglas y los controles siguen iguales.
import { useContext, useEffect, useRef, useState } from 'react';
import {
  IMG, ZONAS, apoyo, evento, HERRAMIENTAS, MATERIALES, EDIFICIOS, ORDEN_EDIFICIOS, MaterialId, mito, RECOMPENSA, TIER_NOMBRE, personaje,
} from '../game/data';
import { GameState, ataqueMito, poderJugador, dadosUsados, totalGolpe, cartasEnMano, pendiente, Phase, ordenDe, Player } from '../game/engine';
import { Carta, Dado, Precio, propsMorral, RequisitosConstruccion } from './Cartas';
import { EscenarioCtx, useEfectosMesa } from './Efectos';
import { PersonajeEnEscena, ApoyoEnEscena, EfectoEnEscena, Retrato } from './Sprites';
import { Action } from '../game/engine';
import { SalaInfo, Mensaje } from '../net/red';
import { useDispatchSeguro, PanelZona, AccionesCombate, PanelDecision, Encima } from './Acciones';
import { CartaGrande, CelPueblo, useAvisosMano } from './Celular';

type EfectoActual = ReturnType<typeof useEfectosMesa>['actual'];

/** Fondo de la escena según la zona del turno. */
const FONDO: Record<string, string> = {
  plaza: 'escenarios/escena-plaza', monte: 'escenarios/zona-monte', taller: 'escenarios/escena-taller', campo: 'escenarios/zona-campo', fin: 'escenarios/escena-plaza',
};
const NOMBRE_ZONA: Record<string, string> = { plaza: 'Plaza', monte: 'Monte', taller: 'Taller', campo: 'Campo' };

// ---------------- Medidas de la escena (base 1920×1080, estirada con ex/ey) ----------------
const INSIGNIA = { w: 300, gap: 12, x0: 16, y0: 14, h: 118 };
export function layoutEscena(ex = 0, ey = 0) {
  const W = 1920 + ex, H = 1080 + ey;
  const suelo = H - 236;
  return {
    W, H, suelo,
    heroe: { x: W * 0.28, y: suelo, alto: 420 },
    apoyo: { x: W * 0.28 - 200, y: suelo - 16, alto: 340 },
    mito: { x: W * 0.745, y: suelo + 10, alto: 470 },
    marcador: { x: W * 0.505, y: suelo - 470 },
  };
}
/** Centro de la insignia de cada jugador: rivales arriba a la izquierda y tú abajo a la izquierda. */
export function posJugador(i: number, n: number, yo: number | undefined, ex = 0, ey = 0) {
  const L = layoutEscena(ex, ey);
  if (yo !== undefined && i === yo) return { x: 16 + 200, y: L.H - 110 };
  const orden = Array.from({ length: n }, (_, k) => k).filter(k => k !== yo);
  const k = Math.max(0, orden.indexOf(i));
  return { x: INSIGNIA.x0 + k * (INSIGNIA.w + INSIGNIA.gap) + INSIGNIA.w / 2, y: INSIGNIA.y0 + INSIGNIA.h / 2 };
}
/** Arriba de la cabeza del personaje de turno: ahí salen los dados. */
export function posDados(ex = 0, ey = 0) {
  const L = layoutEscena(ex, ey);
  return { x: L.heroe.x, y: L.heroe.y - L.heroe.alto - 70 };
}
export function posMito(ex = 0, ey = 0) {
  const L = layoutEscena(ex, ey);
  return { x: L.mito.x, y: L.mito.y - L.mito.alto * 0.55 };
}

function estadoDe(s: GameState, q: Player) {
  const pnd = pendiente(s);
  return q.id === s.current ? 'Jugando' : pnd?.player === q.id ? 'Decidiendo' : q.conectado === false && !q.ia ? 'Desconectado' : q.ia ? 'IA' : 'Esperando';
}
const nEdificios = (q: Player) => ORDEN_EDIFICIOS.filter(b => q.edificios[b] === 'ok').length;

// ---------------- Insignias ----------------
function DetallePueblo({ q }: { q: Player }) {
  const equipo = Object.values(q.equipo).filter(Boolean);
  return (
    <div className="ins-detalle">
      <div className="ins-fila">
        {(['G', 'M', 'B'] as MaterialId[]).map(k => <span key={k} title={MATERIALES[k].nombre}><img src={IMG(MATERIALES[k].img)} alt={MATERIALES[k].nombre} />{q.mat[k]}</span>)}
        {(['puntilla', 'martillo', 'serrucho'] as const).map(t => q.tools[t] > 0 && <span key={t} title={HERRAMIENTAS[t].nombre}><img src={IMG(HERRAMIENTAS[t].img)} alt={HERRAMIENTAS[t].nombre} />{q.tools[t]}</span>)}
      </div>
      <div className="ins-fila ins-edif">
        {ORDEN_EDIFICIOS.map(b => <img key={b} className={q.edificios[b] ?? 'no'} src={IMG(q.edificios[b] === 'danada' ? EDIFICIOS[b].imgDanada : EDIFICIOS[b].img)} alt={EDIFICIOS[b].nombre} title={EDIFICIOS[b].nombre} />)}
        {equipo.map(e => <img key={e!.uid} className="ins-equipo" src={IMG(e!.img)} alt={e!.nombre} title={`${e!.nombre} +${e!.golpe}`} />)}
      </div>
      {(q.apoyo || q.saltaPlaza || q.saltaMonte || q.pierdeTurno) && (
        <div className="ins-fila ins-chips">
          {q.apoyo && <span className="chip">{apoyo(q.apoyo).nombre}</span>}
          {q.saltaPlaza && <span className="chip">Enguayabado</span>}
          {q.saltaMonte && <span className="chip">Sin Monte</span>}
          {q.pierdeTurno && <span className="chip">Pierde turno</span>}
        </div>
      )}
    </div>
  );
}

function InsigniaRival({ s, q, zona, onReemplazar }: { s: GameState; q: Player; zona: string; onReemplazar?: () => void }) {
  const [abierta, setAbierta] = useState(false);
  const est = estadoDe(s, q);
  return (
    <article className={`ins ${q.id === s.current ? 'actual' : ''} ${est === 'Decidiendo' ? 'decide' : ''} ${abierta ? 'abierta' : ''}`}
      style={{ ['--c' as string]: q.color }} onClick={() => setAbierta(a => !a)} aria-label={`${q.nombre}: toca para ver su pueblo`}>
      <div className="ins-cab">
        <Retrato id={q.personaje} color={q.color} tam={84} />
        {s.orden && <b className="ins-orden" title="Orden de turno">{ordenDe(s).indexOf(q.id) + 1}</b>}
        {q.apoyo && <img className="ins-apoyo" src={IMG(apoyo(q.apoyo).img)} alt={apoyo(q.apoyo).nombre} title={apoyo(q.apoyo).nombre} />}
        <div className="ins-cuerpo">
          <div className="ins-nombre">{q.nombre}</div>
          <div className="ins-stats">
            <span title="Oro"><img src={IMG('objetos/oro')} alt="Oro" />{q.oro}</span>
            <span title="Golpe de equipo"><img src={IMG('objetos/machete')} alt="Golpe" />+{totalGolpe(q)}</span>
            <span title="Cartas en la mano"><img src={IMG('cartas/dorso-morral')} alt="Cartas" className="ins-dorso" />{cartasEnMano(q)}</span>
            <span title="Edificios construidos"><img src={IMG(EDIFICIOS.casa.img)} alt="Edificios" />{nEdificios(q)}/3</span>
          </div>
          <div className="ins-pie"><span className="ins-estado">{est}</span><span className="ins-zona">{NOMBRE_ZONA[zona] ?? ''}</span></div>
        </div>
      </div>
      {abierta && <DetallePueblo q={q} />}
      {onReemplazar && <button className="ins-reemplazar" onClick={e => { e.stopPropagation(); onReemplazar(); }}>Desconectado: reemplazar por IA</button>}
    </article>
  );
}

function InsigniaPropia({ s, q, onAbrir }: { s: GameState; q: Player; onAbrir: () => void }) {
  const equipo = Object.values(q.equipo).filter(Boolean);
  return (
    <article className={`ins-yo ${q.id === s.current ? 'actual' : ''}`} style={{ ['--c' as string]: q.color }} aria-label="Tu pueblo: toca para verlo" role="button" onClick={onAbrir}>
      <Retrato id={q.personaje} color={q.color} tam={118} />
      {s.orden && <b className="ins-orden grande">{ordenDe(s).indexOf(q.id) + 1}</b>}
      <div className="ins-yo-cuerpo">
        <div className="ins-nombre">{q.nombre} <small>{personaje(q.personaje).rol}</small></div>
        <div className="ins-stats grande">
          <span title="Oro"><img src={IMG('objetos/oro')} alt="Oro" />{q.oro}</span>
          <span title="Golpe de equipo"><img src={IMG('objetos/machete')} alt="Golpe" />+{totalGolpe(q)}</span>
          {(['G', 'M', 'B'] as MaterialId[]).map(k => <span key={k} title={MATERIALES[k].nombre}><img src={IMG(MATERIALES[k].img)} alt={MATERIALES[k].nombre} />{q.mat[k]}</span>)}
          {(['puntilla', 'martillo', 'serrucho'] as const).map(t => q.tools[t] > 0 && <span key={t} title={HERRAMIENTAS[t].nombre}><img src={IMG(HERRAMIENTAS[t].img)} alt={HERRAMIENTAS[t].nombre} />{q.tools[t]}</span>)}
        </div>
        <div className="ins-fila ins-edif">
          {ORDEN_EDIFICIOS.map(b => <img key={b} className={q.edificios[b] ?? 'no'} src={IMG(q.edificios[b] === 'danada' ? EDIFICIOS[b].imgDanada : EDIFICIOS[b].img)} alt={EDIFICIOS[b].nombre} title={EDIFICIOS[b].nombre} />)}
          {equipo.map(e => <img key={e!.uid} className="ins-equipo" src={IMG(e!.img)} alt={e!.nombre} title={`${e!.nombre} +${e!.golpe}`} />)}
          {q.apoyo && <span className="chip">{apoyo(q.apoyo).nombre}</span>}
          {q.saltaPlaza && <span className="chip">Enguayabado</span>}
          {q.saltaMonte && <span className="chip">Sin Monte</span>}
          {q.pierdeTurno && <span className="chip">Pierde turno</span>}
        </div>
      </div>
      <span className="ins-yo-ver">Mi pueblo ▸</span>
    </article>
  );
}

/** Tu mano en abanico: un toque abre tus cartas en tus controles. */
function ManoAbanico({ q, onVer }: { q: Player; onVer: (uid: number) => void }) {
  const n = q.mano.length;
  const prev = useRef(n); const [salta, setSalta] = useState(false);
  useEffect(() => { if (prev.current !== n) { prev.current = n; setSalta(true); const id = setTimeout(() => setSalta(false), 900); return () => clearTimeout(id); } }, [n]);
  if (!n) return <div className="mano-abanico vacia">Sin cartas en la mano</div>;
  const ang = Math.min(9, 50 / n);
  return (
    <div className={`mano-abanico ${salta ? 'salta' : ''}`} aria-label={`Tu mano: ${n} carta${n === 1 ? '' : 's'}`}>
      {q.mano.map((c, i) => {
        const r = (i - (n - 1) / 2) * ang;
        return (
          <button key={c.uid} className="mano-carta" onClick={() => onVer(c.uid)} aria-label={`Ver ${c.kind === 'exag' ? 'exageración' : c.nombre}`} style={{ ['--t' as string]: `translateX(${(i - (n - 1) / 2) * Math.min(110, 760 / n)}px) translateY(${Math.abs(r) * 2.2}px) rotate(${r}deg)`, zIndex: i }}>
            <Carta {...propsMorral(c)} w={170} compacta />
          </button>
        );
      })}
      <span className="mano-etiqueta">Tu mano · {n} · toca una carta</span>
    </div>
  );
}

// ---------------- Panel de información (arriba a la derecha) ----------------
function BarraInfo({ s, codigo, yo, onSalir, sonido, enCelular }: { s: GameState; codigo: string; yo?: number; onSalir: () => void; sonido?: React.ReactNode; enCelular?: boolean }) {
  const fases = ['plaza', 'monte', 'taller', 'campo'];
  const idx = fases.indexOf(s.phase);
  const proxEvento = 3 - ((s.round - 1) % 3);
  return (
    <header className="esc-info">
      <div className="esc-info-fila">
        <div className="esc-ronda">Ronda <b>{s.round}</b></div>
        <nav className="esc-fases" aria-label="Zonas del turno">
          {ZONAS.map((z, i) => <span key={z.id} className={i === idx ? 'actual' : i < idx ? 'pasada' : ''}><i>{i + 1}</i>{NOMBRE_ZONA[z.id]}</span>)}
        </nav>
        {sonido}
        <button className={`btn chico ${enCelular ? 'mesa-cerrar' : 'sec'}`} onClick={onSalir}>{enCelular ? '✕' : 'Salir'}</button>
      </div>
      <div className="esc-info-fila esc-evento">
        <span className="esc-et">Evento</span>
        {s.evento ? <span><b>{evento(s.evento).nombre}</b> · {evento(s.evento).texto}</span> : <span>Próximo en {proxEvento} ronda{proxEvento === 1 ? '' : 's'}</span>}
        {s.gato && <span className="chip">Habilidades anuladas</span>}
        <span className="esc-codigo">{yo !== undefined && <>Juegas como <b style={{ color: s.players[yo].color }}>{s.players[yo].nombre}</b> · </>}Sala <b>{codigo}</b></span>
      </div>
    </header>
  );
}

// ---------------- Mostrador de la zona (a la derecha cuando no hay combate) ----------------
function Mostrador({ s, yo }: { s: GameState; yo?: number }) {
  const z = s.phase;
  return (
    <aside className="esc-mostrador" aria-label="Lo que hay en esta zona">
      <div className="esc-mazos">
        <div><img src={IMG('cartas/dorso-monte')} alt="" /><span>Monte<b>{s.monteCount ?? s.monte.length}</b></span></div>
        <div><img src={IMG('cartas/dorso-morral')} alt="" /><span>Guacas<b>{s.morralCount ?? s.morral.length}</b></span></div>
      </div>
      {(z === 'plaza' || z === 'campo') && (
        <>
          <div className="esc-sub">Apoyos en la Plaza</div>
          <div className="esc-apoyos">
            {s.apoyosRevelados.map(id => <div key={id} title={apoyo(id).pasiva}><img src={IMG(apoyo(id).img)} alt="" /><b>{apoyo(id).nombre}</b><small>{apoyo(id).pasiva}</small></div>)}
          </div>
        </>
      )}
      {(z === 'taller' || z === 'monte') && (
        <>
          <div className="esc-sub">Herramientas del Taller</div>
          <div className="esc-herr">
            {s.reveladas.map((t, i) => <div key={t + i}><img src={IMG(HERRAMIENTAS[t].img)} alt="" /><b>{HERRAMIENTAS[t].nombre}</b><Precio n={HERRAMIENTAS[t].precio} /></div>)}
            {!s.reveladas.length && <span className="mesa-nota">No quedan herramientas</span>}
          </div>
          <div className="esc-sub">Para construir{yo !== undefined ? ' · lo tuyo en verde' : ''}</div>
          <RequisitosConstruccion p={yo !== undefined ? s.players[yo] : undefined} compacto />
        </>
      )}
    </aside>
  );
}

function CronicaMini({ s }: { s: GameState }) {
  const lineas = s.log.filter(l => !l.t.startsWith('=')).slice(-6).reverse();
  return (
    <aside className="esc-cronica" aria-label="Crónica">
      {lineas.map((l, i) => <div key={l.n ?? i} className={l.t.startsWith('—') ? 'sep' : ''} style={{ borderLeftColor: l.p !== undefined ? s.players[l.p].color : 'transparent' }}>{l.t}</div>)}
    </aside>
  );
}

// ---------------- Escena central ----------------
type Fx = { id: number; atlas: 'impactos' | 'maldiciones'; fila: number; donde: 'heroe' | 'mito'; retraso: number };
let sigFx = 1;
const FILA_TIER: Record<string, number> = { rural: 1, siniestro: 0, epico: 2, ancestral: 3 };

function EscenaCentral({ s, efecto, acciones }: { s: GameState; efecto: EfectoActual; acciones?: React.ReactNode }) {
  const esc = useContext(EscenarioCtx);
  const L = layoutEscena(esc.ex, esc.ey);
  const p = s.players[s.current];
  const c = s.combat;
  const enCombate = !!c && s.phase === 'monte';
  const fighter = enCombate ? s.players[c!.fighter] : p;
  const [golpeado, setGolpeado] = useState(0);
  const [fxs, setFxs] = useState<Fx[]>([]);
  const visto = useRef(0);

  // Cada efecto del registro dispara su animación en la escena
  useEffect(() => {
    if (!efecto || efecto.id === visto.current) return;
    visto.current = efecto.id;
    const nuevo = (f: Omit<Fx, 'id'>) => setFxs(l => [...l, { ...f, id: sigFx++ }]);
    if (efecto.tipo === 'resultado' && efecto.r === 'pierde') { nuevo({ atlas: 'maldiciones', fila: FILA_TIER[c?.tier ?? 'siniestro'] ?? 0, donde: 'heroe', retraso: 150 }); setGolpeado(g => g + 1); }
    else if (efecto.tipo === 'sabotaje') nuevo({ atlas: 'maldiciones', fila: 0, donde: 'mito', retraso: 900 });
    else if (efecto.tipo === 'carta' && /responde/.test(efecto.texto)) nuevo({ atlas: 'impactos', fila: 3, donde: 'heroe', retraso: 1100 });
  }, [efecto?.id]);

  const vencido = enCombate && c!.step === 'hecho' && c!.result === 'gana';
  // Al vencer estalla el impacto sobre el mito
  useEffect(() => {
    if (!vencido) return;
    setFxs(l => [...l, { id: sigFx++, atlas: 'impactos', fila: 1, donde: 'mito', retraso: 0 }, { id: sigFx++, atlas: 'impactos', fila: 0, donde: 'mito', retraso: 450 }]);
  }, [vencido]);
  const huyo = enCombate && c!.step === 'hecho' && (c!.result === 'escapa');
  const ataque = enCombate ? ataqueMito(s, c!) : 0;
  const poder = enCombate && c!.dice.length ? poderJugador(s, c!) : null;
  const m = enCombate ? mito(c!.mitoId) : null;
  const mostrarDados = enCombate && c!.dice.length > 0 && efecto?.tipo !== 'dados';
  const dpos = posDados(esc.ex, esc.ey);
  const mpos = posMito(esc.ex, esc.ey);

  return (
    <div className="esc-escena">
      {/* Apoyo detrás, a un lado del personaje */}
      {fighter.apoyo && <ApoyoEnEscena key={'ap' + fighter.id + fighter.apoyo} id={fighter.apoyo} x={L.apoyo.x} y={L.apoyo.y} alto={L.apoyo.alto} className="esc-apoyo-sprite" />}
      <div className={`esc-sombra`} style={{ left: L.heroe.x - 110, top: L.heroe.y - 22 }} />
      <PersonajeEnEscena key={'pj' + fighter.id} id={fighter.personaje} x={L.heroe.x} y={L.heroe.y} alto={L.heroe.alto}
        className={`esc-heroe ${golpeado ? (golpeado % 2 ? 'golpe-a' : 'golpe-b') : ''} ${huyo ? 'huye' : ''}`} />
      <div className="esc-placa" style={{ left: L.heroe.x, top: L.heroe.y + 14, borderColor: fighter.color }}>
        <b style={{ color: fighter.color }}>{fighter.nombre}</b>
        <span>{personaje(fighter.personaje).nombre}{fighter.apoyo ? ` · con ${apoyo(fighter.apoyo).nombre}` : ''}</span>
      </div>

      {enCombate && m && (
        <>
          <div className="esc-sombra grande" style={{ left: L.mito.x - 150, top: L.mito.y - 26 }} />
          <img key={m.id} className={`esc-mito tier-${m.tier} ${vencido ? 'vencido' : ''} ${c!.sabotajes.length ? 'potenciado' : ''}`} src={IMG(`mitos/${m.id}`)} alt={m.nombre}
            style={{ left: L.mito.x, top: L.mito.y - L.mito.alto, height: L.mito.alto }} />
          <div className="esc-placa mito" style={{ left: L.mito.x, top: L.mito.y + 4 }}>
            <b>{m.nombre}</b><span>Mito {TIER_NOMBRE[m.tier].toLowerCase()} · recompensa {(c!.reward ?? RECOMPENSA[m.tier]).oro} oro, {(c!.reward ?? RECOMPENSA[m.tier]).guacas} guaca{(c!.reward ?? RECOMPENSA[m.tier]).guacas === 1 ? '' : 's'}</span>
          </div>
          <MarcadorCombate s={s} x={L.marcador.x} y={L.marcador.y} poder={poder} ataque={ataque}>{acciones}</MarcadorCombate>
        </>
      )}

      {mostrarDados && (
        <div className="esc-dados" style={{ left: dpos.x, top: dpos.y }} key={c!.dice.join('-') + (s.paso ?? 0)}>
          {c!.dice.map((v, i) => <div key={i} className={`esc-dado ${c!.dice.length === 3 && v === Math.min(...c!.dice) && c!.dice.indexOf(v) === i ? 'descartado' : ''}`}><Dado v={v} /></div>)}
          {c!.food && <div className="esc-dado"><Dado v={c!.food.d8} color="azul" /></div>}
        </div>
      )}

      {fxs.map(f => (
        <FxDiferido key={f.id} f={f} pos={f.donde === 'mito' ? mpos : { x: L.heroe.x, y: L.heroe.y - L.heroe.alto * 0.5 }} onFin={() => setFxs(l => l.filter(x => x.id !== f.id))} />
      ))}
    </div>
  );
}

function FxDiferido({ f, pos, onFin }: { f: Fx; pos: { x: number; y: number }; onFin: () => void }) {
  const [ya, setYa] = useState(f.retraso === 0);
  useEffect(() => { if (f.retraso) { const id = setTimeout(() => setYa(true), f.retraso); return () => clearTimeout(id); } }, []);
  if (!ya) return null;
  return <EfectoEnEscena atlas={f.atlas} fila={f.fila} x={pos.x} y={pos.y} alto={f.atlas === 'impactos' && f.fila === 0 ? 420 : 380} onFin={onFin} />;
}

function MarcadorCombate({ s, x, y, poder, ataque, children }: { s: GameState; x: number; y: number; poder: number | null; ataque: number; children?: React.ReactNode }) {
  const c = s.combat!;
  const p = s.players[c.fighter];
  let estado: string;
  if (c.step === 'decidir') estado = '¿Pelear o huir?';
  else if (c.step === 'tirada') estado = 'Puede comer antes de confirmar';
  else if (c.step === 'rivales') estado = 'Los rivales pueden sabotear';
  else if (c.step === 'victoria') estado = 'Recompensa en espera';
  else estado = c.result === 'gana' ? '¡Venció!' : c.result === 'escapa' ? 'Escapó' : c.result === 'huye' ? 'Huyó' : 'Perdió';
  return (
    <div className="esc-marcador" style={{ left: x, top: y }}>
      <div className="esc-vs">
        <div className="verde" title="Poder del arriero">{poder ?? '?'}</div>
        <span>VS</span>
        <div className="rojo" title="Ataque del mito">{ataque}</div>
      </div>
      {c.dice.length > 0 && (
        <div className="esc-suma">{dadosUsados(c).join(' + ')} + {totalGolpe(p)} equipo{c.bonus ? ` ${c.bonus > 0 ? '+' : '−'} ${Math.abs(c.bonus)}` : ''}{c.food ? ` + ${c.food.d8} ${c.food.nombre.toLowerCase()}` : ''}</div>
      )}
      {c.sabotajes.map((sb, i) => <div key={'s' + i} className="esc-chip rojo"><Dado v={sb.d8} color="azul" /> sabotaje de {s.players[sb.by].nombre}</div>)}
      {c.bizco && <div className="esc-chip rojo">«Bizco»: ataque doble</div>}
      {c.respuestas.map((r, i) => <div key={'r' + i} className="esc-chip verde">{r.d8 > 0 && <Dado v={r.d8} color="azul" />} responde con {r.con}</div>)}
      <div className={`esc-estado ${c.step === 'hecho' ? 'res-' + c.result : ''}`}>{estado}</div>
      {children}
    </div>
  );
}

// ---------------- Vista completa ----------------
export function VistaEscena({ s, sala, yo, posiciones, efecto, onSalir, sonido, enCelular, restante, enviar, chat, enviarChat, convertirIA }: {
  s: GameState; sala: SalaInfo; yo?: number; posiciones: Record<number, Phase>; efecto: EfectoActual; onSalir: () => void;
  sonido?: React.ReactNode; enCelular?: boolean; restante: number | null;
  enviar?: (a: Action) => void; chat?: Mensaje[]; enviarChat?: (t: string) => void; convertirIA?: (i: number) => void;
}) {
  const pnd = pendiente(s);
  const rivales = s.players.filter(q => q.id !== yo);
  const c = s.combat;
  const enCombate = !!c && s.phase === 'monte';
  const fondo = FONDO[s.phase] ?? 'escenarios/escena-plaza';
  // Se precargan los fondos de las cuatro zonas para que el cambio de zona no muestre negro
  useEffect(() => { Object.values(FONDO).forEach(f => { const i = new Image(); i.src = IMG(f); }); }, []);
  const { dispatch, propia } = useDispatchSeguro(s, enviar ?? (() => {}));
  const me = yo !== undefined ? s.players[yo] : null;
  const [verCarta, setVerCarta] = useState<number | null>(null);
  const [pueblo, setPueblo] = useState(false);
  const aviso = useAvisosMano(s, me ?? s.players[0], propia);
  const jugando = !!me && !!enviar && s.winner === null;
  const decidoYo = jugando && !!pnd && pnd.player === yo && pnd.kind !== 'orden';
  const miTurno = jugando && s.current === yo && !pnd;
  const miCombate = jugando && enCombate && c!.fighter === yo;
  const carta = me && verCarta !== null ? me.mano.find(x => x.uid === verCarta) : undefined;
  const otroDecide = pnd && !decidoYo && pnd.kind !== 'orden';
  return (
    <div className="esc">
      <div className="esc-fondo" key={fondo} style={{ backgroundImage: `url(${IMG(fondo)})` }} />
      <div className="esc-velo" />
      <EscenaCentral s={s} efecto={efecto} acciones={miCombate && !pnd ? <AccionesCombate s={s} me={me!} dispatch={dispatch} x={0} y={0} /> : null} />

      <div className="esc-rivales">
        {rivales.map(q => <InsigniaRival key={q.id} s={s} q={q} zona={posiciones[q.id] ?? 'plaza'}
          onReemplazar={sala.soyHost && convertirIA && !q.ia && q.conectado === false ? () => convertirIA(q.id) : undefined} />)}
      </div>
      <BarraInfo s={s} codigo={sala.codigo} yo={yo} onSalir={onSalir} sonido={sonido} enCelular={enCelular} />

      {otroDecide && (
        <div className="esc-decide" style={{ borderColor: s.players[pnd!.player].color }}>
          <Retrato id={s.players[pnd!.player].personaje} color={s.players[pnd!.player].color} tam={52} />
          <div><b>{`${s.players[pnd!.player].nombre} decide`}</b><div>{pnd!.title}</div></div>
          {restante !== null && <span className="mesa-reloj">{restante}</span>}
        </div>
      )}
      {decidoYo && <PanelDecision s={s} me={me!} sala={sala} dispatch={dispatch} />}

      {miTurno && !(miCombate && c!.step !== 'hecho') ? <PanelZona s={s} me={me!} dispatch={dispatch} /> : !enCombate && <Mostrador s={s} yo={yo} />}
      <CronicaMini s={s} />

      {me && <InsigniaPropia s={s} q={me} onAbrir={() => setPueblo(true)} />}
      {me && <ManoAbanico q={me} onVer={setVerCarta} />}

      {carta && me && <Encima><CartaGrande s={s} me={me} card={carta} miTurno={miTurno} dispatch={dispatch} onCerrar={() => setVerCarta(null)} /></Encima>}
      {pueblo && me && (
        <Encima>
          <div className="cel-hoja" onClick={() => setPueblo(false)}>
            <div className="cel-hoja-caja hoja-pueblo" onClick={e => e.stopPropagation()}>
              <div className="cel-hoja-tit">Mi pueblo <button onClick={() => setPueblo(false)}>×</button></div>
              <CelPueblo s={s} me={me} dispatch={dispatch} miTurno={miTurno} chat={chat ?? []} enviarChat={enviarChat ?? (() => {})} onSalir={onSalir} />
            </div>
          </div>
        </Encima>
      )}
      {aviso && me && <Encima><div className={`cel-aviso ${aviso.tipo}`} key={aviso.id}>{aviso.texto}</div></Encima>}
    </div>
  );
}
