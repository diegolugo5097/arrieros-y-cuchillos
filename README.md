# Arrieros y Cuchillos: Una Aventura Quindiana

Juego de mesa digital para 2 a 4 jugadores. Cada jugador entra desde su propio PC o celular (en horizontal) y ve la mesa completa en su pantalla. Los puestos vacíos se pueden llenar con la IA.
Hecho con React 19, TypeScript, Vite, Express y Socket.io.

## Instalar y jugar

Necesitas **Node.js 18 o superior** (recomendado 20 o 22).

```bash
npm install
npm run jugar
```

Esto compila el juego y arranca el servidor. En la terminal aparecen dos direcciones:

- **En este equipo:** http://localhost:3000
- **En la red local:** http://192.168.x.x:3000, para los otros dispositivos conectados al mismo wifi. El lobby la muestra como código QR.

### Mientras programas

```bash
npm run dev
```

Arranca Vite (con recarga en caliente) y el servidor a la vez. Abre http://localhost:5173; los demás dispositivos usan la dirección del QR.

## Comandos

| Comando | Para qué |
| --- | --- |
| `npm run jugar` | Compila y arranca el servidor en el puerto 3000 |
| `npm start` | Arranca el servidor con la versión ya compilada |
| `npm run build` | Revisa los tipos y genera `dist/` |
| `npm run build:web` | Genera solo el frontend (lo usa Vercel) |
| `npm run simular` | Simula 300 partidas entre IAs y muestra estadísticas de balance (`npm run simular -- 1000` para más) |

## Cómo arrancar una partida

1. Un jugador toca **Crear partida**, escribe su nombre y queda como anfitrión. El lobby muestra el código de 4 letras, un QR y el enlace para compartir.
2. Los demás tocan **Unirme a una partida** (o abren el enlace / escanean el QR), escriben su nombre y eligen personaje.
3. El anfitrión puede dejar puestos a la IA y toca **Comenzar partida**. Los puestos libres se quitan solos.

En celulares el juego se ve en horizontal; si el celular está vertical, aparece un aviso para girarlo.

**Pantalla completa:**
- **Android (Chrome):** el juego entra solo a pantalla completa en horizontal con el primer toque, y vuelve a entrar si se sale.
- **PC:** hay un botón ⛶ abajo a la izquierda.
- **iPhone (Safari o Chrome):** ningún navegador de iPhone permite pantalla completa en páginas web. Hay que tocar Compartir → «Agregar a pantalla de inicio» y abrir el juego desde ese ícono, que abre sin barras del navegador. El juego trae su manifiesto e íconos para eso, y en Android también se puede instalar así.

**Mientras otro juega, todos ven la mesa:**
- el mapa con la ficha de cada jugador;
- los mazos, las herramientas y los apoyos;
- el combate en vivo;
- los dichos y eventos (se quedan entre 9 y 16 segundos, con una barra de tiempo);
- el pueblo de cada jugador.

Las cartas jugadas cruzan volando hasta el mapa o el combate, los mitos aparecen en grande, los dados ruedan y el resultado cae como un sello. Con el botón **Mis cartas** puedes mirar tu mano sin esperar tu turno.

**Cuando te toca jugar o intervenir, la pantalla cambia sola a tus controles:**
- Tu turno: pestañas **Mano**, **Mi turno** (acciones de la zona y botón para avanzar) y **Pueblo**, con un botón para **Ver la mesa**.
- Reacciones (sabotear, «Mató el tigre…»): una cuenta regresiva de 15 segundos.
- Combate: en dos columnas, con el mito a un lado y tus opciones al otro; si tienes comida o licor, aparece **Seguir sin potenciador** para pelear sin usarlos.

Al terminar, la pantalla vuelve sola a la mesa.

Otros detalles:
- **Reconexión:** si un dispositivo se recarga, vuelve solo a la partida.
- **Desconexiones:** el anfitrión puede reemplazar por la IA a quien se desconecte.
- **Autoridad del servidor:** valida cada jugada y a cada dispositivo le envía solo lo que puede ver. Las jugadas hechas sobre una pantalla vieja (dobles toques) se descartan.
- **Salas:** viven en la memoria del servidor; si el servidor se reinicia, se pierden.

## Publicarlo en internet

### Opción A — Todo en Render (recomendada)

Un solo servicio sirve el juego y el servidor de partidas. El archivo `render.yaml` ya viene configurado.

1. Sube el proyecto a un repositorio de GitHub.
2. En Render: **New → Blueprint**, elige el repositorio y confirma. Render lee `render.yaml`.
3. Si prefieres crearlo a mano (**New → Web Service**):
   - Build Command: `npm install --include=dev && npm run build`
   - Start Command: `npm start`
   - Health Check Path: `/api/salud`
   - Variable de entorno: `NODE_VERSION=20`
4. Abre `https://tu-servicio.onrender.com`, crea la partida y comparte el código o el QR.

