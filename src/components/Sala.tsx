import { useEffect, useState } from 'react';
import { IMG, PERSONAJES } from '../game/data';
import { SalaInfo, Mensaje } from '../net/red';
import { PersonajeCarta } from './Cartas';
import { Chat } from './Controles';

interface Props {
  conectado: boolean; sala: SalaInfo | null; chat: Mensaje[]; aviso: string | null; limpiarAviso: () => void;
  unirse: (codigo: string, nombre: string) => Promise<string | null>;
  emit: (ev: string, data?: any) => void; salir: () => void; volver: () => void;
}

export function SalaRed({ conectado, sala, chat, aviso, limpiarAviso, unirse, emit, salir, volver }: Props) {
  const [nombre, setNombre] = useState(() => localStorage.getItem('arrieros-y-cuchillos:nombre') ?? '');
  const [codigo, setCodigo] = useState(() => new URLSearchParams(location.search).get('sala')?.toUpperCase() ?? '');
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  useEffect(() => { try { localStorage.setItem('arrieros-y-cuchillos:nombre', nombre); } catch { /* */ } }, [nombre]);
  useEffect(() => { if (aviso) { setError(aviso); limpiarAviso(); } }, [aviso, limpiarAviso]);

  if (!sala) {
    return (
      <div className="pantalla-config" style={{ backgroundImage: `url(${IMG('escenarios/zona-plaza')})` }}>
        <div className="config-caja caja-red">
          <h1>Unirme a la mesa</h1>
          <p className="nota">Tu celular será tu mano de cartas; el tablero se ve en la pantalla grande. {conectado ? <b className="ok-txt">● Conectado al servidor</b> : <b className="err-txt">● Conectando al servidor…</b>}</p>
          <label className="campo">Tu nombre<input value={nombre} maxLength={18} onChange={e => setNombre(e.target.value)} placeholder="Ej: Diego" /></label>
          <div className="red-op solo">
            <h3>Código de la mesa</h3>
            <p className="nota">Aparece en la pantalla grande, debajo del QR.</p>
            <input className="input-codigo" value={codigo} maxLength={4} onChange={e => setCodigo(e.target.value.toUpperCase())} placeholder="ABCD" />
            <button className="btn grande" disabled={!conectado || !nombre.trim() || codigo.length !== 4} onClick={async () => setError(await unirse(codigo, nombre.trim()))}>Sentarme a la mesa</button>
          </div>
          {error && <p className="err-txt">{error}</p>}
          <div className="config-acciones"><button className="btn sec" onClick={volver}>Volver</button></div>
        </div>
      </div>
    );
  }

  const yo = sala.asientos[sala.miAsiento];
  const enlace = `${location.origin}${location.pathname}?sala=${sala.codigo}`;
  const tomadoPor = (id: string) => sala.asientos.find(a => a.personaje === id)?.nombre;
  const esMesa = sala.modo === 'mesa';
  const faltan = esMesa ? Math.max(0, 2 - sala.asientos.filter(a => a.ia || a.ocupado).length) : sala.asientos.filter(a => !a.ia && !a.ocupado).length;
  const sinPj = sala.asientos.filter(a => !a.ia && a.ocupado && !a.personaje).length;
  const compartir = async () => {
    try { if (navigator.share) await navigator.share({ title: 'Arrieros y Cuchillos', text: `Únete a mi partida: código ${sala.codigo}`, url: enlace }); else { await navigator.clipboard.writeText(enlace); setCopiado(true); setTimeout(() => setCopiado(false), 1500); } } catch { /* cancelado */ }
  };
  return (
    <div className="pantalla-config" style={{ backgroundImage: `url(${IMG('escenarios/zona-plaza')})` }}>
      <div className="config-caja caja-red">
        <div className="sala-cabeza">
          <div>
            <h1>Mesa <span className="codigo-sala">{sala.codigo}</span></h1>
            <p className="nota">Comparte el código o el enlace con los demás jugadores. {conectado ? <b className="ok-txt">● En línea</b> : <b className="err-txt">● Reconectando…</b>}</p>
          </div>
          <button className="btn sec" onClick={compartir}>{copiado ? '¡Enlace copiado!' : 'Compartir enlace'}</button>
        </div>
        {esMesa && <p className="nota"><b>Modo mesa:</b> la partida se ve en la pantalla grande y este celular será tu mano. Los puestos libres se quitan al comenzar.</p>}
        {sala.soyHost && !esMesa && (
          <div className="config-fila">
            <span>Jugadores:</span>
            {[2, 3, 4].map(k => <button key={k} className={`btn chico ${sala.n === k ? '' : 'sec'}`} onClick={() => emit('sala:config', { n: k })}>{k}</button>)}
          </div>
        )}
        <div className="config-jugadores">
          {sala.asientos.map(a => (
            <div key={a.indice} className={`config-jugador ${a.indice === sala.miAsiento ? 'eligiendo' : ''}`}>
              <div className="asiento-cabeza">
                <b>{a.nombre}</b>
                {a.host && <span className="chip">Anfitrión</span>}
                {a.indice === sala.miAsiento && <span className="chip">Tú</span>}
                {!a.ia && a.ocupado && <span className={a.conectado ? 'ok-txt' : 'err-txt'}>●</span>}
              </div>
              {sala.soyHost && a.indice !== sala.miAsiento && (!a.ocupado || a.ia) ? (
                <div className="toggle">
                  <button className={!a.ia ? 'on' : ''} onClick={() => emit('sala:config', { asiento: a.indice, ia: false })}>Persona</button>
                  <button className={a.ia ? 'on' : ''} onClick={() => emit('sala:config', { asiento: a.indice, ia: true })}>IA</button>
                </div>
              ) : <div className="nota">{a.ia ? 'Jugador IA' : a.ocupado ? 'Persona' : 'Puesto libre'}</div>}
              <div className="config-pj">
                {a.personaje ? <><img src={IMG(`personajes/${a.personaje}`)} alt="" /> {PERSONAJES.find(p => p.id === a.personaje)!.nombre}</> : <i>{a.ia ? 'Personaje al azar' : a.ocupado ? 'Eligiendo…' : 'Esperando que alguien entre'}</i>}
                {a.indice === sala.miAsiento && a.personaje && <button className="link" onClick={() => emit('sala:personaje', { personaje: null })}>cambiar</button>}
              </div>
            </div>
          ))}
        </div>
        {!yo.personaje && <p className="nota"><b>Elige tu personaje:</b></p>}
        {!yo.personaje && (
          <div className="config-personajes">
            {PERSONAJES.map(p => <PersonajeCarta key={p.id} id={p.id} w={170} onClick={() => emit('sala:personaje', { personaje: p.id })} tomado={tomadoPor(p.id)} />)}
          </div>
        )}
        <div className="sala-pie">
          <Chat chat={chat} enviar={t => emit('chat', t)} />
          <div className="config-acciones vertical">
            {sala.soyHost ? (
              <button className="btn grande" disabled={faltan > 0 || sinPj > 0} onClick={() => emit('sala:comenzar')}>
                {faltan > 0 ? `Faltan ${faltan} jugador${faltan > 1 ? 'es' : ''}` : sinPj > 0 ? 'Esperando personajes' : 'Comenzar partida'}
              </button>
            ) : <p className="nota">El anfitrión comenzará la partida.</p>}
            <button className="btn sec" onClick={() => { salir(); volver(); }}>Salir de la sala</button>
          </div>
        </div>
        {error && <p className="err-txt">{error}</p>}
      </div>
    </div>
  );
}
