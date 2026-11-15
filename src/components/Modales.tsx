import { useState } from 'react';
import { IMG, MATERIALES, HERRAMIENTAS, MaterialId, ToolId, personaje, ORDEN_EDIFICIOS, EDIFICIOS } from '../game/data';
import { Action, Bundle, GameState, Player, tiene, vacio, maxIntercambios } from '../game/engine';

export function Modal({ titulo, children, onCerrar, ancho = 560, clase = '' }: { titulo?: string; children: React.ReactNode; onCerrar?: () => void; ancho?: number; clase?: string }) {
  return (
    <div className="overlay" onClick={onCerrar}>
      <div className={`modal ${clase}`} style={{ width: ancho }} onClick={e => e.stopPropagation()}>
        {onCerrar && <button className="cerrar" onClick={onCerrar}>×</button>}
        {titulo && <h2>{titulo}</h2>}
        {children}
      </div>
    </div>
  );
}

const CLAVES: (MaterialId | ToolId | 'oro')[] = ['oro', 'G', 'M', 'B', 'puntilla', 'martillo', 'serrucho'];
const nombreClave = (k: string) => (k === 'oro' ? 'Oro' : k in MATERIALES ? MATERIALES[k as MaterialId].nombre : HERRAMIENTAS[k as ToolId].nombre);
const imgClave = (k: string) => (k === 'oro' ? 'objetos/oro' : k in MATERIALES ? MATERIALES[k as MaterialId].img : HERRAMIENTAS[k as ToolId].img);
const cantidad = (p: Player, k: string) => (k === 'oro' ? p.oro : k in p.mat ? p.mat[k as MaterialId] : p.tools[k as ToolId]);

export function Intercambio({ s, dispatch, onCerrar }: { s: GameState; dispatch: (a: Action) => void; onCerrar: () => void }) {
  const yo = s.players[s.current];
  const otros = s.players.filter(p => p.id !== yo.id);
  const [socio, setSocio] = useState(otros[0].id);
  const [give, setGive] = useState<Bundle>({});
  const [get, setGet] = useState<Bundle>({});
  const q = s.players[socio];
  const paso = (b: Bundle, set: (b: Bundle) => void, k: string, d: number, max: number) => {
    const v = Math.max(0, Math.min(max, (b[k as keyof Bundle] ?? 0) + d)); set({ ...b, [k]: v });
  };
  const valido = !(vacio(give) && vacio(get)) && tiene(yo, give) && tiene(q, get);
  const Lado = ({ titulo, p, b, set }: { titulo: string; p: Player; b: Bundle; set: (b: Bundle) => void }) => (
    <div className="trato-lado">
      <h3>{titulo}</h3>
      {CLAVES.map(k => (
        <div key={k} className="trato-fila">
          <img src={IMG(imgClave(k))} alt="" /> <span>{nombreClave(k)}</span> <small>(tiene {cantidad(p, k)})</small>
          <button className="btn mini sec" onClick={() => paso(b, set, k, -1, cantidad(p, k))}>−</button>
          <b>{b[k as keyof Bundle] ?? 0}</b>
          <button className="btn mini sec" onClick={() => paso(b, set, k, 1, cantidad(p, k))}>+</button>
        </div>
      ))}
    </div>
  );
  return (
    <Modal titulo="Proponer un intercambio" onCerrar={onCerrar} ancho={720}>
      <p className="nota">Intercambios este turno: {s.turn.intercambios} de {maxIntercambios(s, yo)}. El otro jugador debe aceptar.</p>
      <div className="config-fila">Con: {otros.map(o => <button key={o.id} className={`btn chico ${socio === o.id ? '' : 'sec'}`} onClick={() => { setSocio(o.id); setGet({}); }}>{o.nombre}</button>)}</div>
      <div className="trato">
        <Lado titulo={`Tú das (${yo.nombre})`} p={yo} b={give} set={setGive} />
        <Lado titulo={`Pides a ${q.nombre}`} p={q} b={get} set={setGet} />
      </div>
      <button className="btn grande" disabled={!valido} onClick={() => { dispatch({ t: 'intercambio', partner: socio, give, get }); onCerrar(); }}>Proponer trato</button>
    </Modal>
  );
}

