// Datos oficiales de cartas — Reglamento consolidado de Arrieros y Cuchillos.

export const IMG = (p: string) => `${import.meta.env?.BASE_URL ?? './'}assets/${p}.webp`;

export type MaterialId = 'G' | 'M' | 'B';
export type ToolId = 'puntilla' | 'martillo' | 'serrucho';
export type Slot = 'arma' | 'prenda' | 'montura';
export type FoodKind = 'alimento' | 'carne' | 'licor';
export type BuildingId = 'casa' | 'plaza' | 'iglesia';
export type Tier = 'rural' | 'siniestro' | 'epico' | 'ancestral';

export const MATERIALES: Record<MaterialId, { nombre: string; img: string }> = {
  G: { nombre: 'Guadua', img: 'objetos/guadua' },
  M: { nombre: 'Madera', img: 'objetos/madera' },
  B: { nombre: 'Barro', img: 'objetos/barro' },
};

export const HERRAMIENTAS: Record<ToolId, { nombre: string; precio: number; img: string }> = {
  puntilla: { nombre: 'Puntilla', precio: 4, img: 'objetos/puntilla' },
  martillo: { nombre: 'Martillo', precio: 6, img: 'objetos/martillo' },
  serrucho: { nombre: 'Serrucho', precio: 8, img: 'objetos/serrucho' },
};

export const EDIFICIOS: Record<BuildingId, { nombre: string; herramientas: ToolId[]; guacas: number; img: string; imgDanada: string }> = {
  casa: { nombre: 'Casa', herramientas: [], guacas: 0, img: 'objetos/casa', imgDanada: 'objetos/casa-danada' },
  plaza: { nombre: 'Plaza de Mercado', herramientas: ['martillo', 'puntilla'], guacas: 0, img: 'objetos/plaza', imgDanada: 'objetos/plaza-danada' },
  iglesia: { nombre: 'Iglesia', herramientas: ['martillo', 'puntilla', 'serrucho'], guacas: 0, img: 'objetos/iglesia', imgDanada: 'objetos/iglesia-danada' },
};
export const ORDEN_EDIFICIOS: BuildingId[] = ['casa', 'plaza', 'iglesia'];

