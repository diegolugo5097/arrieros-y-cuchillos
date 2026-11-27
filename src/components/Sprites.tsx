// Personajes y apoyos en la escena (ilustraciones fijas) y efectos animados (hojas de efectos de 16 cuadros).
import { useEffect, useRef, useState } from 'react';
import { IMG, personaje, apoyo, CharacterId, ApoyoId } from '../game/data';

interface Hoja { w: number; h: number }
/** Medidas de un cuadro de cada hoja de efectos (tiras horizontales de 16 cuadros). */
const HOJAS: Record<string, Hoja> = {
  'fx-impactos': { w: 402, h: 261 },
  'fx-maldiciones': { w: 391, h: 284 },
};

/** Reproduce los cuadros indicados de una tira. `alto` es la altura en pantalla. */
function Tira({ clave, alto, fps = 10, cuadros, onFin }: { clave: string; alto: number; fps?: number; cuadros: number[]; onFin?: () => void }) {
  const hoja = HOJAS[clave];
  const [i, setI] = useState(0);
  const fin = useRef(onFin); fin.current = onFin;
  useEffect(() => {
    let k = 0;
    const id = setInterval(() => {
      k++;
      if (k >= cuadros.length) { clearInterval(id); fin.current?.(); return; }
      setI(k);
    }, 1000 / fps);
    return () => clearInterval(id);
  }, [clave, fps, cuadros.join(',')]);
  const w = hoja.w * alto / hoja.h;
  return (
    <div className="tira" aria-hidden="true" style={{
      width: w, height: alto, backgroundImage: `url(${IMG('sprites/' + clave)})`,
      backgroundSize: `${w * 16}px ${alto}px`, backgroundPosition: `${-cuadros[i] * w}px 0`,
    }} />
  );
}

/** Personaje de pie: el punto (x, y) es donde van sus pies. */
export function PersonajeEnEscena({ id, x, y, alto, className }: { id: CharacterId; x: number; y: number; alto: number; className?: string }) {
  const w = alto * 0.7;
  return <img className={`escena-fijo ${className ?? ''}`} src={IMG(personaje(id).img)} alt={personaje(id).nombre} style={{ left: x - w / 2, top: y - alto, width: w, height: alto }} />;
}

export function ApoyoEnEscena({ id, x, y, alto, className }: { id: ApoyoId; x: number; y: number; alto: number; className?: string }) {
  const w = alto * 0.65;
  return <img className={`escena-fijo ${className ?? ''}`} src={IMG(apoyo(id).img)} alt={apoyo(id).nombre} style={{ left: x - w / 2, top: y - alto, width: w, height: alto }} />;
}

/**
 * Efecto de las hojas de efectos: cada fila (0 a 3) es un efecto de 4 cuadros.
 * impactos: 0 explosión, 1 tajo, 2 golpe al suelo, 3 escudo · maldiciones: 0 ojo morado, 1 veneno, 2 rayo, 3 espinas.
 */
export function EfectoEnEscena({ atlas, fila, x, y, alto, fps = 9, onFin }: { atlas: 'impactos' | 'maldiciones'; fila: number; x: number; y: number; alto: number; fps?: number; onFin?: () => void }) {
  const clave = `fx-${atlas}`;
  const w = HOJAS[clave].w * alto / HOJAS[clave].h;
  const base = fila * 4;
  return (
    <div className="escena-fx" style={{ left: x - w / 2, top: y - alto / 2 }}>
      <Tira clave={clave} alto={alto} fps={fps} cuadros={[base, base + 1, base + 2, base + 2, base + 3]} onFin={onFin} />
    </div>
  );
}

/** Retrato redondo (la parte de arriba de la ilustración del personaje). */
export function Retrato({ id, color, tam = 96, className }: { id: CharacterId; color?: string; tam?: number; className?: string }) {
  return (
    <div className={`retrato ${className ?? ''}`} style={{ width: tam, height: tam, borderColor: color }}>
      <img src={IMG(personaje(id).img)} alt="" />
    </div>
  );
}
