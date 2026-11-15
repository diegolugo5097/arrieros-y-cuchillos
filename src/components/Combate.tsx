import { IMG, mito, personaje } from '../game/data';
import { Action, ataqueMito, bonoComida, dadosUsados, GameState, mainDisponible, poderJugador, probVictoria, totalGolpe } from '../game/engine';
import { Dado, Dados, MitoCarta } from './Cartas';

export function Combate({ s, dispatch, onCerrar, esHumano }: { s: GameState; dispatch: (a: Action) => void; onCerrar: () => void; esHumano: boolean }) {
  const c = s.combat!;
  const p = s.players[c.fighter];
  const m = mito(c.mitoId);
  const ataque = ataqueMito(s, c);
  const poder = c.dice.length ? poderJugador(s, c) : null;
  const tieneComida = p.mano.some(x => x.kind === 'comida');
  const probSin = probVictoria(s, p, ataque, c.bonus, false);
  const probCon = probVictoria(s, p, ataque, c.bonus, true);
  const usados = dadosUsados(c);
  const descartado = c.dice.length === 3 ? Math.min(...c.dice) : undefined;
  const puedeActuar = esHumano && !s.queue.length;
  const r = c.reward;
  return (
    <div className="overlay combate">
      <div className="combate-escena" style={{ backgroundImage: `url(${IMG('escenarios/zona-monte')})` }}>
        <div className="combate-lado jugador">
          <img className="figura-combate" src={IMG(personaje(p.personaje).img)} alt="" />
          <div className="combate-nombre" style={{ borderColor: p.color }}>{p.nombre}</div>
          <div className="combate-stats">Equipo +{totalGolpe(p)}{c.bonus ? ` · Bono ${c.bonus > 0 ? '+' : ''}${c.bonus}` : ''}</div>
        </div>
        <div className="combate-centro">
          <div className="marcador">
            <div className="marcador-num" title="Tu poder">{poder ?? '?'}</div>
            <div className="marcador-vs">contra</div>
            <div className="marcador-num mito-num" title="Ataque del mito">{ataque}</div>
          </div>
          {c.dice.length > 0 && (
            <div className="detalle-poder">
              <Dados valores={c.dice} descartado={descartado} />
              <div className="suma">{usados.join(' + ')} + {totalGolpe(p)} equipo{c.bonus ? ` ${c.bonus > 0 ? '+' : '−'} ${Math.abs(c.bonus)} bono` : ''}{c.food ? <> + <Dado v={c.food.d8} color="azul" /> {c.food.nombre}{bonoComida(s, p, c) > c.food.d8 ? ' (+1)' : ''}</> : null}</div>
            </div>
          )}
          {(c.sabotage || c.bizco || s.evento === 'zorros' || s.evento === 'madremonte') && (
            <div className="detalle-mito">
              Ataque {m.ataque}
              {s.evento === 'zorros' && ' +2 (zorros)'}{s.evento === 'madremonte' && ' +3 (Madre Monte)'}
              {c.bizco && ' ×2 (bizco)'}
              {c.sabotage && <> + <Dado v={c.sabotage.d8} color="azul" /> sabotaje de {s.players[c.sabotage.by].nombre}</>}
            </div>
          )}

          {c.step === 'decidir' && (
            <div className="combate-acciones">
              <div className="prob">Probabilidad de ganar: <b>{Math.round(probSin * 100)}%</b>{tieneComida && <> · con comida <b>{Math.round(probCon * 100)}%</b></>}</div>
              {puedeActuar && <>
                {mainDisponible(s) && <button className="btn sec" onClick={() => dispatch({ t: 'habilidad' })}>Bendición de Don Wilson (D6)</button>}
                <button className="btn grande rojo" onClick={() => dispatch({ t: 'pelear' })}>¡Pelear! Lanzar {p.personaje === 'wilson' && !s.gato ? '3' : '2'} D6</button>
                {!c.noFlee && <button className="btn sec" onClick={() => dispatch({ t: 'huir' })}>Huir (D6: {p.apoyo === 'abuelo' || p.copiaApoyo === 'abuelo' ? '4' : '5'} o más)</button>}
                {c.noFlee && <div className="nota">No puedes huir de este mito.</div>}
              </>}
            </div>
          )}
          {c.step === 'tirada' && puedeActuar && (
            <div className="combate-acciones">
              <div className="prob">{poder! >= ataque ? 'Vas ganando.' : `Te faltan ${ataque - poder!}.`} Después, los rivales pueden sabotear.</div>
              <div className="fila-botones">
                {!c.food && p.mano.filter(x => x.kind === 'comida').map(x => x.kind === 'comida' && (
                  <button key={x.uid} className="btn sec chico con-img" onClick={() => dispatch({ t: 'comida', uid: x.uid })}><img src={IMG(x.img)} alt="" /> Comer {x.nombre} (+D8)</button>
                ))}
                {p.mano.filter(x => x.kind === 'exag' && x.id === 'lora').slice(0, 1).map(x => (
                  <button key={x.uid} className="btn sec chico" onClick={() => dispatch({ t: 'lora', uid: x.uid })}>«Más cagao que parapeto de lora»: dado bajo → 6</button>
                ))}
              </div>
              <button className="btn grande" onClick={() => dispatch({ t: 'confirmar' })}>Confirmar tirada</button>
            </div>
          )}
          {(c.step === 'rivales' || c.step === 'victoria') && <div className="prob">Los rivales deciden…</div>}
          {c.step === 'hecho' && (
            <div className={`resultado res-${c.result}`}>
              <div className="res-titulo">{c.result === 'gana' ? '¡Victoria!' : c.result === 'escapa' ? 'Escapaste' : c.result === 'huye' ? 'No lograste huir' : 'Derrota'}</div>
              {c.result === 'gana' && r && <div>Ganas {r.oro} oro, {r.guacas} guaca{r.guacas === 1 ? '' : 's'} y 1 material.</div>}
              {(c.result === 'pierde' || c.result === 'huye') && <div>Castigo: {m.texto}</div>}
              {!s.queue.length && <button className="btn grande" onClick={onCerrar}>Continuar</button>}
            </div>
          )}
        </div>
        <div className="combate-lado mito">
          <MitoCarta id={c.mitoId} ataque={ataque} w={250} recompensa={r ?? undefined} />
        </div>
      </div>
    </div>
  );
}
