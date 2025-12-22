<h1 align="center">Leitor de Backup do WhatsApp</h1>

<p align="center">
  <img src="src/lib/assets/favicon.svg" width="100" height="100" alt="Leitor de Backup do WhatsApp" />
</p>

<p align="center">
  <strong>Navegue suas exportações do WhatsApp offline. Seus dados permanecem no seu dispositivo.</strong>
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
  <strong>Português</strong> •
  <a href="README.es.md">Español</a> •
  <a href="README.fr.md">Français</a> •
  <a href="README.de.md">Deutsch</a> •
  <a href="README.it.md">Italiano</a> •
  <a href="README.nl.md">Nederlands</a> •
  <a href="README.ja.md">日本語</a> •
  <a href="README.zh.md">中文</a> •
  <a href="README.ru.md">Русский</a>
</p>

<p align="center">
  <a href="#recursos">Recursos</a> •
  <a href="#início-rápido">Início Rápido</a> •
  <a href="#como-exportar-do-whatsapp">Guia de Exportação</a> •
  <a href="#privacidade-e-segurança">Privacidade</a> •
  <a href="#contribuindo">Contribuir</a>
</p>

---

## O que faz?

Arraste um arquivo `.zip` exportado do WhatsApp e navegue suas mensagens, fotos e notas de voz. Funciona com chats grandes (testado com mais de 10k mensagens).

A **Galeria de Mídia** oferece uma visão visual de todas as fotos, vídeos e arquivos de áudio organizados por data. Selecione vários itens e baixe-os como arquivo ZIP, ou clique em qualquer mídia para visualizá-la em tela cheia e ir para a mensagem original.

