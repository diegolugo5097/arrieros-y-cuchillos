// Diseño único de carta: proporción 5:7 y composición simétrica.
// Todo el texto escala con el ancho de la carta (unidades de contenedor cqw).
import { CSSProperties, ReactNode } from 'react';
import {
  IMG, mito, RECOMPENSA, TIER_FONDO, TIER_NOMBRE, exag, FOOD_NOMBRE, SLOT_NOMBRE, apoyo, ApoyoId, personaje, CharacterId, dicho, DichoId, Tier,
} from '../game/data';
import { MorralCard } from '../game/engine';

export type TipoCarta = 'equipo' | 'comida' | 'licor' | 'exag' | 'apoyo' | 'personaje' | 'dicho' | Tier;

export interface CartaProps {
  tipo: TipoCarta; titulo: string; linea?: string; texto?: ReactNode; img?: string; fondo?: string; fondoCubre?: boolean;
  esq?: [ReactNode, ReactNode]; pie?: ReactNode; w?: number; compacta?: boolean; sel?: boolean; apagada?: boolean;
  onClick?: () => void; children?: ReactNode; className?: string; style?: CSSProperties; etiqueta?: string;
}

export function Carta({ tipo, titulo, linea, texto, img, fondo, fondoCubre, esq, pie, w = 200, compacta, sel, apagada, onClick, children, className = '', style, etiqueta }: CartaProps) {
  const largo = titulo.length > 30 ? 'xl' : titulo.length > 20 ? 'l' : titulo.length > 13 ? 'm' : 's';
  return (
    <div className={`cj cj-${tipo} ${compacta ? 'compacta' : ''} ${sel ? 'sel' : ''} ${apagada ? 'apagada' : ''} ${onClick && !apagada ? 'clic' : ''} ${className}`}
      style={{ width: w, ...style }} onClick={apagada ? undefined : onClick} role={onClick ? 'button' : undefined} aria-label={etiqueta ?? titulo}>
      <div className="cj-marco">
        <div className="cj-cab">
          <span className="cj-esq">{esq?.[0]}</span>
          <div className={`cj-tit t-${largo}`}>{titulo}</div>
          <span className="cj-esq">{esq?.[1]}</span>
        </div>
        <div className={`cj-arte ${fondoCubre ? 'cubre' : ''}`} style={fondo ? { backgroundImage: `url(${IMG(fondo)})` } : undefined}>
          {img && <img src={IMG(img)} alt="" draggable={false} />}
        </div>
        {linea && <div className="cj-linea"><span>{linea}</span></div>}
        {!compacta && texto && <div className="cj-texto">{texto}</div>}
        {!compacta && pie && <div className="cj-pie">{pie}</div>}
      </div>
      {children && <div className="cj-extra">{children}</div>}
    </div>
  );
}

const Badge = ({ v, titulo }: { v: ReactNode; titulo?: string }) => <b className="cj-badge" title={titulo}>{v}</b>;

/** Propiedades de carta para una carta del Morral. */
export function propsMorral(card: MorralCard): CartaProps {
  if (card.kind === 'equipo') {
    return { tipo: 'equipo', titulo: card.nombre, linea: SLOT_NOMBRE[card.slot], img: card.img, esq: [<Badge v={`+${card.golpe}`} titulo="Golpe" />, <Badge v={`+${card.golpe}`} titulo="Golpe" />],
      texto: card.nota ?? `Suma ${card.golpe} de golpe en cada combate.`, pie: <span>Equipo</span> };
  }
  if (card.kind === 'comida') {
    const licor = card.tipo === 'licor';
    return { tipo: licor ? 'licor' : 'comida', titulo: card.nombre, linea: FOOD_NOMBRE[card.tipo], img: card.img, esq: [<Badge v="D8" />, <Badge v="D8" />],
      texto: licor ? 'Suma 1 D8 en combate. Si pierdes, te enguayabas.' : 'Suma 1 D8 en combate o sabotea a un rival.', pie: <span>Comida</span> };
  }
  const e = exag(card.id);
  return { tipo: 'exag', titulo: e.nombre, linea: 'Exageración paisa', fondo: 'cartas/ilustracion-exageraciones', fondoCubre: true, esq: [<Badge v="«" />, <Badge v="»" />], texto: e.texto, pie: <span>Morral</span> };
}

