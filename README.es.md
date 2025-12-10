# <h1 align="center">Lector de Respaldo de WhatsApp</h1>

<p align="center">
  <img src="src/lib/assets/favicon.svg" width="100" height="100" alt="Lector de Respaldo de WhatsApp" />
</p>

<p align="center">
  <strong>Navega tus exportaciones de WhatsApp sin conexión. Tus datos permanecen en tu dispositivo.</strong>
</p>

<p align="center">
  <a href="README.md">English</a> •
  <a href="README.pt.md">Português</a> •
  <strong>Español</strong> •
  <a href="README.fr.md">Français</a> •
  <a href="README.de.md">Deutsch</a>
</p>

---

## ¿Qué hace?

Arrastra un archivo `.zip` exportado de WhatsApp y navega por tus mensajes, fotos y notas de voz. Funciona con chats grandes (probado con más de 10k mensajes).

Los mensajes de voz pueden ser transcritos usando [Whisper](https://openai.com/research/whisper), que se ejecuta en tu navegador vía WebGPU. Sin servidor, sin clave API necesaria.

## Características

- **Transcripción de voz**: Transcribe audio con Whisper (se ejecuta localmente, más de 12 idiomas)
- **Búsqueda**: Búsqueda de texto completo en mensajes y transcripciones
- **Marcadores**: Guarda mensajes con notas, exporta/importa como JSON
- **Modo perspectiva**: Ve el chat como cualquier participante
- **Estadísticas**: Conteo de mensajes, gráficos de actividad, línea de tiempo
- **Modo oscuro**: Sigue el sistema o cambia manualmente (preferencia guardada)
- **IU multiidioma**: Inglés, Portugués, Español, Francés, Alemán, Italiano, Holandés, Japonés, Chino, Ruso
- **Aplicación de escritorio**: macOS, Windows, Linux vía Electron

## Inicio Rápido

### Requisitos Previos

Necesitas [Node.js](https://nodejs.org/) instalado (versión 18 o posterior).

```bash
node --version
```

### Ejecutar la aplicación

```bash
npm install
npm run dev
```

Abre [localhost:5173](http://localhost:5173) en tu navegador y arrastra tu archivo `.zip` de WhatsApp.

### Aplicación de escritorio (opcional)

```bash
npm run electron:dev    # ejecutar en modo desarrollo
npm run electron:build  # crear instalador para tu SO
```

## Cómo Exportar desde WhatsApp

### iPhone
1. Abre WhatsApp y ve a cualquier chat
2. Toca el nombre del contacto o grupo en la parte superior
3. Desplázate hacia abajo y toca **Exportar Chat**
4. Elige **Adjuntar Medios** para incluir fotos, videos y mensajes de voz
5. Guarda el archivo (puedes usar AirDrop, guardar en Archivos o enviarlo por correo)

### Android
1. Abre WhatsApp y ve a cualquier chat
2. Toca los tres puntos **⋮** en la esquina superior derecha
3. Toca **Más** → **Exportar chat**
4. Elige **Incluir medios**
5. Guarda o comparte el archivo `.zip` a tu computadora

## Privacidad y Seguridad

Esta aplicación está diseñada con la privacidad como máxima prioridad. Tus datos de WhatsApp nunca abandonan tu dispositivo.

### Por qué es seguro

- **100% Sin Conexión**: La aplicación funciona completamente sin internet
- **Procesamiento Local**: Todo el análisis, búsqueda y análisis ocurre en tu navegador
- **IA Local**: La transcripción de voz usa Whisper ejecutándose localmente vía WebGPU
- **Sin Rastreo**: Cero analíticas, telemetría o scripts de terceros
- **Sin cuenta requerida**: Sin registro, sin inicio de sesión
- **Código Abierto**: Todo el código es público bajo licencia AGPL-3.0

## Scripts de Desarrollo

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Iniciar servidor de desarrollo |
| `npm run build` | Compilar para producción |
| `npm run preview` | Vista previa de compilación de producción |
| `npm run check` | Verificación de tipos con svelte-check |
| `npm run lint` | Linter con Biome |
| `npm run format` | Formatear código con Biome |
| `npm run electron:dev` | Ejecutar Electron en modo desarrollo |
| `npm run electron:build` | Compilar instalador Electron |

## Construido con

- [SvelteKit](https://kit.svelte.dev) + [Svelte 5](https://svelte.dev) - Framework
- [Tailwind CSS 4](https://tailwindcss.com) - Estilos
- [Electron](https://electronjs.org) - Aplicación de escritorio
- [Transformers.js](https://huggingface.co/docs/transformers.js) - IA Whisper para transcripción
- [JSZip](https://stuk.github.io/jszip/) - Manejo de archivos ZIP

## Contribuir

¿Encontraste un error o tienes una idea? [Abre un issue](https://github.com/rodrigogs/whats-reader/issues) en GitHub.

¿Quieres contribuir con código? Haz fork del repositorio, realiza tus cambios y abre un pull request.

## Licencia

[AGPL-3.0](LICENSE). Puedes usar, modificar y distribuir este software libremente. Si lo modificas y lo ejecutas como servicio o lo distribuyes, debes compartir tu código fuente bajo la misma licencia.
