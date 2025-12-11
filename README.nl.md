<h1 align="center">WhatsApp Backup Reader</h1>

<p align="center">
  <img src="src/lib/assets/favicon.svg" width="100" height="100" alt="WhatsApp Backup Reader" />
</p>

<p align="center">
  <strong>Blader door je WhatsApp exports offline. Je gegevens blijven op je apparaat.</strong>
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
  <a href="README.es.md">Español</a> •
  <a href="README.fr.md">Français</a> •
  <a href="README.de.md">Deutsch</a> •
  <a href="README.it.md">Italiano</a> •
  <strong>Nederlands</strong> •
  <a href="README.ja.md">日本語</a> •
  <a href="README.zh.md">中文</a> •
  <a href="README.ru.md">Русский</a>
</p>

<p align="center">
  <a href="#functies">Functies</a> •
  <a href="#snelstart">Snelstart</a> •
  <a href="#hoe-te-exporteren-vanuit-whatsapp">Exporteer Gids</a> •
  <a href="#privacy--beveiliging">Privacy</a> •
  <a href="#bijdragen">Bijdragen</a>
</p>

---

## Wat doet het?

Sleep een `.zip` bestand geëxporteerd vanuit WhatsApp en blader door je berichten, foto's en spraakberichten. Werkt met grote chats (getest met meer dan 10k berichten).

