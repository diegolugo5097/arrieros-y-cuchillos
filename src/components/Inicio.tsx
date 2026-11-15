import { IMG } from '../game/data';
import { ControlSonido } from './Controles';

export function Inicio({ onMesa, onUnirse, onReglas, hayPartida }: { onMesa: () => void; onUnirse: () => void; onReglas: () => void; hayPartida: boolean }) {
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
          <button className="btn grande" onClick={onMesa}>Abrir la mesa <small>en la TV o el computador</small></button>
          <button className="btn grande" onClick={onUnirse}>{hayPartida ? 'Volver a mi partida' : 'Unirme desde mi celular'}</button>
          <button className="btn sec" onClick={onReglas}>Cómo jugar</button>
        </div>
      </div>
    </div>
  );
}
