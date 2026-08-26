import os
import base64
import binascii
import logging
from typing import List, Optional
from enum import Enum

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from google import genai
from google.genai import types as genai_types
from google.genai import errors as genai_errors

# -----------------------------------------------------------------------------
# 1. Configuração de Ambiente e Logging
# -----------------------------------------------------------------------------
# Carrega as variáveis de ambiente a partir do arquivo .env
load_dotenv()

# Configura o logger para registrar eventos e erros de forma estruturada
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - [%(levelname)s] - %(name)s - %(message)s"
)
logger = logging.getLogger("api-tutor-neurodivergente")

# Recupera a chave da API do Gemini
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    logger.error("A variável de ambiente GEMINI_API_KEY não foi encontrada no arquivo .env!")
    raise RuntimeError(
        "Configuração ausente: Certifique-se de criar o arquivo .env e definir GEMINI_API_KEY."
    )

# Cria o cliente do Google Gen AI (substitui o antigo genai.configure())
client = genai.Client(api_key=GEMINI_API_KEY)

# -----------------------------------------------------------------------------
# 2. Configuração do Modelo e System Prompt
# -----------------------------------------------------------------------------
SYSTEM_INSTRUCTION = r"""
Você é um tutor educacional especializado no atendimento a estudantes neurodivergentes.
Suas diretrizes de comunicação são fundamentais e devem ser seguidas com rigor absoluto:

1. Comunicação Literal e Objetiva: Utilize linguagem clara, direta, concreta e sem ambiguidades. Evite sarcasmo, ironia, expressões de duplo sentido, metáforas complexas e figuras de linguagem.
2. Tom de Voz: Seja acolhedor, altamente paciente e mantenha baixa verbosidade (vá direto ao ponto sem enrolação).
3. Adaptação a Hiperfoco: Se um tema de hiperfoco for informado no contexto da mensagem, use analogias e exemplos estritamente ligados a esse tema para facilitar o aprendizado. Se não for informado, explique de forma simples e direta.
4. ESTRUTURA DE RESPOSTA OBRIGATÓRIA:
   - Toda resposta deve ser composta inicialmente por EXATAMENTE DOIS (2) PARÁGRAFOS CURTOS com a explicação conceitual.
   - Imediatamente após os dois parágrafos, inclua um resumo final contendo EXATAMENTE TRÊS (3) BULLET POINTS (utilizando '-') destacando os pontos principais.
   - EXCEÇÃO: essa estrutura de 2 parágrafos + 3 bullets NÃO se aplica ao transcrever uma imagem (ver regra 6). Ela volta a valer normalmente para qualquer explicação que você adicionar depois da transcrição.
5. Fórmulas e Notação Matemática: Sempre que apresentar fórmulas, equações ou símbolos matemáticos e científicos, use notação LaTeX padrão:
   - Fórmulas inline (no meio da frase): use delimitadores `$ ... $` (exemplo: `$E = mc^2$`).
   - Equações em bloco (destaque em linha separada): use delimitadores `$$ ... $$` (exemplo: `$$x = \frac{-b \pm \sqrt{\Delta}}{2a}$$`).
   - Não use blocos de código markdown (como ```latex ou ```math) para renderizar fórmulas matemáticas; utilize diretamente os delimitadores $ ou $$.
6. Transcrição de Imagens: Se o aluno enviar uma imagem contendo texto (página de livro, exercício, anotação, etc.):
   - Primeiro, transcreva o texto da imagem literalmente, preservando a formatação original o máximo possível (quebras de linha, listas, e fórmulas matemáticas em LaTeX conforme a regra 5).
   - Não corrija, resuma ou reescreva o conteúdo transcrito — o objetivo é reproduzir fielmente o que está escrito, apenas em um formato mais fácil de ler.
   - Se o texto da imagem estiver ilegível ou não houver texto identificável, diga isso de forma direta em vez de inventar conteúdo.
   - Só depois da transcrição, e apenas se o aluno tiver pedido uma explicação, adicione o conteúdo explicativo seguindo a estrutura da regra 4.
"""

# Configuração de geração (temperatura baixa = respostas mais literais e determinísticas)
# e o System Instruction, unificados em um único objeto de configuração reutilizável.
# Recomenda-se gemini-1.5-flash pelo equilíbrio de velocidade, custo e capacidade de seguir instruções.
MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

GENERATION_CONFIG = genai_types.GenerateContentConfig(
    system_instruction=SYSTEM_INSTRUCTION,
    temperature=0.1,  # Valor baixo (0.0 a 0.2) para respostas literais, precisas e objetivas
    top_p=0.95,
    top_k=40,
    max_output_tokens=1000,
)

# Formatos de imagem aceitos e tamanho máximo por requisição (dados já decodificados de base64)
ALLOWED_IMAGE_MIME_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}
MAX_IMAGE_BYTES = 8 * 1024 * 1024  # 8 MB


