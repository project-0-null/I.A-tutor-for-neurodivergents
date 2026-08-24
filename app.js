/**
 * Tutor Educacional Acessível — app.js
 * JavaScript puro (sem frameworks). Responsável por:
 *  - Preferências de acessibilidade (fonte, tamanho, espaçamento, contraste, modo simples)
 *  - Renderização das mensagens do chat (com lista/negrito) de forma segura (sem HTML injetado)
 *  - Integração com a API local em FastAPI (http://localhost:8000/api/chat)
 */

(() => {
  'use strict';

  /* ------------------------------------------------------------------------
   * Configuração
   * ---------------------------------------------------------------------- */
  const API_URL = (window.location.protocol.startsWith('http') && (window.location.port === '8000' || window.location.pathname.startsWith('/api')))
    ? '/api/chat'
    : 'http://localhost:8000/api/chat';
  const STORAGE_KEY = 'tutorA11y.prefs.v1';
  const MAX_HISTORY_MESSAGES = 20; // limite de mensagens enviadas no campo "history"
  const FONT_SCALE_STEPS = [0.9, 1, 1.1, 1.2, 1.3];

  const FONT_STACKS = {
    lexend: 'var(--font-default)',
    arial: 'var(--font-arial)',
    dyslexic: 'var(--font-dyslexic)',
  };

  /* ------------------------------------------------------------------------
   * Referências de DOM
   * ---------------------------------------------------------------------- */
  const dom = {
    html: document.documentElement,
    body: document.body,
    statusAnnouncer: document.getElementById('status-announcer'),

    btnModoSimples: document.getElementById('btn-modo-simples'),

    campoHiperfoco: document.getElementById('campo-hiperfoco'),

    fontButtons: Array.from(document.querySelectorAll('.option-btn[data-font]')),
    btnSizeInc: document.getElementById('btn-size-inc'),
    btnSizeDec: document.getElementById('btn-size-dec'),
    sizeLabel: document.getElementById('size-label'),

    chkModoEscuro: document.getElementById('chk-modo-escuro'),
    chkEspacamento: document.getElementById('chk-espacamento'),
    chkReduzirCores: document.getElementById('chk-reduzir-cores'),
    chkContraste: document.getElementById('chk-contraste'),

    energyButtons: Array.from(document.querySelectorAll('.energy-gauge__seg')),
    btnSimplificarAgora: document.getElementById('btn-simplificar-agora'),

    chatLog: document.getElementById('chat-log'),
    quickPromptButtons: Array.from(document.querySelectorAll('.chip-btn[data-prompt]')),

    form: document.getElementById('chat-form'),
    campoMensagem: document.getElementById('campo-mensagem'),
    btnEnviar: document.getElementById('btn-enviar'),
  };

  /* ------------------------------------------------------------------------
   * Estado
   * ---------------------------------------------------------------------- */

  /** Histórico da conversa, mantido em memória e enviado a cada requisição. */
  let conversationHistory = [];

  /** Preferências de acessibilidade, persistidas em localStorage entre sessões. */
  let prefs = {
    darkMode: false,
    font: 'lexend',
    fontScaleIndex: 1, // aponta para FONT_SCALE_STEPS -> 1.0
    spacing: false,
    reduceColor: false,
    highContrast: false,
    simpleMode: false,
    energyLevel: null,
    hiperfoco: '',
  };

  /** Indica se o usuário já escolheu manualmente claro/escuro alguma vez. */
  let darkModeIsExplicit = false;

  function systemPrefersDark() {
    return Boolean(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }

  function loadPrefs() {
    let saved = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) saved = JSON.parse(raw);
    } catch (err) {
      // localStorage indisponível (ex.: navegação privada). Segue com padrões.
      console.warn('Não foi possível carregar preferências salvas:', err);
    }

    if (saved && typeof saved === 'object') {
      prefs = Object.assign(prefs, saved);
    }

    // Só usamos o tema claro/escuro do sistema operacional se o usuário
    // nunca tiver escolhido manualmente nesse navegador.
    darkModeIsExplicit = Boolean(saved && Object.prototype.hasOwnProperty.call(saved, 'darkMode'));
    if (!darkModeIsExplicit) {
      prefs.darkMode = systemPrefersDark();
    }
  }

  /** Acompanha o SO em tempo real enquanto o usuário não fizer uma escolha manual. */
  function watchSystemColorScheme() {
    if (!window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (event) => {
      if (darkModeIsExplicit) return; // usuário já decidiu; não sobrescrevemos
      prefs.darkMode = event.matches;
      applyPrefs();
    };
    // addEventListener é o padrão atual; addListener é fallback para navegadores antigos
    if (mq.addEventListener) mq.addEventListener('change', handler);
    else if (mq.addListener) mq.addListener(handler);
  }

  function savePrefs() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch (err) {
      console.warn('Não foi possível salvar preferências:', err);
    }
  }

  /* ------------------------------------------------------------------------
   * Aplicação das preferências na interface
   * ---------------------------------------------------------------------- */
  function applyPrefs() {
    // Modo escuro
    dom.html.classList.toggle('dark-mode', prefs.darkMode);
    dom.chkModoEscuro.checked = prefs.darkMode;

    // Fonte
    dom.html.style.setProperty('--font-active', FONT_STACKS[prefs.font] || FONT_STACKS.lexend);
    dom.fontButtons.forEach((btn) => {
      btn.setAttribute('aria-pressed', String(btn.dataset.font === prefs.font));
    });

    // Tamanho do texto
    const scale = FONT_SCALE_STEPS[prefs.fontScaleIndex];
    dom.html.style.setProperty('--font-scale', String(scale));
    dom.sizeLabel.textContent = `${Math.round(scale * 100)}%`;

    // Espaçamento ampliado
    dom.html.classList.toggle('spacing-ampla', prefs.spacing);
    dom.chkEspacamento.checked = prefs.spacing;

    // Reduzir cores/estímulos
    dom.html.classList.toggle('reduce-color', prefs.reduceColor);
    dom.chkReduzirCores.checked = prefs.reduceColor;

    // Alto contraste
    dom.html.classList.toggle('high-contrast', prefs.highContrast);
    dom.chkContraste.checked = prefs.highContrast;

    // Modo simples
    dom.body.classList.toggle('simple-mode', prefs.simpleMode);
    dom.btnModoSimples.setAttribute('aria-pressed', String(prefs.simpleMode));

    // Nível de energia (visual apenas — não é enviado à API)
    dom.energyButtons.forEach((btn) => {
      btn.setAttribute('aria-pressed', String(btn.dataset.level === prefs.energyLevel));
    });

    // Hiperfoco
    if (dom.campoHiperfoco.value !== prefs.hiperfoco) {
      dom.campoHiperfoco.value = prefs.hiperfoco;
    }
  }

  /* ------------------------------------------------------------------------
   * Handlers de preferências
   * ---------------------------------------------------------------------- */
  function initPreferenceControls() {
    dom.fontButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        prefs.font = btn.dataset.font;
        savePrefs();
        applyPrefs();
      });
    });

    dom.btnSizeInc.addEventListener('click', () => {
      prefs.fontScaleIndex = Math.min(prefs.fontScaleIndex + 1, FONT_SCALE_STEPS.length - 1);
      savePrefs();
      applyPrefs();
    });

    dom.btnSizeDec.addEventListener('click', () => {
      prefs.fontScaleIndex = Math.max(prefs.fontScaleIndex - 1, 0);
      savePrefs();
      applyPrefs();
    });

    dom.chkModoEscuro.addEventListener('change', () => {
      prefs.darkMode = dom.chkModoEscuro.checked;
      darkModeIsExplicit = true;
      savePrefs();
      applyPrefs();
      announce(prefs.darkMode ? 'Modo escuro ativado.' : 'Modo escuro desativado.');
    });

    dom.chkEspacamento.addEventListener('change', () => {
      prefs.spacing = dom.chkEspacamento.checked;
      savePrefs();
      applyPrefs();
    });

    dom.chkReduzirCores.addEventListener('change', () => {
      prefs.reduceColor = dom.chkReduzirCores.checked;
      savePrefs();
      applyPrefs();
    });

    dom.chkContraste.addEventListener('change', () => {
      prefs.highContrast = dom.chkContraste.checked;
      savePrefs();
      applyPrefs();
    });

    dom.btnModoSimples.addEventListener('click', () => {
      prefs.simpleMode = !prefs.simpleMode;
      // Ao ativar o modo simples, garante um tamanho de texto minimamente maior,
      // sem sobrescrever uma escolha do usuário que já seja maior que isso.
      if (prefs.simpleMode) {
        prefs.fontScaleIndex = Math.max(prefs.fontScaleIndex, 2); // 1.1x
      }
      savePrefs();
      applyPrefs();
      announce(prefs.simpleMode ? 'Modo simples ativado.' : 'Modo simples desativado.');
    });

    dom.energyButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const level = btn.dataset.level;
        prefs.energyLevel = prefs.energyLevel === level ? null : level;
        savePrefs();
        applyPrefs();
      });
    });

    dom.btnSimplificarAgora.addEventListener('click', () => {
      prefs.simpleMode = true;
      prefs.spacing = true;
      prefs.reduceColor = true;
      prefs.fontScaleIndex = Math.max(prefs.fontScaleIndex, 2);
      savePrefs();
      applyPrefs();
      announce('Interface simplificada.');
    });

    dom.campoHiperfoco.addEventListener('input', () => {
      prefs.hiperfoco = dom.campoHiperfoco.value;
      savePrefs();
    });
  }

  /* ------------------------------------------------------------------------
   * Acessibilidade: anúncios para leitor de tela
   * ---------------------------------------------------------------------- */
  function announce(message) {
    dom.statusAnnouncer.textContent = '';
    // pequeno atraso garante que leitores de tela percebam a mudança de texto
    window.setTimeout(() => {
      dom.statusAnnouncer.textContent = message;
    }, 50);
  }

  /* ------------------------------------------------------------------------
   * Formatação de texto (markdown leve e seguro)
   * Suporta: **negrito**, listas com "- " / "* " e listas numeradas "1. "
   * O texto é sempre escapado primeiro para evitar HTML malicioso vindo da API.
   * ---------------------------------------------------------------------- */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function applyInlineFormatting(escapedLine) {
    return escapedLine
      // `código inline` -> <code>código inline</code>
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // **negrito** -> <strong>negrito</strong> (já escapado, seguro para inserir)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // *itálico* -> <em>itálico</em>
      .replace(/(^|[^*])\*([^*]+)\*([^*]|$)/g, '$1<em>$2</em>$3');
  }

  function formatMessageToHtml(rawText) {
    const lines = String(rawText).replace(/\r\n/g, '\n').split('\n');
    const htmlParts = [];

    let listBuffer = [];
    let listType = null; // 'ul' | 'ol'

    const flushList = () => {
      if (listBuffer.length === 0) return;
      const tag = listType === 'ol' ? 'ol' : 'ul';
      htmlParts.push(`<${tag}>${listBuffer.join('')}</${tag}>`);
      listBuffer = [];
      listType = null;
    };

    lines.forEach((line) => {
      const trimmed = line.trim();

      if (trimmed === '') {
        flushList();
        return;
      }

      const bulletMatch = /^[-*]\s+(.*)$/.exec(trimmed);
      const numberedMatch = /^\d+[.)]\s+(.*)$/.exec(trimmed);

      if (bulletMatch) {
        if (listType !== 'ul') flushList();
        listType = 'ul';
        listBuffer.push(`<li>${applyInlineFormatting(escapeHtml(bulletMatch[1]))}</li>`);
        return;
      }

      if (numberedMatch) {
        if (listType !== 'ol') flushList();
        listType = 'ol';
        listBuffer.push(`<li>${applyInlineFormatting(escapeHtml(numberedMatch[1]))}</li>`);
        return;
      }

      flushList();
      htmlParts.push(`<p>${applyInlineFormatting(escapeHtml(trimmed))}</p>`);
    });

    flushList();
    return htmlParts.join('') || `<p>${escapeHtml(String(rawText))}</p>`;
  }

  /* ------------------------------------------------------------------------
   * Renderização do chat
   * ---------------------------------------------------------------------- */
  function scrollChatToEnd() {
    dom.chatLog.scrollTop = dom.chatLog.scrollHeight;
  }

  function appendMessage({ role, html, plainTextForHistory }) {
    const wrapper = document.createElement('div');
    wrapper.className = `message message--${role}`;

    const author = document.createElement('p');
    author.className = 'message__author';
    author.textContent = role === 'user' ? 'Você' : role === 'tutor' ? 'Tutor' : 'Aviso';

    const bubble = document.createElement('div');
    bubble.className = 'message__bubble';
    bubble.innerHTML = html;

    wrapper.appendChild(author);
    wrapper.appendChild(bubble);
    dom.chatLog.appendChild(wrapper);
    scrollChatToEnd();

    return { wrapper, plainTextForHistory };
  }

  function appendUserMessage(text) {
    appendMessage({
      role: 'user',
      html: formatMessageToHtml(text),
      plainTextForHistory: text,
    });
  }

  function appendTutorMessage(text) {
    appendMessage({
      role: 'tutor',
      html: formatMessageToHtml(text),
      plainTextForHistory: text,
    });
  }

  function appendSystemMessage(text, { danger = false } = {}) {
    const wrapper = document.createElement('div');
    wrapper.className = `message message--system${danger ? ' message--danger' : ''}`;

    const author = document.createElement('p');
    author.className = 'message__author';
    author.textContent = 'Aviso';

    const bubble = document.createElement('div');
    bubble.className = 'message__bubble';
    bubble.setAttribute('role', 'status');
    bubble.innerHTML = `<p>${escapeHtml(text)}</p>`;

    wrapper.appendChild(author);
    wrapper.appendChild(bubble);
    dom.chatLog.appendChild(wrapper);
    scrollChatToEnd();
  }

  function showLoadingIndicator() {
    const wrapper = document.createElement('div');
    wrapper.className = 'message message--tutor';
    wrapper.id = 'loading-indicator';

    const author = document.createElement('p');
    author.className = 'message__author';
    author.textContent = 'Tutor';

    const bubble = document.createElement('div');
    bubble.className = 'message__bubble';
    bubble.setAttribute('role', 'status');
    bubble.setAttribute('aria-label', 'Tutor está preparando uma resposta');
    bubble.innerHTML = '<span class="loading-dots"><span></span><span></span><span></span></span>';

    wrapper.appendChild(author);
    wrapper.appendChild(bubble);
    dom.chatLog.appendChild(wrapper);
    scrollChatToEnd();
  }

  function hideLoadingIndicator() {
    const el = document.getElementById('loading-indicator');
    if (el) el.remove();
  }

  /* ------------------------------------------------------------------------
   * Integração com a API
   * ---------------------------------------------------------------------- */
  function buildHistoryPayload() {
    // Envia só as últimas N mensagens para manter o payload enxuto.
    return conversationHistory.slice(-MAX_HISTORY_MESSAGES);
  }

  async function parseErrorDetail(response) {
    try {
      const data = await response.clone().json();
      return data.detail || data.message || data.error || '';
    } catch (_err) {
      try {
        const text = await response.clone().text();
        return text.slice(0, 200);
      } catch (_err2) {
        return '';
      }
    }
  }

  function friendlyErrorMessage(kind, detail, status) {
    switch (kind) {
      case 'network':
        return 'Não consegui me conectar ao tutor. Verifique se o servidor está rodando em http://localhost:8000 e tente novamente.';
      case 'rate-limit':
        return detail
          ? `Muitas perguntas em pouco tempo: ${detail}`
          : 'Você fez perguntas rápido demais. Sem problema — espere um instante e tente de novo.';
      case 'server':
        return detail
          ? `Algo não saiu como esperado: ${detail}`
          : `Algo não saiu como esperado (erro ${status}). Tente novamente em instantes.`;
      case 'parse':
      default:
        return 'A resposta do servidor veio em um formato inesperado. Tente novamente.';
    }
  }

  /**
   * Envia a mensagem do aluno para a API e trata a resposta (ou erro).
   * @param {string} messageText
   */
  async function sendMessage(messageText) {
    const trimmed = messageText.trim();
    if (!trimmed) return;

    setFormBusy(true);
    appendUserMessage(trimmed);
    showLoadingIndicator();

    const payload = {
      message: trimmed,
      hiperfoco: prefs.hiperfoco.trim() ? prefs.hiperfoco.trim() : null,
      history: buildHistoryPayload(),
    };

    let response;
    try {
      response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (networkErr) {
      hideLoadingIndicator();
      const msg = friendlyErrorMessage('network');
      appendSystemMessage(msg, { danger: true });
      announce(msg);
      setFormBusy(false);
      return;
    }

    if (!response.ok) {
      hideLoadingIndicator();
      const detail = await parseErrorDetail(response);
      const kind = response.status === 429 ? 'rate-limit' : 'server';
      const msg = friendlyErrorMessage(kind, detail, response.status);
      appendSystemMessage(msg, { danger: response.status >= 500 });
      announce(msg);
      setFormBusy(false);
      return;
    }

    let data;
    try {
      data = await response.json();
    } catch (parseErr) {
      hideLoadingIndicator();
      const msg = friendlyErrorMessage('parse');
      appendSystemMessage(msg, { danger: true });
      announce(msg);
      setFormBusy(false);
      return;
    }

    // A API pode nomear o campo de resposta de formas diferentes;
    // tentamos as chaves mais comuns antes de desistir.
    const replyText =
      (typeof data === 'string' && data) ||
      data.reply ||
      data.response ||
      data.message ||
      data.content ||
      null;

    hideLoadingIndicator();

    if (replyText == null) {
      const msg = friendlyErrorMessage('parse');
      appendSystemMessage(msg, { danger: true });
      announce(msg);
      setFormBusy(false);
      return;
    }

    appendTutorMessage(replyText);
    conversationHistory.push({ role: 'user', content: trimmed });
    conversationHistory.push({ role: 'assistant', content: replyText });

    setFormBusy(false);
  }

  function setFormBusy(isBusy) {
    dom.btnEnviar.disabled = isBusy;
    dom.campoMensagem.disabled = isBusy;
    dom.quickPromptButtons.forEach((btn) => {
      btn.disabled = isBusy;
    });
    if (!isBusy) {
      dom.campoMensagem.focus();
    }
  }

  /* ------------------------------------------------------------------------
   * Formulário e ações rápidas
   * ---------------------------------------------------------------------- */
  const QUICK_PROMPT_TEXT = {
    simplificar: 'Pode simplificar a última explicação, com palavras mais simples?',
    exemplo: 'Pode me dar um exemplo prático sobre isso?',
    resumo: 'Pode resumir isso em tópicos curtos?',
    'passo-a-passo': 'Pode explicar isso passo a passo?',
  };

  function autoResizeTextarea() {
    dom.campoMensagem.style.height = 'auto';
    dom.campoMensagem.style.height = `${Math.min(dom.campoMensagem.scrollHeight, 160)}px`;
  }

  function initChatForm() {
    dom.form.addEventListener('submit', (event) => {
      event.preventDefault();
      const text = dom.campoMensagem.value;
      if (!text.trim()) return;
      dom.campoMensagem.value = '';
      autoResizeTextarea();
      sendMessage(text);
    });

    dom.campoMensagem.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        dom.form.requestSubmit();
      }
    });

    dom.campoMensagem.addEventListener('input', autoResizeTextarea);

    dom.quickPromptButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const text = QUICK_PROMPT_TEXT[btn.dataset.prompt];
        if (text) sendMessage(text);
      });
    });
  }

  /* ------------------------------------------------------------------------
   * Inicialização
   * ---------------------------------------------------------------------- */
  function init() {
    loadPrefs();
    applyPrefs();
    watchSystemColorScheme();
    initPreferenceControls();
    initChatForm();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