// ---------------- Personajes ----------------
export type CharacterId = 'jairo' | 'jose-maria' | 'clementina' | 'fernando' | 'claudia' | 'wilson' | 'mercedes' | 'herminia' | 'evaristo' | 'rosalba' | 'aurelio';
export interface Character {
  id: CharacterId; nombre: string; rol: string; img: string;
  pasiva: string; activa: [string, string, string]; // [6-5, 4-3, 1]
  momento: 'cualquiera' | 'combate-antes' | 'al-vencer';
}
export const PERSONAJES: Character[] = [
  { id: 'jairo', nombre: 'Don Jairo Rivillas', rol: 'Explorador', img: 'personajes/jairo', momento: 'al-vencer',
    pasiva: 'Intuición Mítica: mira la carta de arriba del Monte y puede ponerla al fondo (si lo hace, no puede huir de la siguiente). Cada mito que vence le da +1 oro.',
    activa: ['Al vencer un mito: +1 guaca', 'Al vencer un mito: +1 oro', 'Pierde 1 oro'] },
  { id: 'jose-maria', nombre: 'Don José María Espinosa', rol: 'Negociante', img: 'personajes/jose-maria', momento: 'cualquiera',
    pasiva: 'Comerciante Hábil: puede hacer 2 intercambios por turno.',
    activa: ['Roba 1 carta al azar a un rival', 'Toma 1 carta del descarte de Guacas', 'Le da 1 carta a un rival'] },
  { id: 'clementina', nombre: 'Doña Clementina Hurtado', rol: 'Abastecedora', img: 'personajes/clementina', momento: 'cualquiera',
    pasiva: 'Vendedora Experta: su primera venta de comida o material en cada turno vale +1 oro.',
    activa: ['Toma 1 comida del descarte de Guacas', 'Gana 2 oro', 'Descarta 1 comida'] },
  { id: 'fernando', nombre: 'Don Fernando Cadavid', rol: 'Constructor', img: 'personajes/fernando', momento: 'cualquiera',
    pasiva: 'Manos Hábiles: las herramientas le cuestan 1 oro menos.',
    activa: ['Convierte 1 material en una Puntilla o un Martillo', 'Cambia 1 material por otro del Fondo', 'Descarta 1 material'] },
  { id: 'claudia', nombre: 'Doña Claudia María R.', rol: 'Boticaria', img: 'personajes/claudia', momento: 'cualquiera',
    pasiva: 'Remedios de Monte: sus comidas suman D8 + 1. Una vez por ronda evita el castigo al perder.',
    activa: ['Duplica el oro del próximo mito que venza', 'Toma 1 comida del descarte de Guacas', 'Descarta 1 comida'] },
  { id: 'wilson', nombre: 'Don Wilson Cuchillo', rol: 'Guía espiritual', img: 'personajes/wilson', momento: 'combate-antes',
    pasiva: 'Bendición Divina: en combate lanza 3 D6, descarta el más bajo y suma +3 de golpe.',
    activa: ['Antes de lanzar: +3 de golpe', 'Antes de lanzar: +2 de golpe', 'Antes de lanzar: −1 de golpe'] },
  { id: 'mercedes', nombre: 'Doña Mercedes', rol: 'Tejedora de guadua', img: 'personajes/mercedes', momento: 'cualquiera',
    pasiva: 'Manos de Guadua: compra Guadua a 1 oro y al construir puede usarla en lugar de Madera o Barro.',
    activa: ['Gana 1 Guadua', 'Cambia 1 Madera o Barro por Guadua', 'Descarta 1 material'] },
  { id: 'herminia', nombre: 'Doña Herminia', rol: 'Comadrona', img: 'personajes/herminia', momento: 'cualquiera',
    pasiva: 'Buena Comadre: contrata apoyos a 1 oro menos y usa la habilidad de su apoyo dos veces por turno.',
    activa: ['Roba 1 guaca', 'Toma 1 comida del descarte de Guacas', 'Pierde 1 oro'] },
  { id: 'evaristo', nombre: 'Don Evaristo', rol: 'Culebrero', img: 'personajes/evaristo', momento: 'cualquiera',
    pasiva: 'Pico de Oro: cada vez que saca un dicho en el Monte, roba 1 guaca.',
    activa: ['Roba 1 guaca', 'Gana 1 oro', 'Descarta 1 carta'] },
  { id: 'rosalba', nombre: 'Doña Rosalba', rol: 'Cantinera', img: 'personajes/rosalba', momento: 'cualquiera',
    pasiva: 'La Casa Invita: sus sabotajes suman D8 + 1. Si el rival que sabotea pierde, ella gana 1 oro.',
    activa: ['Toma 1 licor del descarte y gana 1 oro', 'Toma 1 licor del descarte', 'Pierde 1 oro'] },
  { id: 'aurelio', nombre: 'Don Aurelio', rol: 'Arriero mayor', img: 'personajes/aurelio', momento: 'cualquiera',
    pasiva: 'Ojo de Arriero: en el Monte mira 2 cartas y escoge cuál enfrentar; la otra va al fondo. No puede huir.',
    activa: ['Gana 1 material a elección', 'Gana 1 oro', 'Pierde 1 oro'] },
];
export const personaje = (id: CharacterId) => PERSONAJES.find(p => p.id === id)!;

