/**
 * Cloudflare Pages Function — POST /api/chat
 * Backend Serverless equivalente ao main.py (FastAPI) para rodar 100% gratuito
 * na nuvem da Cloudflare Pages.
 */

const SYSTEM_INSTRUCTION = `
Você é um tutor educacional especializado no atendimento a estudantes neurodivergentes.
Suas diretrizes de comunicação são fundamentais e devem ser seguidas com rigor absoluto:

1. Comunicação Literal e Objetiva: Utilize linguagem clara, direta, concreta e sem ambiguidades. Evite sarcasmo, ironia, expressões de duplo sentido, metáforas complexas e figuras de linguagem.
2. Tom de Voz: Seja acolhedor, altamente paciente e mantenha baixa verbosidade (vá direto ao ponto sem enrolação).
3. Adaptação a Hiperfoco: Se um tema de hiperfoco for informado no contexto da mensagem, use analogias e exemplos estritamente ligados a esse tema para facilitar o aprendizado. Se não for informado, explique de forma simples e direta.
4. ESTRUTURA DE RESPOSTA OBRIGATÓRIA PARA EXPLICAÇÕES:
   - Toda explicação conceitual deve ser composta inicialmente por EXATAMENTE DOIS (2) PARÁGRAFOS CURTOS.
   - Imediatamente após os dois parágrafos, inclua um resumo final contendo EXATAMENTE TRÊS (3) BULLET POINTS (utilizando '-') destacando os pontos principais.
5. Fórmulas e Notação Matemática: Sempre que apresentar fórmulas, equações ou símbolos matemáticos e científicos, use notação LaTeX padrão:
   - Fórmulas inline (no meio da frase): use delimitadores \`$ ... $\` (exemplo: \`$E = mc^2$\`).
   - Equações em bloco (destaque em linha separada): use delimitadores \`$$ ... $$\` (exemplo: \`$$x = \\frac{-b \\pm \\sqrt{\\Delta}}{2a}$$\`).
   - Não use blocos de código markdown (como \`\`\`latex ou \`\`\`math) para renderizar fórmulas matemáticas; utilize diretamente os delimitadores $ ou $$.
6. Transcrição e Análise de Imagens (OCR / Fotos de Exercícios):
   Se o aluno enviar uma imagem contendo texto ou fórmulas (página de livro, exercício, anotação ou lousa):
   - Inicie OBRIGATORIAMENTE com o cabeçalho:
     ### 📝 Transcrição da Imagem
   - Transcreva todo o conteúdo visível de forma literal e fiel, mantendo quebras de linha e formatando fórmulas matemáticas em LaTeX conforme a regra 5.
   - Se a imagem estiver ilegível, borrada ou sem texto identificável, escreva apenas: "Não foi possível ler o texto com clareza nesta imagem. Tente enviar uma foto mais nítida ou aproximada."
   - Se o aluno NÃO fez uma pergunta e enviou apenas a foto (ou pediu apenas transcrição), finalize aqui sem explicações extras.
   - Se o aluno FEZ uma pergunta ou pediu para resolver/explicar o conteúdo da imagem, adicione um separador \`---\` e o cabeçalho:
     ### 💡 Explicação
     Em seguida, desenvolva a explicação pedagógica seguindo com rigor a estrutura da regra 4 (exatamente 2 parágrafos curtos + 3 tópicos com '-').
`;

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;
const RETRY_MAX_DELAY_MS = 6000;
const RETRY_JITTER_MS = 500;
const SAFETY_REASONS = new Set([
  "SAFETY",
  "BLOCKLIST",
  "PROHIBITED_CONTENT",
  "SPII",
  "RECITATION",
]);

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, ngrok-skip-browser-warning",
    "Content-Type": "application/json; charset=utf-8",
  };
}

