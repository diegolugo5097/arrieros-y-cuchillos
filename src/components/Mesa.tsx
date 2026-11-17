// Tablero de la mesa: lo que todos ven en su dispositivo mientras otro juega.
// Los jugadores juegan desde su celular; esta pantalla solo observa.
import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  IMG, ZONAS, personaje, apoyo, evento, HERRAMIENTAS, MATERIALES, EDIFICIOS, ORDEN_EDIFICIOS, MaterialId, mito, TIER_FONDO, TIER_NOMBRE, RECOMPENSA,
} from '../game/data';
import { GameState, ataqueMito, poderJugador, dadosUsados, totalGolpe, cartasEnMano, pendiente, Phase, ordenDe } from '../game/engine';
import { SalaInfo, Anuncio, SERVIDOR } from '../net/red';
import { ControlSonido } from './Controles';
import { Dados, Dado, Carta, propsMito } from './Cartas';
import { CapaEfectos, useEfectosMesa, EscenarioCtx } from './Efectos';
import { Victoria } from './Modales';

/** Escenario de 1920×1080 escalado para llenar cualquier pantalla. */
/**
 * Escenario de base 1920×1080 que llena toda la pantalla: se escala por la altura (o el ancho)
 * y se estira en la otra dirección, así no quedan barras a los lados en celulares alargados.
 */
function Escenario({ children, girable, reserva = 0 }: { children: React.ReactNode; girable?: boolean; reserva?: number }) {
  const [e, setE] = useState({ k: 1, girar: false, w: 1920, h: 1080 });
  useEffect(() => {
    const f = () => {
      const girar = !!girable && window.innerHeight > window.innerWidth;
      const W = (girar ? window.innerHeight : window.innerWidth) - reserva, H = girar ? window.innerWidth : window.innerHeight;
      const ancho = W / H >= 1920 / 1080;
      const k = ancho ? H / 1080 : W / 1920;
      setE({ k, girar, w: ancho ? W / k : 1920, h: ancho ? 1080 : H / k });
    };
    f(); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f);
  }, [girable, reserva]);
  const esc = useMemo(() => ({ ex: e.w - 1920, ey: e.h - 1080 }), [e.w, e.h]);
  return (
    <div className={`mesa-fondo ${girable ? 'en-celular' : ''}`}>
      <EscenarioCtx.Provider value={esc}>
        <div className="mesa-escenario" style={{
          width: e.w, height: e.h, left: reserva ? `calc(50% - ${reserva / 2}px)` : undefined,
          transform: `translate(-50%, -50%)${e.girar ? ' rotate(90deg)' : ''} scale(${e.k})`,
          ['--ex' as string]: `${esc.ex}px`, ['--ey' as string]: `${esc.ey}px`,
        }}>{children}</div>
      </EscenarioCtx.Provider>
    </div>
  );
}

function useCuentaRegresiva(hasta?: number | null) {
  const [ahora, setAhora] = useState(Date.now());
  useEffect(() => { if (!hasta) return; const id = setInterval(() => setAhora(Date.now()), 250); return () => clearInterval(id); }, [hasta]);
  return hasta ? Math.max(0, Math.ceil((hasta - ahora) / 1000)) : null;
}
export { useCuentaRegresiva };

/** Zona donde quedó la ficha de cada jugador: el de turno está en su zona; los demás, donde terminaron. */
export function usePosiciones(s: GameState) {
  const pos = useRef<Record<number, Phase>>({});
  if (s.phase !== 'fin') pos.current[s.current] = s.phase;
  return pos.current;
}

export function useEnlace(codigo: string) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let vivo = true;
    const base = (host: string) => `${location.protocol}//${host}${location.port ? ':' + location.port : ''}${location.pathname}?sala=${codigo}`;
    const local = ['localhost', '127.0.0.1', '::1'].includes(location.hostname);
    if (!local) { setUrl(base(location.hostname)); return; }
    fetch(`${SERVIDOR}/api/info`).then(r => r.json()).then(d => { if (vivo) setUrl(base(d.ips?.[0] ?? location.hostname)); }).catch(() => vivo && setUrl(base(location.hostname)));
    return () => { vivo = false; };
  }, [codigo]);
  return url;
}