// ---------------- Apoyo ----------------
export type ApoyoId = 'chapolera' | 'tulio' | 'abuelo' | 'genovevo' | 'benancio' | 'edilberto' | 'cura-audemio' | 'polonio';
export interface Apoyo { id: ApoyoId; nombre: string; img: string; pasiva: string; activa: [string, string, string] }
export const APOYOS: Apoyo[] = [
  { id: 'chapolera', nombre: 'Alta Gracia la Chapolera', img: 'apoyo/chapolera', pasiva: 'Al robar guacas en la Plaza, roba 2 y te quedas con 1.',
    activa: ['Roba 1 guaca extra', 'Toma 1 carta del descarte de Guacas', 'Descarta 1 carta'] },
  { id: 'tulio', nombre: 'Tulio el Peón', img: 'apoyo/tulio', pasiva: 'Al vencer un mito, eliges el material en vez de lanzar.',
    activa: ['Ganas 1 material a elección', 'Cambias 1 material por otro', 'Pierdes 1 material'] },
  { id: 'abuelo', nombre: 'El Abuelo', img: 'apoyo/abuelo', pasiva: 'Huyes con 4, 5 o 6.',
    activa: ['Mira las 3 primeras cartas del Monte y elige la de arriba', 'Mira la primera carta del Monte', 'Descarta 1 carta'] },
  { id: 'genovevo', nombre: 'El Borracho Genovevo', img: 'apoyo/genovevo', pasiva: 'Tus licores suman D8 + 1 y no te enguayabas.',
    activa: ['Toma 1 licor del descarte y roba 1 guaca', 'Toma 1 comida del descarte', 'Pierdes 1 oro'] },
  { id: 'benancio', nombre: 'Benancio el Carnicero', img: 'apoyo/benancio', pasiva: 'Tus carnes suman D8 + 1.',
    activa: ['Toma 2 carnes del descarte', 'Toma 1 carne del descarte', 'Descarta 1 comida'] },
  { id: 'edilberto', nombre: 'Edilberto el Trovador', img: 'apoyo/edilberto', pasiva: 'Copias la pasiva del apoyo de un rival (lo eliges al contratarlo).',
    activa: ['Usas la habilidad del personaje de un rival', 'Robas 1 guaca', 'Descarta 1 carta'] },
  { id: 'cura-audemio', nombre: 'El Cura Audemio', img: 'apoyo/cura-audemio', pasiva: 'Cada vez que construyes un edificio, recibes 1 guaca.',
    activa: ['+1 guaca', '+1 oro', 'Pierdes 1 oro'] },
  { id: 'polonio', nombre: 'Don Polonio el Tendero', img: 'apoyo/polonio', pasiva: 'Compras materiales a 1 oro.',
    activa: ['+2 oro', '+1 oro', 'Pierdes 1 oro'] },
];
export const apoyo = (id: ApoyoId) => APOYOS.find(a => a.id === id)!;

// ---------------- Mitos ----------------
export type Castigo =
  | { t: 'descartaMano'; n: number } | { t: 'descartaComida' } | { t: 'descartaMaterial'; n: number }
  | { t: 'descartaEquipo' } | { t: 'descartaHerramienta' } | { t: 'danaCasa' } | { t: 'danaMejor' }
  | { t: 'saltaMonte' } | { t: 'descartaTodaMano' } | { t: 'entregaMejorEquipo' } | { t: 'pierdeTurno' }
  | { t: 'reparteMano' } | { t: 'danaTodos' } | { t: 'descartaTodosMateriales' };

export interface MitoDef { id: string; nombre: string; tier: Tier; ataque: number; copias: number; castigo: Castigo; texto: string }
export const RECOMPENSA: Record<Tier, { oro: number; guacas: number }> = {
  rural: { oro: 2, guacas: 1 }, siniestro: { oro: 3, guacas: 1 }, epico: { oro: 5, guacas: 2 }, ancestral: { oro: 8, guacas: 3 },
};
export const TIER_NOMBRE: Record<Tier, string> = { rural: 'Rural', siniestro: 'Siniestro', epico: 'Épico', ancestral: 'Ancestral' };

