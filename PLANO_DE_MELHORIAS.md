# 📋 Plano Mestre de Melhorias — Tutor Educacional Inclusivo (ONG Quebra-Cabeça)

> **Como usar este arquivo em conversas futuras:**
> Basta mencionar `@PLANO_DE_MELHORIAS.md` no chat e pedir: *"Implemente o plano de melhorias na branch `melhorias`"* (ou pedir uma fase específica, ex.: *"Implemente a Fase 1 do @PLANO_DE_MELHORIAS.md"*).

---

## 🌿 Estratégia de Branches e Ambiente de Testes (GitHub Pages + Cloudflare Preview)

Para nunca arriscar o site principal que já está no ar na Cloudflare (`https://i-a-tutor-for-neurodivergents.miguelmagal0802.workers.dev`), todo o desenvolvimento das novas funcionalidades será feito em uma **branch separada chamada `melhorias`**:

1. **Criação da Branch de Testes:**
   ```bash
   git checkout -b melhorias
   ```
2. **Como Testar Visualmente no GitHub Pages (ou Cloudflare Preview):**
   - **No GitHub Pages:** No repositório GitHub, em **Settings → Pages**, selecione a branch **`melhorias`** (pasta `/ (root)`). O site de testes ficará disponível em:
     `https://project-0-null.github.io/I.A-tutor-for-neurodivergents/`
   - **Integração Automática com a IA no GitHub Pages:** O `app.js` na branch `melhorias` detecta automaticamente quando está rodando em `*.github.io` e envia as chamadas de `/api/chat` para o backend na Cloudflare (`https://i-a-tutor-for-neurodivergents.miguelmagal0802.workers.dev/api/chat`).
   - **Na Cloudflare (Preview URL):** Ao fazer `git push origin melhorias`, a Cloudflare também gera uma URL de *Preview* exclusiva para testar o frontend + backend da branch `melhorias` isoladamente.
3. **Como Juntar na `main` (Merge) Depois de Tudo Polido e Aprovado:**
   ```bash
   git checkout main
   git merge melhorias
   git push origin main
   ```
   Assim que o `git push origin main` for executado, a Cloudflare atualizará o site oficial automaticamente!

---

## 🚀 Roteiro Detalhado de Implementação (Dividido em 4 Fases)

### Fase 0: Configuração da Branch `melhorias` e Suporte ao GitHub Pages
- [x] **0.1. Criar branch `melhorias`**: Executar `git checkout -b melhorias`.
- [x] **0.2. Detectar GitHub Pages no `app.js`**: Na constante `API_URL` (`app.js`, linhas 19–41), quando `window.location.hostname.endsWith('.github.io')`, retornar `'https://i-a-tutor-for-neurodivergents.miguelmagal0802.workers.dev/api/chat'`.

---

### Fase 1: Pedagogia e Acessibilidade Neurodivergente (TEA, TDAH, Dislexia)

- [x] **1.1. Conectar o "Medidor de Energia" (`energyLevel`) à IA e à Interface (`app.js`, `functions/api/chat.js`, `main.py`)**
  - Enviar o campo `energy_level` (`"alta"`, `"media"`, `"baixa"`, `"sobrecarregada"`) no corpo do `POST /api/chat`.
  - No backend (`functions/api/chat.js` e `main.py`), adicionar instrução contextual conforme a energia:
    - `baixa`: frases mais curtas, menor densidade de informação por frase, tom extra paciente.
    - `sobrecarregada`: explicação ultra-enxuta (parágrafos de no máximo 2 frases curtas, linguagem extremamente simples e acolhedora, um conceito de cada vez).
  - Na interface (`app.js`), ao clicar em `Sobrecarregado(a)`, sugerir ou ativar automaticamente o Modo Simples para reduzir estímulos visuais imediata e previsivelmente.

- [ ] **1.2. Botões "🔊 Ouvir explicação" (TTS) e "📋 Copiar" nas Mensagens do Tutor (`app.js`, `style.css`)**
  - Adicionar barra de ações no rodapé de cada mensagem do Tutor com:
    - **Botão `🔊 Ouvir` / `⏹️ Parar`**: usa `window.speechSynthesis` nativo em `pt-BR`, removendo delimitadores LaTeX (`$`, `$$`, `\frac`, etc.) antes da leitura para que a voz não soe robótica. Cancela leituras anteriores ao iniciar uma nova ou ao limpar o chat.
    - **Botão `📋 Copiar`**: copia o texto da resposta (incluindo transcrições de exercícios) para a área de transferência (`navigator.clipboard.writeText`), muda temporariamente para `✔ Copiado!` e anuncia no leitor de tela.

- [ ] **1.3. Ditado por Voz (Microfone `🎤` / Speech-to-Text) no Formulário (`index.html`, `app.js`, `style.css`)**
  - Detectar suporte a `window.SpeechRecognition || window.webkitSpeechRecognition`.
  - Exibir botão `🎤` ao lado do botão de anexar foto, permitindo ditar a pergunta em `pt-BR` direto para o `#campo-mensagem` com indicador visual de gravação ativa.

