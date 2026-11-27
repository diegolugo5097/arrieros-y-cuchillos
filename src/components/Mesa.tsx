// Tablero de la mesa: lo que todos ven en su dispositivo mientras otro juega.
// Los jugadores juegan desde su dispositivo; esta pantalla solo observa.
import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  IMG, ZONAS, personaje, apoyo, evento, HERRAMIENTAS, MATERIALES, EDIFICIOS, ORDEN_EDIFICIOS, MaterialId, mito, TIER_FONDO, TIER_NOMBRE, RECOMPENSA,
} from '../game/data';
import { Action, GameState, ataqueMito, poderJugador, dadosUsados, totalGolpe, cartasEnMano, pendiente, Phase, ordenDe } from '../game/engine';
import { SalaInfo, Anuncio, SERVIDOR, Mensaje } from '../net/red';
import { ControlSonido } from './Controles';
import { Dados, Dado, Carta, Precio, propsMito, RequisitosConstruccion } from './Cartas';
import { CapaEfectos, useEfectosMesa, EscenarioCtx } from './Efectos';
import { Victoria } from './Modales';
import { VistaEscena } from './Escena';

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
export function MesaTablero({ s, sala, anuncio, cerrarAnuncio, onNueva, onSalir, enCelular, posiciones, yo, reservaDerecha, enviar, chat, enviarChat, convertirIA }: { enviar?: (a: Action) => void; chat?: Mensaje[]; enviarChat?: (t: string) => void; convertirIA?: (i: number) => void; s: GameState; sala: SalaInfo; anuncio: Anuncio | null; cerrarAnuncio: () => void; onNueva: () => void; onSalir: () => void; enCelular?: boolean; posiciones?: Record<number, Phase>; yo?: number; reservaDerecha?: number }) {
  const pnd = pendiente(s);
  // Posición de cada ficha en el mapa: el jugador de turno está en su zona; los demás, donde quedaron
  const propias = usePosiciones(s);
  const pos = posiciones ?? propias;
  const restante = useCuentaRegresiva(sala.limite?.hasta);
  const fx = useEfectosMesa(s);
  // Los dichos y eventos se quedan en pantalla según lo largo del texto (entre 9 y 16 s) para que alcancen a leerse
  const durAnuncio = anuncio ? Math.min(16000, Math.max(9000, 5000 + (anuncio.titulo.length + anuncio.texto.length) * 70)) : 0;
  useEffect(() => { if (!anuncio) return; const id = setTimeout(cerrarAnuncio, durAnuncio); return () => clearTimeout(id); }, [anuncio, cerrarAnuncio, durAnuncio]);

  return (
    <Escenario girable={enCelular} reserva={reservaDerecha}>
      <div className={`mesa ${fx.temblor ? (fx.temblor % 2 ? 'sacude-a' : 'sacude-b') : ''}`}>
        <VistaEscena s={s} sala={sala} yo={yo} posiciones={pos} efecto={fx.actual} onSalir={onSalir}
          enviar={enviar} chat={chat} enviarChat={enviarChat} convertirIA={convertirIA}
          sonido={!enCelular ? <ControlSonido /> : undefined} enCelular={enCelular}
          restante={pnd && sala.limite && sala.limite.player === pnd.player ? restante : null} />

        {s.ordenTiradas && !s.orden && <MesaOrden s={s} yo={yo} enviar={enviar} />}
        <CapaEfectos s={s} efecto={fx.actual} rapido={fx.rapido} yo={yo} />
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
  else if (c.step === 'rivales') estado = <><b>Rivales:</b> pueden sabotear desde su dispositivo{restante !== null ? ` (${restante} s)` : ''}</>;
  else if (c.step === 'victoria') estado = <><b>Recompensa en espera:</b> {c.reward ? `${c.reward.oro} oro · ${c.reward.guacas} guaca${c.reward.guacas === 1 ? '' : 's'} · 1 material` : ''}. Los rivales con «Mató el tigre» o «Filo» deciden si se la quitan{restante !== null ? ` (${restante} s)` : ''}…</>;
  else estado = <b className={c.result === 'gana' || c.result === 'escapa' ? 'ok-txt' : 'err-txt'}>{c.result === 'gana' ? `¡${p.nombre} venció! +${rec.oro} oro, +${rec.guacas} guaca${rec.guacas === 1 ? '' : 's'}` : c.result === 'escapa' ? `${p.nombre} escapó` : `${p.nombre} perdió: ${m.texto.toLowerCase()}`}</b>;
  return (
    <aside className="mesa-combate" aria-label="Combate en curso">
      <div className="mesa-combate-tit">Combate en el Monte</div>
      <div className={`mesa-combate-carta ${c.sabotajes.length ? 'saboteada' : ''} ${c.step === 'hecho' ? 'res-' + c.result : ''}`}>
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
        {c.sabotajes.map((sb, i) => <div key={'s' + i} className="mesa-sabotaje"><Dado v={sb.d8} color="azul" /> sabotaje de {s.players[sb.by].nombre}</div>)}
        {c.bizco && <div className="mesa-sabotaje">«Bizco»: ataque doble</div>}
        {c.respuestas.map((r, i) => <div key={'r' + i} className="mesa-sabotaje mesa-respuesta">{r.d8 > 0 && <Dado v={r.d8} color="azul" />} {s.players[c.fighter].nombre} responde con {r.con}</div>)}
        <div className="mesa-combate-estado">{estado}</div>
      </div>
    </aside>
  );
}

/** Tirada inicial para el orden de turnos: cada jugador tira desde su dispositivo. */
function MesaOrden({ s, yo, enviar }: { s: GameState; yo?: number; enviar?: (a: Action) => void }) {
  const pnd = pendiente(s);
  const [rodando, setRodando] = useState(false);
  const meToca = pnd?.kind === 'orden' && pnd.player === yo && !!enviar;
  const tirar = () => {
    if (rodando || !enviar) return;
    setRodando(true);
    try { navigator.vibrate?.([30, 40, 30]); } catch { /* */ }
    setTimeout(() => { enviar({ t: 'choose', id: 'tirar' }); setRodando(false); }, 600);
  };
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
                {tirando && q.id === yo && meToca
                  ? <button className="mesa-orden-tirar" disabled={rodando} onClick={tirar}>{rodando ? 'Rodando…' : t.length ? '¡Empate! Tira otra vez' : 'Tirar el D6'}</button>
                  : <span>{tirando ? (q.ia ? 'Tirando…' : 'Tirando en su dispositivo') : t.length ? 'Listo' : 'Esperando'}</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