export const MITOS: MitoDef[] = [
  { id: 'conejo', nombre: 'Conejo Salvaje', tier: 'rural', ataque: 5, copias: 2, castigo: { t: 'descartaMano', n: 1 }, texto: 'Descartas 1 carta de la mano' },
  { id: 'avispa', nombre: 'Avispa', tier: 'rural', ataque: 5, copias: 2, castigo: { t: 'descartaMano', n: 1 }, texto: 'Descartas 1 carta de la mano' },
  { id: 'culebra', nombre: 'Culebra Cazadora', tier: 'rural', ataque: 6, copias: 2, castigo: { t: 'descartaMano', n: 1 }, texto: 'Descartas 1 carta de la mano' },
  { id: 'guatin', nombre: 'El Guatín', tier: 'rural', ataque: 6, copias: 2, castigo: { t: 'descartaMano', n: 1 }, texto: 'Descartas 1 carta de la mano' },
  { id: 'chucha', nombre: 'Chucha de Monte', tier: 'rural', ataque: 7, copias: 2, castigo: { t: 'descartaComida' }, texto: 'Descartas 1 comida (o 1 carta si no tienes)' },
  { id: 'caiman', nombre: 'El Caimán', tier: 'rural', ataque: 7, copias: 2, castigo: { t: 'descartaComida' }, texto: 'Descartas 1 comida (o 1 carta si no tienes)' },
  { id: 'cerdo', nombre: 'Cerdo Salvaje', tier: 'siniestro', ataque: 8, copias: 2, castigo: { t: 'descartaMaterial', n: 1 }, texto: 'Descartas 1 material' },
  { id: 'pollo', nombre: 'El Pollo Sin Cabeza', tier: 'siniestro', ataque: 8, copias: 1, castigo: { t: 'descartaMano', n: 2 }, texto: 'Descartas 2 cartas de la mano' },
  { id: 'tres-pies', nombre: 'El Tres Pies', tier: 'siniestro', ataque: 9, copias: 2, castigo: { t: 'descartaMano', n: 2 }, texto: 'Descartas 2 cartas de la mano' },
  { id: 'silbon', nombre: 'El Silbón', tier: 'siniestro', ataque: 9, copias: 1, castigo: { t: 'descartaMano', n: 2 }, texto: 'Descartas 2 cartas de la mano' },
  { id: 'patetarro', nombre: 'El Patetarro', tier: 'siniestro', ataque: 10, copias: 2, castigo: { t: 'descartaEquipo' }, texto: 'Descartas 1 equipo' },
  { id: 'duende', nombre: 'El Duende', tier: 'siniestro', ataque: 10, copias: 1, castigo: { t: 'descartaMaterial', n: 1 }, texto: 'Descartas 1 material' },
  { id: 'pijao', nombre: 'Indio Pijao', tier: 'epico', ataque: 11, copias: 1, castigo: { t: 'descartaEquipo' }, texto: 'Descartas 1 equipo' },
  { id: 'hojarasquin', nombre: 'El Hojarasquín del Monte', tier: 'epico', ataque: 11, copias: 1, castigo: { t: 'descartaMano', n: 2 }, texto: 'Descartas 2 cartas de la mano' },
  { id: 'anima-sola', nombre: 'El Ánima Sola', tier: 'epico', ataque: 12, copias: 1, castigo: { t: 'descartaMaterial', n: 2 }, texto: 'Descartas 2 materiales' },
  { id: 'mohan', nombre: 'El Mohán', tier: 'epico', ataque: 12, copias: 1, castigo: { t: 'descartaHerramienta' }, texto: 'Descartas 1 herramienta (o 1 material si no tienes)' },
  { id: 'calarca', nombre: 'Indio Calarcá', tier: 'epico', ataque: 13, copias: 1, castigo: { t: 'danaCasa' }, texto: 'Tu Casa queda dañada' },
  { id: 'quimbaya', nombre: 'Indio Quimbaya', tier: 'epico', ataque: 14, copias: 1, castigo: { t: 'descartaTodosMateriales' }, texto: 'Descartas todos tus materiales' },
  { id: 'demonio', nombre: 'El Demonio', tier: 'ancestral', ataque: 15, copias: 1, castigo: { t: 'danaMejor' }, texto: 'Tu edificio más valioso queda dañado' },
  { id: 'bruja', nombre: 'La Bruja', tier: 'ancestral', ataque: 15, copias: 1, castigo: { t: 'saltaMonte' }, texto: 'Te saltas el Monte en tu próximo turno' },
  { id: 'sombreron', nombre: 'El Sombrerón', tier: 'ancestral', ataque: 16, copias: 1, castigo: { t: 'descartaTodaMano' }, texto: 'Descartas toda tu mano' },
  { id: 'diablo', nombre: 'El Diablo', tier: 'ancestral', ataque: 16, copias: 1, castigo: { t: 'entregaMejorEquipo' }, texto: 'Entregas tu mejor equipo al jugador con menos golpe' },
  { id: 'llorona', nombre: 'La Llorona', tier: 'ancestral', ataque: 17, copias: 1, castigo: { t: 'pierdeTurno' }, texto: 'Pierdes tu próximo turno completo' },
  { id: 'pata-sola', nombre: 'Pata Sola', tier: 'ancestral', ataque: 18, copias: 1, castigo: { t: 'reparteMano' }, texto: 'Repartes tu mano, una carta a cada rival empezando por la derecha' },
  { id: 'madre-monte', nombre: 'Madre Monte', tier: 'ancestral', ataque: 18, copias: 1, castigo: { t: 'danaTodos' }, texto: 'Todos tus edificios quedan dañados' },
];
export const mito = (id: string) => MITOS.find(m => m.id === id)!;
export const TIER_FONDO: Record<Tier, string> = {
  rural: 'escenarios/fondo-rural', siniestro: 'escenarios/fondo-siniestro', epico: 'escenarios/fondo-epico', ancestral: 'escenarios/fondo-ancestral',
};

