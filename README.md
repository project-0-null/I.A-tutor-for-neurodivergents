# 🧠 Tutor Educacional Inclusivo (AI Tutor for Neurodivergents)

Um assistente educacional acessível com inteligência artificial generativa (Google Gemini), projetado especialmente para estudantes neurodivergentes (TEA, TDAH, Dislexia, entre outros), priorizando **previsibilidade**, **baixa carga cognitiva**, **comunicação literal** e **conforto sensorial**.

---

## ✨ Principais Funcionalidades

### 🎯 1. Pedagogia Adaptada & Previsibilidade
* **Comunicação Literal e Objetiva:** Respostas diretas, sem ambiguidades, metáforas complexas, ironias ou linguagem de duplo sentido.
* **Estrutura de Resposta Padronizada:** Todas as explicações seguem rigorosamente o formato de **2 parágrafos curtos conceituais + 3 bullet points com os pontos-chave**.
* **Adaptação a Hiperfoco / Interesses Especiais:** Se o estudante informar um tema de interesse (ex.: astronomia, trens, dinossauros), o tutor formula analogias e exemplos práticos baseados diretamente nesse assunto.
* **Perguntas Rápidas (Chips):** Ações de um clique para pedir simplificação, exemplos adicionais, resumo ou passo a passo.

### 👁️ 2. Painel de Conforto Sensorial e Acessibilidade (WCAG)
* **Tipografia Acessível:** Alternância dinâmica entre fontes otimizadas para leitura (**Lexend**, **OpenDyslexic** e **Arial**).
* **Escala de Texto e Espaçamento:** Ajuste de tamanho da fonte e espaçamento ampliado entre letras e linhas (ideal para apoio à dislexia).
* **Modo Escuro Anti-Halo:** Tons suaves de escuro (sem preto absoluto com texto 100% branco) para evitar ofuscamento e fadiga visual em pessoas com fotossensibilidade.
* **Alto Contraste e Redução de Estímulos:** Modos para simplificar a paleta de cores e eliminar distrações.
* **Medidor de Energia Cognitiva:** Botão de ação rápida *"Simplificar agora"* que adapta toda a interface para momentos de sobrecarga.
* **Acessibilidade Completa:** Suporte a leitores de tela (`aria-live`, `role="status"`), navegação por teclado e link de atalho *"Pular navegação"*.

---

## 🛠️ Tecnologias Utilizadas

* **Back-end:**
  * [Python 3.10+](https://www.python.org/)
  * [FastAPI](https://fastapi.tiangolo.com/) (Endpoints REST assíncronos)
  * [Uvicorn](https://www.uvicorn.org/) (Servidor ASGI de alta performance)
  * [Google Generative AI](https://ai.google.dev/) (`gemini-1.5-flash` com System Instructions)
  * [Pydantic v2](https://docs.pydantic.dev/) (Validação e tipagem de dados)
* **Front-end:**
  * HTML5 Semântico com atributos WAI-ARIA
  * CSS3 Moderno (Design Tokens, Variáveis CSS, Animações suaves)
  * JavaScript Vanilla (sem inchaço de dependências ou frameworks)
* **Containerização:**
  * [Docker](https://www.docker.com/) & Docker Compose

---

## 🚀 Como Executar o Projeto

### Pré-requisitos
* Python 3.10+ instalado **OU** Docker & Docker Compose
* Chave de API do Google Gemini ([Obtenha gratuitamente no Google AI Studio](https://aistudio.google.com/app/apikey))

---

### Opção 1: Execução Local (Python)

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/project-0-null/I.A-tutor-for-neurodivergents.git
   cd I.A-tutor-for-neurodivergents
   ```

2. **Crie e ative um ambiente virtual:**
   ```bash
   python -m venv venv
   source venv/bin/activate  # No Linux/macOS
   # venv\Scripts\activate   # No Windows
   ```

3. **Instale as dependências:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure as variáveis de ambiente:**
   Copie o arquivo de exemplo e insira sua chave da API:
   ```bash
   cp .env.example .env
   ```
   Edite o arquivo `.env`:
   ```env
   GEMINI_API_KEY=sua_chave_gemini_aqui
   GEMINI_MODEL=gemini-1.5-flash
   PORT=8000
   HOST=0.0.0.0
   ```

5. **Inicie o servidor backend:**
   ```bash
   python main.py
   # ou: uvicorn main:app --reload --port 8000
   ```

6. **Abra o front-end:**
   Abra o arquivo `index.html` no seu navegador favorito (ou use uma extensão como *Live Server*).

---

### Opção 2: Execução com Docker Compose

1. **Configure o arquivo `.env`:**
   ```bash
   cp .env.example .env
   # Adicione sua GEMINI_API_KEY no arquivo .env
   ```

2. **Inicie o container:**
   ```bash
   docker compose up --build
   ```

3. A API estará disponível em `http://localhost:8000` (e a documentação Swagger em `http://localhost:8000/docs`).

---

## 📁 Estrutura de Arquivos

```text
├── Dockerfile            # Configuração de imagem Docker
├── docker-compose.yaml   # Orquestração do container
├── requirements.txt      # Dependências do backend Python
├── .env.example          # Exemplo de variáveis de ambiente
├── main.py               # API FastAPI e integração com Gemini
├── index.html            # Interface web acessível
├── style.css             # Folha de estilo e tokens de acessibilidade
├── app.js                # Lógica de interface, persistência e consumo da API
├── logo.jpg              # Logotipo do projeto
└── README.md             # Documentação do projeto
```

---

## 🔒 Segurança e Privacidade

* **Proteção de Chaves:** A chave `GEMINI_API_KEY` é carregada estritamente via variáveis de ambiente (`.env`) no backend, nunca exposta no código cliente.
* **Sanitização de Entradas:** Todas as mensagens exibidas no chat passam por escape de entidades HTML antes da renderização, prevenindo ataques XSS.
* **Rate Limiting:** Tratamento amigável para limites de requisição da cota da IA (`ResourceExhausted`).

---

## 📄 Licença

Este projeto é desenvolvido para fins educacionais e de inclusão e acessibilidade digital.