function jsonError(status, detail, request) {
  return new Response(JSON.stringify({ detail }), {
    status,
    headers: corsHeaders(request),
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function validateAndCleanImage(imageBase64, mimeType) {
  const normalizedMime = (mimeType || "").toLowerCase().trim();
  if (!normalizedMime || !ALLOWED_IMAGE_MIME_TYPES.has(normalizedMime)) {
    const allowed = Array.from(ALLOWED_IMAGE_MIME_TYPES).sort().join(", ");
    const err = new Error(`Tipo de imagem não suportado. Use um destes formatos: ${allowed}`);
    err.status = 400;
    throw err;
  }

  const trimmed = imageBase64.trim();
  const cleaned = trimmed.startsWith("data:")
    ? trimmed.split(",", 2)[1] || ""
    : trimmed;

  const compact = cleaned.replace(/\s+/g, "");
  if (!compact || !/^[A-Za-z0-9+/]+={0,2}$/.test(compact) || compact.length % 4 !== 0) {
    const err = new Error(
      "Não foi possível decodificar a imagem enviada. Tente anexar o arquivo novamente."
    );
    err.status = 400;
    throw err;
  }

  let binaryLength = 0;
  try {
    const decoded = atob(compact);
    binaryLength = decoded.length;
  } catch {
    const err = new Error(
      "Não foi possível decodificar a imagem enviada. Tente anexar o arquivo novamente."
    );
    err.status = 400;
    throw err;
  }

  if (binaryLength === 0) {
    const err = new Error("A imagem enviada está vazia.");
    err.status = 400;
    throw err;
  }

  if (binaryLength > MAX_IMAGE_BYTES) {
    const err = new Error(
      `Imagem muito grande. O tamanho máximo é ${Math.floor(MAX_IMAGE_BYTES / (1024 * 1024))} MB.`
    );
    err.status = 413;
    throw err;
  }

  return { base64Data: compact, mimeType: normalizedMime };
}

async function callGeminiWithRetry({ apiKey, model, fallbackModel, contents }) {
  let currentModel = model;
  let attempt = 0;
  let usedFallback = false;

  const requestBody = {
    systemInstruction: {
      parts: [{ text: SYSTEM_INSTRUCTION }],
    },
    contents,
    generationConfig: {
      temperature: 0.1,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 1000,
    },
  };

  while (true) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      currentModel
    )}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (response.ok) {
      return await response.json();
    }

    const statusCode = response.status || 500;
    let errText = "";
    try {
      errText = await response.text();
    } catch {
      errText = "";
    }

    const lowerErr = errText.toLowerCase();
    const isNotFound =
      statusCode === 404 ||
      lowerErr.includes("404") ||
      lowerErr.includes("not_found") ||
      lowerErr.includes("not found");

    const canFallback = Boolean(
      fallbackModel && !usedFallback && fallbackModel !== currentModel
    );

    if (
      canFallback &&
      (isNotFound ||
        [404, 500, 502, 503, 504].includes(statusCode) ||
        !RETRYABLE_STATUS_CODES.has(statusCode))
    ) {
      currentModel = fallbackModel;
      usedFallback = true;
      attempt = 0;
      continue;
    }

    if (RETRYABLE_STATUS_CODES.has(statusCode) && attempt < MAX_RETRIES) {
      attempt += 1;
      const baseDelay = Math.min(
        RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1),
        RETRY_MAX_DELAY_MS
      );
      const jitter = Math.random() * RETRY_JITTER_MS;
      await sleep(baseDelay + jitter);
      continue;
    }

    if (canFallback) {
      currentModel = fallbackModel;
      usedFallback = true;
      attempt = 0;
      continue;
    }

    const apiErr = new Error(errText || `HTTP ${statusCode}`);
    apiErr.statusCode = statusCode;
    throw apiErr;
  }
}