// ---------------- Dichos ----------------
export type DichoId = 'cria-fama' | 'herrero' | 'caballo' | 'lobos' | 'abarca' | 'arbol' | 'tarde' | 'fiesta' | 'gato' | 'pollo'
  | 'mal-que' | 'llora' | 'dime' | 'zorro' | 'palo' | 'borrachos' | 'gratis' | 'mal-tiempo' | 'consejos' | 'ocasion';
export const DICHOS: { id: DichoId; nombre: string; texto: string; guardable?: boolean }[] = [
  { id: 'cria-fama', nombre: 'Cría fama y échate a dormir', texto: 'Pon un mito del descarte encima del mazo del Monte. Ganas 2 oro.' },
  { id: 'herrero', nombre: 'En casa de herrero, cuchillo de palo', texto: 'Todos descartan 1 material.' },
  { id: 'caballo', nombre: 'A caballo regalado no se le mira el diente', texto: 'Toma 1 carta del descarte de Guacas.' },
  { id: 'lobos', nombre: 'Quien con lobos se junta, a aullar aprende', texto: 'Lanza 1 D6: con 5 o 6 ganas 1 guaca.' },
  { id: 'abarca', nombre: 'El que mucho abarca poco aprieta', texto: 'Todos descartan 1 carta de la mano.' },
  { id: 'arbol', nombre: 'De árbol caído todos hacen leña', texto: 'Todos lanzan 1 D6: 1–2 ganan 1 oro, 3–4 ganan 2, 5–6 ganan 3.' },
  { id: 'tarde', nombre: 'Más vale tarde que nunca', texto: 'Guárdala. Úsala para hacer el Taller dos veces en un turno.', guardable: true },
  { id: 'fiesta', nombre: 'Lo que nada cuesta, volvámoslo fiesta', texto: 'Regala 1 carta de tu mano a cada rival.' },
  { id: 'gato', nombre: 'Le metieron gato por liebre', texto: 'Nadie usa habilidades de personajes hasta el final de la ronda.' },
  { id: 'pollo', nombre: 'El que no arriesga un pollo no tiene un huevo', texto: 'Todos entregan su mejor equipo; se mezclan y se reparte uno a cada uno.' },
  { id: 'mal-que', nombre: 'No hay mal que por bien no venga', texto: 'Mira tantas cartas del Monte como jugadores y elige cuál queda arriba.' },
  { id: 'llora', nombre: 'El que no llora no mama', texto: 'Se revelan tantas guacas como jugadores. Cada uno toma una, empezando por ti.' },
  { id: 'dime', nombre: 'Dime con quién andas y te diré quién eres', texto: 'Roba 1 carta al azar de la mano de un rival.' },
  { id: 'zorro', nombre: 'Zorro viejo no cae en trampa', texto: 'Guárdala. Anula el próximo castigo que sufras.', guardable: true },
  { id: 'palo', nombre: 'De tal palo tal astilla', texto: 'Todos lanzan 1 D6; el más alto pelea contra un mito de ataque 6 que da 3 oro + 1 guaca.' },
  { id: 'borrachos', nombre: 'Los borrachos y los niños siempre dicen la verdad', texto: 'Todos pasan 2 cartas de su mano al jugador de la derecha.' },
  { id: 'gratis', nombre: 'Gratis hasta una patada', texto: 'Todos roban 1 guaca y ganan 1 oro.' },
  { id: 'mal-tiempo', nombre: 'A mal tiempo, buena cara', texto: 'Guárdala. Anula el castigo del mito que acabas de perder.', guardable: true },
  { id: 'consejos', nombre: 'El que no recibe consejos no llega a viejo', texto: 'Descarta 1 carta de tu mano: un rival descarta 1 equipo o 1 carta al azar de su mano.' },
  { id: 'ocasion', nombre: 'La ocasión hace al ladrón', texto: 'Elige un mito del descarte y pelealo. Si ganas, recibes el doble de oro.' },
];
export const dicho = (id: DichoId) => DICHOS.find(d => d.id === id)!;

