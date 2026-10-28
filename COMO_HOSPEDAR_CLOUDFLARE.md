# ☁️ Guia Passo a Passo: Como Hospedar Gratuitamente na Cloudflare + Domínio Próprio

Este guia ensina como colocar o **Tutor Educacional Inclusivo** no ar gratuitamente 24h por dia usando **Cloudflare Pages + Cloudflare Pages Functions** (substituindo o uso temporário do Ngrok), e como conectar um **Domínio Próprio (Custom Domain)** com HTTPS gratuito no final.

---

## 🏗️ Como o Projeto Está Estruturado para a Cloudflare

* **Frontend Estático**: `index.html`, `style.css`, `app.js` e `logo.jpg` (servidos gratuitamente pela CDN global do Cloudflare Pages).
* **Backend Serverless**:
  * `functions/api/chat.js` → responde em `POST /api/chat` (chama o Google Gemini com retry e fallback).
  * `functions/api/health.js` → responde em `GET /api/health`.
* **Proteção de Arquivos (`.assetsignore`)**: impede que arquivos internos (`.env`, `main.py`, `Dockerfile`, PDFs e testes) sejam publicados na web.
* **Compatibilidade Local**: O arquivo `main.py` continua funcionando normalmente caso queira rodar localmente com `python main.py`.

---

## 🚀 Opção 1: Publicar pelo Painel Web da Cloudflare + GitHub (Recomendado)

Com este método, toda vez que você fizer `git push` para o GitHub, a Cloudflare atualizará seu site automaticamente.

### Passo 1: Enviar os novos arquivos para o seu GitHub
No terminal do projeto, execute:
```bash
git add functions/ .assetsignore wrangler.toml app.js .gitignore COMO_HOSPEDAR_CLOUDFLARE.md
git commit -m "feat: adiciona suporte completo ao Cloudflare Pages e Pages Functions"
git push origin main
```
*(Nota: Os arquivos `.env` e `.dev.vars` com sua chave estão protegidos no `.gitignore` e NÃO vão para o GitHub).*

