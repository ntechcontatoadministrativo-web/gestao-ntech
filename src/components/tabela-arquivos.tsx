import Link from "next/link";
import { FileText, FileImage, FileSpreadsheet, FileBox, Lock } from "lucide-react";
import type { NivelEfetivo } from "@/lib/permissoes";
import { fmtDataHora, fmtRevisao, fmtTamanho } from "@/lib/utils";
import { NivelBadge } from "./ui";

export type LinhaArquivo = {
  id: string;
  nome: string;
  extensao: string | null;
  revisaoAtual: number;
  atualizadoEm: Date;
  tamanho: number;
  etapa?: { nome: string; ordem: number } | null;
  projeto?: { codigo: string; nome: string } | null;
  nivel: NivelEfetivo;
};

export function IconeArquivo({ ext, className = "h-4 w-4" }: { ext: string | null; className?: string }) {
  if (ext && ["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) return <FileImage className={className} />;
  if (ext && ["xlsx", "xls", "csv"].includes(ext)) return <FileSpreadsheet className={className} />;
  if (ext && ["rvt", "rfa", "dwg", "dxf", "ifc"].includes(ext)) return <FileBox className={className} />;
  return <FileText className={className} />;
}

export function TabelaArquivos({
  arquivos,
  mostrarEtapa = true,
  mostrarProjeto = false,
  mostrarNivel = true,
}: {
  arquivos: LinhaArquivo[];
  mostrarEtapa?: boolean;
  mostrarProjeto?: boolean;
  mostrarNivel?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="tabela">
        <thead>
          <tr>
            <th>Arquivo</th>
            {mostrarProjeto && <th>Projeto</th>}
            {mostrarEtapa && <th>Etapa</th>}
            <th>Rev.</th>
            <th className="hidden md:table-cell">Tamanho</th>
            <th className="hidden md:table-cell">Atualizado</th>
            {mostrarNivel && <th>Seu acesso</th>}
          </tr>
        </thead>
        <tbody>
          {arquivos.map((a) => (
            <tr key={a.id} className="hover:bg-ink-800/40">
              <td className="max-w-[320px]">
                {a.nivel ? (
                  <Link href={`/arquivos/${a.id}`} className="flex items-center gap-2.5 font-medium text-ink-100 hover:text-neon">
                    <span className="text-ink-400">
                      <IconeArquivo ext={a.extensao} />
                    </span>
                    <span className="truncate">{a.nome}</span>
                  </Link>
                ) : (
                  <span className="flex items-center gap-2.5 text-ink-500">
                    <Lock className="h-4 w-4" />
                    <span className="truncate">{a.nome}</span>
                  </span>
                )}
              </td>
              {mostrarProjeto && <td className="whitespace-nowrap font-mono text-xs text-ink-300">{a.projeto?.codigo}</td>}
              {mostrarEtapa && (
                <td className="whitespace-nowrap text-xs text-ink-300">
                  {a.etapa ? `${String(a.etapa.ordem).padStart(2, "0")} · ${a.etapa.nome}` : <span className="text-ink-500">Geral</span>}
                </td>
              )}
              <td>
                <span className="rounded bg-ink-700 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-ink-100">{fmtRevisao(a.revisaoAtual)}</span>
              </td>
              <td className="hidden whitespace-nowrap text-xs text-ink-400 md:table-cell">{fmtTamanho(a.tamanho)}</td>
              <td className="hidden whitespace-nowrap text-xs text-ink-400 md:table-cell">{fmtDataHora(a.atualizadoEm)}</td>
              {mostrarNivel && (
                <td>
                  <NivelBadge nivel={a.nivel} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