// ---------------- Mazo de Guacas (equipo, comida, exageraciones) ----------------
export type ExagId = 'mato-tigre' | 'filo' | 'bravo' | 'aburrido' | 'lombriz' | 'perro' | 'carro' | 'poncho' | 'marrano'
  | 'gorgojo' | 'mama' | 'otro-perro' | 'radio' | 'lora' | 'bizco' | 'tamal';
export type ExagMomento = 'turno' | 'victoria-rival' | 'combate-rival' | 'combate-propio' | 'construir' | 'objetivo';
export const EXAGERACIONES: { id: ExagId; nombre: string; copias: number; texto: string; momento: ExagMomento; objetivo?: boolean }[] = [
  { id: 'mato-tigre', nombre: 'Mató el tigre y se asustó con la piel', copias: 2, texto: 'Un rival que acaba de vencer un mito no recibe oro ni guacas.', momento: 'victoria-rival' },
  { id: 'filo', nombre: 'Se duerme en el filo de un machete', copias: 1, texto: 'Te quedas con el oro que un rival acaba de ganar en un mito.', momento: 'victoria-rival' },
  { id: 'bravo', nombre: 'Es tan bravo que compra una pelea', copias: 2, texto: 'Un rival descarta 1 equipo.', momento: 'turno', objetivo: true },
  { id: 'aburrido', nombre: 'Más aburrido que un caballo en un balcón', copias: 1, texto: 'Cambia un equipo tuyo por uno del mismo espacio de un rival.', momento: 'turno', objetivo: true },
  { id: 'lombriz', nombre: 'Más asustado que lombriz en fiesta de gallinas', copias: 1, texto: 'Un rival se salta el Monte en su próximo turno.', momento: 'turno', objetivo: true },
  { id: 'perro', nombre: 'No convenció un perro con un salchichón', copias: 1, texto: 'Suma 1 D8 al mito de un rival, sin gastar comida.', momento: 'combate-rival' },
  { id: 'carro', nombre: 'Más feo que un carro por debajo', copias: 1, texto: 'Daña la Casa o la Plaza de un rival.', momento: 'turno', objetivo: true },
  { id: 'poncho', nombre: 'Se emborracha voleando un poncho', copias: 1, texto: 'Un rival descarta 1 carta al azar de su mano. Ganas 1 oro.', momento: 'turno', objetivo: true },
  { id: 'marrano', nombre: 'Estorba más que un marrano en la cocina', copias: 1, texto: 'El personaje de apoyo de un rival solo funciona con 6 en su próximo turno.', momento: 'turno', objetivo: true },
  { id: 'gorgojo', nombre: 'Trabaja más un gorgojo en un vidrio', copias: 1, texto: 'Un rival descarta 1 material.', momento: 'turno', objetivo: true },
  { id: 'mama', nombre: 'Más feo que pegarle a la mamá', copias: 1, texto: 'Cuenta como cualquier herramienta al construir (se usa sola).', momento: 'construir' },
  { id: 'otro-perro', nombre: 'A otro perro con ese hueso', copias: 2, texto: 'Cuando te ataquen con una exageración, pásale el efecto a otro jugador.', momento: 'objetivo' },
  { id: 'radio', nombre: 'En la casa no le habla ni el radio', copias: 1, texto: 'Repara gratis un edificio dañado.', momento: 'turno' },
  { id: 'lora', nombre: 'Más cagao que parapeto de lora', copias: 2, texto: 'En tu combate, cambia tu dado más bajo por un 6.', momento: 'combate-propio' },
  { id: 'bizco', nombre: 'Es tan bizco que llora y se moja la espalda', copias: 1, texto: 'Duplica el ataque y la recompensa del mito que enfrenta un rival.', momento: 'combate-rival' },
  { id: 'tamal', nombre: 'No vende un tamal en un derrumbe', copias: 1, texto: 'La próxima venta de un rival en el Campo es para ti.', momento: 'turno', objetivo: true },
];
export const exag = (id: ExagId) => EXAGERACIONES.find(e => e.id === id)!;

