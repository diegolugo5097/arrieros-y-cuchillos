// Servidor en red de Arrieros y Cuchillos (Express + Socket.io).
// El servidor es la autoridad: guarda la partida, valida cada acción con el motor de reglas
// y envía a cada jugador solo lo que puede ver. La IA también juega aquí.
import express from 'express';
import { createServer } from 'node:http';
import { Server, Socket } from 'socket.io';
import { existsSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { aplicar, crearPartida, GameState, Action, vistaPara } from '../src/game/engine';
import { aiAction } from '../src/game/ai';
import { PERSONAJES, CharacterId } from '../src/game/data';

const PORT = Number(process.env.PORT ?? 3000);
const DIR = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(DIR, '../dist');

interface Asiento { nombre: string; ia: boolean; personaje: CharacterId | null; token: string | null; socketId: string | null }
interface Mensaje { de: string; color?: string; texto: string; t: number }
interface Sala {
  codigo: string; host: string; n: number; asientos: Asiento[]; estado: GameState | null; modo: 'red' | 'mesa';
  chat: Mensaje[]; timer: NodeJS.Timeout | null; timerReaccion: NodeJS.Timeout | null; actualizado: number;
  mesas: Set<string>; // sockets de las pantallas de mesa (observadoras)
  limite: { player: number; hasta: number; clave?: string } | null;
}
const SEG_REACCION = 15;
const lanIps = () => Object.values(networkInterfaces()).flat().filter(n => n && n.family === 'IPv4' && !n.internal).map(n => n!.address);
const salas = new Map<string, Sala>();
const NOMBRES_IA = ['IA Arriera', 'IA Comadre', 'IA Compadre', 'IA Patrona'];

const app = express();
const http = createServer(app);
const io = new Server(http, { cors: { origin: true } });

app.get('/api/salud', (_req, res) => { res.json({ ok: true, salas: salas.size }); });
app.use('/api', (_req, res, next) => { res.setHeader('Access-Control-Allow-Origin', '*'); next(); });
app.get('/api/info', (_req, res) => { res.json({ ips: lanIps(), puerto: PORT }); });
if (existsSync(DIST)) {
  app.use(express.static(DIST));
  app.get(/^(?!\/socket\.io).*/, (_req, res) => res.sendFile(path.join(DIST, 'index.html')));
}

const nuevoCodigo = () => {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let c: string;
  do { c = Array.from({ length: 4 }, () => letras[Math.floor(Math.random() * letras.length)]).join(''); } while (salas.has(c));
  return c;
};
const nuevoToken = () => randomBytes(16).toString('hex');
const asientoDe = (sala: Sala, socket: Socket) => sala.asientos.findIndex(a => a.socketId === socket.id);
const salaDe = (socket: Socket): Sala | undefined => { const c = socket.data.sala as string | undefined; return c ? salas.get(c) : undefined; };
const limpiarTexto = (t: unknown, max = 18) => String(t ?? '').replace(/[<>]/g, '').trim().slice(0, max);

function infoSala(sala: Sala, yo: number) {
  return {
    codigo: sala.codigo, n: sala.n, enJuego: !!sala.estado, miAsiento: yo, soyHost: yo >= 0 && !!sala.host && sala.asientos[yo]?.token === sala.host, modo: sala.modo, limite: sala.limite,
    asientos: sala.asientos.slice(0, sala.n).map((a, i) => ({ nombre: a.nombre, ia: a.ia, personaje: a.personaje, ocupado: !!a.token, conectado: !!a.socketId, host: a.token === sala.host && !!a.token, indice: i })),
  };
}
function emitirSala(sala: Sala) {
  sala.actualizado = Date.now();
  for (let i = 0; i < sala.asientos.length; i++) {
    const a = sala.asientos[i];
    if (a.socketId) io.to(a.socketId).emit('sala', infoSala(sala, i));
  }
  for (const id of sala.mesas) io.to(id).emit('sala', infoSala(sala, -1));
}
function emitirEstado(sala: Sala) {
  if (!sala.estado) return;
  sala.asientos.forEach((a, i) => {
    if (!a.socketId) return;
    const v = vistaPara(sala.estado!, i);
    v.players.forEach((p, k) => { p.conectado = sala.asientos[k]?.ia || !!sala.asientos[k]?.socketId; });
    io.to(a.socketId).emit('estado', v);
  });
  if (sala.mesas.size) {
    const v = vistaPara(sala.estado, null);
    v.players.forEach((p, k) => { p.conectado = sala.asientos[k]?.ia || !!sala.asientos[k]?.socketId; });
    for (const id of sala.mesas) io.to(id).emit('estado', v);
  }
}

/** Tras cada cambio: anuncios, envío del estado y turno de la IA. */
function despues(sala: Sala) {
  let s = sala.estado!;
  if (s.anuncio) {
    io.to(sala.codigo).emit('anuncio', s.anuncio);
    s = aplicar(s, { t: 'cerrarAnuncio' });
    sala.estado = s;
  }
  if (sala.timerReaccion) { clearTimeout(sala.timerReaccion); sala.timerReaccion = null; }
  // Reacciones con tiempo límite para que nadie bloquee la partida
  const pnd = s.queue[0];
  // Sabotear y responder a un sabotaje no tienen reloj: cada jugador decide con calma
  const conLimite = pnd && !s.players[pnd.player].ia && ['victoria-rival', 'otro-perro'].includes(pnd.kind);
  const antes = sala.limite;
  // Cada decisión tiene su propio reloj: si cambia la decisión (aunque sea del mismo jugador), se reinicia
  const clave = pnd ? `${pnd.kind}|${pnd.player}|${pnd.title}|${pnd.options.map(o => o.id).join(',')}` : '';
  sala.limite = conLimite ? (antes && antes.clave === clave ? antes : { player: pnd.player, hasta: Date.now() + SEG_REACCION * 1000, clave }) : null;
  if (conLimite) {
    const op = pnd.options.find(o => o.id === 'pasar' || o.id === 'no')?.id ?? pnd.options[pnd.options.length - 1].id;
    sala.timerReaccion = setTimeout(() => {
      sala.timerReaccion = null;
      if (!sala.estado || sala.estado.queue[0] !== pnd) return;
      const ns = aplicar(sala.estado, { t: 'choose', id: op });
      if (ns !== sala.estado) { sala.estado = ns; despues(sala); }
    }, Math.max(0, sala.limite!.hasta - Date.now()));
  }
  if (JSON.stringify(antes) !== JSON.stringify(sala.limite)) emitirSala(sala);
  emitirEstado(sala);
  if (sala.timer) { clearTimeout(sala.timer); sala.timer = null; }
  if (s.winner !== null) return;
  const a = aiAction(s);
  if (!a) return;
  const lento = ['choose', 'pelear', 'confirmar', 'explorar'].includes(a.t);
  sala.timer = setTimeout(() => {
    sala.timer = null;
    if (!sala.estado) return;
    const ns = aplicar(sala.estado, a);
    if (ns === sala.estado) { console.warn(`[${sala.codigo}] IA: acción rechazada`, a); return; }
    sala.estado = ns; despues(sala);
  }, lento ? 1600 : 850);
}

function accionValida(s: GameState, quien: number, a: Action): boolean {
  if (s.winner !== null) return false;
  const pnd = s.queue[0];
  if (pnd) return a.t === 'choose' && pnd.player === quien && !s.players[quien].ia;
  if (a.t === 'cerrarAnuncio' || a.t === 'choose') return false;
  return s.current === quien && !s.players[quien].ia;
}

io.on('connection', socket => {
  const unir = (sala: Sala, i: number) => {
    sala.asientos[i].socketId = socket.id;
    socket.data.sala = sala.codigo;
    socket.join(sala.codigo);
    emitirSala(sala);
    socket.emit('chat', sala.chat);
    if (sala.estado) emitirEstado(sala);
  };

  const unirMesa = (sala: Sala) => {
    sala.mesas.add(socket.id); socket.data.sala = sala.codigo; socket.data.mesa = true;
    socket.join(sala.codigo);
    socket.emit('sala', infoSala(sala, -1)); socket.emit('chat', sala.chat);
    if (sala.estado) emitirEstado(sala);
  };
  // Pantalla de mesa (TV): crea la sala y la observa; los jugadores entran desde el celular
  socket.on('crearMesa', (_d, ack) => {
    const codigo = nuevoCodigo();
    const sala: Sala = {
      codigo, host: '', n: 4, estado: null, chat: [], timer: null, timerReaccion: null, actualizado: Date.now(), modo: 'mesa', mesas: new Set(), limite: null,
      asientos: [0, 1, 2, 3].map(() => ({ nombre: 'Puesto libre', ia: false, personaje: null, token: null, socketId: null })),
    };
    salas.set(codigo, sala);
    console.log(`Mesa ${codigo} creada`);
    ack?.({ ok: true, codigo });
    unirMesa(sala);
  });
  // Un jugador crea la partida desde su dispositivo: queda en el puesto 1 como anfitrión
  socket.on('crearSala', ({ nombre } = {}, ack) => {
    const codigo = nuevoCodigo();
    const sala: Sala = {
      codigo, host: '', n: 4, estado: null, chat: [], timer: null, timerReaccion: null, actualizado: Date.now(), modo: 'mesa', mesas: new Set(), limite: null,
      asientos: [0, 1, 2, 3].map(() => ({ nombre: 'Puesto libre', ia: false, personaje: null, token: null, socketId: null })),
    };
    salas.set(codigo, sala);
    const token = nuevoToken();
    Object.assign(sala.asientos[0], { token, nombre: limpiarTexto(nombre) || 'Jugador 1' });
    sala.host = token;
    console.log(`Sala ${codigo} creada por ${sala.asientos[0].nombre}`);
    ack?.({ ok: true, codigo, token, asiento: 0 });
    unir(sala, 0);
  });
  socket.on('reconectarMesa', ({ codigo }, ack) => {
    const sala = salas.get(String(codigo ?? '').toUpperCase());
    if (!sala) return ack?.({ ok: false });
    ack?.({ ok: true, codigo: sala.codigo });
    unirMesa(sala);
  });

  socket.on('unirse', ({ codigo, nombre }, ack) => {
    const sala = salas.get(String(codigo ?? '').toUpperCase().trim());
    if (!sala) return ack?.({ ok: false, error: 'No existe una sala con ese código.' });
    if (sala.estado) return ack?.({ ok: false, error: 'La partida ya empezó. Si eras jugador, usa el mismo navegador para reconectarte.' });
    const i = sala.asientos.slice(0, sala.n).findIndex(a => !a.ia && !a.token);
    if (i < 0) return ack?.({ ok: false, error: 'La sala está llena.' });
    const token = nuevoToken();
    Object.assign(sala.asientos[i], { token, nombre: limpiarTexto(nombre) || `Jugador ${i + 1}`, personaje: null });
    if (!sala.host) sala.host = token; // en modo mesa, el primer celular es el anfitrión
    ack?.({ ok: true, codigo: sala.codigo, token, asiento: i });
    unir(sala, i);
  });

  socket.on('reconectar', ({ codigo, token }, ack) => {
    const sala = salas.get(String(codigo ?? ''));
    const i = sala ? sala.asientos.findIndex(a => a.token && a.token === token) : -1;
    if (!sala || i < 0) return ack?.({ ok: false });
    ack?.({ ok: true, codigo: sala.codigo, asiento: i });
    unir(sala, i);
  });

  socket.on('sala:config', ({ n, asiento, ia }) => {
    const sala = salaDe(socket); if (!sala || sala.estado) return;
    const yo = asientoDe(sala, socket); if (sala.asientos[yo]?.token !== sala.host) return;
    if (typeof n === 'number' && n >= 2 && n <= 4) sala.n = n;
    if (typeof asiento === 'number' && asiento >= 0 && asiento < 4 && asiento !== yo) {
      const a = sala.asientos[asiento];
      if (ia === true) { if (a.token && a.socketId) io.to(a.socketId).emit('expulsado'); Object.assign(a, { ia: true, token: null, socketId: null, nombre: NOMBRES_IA[asiento], personaje: null }); }
      if (ia === false && a.ia) Object.assign(a, { ia: false, nombre: sala.modo === 'mesa' ? 'Puesto libre' : 'Esperando…', personaje: null });
    }
    emitirSala(sala);
  });

  socket.on('sala:personaje', ({ personaje, asiento }) => {
    const sala = salaDe(socket); if (!sala || sala.estado) return;
    const yo = asientoDe(sala, socket);
    let objetivo = yo;
    if (typeof asiento === 'number' && sala.asientos[asiento]?.ia && sala.asientos[yo]?.token === sala.host) objetivo = asiento;
    if (personaje !== null && !PERSONAJES.some(p => p.id === personaje)) return;
    if (personaje && sala.asientos.slice(0, sala.n).some((a, k) => k !== objetivo && a.personaje === personaje)) return;
    sala.asientos[objetivo].personaje = personaje;
    emitirSala(sala);
  });

  socket.on('sala:nombre', ({ nombre }) => {
    const sala = salaDe(socket); if (!sala || sala.estado) return;
    const yo = asientoDe(sala, socket); if (yo < 0) return;
    sala.asientos[yo].nombre = limpiarTexto(nombre) || sala.asientos[yo].nombre;
    emitirSala(sala);
  });

  socket.on('sala:comenzar', () => {
    const sala = salaDe(socket); if (!sala || sala.estado) return;
    const yo = asientoDe(sala, socket); if (sala.asientos[yo]?.token !== sala.host) return;
    if (sala.modo === 'mesa') {
      // En la mesa, los puestos libres se quitan al comenzar
      const ocupados = sala.asientos.slice(0, sala.n).filter(a => a.ia || a.token);
      if (ocupados.length < 2) return socket.emit('aviso', 'Se necesitan al menos 2 jugadores (personas o IA).');
      const libresA = sala.asientos.filter(a => !ocupados.includes(a));
      sala.asientos = [...ocupados, ...libresA]; sala.n = ocupados.length;
    }
    const usados = sala.asientos.slice(0, sala.n);
    if (usados.some(a => !a.ia && !a.token)) return socket.emit('aviso', 'Faltan jugadores por entrar a la sala.');
    if (usados.some(a => !a.ia && !a.personaje)) return socket.emit('aviso', 'Todos los jugadores humanos deben elegir personaje.');
    const libres = PERSONAJES.map(p => p.id).filter(id => !usados.some(a => a.personaje === id)).sort(() => Math.random() - 0.5);
    usados.forEach(a => { if (!a.personaje) a.personaje = libres.pop()!; });
    sala.estado = crearPartida(usados.map(a => ({ nombre: a.nombre, personaje: a.personaje!, ia: a.ia })));
    console.log(`Sala ${sala.codigo}: partida iniciada (${sala.n} jugadores)`);
    emitirSala(sala);
    despues(sala);
  });

  socket.on('accion', (entrada: Action & { paso?: number }) => {
    const sala = salaDe(socket); if (!sala?.estado || !entrada || typeof entrada !== 'object') return;
    // Una acción hecha sobre un estado viejo (doble toque, red lenta) se descarta para no saltar zonas ni turnos
    const { paso, ...a } = entrada as any;
    const dbg = (m: string) => { if (process.env.DEPURAR) console.log(`[accion] ${m}`, JSON.stringify(a), 'paso', paso, 'srv', sala.estado?.paso, 'cola', sala.estado?.queue[0]?.kind, sala.estado?.queue[0]?.player); };
    if (typeof paso === 'number' && paso !== (sala.estado.paso ?? 0)) return dbg('paso viejo');
    const yo = asientoDe(sala, socket); if (yo < 0) return dbg('sin asiento');
    if (!accionValida(sala.estado, yo, a)) return dbg(`no válida para ${yo}`);
    const ns = aplicar(sala.estado, a);
    if (ns === sala.estado) return dbg('rechazada por el motor');
    sala.estado = ns; despues(sala);
  });

  socket.on('convertirIA', ({ asiento }) => {
    const sala = salaDe(socket); if (!sala?.estado) return;
    const yo = asientoDe(sala, socket); if (sala.asientos[yo]?.token !== sala.host) return;
    const a = sala.asientos[asiento]; if (!a || a.socketId || a.ia) return;
    a.ia = true; sala.estado = { ...sala.estado, players: sala.estado.players.map((p, k) => (k === asiento ? { ...p, ia: true, nombre: `${p.nombre} (IA)` } : p)) };
    sala.chat.push({ de: 'Sala', texto: `${a.nombre} fue reemplazado por la IA.`, t: Date.now() }); io.to(sala.codigo).emit('chat', sala.chat);
    emitirSala(sala); despues(sala);
  });

  socket.on('chat', (texto: string) => {
    const sala = salaDe(socket); if (!sala) return;
    const yo = asientoDe(sala, socket); if (yo < 0) return;
    const t = String(texto ?? '').trim().slice(0, 200); if (!t) return;
    sala.chat.push({ de: sala.asientos[yo].nombre, color: sala.estado?.players[yo]?.color, texto: t, t: Date.now() });
    if (sala.chat.length > 100) sala.chat.shift();
    io.to(sala.codigo).emit('chat', sala.chat);
  });

  socket.on('salir', () => {
    const sala = salaDe(socket); if (!sala) return;
    if (socket.data.mesa) { sala.mesas.delete(socket.id); socket.leave(sala.codigo); socket.data.sala = undefined; return; }
    const yo = asientoDe(sala, socket);
    socket.leave(sala.codigo); socket.data.sala = undefined;
    if (yo < 0) return;
    if (!sala.estado && sala.asientos[yo].token !== sala.host) Object.assign(sala.asientos[yo], { token: null, socketId: null, nombre: sala.modo === 'mesa' ? 'Puesto libre' : 'Esperando…', personaje: null });
    else sala.asientos[yo].socketId = null;
    emitirSala(sala); emitirEstado(sala);
  });

  socket.on('disconnect', () => {
    const sala = salaDe(socket); if (!sala) return;
    if (socket.data.mesa) { sala.mesas.delete(socket.id); return; }
    const yo = asientoDe(sala, socket); if (yo < 0) return;
    sala.asientos[yo].socketId = null;
    emitirSala(sala); emitirEstado(sala);
  });
});

// Limpia salas vacías tras 3 horas sin actividad
setInterval(() => {
  const limite = Date.now() - 3 * 3600_000;
  for (const [c, s] of salas) if (s.actualizado < limite && !s.asientos.some(a => a.socketId) && !s.mesas.size) { if (s.timer) clearTimeout(s.timer); if (s.timerReaccion) clearTimeout(s.timerReaccion); salas.delete(c); }
}, 10 * 60_000);

http.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  Arrieros y Cuchillos — servidor en el puerto ${PORT}`);
  const ips = lanIps();
  if (existsSync(DIST)) {
    console.log(`  En este equipo:   http://localhost:${PORT}`);
    ips.forEach(ip => console.log(`  En la red local:  http://${ip}:${PORT}`));
  } else console.log('  (Modo desarrollo: abre el juego en la dirección de Vite)');
  console.log('');
});
