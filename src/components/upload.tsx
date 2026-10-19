"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileUp, Loader2, UploadCloud, XCircle } from "lucide-react";
import { Modal } from "./client";
import { cn, fmtTamanho } from "@/lib/utils";

type Item = { arquivo: File; progresso: number; estado: "fila" | "enviando" | "ok" | "erro"; msg?: string };

async function enviarUm(
  arquivo: File,
  dados: Record<string, unknown>,
  aoProgredir: (p: number) => void,
): Promise<{ revisao: number }> {
  const s = await fetch("/api/arquivos/sessao", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...dados, nome: arquivo.name, tamanho: arquivo.size, mime: arquivo.type || undefined }),
  });
  const sessao = await s.json();
  if (!s.ok) throw new Error(sessao.erro ?? "Falha ao preparar o envio.");

  // Envia direto ao destino (Google Drive ou servidor local) mostrando o progresso.
  const resposta = await new Promise<{ id: string }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", sessao.uploadUrl);
    xhr.setRequestHeader("Content-Type", arquivo.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => e.lengthComputable && aoProgredir(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      try {
        const j = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && j.id) resolve(j);
        else reject(new Error(j.erro ?? j.error?.message ?? `Falha no envio (${xhr.status}).`));
      } catch {
        reject(new Error(`Falha no envio (${xhr.status}).`));
      }
    };
    xhr.onerror = () => reject(new Error("Conexão interrompida durante o envio."));
    xhr.send(arquivo);
  });

  const c = await fetch("/api/arquivos/confirmar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: sessao.token, fileId: resposta.id }),
  });
  const conf = await c.json();
  if (!c.ok) throw new Error(conf.erro ?? "Falha ao registrar o arquivo.");
  return conf;
}

export function EnviarArquivo({
  projetoId,
  etapaId,
  arquivoId,
  ehGestor,
  etapas,
  rotulo = "Enviar arquivos",
  className = "btn-primario",
}: {
  projetoId: string;
  etapaId?: string | null;
  arquivoId?: string;
  ehGestor: boolean;
  etapas?: { id: string; nome: string; ordem: number }[];
  rotulo?: string;
  className?: string;
}) {
  return (
    <Modal
      titulo={arquivoId ? "Enviar nova revisão" : "Enviar arquivos"}
      gatilho={(abrir) => (
        <button type="button" onClick={abrir} className={className}>
          <UploadCloud className="h-4 w-4" />
          {rotulo}
        </button>
      )}
    >
      {(fechar) => (
        <FormEnvio projetoId={projetoId} etapaId={etapaId} arquivoId={arquivoId} ehGestor={ehGestor} etapas={etapas} fechar={fechar} />
      )}
    </Modal>
  );
}

