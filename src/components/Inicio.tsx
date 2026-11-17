import { IMG } from '../game/data';
import { ControlSonido } from './Controles';

export function Inicio({ onCrear, onUnirse, onVolver, onReglas, hayPartida }: { onCrear: () => void; onUnirse: () => void; onVolver: () => void; onReglas: () => void; hayPartida: boolean }) {
  return (
    <div className="pantalla-inicio" style={{ backgroundImage: `url(${IMG('escenarios/mapa')})` }}>
      <div className="inicio-velo" />
      <div className="inicio-sonido"><ControlSonido /></div>
      <div className="inicio-caja">
        <div className="logo">
          <span className="logo-1">Arrieros</span>
          <span className="logo-y">y</span>
          <span className="logo-2">Cuchillos</span>
        </div>
        <div className="logo-sub">Una aventura quindiana</div>
        <div className="inicio-figuras">
          <img src={IMG('personajes/jairo')} alt="" />
          <img src={IMG('mitos/madre-monte')} alt="" />
        </div>
        <div className="inicio-botones">
          {hayPartida && <button className="btn grande" onClick={onVolver}>Volver a mi partida</button>}
          <button className={`btn grande ${hayPartida ? 'sec' : ''}`} onClick={onCrear}>Crear partida <small>y compartir el código</small></button>
          <button className={`btn grande ${hayPartida ? 'sec' : ''}`} onClick={onUnirse}>Unirme a una partida <small>con el código o el QR</small></button>
          <button className="btn sec" onClick={onReglas}>Cómo jugar</button>
        </div>
      </div>
    </div>
  );
}
