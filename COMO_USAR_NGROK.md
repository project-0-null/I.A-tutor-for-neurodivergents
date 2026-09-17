# 🌐 Guia Prático: Como Usar o Ngrok com o Tutor Educacional

Este guia ensina como usar o **ngrok** para acessar o **Tutor Educacional Inclusivo** a partir de qualquer dispositivo (seu celular, tablet ou o computador de outra pessoa) através da internet, enquanto o servidor Python continua rodando com segurança na sua máquina.

---

## 🎯 Por que usar o Ngrok?

Por padrão, a aplicação roda em `http://localhost:8000`, ou seja, apenas quem está sentado no seu computador consegue abrir o site. 

Com o ngrok:
* Você ganha uma **URL pública segura e criptografada** (`https://seunome.ngrok-free.app`);
* Consegue **testar a câmera do celular** tirando fotos reais de cadernos e livros para o tutor transcrever;
* Pode demonstrar o projeto para professores, terapeutas ou colegas sem precisar fazer deploy complexo em nuvem.

---

## 📥 1. Instalação do Ngrok

Escolha o seu sistema operacional:

### No Linux (Ubuntu / Debian / Mint)
Abra o terminal e execute:
```bash
curl -sSL https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null \
  && echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list \
  && sudo apt update \
  && sudo apt install ngrok
```
*Ou via Snap:*
```bash
sudo snap install ngrok
```

### No Windows
Execute no PowerShell ou Prompt de Comando:
```powershell
winget install ngrok.ngrok
```
*Ou baixe o executável diretamente em [ngrok.com/download](https://ngrok.com/download).*

### No macOS
```bash
brew install ngrok
```

---

## 🔑 2. Autenticação (Necessário apenas na primeira vez)

O ngrok gratuito exige que você vincule seu token de conta:

1. Crie uma conta gratuita em [dashboard.ngrok.com/signup](https://dashboard.ngrok.com/signup).
2. Acesse a página **Your Authtoken** no menu lateral.
3. Copie o seu token e execute no seu terminal:
   ```bash
   ngrok config add-authtoken SEU_TOKEN_AQUI
   ```

---

## 🚀 3. Como Iniciar a Aplicação com o Ngrok

Siga este passo a passo sempre que for utilizar:

### Passo 1: Inicie o Backend do Tutor
Abra um terminal na pasta do projeto e inicie o servidor FastAPI:
```bash
# Ative seu ambiente virtual se necessário:
source tesla/bin/activate   # Linux/Mac
# ou .\tesla\Scripts\activate no Windows

python main.py
```
Você verá a mensagem informando que o servidor está rodando em `http://0.0.0.0:8000`.

---

### Passo 2: Abra o Túnel do Ngrok
Abra um **segundo terminal** (mantenha o primeiro rodando) e execute:
```bash
ngrok http 8000
```

O terminal exibirá uma tela parecida com esta:
```text
ngrok                                                           (Ctrl+C to quit)

Session Status                online
Account                       Seu Nome (Plan: Free)
Forwarding                    https://1a2b-3c4d-5e6f.ngrok-free.app -> http://localhost:8000
```

---

### Passo 3: Acesse e Use!

1. Copie a URL que começa com `https://` (no exemplo acima: `https://1a2b-3c4d-5e6f.ngrok-free.app`).
2. Abra essa URL no navegador do seu **computador, celular ou tablet**.
3. **Pronto!** O backend do FastAPI serve diretamente o `index.html`, `style.css` e `app.js`. Você já pode conversar com o tutor e enviar fotos de exercícios.

> [!TIP]
> No celular, você pode tocar no ícone de clipe/anexo e escolher **"Câmera"** para tirar uma foto na hora de uma página de livro ou caderno! O sistema comprime a imagem automaticamente e o tutor transcreve o texto com fórmulas em LaTeX.

---

## 💡 Dica Importante: A Tela de Aviso do Ngrok Gratuito

O ngrok gratuito costuma exibir uma página de aviso na primeira vez que alguém visita o link pelo navegador (*"You are about to visit an ngrok-free.app site..."*):

* **Ao acessar pelo navegador**: Basta clicar no botão azul **"Visit Site"** uma única vez.
* **Nas chamadas de API do chat**: Não se preocupe! Nós já configuramos o `app.js` com o cabeçalho oficial `ngrok-skip-browser-warning: true`. Suas perguntas e imagens nunca serão bloqueadas pela tela de aviso.

---

## 🛠️ Solução de Problemas Frequentes

| Problema | Causa Provável | Como Resolver |
| :--- | :--- | :--- |
| **`502 Bad Gateway`** | O Python não está rodando na porta 8000. | Certifique-se de executar `python main.py` **antes** de abrir o link do ngrok. |
| **`ERR_NGROK_4018`** | O Authtoken não foi configurado. | Execute o comando `ngrok config add-authtoken SEU_TOKEN`. |
| **`Port 8000 is already in use`** | Já existe outra instância do servidor rodando. | Feche terminais antigos ou encerre o processo anterior antes de reiniciar. |
| **A URL mudou ao reiniciar** | No plano gratuito do ngrok, a URL muda a cada nova execução. | Sempre que reiniciar o comando `ngrok http 8000`, use a nova URL gerada no terminal. |

---

## 🛑 Como Parar

Para desligar o túnel e a aplicação:
1. No terminal do ngrok, pressione `Ctrl + C`.
2. No terminal do Python, pressione `Ctrl + C`.