function FormEnvio({
  projetoId,
  etapaId,
  arquivoId,
  ehGestor,
  etapas,
  fechar,
}: {
  projetoId: string;
  etapaId?: string | null;
  arquivoId?: string;
  ehGestor: boolean;
  etapas?: { id: string; nome: string; ordem: number }[];
  fechar: () => void;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [itens, setItens] = useState<Item[]>([]);
  const [destino, setDestino] = useState(etapaId ?? "");
  const [acesso, setAcesso] = useState<"" | "VISUALIZAR" | "BAIXAR">("");
  const [obs, setObs] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [arrastando, setArrastando] = useState(false);

  const adicionar = (lista: FileList | null) => {
    if (!lista) return;
    const novos = Array.from(lista).map<Item>((arquivo) => ({ arquivo, progresso: 0, estado: "fila" }));
    setItens((v) => (arquivoId ? novos.slice(0, 1) : [...v, ...novos]));
  };

  const atualizar = (i: number, p: Partial<Item>) => setItens((v) => v.map((x, j) => (j === i ? { ...x, ...p } : x)));

  const enviar = async () => {
    setEnviando(true);
    let algumOk = false;
    for (let i = 0; i < itens.length; i++) {
      if (itens[i].estado === "ok") continue;
      atualizar(i, { estado: "enviando", progresso: 0, msg: undefined });
      try {
        const r = await enviarUm(
          itens[i].arquivo,
          {
            projetoId,
            etapaId: destino || null,
            arquivoId: arquivoId ?? null,
            observacao: obs || null,
            acessoEquipe: acesso || null,
          },
          (p) => atualizar(i, { progresso: p }),
        );
        atualizar(i, { estado: "ok", progresso: 100, msg: `R${String(r.revisao).padStart(2, "0")}` });
        algumOk = true;
      } catch (e) {
        atualizar(i, { estado: "erro", msg: e instanceof Error ? e.message : "Erro" });
      }
    }
    setEnviando(false);
    if (algumOk) router.refresh();
  };

  const terminou = itens.length > 0 && itens.every((i) => i.estado === "ok");

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastando(false);
          adicionar(e.dataTransfer.files);
        }}
        onClick={() => input.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition",
          arrastando ? "border-neon bg-neon/5" : "border-ink-600 hover:border-ink-500 hover:bg-ink-800/50",
        )}
      >
        <FileUp className="mb-2 h-7 w-7 text-ink-400" />
        <div className="text-sm font-medium text-ink-100">Arraste {arquivoId ? "o arquivo" : "os arquivos"} ou clique para escolher</div>
        <div className="mt-1 text-xs text-ink-400">PDF, RVT, DWG, planilhas, imagens…</div>
        <input ref={input} type="file" multiple={!arquivoId} className="hidden" onChange={(e) => adicionar(e.target.files)} />
      </div>

      {itens.length > 0 && (
        <ul className="space-y-2">
          {itens.map((it, i) => (
            <li key={i} className="rounded-lg border border-ink-700 bg-ink-900 px-3 py-2">
              <div className="flex items-center gap-2 text-sm">
                {it.estado === "ok" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-neon" />
                ) : it.estado === "erro" ? (
                  <XCircle className="h-4 w-4 shrink-0 text-red-400" />
                ) : it.estado === "enviando" ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-ink-300" />
                ) : (
                  <FileUp className="h-4 w-4 shrink-0 text-ink-400" />
                )}
                <span className="min-w-0 flex-1 truncate">{it.arquivo.name}</span>
                <span className="text-xs text-ink-400">{it.msg && it.estado === "ok" ? it.msg : fmtTamanho(it.arquivo.size)}</span>
              </div>
              {it.estado === "enviando" && (
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-ink-700">
                  <div className="h-full bg-neon transition-all" style={{ width: `${it.progresso}%` }} />
                </div>
              )}
              {it.estado === "erro" && <div className="mt-1 text-xs text-red-300">{it.msg}</div>}
            </li>
          ))}
        </ul>
      )}

      {!arquivoId && etapas && etapas.length > 0 && (
        <div>
          <label className="label">Destino</label>
          <select className="input" value={destino} onChange={(e) => setDestino(e.target.value)} disabled={!ehGestor && !!etapaId}>
            {ehGestor && <option value="">Arquivos gerais do projeto</option>}
            {etapas.map((e) => (
              <option key={e.id} value={e.id}>
                {String(e.ordem).padStart(2, "0")} · {e.nome}
              </option>
            ))}
          </select>
        </div>
      )}

      {ehGestor && !arquivoId && (
        <div>
          <label className="label">Liberação para a equipe</label>
          <select className="input" value={acesso} onChange={(e) => setAcesso(e.target.value as typeof acesso)}>
            <option value="">Padrão ({destino ? "responsável da etapa pode baixar" : "equipe do projeto só visualiza"})</option>
            <option value="VISUALIZAR">Equipe só visualiza</option>
            <option value="BAIXAR">Equipe pode visualizar e baixar</option>
          </select>
          <p className="mt-1 text-xs text-ink-400">Depois você pode liberar ou bloquear pessoa a pessoa.</p>
        </div>
      )}

      <div>
        <label className="label">Observação (opcional)</label>
        <input className="input" value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: ajustes do quadro de cargas" maxLength={500} />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="btn-secundario" onClick={fechar} disabled={enviando}>
          {terminou ? "Fechar" : "Cancelar"}
        </button>
        {!terminou && (
          <button type="button" className="btn-primario" onClick={enviar} disabled={enviando || itens.length === 0}>
            {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
            {enviando ? "Enviando..." : `Enviar ${itens.length || ""}`}
          </button>
        )}
      </div>
    </div>
  );
}
