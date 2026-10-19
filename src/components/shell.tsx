"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Bot,
  Building2,
  CalendarDays,
  CheckSquare,
  Clock,
  Files,
  FolderKanban,
  KanbanSquare,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  Rocket,
  Settings,
  ShieldCheck,
  Sparkles,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { Logo } from "./logo";
import { Sininho } from "./avisos";
import { BuscaGlobal } from "./busca";
import { cn, iniciais } from "@/lib/utils";

type Item = { href: string; rotulo: string; icone: React.ElementType; contador?: "pendencias" | "tarefas" | "chamados" };
type Grupo = { titulo?: string; itens: Item[] };

const MENU_GESTOR: Grupo[] = [
  {
    itens: [
      { href: "/painel", rotulo: "Painel", icone: LayoutDashboard, contador: "pendencias" },
      { href: "/quadro", rotulo: "Quadro", icone: KanbanSquare },
      { href: "/tarefas", rotulo: "Tarefas", icone: CheckSquare, contador: "tarefas" },
    ],
  },
  {
    titulo: "Entregas",
    itens: [
      { href: "/projetos", rotulo: "Projetos", icone: FolderKanban },
      { href: "/deploys", rotulo: "Deploys", icone: Rocket },
      { href: "/agenda", rotulo: "Agenda", icone: CalendarDays },
      { href: "/arquivos", rotulo: "Arquivos", icone: Files },
    ],
  },
  {
    titulo: "Clientes",
    itens: [
      { href: "/clientes", rotulo: "Clientes e contratos", icone: Building2 },
      { href: "/chamados", rotulo: "Chamados", icone: LifeBuoy, contador: "chamados" },
    ],
  },
  {
    titulo: "IA",
    itens: [
      { href: "/assistente", rotulo: "Assistente", icone: Bot },
      { href: "/ia", rotulo: "Escopo com IA", icone: Sparkles },
    ],
  },
  {
    titulo: "Gestão",
    itens: [
      { href: "/horas", rotulo: "Horas", icone: Clock },
      { href: "/relatorios", rotulo: "Relatórios", icone: BarChart3 },
      { href: "/equipe", rotulo: "Equipe", icone: Users },
      { href: "/cofre", rotulo: "Cofre", icone: KeyRound },
      { href: "/auditoria", rotulo: "Auditoria", icone: ShieldCheck },
      { href: "/configuracoes", rotulo: "Configurações", icone: Settings },
    ],
  },
];

const MENU_COLAB: Grupo[] = [
  {
    itens: [
      { href: "/painel", rotulo: "Meu dia", icone: LayoutDashboard, contador: "pendencias" },
      { href: "/quadro", rotulo: "Quadro", icone: KanbanSquare },
      { href: "/tarefas", rotulo: "Minhas tarefas", icone: CheckSquare, contador: "tarefas" },
      { href: "/chamados", rotulo: "Chamados", icone: LifeBuoy, contador: "chamados" },
    ],
  },
  {
    titulo: "Entregas",
    itens: [
      { href: "/projetos", rotulo: "Projetos", icone: FolderKanban },
      { href: "/deploys", rotulo: "Deploys", icone: Rocket },
      { href: "/agenda", rotulo: "Agenda", icone: CalendarDays },
      { href: "/arquivos", rotulo: "Arquivos", icone: Files },
    ],
  },
  {
    titulo: "Eu",
    itens: [
      { href: "/horas", rotulo: "Minhas horas", icone: Clock },
      { href: "/assistente", rotulo: "Assistente IA", icone: Bot },
    ],
  },
];

const COR_CONTADOR = {
  pendencias: "bg-amber-400/20 text-amber-300",
  tarefas: "bg-sky-400/20 text-sky-300",
  chamados: "bg-violet-400/20 text-violet-300",
};

export function Shell({
  usuario,
  pendencias,
  tarefasAbertas,
  chamados,
  avisos,
  children,
}: {
  usuario: { nome: string; email: string; perfil: "GESTOR" | "COLABORADOR"; cargo?: string | null };
  pendencias: number;
  tarefasAbertas: number;
  chamados: number;
  avisos: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);
  useEffect(() => setAberto(false), [pathname]);
  const menu = usuario.perfil === "GESTOR" ? MENU_GESTOR : MENU_COLAB;
  const contadores = { pendencias, tarefas: tarefasAbertas, chamados };

  const nav = (
    <nav className="flex h-full flex-col">
      <div className="flex items-center justify-between px-5 pb-5 pt-6">
        <Logo />
        <span className="hidden lg:block">
          <Sininho inicial={avisos} />
        </span>
      </div>
      <div className="px-3 pb-3">
        <BuscaGlobal />
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-3 pb-3">
        {menu.map((g, gi) => (
          <div key={gi}>
            {g.titulo && <div className="mb-1 px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500">{g.titulo}</div>}
            <div className="space-y-0.5">
              {g.itens.map((i) => {
                const ativo = pathname === i.href || pathname.startsWith(i.href + "/");
                const Icone = i.icone;
                const n = i.contador ? contadores[i.contador] : 0;
                return (
                  <Link
                    key={i.href}
                    href={i.href}
                    className={cn(
                      "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                      ativo ? "bg-neon/10 text-neon" : "text-ink-300 hover:bg-ink-800 hover:text-ink-100",
                    )}
                  >
                    {ativo && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-neon" />}
                    <Icone className="h-[17px] w-[17px]" />
                    <span className="flex-1">{i.rotulo}</span>
                    {i.contador && n > 0 && <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", COR_CONTADOR[i.contador])}>{n}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-ink-700 p-3">
        <Link href="/conta" className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-ink-800">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-ink-700 text-xs font-bold ring-1 ring-ink-600">{iniciais(usuario.nome)}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-ink-100">{usuario.nome}</span>
            <span className="block truncate text-[11px] text-ink-400">{usuario.cargo || (usuario.perfil === "GESTOR" ? "Gestor" : "Colaborador")}</span>
          </span>
          <UserCog className="h-4 w-4 text-ink-400" />
        </Link>
        <form action="/api/sair" method="post">
          <button className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-ink-400 hover:bg-ink-800 hover:text-red-300">
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </form>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-ink-700 bg-ink-900 lg:block">{nav}</aside>

      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-ink-700 bg-ink-900/90 px-4 py-3 backdrop-blur lg:hidden">
        <Logo subtitulo={false} />
        <span className="ml-auto mr-1">
          <Sininho inicial={avisos} alinhar="direita" />
        </span>
        <button onClick={() => setAberto(true)} className="rounded-lg p-2 text-ink-200 hover:bg-ink-800" aria-label="Abrir menu">
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {aberto && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setAberto(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 border-r border-ink-700 bg-ink-900">
            <button onClick={() => setAberto(false)} className="absolute right-3 top-5 rounded-lg p-2 text-ink-300 hover:bg-ink-800" aria-label="Fechar menu">
              <X className="h-5 w-5" />
            </button>
            {nav}
          </aside>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
    </div>
  );
}
