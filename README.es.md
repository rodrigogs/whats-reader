<h1 align="center">Lector de Respaldo de WhatsApp</h1>

<p align="center">
  <img src="src/lib/assets/favicon.svg" width="100" height="100" alt="Lector de Respaldo de WhatsApp" />
</p>

<p align="center">
  <strong>Navega tus exportaciones de WhatsApp sin conexión. Tus datos permanecen en tu dispositivo.</strong>
</p>

<p align="center">
  <a href="https://github.com/rodrigogs/whats-reader/releases/latest"><img src="https://img.shields.io/github/v/release/rodrigogs/whats-reader?style=flat-square&color=blue" alt="Latest Release" /></a>
  <a href="https://github.com/rodrigogs/whats-reader/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/rodrigogs/whats-reader/ci.yml?branch=dev&style=flat-square&label=CI" alt="CI Status" /></a>
  <a href="https://github.com/rodrigogs/whats-reader/blob/main/LICENSE"><img src="https://img.shields.io/github/license/rodrigogs/whats-reader?style=flat-square" alt="License" /></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Svelte-5-FF3E00?style=flat-square&logo=svelte&logoColor=white" alt="Svelte 5" />
  <img src="https://img.shields.io/badge/Electron-39-47848F?style=flat-square&logo=electron&logoColor=white" alt="Electron 39" />
  <img src="https://img.shields.io/badge/AI-Whisper_(local)-00A67E?style=flat-square&logo=openai&logoColor=white" alt="Local Whisper AI" />
  <img src="https://img.shields.io/badge/Privacy-100%25_offline-4CAF50?style=flat-square&logo=shield&logoColor=white" alt="100% Offline" />
</p>

<p align="center">
  <a href="README.md">English</a> •
  <a href="README.pt.md">Português</a> •
  <strong>Español</strong> •
  <a href="README.fr.md">Français</a> •
  <a href="README.de.md">Deutsch</a> •
  <a href="README.it.md">Italiano</a> •
  <a href="README.nl.md">Nederlands</a> •
  <a href="README.ja.md">日本語</a> •
  <a href="README.zh.md">中文</a> •
  <a href="README.ru.md">Русский</a>
</p>

<p align="center">
  <a href="#características">Características</a> •
  <a href="#inicio-rápido">Inicio Rápido</a> •
  <a href="#cómo-exportar-desde-whatsapp">Guía de Exportación</a> •
  <a href="#privacidad-y-seguridad">Privacidad</a> •
  <a href="#contribuir">Contribuir</a>
</p>

---

## ¿Qué hace?

Arrastra un archivo `.zip` exportado de WhatsApp y navega por tus mensajes, fotos y notas de voz. Funciona con chats grandes (probado con más de 10k mensajes).

La **Galería de Medios** te ofrece una vista visual de todas las fotos, vídeos y archivos de audio organizados por fecha. Selecciona varios elementos y descárgalos como archivo ZIP, o haz clic en cualquier medio para verlo en pantalla completa y saltar al mensaje original.

