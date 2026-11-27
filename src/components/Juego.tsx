// Vista de juego en cada dispositivo (PC o celular en horizontal).
// Todos juegan desde la misma mesa: cuando te toca, tus acciones aparecen en la escena.
import { useEffect, useState } from 'react';
import { GameState } from '../game/engine';
import { IMG } from '../game/data';
import { Action } from '../game/engine';
import { SalaInfo, Mensaje, Anuncio } from '../net/red';
import { MesaTablero, usePosiciones } from './Mesa';

interface Props {
  s: GameState; yo: number; sala: SalaInfo; dispatch: (a: Action) => void; chat: Mensaje[]; enviarChat: (t: string) => void;
  anuncio: Anuncio | null; cerrarAnuncio: () => void; onSalir: () => void; onNueva: () => void; convertirIA: (i: number) => void;
}

export function Juego(props: Props) {
  const { s, yo, sala, anuncio, cerrarAnuncio, onSalir, onNueva, dispatch, chat, enviarChat, convertirIA } = props;
  const posiciones = usePosiciones(s);
  // Toda la partida se juega en la misma mesa: tus acciones, decisiones y cartas aparecen en la escena
  return (
    <>
      <MesaTablero s={s} sala={sala} anuncio={anuncio} cerrarAnuncio={cerrarAnuncio} onNueva={onNueva} onSalir={onSalir} posiciones={posiciones} yo={yo}
        enviar={dispatch} chat={chat} enviarChat={enviarChat} convertirIA={convertirIA} />
      <BotonPantallaCompleta />
      <GirarAviso />
    </>
  );
}

/** En celulares verticales pide girar la pantalla: el juego se ve en horizontal. */
export function GirarAviso() {
  return (
    <div className="girar-aviso" role="alert">
      <div className="girar-icono" aria-hidden="true">📱</div>
      <b>Gira tu celular</b>
      <span>Arrieros y Cuchillos se juega en horizontal.</span>
      {puedePantallaCompleta()
        ? <button className="btn" onClick={pantallaCompleta}>Pantalla completa</button>
        : <small className="girar-ios">En iPhone (Safari o Chrome): toca Compartir → «Agregar a pantalla de inicio» y abre el juego desde ese ícono para verlo sin barras.</small>}
    </div>
  );
}

const esTactil = () => typeof window !== 'undefined' && matchMedia('(pointer: coarse)').matches;
export const enPantallaCompleta = () => !!(document.fullscreenElement || (document as any).webkitFullscreenElement) || matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || (navigator as any).standalone === true;
export const puedePantallaCompleta = () => !!(document.documentElement.requestFullscreen || (document.documentElement as any).webkitRequestFullscreen);

/**
 * En celulares, el navegador solo deja entrar a pantalla completa con un toque del usuario:
 * se pide en el primer toque de cada pantalla (y otra vez si se sale), sin que el jugador tenga que buscar un botón.
 */
export function useAutoPantallaCompleta() {
  useEffect(() => {
    if (!esTactil() || !puedePantallaCompleta()) return;
    const f = () => { if (!enPantallaCompleta()) pantallaCompleta(); };
    document.addEventListener('pointerup', f, true);
    return () => document.removeEventListener('pointerup', f, true);
  }, []);
}

/** Botón ⛶ para PC o cuando el navegador no entró solo. */
export function BotonPantallaCompleta() {
  const [activa, setActiva] = useState(enPantallaCompleta());
  useEffect(() => {
    const f = () => setActiva(enPantallaCompleta());
    document.addEventListener('fullscreenchange', f); document.addEventListener('webkitfullscreenchange', f);
    return () => { document.removeEventListener('fullscreenchange', f); document.removeEventListener('webkitfullscreenchange', f); };
  }, []);
  const [ayuda, setAyuda] = useState(false);
  if (activa) return null;
  // iPhone: ningún navegador permite pantalla completa en páginas; se explica cómo instalarlo como app
  if (!puedePantallaCompleta()) {
    if (!esIOS()) return null;
    return (
      <>
        <button className="boton-completa" onClick={() => setAyuda(true)} aria-label="Cómo ver en pantalla completa" title="Pantalla completa">⛶</button>
        {ayuda && <AyudaIOS onCerrar={() => setAyuda(false)} />}
      </>
    );
  }
  return <button className="boton-completa" onClick={pantallaCompleta} aria-label="Pantalla completa" title="Pantalla completa">⛶</button>;
}

const esIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function AyudaIOS({ onCerrar }: { onCerrar: () => void }) {
  const chrome = /CriOS/.test(navigator.userAgent);
  return (
    <div className="cel-anuncio" onClick={onCerrar} role="dialog" aria-label="Pantalla completa en iPhone">
      <div className="cel-anuncio-caja ayuda-ios" onClick={e => e.stopPropagation()}>
        <div>
          <h2>Pantalla completa en iPhone</h2>
          <p>En iPhone ningún navegador deja poner páginas en pantalla completa. Instálalo como app y se abrirá sin barras:</p>
          <ol>
            <li>Toca <b>Compartir</b> {chrome ? '(el cuadrito con la flecha, en la barra de dirección)' : '(el cuadrito con la flecha, abajo)'}.</li>
            <li>Elige <b>«Agregar a pantalla de inicio»</b>.</li>
            <li>Abre el juego desde el ícono nuevo y gira el celular.</li>
          </ol>
          <button className="btn" onClick={onCerrar}>Entendido</button>
        </div>
      </div>
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
