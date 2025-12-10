# <h1 align="center">WhatsApp Backup Reader</h1>

<p align="center">
  <img src="src/lib/assets/favicon.svg" width="100" height="100" alt="WhatsApp Backup Reader" />
</p>

<p align="center">
  <strong>Blader door je WhatsApp exports offline. Je gegevens blijven op je apparaat.</strong>
</p>

<p align="center">
  <a href="README.md">English</a> •
  <a href="README.pt.md">Português</a> •
  <a href="README.es.md">Español</a> •
  <a href="README.fr.md">Français</a> •
  <a href="README.de.md">Deutsch</a> •
  <a href="README.it.md">Italiano</a> •
  <strong>Nederlands</strong> •
  <a href="README.ja.md">日本語</a> •
  <a href="README.zh.md">中文</a> •
  <a href="README.ru.md">Русский</a>
</p>

---

## Wat doet het?

Sleep een `.zip` bestand geëxporteerd vanuit WhatsApp en blader door je berichten, foto's en spraakberichten. Werkt met grote chats (getest met meer dan 10k berichten).

Spraakberichten kunnen worden getranscribeerd met [Whisper](https://openai.com/research/whisper), dat in je browser draait via WebGPU. Geen server, geen API-sleutel nodig.

## Functies

- **Spraaktranscriptie**: Transcribeer audio met Whisper (draait lokaal, meer dan 12 talen)
- **Zoeken**: Volledige tekstzoekopdracht in berichten en transcripties
- **Bladwijzers**: Bewaar berichten met notities, exporteer/importeer als JSON
- **Perspectiefmodus**: Bekijk de chat als elke deelnemer
- **Statistieken**: Berichtenaantallen, activiteitsgrafieken, tijdlijn
- **Donkere modus**: Volgt systeem of schakel handmatig (voorkeur opgeslagen)
- **Meertalige UI**: Engels, Portugees, Spaans, Frans, Duits, Italiaans, Nederlands, Japans, Chinees, Russisch
- **Desktop app**: macOS, Windows, Linux via Electron

## Snelstart

### Vereisten

Je hebt [Node.js](https://nodejs.org/) nodig (versie 18 of hoger).

```bash
node --version
```

### De app uitvoeren

```bash
npm install
npm run dev
```

Open [localhost:5173](http://localhost:5173) in je browser en sleep je WhatsApp `.zip` bestand.

### Desktop app (optioneel)

```bash
npm run electron:dev    # uitvoeren in ontwikkelmodus
npm run electron:build  # maak een installer voor je OS
```

## Hoe te Exporteren vanuit WhatsApp

### iPhone
1. Open WhatsApp en ga naar een chat
2. Tik op de naam van het contact of de groep bovenaan het scherm
3. Scroll naar beneden en tik op **Chat Exporteren**
4. Kies **Media Bijvoegen** om foto's, video's en spraakberichten op te nemen
5. Bewaar het bestand (je kunt AirDrop gebruiken, opslaan in Bestanden of emailen)

### Android
1. Open WhatsApp en ga naar een chat
2. Tik op de drie punten **⋮** rechtsboven
3. Tik op **Meer** → **Chat exporteren**
4. Kies **Media opnemen**
5. Bewaar of deel het `.zip` bestand naar je computer

## Privacy & Beveiliging

Deze app is ontworpen met privacy als topprioriteit. Je WhatsApp-gegevens verlaten nooit je apparaat.

### Waarom het veilig is

- **100% Offline**: De app werkt volledig zonder internet
- **Lokale Verwerking**: Alle analyse, zoeken en verwerking gebeurt in je browser
- **Lokale AI**: Spraaktranscriptie gebruikt Whisper dat lokaal draait via WebGPU
- **Geen Tracking**: Geen analytics, telemetrie of scripts van derden
- **Geen account vereist**: Geen registratie, geen login
- **Open Source**: Alle code is publiek onder AGPL-3.0 licentie

## Ontwikkelscripts

| Commando | Beschrijving |
|---------|-------------|
| `npm run dev` | Start ontwikkelserver |
| `npm run build` | Bouwen voor productie |
| `npm run check` | Type controle met svelte-check |
| `npm run lint` | Linter met Biome |
| `npm run electron:dev` | Voer Electron uit in ontwikkelmodus |
| `npm run electron:build` | Bouw Electron installer |

## Gebouwd met

- [SvelteKit](https://kit.svelte.dev) + [Svelte 5](https://svelte.dev) - Framework
- [Tailwind CSS 4](https://tailwindcss.com) - Styling
- [Electron](https://electronjs.org) - Desktop app
- [Transformers.js](https://huggingface.co/docs/transformers.js) - Whisper AI voor transcriptie
- [JSZip](https://stuk.github.io/jszip/) - ZIP bestandsverwerking

## Bijdragen

Een bug gevonden of een idee? [Open een issue](https://github.com/rodrigogs/whats-reader/issues) op GitHub.

Wil je code bijdragen? Fork de repo, maak je wijzigingen en open een pull request.

## Licentie

[AGPL-3.0](LICENSE). Je kunt deze software vrij gebruiken, wijzigen en distribueren. Als je het wijzigt en als service draait of distribueert, moet je je broncode delen onder dezelfde licentie.
