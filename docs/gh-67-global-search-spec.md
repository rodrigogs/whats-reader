# GH-67 — Busca global offline entre conversas importadas

> Revisão 3. Este documento substitui o rascunho inicial e fecha os seis bloqueios do gate de arquitetura. Não autoriza implementação enquanto a revisão adversarial desta revisão não aprovar o documento.

## 1. Objetivo e limites

Permitir que a pessoa pesquise texto em todos os chats atualmente carregados e, **somente após consentimento**, em uma cópia local pesquisável de chats lembrados. A funcionalidade é 100% client-side e offline: não há backend, conta, sincronização, telemetria, histórico de consultas, upload, download ou chamada de rede criada por ela.

O MVP cobre texto de mensagens e remetentes. Transcrições, mídia, OCR, VCF, embeddings, regex, stemming, booleanos, ranking semântico e SQLite/FTS ficam fora do escopo. A busca local já existente continua com seu comportamento atual, inclusive o suporte a transcrições que ela já possui.

O ZIP permanece a fonte de verdade. O índice global é uma cache descartável, não uma cópia do ZIP e não deve incluir `rawLine`, bytes de mídia, path absoluto, HTML pré-renderizado, comentários de bookmark ou payloads de erro com conteúdo.

## 2. Estado confirmado

- `idb-keyval` persiste `PersistedChatMetadata`, referências de arquivo, bookmarks, transcrições e settings; não persiste ZIP, mensagens completas ou índice textual (`src/lib/persistence.svelte.ts`).
- `PersistedChatMetadata.id` é um UUID estável. Hoje `savePersistedChat()` remove por título e gera novo ID, e `findPersistedChatByTitle()` é usado em fluxos destrutivos. Isso não é seguro para a funcionalidade global.
- O app usa título como chave em `rememberedChats`, `chatFileReferences`, preferências por chat, índices de renderização e bookmarks (`src/routes/+page.svelte`, `src/lib/state.svelte.ts`, `src/lib/bookmarks.svelte.ts`).
- O worker atual mantém um único chat e faz `toLowerCase().includes()` em chunks de 2.000 (`src/lib/workers/search-worker.ts`). A main thread já mantém mensagens parseadas e clones serializados para o worker de índice.
- Transcrições restauradas entram hoje em um `Map` global indexado por `messageId` nu (`src/lib/transcription.svelte.ts`). Elas não têm autorização implícita para entrar em um novo corpus persistido.
- O parser atualmente registra conteúdo do chat no console (`src/lib/parser/zip-parser.ts`). Isso deve ser removido antes do lançamento da busca global.

## 3. Decisões fechadas

| ID | Decisão |
|---|---|
| D1 | Busca global é uma superfície separada da busca no chat selecionado. |
| D2 | O MVP busca somente `content` e `sender`, com substring case-insensitive literal. Não faz accent folding. |
| D3 | Chats carregados são pesquisáveis apenas enquanto estão carregados. Nenhum texto de chat session-only é escrito em IndexedDB. |
| D4 | Texto persistido é opt-in por chat lembrado; a recusa mantém a busca somente para chats carregados. |
| D5 | O identificador canônico é `archiveId`, que para um chat lembrado é exatamente `PersistedChatMetadata.id`. Título é somente apresentação. |
| D6 | A persistência usa shards versionados em IndexedDB; não adiciona dependência ou banco nativo. |
| D7 | O worker nunca mantém um corpus global completo. Ele recebe e descarta um shard por vez. |
| D8 | A cópia de transcrições legadas não é pesquisada nem migrada no MVP. Uma futura inclusão requer um consentimento novo e explícito. |
| D9 | A feature pode ser desabilitada localmente e deve falhar fechada; seu namespace pode ser limpo sem tocar nos dados pré-existentes. |

## 4. Identidade: pré-requisito obrigatório

Nenhuma persistência, resultado global ou navegação cross-chat pode ser lançada antes da migração de identidade abaixo. Este é um requisito de ordem de execução, não uma recomendação.

### 4.1 Contrato

```ts
type ArchiveId = string;

type ArchiveMessageKey = {
	archiveId: ArchiveId;
	ordinal: number;
	messageId: string;
};
```

