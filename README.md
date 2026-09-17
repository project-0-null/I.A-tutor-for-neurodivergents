# Tutor Educacional Inclusivo

Assistente educacional com inteligencia artificial desenvolvido para a ONG Quebra-Cabeca, projetado para apoiar estudantes neurodivergentes (TEA, TDAH, Dislexia) com foco em previsibilidade, linguagem direta e conforto sensorial.

---

## O que e

Uma aplicacao web que utiliza o Google Gemini para tirar duvidas escolares de forma acessivel, adaptando o ritmo, a linguagem e a interface as necessidades cognitivas e sensoriais do estudante.

---

## Principais Funcionalidades

* Comunicacao literal e objetiva: explicacoes diretas, sem ironia, sarcasmo ou ambiguidades.
* Estrutura previsivel: respostas padronizadas em 2 paragrafos curtos conceituais e 3 topicos de resumo.
* Adaptacao ao hiperfoco: criacao de analogias baseadas no tema de interesse do aluno (ex.: trens, dinossauros, astronomia).
* Transcricao de fotos e exercicios: leitura e transcricao de imagens com conversao automatica de formulas matematicas para LaTeX (KaTeX).
* Painel de conforto sensorial: ajuste de tamanho de texto, espacamento ampliado entre letras/linhas, reducao de cores e modo escuro anti-halo.
* Fontes acessiveis: alternancia entre Lexend, OpenDyslexic e Arial.
* Modo simples e medidor de energia: adaptacao rapida da tela para momentos de cansaço cognitivo ou sobrecarga sensorial.

---

## Como Rodar

1. Instale as dependencias:
   ```bash
   pip install -r requirements.txt
   ```

2. Configure sua chave no arquivo `.env`:
   ```env
   GEMINI_API_KEY=sua_chave_aqui
   ```

3. Inicie o servidor:
   ```bash
   python main.py
   ```

Acesse em `http://localhost:8000`.

Para rodar via celular ou tablet pela internet, consulte o arquivo `COMO_USAR_NGROK.md`.
