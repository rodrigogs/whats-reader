<h1 align="center">Lecteur de Sauvegarde WhatsApp</h1>

<p align="center">
  <img src="src/lib/assets/favicon.svg" width="100" height="100" alt="Lecteur de Sauvegarde WhatsApp" />
</p>

<p align="center">
  <strong>Parcourez vos exportations WhatsApp hors ligne. Vos données restent sur votre appareil.</strong>
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
  <strong>Français</strong> •
  <a href="README.de.md">Deutsch</a> •
  <a href="README.it.md">Italiano</a> •
  <a href="README.nl.md">Nederlands</a> •
  <a href="README.ja.md">日本語</a> •
  <a href="README.zh.md">中文</a> •
  <a href="README.ru.md">Русский</a>
</p>

<p align="center">
  <a href="#fonctionnalités">Fonctionnalités</a> •
  <a href="#démarrage-rapide">Démarrage Rapide</a> •
  <a href="#comment-exporter-depuis-whatsapp">Guide d'Exportation</a> •
  <a href="#confidentialité-et-sécurité">Confidentialité</a> •
  <a href="#contribuer">Contribuer</a>
</p>

---

## Description

Glissez-déposez un fichier `.zip` exporté de WhatsApp et parcourez vos messages, photos et notes vocales. Fonctionne avec de grandes conversations (testé avec plus de 10k messages).