export function propsMito(id: string, ataque?: number, recompensa?: { oro: number; guacas: number }): CartaProps {
  const m = mito(id);
  const r = recompensa ?? RECOMPENSA[m.tier];
  return {
    tipo: m.tier, titulo: m.nombre, linea: `Mito ${TIER_NOMBRE[m.tier].toLowerCase()}`, img: `mitos/${m.id}`, fondo: TIER_FONDO[m.tier], fondoCubre: true,
    esq: [<Badge v={ataque ?? m.ataque} titulo="Ataque" />, <Badge v={ataque ?? m.ataque} titulo="Ataque" />],
    texto: <><b>Si pierdes:</b> {m.texto}</>,
    pie: <span className="cj-premio"><img src={IMG('objetos/oro')} alt="Oro" />{r.oro}<img src={IMG('objetos/guaca')} alt="Guacas" />{r.guacas}<img src={IMG('objetos/guadua')} alt="Material" />1</span>,
  };
}

export function propsApoyo(id: ApoyoId): CartaProps {
  const a = apoyo(id);
  return { tipo: 'apoyo', titulo: a.nombre, linea: 'Personaje de apoyo', img: a.img, fondo: 'escenarios/zona-plaza', fondoCubre: true, esq: [<Badge v="3" titulo="Contratar: 3 oro" />, <Badge v="3" titulo="Contratar: 3 oro" />],
    texto: <><b>Pasiva:</b> {a.pasiva}<br /><b>D6:</b> 6–5 {a.activa[0]} · 4–3 {a.activa[1]}</>, pie: <span>Apoyo</span> };
}

export function propsPersonaje(id: CharacterId): CartaProps {
  const c = personaje(id);
  return { tipo: 'personaje', titulo: c.nombre, linea: c.rol, img: c.img, fondo: 'escenarios/zona-campo', fondoCubre: true, esq: [<Badge v="★" />, <Badge v="★" />],
    texto: c.pasiva, pie: <span>Personaje</span> };
}

export function propsDicho(id: DichoId): CartaProps {
  const d = dicho(id);
  return { tipo: 'dicho', titulo: d.nombre, linea: 'Dicho popular', fondo: 'cartas/ilustracion-dichos', fondoCubre: true, esq: [<Badge v="“" />, <Badge v="”" />], texto: d.texto, pie: <span>Monte</span> };
}

export function PersonajeCarta({ id, w = 180, onClick, tomado }: { id: CharacterId; w?: number; onClick?: () => void; tomado?: string }) {
  return <Carta {...propsPersonaje(id)} w={w} onClick={onClick} apagada={!!tomado}>{tomado && <div className="cj-tomado">{tomado}</div>}</Carta>;
}
export function ApoyoCarta({ id, w = 160, children }: { id: ApoyoId; w?: number; children?: ReactNode }) {
  return <Carta {...propsApoyo(id)} w={w}>{children}</Carta>;
}

export function DichoMini({ id }: { id: DichoId }) {
  const dd = dicho(id);
  return <span className="chip chip-dicho" title={dd.texto}>«{dd.nombre}»</span>;
}

export function Dados({ valores, descartado, color = 'rojo' }: { valores: number[]; descartado?: number; color?: 'rojo' | 'azul' }) {
  let usadoDesc = false;
  return (
    <div className="dados">
      {valores.map((v, i) => {
        const tachado = descartado !== undefined && v === descartado && !usadoDesc && (usadoDesc = true);
        return <Dado key={i + '-' + v} v={v} color={color} tachado={!!tachado} />;
      })}
    </div>
  );
}
const PUNTOS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
export function Dado({ v, color = 'rojo', tachado, grande }: { v: number; color?: 'rojo' | 'azul'; tachado?: boolean; grande?: boolean }) {
  if (color === 'azul' || v > 6) return <div className={`dado dado-azul ${tachado ? 'tachado' : ''} ${grande ? 'grande' : ''}`}><span>{v}</span></div>;
  return (
    <div className={`dado dado-${color} ${tachado ? 'tachado' : ''} ${grande ? 'grande' : ''}`}>
      {Array.from({ length: 9 }, (_, i) => <i key={i} className={PUNTOS[v]?.includes(i) ? 'p' : ''} />)}
    </div>
  );
}
