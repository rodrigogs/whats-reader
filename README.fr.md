# <h1 align="center">Lecteur de Sauvegarde WhatsApp</h1>

<p align="center">
  <img src="src/lib/assets/favicon.svg" width="100" height="100" alt="Lecteur de Sauvegarde WhatsApp" />
</p>

<p align="center">
  <strong>Parcourez vos exportations WhatsApp hors ligne. Vos données restent sur votre appareil.</strong>
</p>

<p align="center">
  <a href="README.md">English</a> •
  <a href="README.pt.md">Português</a> •
  <a href="README.es.md">Español</a> •
  <strong>Français</strong> •
  <a href="README.de.md">Deutsch</a>
</p>

---

## Description

Glissez-déposez un fichier `.zip` exporté de WhatsApp et parcourez vos messages, photos et notes vocales. Fonctionne avec de grandes conversations (testé avec plus de 10k messages).

Les messages vocaux peuvent être transcrits en utilisant [Whisper](https://openai.com/research/whisper), qui s'exécute dans votre navigateur via WebGPU. Aucun serveur, aucune clé API nécessaire.

## Fonctionnalités

- **Transcription vocale**: Transcrivez l'audio avec Whisper (fonctionne localement, plus de 12 langues)
- **Recherche**: Recherche en texte intégral dans les messages et transcriptions
- **Favoris**: Sauvegardez des messages avec des notes, exportez/importez au format JSON
- **Mode perspective**: Visualisez la conversation comme n'importe quel participant
- **Statistiques**: Nombre de messages, graphiques d'activité, chronologie
- **Mode sombre**: Suit le système ou bascule manuellement
- **Interface multilingue**: Anglais, Portugais, Espagnol, Français, Allemand, Italien, Néerlandais, Japonais, Chinois, Russe
- **Application de bureau**: macOS, Windows, Linux via Electron

## Démarrage Rapide

### Prérequis

Vous avez besoin de [Node.js](https://nodejs.org/) installé (version 18 ou ultérieure).

### Exécuter l'application

```bash
npm install
npm run dev
```

Ouvrez [localhost:5173](http://localhost:5173) dans votre navigateur et glissez-déposez votre fichier `.zip` WhatsApp.

### Application de bureau (facultatif)

```bash
npm run electron:dev    # exécuter en mode développement
npm run electron:build  # créer un installateur pour votre OS
```

## Comment Exporter depuis WhatsApp

### iPhone
1. Ouvrez WhatsApp et accédez à une conversation
2. Appuyez sur le nom du contact ou du groupe en haut
3. Faites défiler vers le bas et appuyez sur **Exporter la discussion**
4. Choisissez **Joindre les médias**
5. Sauvegardez le fichier

### Android
1. Ouvrez WhatsApp et accédez à une conversation
2. Appuyez sur les trois points **⋮** en haut à droite
3. Appuyez sur **Plus** → **Exporter la discussion**
4. Choisissez **Inclure les médias**
5. Sauvegardez le fichier `.zip`

## Confidentialité et Sécurité

Cette application est conçue avec la confidentialité comme priorité absolue. Vos données WhatsApp ne quittent jamais votre appareil.

- **100% Hors ligne**: Fonctionne sans internet après le chargement
- **Traitement local**: Tout se passe dans votre navigateur
- **IA locale**: Transcription vocale via WebGPU local
- **Aucun suivi**: Zéro analytics ou télémétrie
- **Open source**: Code public sous licence AGPL-3.0

## Construit avec

- [SvelteKit](https://kit.svelte.dev) + [Svelte 5](https://svelte.dev)
- [Tailwind CSS 4](https://tailwindcss.com)
- [Electron](https://electronjs.org)
- [Transformers.js](https://huggingface.co/docs/transformers.js)
- [JSZip](https://stuk.github.io/jszip/)

## Contribuer

Un bug ou une idée? [Ouvrez une issue](https://github.com/rodrigogs/whats-reader/issues) sur GitHub.

## Licence

[AGPL-3.0](LICENSE)