- `archiveId` é gerado uma vez ao lembrar uma importação e nunca é derivado de `chat.title`.
- Para um chat já lembrado, usa-se o `id` já persistido. Para chat ainda não lembrado, o runtime usa um UUID session-only; se ele for lembrado, a mesma instância passa a usar o UUID persistido.
- `ordinal` é a posição da mensagem no snapshot parseado. `messageId` é ponte de navegação e validação, nunca chave global isolada.
- Todo resultado, filtro, seleção, referência de arquivo, estado de indexação e operação destrutiva aceita `archiveId`. `chatTitle` pode duplicar.

### 4.2 Migração de código exigida antes da busca global

1. Adicionar `archiveId` à identidade runtime de `ChatData` ou a um registry único `archiveId -> ChatData`.
2. Trocar `rememberedChats`, `chatFileReferences`, estado de preferências, seleção/restauração, bookmarks e índices de navegação para chaves `archiveId` (ou uma chave composta que o contenha).
3. Trocar `findPersistedChatByTitle()` por lookup por ID nos fluxos de lembrar, esquecer, restaurar e remover. A função por título não pode ser chamada por nenhuma operação destrutiva; se for mantida para display, deve retornar lista e não escolher um resultado arbitrariamente.
4. Alterar `savePersistedChat()` para atualizar somente o `archiveId` alvo. Nunca pode remover uma entrada por título nem gerar um ID novo para uma atualização do mesmo arquivo.
5. Tornar bookmarks e transcrições runtime namespaced por `archiveId + messageId`; dados legados são migrados somente depois de o arquivo correspondente ser validado e carregado.
6. Cobrir com dois chats de mesmo título, IDs de mensagem iguais e remoção de apenas um deles.

Dados legados já colapsados por título não podem ser reconstruídos automaticamente. Eles permanecem como estão e são mostrados como um único registro até a pessoa importar a fonte novamente.

## 5. Consentimento e UX final

A UI usa Paraglide para todos os textos. Os seguintes textos são a copy de produto aprovada para implementar e traduzir:

- Ação: **Buscar em todos os chats**.
- Opção por chat lembrado: **Manter disponível na busca global**.
- Consentimento: **“Para pesquisar neste chat mesmo depois de fechá-lo, o WhatsApp Backup Reader guardará neste dispositivo uma cópia derivada do texto das mensagens e dos remetentes. Essa cópia não inclui o ZIP original, não é enviada pela internet e pode ser apagada a qualquer momento.”**
- Ações do diálogo: **Manter localmente** e **Somente nesta sessão**.
- **Fechar chat** descarrega o chat da memória e não remove dados lembrados nem índice persistido.
- **Remover da biblioteca** apaga o metadado, a referência de arquivo e todo índice global daquele `archiveId`; requer confirmação.
- **Apagar todos os índices locais** remove somente o namespace da busca global e seu consentimento; preserva ZIPs, metadados, bookmarks, transcrições e settings.

Transcrições não aparecem em filtros, resultados ou consentimento do MVP. Um eventual trabalho posterior deve pedir consentimento específico antes de ler `PersistedChatMetadata.transcriptions`, criar chaves por `archiveId + ordinal/messageId`, e apagar essas chaves ao recusar/remover.

A superfície global fica disponível sem chat selecionado. Query vazia mostra cobertura, não mensagens. Cobertura apresenta `pronto`, `indexando`, `somente nesta sessão`, `requer arquivo`, `stale`, `falhou` ou `desativado`. Resultados mostram chat, remetente, data/hora, trecho de texto puro, destaque por ranges e estado de cobertura. Filtros do MVP: chat (`archiveId`), remetente e período; grupos combinam por E, valores do mesmo grupo por OU. A lista é ordenada por data descendente, depois título, `archiveId`, `ordinal`, e é paginada em 50 itens.

Ao abrir um resultado, o app resolve `archiveId`, carrega/restaura a fonte se necessário, valida o ZIP, espera o índice de renderização e vai para a mensagem exata. Se a fonte estiver ausente ou incompatível, a query e os filtros sobrevivem e o app pede reseleção; nunca navega para uma mensagem aproximada.

## 6. Dados persistidos e atomicidade

```ts
type GlobalSearchManifest = {
	schemaVersion: 1;
	indexVersion: 1;
	normalizationVersion: 1;
	archiveId: string;
	generation: number;
	state: 'staging' | 'ready' | 'stale' | 'failed' | 'removing';
	chatTitle: string;
	sourceFingerprint: string;
	messageCount: number;
	indexedDocumentCount: number;
	searchableUtf8Bytes: number;
	storedBytes: number;
	includes: { content: true; sender: true; transcriptions: false };
	createdAt: number;
	indexedAt?: number;
	lastErrorCode?: 'quota' | 'worker-crash' | 'corrupt' | 'version-mismatch';
};

type GlobalSearchDocument = ArchiveMessageKey & {
	timestamp: number | null;
	sender: string;
	content: string;
};
```

