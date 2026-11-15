import { useEffect, useRef, useState } from 'react';
import { sonido } from '../audio/sonido';
import { Mensaje } from '../net/red';

export function ControlSonido() {
  const [abierto, setAbierto] = useState(false);
  const [, refrescar] = useState(0);
  const set = (f: () => void) => { f(); sonido.despertar(); sonido.aplicarVolumen(); refrescar(x => x + 1); };
  const silencio = !sonido.efectosOn && !sonido.musicaOn;
  return (
    <div className="control-sonido">
      <button className="btn chico sec" title="Sonido" onClick={() => setAbierto(a => !a)}>{silencio ? '🔇' : '🔊'}</button>
      {abierto && (
        <div className="popover">
          <label><input type="checkbox" checked={sonido.musicaOn} onChange={e => set(() => (sonido.musicaOn = e.target.checked))} /> Música</label>
          <input type="range" min={0} max={1} step={0.05} value={sonido.volMusica} onChange={e => set(() => (sonido.volMusica = Number(e.target.value)))} />
          <label><input type="checkbox" checked={sonido.efectosOn} onChange={e => set(() => (sonido.efectosOn = e.target.checked))} /> Efectos</label>
          <input type="range" min={0} max={1} step={0.05} value={sonido.volEfectos} onChange={e => set(() => (sonido.volEfectos = Number(e.target.value)))} />
          <button className="btn chico sec" onClick={() => { sonido.despertar(); sonido.efecto('gana'); }}>Probar sonido</button>
        </div>
      )}
    </div>
  );
}

export function Chat({ chat, enviar, compacto }: { chat: Mensaje[]; enviar: (t: string) => void; compacto?: boolean }) {
  const [texto, setTexto] = useState('');
  const lista = useRef<HTMLDivElement>(null);
  useEffect(() => { lista.current?.scrollTo({ top: lista.current.scrollHeight }); }, [chat]);
  return (
    <div className={`chat ${compacto ? 'compacto' : ''}`}>
      <div className="chat-lista" ref={lista}>
        {!chat.length && <div className="nota">Nadie ha escrito todavía.</div>}
        {chat.map((m, i) => <div key={i} className="chat-msg"><b style={{ color: m.color }}>{m.de}:</b> {m.texto}</div>)}
      </div>
      <form className="chat-form" onSubmit={e => { e.preventDefault(); if (texto.trim()) { enviar(texto.trim()); setTexto(''); } }}>
        <input value={texto} maxLength={200} onChange={e => setTexto(e.target.value)} placeholder="Escribe un mensaje…" />
        <button className="btn chico">Enviar</button>
      </form>
    </div>
  );
}