- [ ] **1.4. Resolver Conflito entre "Chips de Ação Rápida" e Regra 4 do System Prompt (`functions/api/chat.js`, `main.py`)**
  - Ajustar a Regra 4 do `SYSTEM_INSTRUCTION`: manter `EXATAMENTE DOIS (2) PARÁGRAFOS CURTOS + TRÊS (3) BULLET POINTS` como estrutura padrão obrigatória para explicações conceituais, mas permitir que pedidos explícitos de formato feitos pelo aluno (como *"Explique passo a passo"* em passos numerados ou *"Resuma em tópicos curtos"*) sejam atendidos diretamente.

---

### Fase 2: Usabilidade (UX), Mobile e Previsibilidade Sensorial

- [ ] **2.1. Preservar Pergunta/Foto em Caso de Erro + Botão "🔄 Tentar novamente" (`app.js`, `style.css`)**
  - Quando ocorrer falha de rede ou erro `429`/`503`/`502`, armazenar o último payload (`{ text, image }`) e renderizar um botão **"🔄 Tentar novamente"** dentro do card de aviso do sistema para reenviar com 1 clique, sem obrigar o aluno a redigitar a pergunta ou anexar a foto novamente.

- [ ] **2.2. Melhorias no Anexo de Imagens: Galeria no Mobile + `Ctrl+V` + Fallback de HEIC (`index.html`, `app.js`)**
  - Remover `capture="environment"` do `<input id="campo-imagem">` em `index.html` para que o celular permita escolher entre **Tirar Foto (Câmera)** ou **Escolher da Galeria**.
  - Adicionar listener de `paste` (`Ctrl+V`) no `#campo-mensagem` para colar prints de exercícios diretamente da área de transferência.
  - Exibir estado visual *"Otimizando imagem..."* durante a compressão no `<canvas>` e tratar `onerror` na miniatura `#image-preview-thumb` para formatos `.heic`.

- [ ] **2.3. Painel de Conforto Recolhido no Mobile + Seta Indicadora (`▼`) + Estados `A-`/`A+` (`index.html`, `style.css`, `app.js`)**
  - Adicionar ícone de seta (`chevron`) no `<summary class="comfort-panel__summary">` que gira suavemente quando aberto (`details[open]`).
  - Em telas mobile (`window.innerWidth <= 900`), iniciar o painel recolhido na primeira visita para que o chat fique imediatamente visível.
  - Desabilitar (`disabled = true`) o botão `A-` no limite mínimo (`90%`) e o botão `A+` no limite máximo (`130%`), e chamar `announce()` em todas as alterações de preferências (fonte, espaçamento, cores, contraste, energia).

- [ ] **2.4. Substituir `window.confirm()` Nativo ao Limpar Conversa (`index.html`, `style.css`, `app.js`)**
  - Trocar a janela nativa `window.confirm()` por uma confirmação integrada ao tema do site (respeitando Modo Escuro, fonte selecionada e escala de texto).

---

### Fase 3: Estabilidade Técnica, Segurança, LaTeX e PWA

- [ ] **3.1. Proteção de LaTeX Inline (`$ ... $`), Moeda (`R$`) e Timing do KaTeX (`app.js`)**
  - Extrair fórmulas inline `$ ... $` com placeholders `@@MATHINLINE@@` antes de aplicar negrito/itálico em `renderSafeMarkdown()`, ignorando cifras monetárias (`R$`).
  - Mover a checagem `typeof window.renderMathInElement !== 'function'` do `DOMContentLoaded` para dentro de `window.addEventListener('load', ...)`, evitando falso alarme de erro quando a CDN carrega alguns milissegundos depois.
  - Atualizar `friendlyErrorMessage()` para não mencionar `http://localhost:8000` quando o site estiver rodando em produção na nuvem.

- [ ] **3.2. Otimização de CPU no Cloudflare Worker + Sanitização de `hiperfoco` + CORS (`functions/api/chat.js`, `worker.js`, `main.py`)**
  - Em `validateAndCleanImage()` (`functions/api/chat.js`), calcular o tamanho binário do Base64 em $O(1)$ (`(compact.length * 3) / 4 - padding`) sem decodificar megabytes com `atob()`, garantindo execução abaixo do limite de 10ms de CPU do plano gratuito da Cloudflare.
  - Sanitizar colchetes e quebras de linha no campo `hiperfoco` (`replace(/[\[\]\r\n]+/g, ' ')`) antes de interpolar na instrução, prevenindo Prompt Injection.
  - Adicionar cabeçalho `Vary: Origin` nas respostas CORS e limpar detalhes internos do erro `401`.
  - Alinhar `MAX_HISTORY_MESSAGES` no `app.js` com `MAX_HISTORY_ITEMS` no backend.

- [ ] **3.3. Suporte a PWA Instalável (`manifest.json` + Favicon) (`index.html`, `manifest.json`, `wrangler.toml`, `main.py`)**
  - Criar `manifest.json` com nome, cores do tema e ícone (`logo.jpg`).
  - Adicionar `<link rel="icon" href="logo.jpg">` e `<link rel="manifest" href="manifest.json">` no `index.html`.
  - Incluir `manifest.json` na cópia automática do `[build]` no `wrangler.toml` e em `ALLOWED_STATIC_FILES` no `main.py`.