Mensagens de voz podem ser transcritas usando [Whisper](https://openai.com/research/whisper), que roda no seu navegador via WebGPU. Sem servidor, sem chave de API necessária.

<details>
<summary>Capturas de Tela</summary>
<br>

| Tela Inicial | Visualização de Chat |
|:---:|:---:|
| <img src="examples/images/1-start.png" width="400" /> | <img src="examples/images/2-chats.png" width="400" /> |

| Opções de Chat | Modo Perspectiva |
|:---:|:---:|
| <img src="examples/images/3-chat-options.png" width="400" /> | <img src="examples/images/4-view-as.png" width="400" /> |

| Marcadores | Estatísticas |
|:---:|:---:|
| <img src="examples/images/5-bookmarks.png" width="400" /> | <img src="examples/images/6-statistics.png" width="400" /> |

| Transcrição de Voz | Galeria de Mídia |
|:---:|:---:|
| <img src="examples/images/7-audio-transcription.png" width="400" /> | <img src="examples/images/8-media-gallery.png" width="400" /> |

| Baixar selecionados | Ir para data |
|:---:|:---:|
| <img src="examples/images/9-media-gallery-download-selected.png" width="400" /> | <img src="examples/images/10-media-gallery-goto-date.png" width="400" /> |

</details>

---

## Download

Baixe o aplicativo para sua plataforma:

### Windows
- Baixe **WhatsApp-Backup-Reader-Setup-{version}.exe** da [última versão](https://github.com/rodrigogs/whats-reader/releases/latest)
- Execute o instalador e siga o assistente de instalação
- O app será atualizado automaticamente quando houver novas versões

### macOS
- **Apple Silicon (M1/M2/M3)**: Baixe **WhatsApp-Backup-Reader-{version}-arm64.dmg**
- **Intel**: Baixe **WhatsApp-Backup-Reader-{version}.dmg**
- Abra o arquivo DMG e arraste o app para Aplicativos
- No primeiro uso, clique com botão direito no app e selecione "Abrir" para passar pelo Gatekeeper

### Linux
- **Debian/Ubuntu**: Baixe **whats-reader_{version}_amd64.deb** ou **whats-reader_{version}_arm64.deb**
  ```bash
  sudo dpkg -i whats-reader_{version}_amd64.deb
  ```
- **Fedora/RHEL**: Baixe **whats-reader-{version}.x86_64.rpm** ou **whats-reader-{version}.aarch64.rpm**
  ```bash
  sudo rpm -i whats-reader-{version}.x86_64.rpm
  ```
- **Outras distros (Arch, etc.)**: Baixe **WhatsApp-Backup-Reader-{version}.AppImage**
  ```bash
  chmod +x WhatsApp-Backup-Reader-{version}.AppImage
  ./WhatsApp-Backup-Reader-{version}.AppImage
  ```

> **Ou use a versão web**: Visite [rodrigogs.github.io/whats-reader](https://rodrigogs.github.io/whats-reader) - sem instalação!

---

## Recursos

- **Galeria de Mídia**: Navegue por todas as fotos, vídeos e áudios em uma grade de miniaturas
  - Organização por data com navegação por calendário
  - Seleção em massa e download como ZIP
  - Visualização em lightbox com navegação para a mensagem original
- **Transcrição de voz**: Transcreva áudio com Whisper (roda localmente, mais de 12 idiomas)
- **Busca**: Busca de texto completo em mensagens e transcrições
- **Marcadores**: Salve mensagens com notas, exporte/importe como JSON
- **Modo perspectiva**: Veja o chat como qualquer participante
- **Estatísticas**: Contagem de mensagens, gráficos de atividade, linha do tempo
- **Modo escuro**: Segue o sistema ou alterne manualmente (preferência salva)
- **Interface multilíngue**: Inglês, Português, Espanhol, Francês, Alemão, Italiano, Holandês, Japonês, Chinês, Russo
- **Aplicativo desktop**: macOS, Windows, Linux via Electron

---

## Início Rápido

### Pré-requisitos

Você precisa do [Node.js](https://nodejs.org/) instalado (versão 18 ou posterior). Baixe em [nodejs.org](https://nodejs.org/) e execute o instalador.

Para verificar se você tem:
```bash
node --version
```

### Executando o aplicativo

1. Clone ou baixe este projeto
2. Abra um terminal na pasta do projeto
3. Execute estes comandos:

```bash
npm install
npm run dev
```

4. Abra [localhost:5173](http://localhost:5173) no seu navegador
5. Arraste seu arquivo `.zip` do WhatsApp na página

### Aplicativo desktop (opcional)

Se você prefere um aplicativo independente em vez de usar seu navegador:

```bash
npm run electron:dev    # executar em modo de desenvolvimento
npm run electron:build  # criar instalador para seu SO
```

Compilações específicas por plataforma:
```bash
npm run electron:build:mac    # macOS (dmg, zip)
npm run electron:build:win    # Windows (nsis, portable)
npm run electron:build:linux  # Linux (deb, rpm, AppImage)
```

---

## Como Exportar do WhatsApp

Primeiro, você precisa exportar um chat do WhatsApp no seu telefone. Isso cria um arquivo `.zip` contendo suas mensagens e mídia.

### iPhone
1. Abra o WhatsApp e vá para qualquer chat
2. Toque no nome do contato ou grupo no topo da tela
3. Role para baixo e toque em **Exportar Conversa**
4. Escolha **Incluir Mídia** para incluir fotos, vídeos e mensagens de voz
5. Salve o arquivo (pode usar AirDrop para seu Mac, salvar em Arquivos ou enviar por email)

### Android
1. Abra o WhatsApp e vá para qualquer chat
2. Toque nos três pontos **⋮** no canto superior direito
3. Toque em **Mais** → **Exportar conversa**
4. Escolha **Incluir mídia**
5. Salve ou compartilhe o arquivo `.zip` para seu computador

### Dicas
- Chats grandes podem levar alguns minutos para exportar
- O arquivo será nomeado algo como `WhatsApp Chat with John.zip`
- Chats individuais e em grupo funcionam

---

## Privacidade e Segurança

Este aplicativo é projetado com privacidade como prioridade máxima. Seus dados do WhatsApp nunca saem do seu dispositivo.

### Por que é seguro

- **100% Offline**: O aplicativo funciona completamente sem internet. Sem servidores, sem nuvem, sem transmissão de dados.
- **Processamento Local**: Toda análise, busca e processamento acontecem no seu navegador ou aplicativo Electron.
- **IA Local**: Transcrição de voz usa [Whisper](https://openai.com/research/whisper) rodando localmente via WebGPU. Nenhum áudio é enviado para qualquer servidor ou API.
- **Sem Rastreamento**: Zero analytics, telemetria ou scripts de terceiros. Sem Google Analytics, sem cookies.
- **Sem conta necessária**: Sem registro, sem login, sem coleta de dados pessoais.
- **Código Aberto**: Todo o código é público sob [AGPL-3.0](LICENSE). Qualquer um pode auditá-lo.

### Como verificar

Não confie apenas em nós. Verifique você mesmo:

1. **Leia o código fonte**  
   Navegue pelo [repositório GitHub](https://github.com/rodrigogs/whats-reader). A lógica principal está em `src/lib/` e `src/routes/`.

2. **Verifique requisições de rede**  
   Abra as DevTools do navegador (F12) → aba Network → Use o aplicativo. Você verá **zero requisições externas** (exceto o carregamento inicial da página se usar a versão web).

3. **Teste offline**  
   Desconecte da internet, então use o aplicativo. Tudo funciona porque nada requer conexão.

4. **Compile do código fonte**  
   Clone o repositório e compile você mesmo:
   ```bash
   git clone https://github.com/rodrigogs/whats-reader.git
   cd whats-reader
   npm install
   npm run build
   ```

5. **Audite o aplicativo Electron**  
   O aplicativo desktop usa o mesmo código web. Revise `electron/main.cjs` e `electron/preload.cjs`. Eles apenas manipulam gerenciamento de janelas e diálogos de arquivo.

---

## Desenvolvimento

### Scripts

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Iniciar servidor de desenvolvimento em [localhost:5173](http://localhost:5173) |
| `npm run build` | Compilar para produção |
| `npm run preview` | Visualizar compilação de produção |
| `npm run check` | Verificação de tipos com svelte-check |
| `npm run check:watch` | Verificação de tipos em modo watch |
| `npm run lint` | Linter com Biome |
| `npm run lint:fix` | Corrigir automaticamente problemas de lint |
| `npm run format` | Formatar código com Biome |
| `npm run electron` | Compilar e executar aplicativo Electron |
| `npm run electron:dev` | Executar Electron em modo de desenvolvimento |
| `npm run electron:build` | Compilar instalador Electron |
| `npm run electron:build:mac` | Compilar para macOS |
| `npm run electron:build:win` | Compilar para Windows |
| `npm run electron:build:linux` | Compilar para Linux |
| `npm run machine-translate` | Auto-tradução com inlang |

### Adicionar traduções

Arquivos de tradução estão em `messages/`. Para adicionar um novo idioma:
1. Copie `messages/en.json` para `messages/{locale}.json`
2. Traduza as strings
3. Adicione o locale ao `project.inlang/settings.json`

---

## Construído com

- [SvelteKit](https://kit.svelte.dev) + [Svelte 5](https://svelte.dev) - Framework
- [Tailwind CSS 4](https://tailwindcss.com) - Estilização
- [Electron](https://electronjs.org) - Aplicativo desktop
- [Transformers.js](https://huggingface.co/docs/transformers.js) - IA Whisper para transcrição
- [JSZip](https://stuk.github.io/jszip/) - Manipulação de arquivos ZIP
- [Paraglide JS](https://inlang.com/m/gerre34r/library-inlang-paraglideJs) - Internacionalização

---

## Contribuindo

Encontrou um bug ou tem uma ideia? [Abra uma issue](https://github.com/rodrigogs/whats-reader/issues) no GitHub.

Quer contribuir com código? Faça um fork do repositório, faça suas alterações e abra um pull request.

Há arquivos de chat de exemplo em `examples/chats/` que você pode usar para testes.

---

## Histórico de Estrelas

<a href="https://star-history.com/#rodrigogs/whats-reader&Date">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=rodrigogs/whats-reader&type=Date&theme=dark" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=rodrigogs/whats-reader&type=Date" />
    <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=rodrigogs/whats-reader&type=Date" />
  </picture>
</a>

---

## Licença

[AGPL-3.0](LICENSE). Você pode usar, modificar e distribuir este software livremente. Se você modificá-lo e executá-lo como serviço ou distribuí-lo, deve compartilhar seu código fonte sob a mesma licença.
