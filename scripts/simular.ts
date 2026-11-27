// Simula partidas completas entre IAs para probar el motor: npm run simular
import { crearPartida, aplicar, GameState } from '../src/game/engine';
import { aiAction } from '../src/game/ai';
import { PERSONAJES, CharacterId } from '../src/game/data';

const N = Number(process.argv[2] ?? 300);
let atascos = 0, errores = 0;
const rondas: number[] = [];
const ganadores: Record<string, number> = {};
const jugadas: Record<string, number> = {}; const esperado: Record<string, number> = {};
for (let g = 0; g < N; g++) {
  const n = 2 + (g % 3);
  const chars = [...PERSONAJES].sort(() => Math.random() - 0.5).slice(0, n).map(c => c.id as CharacterId);
  chars.forEach(c => { jugadas[c] = (jugadas[c] ?? 0) + 1; esperado[c] = (esperado[c] ?? 0) + 1 / n; });
  let s: GameState = crearPartida(chars.map((c, i) => ({ nombre: `IA ${i + 1}`, personaje: c, ia: true })), 1000 + g + Number(process.env.OFF ?? 0));
  let pasos = 0, sinCambio = 0;
  try {
    while (s.winner === null && pasos < 20000 && s.round < 60) {
      const a = aiAction(s);
      if (!a) throw new Error('Ninguna acción para IA');
      const ns = aplicar(s, a);
      if (ns === s) { sinCambio++; if (sinCambio > 50) throw new Error(`Acción rechazada en bucle: ${JSON.stringify(a)} fase=${s.phase} pend=${s.queue[0]?.kind} combat=${s.combat?.step}`); }
      else sinCambio = 0;
      s = ns; pasos++;
    }
    if (s.winner === null) { atascos++; if (atascos <= 3) console.log('Sin ganador:', s.round, s.players.map(p => `${p.personaje}:${Object.keys(p.edificios).join('+')} oro${p.oro} g${p.guacas}`)); }
    else { rondas.push(s.round); const w = s.players[s.winner].personaje; ganadores[w] = (ganadores[w] ?? 0) + 1; }
  } catch (e: any) {
    errores++; if (errores <= 5) console.log(`Partida ${g}:`, e.message, e.stack?.split('\n').slice(1, 4).join(' | '));
  }
}
rondas.sort((a, b) => a - b);
console.log(`Partidas: ${N} · errores: ${errores} · sin terminar: ${atascos}`);
console.log(`Rondas hasta ganar: mediana ${rondas[Math.floor(rondas.length / 2)]}, 10% ${rondas[Math.floor(rondas.length * 0.1)]}, 90% ${rondas[Math.floor(rondas.length * 0.9)]}`);
console.log('Victorias por personaje (ganadas / jugadas):');
for (const c of PERSONAJES) console.log(`  ${c.nombre.padEnd(26)} ${String(ganadores[c.id] ?? 0).padStart(4)} / ${jugadas[c.id] ?? 0}  (${(((ganadores[c.id] ?? 0) / (jugadas[c.id] || 1)) * 100).toFixed(0)}%)`);
console.log('Índice (1.00 = gana lo que le toca por azar):');
for (const c of PERSONAJES) console.log(`  ${c.id.padEnd(12)} ${((ganadores[c.id] ?? 0) / (esperado[c.id] || 1)).toFixed(2)}`);