Les messages vocaux peuvent être transcrits en utilisant [Whisper](https://openai.com/research/whisper), qui s'exécute dans votre navigateur via WebGPU. Aucun serveur, aucune clé API nécessaire.

<details>
<summary>Captures d'écran</summary>
<br>

| Écran de Démarrage | Vue de Conversation |
|:---:|:---:|
| <img src="examples/images/1-start.png" width="400" /> | <img src="examples/images/2-chats.png" width="400" /> |

| Options de Conversation | Mode Perspective |
|:---:|:---:|
| <img src="examples/images/3-chat-options.png" width="400" /> | <img src="examples/images/4-view-as.png" width="400" /> |

| Favoris | Statistiques |
|:---:|:---:|
| <img src="examples/images/5-bookmarks.png" width="400" /> | <img src="examples/images/6-statistics.png" width="400" /> |

| Transcription Vocale |
|:---:|
| <img src="examples/images/7-audio-transcription.png" width="400" /> |

</details>

---

## Fonctionnalités

- **Transcription vocale**: Transcrivez l'audio avec Whisper (fonctionne localement, plus de 12 langues)
- **Recherche**: Recherche en texte intégral dans les messages et transcriptions
- **Favoris**: Sauvegardez des messages avec des notes, exportez/importez au format JSON
- **Mode perspective**: Visualisez la conversation comme n'importe quel participant
- **Statistiques**: Nombre de messages, graphiques d'activité, chronologie
- **Mode sombre**: Suit le système ou bascule manuellement (préférence sauvegardée)
- **Interface multilingue**: Anglais, Portugais, Espagnol, Français, Allemand, Italien, Néerlandais, Japonais, Chinois, Russe
- **Application de bureau**: macOS, Windows, Linux via Electron

---

## Démarrage Rapide

### Prérequis

Vous avez besoin de [Node.js](https://nodejs.org/) installé (version 18 ou ultérieure). Téléchargez-le depuis [nodejs.org](https://nodejs.org/) et exécutez l'installateur.

Pour vérifier si vous l'avez:
```bash
node --version
```

### Exécuter l'application

1. Clonez ou téléchargez ce projet
2. Ouvrez un terminal dans le dossier du projet
3. Exécutez ces commandes:

```bash
npm install
npm run dev
```

4. Ouvrez [localhost:5173](http://localhost:5173) dans votre navigateur
5. Glissez-déposez votre fichier `.zip` WhatsApp sur la page

### Application de bureau (facultatif)

Si vous préférez une application autonome plutôt que d'utiliser votre navigateur:

```bash
npm run electron:dev    # exécuter en mode développement
npm run electron:build  # créer un installateur pour votre OS
```

Builds spécifiques par plateforme:
```bash
npm run electron:build:mac    # macOS (dmg, zip)
npm run electron:build:win    # Windows (nsis, portable)
npm run electron:build:linux  # Linux (AppImage, deb)
```

---

## Comment Exporter depuis WhatsApp

D'abord, vous devez exporter une conversation depuis WhatsApp sur votre téléphone. Cela crée un fichier `.zip` contenant vos messages et médias.

### iPhone
1. Ouvrez WhatsApp et accédez à une conversation
2. Appuyez sur le nom du contact ou du groupe en haut
3. Faites défiler vers le bas et appuyez sur **Exporter la discussion**
4. Choisissez **Joindre les médias** pour inclure photos, vidéos et notes vocales
5. Sauvegardez le fichier (vous pouvez utiliser AirDrop vers votre Mac, sauvegarder dans Fichiers ou envoyer par email)

### Android
1. Ouvrez WhatsApp et accédez à une conversation
2. Appuyez sur les trois points **⋮** en haut à droite
3. Appuyez sur **Plus** → **Exporter la discussion**
4. Choisissez **Inclure les médias**
5. Sauvegardez ou partagez le fichier `.zip` sur votre ordinateur

### Conseils
- Les grandes conversations peuvent prendre quelques minutes à exporter
- Le fichier sera nommé quelque chose comme `WhatsApp Chat with John.zip`
- Les conversations individuelles et de groupe fonctionnent

---

## Confidentialité et Sécurité

Cette application est conçue avec la confidentialité comme priorité absolue. Vos données WhatsApp ne quittent jamais votre appareil.

### Pourquoi c'est sûr

- **100% Hors ligne**: L'application fonctionne complètement sans internet. Aucun serveur, aucun cloud, aucune transmission de données.
- **Traitement local**: Toutes les analyses, recherches et traitements se produisent dans votre navigateur ou application Electron.
- **IA locale**: La transcription vocale utilise [Whisper](https://openai.com/research/whisper) fonctionnant localement via WebGPU. Aucun audio n'est envoyé à un serveur ou API.
- **Aucun suivi**: Zéro analytics, télémétrie ou scripts tiers. Pas de Google Analytics, pas de cookies.
- **Aucun compte requis**: Pas d'inscription, pas de connexion, aucune collecte de données personnelles.
- **Open source**: Tout le code est public sous [AGPL-3.0](LICENSE). N'importe qui peut l'auditer.

### Comment vérifier

Ne nous faites pas simplement confiance. Vérifiez vous-même:

1. **Lisez le code source**  
   Parcourez le [dépôt GitHub](https://github.com/rodrigogs/whats-reader). La logique principale est dans `src/lib/` et `src/routes/`.

2. **Vérifiez les requêtes réseau**  
   Ouvrez les DevTools du navigateur (F12) → onglet Network → Utilisez l'application. Vous verrez **zéro requête externe** (sauf le chargement initial de la page si vous utilisez la version web).

3. **Testez hors ligne**  
   Déconnectez-vous d'internet, puis utilisez l'application. Tout fonctionne car rien ne nécessite de connexion.

4. **Compilez depuis le code source**  
   Clonez le dépôt et compilez vous-même:
   ```bash
   git clone https://github.com/rodrigogs/whats-reader.git
   cd whats-reader
   npm install
   npm run build
   ```

5. **Auditez l'application Electron**  
   L'application de bureau utilise le même code web. Vérifiez `electron/main.cjs` et `electron/preload.cjs`. Ils gèrent uniquement la gestion des fenêtres et les dialogues de fichiers.

---

## Développement

### Scripts

| Commande | Description |
|----------|-------------|
| `npm run dev` | Démarrer le serveur de développement sur [localhost:5173](http://localhost:5173) |
| `npm run build` | Compiler pour la production |
| `npm run preview` | Prévisualiser la compilation de production |
| `npm run check` | Vérification de types avec svelte-check |
| `npm run check:watch` | Vérification de types en mode watch |
| `npm run lint` | Linter avec Biome |
| `npm run lint:fix` | Corriger automatiquement les problèmes de lint |
| `npm run format` | Formater le code avec Biome |
| `npm run electron` | Compiler et exécuter l'application Electron |
| `npm run electron:dev` | Exécuter Electron en mode développement |
| `npm run electron:build` | Compiler l'installateur Electron |
| `npm run electron:build:mac` | Compiler pour macOS |
| `npm run electron:build:win` | Compiler pour Windows |
| `npm run electron:build:linux` | Compiler pour Linux |
| `npm run machine-translate` | Auto-traduction avec inlang |

### Ajouter des traductions

Les fichiers de traduction sont dans `messages/`. Pour ajouter une nouvelle langue:
1. Copiez `messages/en.json` vers `messages/{locale}.json`
2. Traduisez les chaînes
3. Ajoutez le locale à `project.inlang/settings.json`

---

## Construit avec

- [SvelteKit](https://kit.svelte.dev) + [Svelte 5](https://svelte.dev) - Framework
- [Tailwind CSS 4](https://tailwindcss.com) - Stylisation
- [Electron](https://electronjs.org) - Application de bureau
- [Transformers.js](https://huggingface.co/docs/transformers.js) - IA Whisper pour transcription
- [JSZip](https://stuk.github.io/jszip/) - Gestion des fichiers ZIP
- [Paraglide JS](https://inlang.com/m/gerre34r/library-inlang-paraglideJs) - Internationalisation

---

## Contribuer

Un bug ou une idée? [Ouvrez une issue](https://github.com/rodrigogs/whats-reader/issues) sur GitHub.

Vous voulez contribuer du code? Forkez le dépôt, faites vos modifications et ouvrez une pull request.

Il y a des fichiers de conversation d'exemple dans `examples/chats/` que vous pouvez utiliser pour tester.
---

## Licence

[AGPL-3.0](LICENSE). Vous pouvez utiliser, modifier et distribuer ce logiciel librement. Si vous le modifiez et l'exécutez en tant que service ou le distribuez, vous devez partager votre code source sous la même licence.