Chaves exclusivas da feature:

| Chave | Conteúdo |
|---|---|
| `whatsapp-global-search-manifest-v1-${archiveId}` | manifesto público `ready`, `stale`, `failed` ou `removing` |
| `whatsapp-global-search-staging-v1-${archiveId}-${generation}` | manifesto temporário |
| `whatsapp-global-search-shard-v1-${archiveId}-${generation}-${shardNo}` | até 2.000 documentos ou 1 MiB serializado, o que vier primeiro |
| `whatsapp-global-search-commit-v1-${archiveId}` | `{ archiveId, readyGeneration, shardCount, checksum }` |
| `whatsapp-global-search-consent-v1-${archiveId}` | versão da copy, timestamp e escolha explícita |

A fonte alterada cria uma geração inteira nova; o MVP não tenta detectar append. `sourceFingerprint` é SHA-256 dos campos pesquisáveis em ordem canônica (`ordinal`, timestamp, sender, content), calculado no worker. O índice é reconstruível e não migra estruturas derivadas in-place.

Processo de escrita:

1. Confirmar consentimento válido, feature habilitada e fonte validada.
2. Executar `navigator.storage.estimate()` quando disponível; recusar iniciar se a projeção ultrapassar 80% da quota ou deixar menos de 100 MiB livres.
3. Construir shards e checksum no worker, um de cada vez.
4. Gravar shards da próxima geração e staging; após cada gravação, validar contagem e checksum.
5. Gravar a ponte de commit e tornar o manifesto `ready` somente depois de todos os shards serem válidos.
6. Consultas veem somente a geração referida pela ponte de commit: ou a geração anterior, ou a nova; nunca uma mistura.
7. Coletar a geração anterior apenas depois do commit. Em falha, apagar staging possível e preservar a geração anterior.

No startup, chaves `staging`, gerações órfãs, manifestos com versão desconhecida ou checksum inválido são excluídos da cobertura. Índices legados incompatíveis são `stale`, não são lidos e exigem fonte + consentimento para reindexar.

## 7. Pesquisa com orçamento de memória

O contrato do worker global é propositalmente streaming:

- `search({ query, filters, requestId })` inicia uma consulta cancelável.
- Para chat carregado, a main thread fornece documentos de **um shard de um archive por vez**; após a resposta parcial, ela libera a cópia transferida antes do shard seguinte.
- Para chat persistido, o worker lê/recebe um shard IndexedDB por vez e o descarta após produzir a página/contagem parcial.
- `cancel(requestId)` é verificado entre shards e a cada 2.000 documentos. Apenas o `requestId` mais recente pode atualizar a UI.
- `removeArchive(archiveId)` remove RAM, invalida resultados daquele archive e impede novas leituras persistidas.

Não existe `replaceArchive` que duplique todos os chats carregados em memória do worker. A main thread já tem `ChatData`; no máximo um shard serializado pode coexistir nela e no worker. Documentos não armazenam uma segunda versão `normalized`: lowercase é calculado no scan. Se benchmarks mostrarem que isso não atende ao SLA, trigramas/postings são uma decisão posterior, não parte do MVP.

Envelope inicial e comportamento:

| Item | Suportado | Degradação/falha fechada |
|---|---:|---|
| Chats | 25 | acima disso, exigir escopo/filtro explícito |
| Texto pesquisável | 128 MiB | não persistir automaticamente acima do teto |
| Mensagens | 250.000 | acima disso, consulta streaming com progresso; não persistir acima de 1M |
| Shard | 2.000 docs ou 1 MiB | diminuir o shard se exceder orçamento do worker |
| Main-thread overhead | 32 MiB | cancelar/mostrar cobertura parcial antes de exceder |
| Worker | 128 MiB desktop; 64 MiB low-end | descartar cache e reduzir shard, nunca manter corpus global |

Uma consulta de um caractere é permitida, mas em corpus acima de 100k mensagens entra em modo degradado: mostra progresso, prioriza a primeira página e permite cancelar. Resultados navegáveis têm teto inicial de 1.000; a contagem total é separada e a UI declara o truncamento.

## 8. Privacidade, logs e rollback de release