export interface EquipDef { nombre: string; slot: Slot; golpe: number; copias: number; img: string; nota?: string }
export const EQUIPO: EquipDef[] = [
  { nombre: 'Garrote', slot: 'arma', golpe: 2, copias: 3, img: 'objetos/garrote' },
  { nombre: 'Cuchillo', slot: 'arma', golpe: 3, copias: 3, img: 'objetos/cuchillo' },
  { nombre: 'Peinilla', slot: 'arma', golpe: 4, copias: 2, img: 'objetos/peinilla' },
  { nombre: 'Machete de Acero', slot: 'arma', golpe: 5, copias: 1, img: 'objetos/machete' },
  { nombre: 'Sombrero aguadeño', slot: 'prenda', golpe: 1, copias: 1, img: 'objetos/sombrero' },
  { nombre: 'Carriel', slot: 'prenda', golpe: 1, copias: 1, img: 'objetos/carriel', nota: 'Límite de mano 9' },
  { nombre: 'Poncho', slot: 'prenda', golpe: 2, copias: 2, img: 'objetos/poncho' },
  { nombre: 'Ruana de Cuero', slot: 'prenda', golpe: 3, copias: 1, img: 'objetos/ruana-cuero' },
  { nombre: 'Cotizas', slot: 'montura', golpe: 1, copias: 2, img: 'objetos/cotizas' },
  { nombre: 'Alpargatas', slot: 'montura', golpe: 1, copias: 1, img: 'objetos/alpargatas' },
  { nombre: 'Quimbas', slot: 'montura', golpe: 2, copias: 2, img: 'objetos/quimbas' },
  { nombre: 'Mula', slot: 'montura', golpe: 3, copias: 1, img: 'objetos/mula' },
];
export const SLOT_NOMBRE: Record<Slot, string> = { arma: 'Arma', prenda: 'Prenda', montura: 'Montura o calzado' };

export const COMIDA: { nombre: string; tipo: FoodKind; copias: number; img: string }[] = [
  { nombre: 'Arepas con queso', tipo: 'alimento', copias: 4, img: 'objetos/arepas' },
  { nombre: 'Mazamorra', tipo: 'alimento', copias: 4, img: 'objetos/mazamorra' },
  { nombre: 'Chorizos', tipo: 'carne', copias: 3, img: 'objetos/chorizos' },
  { nombre: 'Sancocho', tipo: 'carne', copias: 3, img: 'objetos/sancocho' },
  { nombre: 'Aguardiente', tipo: 'licor', copias: 3, img: 'objetos/aguardiente' },
  { nombre: 'Guarapo', tipo: 'licor', copias: 3, img: 'objetos/guarapo' },
];
export const VENTA_COMIDA: Record<FoodKind, number> = { alimento: 1, carne: 2, licor: 2 };
export const FOOD_NOMBRE: Record<FoodKind, string> = { alimento: 'Alimento', carne: 'Carne', licor: 'Licor' };

