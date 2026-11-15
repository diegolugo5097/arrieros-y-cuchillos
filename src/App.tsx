import { useEffect, useState } from 'react';
import { Inicio } from './components/Inicio';
import { Reglas } from './components/Modales';
import { SalaRed } from './components/Sala';
import { MesaSala, MesaTablero } from './components/Mesa';
import { ControlCelular } from './components/Celular';
import { haySesionMesa, haySesionRed, useRed } from './net/red';
import { useSonidos } from './audio/useSonidos';

// Arrieros y Cuchillos se juega en modo mesa: una pantalla grande muestra el tablero
// y cada jugador usa su celular como su mano de cartas.
type Pantalla = 'inicio' | 'celular' | 'mesa';

export default function App() {
  const qs = new URLSearchParams(location.search);
  const inicial: Pantalla = haySesionRed() || qs.has('sala') ? 'celular' : qs.has('mesa') || haySesionMesa() ? 'mesa' : 'inicio';
  const [pantalla, setPantalla] = useState<Pantalla>(inicial);
  const [reglas, setReglas] = useState(false);
  const jugador = useRed(pantalla === 'celular');
  const mesa = useRed(pantalla === 'mesa', 'mesa');

  const celularJugando = pantalla === 'celular' && !!jugador.sala?.enJuego && !!jugador.estado;
  const mesaJugando = pantalla === 'mesa' && !!mesa.sala?.enJuego && !!mesa.estado;
  // La música suena en la pantalla grande; el celular solo reproduce efectos
  useSonidos(mesaJugando ? mesa.estado : celularJugando ? jugador.estado : null, pantalla !== 'celular');
  // Los anuncios (dichos, eventos) se ven en la pantalla grande, no en el celular
  useEffect(() => { if (pantalla === 'celular' && jugador.anuncio) jugador.cerrarAnuncio(); }, [pantalla, jugador.anuncio, jugador.cerrarAnuncio]);

  const alInicio = () => { setPantalla('inicio'); history.replaceState(null, '', location.pathname); };

  if (pantalla === 'mesa') {
    if (mesaJugando && mesa.sala) {
      return <MesaTablero s={mesa.estado!} sala={mesa.sala} anuncio={mesa.anuncio} cerrarAnuncio={mesa.cerrarAnuncio} onNueva={mesa.nuevaMesa}
        onSalir={() => { if (confirm('¿Cerrar la mesa? La partida sigue en el servidor y puedes volver a abrirla desde este navegador.')) alInicio(); }} />;
    }
    if (mesa.sala) return <MesaSala sala={mesa.sala} onSalir={() => { mesa.salir(); alInicio(); }} />;
    return <div className="cargando">{mesa.conectado ? 'Abriendo la mesa…' : 'Conectando con el servidor…'}<small>Si el servidor estaba dormido, puede tardar hasta un minuto en despertar.</small><button className="btn sec" onClick={alInicio}>Volver</button></div>;
  }
  if (pantalla === 'celular') {
    if (celularJugando && jugador.sala) {
      return <ControlCelular s={jugador.estado!} yo={jugador.sala.miAsiento} sala={jugador.sala} dispatch={jugador.accion} chat={jugador.chat} enviarChat={t => jugador.emit('chat', t)}
        onSalir={() => { if (jugador.estado!.winner !== null) { jugador.salir(); alInicio(); } else if (confirm('¿Salir de la mesa? Puedes volver a entrar desde este celular mientras la partida exista.')) alInicio(); }}
        convertirIA={i => jugador.emit('convertirIA', { asiento: i })} />;
    }
    return <SalaRed conectado={jugador.conectado} sala={jugador.sala} chat={jugador.chat} aviso={jugador.aviso} limpiarAviso={() => jugador.setAviso(null)}
      unirse={jugador.unirse} emit={jugador.emit} salir={jugador.salir} volver={alInicio} />;
  }
  return (
    <>
      <Inicio onMesa={() => setPantalla('mesa')} onUnirse={() => setPantalla('celular')} onReglas={() => setReglas(true)} hayPartida={haySesionRed()} />
      {reglas && <Reglas onCerrar={() => setReglas(false)} />}
    </>
  );
}