Spraakberichten kunnen worden getranscribeerd met [Whisper](https://openai.com/research/whisper), dat in je browser draait via WebGPU. Geen server, geen API-sleutel nodig.

<details>
<summary>Screenshots</summary>
<br>

| Startscherm | Chatweergave |
|:---:|:---:|
| <img src="examples/images/1-start.png" width="400" /> | <img src="examples/images/2-chats.png" width="400" /> |

| Chat Opties | Perspectiefmodus |
|:---:|:---:|
| <img src="examples/images/3-chat-options.png" width="400" /> | <img src="examples/images/4-view-as.png" width="400" /> |

| Bladwijzers | Statistieken |
|:---:|:---:|
| <img src="examples/images/5-bookmarks.png" width="400" /> | <img src="examples/images/6-statistics.png" width="400" /> |

| Spraaktranscriptie |
|:---:|
| <img src="examples/images/7-audio-transcription.png" width="400" /> |

</details>

---

## Download

Download de app voor jouw platform:

### Windows
- Download **WhatsApp-Backup-Reader-Setup-{version}.exe** van de [nieuwste versie](https://github.com/rodrigogs/whats-reader/releases/latest)
- Voer het installatieprogramma uit en volg de installatiewizard
- De app wordt automatisch bijgewerkt wanneer nieuwe versies beschikbaar zijn

### macOS
- **Apple Silicon (M1/M2/M3)**: Download **WhatsApp-Backup-Reader-{version}-arm64.dmg**
- **Intel**: Download **WhatsApp-Backup-Reader-{version}.dmg**
- Open het DMG-bestand en sleep de app naar Programma's
- Bij de eerste start, klik met de rechtermuisknop op de app en selecteer "Open" om Gatekeeper te omzeilen

### Linux
- **Debian/Ubuntu**: Download **whats-reader_{version}_amd64.deb** of **whats-reader_{version}_arm64.deb**
  ```bash
  sudo dpkg -i whats-reader_{version}_amd64.deb
  ```
- **Fedora/RHEL**: Download **whats-reader-{version}.x86_64.rpm** of **whats-reader-{version}.aarch64.rpm**
  ```bash
  sudo rpm -i whats-reader-{version}.x86_64.rpm
  ```

> **Of gebruik de webversie**: Bezoek [rodrigogs.github.io/whats-reader](https://rodrigogs.github.io/whats-reader) - geen installatie vereist!

---

## Functies

- **Spraaktranscriptie**: Transcribeer audio met Whisper (draait lokaal, meer dan 12 talen)
- **Zoeken**: Volledige tekstzoekopdracht in berichten en transcripties
- **Bladwijzers**: Bewaar berichten met notities, exporteer/importeer als JSON
- **Perspectiefmodus**: Bekijk de chat als elke deelnemer
- **Statistieken**: Berichtenaantallen, activiteitsgrafieken, tijdlijn
- **Donkere modus**: Volgt systeem of schakel handmatig (voorkeur opgeslagen)
- **Meertalige UI**: Engels, Portugees, Spaans, Frans, Duits, Italiaans, Nederlands, Japans, Chinees, Russisch
- **Desktop app**: macOS, Windows, Linux via Electron

---

## Snelstart

### Vereisten

Je hebt [Node.js](https://nodejs.org/) nodig (versie 18 of hoger). Download het van [nodejs.org](https://nodejs.org/) en voer het installatieprogramma uit.

Om te controleren of je het hebt:
```bash
node --version
```

### De app uitvoeren

1. Kloon of download dit project
2. Open een terminal in de projectmap
3. Voer deze commando's uit:

```bash
npm install
npm run dev
```

4. Open [localhost:5173](http://localhost:5173) in je browser
5. Sleep je WhatsApp `.zip` bestand naar de pagina

### Desktop app (optioneel)

Als je een standalone app prefereert in plaats van je browser te gebruiken:

```bash
npm run electron:dev    # uitvoeren in ontwikkelmodus
npm run electron:build  # maak een installer voor je OS
```

Platformspecifieke builds:
```bash
npm run electron:build:mac    # macOS (dmg, zip)
npm run electron:build:win    # Windows (nsis, portable)
npm run electron:build:linux  # Linux (AppImage, deb)
```

---

## Hoe te Exporteren vanuit WhatsApp

Eerst moet je een chat exporteren vanuit WhatsApp op je telefoon. Dit maakt een `.zip` bestand met je berichten en media.

### iPhone
1. Open WhatsApp en ga naar een chat
2. Tik op de naam van het contact of de groep bovenaan het scherm
3. Scroll naar beneden en tik op **Chat Exporteren**
4. Kies **Media Bijvoegen** om foto's, video's en spraakberichten op te nemen
5. Bewaar het bestand (je kunt AirDrop gebruiken naar je Mac, opslaan in Bestanden of emailen naar jezelf)

### Android
1. Open WhatsApp en ga naar een chat
2. Tik op de drie punten **⋮** rechtsboven
3. Tik op **Meer** → **Chat exporteren**
4. Kies **Media opnemen**
5. Bewaar of deel het `.zip` bestand naar je computer

### Tips
- Grote chats kunnen een paar minuten duren om te exporteren
- Het bestand heet zoiets als `WhatsApp Chat with John.zip`
- Zowel individuele als groepschats werken

---

## Privacy & Beveiliging

Deze app is ontworpen met privacy als topprioriteit. Je WhatsApp-gegevens verlaten nooit je apparaat.

### Waarom het veilig is

- **100% Offline**: De app werkt volledig zonder internet. Geen servers, geen cloud, geen gegevensoverdracht.
- **Lokale Verwerking**: Alle analyse, zoeken en verwerking gebeurt in je browser of Electron app.
- **Lokale AI**: Spraaktranscriptie gebruikt [Whisper](https://openai.com/research/whisper) dat lokaal draait via WebGPU. Geen audio wordt naar servers of API's gestuurd.
- **Geen Tracking**: Geen analytics, telemetrie of scripts van derden. Geen Google Analytics, geen cookies.
- **Geen account vereist**: Geen registratie, geen login, geen persoonlijke gegevens verzameld.
- **Open Source**: De volledige codebase is publiek onder [AGPL-3.0](LICENSE). Iedereen kan het controleren.

### Hoe te verifiëren

Vertrouw ons niet zomaar. Verifieer het zelf:

1. **Lees de broncode**  
   Bekijk de [GitHub repository](https://github.com/rodrigogs/whats-reader). De hoofdlogica staat in `src/lib/` en `src/routes/`.

2. **Controleer netwerkaanvragen**  
   Open de DevTools van de browser (F12) → Network tab → Gebruik de app. Je ziet **nul externe verzoeken** (behalve initiële paginaload bij webversie).

3. **Test offline**  
   Verbreek de internetverbinding en gebruik dan de app. Alles werkt omdat niets een verbinding vereist.

4. **Bouw vanuit bron**  
   Kloon de repo en bouw het zelf:
   ```bash
   git clone https://github.com/rodrigogs/whats-reader.git
   cd whats-reader
   npm install
   npm run build
   ```

5. **Controleer de Electron app**  
   De desktop app gebruikt dezelfde webcode. Controleer `electron/main.cjs` en `electron/preload.cjs`. Ze behandelen alleen vensterbeheer en bestandsdialogen.

---

## Ontwikkeling

### Scripts

| Commando | Beschrijving |
|---------|-------------|
| `npm run dev` | Start ontwikkelserver op [localhost:5173](http://localhost:5173) |
| `npm run build` | Bouwen voor productie |
| `npm run preview` | Voorbeeld van productiebuild |
| `npm run check` | Type controle met svelte-check |
| `npm run check:watch` | Type controle in watch modus |
| `npm run lint` | Linter met Biome |
| `npm run lint:fix` | Auto-fix lint problemen |
| `npm run format` | Formatteer code met Biome |
| `npm run electron` | Bouw en voer Electron app uit |
| `npm run electron:dev` | Voer Electron uit in ontwikkelmodus |
| `npm run electron:build` | Bouw Electron installer |
| `npm run electron:build:mac` | Bouw voor macOS |
| `npm run electron:build:win` | Bouw voor Windows |
| `npm run electron:build:linux` | Bouw voor Linux |
| `npm run machine-translate` | Auto-vertalen met inlang |

### Vertalingen toevoegen

Vertalingsbestanden staan in `messages/`. Om een nieuwe taal toe te voegen:
1. Kopieer `messages/en.json` naar `messages/{locale}.json`
2. Vertaal de strings
3. Voeg de locale toe aan `project.inlang/settings.json`

---

## Gebouwd met

- [SvelteKit](https://kit.svelte.dev) + [Svelte 5](https://svelte.dev) - Framework
- [Tailwind CSS 4](https://tailwindcss.com) - Styling
- [Electron](https://electronjs.org) - Desktop app
- [Transformers.js](https://huggingface.co/docs/transformers.js) - Whisper AI voor transcriptie
- [JSZip](https://stuk.github.io/jszip/) - ZIP bestandsverwerking
- [Paraglide JS](https://inlang.com/m/gerre34r/library-inlang-paraglideJs) - Internationalisatie

---

## Bijdragen

Een bug gevonden of een idee? [Open een issue](https://github.com/rodrigogs/whats-reader/issues) op GitHub.

Wil je code bijdragen? Fork de repo, maak je wijzigingen en open een pull request.

Er zijn voorbeeldchatbestanden in `examples/chats/` die je kunt gebruiken voor testen.

---

## Licentie

[AGPL-3.0](LICENSE). Je kunt deze software vrij gebruiken, wijzigen en distribueren. Als je het wijzigt en als service draait of distribueert, moet je je broncode delen onder dezelfde licentie.