En el plan gratuito, Render apaga el servicio tras unos 15 minutos sin uso. La primera visita puede tardar hasta un minuto en despertarlo; la pantalla de carga lo avisa.

### Opción B — Frontend en Vercel + servidor en Render

Vercel no mantiene conexiones WebSocket, así que el servidor de partidas sigue en Render y Vercel solo sirve las páginas.

1. Despliega primero la opción A para tener el servidor en Render. Anota su URL.
2. En Vercel: **Add New → Project** e importa el mismo repositorio. `vercel.json` ya define el build (`npm run build:web`) y la carpeta `dist`.
3. En **Settings → Environment Variables** agrega `VITE_SERVER_URL=https://tu-servicio.onrender.com` (sin barra final) y vuelve a desplegar. Mira `.env.example`.
4. Abre la URL de Vercel y crea la partida; todos los dispositivos se conectan al servidor de Render. El CORS ya está abierto.

## Sonido

Todos los sonidos se sintetizan en el navegador con Web Audio, sin archivos: dados, cartas, monedas, martillazos al construir, el encuentro con cada mito (más grave con los épicos y ancestrales), victoria, derrota, eventos y una fanfarria final. La música es de cuerdas pulsadas tipo tiple: un bambuco en Re mayor en el pueblo y un tema lento en Si menor en el Monte. El botón 🔊 permite apagar o ajustar la música y los efectos por separado.

## Reglas

- De 2 a 4 jugadores; cada puesto puede ser una persona o la IA.
- Al empezar, cada jugador tira un D6 desde su celular: el que saque más arranca y los demás siguen de mayor a menor (los empates vuelven a tirar). El primer jugador rota cada ronda siguiendo ese orden.
- Todos empiezan con 8 cartas del Morral, sin oro ni materiales. El límite de mano es 10 (12 con el Carriel).
- En la pestaña **Mano** ves todas tus cartas; al tocar una se ve completa en grande, con su acción. Si otro jugador te quita cartas, te sale un aviso con cuáles y por qué.
- El botón **Cómo jugar** tiene un resumen; el reglamento completo es el documento consolidado.

## Estructura

```text
src/
  game/data.ts      Todas las cartas: mitos, dichos, exageraciones, equipo, comida, eventos, personajes
  game/engine.ts    Motor de reglas puro (sin React): turnos, combate, castigos, habilidades, victoria
  game/ai.ts        IA heurística
  components/       Pantallas: inicio, configuración, tablero, combate, cartas y ventanas
  components/Mesa.tsx      Tablero de la mesa (lo que todos ven mientras otro juega)
  components/Juego.tsx     Cambia entre la mesa y los controles según a quién le toca
  components/Celular.tsx   Controles del jugador: mano, turno, combate y decisiones
  audio/            Sonidos sintetizados y música
  net/red.ts        Cliente de red (Socket.io)
  App.tsx           Ciclo de la IA, guardado y modo en red
server/index.ts     Servidor de salas: motor autoritativo, vistas ocultas, IA, chat, reconexión
public/assets/      Arte en WebP (personajes, apoyo, mitos, escenarios, objetos, cartas)
scripts/simular.ts  Simulador de partidas
```

Para cambiar un número del juego (ataque de un mito, precio de una herramienta, recompensas) basta con editar `src/game/data.ts`; las cartas se dibujan en código, así que no hace falta tocar el arte.

## Decisiones de implementación

El motor sigue el reglamento consolidado. Estas son las simplificaciones para la versión digital:

- Los descartes por castigo (por ejemplo «descartas 1 carta de la mano») eligen solos la carta de menor valor.
- Sabotear un combate (comida o «No convenció un perro…») lo puede hacer un solo rival por combate; el juego pregunta en orden a cada rival que tenga cómo hacerlo.
- Las exageraciones que reaccionan (al vencer un rival o durante su combate) se ofrecen automáticamente en el momento justo.
- «No vende un tamal en un derrumbe» se juega en tu turno y marca al rival: su próxima venta es para ti.
- «De tal palo tal astilla»: el combate contra el mito de ataque 6 se resuelve solo (2D6 + equipo).
- Los intercambios incluyen oro, materiales y herramientas (no cartas de la mano).
- Edilberto copia la pasiva del apoyo de un rival al contratarlo, y con 6–5 usa la activa del personaje principal de un rival.

## Balance (simulación de 600 partidas entre IAs)

- Inicio con 8 cartas, sin oro ni materiales, y límite de mano de 10 (12 con Carriel): mediana de 10 rondas por partida. Los valores se cambian en `INICIO` y `limiteMano`, en `src/game/engine.ts`.
- Don José María (44 %) y Doña Clementina (42 %) ganan más seguido; Don Jairo (24 %), Doña Claudia (28 %) y Don Wilson (27 %) menos. Conviene confirmarlo en mesa antes de ajustar habilidades.
