// Diseño único de carta: proporción 5:7 y composición simétrica.
// Todo el texto escala con el ancho de la carta (unidades de contenedor cqw).
import { CSSProperties, ReactNode } from 'react';
import {
  IMG, mito, RECOMPENSA, TIER_FONDO, TIER_NOMBRE, exag, FOOD_NOMBRE, SLOT_NOMBRE, apoyo, ApoyoId, personaje, CharacterId, dicho, DichoId, Tier,
  EDIFICIOS, ORDEN_EDIFICIOS, MATERIALES, MaterialId, HERRAMIENTAS,
} from '../game/data';
import { MorralCard, Player } from '../game/engine';

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
        {!compacta && texto && <div className="cj-texto"><div className="cj-texto-in">{texto}</div></div>}
        {!compacta && pie && <div className="cj-pie">{pie}</div>}
      </div>
      {children && <div className="cj-extra">{children}</div>}
    </div>
  );
}

const Badge = ({ v, titulo }: { v: ReactNode; titulo?: string }) => <b className="cj-badge" title={titulo}>{v}</b>;

/** Propiedades de carta para una guaca (carta del mazo de Guacas: equipo, comida o exageración). */
export function propsMorral(card: MorralCard): CartaProps {
  if (card.kind === 'equipo') {
    return { tipo: 'equipo', titulo: card.nombre, linea: SLOT_NOMBRE[card.slot], img: card.img, esq: [<Badge v={`+${card.golpe}`} titulo="Golpe" />, <Badge v={`+${card.golpe}`} titulo="Golpe" />],
      texto: card.nota ?? `Suma ${card.golpe} de golpe en cada combate.`, pie: <span>Guaca · Equipo</span> };
  }
  if (card.kind === 'comida') {
    const licor = card.tipo === 'licor';
    return { tipo: licor ? 'licor' : 'comida', titulo: card.nombre, linea: FOOD_NOMBRE[card.tipo], img: card.img, esq: [<Badge v="D8" />, <Badge v="D8" />],
      texto: licor ? 'Suma 1 D8 en combate. Si pierdes, te enguayabas.' : 'Suma 1 D8 en combate o sabotea a un rival.', pie: <span>Guaca · {licor ? 'Licor' : 'Comida'}</span> };
  }
  const e = exag(card.id);
  return { tipo: 'exag', titulo: e.nombre, linea: 'Exageración paisa', fondo: 'cartas/ilustracion-exageraciones', fondoCubre: true, esq: [<Badge v="«" />, <Badge v="»" />], texto: e.texto, pie: <span>Guaca · Exageración</span> };
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

const MOMENTO_PJ: Record<string, string> = { cualquiera: '· en tu turno', 'combate-antes': '· antes de pelear', 'al-vencer': '· al vencer un mito' };

/** Texto de personajes y apoyos: pasiva arriba y las tres salidas del D6 abajo. */
function TextoHabilidades({ pasiva, activa, etiquetaD6 }: { pasiva: string; activa: string[]; etiquetaD6: string }) {
  // «Intuición Mítica: antes de robar…» → nombre de la pasiva destacado
  const m = pasiva.match(/^([^:]{3,28}):\s*(.+)$/);
  return (
    <div className="cj-apoyo-txt">
      <div className="cj-sec"><span className="cj-tag">Pasiva</span><p>{m ? <><b>{m[1]}:</b> {m[2]}</> : pasiva}</p></div>
      <div className="cj-sec">
        <span className="cj-tag d6">{etiquetaD6}</span>
        <ul className="cj-d6">
          <li className="bien"><b>6–5</b><span>{activa[0]}</span></li>
          <li className="medio"><b>4–3</b><span>{activa[1]}</span></li>
          <li className="mal"><b>2–1</b><span>{activa[2]}</span></li>
        </ul>
      </div>
    </div>
  );
}

/** Lo que pide cada edificio: guadua, madera y barro más las herramientas. Con «p», marca lo que el jugador ya tiene. */
export function RequisitosConstruccion({ p, compacto, soloSiguiente }: { p?: Player; compacto?: boolean; soloSiguiente?: boolean }) {
  const siguiente = p ? ORDEN_EDIFICIOS.find(b => !p.edificios[b]) : undefined;
  return (
    <div className={`req-tabla ${compacto ? 'compacto' : ''}`}>
      {ORDEN_EDIFICIOS.filter(b => !soloSiguiente || b === siguiente).map(b => {
        const hecho = !!p?.edificios[b];
        const items: { img: string; nombre: string; ok: boolean }[] = [
          ...(['G', 'M', 'B'] as MaterialId[]).map(k => ({ img: MATERIALES[k].img, nombre: MATERIALES[k].nombre, ok: !!p && p.mat[k] > 0 })),
          ...EDIFICIOS[b].herramientas.map(t => ({ img: HERRAMIENTAS[t].img, nombre: HERRAMIENTAS[t].nombre, ok: !!p && p.tools[t] > 0 })),
        ];
        return (
          <div key={b} className={`req-fila ${hecho ? 'hecho' : ''} ${b === siguiente ? 'req-sig' : ''}`}>
            <div className="req-edif"><img src={IMG(EDIFICIOS[b].img)} alt="" /><b>{EDIFICIOS[b].nombre}</b>{hecho && <em>Construida</em>}{b === siguiente && <em className="sig">Siguiente</em>}</div>
            <div className="req-items">
              {items.map((it, i) => <span key={i} className={`req-item ${p ? (it.ok ? 'ok' : 'falta') : ''}`} title={it.nombre}><img src={IMG(it.img)} alt={it.nombre} />{!compacto && <small>{it.nombre}</small>}</span>)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function propsApoyo(id: ApoyoId): CartaProps {
  const a = apoyo(id);
  return { tipo: 'apoyo', titulo: a.nombre, linea: 'Personaje de apoyo', img: a.img, fondo: 'escenarios/zona-plaza', fondoCubre: true, esq: [<Badge v="3" titulo="Contratar: 3 oro" />, <Badge v="3" titulo="Contratar: 3 oro" />],
    texto: <TextoHabilidades pasiva={a.pasiva} activa={a.activa} etiquetaD6="Habilidad · lanza D6" />, pie: <span>Apoyo</span> };
}

export function propsPersonaje(id: CharacterId): CartaProps {
  const c = personaje(id);
  return { tipo: 'personaje', titulo: c.nombre, linea: c.rol, img: c.img, fondo: 'escenarios/zona-campo', fondoCubre: true, esq: [<Badge v="★" />, <Badge v="★" />],
    texto: <TextoHabilidades pasiva={c.pasiva} activa={c.activa} etiquetaD6={`Habilidad · D6 ${MOMENTO_PJ[c.momento]}`} />, pie: <span>Personaje</span> };
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

/** Precio con la moneda de oro al lado: «4 🪙». */
export function Precio({ n, signo = '' }: { n: number; signo?: string }) {
  return <span className="precio">{signo}{n}<img src={IMG('objetos/oro')} alt=" oro" /></span>;
}
