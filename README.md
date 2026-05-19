# PSA · Dashboard Hub20

Dashboard web em tempo real que consulta o HubSpot e exibe a evolução dos negócios com Origem do Lead = Hub20. Construído em Next.js 14 + TypeScript, com identidade visual PSA (laranja + azul).

## O que ele mostra

- **Resumo:** total de negócios, em negociação (qtd + R$), ganhos (qtd + R$), perdidos (qtd + R$)
- **Taxa de conversão** (% ganhos sobre fechados)
- **Funil:** gráfico de barras com deals por etapa do pipeline
- **3 tabelas:**
  - Em negociação (negócio, etapa, valor, data de criação)
  - Ganhos (negócio, palestrante, valor, data do ganho)
  - Perdidos (negócio, palestrante, valor, motivo, data da perda)
- **Filtro de período:** Todo o período / 30 dias / 90 dias / Este ano
- **Botão "Atualizar":** força refresh dos dados

## Stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** pra estilo
- **Recharts** pro gráfico de funil
- **Lucide React** pros ícones
- Hospedado no **Vercel** (deploy automático via GitHub)

---

## 🚀 Tutorial de deploy passo a passo

### Pré-requisitos
- [x] Node.js instalado
- [x] Git instalado
- [x] Conta no GitHub
- [x] Conta no Vercel conectada com o GitHub
- [x] Token de Private App do HubSpot com escopos: `crm.objects.deals.read`, `crm.schemas.deals.read`

### Passo 1 — Subir o projeto pro GitHub

**Opção A: Via interface web (mais simples)**

1. Acesse https://github.com/mattheusdosantosss e clique em **New repository**
2. Nome sugerido: `psa-dashboard-hub20`
3. Marque como **Private**
4. NÃO marque "Add a README" (já temos um)
5. Clique em **Create repository**
6. Na próxima tela, escolha **"uploading an existing file"**
7. Arraste TODOS os arquivos da pasta `psa-dashboard` que veio no zip (menos `node_modules` e `.next` se aparecerem) e dê commit

**Opção B: Via terminal**

```bash
cd /caminho/para/psa-dashboard
git init
git add .
git commit -m "Initial commit: PSA Dashboard Hub20"
git branch -M main
git remote add origin https://github.com/mattheusdosantosss/psa-dashboard-hub20.git
git push -u origin main
```

> ⚠️ Confira que o arquivo `.env` (sem o `.example`) NÃO foi pro Git. O `.gitignore` já protege, mas vale verificar. **Nunca comite tokens.**

### Passo 2 — Deploy no Vercel

1. Vá em https://vercel.com/mattheusdosantosss-projects
2. Clique em **Add New → Project**
3. Selecione o repositório `psa-dashboard-hub20` que acabou de subir
4. Na tela de configuração:
   - **Framework Preset:** Next.js (detectado automaticamente)
   - **Root Directory:** `./`
   - **Build Command:** deixa o padrão (`next build`)
5. Expanda a seção **Environment Variables** e adicione 4 variáveis:

| Nome | Valor |
|---|---|
| `HUBSPOT_TOKEN` | `pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` (seu token novo) |
| `DASHBOARD_ACCESS_KEY` | uma string secreta, ex: `hub20-psa-nilmar-2026` |
| `STAGE_GANHO` | `1076664462` |
| `STAGE_PERDIDO` | `1076664461` |

6. Clique em **Deploy** e aguarde 1-2 minutos

### Passo 3 — Acessar o dashboard

Quando o deploy terminar, o Vercel te dá uma URL tipo:
`https://psa-dashboard-hub20.vercel.app`

**O link que vai pro Nilmar é:**
```
https://psa-dashboard-hub20.vercel.app/?key=hub20-psa-nilmar-2026
```

(substituindo `hub20-psa-nilmar-2026` pela mesma string que você colocou em `DASHBOARD_ACCESS_KEY`)

Sem a `?key=...` o dashboard mostra "Acesso restrito".

### Passo 4 — Configurar domínio próprio (opcional)

Pra ter um link tipo `dashboard.profissionaissa.com`:

1. Vercel → seu projeto → **Settings → Domains**
2. Adiciona o domínio e segue as instruções (envolve um CNAME no DNS)

---

## 🛠️ Rodando localmente

Pra testar antes de subir:

```bash
cd psa-dashboard
npm install
```

Crie um arquivo `.env.local` (sem committar) baseado no `.env.example`:

```env
HUBSPOT_TOKEN=pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
DASHBOARD_ACCESS_KEY=qualquer-coisa-secreta
STAGE_GANHO=1076664462
STAGE_PERDIDO=1076664461
```

Depois:
```bash
npm run dev
```

Acessa em http://localhost:3000/?key=qualquer-coisa-secreta

---

## ⚠️ Segurança

- O **token do HubSpot é uma variável de ambiente** — fica no Vercel/`.env.local`, nunca no Git.
- Toda chamada à API do HubSpot é **server-side** (API route do Next.js). O frontend não tem o token.
- A **chave de acesso na URL** é uma proteção leve mas funcional: sem ela, a API retorna 401. O Nilmar guarda o link com a chave e pronto.
- Se a chave vazar: troca o valor de `DASHBOARD_ACCESS_KEY` no Vercel e gera um novo link.

---

## 🔧 Manutenção

### Mudar nome de propriedades / estágios
Edite `app/api/deals/route.ts`. As propriedades do deal estão no array `properties`. Os IDs de stage estão nas variáveis de ambiente `STAGE_GANHO` e `STAGE_PERDIDO`.

### Adicionar nova métrica/tabela
Edite `app/page.tsx`. O componente `DealsTable` é reutilizável — basta passar `columns` e `renderRow`.

### Cache
Atualmente cada acesso faz uma nova consulta ao HubSpot. Se precisar de cache (pra reduzir chamadas à API), dá pra usar o `revalidate` do Next.js no API route.

---

## 📁 Estrutura

```
psa-dashboard/
├── app/
│   ├── api/
│   │   └── deals/
│   │       └── route.ts        ← Backend: consulta HubSpot
│   ├── globals.css             ← Estilos globais + tokens da marca
│   ├── layout.tsx              ← Layout raiz
│   └── page.tsx                ← Página principal do dashboard
├── .env.example                ← Modelo de variáveis de ambiente
├── .gitignore
├── next.config.js
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── tsconfig.json
└── README.md                   ← Este arquivo
```