export async function onRequestOptions(context) {
  return new Response(null, {
    status: 200,
    headers: corsHeaders(context.request),
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const apiKey = env.GEMINI_API_KEY;

  if (!apiKey) {
    return jsonError(
      500,
      "Configuração ausente no servidor: defina a variável GEMINI_API_KEY nas configurações do Cloudflare Pages.",
      request
    );
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonError(400, "Corpo da requisição JSON inválido.", request);
  }

  if (!payload || typeof payload !== "object") {
    return jsonError(400, "Payload inválido.", request);
  }

  const rawMessage = typeof payload.message === "string" ? payload.message : "";
  if (rawMessage.length > 5000) {
    return jsonError(422, "A mensagem excede o limite máximo de 5000 caracteres.", request);
  }

  const rawHiperfoco =
    typeof payload.hiperfoco === "string" ? payload.hiperfoco.trim() : "";
  if (rawHiperfoco.length > 150) {
    return jsonError(422, "O campo hiperfoco excede o limite máximo de 150 caracteres.", request);
  }

  let validatedImage = null;
  if (payload.image_base64) {
    if (typeof payload.image_base64 !== "string" || payload.image_base64.length > 15 * 1024 * 1024) {
      return jsonError(413, "Imagem muito grande. O tamanho máximo é 8 MB.", request);
    }
    try {
      validatedImage = validateAndCleanImage(payload.image_base64, payload.image_mime_type);
    } catch (imgErr) {
      return jsonError(imgErr.status || 400, imgErr.message, request);
    }
  }

  let userText = rawMessage.trim();
  if (!userText) {
    if (validatedImage) {
      userText = "Transcreva o texto desta imagem.";
    } else {
      return jsonError(400, "A pergunta não pode estar vazia.", request);
    }
  }

  if (rawHiperfoco) {
    userText += `\n\n[Instrução interna: o aluno tem hiperfoco em ${rawHiperfoco}. Use analogias com isso se for explicar algo.]`;
  }

  // Sanitização do histórico de conversa (máximo de 6 mensagens recentes)
  const MAX_HISTORY_ITEMS = 6;
  const rawHistory = Array.isArray(payload.history)
    ? payload.history.slice(-MAX_HISTORY_ITEMS)
    : [];

  while (rawHistory.length > 0 && rawHistory[0]?.role !== "user") {
    rawHistory.shift();
  }

  const geminiContents = [];
  let lastRole = null;

  for (const item of rawHistory) {
    if (!item || typeof item.content !== "string") continue;
    const contentText = item.content.trim();
    if (!contentText || contentText.length > 5000) continue;

    const role = item.role === "user" ? "user" : "model";
    if (role === lastRole && geminiContents.length > 0) {
      geminiContents[geminiContents.length - 1].parts.push({ text: contentText });
    } else {
      geminiContents.push({
        role,
        parts: [{ text: contentText }],
      });
      lastRole = role;
    }
  }

  const currentParts = [];
  if (validatedImage) {
    currentParts.push({
      inlineData: {
        mimeType: validatedImage.mimeType,
        data: validatedImage.base64Data,
      },
    });
  }
  currentParts.push({ text: userText });

  if (lastRole === "user" && geminiContents.length > 0) {
    geminiContents[geminiContents.length - 1].parts.push(...currentParts);
  } else {
    geminiContents.push({
      role: "user",
      parts: currentParts,
    });
  }

  while (geminiContents.length > 0 && geminiContents[0].role !== "user") {
    geminiContents.shift();
  }

  const modelName = env.GEMINI_MODEL || "gemini-3.6-flash";
  const fallbackModelName = env.GEMINI_FALLBACK_MODEL || "gemini-flash-latest";

  try {
    const geminiResponse = await callGeminiWithRetry({
      apiKey,
      model: modelName,
      fallbackModel: fallbackModelName,
      contents: geminiContents,
    });

    let replyText = "";
    const candidates = Array.isArray(geminiResponse?.candidates)
      ? geminiResponse.candidates
      : [];

    for (const candidate of candidates) {
      const parts = candidate?.content?.parts;
      if (Array.isArray(parts)) {
        const extracted = parts
          .map((p) => (typeof p?.text === "string" ? p.text : ""))
          .join("")
          .trim();
        if (extracted) {
          replyText = extracted;
          break;
        }
      }
    }

    if (!replyText) {
      let promptBlocked = false;
      const blockReason = String(
        geminiResponse?.promptFeedback?.blockReason || ""
      ).toUpperCase();
      if (
        blockReason &&
        ["SAFETY", "BLOCKLIST", "PROHIBITED", "SPII"].some((s) =>
          blockReason.includes(s)
        )
      ) {
        promptBlocked = true;
      }

      let finishReason = String(candidates[0]?.finishReason || "").toUpperCase();
      if (finishReason.includes(".")) {
        finishReason = finishReason.split(".").pop();
      }

      const isSafetyBlock = promptBlocked || SAFETY_REASONS.has(finishReason);
      if (isSafetyBlock) {
        replyText =
          "Não consegui responder a essa pergunta específica devido às diretrizes de segurança e conteúdo. " +
          "Podemos tentar formular de outro jeito?";
      }
    }

    if (!replyText) {
      return jsonError(
        500,
        "A IA não conseguiu formular uma resposta para esta solicitação.",
        request
      );
    }

    return new Response(
      JSON.stringify({
        response: replyText,
        status: "success",
      }),
      {
        status: 200,
        headers: corsHeaders(request),
      }
    );
  } catch (err) {
    const statusCode = err?.statusCode || 500;
    if (statusCode === 429) {
      return jsonError(
        429,
        "Nosso tutor está processando muitas dúvidas agora, tente novamente em um minuto!",
        request
      );
    }
    if (statusCode === 503 || statusCode === 504) {
      return jsonError(
        503,
        "O modelo de IA está com alta demanda no momento. Tente novamente em alguns instantes.",
        request
      );
    }
    return jsonError(
      502,
      "Erro temporário de comunicação com o serviço de inteligência artificial.",
      request
    );
  }
}
