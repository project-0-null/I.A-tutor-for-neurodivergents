import os
import logging
from typing import List, Optional
from enum import Enum

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import google.generativeai as genai
from google.api_core.exceptions import ResourceExhausted, GoogleAPICallError

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

# Configura o SDK do Google Generative AI
genai.configure(api_key=GEMINI_API_KEY)

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
5. Fórmulas e Notação Matemática: Sempre que apresentar fórmulas, equações ou símbolos matemáticos e científicos, use notação LaTeX padrão:
   - Fórmulas inline (no meio da frase): use delimitadores `$ ... $` (exemplo: `$E = mc^2$`).
   - Equações em bloco (destaque em linha separada): use delimitadores `$$ ... $$` (exemplo: `$$x = \frac{-b \pm \sqrt{\Delta}}{2a}$$`).
   - Não use blocos de código markdown (como ```latex ou ```math) para renderizar fórmulas matemáticas; utilize diretamente os delimitadores $ ou $$.
"""

# Configuração de Hiperparâmetros: Temperatura baixa para garantir determinismo e reduzir alucinações
GENERATION_CONFIG = genai.types.GenerationConfig(
    temperature=0.1,  # Valor baixo (0.0 a 0.2) para respostas literais, precisas e objetivas
    top_p=0.95,
    top_k=40,
    max_output_tokens=1000,
)

# Inicializa o modelo Generative AI com o System Instruction pré-injetado
# Recomenda-se gemini-1.5-flash pelo equilíbrio de velocidade, custo e capacidade de seguir instruções
MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

model = genai.GenerativeModel(
    model_name=MODEL_NAME,
    system_instruction=SYSTEM_INSTRUCTION,
    generation_config=GENERATION_CONFIG
)

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
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in ALLOWED_ORIGINS if origin.strip()],
    allow_credentials=True,
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

class ChatResponse(BaseModel):
    response: str = Field(..., description="Resposta pedagógica estruturada gerada pelo Gemini.")
    status: str = Field(default="success", description="Status da requisição.")

class HealthResponse(BaseModel):
    status: str
    model: str

# -----------------------------------------------------------------------------
# 5. Endpoints da API
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
        # Garante que não enviamos variáveis vazias ou somente com espaços para o modelo
        cleaned_hiperfoco = payload.hiperfoco.strip() if payload.hiperfoco else None
        
        if cleaned_hiperfoco:
            # Se o hiperfoco foi preenchido, contextualiza a mensagem do usuário
            user_content = (
                f"[Tema de Hiperfoco do Aluno: {cleaned_hiperfoco}]\n\n"
                f"Pergunta do aluno: {payload.message.strip()}"
            )
        else:
            # Caso não tenha sido informado, envia somente a dúvida direta
            user_content = payload.message.strip()

        # --- Montagem e Limitação do Histórico de Conversa ---
        # Mantém até as últimas 6 mensagens anteriores e garante alternância estrita de papéis
        MAX_HISTORY_ITEMS = 6
        raw_history = payload.history[-MAX_HISTORY_ITEMS:] if payload.history else []

        gemini_contents = []
        last_role = None

        for item in raw_history:
            role = "user" if item.role == RoleEnum.USER else "model"
            # Se houver turnos repetidos do mesmo papel, concatena para manter alternância válida
            if role == last_role and gemini_contents:
                gemini_contents[-1]["parts"][0] += f"\n{item.content}"
            else:
                gemini_contents.append({
                    "role": role,
                    "parts": [item.content]
                })
                last_role = role

        # Adiciona a mensagem atual formatada
        if last_role == "user" and gemini_contents:
            gemini_contents[-1]["parts"][0] += f"\n\n{user_content}"
        else:
            gemini_contents.append({
                "role": "user",
                "parts": [user_content]
            })

        logger.info(
            f"Processando requisição. Turnos válidos: {len(gemini_contents)} | "
            f"Hiperfoco: {'Sim (' + cleaned_hiperfoco + ')' if cleaned_hiperfoco else 'Não informado'}"
        )

        # --- Chamada Assíncrona ao Modelo Gemini (sem travar o event loop do FastAPI) ---
        gemini_response = await model.generate_content_async(gemini_contents)

        # --- Extração Segura da Resposta ---
        reply_text = None
        try:
            reply_text = gemini_response.text
        except (ValueError, AttributeError):
            # Se a resposta foi bloqueada por moderação/segurança
            if gemini_response.candidates and gemini_response.candidates[0].finish_reason:
                reason = gemini_response.candidates[0].finish_reason.name
                logger.warning(f"Resposta filtrada pelo modelo. Motivo: {reason}")
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

    # --- Tratamento de Rate Limiting (15 RPM na camada gratuita) ---
    except ResourceExhausted as e:
        logger.warning(f"Limite de requisições do Gemini atingido (Rate Limit / Quota): {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Nosso tutor está processando muitas dúvidas agora, tente novamente em um minuto!"
        )

    # --- Tratamento de Outros Erros da API do Google ---
    except GoogleAPICallError as e:
        logger.error(f"Erro na chamada da API do Gemini: {str(e)}")
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
# 6. Execução Local Direta
# -----------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    logger.info(f"Iniciando servidor FastAPI em http://{host}:{port}")
    uvicorn.run("main:app", host=host, port=port, reload=True)