# -----------------------------------------------------------------------------
# 3. Inicialização do FastAPI e Middlewares
# -----------------------------------------------------------------------------
app = FastAPI(
    title="API Tutor Educacional Inclusivo",
    description="Backend intermediário com Google Gemini para suporte a alunos neurodivergentes.",
    version="1.0.0"
)

# Configuração de CORS para permitir requisições do Front-end
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")
origins = [origin.strip() for origin in ALLOWED_ORIGINS if origin.strip()]
is_wildcard = "*" in origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=not is_wildcard,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------------------------------------------------------
# 4. Esquemas de Dados (Pydantic Models)
# -----------------------------------------------------------------------------
class RoleEnum(str, Enum):
    USER = "user"
    MODEL = "model"
    ASSISTANT = "assistant"

class ChatMessage(BaseModel):
    role: RoleEnum = Field(..., description="Papel de quem enviou a mensagem: 'user', 'model' ou 'assistant'")
    content: str = Field(..., min_length=1, description="Texto da mensagem")

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, description="Pergunta ou dúvida atual do estudante.")
    hiperfoco: Optional[str] = Field(
        default=None,
        description="Tema de interesse especial/hiperfoco do estudante para personalização de analogias."
    )
    history: Optional[List[ChatMessage]] = Field(
        default_factory=list,
        description="Histórico recente de mensagens para manter o contexto da conversa."
    )
    image_base64: Optional[str] = Field(
        default=None,
        description="Imagem anexada pelo aluno (ex.: foto de um exercício), codificada em base64."
    )
    image_mime_type: Optional[str] = Field(
        default=None,
        description="Tipo MIME da imagem anexada, ex.: 'image/jpeg', 'image/png', 'image/webp'."
    )

class ChatResponse(BaseModel):
    response: str = Field(..., description="Resposta pedagógica estruturada gerada pelo Gemini.")
    status: str = Field(default="success", description="Status da requisição.")

class HealthResponse(BaseModel):
    status: str
    model: str

# -----------------------------------------------------------------------------
# 5. Funções Auxiliares
# -----------------------------------------------------------------------------
def decode_and_validate_image(image_base64: str, mime_type: Optional[str]) -> bytes:
    """
    Decodifica e valida uma imagem enviada em base64. Levanta HTTPException (400 ou 413)
    se o tipo não for suportado, o base64 estiver corrompido, ou o arquivo for grande demais.
    """
    if not mime_type or mime_type.lower() not in ALLOWED_IMAGE_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Tipo de imagem não suportado. Use um destes formatos: "
                + ", ".join(sorted(ALLOWED_IMAGE_MIME_TYPES))
            ),
        )

    # Aceita tanto o base64 "puro" quanto um data URL completo (data:image/...;base64,XXXX),
    # caso o front acabe enviando assim por engano.
    cleaned = image_base64.split(",", 1)[-1] if image_base64.strip().startswith("data:") else image_base64

    try:
        raw = base64.b64decode(cleaned, validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Não foi possível decodificar a imagem enviada. Tente anexar o arquivo novamente.",
        )

    if not raw:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A imagem enviada está vazia.",
        )

    if len(raw) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Imagem muito grande. O tamanho máximo é {MAX_IMAGE_BYTES // (1024 * 1024)} MB.",
        )

    return raw


# -----------------------------------------------------------------------------
# 6. Endpoints da API
# -----------------------------------------------------------------------------
@app.get("/api/health", response_model=HealthResponse, tags=["Monitoramento"])
async def health_check():
    """Endpoint para verificar a integridade da API e o modelo ativo."""
    return HealthResponse(status="healthy", model=MODEL_NAME)

