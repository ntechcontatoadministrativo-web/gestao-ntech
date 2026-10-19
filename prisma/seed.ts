import { PrismaClient, type TipoProjeto } from "@prisma/client";
import bcrypt from "bcryptjs";
import { existsSync } from "fs";

// Rodando local, lê o .env (no Render as variáveis já vêm do ambiente).
if (existsSync(".env")) process.loadEnvFile(".env");

const db = new PrismaClient();

// Etapas padrão por tipo de projeto da NTECH. Ajustáveis em Configurações.
const MODELOS: { nome: string; diasPadrao: number; descricao: string; tipo: TipoProjeto }[] = [
  { tipo: "SOFTWARE", nome: "Descoberta e requisitos", diasPadrao: 5, descricao: "Reuniões com o cliente, fluxos, requisitos, escopo fechado e fora do escopo." },
  { tipo: "SOFTWARE", nome: "Protótipo UX/UI", diasPadrao: 7, descricao: "Wireframes e telas no Figma, validação com o cliente." },
  { tipo: "SOFTWARE", nome: "Arquitetura e setup", diasPadrao: 3, descricao: "Repositório, CI/CD, ambientes de homologação e produção, banco e autenticação." },
  { tipo: "SOFTWARE", nome: "Desenvolvimento", diasPadrao: 30, descricao: "Sprints de desenvolvimento do backlog priorizado." },
  { tipo: "SOFTWARE", nome: "QA e testes", diasPadrao: 5, descricao: "Testes funcionais, regressão, correção de bugs e performance." },
  { tipo: "SOFTWARE", nome: "Homologação com o cliente", diasPadrao: 5, descricao: "Cliente valida em homologação; ajustes finais e aceite." },
  { tipo: "SOFTWARE", nome: "Go-live", diasPadrao: 2, descricao: "Deploy em produção, publicação nas lojas, migração de dados e treinamento." },
  { tipo: "SOFTWARE", nome: "Operação assistida", diasPadrao: 14, descricao: "Acompanhamento pós-lançamento e correções de garantia." },

  { tipo: "SITE", nome: "Briefing", diasPadrao: 2, descricao: "Objetivo, público, referências, identidade visual e conteúdo." },
  { tipo: "SITE", nome: "Wireframe e layout", diasPadrao: 5, descricao: "Estrutura das páginas e layout no Figma para aprovação." },
  { tipo: "SITE", nome: "Desenvolvimento", diasPadrao: 10, descricao: "Construção das páginas, responsivo, formulários e integrações." },
  { tipo: "SITE", nome: "Conteúdo e SEO", diasPadrao: 3, descricao: "Textos, imagens, metatags, sitemap, analytics e pixel." },
  { tipo: "SITE", nome: "Revisão com o cliente", diasPadrao: 3, descricao: "Rodada de ajustes e aprovação final." },
  { tipo: "SITE", nome: "Publicação", diasPadrao: 1, descricao: "Domínio, DNS, SSL, hospedagem e entrega dos acessos." },

  { tipo: "PRODUTO", nome: "Discovery", diasPadrao: 7, descricao: "Problema, público, concorrentes, proposta de valor e métricas de sucesso." },
  { tipo: "PRODUTO", nome: "Design do MVP", diasPadrao: 7, descricao: "Fluxos principais e protótipo navegável." },
  { tipo: "PRODUTO", nome: "Desenvolvimento do MVP", diasPadrao: 30, descricao: "Sprints até a primeira versão utilizável." },
  { tipo: "PRODUTO", nome: "Beta fechado", diasPadrao: 14, descricao: "Primeiros usuários, feedback e correções." },
  { tipo: "PRODUTO", nome: "Lançamento", diasPadrao: 3, descricao: "Página de vendas, planos, onboarding e divulgação." },

  { tipo: "SUPORTE", nome: "Onboarding do cliente", diasPadrao: 3, descricao: "Acessos, documentação do sistema, canais de atendimento e SLA combinado." },
  { tipo: "SUPORTE", nome: "Operação contínua", diasPadrao: 30, descricao: "Chamados, manutenção preventiva, atualizações e relatórios mensais." },
];

async function main() {
  if ((await db.modeloEtapa.count()) === 0) {
    await db.modeloEtapa.createMany({ data: MODELOS.map((m, i) => ({ ...m, ordem: i + 1 })) });
    console.log(`✓ ${MODELOS.length} modelos de etapa criados`);
  }

  const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const senha = process.env.ADMIN_SENHA ?? "";
  if (!email || senha.length < 8) {
    console.log("! Defina ADMIN_EMAIL e ADMIN_SENHA (mín. 8 caracteres) para criar o primeiro gestor.");
    return;
  }
  const existe = await db.usuario.findUnique({ where: { email } });
  if (existe) {
    console.log(`= Gestor ${email} já existe`);
    return;
  }
  await db.usuario.create({
    data: { nome: process.env.ADMIN_NOME || "Gestor", email, perfil: "GESTOR", cargo: "Gestor", senhaHash: await bcrypt.hash(senha, 10) },
  });
  console.log(`✓ Gestor criado: ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