Los mensajes de voz pueden ser transcritos usando [Whisper](https://openai.com/research/whisper), que se ejecuta en tu navegador vía WebGPU. Sin servidor, sin clave API necesaria.

<details>
<summary>Capturas de Pantalla</summary>
<br>

| Pantalla de Inicio | Vista de Chat |
|:---:|:---:|
| <img src="examples/images/1-start.png" width="400" /> | <img src="examples/images/2-chats.png" width="400" /> |

| Opciones de Chat | Modo Perspectiva |
|:---:|:---:|
| <img src="examples/images/3-chat-options.png" width="400" /> | <img src="examples/images/4-view-as.png" width="400" /> |

| Marcadores | Estadísticas |
|:---:|:---:|
| <img src="examples/images/5-bookmarks.png" width="400" /> | <img src="examples/images/6-statistics.png" width="400" /> |

| Transcripción de Voz | Galería de Medios |
|:---:|:---:|
| <img src="examples/images/7-audio-transcription.png" width="400" /> | _Próximamente_ |

</details>

---

## Descargar

Descarga la aplicación para tu plataforma:

### Windows
- Descarga **WhatsApp-Backup-Reader-Setup-{version}.exe** de la [última versión](https://github.com/rodrigogs/whats-reader/releases/latest)
- Ejecuta el instalador y sigue el asistente de configuración
- La app se actualizará automáticamente cuando haya nuevas versiones

### macOS
- **Apple Silicon (M1/M2/M3)**: Descarga **WhatsApp-Backup-Reader-{version}-arm64.dmg**
- **Intel**: Descarga **WhatsApp-Backup-Reader-{version}.dmg**
- Abre el archivo DMG y arrastra la app a Aplicaciones
- En el primer inicio, haz clic derecho en la app y selecciona "Abrir" para pasar Gatekeeper

### Linux
- **Debian/Ubuntu**: Descarga **whats-reader_{version}_amd64.deb** o **whats-reader_{version}_arm64.deb**
  ```bash
  sudo dpkg -i whats-reader_{version}_amd64.deb
  ```
- **Fedora/RHEL**: Descarga **whats-reader-{version}.x86_64.rpm** o **whats-reader-{version}.aarch64.rpm**
  ```bash
  sudo rpm -i whats-reader-{version}.x86_64.rpm
  ```
- **Otras distros (Arch, etc.)**: Descarga **WhatsApp-Backup-Reader-{version}.AppImage**
  ```bash
  chmod +x WhatsApp-Backup-Reader-{version}.AppImage
  ./WhatsApp-Backup-Reader-{version}.AppImage
  ```

> **O usa la versión web**: Visita [rodrigogs.github.io/whats-reader](https://rodrigogs.github.io/whats-reader) - ¡sin instalación!

---

## Características

- **Galería de Medios**: Navega por todas las fotos, vídeos y audio en una cuadrícula de miniaturas
  - Organización por fecha con navegación de calendario
  - Selección masiva y descarga como ZIP
  - Vista previa en lightbox con navegación al mensaje original
- **Transcripción de voz**: Transcribe audio con Whisper (se ejecuta localmente, más de 12 idiomas)
- **Búsqueda**: Búsqueda de texto completo en mensajes y transcripciones
- **Marcadores**: Guarda mensajes con notas, exporta/importa como JSON
- **Modo perspectiva**: Ve el chat como cualquier participante
- **Estadísticas**: Conteo de mensajes, gráficos de actividad, línea de tiempo
- **Modo oscuro**: Sigue el sistema o cambia manualmente (preferencia guardada)
- **Interfaz multilingüe**: Inglés, Portugués, Español, Francés, Alemán, Italiano, Holandés, Japonés, Chino, Ruso
- **Aplicación de escritorio**: macOS, Windows, Linux vía Electron

---

## Inicio Rápido

### Requisitos Previos

Necesitas [Node.js](https://nodejs.org/) instalado (versión 18 o posterior). Descárgalo desde [nodejs.org](https://nodejs.org/) y ejecuta el instalador.

Para verificar si lo tienes:
```bash
node --version
```

### Ejecutar la aplicación

1. Clona o descarga este proyecto
2. Abre una terminal en la carpeta del proyecto
3. Ejecuta estos comandos:

```bash
npm install
npm run dev
```

4. Abre [localhost:5173](http://localhost:5173) en tu navegador
5. Arrastra tu archivo `.zip` de WhatsApp a la página

### Aplicación de escritorio (opcional)

Si prefieres una aplicación independiente en lugar de usar tu navegador:

```bash
npm run electron:dev    # ejecutar en modo desarrollo
npm run electron:build  # crear instalador para tu SO
```

Compilaciones específicas por plataforma:
```bash
npm run electron:build:mac    # macOS (dmg, zip)
npm run electron:build:win    # Windows (nsis, portable)
npm run electron:build:linux  # Linux (deb, rpm, AppImage)
```

---

## Cómo Exportar desde WhatsApp

Primero, necesitas exportar un chat desde WhatsApp en tu teléfono. Esto crea un archivo `.zip` que contiene tus mensajes y medios.

### iPhone
1. Abre WhatsApp y ve a cualquier chat
2. Toca el nombre del contacto o grupo en la parte superior de la pantalla
3. Desplázate hacia abajo y toca **Exportar Chat**
4. Elige **Adjuntar Medios** para incluir fotos, videos y mensajes de voz
5. Guarda el archivo (puedes usar AirDrop a tu Mac, guardar en Archivos o enviarlo por correo a ti mismo)

### Android
1. Abre WhatsApp y ve a cualquier chat
2. Toca los tres puntos **⋮** en la esquina superior derecha
3. Toca **Más** → **Exportar chat**
4. Elige **Incluir medios**
5. Guarda o comparte el archivo `.zip` a tu computadora

### Consejos
- Los chats grandes pueden tardar unos minutos en exportarse
- El archivo se llamará algo como `WhatsApp Chat with John.zip`
- Funcionan tanto chats individuales como grupales

---

## Privacidad y Seguridad

Esta aplicación está diseñada con la privacidad como máxima prioridad. Tus datos de WhatsApp nunca abandonan tu dispositivo.

### Por qué es seguro

- **100% Sin Conexión**: La aplicación funciona completamente sin internet. Sin servidores, sin nube, sin transmisión de datos.
- **Procesamiento Local**: Todo el análisis, búsqueda y análisis ocurre en tu navegador o aplicación Electron.
- **IA Local**: La transcripción de voz usa [Whisper](https://openai.com/research/whisper) ejecutándose localmente vía WebGPU. No se envía audio a ningún servidor o API.
- **Sin Rastreo**: Cero analíticas, telemetría o scripts de terceros. Sin Google Analytics, sin cookies.
- **Sin cuenta requerida**: Sin registro, sin inicio de sesión, sin recopilación de datos personales.
- **Código Abierto**: El código completo es público bajo [AGPL-3.0](LICENSE). Cualquiera puede auditarlo.

### Cómo verificar

No solo confíes en nosotros. Veríficalo tú mismo:

1. **Lee el código fuente**  
   Navega por el [repositorio de GitHub](https://github.com/rodrigogs/whats-reader). La lógica principal está en `src/lib/` y `src/routes/`.

2. **Verifica las solicitudes de red**  
   Abre las DevTools del navegador (F12) → pestaña Network → Usa la aplicación. Verás **cero solicitudes externas** (excepto la carga inicial de la página si usas la versión web).

3. **Prueba sin conexión**  
   Desconéctate de internet, luego usa la aplicación. Todo funciona porque nada requiere conexión.

4. **Compila desde el código fuente**  
   Clona el repositorio y compílalo tú mismo:
   ```bash
   git clone https://github.com/rodrigogs/whats-reader.git
   cd whats-reader
   npm install
   npm run build
   ```

5. **Audita la aplicación Electron**  
   La aplicación de escritorio usa el mismo código web. Revisa `electron/main.cjs` y `electron/preload.cjs`. Solo manejan la gestión de ventanas y diálogos de archivos.

---

## Desarrollo

### Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Iniciar servidor de desarrollo en [localhost:5173](http://localhost:5173) |
| `npm run build` | Compilar para producción |
| `npm run preview` | Vista previa de compilación de producción |
| `npm run check` | Verificación de tipos con svelte-check |
| `npm run check:watch` | Verificación de tipos en modo watch |
| `npm run lint` | Linter con Biome |
| `npm run lint:fix` | Corregir automáticamente problemas de lint |
| `npm run format` | Formatear código con Biome |
| `npm run electron` | Compilar y ejecutar aplicación Electron |
| `npm run electron:dev` | Ejecutar Electron en modo desarrollo |
| `npm run electron:build` | Compilar instalador Electron |
| `npm run electron:build:mac` | Compilar para macOS |
| `npm run electron:build:win` | Compilar para Windows |
| `npm run electron:build:linux` | Compilar para Linux |
| `npm run machine-translate` | Auto-traducir con inlang |

### Agregar traducciones

Los archivos de traducción están en `messages/`. Para agregar un nuevo idioma:
1. Copia `messages/en.json` a `messages/{locale}.json`
2. Traduce las cadenas
3. Agrega el locale a `project.inlang/settings.json`

---

## Construido con

- [SvelteKit](https://kit.svelte.dev) + [Svelte 5](https://svelte.dev) - Framework
- [Tailwind CSS 4](https://tailwindcss.com) - Estilos
- [Electron](https://electronjs.org) - Aplicación de escritorio
- [Transformers.js](https://huggingface.co/docs/transformers.js) - IA Whisper para transcripción
- [JSZip](https://stuk.github.io/jszip/) - Manejo de archivos ZIP
- [Paraglide JS](https://inlang.com/m/gerre34r/library-inlang-paraglideJs) - Internacionalización

---

## Contribuir

¿Encontraste un error o tienes una idea? [Abre un issue](https://github.com/rodrigogs/whats-reader/issues) en GitHub.

¿Quieres contribuir con código? Haz fork del repositorio, realiza tus cambios y abre un pull request.

Hay archivos de chat de ejemplo en `examples/chats/` que puedes usar para pruebas.

---

## Licencia

[AGPL-3.0](LICENSE). Puedes usar, modificar y distribuir este software libremente. Si lo modificas y lo ejecutas como servicio o lo distribuyes, debes compartir tu código fuente bajo la misma licencia.