// ---------------- Eventos ----------------
export type EventoId = 'chequeo' | 'auge' | 'lluvia' | 'reforma' | 'aprendizaje' | 'sequia' | 'zorros' | 'cierre' | 'madremonte'
  | 'robo' | 'rebaja' | 'vendimia' | 'errantes' | 'reparacion' | 'cosecha';
export const EVENTOS: { id: EventoId; nombre: string; tipo: string; texto: string }[] = [
  { id: 'chequeo', nombre: 'Chequeo de Tierras', tipo: 'Modificación', texto: 'Contratar apoyo cuesta 1 oro. Todos ganan 1 material.' },
  { id: 'auge', nombre: 'Auge del Comercio', tipo: 'Modificación', texto: 'Las ventas pagan el doble.' },
  { id: 'lluvia', nombre: 'Lluvia Beneficiosa', tipo: 'Modificación', texto: 'Los materiales cuestan 1 oro. Todos ganan 1 material.' },
  { id: 'reforma', nombre: 'Reforma del Taller', tipo: 'Modificación', texto: 'Puedes comprar 2 herramientas, cada una con 1 oro de descuento.' },
  { id: 'aprendizaje', nombre: 'Aprendizaje Común', tipo: 'Modificación', texto: 'En el Taller puedes comprar la herramienta que quieras del mazo.' },
  { id: 'sequia', nombre: 'Sequía Extrema', tipo: 'Desafío', texto: 'No hay cosecha.' },
  { id: 'zorros', nombre: 'Ataque de los Zorros', tipo: 'Desafío', texto: 'Los mitos tienen +2 de ataque y pagan el doble de oro.' },
  { id: 'cierre', nombre: 'Cierre Temporal de la Plaza', tipo: 'Desafío', texto: 'No hay intercambios ni contrataciones.' },
  { id: 'madremonte', nombre: 'Madre Monte se Enfada', tipo: 'Desafío', texto: 'Los mitos tienen +3 de ataque y pagan el doble de oro + 1 guaca.' },
  { id: 'robo', nombre: 'Robo en la Plaza', tipo: 'Desafío', texto: 'Quien tenga más oro pierde 3.' },
  { id: 'rebaja', nombre: 'Rebaja en Herramientas', tipo: 'Oportunidad', texto: 'Las herramientas cuestan 2 oro menos (mínimo 2).' },
  { id: 'vendimia', nombre: 'Fiesta de la Vendimia', tipo: 'Oportunidad', texto: 'Todos ganan 2 oro y roban 1 guaca.' },
  { id: 'errantes', nombre: 'Aparecen los Arrieros Errantes', tipo: 'Oportunidad', texto: 'En la Plaza puedes comprar 1 guaca por 5 oro.' },
  { id: 'reparacion', nombre: 'Reparación del Camino', tipo: 'Oportunidad', texto: 'Reparar es gratis.' },
  { id: 'cosecha', nombre: 'Final de la Cosecha', tipo: 'Oportunidad', texto: 'La cosecha da el doble.' },
];
export const evento = (id: EventoId) => EVENTOS.find(e => e.id === id)!;

export const ZONAS = [
  { id: 'plaza', nombre: 'Plaza Principal', img: 'escenarios/zona-plaza' },
  { id: 'monte', nombre: 'El Monte', img: 'escenarios/zona-monte' },
  { id: 'taller', nombre: 'Taller y Construcción', img: 'escenarios/zona-taller' },
  { id: 'campo', nombre: 'Campo de Cultivo', img: 'escenarios/zona-campo' },
] as const;