export function Victoria({ s, onNueva, textoNueva = 'Volver al inicio' }: { s: GameState; onNueva: () => void; textoNueva?: string }) {
  const w = s.players[s.winner!];
  return (
    <div className="overlay victoria" style={{ backgroundImage: `url(${IMG('escenarios/mapa')})` }}>
      <div className="victoria-caja">
        <img className="victoria-figura" src={IMG(personaje(w.personaje).img)} alt="" />
        <div>
          <div className="victoria-titulo">¡{w.nombre} es el Gran Fundador del Quindío!</div>
          <p>Construyó su Casa, su Plaza de Mercado y su Iglesia en la ronda {s.round}.</p>
          <div className="victoria-edif">{ORDEN_EDIFICIOS.map(b => <img key={b} src={IMG(EDIFICIOS[b].img)} alt="" />)}</div>
          <table className="tabla-final">
            <thead><tr><th>Jugador</th><th>Edificios</th><th>Guacas</th><th>Oro</th></tr></thead>
            <tbody>{s.players.map(p => <tr key={p.id}><td style={{ color: p.color }}>{p.nombre}</td><td>{ORDEN_EDIFICIOS.filter(b => p.edificios[b]).length}</td><td>{p.guacas}</td><td>{p.oro}</td></tr>)}</tbody>
          </table>
          <button className="btn grande" onClick={onNueva}>{textoNueva}</button>
        </div>
      </div>
    </div>
  );
}

export function Reglas({ onCerrar }: { onCerrar: () => void }) {
  return (
    <Modal titulo="Cómo jugar" onCerrar={onCerrar} ancho={820} clase="modal-reglas">
      <p><b>Cómo se juega:</b> una pantalla grande (TV o computador) abre la mesa y muestra el tablero; cada jugador entra desde su celular, que es su mano de cartas.</p>
      <p><b>Objetivo:</b> ser el primero en construir la Casa, la Plaza de Mercado y la Iglesia, en ese orden y sin daños, con al menos 1 comida en la mano y 1 oro. Todos empiezan sin recursos.</p>
      <h3>El turno: 4 zonas en orden</h3>
      <ol>
        <li><b>Plaza:</b> robas 1 carta del Morral. Puedes contratar un personaje de apoyo (3 oro, luego 1 oro por turno), hacer 1 intercambio y equiparte (un arma, una prenda y una montura o calzado).</li>
        <li><b>Monte:</b> robas 1 carta. Si es un dicho, se aplica. Si es un mito, peleas o huyes (D6: 5 o 6).</li>
        <li><b>Taller:</b> compras 1 herramienta de las 3 reveladas, construyes 1 edificio y reparas edificios dañados (1 material cada uno).</li>
        <li><b>Campo:</b> cosechas 1 oro + 1 por edificio sano, y compras o vendes en el Fondo del Pueblo.</li>
      </ol>
      <h3>Combate</h3>
      <p>Poder = 2D6 + equipo + bonos + comida (D8 opcional, una por combate). Ganas si igualas o superas el ataque. Un rival puede sabotear gastando una comida (+D8 al mito). Si ganas: oro, guacas y 1 material.</p>
      <table className="tabla-reglas">
        <thead><tr><th>Nivel</th><th>Ataque</th><th>Recompensa</th></tr></thead>
        <tbody>
          <tr><td>Rural</td><td>5–7</td><td>2 oro + 1 guaca</td></tr>
          <tr><td>Siniestro</td><td>8–10</td><td>3 oro + 1 guaca</td></tr>
          <tr><td>Épico</td><td>11–14</td><td>5 oro + 2 guacas</td></tr>
          <tr><td>Ancestral</td><td>15–18</td><td>8 oro + 3 guacas</td></tr>
        </tbody>
      </table>
      <h3>Precios</h3>
      <p>Materiales: compra 2, venta 1 · Puntilla 4 · Martillo 6 · Serrucho 8 (venta a la mitad) · Alimento se vende a 1, carne y licor a 2.</p>
      <h3>Edificios</h3>
      <p>Casa: Guadua + Madera + Barro · Plaza: lo mismo + Martillo + Puntilla + 1 guaca · Iglesia: lo mismo + Martillo + Puntilla + Serrucho + 3 guacas.</p>
      <h3>Cartas especiales</h3>
      <p><b>Dichos</b> (Monte): se aplican al salir; algunos se guardan. <b>Exageraciones</b> (Morral): se juegan desde la mano, algunas en tu turno y otras cuando un rival pelea o vence. <b>Eventos:</b> cada 3 rondas, duran una ronda.</p>
      <h3>Habilidades</h3>
      <p>Cada personaje tiene una pasiva y una activa con D6: 6–5 éxito total, 4–3 éxito mediano, 2 sin efecto, 1 calamidad. Cada activa se usa una vez por turno.</p>
    </Modal>
  );
}
