import { useEffect, useRef } from 'react';
import { GameState } from '../game/engine';
import { MITOS } from '../game/data';
import { efectoDeLog, sonido } from './sonido';

const ANCESTRALES = MITOS.filter(m => m.tier === 'ancestral' || m.tier === 'epico').map(m => m.nombre);

/** Reproduce efectos según las líneas nuevas del registro y cambia la música según la zona. */
export function useSonidos(s: GameState | null, musica = true) {
  const ultimo = useRef<number>(-1);
  useEffect(() => {
    if (!musica) sonido.setAmbiente(null);
    if (!s) { if (musica) sonido.setAmbiente('pueblo'); return; }
    // Combate contra un mito → tema de combate; explorando el Monte → misterio; resto → pueblo
    const enCombate = s.phase === 'monte' && !!s.combat && s.combat.step !== 'hecho';
    if (musica) sonido.setAmbiente(s.winner !== null ? null : enCombate ? 'combate' : s.phase === 'monte' ? 'monte' : 'pueblo');
    const n = s.logN ?? 0;
    if (ultimo.current < 0) { ultimo.current = n; return; }
    const nuevas = s.log.filter(l => (l.n ?? 0) > ultimo.current);
    ultimo.current = n;
    const efectos: string[] = [];
    for (const l of nuevas) { const e = efectoDeLog(l.t, ANCESTRALES); if (e && !efectos.includes(e)) efectos.push(e); }
    const prioridad = ['fanfarria', 'ancestral', 'mito', 'gana', 'pierde', 'evento', 'construir', 'dicho', 'sabotaje', 'turno'];
    efectos.sort((a, b) => (prioridad.indexOf(a) + 100) % 100 - (prioridad.indexOf(b) + 100) % 100);
    efectos.slice(0, 3).forEach((e, i) => setTimeout(() => sonido.efecto(e), i * 260));
  }, [s, musica]);

  // Despierta el audio con el primer gesto y hace clic en los botones
  useEffect(() => {
    const f = (ev: Event) => {
      sonido.despertar();
      const t = ev.target as HTMLElement;
      if (t.closest('button, .clic, .opcion')) sonido.efecto('clic');
    };
    window.addEventListener('pointerdown', f);
    return () => window.removeEventListener('pointerdown', f);
  }, []);
}
