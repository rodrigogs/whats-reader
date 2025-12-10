# <h1 align="center">Leitor de Backup do WhatsApp</h1>

<p align="center">
  <img src="src/lib/assets/favicon.svg" width="100" height="100" alt="Leitor de Backup do WhatsApp" />
</p>

<p align="center">
  <strong>Navegue suas exportações do WhatsApp offline. Seus dados permanecem no seu dispositivo.</strong>
</p>

<p align="center">
  <a href="README.md">English</a> •
  <strong>Português</strong> •
  <a href="README.es.md">Español</a> •
  <a href="README.fr.md">Français</a> •
  <a href="README.de.md">Deutsch</a>
</p>

---

## O que faz?

Arraste um arquivo `.zip` exportado do WhatsApp e navegue suas mensagens, fotos e notas de voz. Funciona com chats grandes (testado com mais de 10k mensagens).

Mensagens de voz podem ser transcritas usando [Whisper](https://openai.com/research/whisper), que roda no seu navegador via WebGPU. Sem servidor, sem chave de API necessária.

## Recursos

- **Transcrição de voz**: Transcreva áudio com Whisper (roda localmente, mais de 12 idiomas)
- **Busca**: Busca de texto completo em mensagens e transcrições
- **Marcadores**: Salve mensagens com notas, exporte/importe como JSON
- **Modo perspectiva**: Veja o chat como qualquer participante
- **Estatísticas**: Contagem de mensagens, gráficos de atividade, linha do tempo
- **Modo escuro**: Segue o sistema ou alterna manualmente (preferência salva)
- **Interface multilíngue**: Inglês, Português, Espanhol, Francês, Alemão, Italiano, Holandês, Japonês, Chinês, Russo
- **Aplicativo desktop**: macOS, Windows, Linux via Electron

## Início Rápido

### Pré-requisitos

Você precisa do [Node.js](https://nodejs.org/) instalado (versão 18 ou posterior).

```bash
node --version
```

### Executando o aplicativo

```bash
npm install
npm run dev
```

Abra [localhost:5173](http://localhost:5173) no seu navegador e arraste seu arquivo `.zip` do WhatsApp.

### Aplicativo desktop (opcional)

```bash
npm run electron:dev    # executar em modo de desenvolvimento
npm run electron:build  # criar instalador para seu SO
```

## Como Exportar do WhatsApp

### iPhone
1. Abra o WhatsApp e vá para qualquer chat
2. Toque no nome do contato ou grupo no topo da tela
3. Role para baixo e toque em **Exportar Conversa**
4. Escolha **Incluir Mídia** para incluir fotos, vídeos e mensagens de voz
5. Salve o arquivo (pode usar AirDrop, salvar em Arquivos ou enviar por email)

### Android
1. Abra o WhatsApp e vá para qualquer chat
2. Toque nos três pontos **⋮** no canto superior direito
3. Toque em **Mais** → **Exportar conversa**
4. Escolha **Incluir mídia**
5. Salve ou compartilhe o arquivo `.zip` para seu computador

## Privacidade e Segurança

Este aplicativo foi projetado com privacidade como prioridade máxima. Seus dados do WhatsApp nunca saem do seu dispositivo.

### Por que é seguro

- **100% Offline**: O aplicativo funciona completamente sem internet
- **Processamento Local**: Toda análise, busca e processamento acontecem no seu navegador
- **IA Local**: Transcrição de voz usa Whisper rodando localmente via WebGPU
- **Sem Rastreamento**: Zero analytics, telemetria ou scripts de terceiros
- **Sem conta necessária**: Sem registro, sem login
- **Código Aberto**: Todo o código é público sob licença AGPL-3.0

## Scripts de Desenvolvimento

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Iniciar servidor de desenvolvimento |
| `npm run build` | Compilar para produção |
| `npm run check` | Verificação de tipos com svelte-check |
| `npm run lint` | Linter com Biome |
| `npm run electron:dev` | Executar Electron em modo de desenvolvimento |
| `npm run electron:build` | Compilar instalador Electron |

## Construído com

- [SvelteKit](https://kit.svelte.dev) + [Svelte 5](https://svelte.dev) - Framework
- [Tailwind CSS 4](https://tailwindcss.com) - Estilização
- [Electron](https://electronjs.org) - Aplicativo desktop
- [Transformers.js](https://huggingface.co/docs/transformers.js) - IA Whisper para transcrição
- [JSZip](https://stuk.github.io/jszip/) - Manipulação de arquivos ZIP

## Contribuindo

Encontrou um bug ou tem uma ideia? [Abra uma issue](https://github.com/rodrigogs/whats-reader/issues) no GitHub.

Quer contribuir com código? Faça um fork do repositório, faça suas alterações e abra um pull request.

## Licença

[AGPL-3.0](LICENSE). Você pode usar, modificar e distribuir este software livremente. Se você modificá-lo e executá-lo como serviço ou distribuí-lo, deve compartilhar seu código fonte sob a mesma licença.