// ---------------- Sala de espera ----------------
export function MesaSala({ sala, onSalir }: { sala: SalaInfo; onSalir: () => void }) {
  const url = useEnlace(sala.codigo);
  const [qr, setQr] = useState('');
  useEffect(() => { if (url) QRCode.toDataURL(url, { margin: 1, width: 400, color: { dark: '#2b1d12', light: '#f4e9d2' } }).then(setQr).catch(() => setQr('')); }, [url]);
  const direccion = url.replace(/^https?:\/\//, '').replace(/\/?\?sala=.*$/, '');
  return (
    <Escenario>
      <div className="mesa-sala" style={{ backgroundImage: `url(${IMG('escenarios/mapa')})` }}>
        <div className="mesa-sala-velo" />
        <div className="mesa-sala-col">
          <div className="mesa-logo"><div>Arrieros</div><span>y</span><div>Cuchillos</div></div>
          <div className="mesa-qr-caja">
            {qr ? <img className="mesa-qr" src={qr} alt="Código QR para unirse" /> : <div className="mesa-qr vacio">Generando QR…</div>}
            <div className="mesa-qr-texto">
              <div>Escanea el QR o entra desde tu celular a</div>
              <div className="mesa-dir">{direccion}</div>
              <div>y escribe el código</div>
              <div className="mesa-codigo-grande">{sala.codigo}</div>
            </div>
          </div>
        </div>
        <div className="mesa-sala-panel">
          <div className="mesa-sala-titulo">Arrieros en la mesa</div>
          <div className="mesa-sala-puestos">
            {sala.asientos.map(a => (a.ocupado || a.ia) ? (
              <div key={a.indice} className="mesa-puesto" style={{ borderColor: ['#c0392b', '#2471a3', '#229954', '#b9770e'][a.indice] }}>
                {a.personaje ? <img src={IMG(`personajes/${a.personaje}`)} alt="" /> : <div className="mesa-puesto-sin">?</div>}
                <div>
                  <div className="mesa-puesto-nombre" style={{ color: ['#c0392b', '#2471a3', '#229954', '#b9770e'][a.indice] }}>{a.nombre}{a.host && <span className="chip">Anfitrión</span>}</div>
                  <div className="mesa-puesto-pj">{a.personaje ? personaje(a.personaje).nombre : a.ia ? 'Personaje al azar' : 'Eligiendo personaje…'}</div>
                  <div className={`mesa-puesto-estado ${a.personaje || a.ia ? 'listo' : ''}`}>{a.ia ? 'IA' : a.personaje ? 'Listo' : 'En el celular'}{!a.ia && !a.conectado ? ' · desconectado' : ''}</div>
                </div>
              </div>
            ) : (
              <div key={a.indice} className="mesa-puesto libre">Puesto libre<span>entra con el código o el anfitrión lo deja a la IA</span></div>
            ))}
          </div>
          <div className="mesa-sala-pie">
            <div>La partida empieza cuando el anfitrión toque <b>Comenzar</b> en su dispositivo.</div>
            <div className="mesa-chip-claro">8 cartas iniciales · orden con D6</div>
          </div>
          <div className="mesa-sala-botones"><ControlSonido /><button className="btn chico sec" onClick={onSalir}>Cerrar mesa</button></div>
        </div>
      </div>
    </Escenario>
  );
}

// ---------------- Tablero ----------------
const POS_ZONA: Record<string, { left?: string; right?: string; top: string; alinear: string; trans?: string }> = {
  monte: { left: '50%', top: '9%', alinear: 'center', trans: 'translateX(-50%)' },
  plaza: { left: '50%', top: '45%', alinear: 'center', trans: 'translateX(-50%)' },
  taller: { left: '6%', top: '50%', alinear: 'flex-start' },
  campo: { right: '6%', top: '50%', alinear: 'flex-end' },
};
const NUM_ZONA: Record<string, number> = { plaza: 1, monte: 2, taller: 3, campo: 4 };

export function MesaTablero({ s, sala, anuncio, cerrarAnuncio, onNueva, onSalir, enCelular, posiciones, yo, reservaDerecha }: { s: GameState; sala: SalaInfo; anuncio: Anuncio | null; cerrarAnuncio: () => void; onNueva: () => void; onSalir: () => void; enCelular?: boolean; posiciones?: Record<number, Phase>; yo?: number; reservaDerecha?: number }) {
  const p = s.players[s.current];
  const pnd = pendiente(s);
  // Posición de cada ficha en el mapa: el jugador de turno está en su zona; los demás, donde quedaron
  const propias = usePosiciones(s);
  const pos = posiciones ?? propias;
  const zonaDe = (i: number) => pos[i] ?? 'plaza';
  const restante = useCuentaRegresiva(sala.limite?.hasta);
  const fx = useEfectosMesa(s);
  // Los dichos y eventos se quedan en pantalla según lo largo del texto (entre 9 y 16 s) para que alcancen a leerse
  const durAnuncio = anuncio ? Math.min(16000, Math.max(9000, 5000 + (anuncio.titulo.length + anuncio.texto.length) * 70)) : 0;
  useEffect(() => { if (!anuncio) return; const id = setTimeout(cerrarAnuncio, durAnuncio); return () => clearTimeout(id); }, [anuncio, cerrarAnuncio, durAnuncio]);
  const ultimo = useMemo(() => [...s.log].reverse().find(l => !l.t.startsWith('—') && !l.t.startsWith('=')), [s.log]);
  const fases = ['plaza', 'monte', 'taller', 'campo'];
  const idx = fases.indexOf(s.phase);
  const proxEvento = 3 - ((s.round - 1) % 3);
  const c = s.combat;
  const verCombate = !!c && s.phase === 'monte';

  return (
    <Escenario girable={enCelular} reserva={reservaDerecha}>
      <div className={`mesa ${fx.temblor ? (fx.temblor % 2 ? 'sacude-a' : 'sacude-b') : ''}`}>
        <header className="mesa-barra">
          <div className="mesa-barra-logo">Arrieros <span>y</span> Cuchillos</div>
          <div className="mesa-ronda">Ronda {s.round}</div>
          <nav className="mesa-fases" aria-label="Zonas del turno">
            {ZONAS.map((z, i) => <div key={z.id} className={`mesa-fase ${i === idx ? 'actual' : i > idx ? 'futura' : ''}`}><span>{i + 1}</span>{z.nombre.replace(' y Construcción', '').replace(' de Cultivo', '').replace(' Principal', '')}</div>)}
          </nav>
          <div className="mesa-evento">
            {s.evento ? <><span className="mesa-evento-et">Evento</span><b>{evento(s.evento).nombre}</b><span>· {evento(s.evento).texto}</span></>
              : <><span className="mesa-evento-et">Evento</span><span>Próximo en {proxEvento} ronda{proxEvento === 1 ? '' : 's'}</span></>}
            {s.gato && <span className="chip">Habilidades anuladas</span>}
          </div>
          <div className="mesa-unete"><span>{yo !== undefined ? <>Juegas como<br /><b className="mesa-yo" style={{ color: s.players[yo].color }}>{s.players[yo].nombre}</b></> : <>Código de<br />la partida</>}</span><b>{sala.codigo}</b></div>
          {!enCelular && <ControlSonido />}
          <button className={`btn chico ${enCelular ? 'mesa-cerrar' : 'sec'}`} onClick={onSalir}>{enCelular ? '✕ Volver' : 'Salir'}</button>
        </header>

        <main className="mesa-centro">
          <aside className="mesa-mercado" aria-label="Mazos y mercado">
            <div className="mesa-mazos">
              <div><img src={IMG('cartas/dorso-monte')} alt="Mazo del Monte" /><span>Monte · {s.monteCount ?? s.monte.length}</span></div>
              <div><img src={IMG('cartas/dorso-morral')} alt="Mazo del Morral" /><span>Morral · {s.morralCount ?? s.morral.length}</span></div>
            </div>
            <div className="mesa-sub">Herramientas del Taller</div>
            <div className="mesa-herramientas">
              {s.reveladas.map((t, i) => <div key={t + i}><img src={IMG(HERRAMIENTAS[t].img)} alt="" /><b>{HERRAMIENTAS[t].nombre}</b><span>{HERRAMIENTAS[t].precio} oro</span></div>)}
              {!s.reveladas.length && <span className="mesa-nota">No quedan herramientas</span>}
            </div>
            <div className="mesa-sub">Apoyos en la Plaza</div>
            <div className="mesa-apoyos">
              {s.apoyosRevelados.map(id => <div key={id}><img src={IMG(apoyo(id).img)} alt="" /><div><b>{apoyo(id).nombre}</b><div>{apoyo(id).pasiva}</div></div></div>)}
            </div>
          </aside>

          <section className="mesa-mapa" aria-label="Mapa del pueblo">
            <img className="mesa-mapa-img" src={IMG('escenarios/mapa')} alt="" />
            <svg aria-hidden="true" viewBox="0 0 1000 600" preserveAspectRatio="none" className="mesa-sendero">
              <path d="M500 330 C 420 230, 470 150, 500 110 M500 110 C 560 160, 620 260, 790 330 M790 330 C 700 420, 560 460, 500 330 M500 330 C 380 380, 300 340, 210 330" />
            </svg>
            {fases.map(z => {
              const pz = POS_ZONA[z];
              const aqui = s.players.filter(q => zonaDe(q.id) === z);
              const activa = s.phase === z;
              return (
                <div key={z} className="mesa-zona" style={{ left: pz.left, right: pz.right, top: pz.top, transform: pz.trans, alignItems: pz.alinear }}>
                  <div className={`mesa-zona-etiqueta ${activa ? (z === 'monte' ? 'monte' : 'activa') : ''}`}><span>{NUM_ZONA[z]}</span>{ZONAS.find(x => x.id === z)!.nombre}</div>
                  <div className="mesa-fichas">
                    {aqui.map(q => (
                      <div key={q.id} className={`mesa-ficha ${q.id === s.current ? 'actual' : ''}`} style={{ borderColor: q.color }} title={q.nombre}>
                        <img src={IMG(personaje(q.personaje).img)} alt={`Ficha de ${q.nombre}`} />
                      </div>
                    ))}
                    {aqui.some(q => q.id === s.current) && <div className="mesa-ficha-texto">{p.nombre} {z === 'monte' ? (c && c.step !== 'hecho' ? 'pelea aquí' : 'explora') : 'está aquí'}</div>}
                  </div>
                </div>
              );
            })}
            {pnd && <div className="mesa-decide" style={{ borderColor: s.players[pnd.player].color }}><img src={IMG(personaje(s.players[pnd.player].personaje).img)} alt="" /><div><b>{s.players[pnd.player].nombre} decide{s.players[pnd.player].ia ? '' : ' en su dispositivo'}</b><div>{pnd.title}</div></div>{sala.limite && sala.limite.player === pnd.player && restante !== null && <span className="mesa-reloj">{restante}</span>}</div>}
            {ultimo && <div className="mesa-ultimo"><b>Último:</b> {ultimo.t}</div>}
          </section>

          {verCombate ? <MesaCombate s={s} restante={sala.limite ? restante : null} /> : <MesaCronica s={s} />}
        </main>

        <section className="mesa-pueblos" aria-label="Pueblos de los jugadores" style={{ gridTemplateColumns: `repeat(${s.players.length}, minmax(0, 1fr))` }}>
          {s.players.map(q => {
            const n = cartasEnMano(q);
            const estado = q.id === s.current ? 'Jugando' : pnd?.player === q.id ? 'Decidiendo' : q.ia ? 'IA' : q.conectado === false ? 'Desconectado' : 'Esperando';
            return (
              <article key={q.id} className={`mesa-pueblo ${q.id === s.current ? 'actual' : ''} ${q.id === yo ? 'yo' : ''}`} style={{ borderColor: q.color }}>
                <div className="mesa-pueblo-cab">
                  <img src={IMG(personaje(q.personaje).img)} alt="" />
                  {s.orden && <b className="mesa-orden-num" style={{ background: q.color }} title="Orden de turno">{ordenDe(s).indexOf(q.id) + 1}º</b>}
                  <div className="mesa-pueblo-nom"><div style={{ color: q.color }}>{q.nombre}</div><span>{personaje(q.personaje).nombre} · {personaje(q.personaje).rol}</span></div>
                  <span className="mesa-estado" style={{ background: estado === 'Desconectado' ? '#7a6a5a' : q.color }}>{estado}</span>
                </div>
                <div className="mesa-pueblo-rec">
                  <span><img src={IMG('objetos/oro')} alt="Oro" />{q.oro}</span>
                  <span><img src={IMG('objetos/guaca')} alt="Guacas" />{q.guacas}</span>
                  {(['G', 'M', 'B'] as MaterialId[]).map(k => <span key={k}><img src={IMG(MATERIALES[k].img)} alt={MATERIALES[k].nombre} />{q.mat[k]}</span>)}
                  <span><img src={IMG('objetos/machete')} alt="Golpe de equipo" />+{totalGolpe(q)}</span>
                  {(['puntilla', 'martillo', 'serrucho'] as const).map(t => q.tools[t] > 0 && <span key={t}><img src={IMG(HERRAMIENTAS[t].img)} alt={HERRAMIENTAS[t].nombre} />{q.tools[t]}</span>)}
                </div>
                <div className="mesa-pueblo-pie">
                  <div className="mesa-edificios">
                    {ORDEN_EDIFICIOS.map(b => <img key={b} className={q.edificios[b] ?? 'no'} src={IMG(q.edificios[b] === 'danada' ? EDIFICIOS[b].imgDanada : EDIFICIOS[b].img)} alt={EDIFICIOS[b].nombre} title={EDIFICIOS[b].nombre} />)}
                  </div>
                  <div className="mesa-mano">
                    <div>{Array.from({ length: Math.min(n, 6) }, (_, i) => <img key={i} src={IMG('cartas/dorso-morral')} alt="" />)}</div>
                    <span>{n} carta{n === 1 ? '' : 's'}</span>
                  </div>
                </div>
                {(q.apoyo || q.saltaPlaza || q.saltaMonte || q.pierdeTurno) && (
                  <div className="mesa-pueblo-extra">
                    {q.apoyo && <span className="chip">{apoyo(q.apoyo).nombre}</span>}
                    {q.saltaPlaza && <span className="chip">Enguayabado</span>}
                    {q.saltaMonte && <span className="chip">Sin Monte</span>}
                    {q.pierdeTurno && <span className="chip">Pierde turno</span>}
                  </div>
                )}
              </article>
            );
          })}
        </section>

        {s.ordenTiradas && !s.orden && <MesaOrden s={s} />}
        <CapaEfectos s={s} efecto={fx.actual} rapido={fx.rapido} />
        {anuncio && (
          <div className="mesa-anuncio" onClick={cerrarAnuncio}>
            <div className="mesa-anuncio-caja">
              {anuncio.img && <div className="mesa-anuncio-img" style={{ backgroundImage: `url(${IMG(anuncio.img)})` }} />}
              <h2>{anuncio.titulo}</h2>
              <p>{anuncio.texto}</p>
              <div className="mesa-anuncio-tiempo" key={anuncio.titulo + anuncio.texto}><i style={{ animationDuration: `${durAnuncio}ms` }} /></div>
            </div>
          </div>
        )}
        {s.winner !== null && <Victoria s={s} onNueva={onNueva} />}
      </div>
    </Escenario>
  );
}

export function MesaCombate({ s, restante }: { s: GameState; restante: number | null }) {
  const c = s.combat!;
  const p = s.players[c.fighter];
  const m = mito(c.mitoId);
  const ataque = ataqueMito(s, c);
  const poder = c.dice.length ? poderJugador(s, c) : null;
  const rec = c.reward ?? RECOMPENSA[m.tier];
  let estado: React.ReactNode;
  if (c.step === 'decidir') estado = <><b>{p.nombre}</b> decide{p.ia ? '' : ' en su dispositivo'}: ¿pelear o huir?</>;
  else if (c.step === 'tirada') estado = <><b>{p.nombre}</b> puede comer antes de confirmar.</>;
  else if (c.step === 'rivales') estado = <><b>Rivales:</b> pueden sabotear desde su celular{restante !== null ? ` (${restante} s)` : ''}</>;
  else if (c.step === 'victoria') estado = <><b>Rivales:</b> pueden quitarle la recompensa{restante !== null ? ` (${restante} s)` : ''}</>;
  else estado = <b className={c.result === 'gana' || c.result === 'escapa' ? 'ok-txt' : 'err-txt'}>{c.result === 'gana' ? `¡${p.nombre} venció! +${rec.oro} oro, +${rec.guacas} guaca${rec.guacas === 1 ? '' : 's'}` : c.result === 'escapa' ? `${p.nombre} escapó` : `${p.nombre} perdió: ${m.texto.toLowerCase()}`}</b>;
  return (
    <aside className="mesa-combate" aria-label="Combate en curso">
      <div className="mesa-combate-tit">Combate en el Monte</div>
      <div className={`mesa-combate-carta ${c.sabotage ? 'saboteada' : ''} ${c.step === 'hecho' ? 'res-' + c.result : ''}`}>
        <Carta {...propsMito(c.mitoId, ataque, c.reward ?? undefined)} w={250} key={c.mitoId} />
        {c.step === 'hecho' && c.result === 'gana' && <div className="fx-cortes chico"><i /><i /><i /></div>}
      </div>
      <div className="mesa-combate-cuerpo">
        <div className="mesa-marcador">
          <div className="verde">{poder ?? '?'}</div><span>contra</span><div className="rojo">{ataque}</div>
        </div>
        {c.dice.length > 0 ? (
          <div className="mesa-dados"><Dados valores={c.dice} descartado={c.dice.length === 3 ? Math.min(...c.dice) : undefined} /><span>{p.nombre} sacó <b>{dadosUsados(c).join(' + ')}</b> + {totalGolpe(p)} de equipo{c.bonus ? ` ${c.bonus > 0 ? '+' : '−'} ${Math.abs(c.bonus)}` : ''}{c.food ? <> + <Dado v={c.food.d8} color="azul" /> {c.food.nombre}</> : null}</span></div>
        ) : <div className="mesa-dados"><span>{p.nombre} con +{totalGolpe(p)} de equipo</span></div>}
        {c.sabotage && <div className="mesa-sabotaje"><Dado v={c.sabotage.d8} color="azul" /> sabotaje de {s.players[c.sabotage.by].nombre}{c.bizco ? ' · ataque doble' : ''}</div>}
        <div className="mesa-combate-estado">{estado}</div>
      </div>
    </aside>
  );
}

function MesaCronica({ s }: { s: GameState }) {
  const p = s.players[s.current];
  const lineas = s.log.slice(-9).reverse();
  return (
    <aside className="mesa-cronica" aria-label="Crónica del turno">
      <div className="mesa-combate-tit">Turno de {p.nombre}</div>
      <div className="mesa-cronica-arte" style={{ backgroundImage: `url(${IMG(ZONAS.find(z => z.id === s.phase)?.img ?? 'escenarios/mapa')})` }}>
        <img src={IMG(personaje(p.personaje).img)} alt="" />
        <div className="mesa-cronica-zona">{ZONAS.find(z => z.id === s.phase)?.nombre}</div>
      </div>
      <div className="mesa-cronica-lista">
        {lineas.map((l, i) => <div key={l.n ?? i} className={l.t.startsWith('—') || l.t.startsWith('=') ? 'sep' : ''} style={{ borderLeftColor: l.p !== undefined ? s.players[l.p].color : 'transparent' }}>{l.t}</div>)}
      </div>
    </aside>
  );
}

/** Tirada inicial para el orden de turnos: cada jugador tira desde su celular. */
function MesaOrden({ s }: { s: GameState }) {
  const pnd = pendiente(s);
  return (
    <div className="mesa-orden">
      <div className="mesa-orden-caja">
        <div className="mesa-orden-tit">¿Quién empieza?</div>
        <div className="mesa-orden-sub">Cada arriero tira un D6 desde su dispositivo. El que saque más arranca.</div>
        <div className="mesa-orden-fila">
          {s.players.map(q => {
            const t = s.ordenTiradas?.[q.id] ?? [];
            const tirando = pnd?.kind === 'orden' && pnd.player === q.id;
            return (
              <div key={q.id} className={`mesa-orden-jug ${tirando ? 'tirando' : ''}`} style={{ borderColor: q.color }}>
                <img src={IMG(personaje(q.personaje).img)} alt="" />
                <b style={{ color: q.color }}>{q.nombre}</b>
                <div className="mesa-orden-dados">
                  {t.length ? t.map((v, k) => <Dado key={k} v={v} grande={k === t.length - 1} tachado={k < t.length - 1} />) : <span className="mesa-orden-q">?</span>}
                </div>
                <span>{tirando ? (q.ia ? 'Tirando…' : 'Tirando en su dispositivo') : t.length ? 'Listo' : 'Esperando'}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