Antes de habilitar a UI, remover os logs do parser que exibem primeiras linhas, mensagens sem parse e conteúdo derivado. O código novo não pode escrever em console query, trecho, conteúdo, remetente, IDs correlacionáveis, fingerprints ou paths. Erros persistidos guardam somente códigos enumerados e chaves de mensagem i18n.

A implementação deve ter um gate local versionado, por exemplo `GLOBAL_SEARCH_V1_ENABLED`, definido no build. Quando falso ou quando `schemaVersion/indexVersion` é desconhecido:

1. não renderiza a busca global;
2. não escreve nem lê manifestos/shards;
3. remove resultados em RAM;
4. trata o namespace como indisponível, sem tentar conversão;
5. mantém todos os dados de persistência anteriores intocados.

Rollback de produto é um build de correção que desliga esse gate; não depende de controle remoto. A ação de recuperação local é idempotente: enumera e apaga apenas chaves com prefixo `whatsapp-global-search-`, depois lê novamente e exige contagem zero. Ela não toca `whatsapp-persisted-chat-`, `whatsapp-file-handle-`, bookmarks, transcrições nem settings. O release só pode declarar rollback concluído após essa leitura de volta.

## 9. Harness obrigatório e critérios mensuráveis

O repositório não tem framework de teste hoje. A primeira card de implementação deve adicionar exatamente `vitest`, `@playwright/test` e `tsx` como `devDependencies`, sem criar dependência runtime. O harness é obrigatório e deve ser executável pelos scripts abaixo; nenhum nome é ilustrativo:

```json
{
	"test:global-search:unit": "vitest run --config vitest.global-search.config.ts",
	"test:global-search:privacy": "playwright test --config playwright.global-search.config.ts",
	"test:global-search": "npm run test:global-search:unit && npm run test:global-search:privacy",
	"benchmark:global-search": "tsx scripts/benchmark-global-search.ts",
	"verify:global-search": "npm run test:global-search && npm run benchmark:global-search -- --target=web --profile=desktop --size=100000 --assert"
}
```

`vitest.global-search.config.ts` executa somente contratos puros em `src/lib/global-search/**/*.test.ts`; eles cobrem identidade, filtros, cancelamento, paginação, geração/commit/rollback, exclusão com readback e o gerador sintético. `playwright.global-search.config.ts` inicia o Vite em `127.0.0.1`, usa o Chromium baixado por `npx playwright install --with-deps chromium` e executa `tests/global-search/**/*.spec.ts`. Essa suíte usa apenas dados sintéticos e instala interceptores que falham se a feature invocar `fetch`, `XMLHttpRequest`, `navigator.sendBeacon` ou `WebSocket`; também captura `console.*` e falha se query, snippet, conteúdo, sender, IDs ou paths sintéticos aparecem. Não é permitido trocar o intercept por um mock permissivo.

`scripts/benchmark-global-search.ts` é o único runner de benchmark. Ele aceita `--target=web|electron`, `--profile=desktop|low-end`, `--size=10000|100000|250000|1000000`, `--report=<path>` e `--assert`. Ele deve falhar com código diferente de zero para argumento inválido, relatório ausente, cenário não executado ou meta não atendida. Para `web`, inicia o build local e controla Chromium com Playwright. Para `electron`, inicia o `electron` empacotado/local com o helper de Electron do Playwright; não pode simular Electron em Chromium. O app expõe a entrada sintética somente sob `VITE_GLOBAL_SEARCH_HARNESS=1`; builds normais e distribuídos não incluem esse hook. Todo modo retorna JSON versionado em `artifacts/gh67/`, contendo comando, commit, seed, target, profile, versões de Node/browser/Electron, SO, CPUs lógicas, RAM total, throttle/heap solicitado, tamanhos, 10 amostras após warm-up, p95, long tasks, cancelamento, memória ou `unavailable`, e o resultado de cada gate.

O gerador usa seed fixa `gh67-v1` e gera os tamanhos 10k, 100k, 250k e 1M com Unicode/emoji/acentos/CJK, HTML-like text, timestamps nulos, mensagens >256 KiB, títulos duplicados e colisões artificiais de `messageId`. Para cada cenário, registra `performance.now()` por query e indexação; no navegador usa `PerformanceObserver({ type: 'longtask' })` quando suportado. Memória usa `performance.measureUserAgentSpecificMemory()` quando disponível; quando indisponível, o relatório marca `unavailable` — nunca inventa um valor. A execução de release é obrigatória em:

