// Cliente de red: conexión con el servidor de salas (Socket.io).
import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Action, GameState, restaurar } from '../game/engine';
import { CharacterId } from '../game/data';

export interface AsientoInfo { nombre: string; ia: boolean; personaje: CharacterId | null; ocupado: boolean; conectado: boolean; host: boolean; indice: number }
export interface SalaInfo { codigo: string; n: number; enJuego: boolean; miAsiento: number; soyHost: boolean; asientos: AsientoInfo[]; modo: 'red' | 'mesa'; limite: { player: number; hasta: number } | null }
export interface Mensaje { de: string; color?: string; texto: string; t: number }
export interface Anuncio { titulo: string; texto: string; img?: string }

const CLAVE = 'arrieros-y-cuchillos:red';
/** Servidor de salas. Vacío = mismo origen (Render todo en uno o desarrollo local). En Vercel: la URL de Render. */
export const SERVIDOR = (import.meta.env.VITE_SERVER_URL as string | undefined)?.replace(/\/$/, '') || '';
const guardarSesion = (v: { codigo: string; token: string } | null) => { try { v ? localStorage.setItem(CLAVE, JSON.stringify(v)) : localStorage.removeItem(CLAVE); } catch { /* */ } };
const leerSesion = (): { codigo: string; token: string } | null => { try { return JSON.parse(localStorage.getItem(CLAVE) ?? 'null'); } catch { return null; } };
export const haySesionRed = () => !!leerSesion();
const CLAVE_MESA = 'arrieros-y-cuchillos:mesa';
const leerMesa = (): string | null => { try { return localStorage.getItem(CLAVE_MESA); } catch { return null; } };
const guardarMesa = (c: string | null) => { try { c ? localStorage.setItem(CLAVE_MESA, c) : localStorage.removeItem(CLAVE_MESA); } catch { /* */ } };
export const haySesionMesa = () => !!leerMesa();

export function useRed(activo: boolean, rol: 'jugador' | 'mesa' = 'jugador') {
  const ref = useRef<Socket | null>(null);
  const [conectado, setConectado] = useState(false);
  const [sala, setSala] = useState<SalaInfo | null>(null);
  const [estado, setEstado] = useState<GameState | null>(null);
  const [chat, setChat] = useState<Mensaje[]>([]);
  const [anuncios, setAnuncios] = useState<Anuncio[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const paso = useRef(0);

  useEffect(() => {
    if (!activo) return;
    const s = SERVIDOR ? io(SERVIDOR, { transports: ['websocket', 'polling'] }) : io({ transports: ['websocket', 'polling'] });
    ref.current = s;
    s.on('connect', () => {
      setConectado(true);
      if (rol === 'mesa') {
        const c = leerMesa();
        if (c) s.emit('reconectarMesa', { codigo: c }, (r: any) => { if (!r?.ok) { guardarMesa(null); s.emit('crearMesa', {}, (r2: any) => r2?.ok && guardarMesa(r2.codigo)); } });
        else s.emit('crearMesa', {}, (r: any) => r?.ok && guardarMesa(r.codigo));
        return;
      }
      const ses = leerSesion();
      if (ses) s.emit('reconectar', ses, (r: any) => { if (!r?.ok) { guardarSesion(null); setSala(null); setEstado(null); } });
    });
    s.on('disconnect', () => setConectado(false));
    s.on('sala', (x: SalaInfo) => setSala(x));
    s.on('estado', (x: GameState) => { paso.current = x.paso ?? 0; setEstado(restaurar(x)); });
    s.on('chat', (x: Mensaje[]) => setChat(x));
    s.on('anuncio', (x: Anuncio) => setAnuncios(a => [...a, x]));
    s.on('aviso', (x: string) => setAviso(x));
    s.on('expulsado', () => { guardarSesion(null); setSala(null); setEstado(null); setAviso('El anfitrión cambió tu puesto a IA.'); });
    return () => { s.disconnect(); ref.current = null; };
  }, [activo, rol]);

  const emit = useCallback((ev: string, data?: any) => ref.current?.emit(ev, data), []);
  const unirse = useCallback((codigo: string, nombre: string) => new Promise<string | null>(res => {
    ref.current?.emit('unirse', { codigo, nombre }, (r: any) => { if (r?.ok) { guardarSesion({ codigo: r.codigo, token: r.token }); res(null); } else res(r?.error ?? 'Error'); });
  }), []);
  const crear = useCallback((nombre: string) => new Promise<string | null>(res => {
    ref.current?.emit('crearSala', { nombre }, (r: any) => { if (r?.ok) { guardarSesion({ codigo: r.codigo, token: r.token }); res(null); } else res(r?.error ?? 'Error'); });
  }), []);
  const salir = useCallback(() => { ref.current?.emit('salir'); if (rol === 'mesa') guardarMesa(null); else guardarSesion(null); setSala(null); setEstado(null); setChat([]); }, [rol]);
  const nuevaMesa = useCallback(() => { ref.current?.emit('salir'); guardarMesa(null); setSala(null); setEstado(null); setChat([]); ref.current?.emit('crearMesa', {}, (r: any) => r?.ok && guardarMesa(r.codigo)); }, []);
  const accion = useCallback((a: Action) => { if (a.t !== 'cerrarAnuncio') ref.current?.emit('accion', { ...a, paso: paso.current }); }, []);
  const cerrarAnuncio = useCallback(() => setAnuncios(a => a.slice(1)), []);

  return { conectado, sala, estado, chat, anuncio: anuncios[0] ?? null, cerrarAnuncio, aviso, setAviso, unirse, crear, salir, accion, emit, nuevaMesa };
}