### Passo 2: Conectar o GitHub no Painel da Cloudflare
1. Crie uma conta gratuita ou faça login em **[dash.cloudflare.com](https://dash.cloudflare.com)**.
2. No menu lateral esquerdo, clique em **Compute (Workers & Pages)** → **Workers & Pages**.
3. Clique no botão azul **Create** (Criar).
4. Selecione a aba **Pages** no topo e clique em **Connect to Git** (Conectar ao Git).
5. Autorize sua conta do GitHub e selecione o repositório **`I.A-tutor-for-neurodivergents`**.

### Passo 3: Configurar o Build e a Chave do Gemini
Na tela de configuração do projeto, preencha:
* **Project name:** `tutor-educacional-inclusivo` (ou o nome que preferir)
* **Production branch:** `main`
* **Framework preset:** `None`
* **Build command:** *(deixe em branco)*
* **Build output directory:** `/` *(ou deixe o padrão)*

Logo abaixo, clique em **Environment variables (advanced)** → **+ Add variable**:
* **Variable name:** `GEMINI_API_KEY`
* **Value:** `COLE_SUA_CHAVE_GEMINI_AQUI` *(copie do seu arquivo `.env` local)*

Clique em **Save and Deploy**!
Em cerca de 40 segundos, seu site estará no ar em:
👉 **`https://tutor-educacional-inclusivo.pages.dev`**

---

## 💻 Opção 2: Publicar Direto pelo Terminal (Wrangler CLI)

Se você quiser colocar o site no ar agora mesmo direto pelo terminal (sem precisar passar pelo GitHub primeiro), basta usar a ferramenta oficial **Wrangler** da Cloudflare:

### Passo 1: Fazer login na sua conta Cloudflare pelo terminal
```bash
npx wrangler login
```
*(Uma aba do navegador vai abrir pedindo para você clicar em **Allow** para autorizar o terminal).*

### Passo 2: Criar o projeto e enviar os arquivos para a nuvem
```bash
npx wrangler pages project create tutor-educacional-inclusivo --production-branch main
npx wrangler pages deploy . --project-name tutor-educacional-inclusivo
```

### Passo 3: Cadastrar sua chave `GEMINI_API_KEY` na nuvem da Cloudflare
Execute o comando abaixo e, quando solicitado, cole sua chave da API do Gemini:
```bash
npx wrangler pages secret put GEMINI_API_KEY --project-name tutor-educacional-inclusivo
```

### (Opcional) Como testar o simulador da Cloudflare localmente no seu PC
Como já configuramos sua chave no arquivo `.dev.vars`, você pode testar localmente simulando a nuvem da Cloudflare na porta `8788`:
```bash
npx wrangler pages dev . --port 8788
```

---

## 🌐 Etapa Final: Como Deixar o Site Público com um Domínio Próprio (Custom Domain)

Por padrão, seu site já nasce **100% público na internet** através do domínio gratuito da Cloudflare (`https://tutor-educacional-inclusivo.pages.dev`). Qualquer aluno, professor ou avaliador pode acessar pelo celular ou computador sem tela de aviso!

Quando você quiser vincular um **Domínio Próprio** (por exemplo: `tutorquebracabeca.org.br`, `seututor.com.br` ou um subdomínio `tutor.ongquebracabeca.org.br`), siga os passos abaixo. **A Cloudflare não cobra nada por isso e fornece o certificado HTTPS/SSL gratuitamente.**

### 1. Onde conseguir o domínio?
* **Se a ONG já possui um domínio** (ex.: `quebracabeca.org.br`): **Custo R$ 0,00!** Você pode usar um subdomínio gratuito como `tutor.quebracabeca.org.br` sem afetar o site principal da ONG.
* **Se quiser registrar um domínio novo `.com.br` ou `.org.br`**: Registre diretamente no site oficial brasileiro **[Registro.br](https://registro.br)** (custa R$ 40,00 por ano).
* **Se quiser registrar um domínio `.com`, `.org` ou `.net`**: Pode comprar diretamente dentro do painel da Cloudflare em **Domain Registration → Register Domains** a preço de custo.

---

### 2. Passo a Passo para Apontar o Domínio para a Cloudflare

#### Etapa A — Adicionar o domínio na Cloudflare (Plano Gratuito)
1. No menu inicial da Cloudflare ([dash.cloudflare.com](https://dash.cloudflare.com)), clique no botão **+ Add a domain** (Adicionar um domínio).
2. Digite o seu domínio principal (ex.: `seusite.com.br`) e clique em **Continue**.
3. Escolha o plano **Free (R$ 0 / mês)** na parte inferior e clique em **Continue**.
4. A Cloudflare mostrará **2 servidores DNS (Nameservers)** exclusivos para a sua conta, parecidos com:
   * `ana.ns.cloudflare.com`
   * `bob.ns.cloudflare.com`
5. Acesse o site onde você comprou o domínio (ex.: no **Registro.br**, clique no seu domínio → role até a seção **DNS** → clique em **Alterar servidores DNS**), cole os 2 endereços da Cloudflare e salve.
   *(A ativação do DNS leva de 10 minutos a algumas horas).*

#### Etapa B — Conectar o domínio ao seu projeto no Cloudflare Pages
1. No painel da Cloudflare, vá em **Workers & Pages** e clique no seu projeto **`tutor-educacional-inclusivo`**.
2. Clique na aba **Custom domains** (Domínios personalizados).
3. Clique no botão azul **Set up a custom domain** (Configurar um domínio personalizado).
4. Digite o endereço desejado:
   * Pode ser o domínio principal: `seusite.com.br`
   * Ou um subdomínio: `tutor.seusite.org.br`
5. Clique em **Continue** e depois em **Activate domain** (Ativar domínio).

### 3. O que acontece automaticamente após clicar em "Activate domain"?
1. **DNS Automático:** A própria Cloudflare cria o registro `CNAME` apontando o seu domínio para `tutor-educacional-inclusivo.pages.dev`.
2. **Certificado SSL/HTTPS Gratuito:** Em cerca de 1 a 5 minutos, a Cloudflare emite e instala o certificado de segurança (cadeado HTTPS) automaticamente.
3. **Zero alteração de código:** Como o nosso `app.js` faz chamadas relativas para `/api/chat`, tanto o site quanto o chat com IA e o envio de fotos funcionarão imediatamente no seu domínio novo!