| Perfil | Ambiente | Metas warm para 100k |
|---|---|---|
| Desktop | Chrome estável em x86_64, 8 CPUs lógicas, 16 GiB RAM, sem throttle | primeira página p95 <=150 ms; total <=300 ms; indexar <=5 s |
| Low-end | Chrome estável no mesmo cenário com CPU 4x throttle e heap limitado a 512 MiB via DevTools | primeira página p95 <=400 ms; total <=800 ms; indexar <=15 s |
| Electron | Electron da versão de `package.json` em Windows, Linux e macOS | mesmas metas desktop, com relatório separado |

Cada medida é feita 10 vezes depois de um warm-up, com p95 calculado sobre as 10 amostras. Main thread não pode ter long task acima de 50 ms durante indexação; cancelamento deve ser observado em até 500 ms. O modo `--assert` falha se uma dessas condições ou a meta do perfil aplicável falhar. A memória é gate apenas quando a API estiver disponível; sem API, a ausência é registrada e a execução não finge conformidade. O relatório é um artefato local de release e é requisito para habilitar persistência nesse release.

Em CI, um job Node 24 deve executar `npm run test:global-search` após `npx playwright install --with-deps chromium`; benchmarks não rodam em CI porque as metas exigem hardware controlado. Antes de habilitar a persistência, o release deve anexar e revisar os comandos executados abaixo, todos com `--assert` e relatório fora da árvore versionada:

```sh
npm run benchmark:global-search -- --target=web --profile=desktop --size=100000 --assert --report=artifacts/gh67/web-desktop-100k.json
npm run benchmark:global-search -- --target=web --profile=low-end --size=100000 --assert --report=artifacts/gh67/web-low-end-100k.json
npm run benchmark:global-search -- --target=electron --profile=desktop --size=100000 --assert --report=artifacts/gh67/electron-<os>-100k.json
```

O benchmark Electron deve ser repetido em Windows, Linux e macOS. Um comando que não possa executar na máquina declarada, gere JSON inválido ou falhe qualquer gate bloqueia a habilitação de persistência; não é permitido substituir o resultado por medição manual ou aproximada.

## 10. Critérios de aceite

A implementação só está pronta quando todos os pontos abaixo passarem:

1. Dois chats de mesmo título retornam resultados distintos por `archiveId`; esquecer um não altera o outro.
2. `savePersistedChat`, restore, toggle, referências de arquivo, preferences, bookmarks e navegação usam chave canônica; nenhuma operação destrutiva faz lookup por título.
3. Sem consentimento, nenhum shard/manifesto/plaintext é persistido; chats carregados ainda são pesquisáveis na sessão.
4. Metadados/transcrições legados não são transformados em corpus global, mesmo se já estiverem no IndexedDB.
5. Commit interrompido, quota, corrupção e cancelamento preservam a geração anterior e não retornam dados staging.
6. Fechar, remover da biblioteca e apagar todos os índices respeitam exatamente a semântica da seção 5, com readback para remoção.
7. Índice desconhecido, stale ou corrompido não contribui resultados.
8. Resultado abre a mensagem correta ou pede a fonte; jamais abre mensagem aproximada.
9. Consulta, filtro, snippets e destaque preservam texto puro e escapado, cancelam resultados antigos e paginam em 50.
10. Network/log harness passa e os logs existentes com conteúdo de chat foram removidos.
11. `npm run test:global-search` passa no CI; `npm run verify:global-search` passa no perfil desktop declarado; e os três comandos de release da seção 9 passam com `--assert` antes de habilitar persistência nesse release.
12. `npm run lint`, `npm run check` e `npm run build` passam; textos novos têm chaves Paraglide e fluxo de teclado/foco/`aria-live` é validado.

## 11. Sequência de implementação após aprovação

1. Instalar/configurar o harness fixado na seção 9 e escrever o gerador sintético + contratos iniciais que falham.
2. Identidade e migração dos fluxos title-keyed, com regressões de duplicidade e remoção.
3. Serviço de persistência versionada/consentimento/cleanup/rollback e testes de atomicidade.
4. Worker streaming, contratos de consulta/filtros/cancelamento e benchmarks sintéticos.
5. Estado Svelte, UI acessível, Paraglide e navegação cross-chat.
6. Integração Web/Electron, network/log harness, benchmark de release e revisão final.

Não criar cards de implementação antes de a revisão adversarial desta revisão retornar explicitamente `ready_for_implementation_decomposition`.
