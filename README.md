# NTECH Hub

Sistema interno da NTECH para tocar a empresa de tecnologia: quadro e sprints, chamados de suporte com SLA, deploys,
clientes e contratos, cofre de credenciais e IA. **Uso exclusivo da equipe**: não tem cadastro público, só o gestor cria logins,
e o site pede aos buscadores para não indexar (`robots.txt` + `noindex`).

| Módulo | O que tem |
| --- | --- |
| **Painel** | Para o gestor: MRR, projetos ativos com sprint, itens em revisão (code review) e etapas para aprovar, chamados que estouraram o SLA ou estão perto, carga de cada pessoa, últimos deploys. Para o colaborador: "Meu dia", com itens, chamados e etapas dele. |
| **Quadro (Kanban)** | Colunas Backlog → A fazer → Fazendo → Em revisão → Feito, com arrastar e soltar. Filtro por projeto, sprint e pessoa. Cartões com tipo (feature, bug, melhoria, tarefa, pesquisa), número `#123`, pontos, prioridade, prazo e responsável. |
| **Tarefas** | A mesma lista em formato de lista, com link do PR, sprint e chamado de origem. Quem pega um item sem dono vira o responsável. Ir para "Em revisão" avisa o gestor, que aprova ou devolve. Aviso por WhatsApp ao designar (link `wa.me` ou Z-API). |
| **Projetos** | Tipos: software sob medida, site, suporte, produto próprio e interno. Cliente, repositório, stack, etapas padrão por tipo, sprints (iniciar/concluir; ao concluir, o que não foi feito volta para o backlog), ambientes (URL, branch, hospedagem), deploys e arquivos. |
| **Sprints** | Por projeto, com objetivo, datas e progresso em pontos. A sprint ativa aparece no quadro e no painel. |
| **Deploys** | Registro de cada versão publicada: projeto, ambiente, resultado (sucesso, falha, rollback) e changelog. Indicadores de frequência e taxa de falha. Deploy em produção ou com falha avisa o gestor. |
| **Clientes e contratos** | Cadastro de clientes, contratos (projeto fechado, mensalidade, suporte com SLA, banco de horas), MRR, propostas em aberto, horas consumidas no mês x contratadas. |
| **Chamados** | Pedidos de suporte com número, cliente, prioridade, canal e responsável. SLA de resposta e solução calculado pela prioridade e pelo contrato do cliente. Respostas ao cliente e notas internas, fila sem dono, e "criar item no quadro" para virar bug. |
| **Cofre** | Senhas e chaves de clientes/serviços, criptografadas (AES-256-GCM). Só gestores veem; cada revelação ou cópia vai para a auditoria e a senha volta a ficar oculta em 30 s. |
| **Escopo com IA** | Cole o briefing (ou envie PDF/prints). O Claude (`claude-opus-5-5`) devolve resumo, stack sugerida, módulos, fora do escopo, integrações, requisitos não funcionais, etapas, **backlog com pontos**, faixa de horas, riscos e perguntas para o cliente, calibrados pelo histórico da NTECH (horas por ponto, velocidade das sprints, duração real das etapas). Um clique cria o projeto com etapas e backlog. |
| **Assistente IA** | Chat em todas as telas com os dados reais: "quais chamados estouraram o SLA?", "como está a sprint do P2026-014?", "o que o Yuri entregou essa semana?", "qual o MRR?". Colaboradores só consultam os próprios dados; financeiro é só para gestores. |
| **Horas, Relatórios, Agenda** | Apontamento por projeto/etapa/item, produtividade por pessoa e projeto, agenda de prazos. |
| **Arquivos (Google Drive)** | Pasta por projeto e etapa no Drive da empresa, upload direto, revisões R00, R01…, liberação por pessoa e auditoria de quem abriu ou baixou. |

## Rodar localmente

Requisitos: Node 20+ e um Postgres **novo, só deste sistema** (ex.: um banco gratuito no [Neon](https://neon.tech)).
Não reaproveite o banco do sistema de projetos elétricos: o `db push` reescreve as tabelas.

```bash
cp .env.example .env      # preencha DATABASE_URL, DATABASE_URL_UNPOOLED, SESSION_SECRET, ENCRYPTION_KEY e o ADMIN_*
npm install
npm run db:push           # cria as tabelas
npm run db:seed           # cria as etapas padrão por tipo de projeto e o primeiro gestor
npm run dev               # http://localhost:3000
```

Gere os segredos com `openssl rand -hex 32` (ou `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).

> Guarde a `ENCRYPTION_KEY` em lugar seguro: sem ela, as senhas do cofre e o token do Google Drive não podem ser lidos.

## Primeiros passos

1. Entre como gestor e cadastre a equipe em **Equipe** (cada pessoa recebe login próprio).
2. Cadastre os **Clientes** e os contratos (o SLA dos chamados sai daqui).
3. Crie um projeto (ou use **Escopo com IA**), cadastre os **ambientes** e abra a primeira **sprint**.
4. Puxe itens do backlog para a sprint e acompanhe no **Quadro**.

## Integrações opcionais

- **IA:** `ANTHROPIC_API_KEY` (console.anthropic.com). Sem ela, o resto funciona normalmente.
- **WhatsApp automático (Z-API):** `ZAPI_INSTANCE_ID`, `ZAPI_TOKEN` e, se exigido, `ZAPI_CLIENT_TOKEN`. Sem elas, os avisos usam links `wa.me`.
- **Google Drive:** `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` (OAuth "Aplicativo da Web", redirect `{APP_URL}/api/google/callback`), depois **Configurações → Conectar Google Drive**. Sem o Drive, os arquivos ficam na pasta `storage/` do servidor (modo de teste).

## Deploy (Render + Neon)

Use o `render.yaml` (New + → Blueprint). Ele cria o serviço `ntech-hub`, gera `SESSION_SECRET` e `ENCRYPTION_KEY` e pede as demais variáveis.
Depois do primeiro deploy, rode `npm run db:seed` uma vez pelo Shell do Render para criar o primeiro gestor.

## Estrutura

```
prisma/schema.prisma        modelo de dados (projetos, quadro, sprints, chamados, clientes, deploys, cofre...)
src/lib/sla.ts              cálculo e situação do SLA dos chamados
src/lib/ia/                 escopo com IA e assistente (ferramentas que consultam o banco)
src/actions/                server actions (tarefas, chamados, clientes, engenharia, projetos...)
src/app/(app)/              telas: painel, quadro, tarefas, projetos, chamados, clientes, deploys, cofre...
```
