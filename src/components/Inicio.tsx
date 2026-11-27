import { IMG } from '../game/data';
import { ControlSonido } from './Controles';

// Portada: la ilustración ya trae el título; los botones van sobre el camino del centro.
export function Inicio({ onCrear, onUnirse, onVolver, onReglas, hayPartida }: { onCrear: () => void; onUnirse: () => void; onVolver: () => void; onReglas: () => void; hayPartida: boolean }) {
  return (
    <div className="portada">
      <div className="portada-fondo" style={{ backgroundImage: `url(${IMG('escenarios/portada')})` }} />
      <div className="portada-velo" />
      <h1 className="sr-only">Arrieros y Cuchillos · Una aventura quindiana</h1>
      <div className="inicio-sonido"><ControlSonido /></div>
      <nav className="portada-menu" aria-label="Menú principal">
        {hayPartida && <button className="portada-btn volver" onClick={onVolver}><b>Volver a mi partida</b><small>Sigue donde ibas</small></button>}
        <div className="portada-fila">
          <button className="portada-btn principal" onClick={onCrear}><span className="portada-ico">⚔</span><b>Crear partida</b><small>y compartir el código</small></button>
          <button className="portada-btn principal" onClick={onUnirse}><span className="portada-ico">🤝</span><b>Unirme</b><small>con el código o el QR</small></button>
        </div>
        <button className="portada-btn reglas" onClick={onReglas}><b>📜 Cómo jugar</b></button>
      </nav>
    </div>
  );
}
