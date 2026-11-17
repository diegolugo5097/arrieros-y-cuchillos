// Vista de juego en cada dispositivo (PC o celular en horizontal).
// Todos ven la mesa mientras otro juega; cada uno pasa a sus controles solo cuando le toca jugar o intervenir.
import { useEffect, useState } from 'react';
import { GameState, pendiente } from '../game/engine';
import { IMG } from '../game/data';
import { Action } from '../game/engine';
import { SalaInfo, Mensaje, Anuncio } from '../net/red';
import { MesaTablero, usePosiciones } from './Mesa';
import { ControlCelular } from './Celular';

interface Props {
  s: GameState; yo: number; sala: SalaInfo; dispatch: (a: Action) => void; chat: Mensaje[]; enviarChat: (t: string) => void;
  anuncio: Anuncio | null; cerrarAnuncio: () => void; onSalir: () => void; onNueva: () => void; convertirIA: (i: number) => void;
}

export function Juego(props: Props) {
  const { s, yo, sala, anuncio, cerrarAnuncio, onSalir, onNueva } = props;
  const pnd = pendiente(s);
  // Si hay una decisión pendiente, interviene solo quien debe decidir; si no, el jugador de turno
  const toca = s.winner === null && (pnd ? pnd.player === yo : s.current === yo);
  const [ver, setVer] = useState<'auto' | 'mesa' | 'propio'>('auto');
  const claveDecision = pnd && pnd.player === yo ? `${pnd.kind}:${pnd.title}:${s.paso ?? 0}` : '';
  useEffect(() => { setVer('auto'); }, [toca]);
  useEffect(() => { if (claveDecision) setVer('auto'); }, [claveDecision]);
  const posiciones = usePosiciones(s);
  const mostrarMesa = s.winner !== null || (ver === 'auto' ? !toca : ver === 'mesa');
  const me = s.players[yo];

  return (
    <>
      {mostrarMesa
        ? <MesaTablero s={s} sala={sala} anuncio={anuncio} cerrarAnuncio={cerrarAnuncio} onNueva={onNueva} onSalir={onSalir} posiciones={posiciones} yo={yo} />
        : <ControlCelular {...props} espectador={!toca} onVerMesa={() => setVer('mesa')} />}
      {mostrarMesa && s.winner === null && (
        <div className="mesa-flotante">
          {toca
            ? <button className="dorado" onClick={() => setVer('auto')}>{pnd?.player === yo ? 'Te toca decidir →' : 'Volver a mi turno →'}</button>
            : <button onClick={() => setVer('propio')}><img src={IMG('cartas/dorso-morral')} alt="" />Mis cartas · {me.mano.length}</button>}
        </div>
      )}
      {!mostrarMesa && anuncio && <AnuncioFlotante a={anuncio} onCerrar={cerrarAnuncio} />}
      <GirarAviso />
    </>
  );
}

/** Dichos y eventos cuando el jugador está en sus controles (en la mesa los muestra el tablero). */
function AnuncioFlotante({ a, onCerrar }: { a: Anuncio; onCerrar: () => void }) {
  const dur = Math.min(16000, Math.max(9000, 5000 + (a.titulo.length + a.texto.length) * 70));
  useEffect(() => { const id = setTimeout(onCerrar, dur); return () => clearTimeout(id); }, [a, onCerrar, dur]);
  return (
    <div className="cel-anuncio" onClick={onCerrar} role="dialog" aria-label={a.titulo}>
      <div className="cel-anuncio-caja">
        {a.img && <div className="cel-anuncio-img" style={{ backgroundImage: `url(${IMG(a.img)})` }} />}
        <div>
          <h2>{a.titulo}</h2>
          <p>{a.texto}</p>
          <div className="mesa-anuncio-tiempo"><i style={{ animationDuration: `${dur}ms` }} /></div>
          <small>Toca para cerrar</small>
        </div>
      </div>
    </div>
  );
}

/** En celulares verticales pide girar la pantalla: el juego se ve en horizontal. */
export function GirarAviso() {
  return (
    <div className="girar-aviso" role="alert">
      <div className="girar-icono" aria-hidden="true">📱</div>
      <b>Gira tu celular</b>
      <span>Arrieros y Cuchillos se juega en horizontal.</span>
      <button className="btn" onClick={pantallaCompleta}>Pantalla completa</button>
    </div>
  );
}

/** Pantalla completa y orientación horizontal (donde el navegador lo permite, p. ej. Chrome en Android). */
export function pantallaCompleta() {
  try {
    const el = document.documentElement as any;
    const p = el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.();
    Promise.resolve(p).then(() => (screen.orientation as any)?.lock?.('landscape')).catch(() => { /* no soportado */ });
  } catch { /* no soportado */ }
}
