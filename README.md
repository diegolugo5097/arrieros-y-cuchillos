# Arrieros y Cuchillos: Una Aventura Quindiana

Juego de mesa digital para 2 a 4 jugadores en **modo mesa**: una TV o computador muestra el tablero como un mapa, y cada jugador usa su celular como su mano de cartas. Los puestos vacíos se pueden llenar con la IA.
Hecho con React 19, TypeScript, Vite, Express y Socket.io.

## Instalar y jugar

Necesitas **Node.js 18 o superior** (recomendado 20 o 22).

```bash
npm install
npm run jugar
```

Esto compila el juego y arranca el servidor. En la terminal aparecen dos direcciones:

- **En este equipo:** http://localhost:3000. Ábrela en el computador conectado a la TV.
- **En la red local:** http://192.168.x.x:3000. La pantalla de la mesa la muestra como código QR para los celulares conectados al mismo wifi.

### Mientras programas

```bash
npm run dev
```

Arranca Vite (con recarga en caliente) y el servidor a la vez. Abre http://localhost:5173 para la mesa. Los celulares usan la dirección del QR.

## Comandos

| Comando | Para qué |
| --- | --- |
| `npm run jugar` | Compila y arranca el servidor en el puerto 3000 |
| `npm start` | Arranca el servidor con la versión ya compilada |
| `npm run build` | Revisa los tipos y genera `dist/` |
| `npm run build:web` | Genera solo el frontend (lo usa Vercel) |
| `npm run simular` | Simula 300 partidas entre IAs y muestra estadísticas de balance (`npm run simular -- 1000` para más) |

## Cómo arrancar una partida

1. En el computador conectado a la TV, abre el juego y toca **Abrir la mesa**. Aparecen un código QR y un código de 4 letras.
2. Cada jugador escanea el QR (o entra a la dirección y escribe el código), pone su nombre y elige su personaje.
3. El primero en entrar es el anfitrión: desde su celular puede dejar puestos a la IA y toca **Comenzar partida**. Los puestos libres se quitan solos.

**La pantalla grande** muestra:
- el mapa con la ficha de cada jugador;
- los mazos, las herramientas y los apoyos;
- el combate en vivo;
- los dichos y eventos;
- el pueblo de cada jugador.

Las cartas jugadas cruzan volando desde el pueblo del jugador hasta el mapa o el panel de combate. Cada mito aparece en grande con un destello del color de su nivel. Los dados ruedan por la mesa y el resultado cae como un sello: «¡Victoria!» con rayos, cortes y monedas, o «¡Derrota!» con grietas y una sacudida de la pantalla.

**El celular** es tu mano privada: ves tus cartas en abanico, las tocas para verlas en grande y las juegas. Al jugarlas, la carta sale disparada hacia arriba, «a la mesa». En combate, el mito se sacude con cada golpe y el resultado aparece como un sello. Cuando puedes reaccionar al turno de otro (sabotear, «Mató el tigre…»), el celular te avisa con una cuenta regresiva de 15 segundos.

Otros detalles:
- **Reconexión:** si la TV o un celular se recargan, vuelven solos a la partida.
- **Desconexiones:** si un jugador se desconecta, el anfitrión puede reemplazarlo por la IA.
- **Autoridad del servidor:** valida cada jugada y a cada dispositivo le envía solo lo que puede ver.
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
4. Abre `https://tu-servicio.onrender.com` en la TV. El QR ya apunta a esa dirección.

En el plan gratuito, Render apaga el servicio tras unos 15 minutos sin uso. La primera visita puede tardar hasta un minuto en despertarlo; la pantalla de carga lo avisa.

### Opción B — Frontend en Vercel + servidor en Render

Vercel no mantiene conexiones WebSocket, así que el servidor de partidas sigue en Render y Vercel solo sirve las páginas.

1. Despliega primero la opción A para tener el servidor en Render. Anota su URL.
2. En Vercel: **Add New → Project** e importa el mismo repositorio. `vercel.json` ya define el build (`npm run build:web`) y la carpeta `dist`.
3. En **Settings → Environment Variables** agrega `VITE_SERVER_URL=https://tu-servicio.onrender.com` (sin barra final) y vuelve a desplegar. Mira `.env.example`.
4. Abre la URL de Vercel en la TV. Los celulares se conectan al servidor de Render. El CORS ya está abierto.

## Sonido

Todos los sonidos se sintetizan en el navegador con Web Audio, sin archivos: dados, cartas, monedas, martillazos al construir, el encuentro con cada mito (más grave con los épicos y ancestrales), victoria, derrota, eventos y una fanfarria final. La música es de cuerdas pulsadas tipo tiple: un bambuco en Re mayor en el pueblo y un tema lento en Si menor en el Monte. El botón 🔊 permite apagar o ajustar la música y los efectos por separado.

## Reglas

- De 2 a 4 jugadores; cada puesto puede ser una persona o la IA.
- Todos empiezan sin oro, materiales ni cartas.
- El botón **Cómo jugar** tiene un resumen; el reglamento completo es el documento consolidado.

## Estructura

```text
src/
  game/data.ts      Todas las cartas: mitos, dichos, exageraciones, equipo, comida, eventos, personajes
  game/engine.ts    Motor de reglas puro (sin React): turnos, combate, castigos, habilidades, victoria
  game/ai.ts        IA heurística
  components/       Pantallas: inicio, configuración, tablero, combate, cartas y ventanas
  components/Mesa.tsx      Modo mesa: pantalla grande (sala de espera con QR y tablero)
  components/Celular.tsx   Modo mesa: el celular como mano y control
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

- Sin recursos iniciales: mediana de 11 rondas por partida (el valor inicial se cambia en `INICIO`, en `src/game/engine.ts`).
- Don José María (44 %) y Doña Clementina (42 %) ganan más seguido; Don Jairo (24 %), Doña Claudia (28 %) y Don Wilson (27 %) menos. Conviene confirmarlo en mesa antes de ajustar habilidades.
