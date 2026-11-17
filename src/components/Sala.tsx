import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useEnlace } from './Mesa';
import { IMG, PERSONAJES } from '../game/data';
import { SalaInfo, Mensaje } from '../net/red';
import { PersonajeCarta } from './Cartas';
import { Chat } from './Controles';

interface Props {
  conectado: boolean; sala: SalaInfo | null; chat: Mensaje[]; aviso: string | null; limpiarAviso: () => void;
  unirse: (codigo: string, nombre: string) => Promise<string | null>;
  crear: (nombre: string) => Promise<string | null>; modo: 'crear' | 'unirse';
  emit: (ev: string, data?: any) => void; salir: () => void; volver: () => void;
}

export function SalaRed({ conectado, sala, chat, aviso, limpiarAviso, unirse, crear, modo, emit, salir, volver }: Props) {
  const [nombre, setNombre] = useState(() => localStorage.getItem('arrieros-y-cuchillos:nombre') ?? '');
  const [codigo, setCodigo] = useState(() => new URLSearchParams(location.search).get('sala')?.toUpperCase() ?? '');
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  useEffect(() => { try { localStorage.setItem('arrieros-y-cuchillos:nombre', nombre); } catch { /* */ } }, [nombre]);
  useEffect(() => { if (aviso) { setError(aviso); limpiarAviso(); } }, [aviso, limpiarAviso]);

  if (!sala) {
    const creando = modo === 'crear' && !new URLSearchParams(location.search).get('sala');
    return (
      <div className="pantalla-config" style={{ backgroundImage: `url(${IMG('escenarios/zona-plaza')})` }}>
        <div className="config-caja caja-red">
          <h1>{creando ? 'Crear partida' : 'Unirme a una partida'}</h1>
          <p className="nota">Cada jugador ve la mesa en su propio PC o celular (en horizontal). {conectado ? <b className="ok-txt">● Conectado al servidor</b> : <b className="err-txt">● Conectando al servidor…</b>}</p>
          <label className="campo">Tu nombre<input value={nombre} maxLength={18} onChange={e => setNombre(e.target.value)} placeholder="Ej: Diego" /></label>
          {creando ? (
            <div className="red-op solo">
              <h3>Serás el anfitrión</h3>
              <p className="nota">Después compartes el código, el QR o el enlace con los demás jugadores.</p>
              <button className="btn grande" disabled={!conectado || !nombre.trim()} onClick={async () => setError(await crear(nombre.trim()))}>Crear la partida</button>
            </div>
          ) : (
            <div className="red-op solo">
              <h3>Código de la partida</h3>
              <p className="nota">Te lo comparte el anfitrión.</p>
              <input className="input-codigo" value={codigo} maxLength={4} onChange={e => setCodigo(e.target.value.toUpperCase())} placeholder="ABCD" />
              <button className="btn grande" disabled={!conectado || !nombre.trim() || codigo.length !== 4} onClick={async () => setError(await unirse(codigo, nombre.trim()))}>Entrar a la partida</button>
            </div>
          )}
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
            <h1>Partida <span className="codigo-sala">{sala.codigo}</span></h1>
            <p className="nota">Comparte el código o el enlace con los demás jugadores. {conectado ? <b className="ok-txt">● En línea</b> : <b className="err-txt">● Reconectando…</b>}</p>
          </div>
          <button className="btn sec" onClick={compartir}>{copiado ? '¡Enlace copiado!' : 'Compartir enlace'}</button>
        </div>
        <Invitar codigo={sala.codigo} />
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

/** QR, enlace y código para que los demás entren a la partida. */
function Invitar({ codigo }: { codigo: string }) {
  const url = useEnlace(codigo);
  const [qr, setQr] = useState('');
  useEffect(() => { if (url) QRCode.toDataURL(url, { margin: 1, width: 300, color: { dark: '#2b1d12', light: '#f4e9d2' } }).then(setQr).catch(() => setQr('')); }, [url]);
  return (
    <div className="sala-invitar">
      {qr && <img src={qr} alt="Código QR para unirse" />}
      <div>
        <div className="nota">Para unirse: escanear el QR, abrir el enlace o entrar al juego y escribir el código <b>{codigo}</b>.</div>
        <div className="sala-enlace">{url}</div>
        <div className="nota">Los puestos libres se quitan al comenzar. Cada uno verá la mesa en su dispositivo; pon el celular en horizontal.</div>
      </div>
    </div>
  );
}
