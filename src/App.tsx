import { useState } from 'react';
import { Inicio } from './components/Inicio';
import { Reglas } from './components/Modales';
import { SalaRed } from './components/Sala';
import { Juego, pantallaCompleta, useAutoPantallaCompleta, BotonPantallaCompleta } from './components/Juego';
import { haySesionRed, useRed } from './net/red';
import { useSonidos } from './audio/useSonidos';

// Arrieros y Cuchillos: cada jugador entra desde su PC o celular (en horizontal) y ve la mesa en su pantalla.
// Mientras otro juega, todos ven la mesa; cada uno pasa a sus controles cuando le toca jugar o intervenir.
type Pantalla = 'inicio' | 'crear' | 'unirse';

const esTactil = () => typeof window !== 'undefined' && matchMedia('(pointer: coarse)').matches;

export default function App() {
  const qs = new URLSearchParams(location.search);
  const inicial: Pantalla = haySesionRed() || qs.has('sala') ? 'unirse' : 'inicio';
  const [pantalla, setPantalla] = useState<Pantalla>(inicial);
  const [reglas, setReglas] = useState(false);
  const red = useRed(pantalla !== 'inicio');
  useAutoPantallaCompleta();

  const jugando = pantalla !== 'inicio' && !!red.sala?.enJuego && !!red.estado;
  useSonidos(jugando ? red.estado : null, true);

  const alInicio = () => { setPantalla('inicio'); history.replaceState(null, '', location.pathname); };
  // En celulares, al entrar se pide pantalla completa en horizontal
  const conPantalla = (f: (...a: any[]) => Promise<string | null>) => (...a: any[]) => { if (esTactil()) pantallaCompleta(); return f(...a); };

  if (pantalla !== 'inicio') {
    if (jugando && red.sala) {
      return (
        <Juego s={red.estado!} yo={red.sala.miAsiento} sala={red.sala} dispatch={red.accion} chat={red.chat} enviarChat={t => red.emit('chat', t)}
          anuncio={red.anuncio} cerrarAnuncio={red.cerrarAnuncio}
          onSalir={() => { if (red.estado!.winner !== null) { red.salir(); alInicio(); } else if (confirm('¿Salir de la partida? Puedes volver a entrar desde este dispositivo mientras la partida exista.')) alInicio(); }}
          onNueva={() => { red.salir(); alInicio(); }}
          convertirIA={i => red.emit('convertirIA', { asiento: i })} />
      );
    }
    if (!red.sala && haySesionRed()) {
      return <div className="cargando">{red.conectado ? 'Volviendo a tu partida…' : 'Conectando con el servidor…'}<small>Si el servidor estaba dormido, puede tardar hasta un minuto en despertar.</small><button className="btn sec" onClick={() => { red.salir(); alInicio(); }}>Cancelar</button></div>;
    }
    return <SalaRed conectado={red.conectado} sala={red.sala} chat={red.chat} aviso={red.aviso} limpiarAviso={() => red.setAviso(null)}
      unirse={conPantalla(red.unirse)} crear={conPantalla(red.crear)} modo={pantalla === 'crear' ? 'crear' : 'unirse'} emit={red.emit} salir={red.salir} volver={alInicio} />;
  }
  return (
    <>
      <Inicio onCrear={() => setPantalla('crear')} onUnirse={() => setPantalla('unirse')} onVolver={() => setPantalla('unirse')} onReglas={() => setReglas(true)} hayPartida={haySesionRed()} />
      {reglas && <Reglas onCerrar={() => setReglas(false)} />}
      <BotonPantallaCompleta />
    </>
  );
}