@app.post(
    "/api/chat",
    response_model=ChatResponse,
    status_code=status.HTTP_200_OK,
    tags=["Tutor"]
)
async def chat_endpoint(payload: ChatRequest):
    """
    Endpoint principal para interagir com o Tutor IA.
    Recebe a dúvida do aluno, o tema de hiperfoco (opcional) e o histórico de mensagens.
    """
    try:
        # --- Tratamento de Variável Dinâmica (Hiperfoco) ---
        cleaned_hiperfoco = payload.hiperfoco.strip() if payload.hiperfoco else None
        
        # Inicia o texto apenas com a dúvida real do aluno
        user_text = payload.message.strip()
        
        # Adiciona o hiperfoco no final, como uma instrução secundária, para não confundir a visão do modelo
        if cleaned_hiperfoco:
            user_text += f"\n\n[Instrução interna: o aluno tem hiperfoco em {cleaned_hiperfoco}. Use analogias com isso se for explicar algo.]"

        # --- Imagem Anexada (opcional) ---
        image_bytes: Optional[bytes] = None
        if payload.image_base64:
            image_bytes = decode_and_validate_image(payload.image_base64, payload.image_mime_type)

        # --- Montagem e Limitação do Histórico de Conversa ---
        MAX_HISTORY_ITEMS = 6
        raw_history = payload.history[-MAX_HISTORY_ITEMS:] if payload.history else []

        gemini_contents: List[genai_types.Content] = []
        last_role = None

        for item in raw_history:
            role = "user" if item.role == RoleEnum.USER else "model"
            if role == last_role and gemini_contents:
                gemini_contents[-1] = genai_types.Content(
                    role=role,
                    parts=list(gemini_contents[-1].parts) + [genai_types.Part.from_text(text=item.content)],
                )
            else:
                gemini_contents.append(
                    genai_types.Content(role=role, parts=[genai_types.Part.from_text(text=item.content)])
                )
                last_role = role

        # Monta as partes da mensagem atual: imagem sempre ANTES do texto
        current_parts = []
        if image_bytes is not None:
            current_parts.append(
                genai_types.Part.from_bytes(data=image_bytes, mime_type=payload.image_mime_type)
            )
        
        current_parts.append(genai_types.Part.from_text(text=user_text))

        if last_role == "user" and gemini_contents:
            gemini_contents[-1] = genai_types.Content(
                role="user",
                parts=list(gemini_contents[-1].parts) + current_parts,
            )
        else:
            gemini_contents.append(genai_types.Content(role="user", parts=current_parts))

        logger.info(
            f"Processando requisição. Turnos válidos: {len(gemini_contents)} | "
            f"Hiperfoco: {'Sim (' + cleaned_hiperfoco + ')' if cleaned_hiperfoco else 'Não informado'} | "
            f"Imagem: {'Sim' if image_bytes is not None else 'Não'}"
        )

        # --- Chamada Assíncrona ao Modelo Gemini (sem travar o event loop do FastAPI) ---
        gemini_response = await client.aio.models.generate_content(
            model=MODEL_NAME,
            contents=gemini_contents,
            config=GENERATION_CONFIG,
        )

        # --- Extração Segura da Resposta ---
        reply_text = None
        try:
            reply_text = gemini_response.text
        except (ValueError, AttributeError):
            reply_text = None

        if not reply_text:
            # Resposta vazia ou bloqueada por moderação/segurança
            finish_reason = None
            try:
                finish_reason = gemini_response.candidates[0].finish_reason
                finish_reason = getattr(finish_reason, "name", finish_reason)
            except (AttributeError, IndexError, TypeError):
                pass

            if finish_reason:
                logger.warning(f"Resposta filtrada ou vazia. Motivo: {finish_reason}")
                reply_text = (
                    "Não consegui responder a essa pergunta específica devido às diretrizes de segurança e conteúdo. "
                    "Podemos tentar formular de outro jeito?"
                )

        if not reply_text:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="A IA não conseguiu formular uma resposta para esta solicitação."
            )

        return ChatResponse(
            response=reply_text,
            status="success"
        )

    # --- Tratamento de Erros da API do Gemini (rate limit, indisponibilidade, etc.) ---
    # google.genai.errors.APIError cobre tanto ClientError (4xx) quanto ServerError (5xx);
    # usamos getattr por segurança, já que o nome exato do atributo pode variar entre versões do SDK.
    except genai_errors.APIError as e:
        status_code = getattr(e, "code", None) or getattr(e, "status_code", None) or 500

        if status_code == 429:
            logger.warning(f"Limite de requisições do Gemini atingido (Rate Limit / Quota): {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Nosso tutor está processando muitas dúvidas agora, tente novamente em um minuto!"
            )

        logger.error(f"Erro na chamada da API do Gemini (status {status_code}): {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Erro temporário de comunicação com o serviço de inteligência artificial."
        )

    # --- Tratamento de Erros Inesperados ---
    except HTTPException:
        # Repassa exceções HTTP já levantadas
        raise
    except Exception as e:
        logger.exception(f"Erro interno não tratado: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ocorreu um erro interno no servidor ao processar a resposta."
        )

# -----------------------------------------------------------------------------
# 7. Servir Frontend Estático com Segurança (index.html, CSS, JS, Assets)
# -----------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ALLOWED_STATIC_FILES = {"style.css", "app.js", "logo.jpg", "favicon.ico"}

if os.path.exists(os.path.join(BASE_DIR, "index.html")):
    @app.get("/", include_in_schema=False)
    async def serve_index():
        return FileResponse(os.path.join(BASE_DIR, "index.html"))

    @app.get("/{filename}", include_in_schema=False)
    async def serve_static_file(filename: str):
        if filename in ALLOWED_STATIC_FILES:
            file_path = os.path.join(BASE_DIR, filename)
            if os.path.isfile(file_path):
                return FileResponse(file_path)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Arquivo não encontrado."
        )

# -----------------------------------------------------------------------------
# 8. Execução Local Direta
# -----------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    logger.info(f"Iniciando servidor FastAPI em http://{host}:{port}")
    uvicorn.run("main:app", host=host, port=port, reload=True)

