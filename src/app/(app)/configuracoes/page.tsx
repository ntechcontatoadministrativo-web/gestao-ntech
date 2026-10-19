import { CheckCircle2, ExternalLink, HardDrive } from "lucide-react";
import { exigirGestor } from "@/lib/auth";
import { db } from "@/lib/db";
import * as google from "@/lib/storage/google";
import { appUrl } from "@/lib/utils";
import { Aviso, Badge, Cabecalho } from "@/components/ui";
import { BotaoDesconectar, FormPastaRaiz, ListaModelos } from "./cliente";
import { whatsappApiAtiva } from "@/lib/whatsapp-api";
import { fmtDataHora } from "@/lib/utils";

export const metadata = { title: "Configurações" };

const MENSAGENS: Record<string, { tom: "ok" | "erro" | "alerta"; texto: string }> = {
  conectado: { tom: "ok", texto: "Google Drive conectado com sucesso." },
  cancelado: { tom: "alerta", texto: "A conexão com o Google foi cancelada." },
  erro: { tom: "erro", texto: "Não foi possível concluir a conexão com o Google. Tente novamente." },
  "estado-invalido": { tom: "erro", texto: "A sessão de conexão expirou. Tente novamente." },
  "sem-credenciais": { tom: "alerta", texto: "Defina GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET nas variáveis de ambiente do servidor." },
};

export default async function Configuracoes({ searchParams }: { searchParams: { google?: string } }) {
  await exigirGestor();
  const [modelos, conectado, conta, raiz, notificacoes] = await Promise.all([
    db.modeloEtapa.findMany({ orderBy: { ordem: "asc" } }),
    google.driveConectado(),
    google.lerConfig(google.CFG_CONTA),
    google.lerConfig(google.CFG_PASTA_RAIZ),
    db.notificacao.findMany({ include: { usuario: { select: { nome: true } } }, orderBy: { criadoEm: "desc" }, take: 15 }),
  ]);
  const msg = searchParams.google ? MENSAGENS[searchParams.google] : null;
  const url = appUrl();

  return (
    <>
      <Cabecalho eyebrow="Configurações" titulo="Configurações" descricao="Integrações, modelos de etapas e avisos por WhatsApp." />
      {msg && (
        <div className="mb-6">
          <Aviso tom={msg.tom}>{msg.texto}</Aviso>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-neon/10 text-neon">
                <HardDrive className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-semibold text-white">Google Drive da NTECH</h2>
                <p className="text-xs text-ink-400">Os arquivos ficam na conta da empresa; a equipe acessa só pelo sistema.</p>
              </div>
            </div>
            {conectado ? <Badge tom="verde">Conectado</Badge> : <Badge tom="amarelo">Modo local</Badge>}
          </div>

          {conectado ? (
            <div className="mt-5 space-y-4">
              <div className="flex items-center gap-2 text-sm text-ink-200">
                <CheckCircle2 className="h-4 w-4 text-neon" /> Conta: <span className="font-semibold">{conta || "—"}</span>
              </div>
              {raiz && (
                <a href={`https://drive.google.com/drive/folders/${raiz}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-ink-300 hover:text-neon">
                  <ExternalLink className="h-4 w-4" /> Abrir pasta principal no Drive
                </a>
              )}
              <FormPastaRaiz />
              <div className="rounded-xl border border-ink-700 bg-ink-900 p-4 text-xs text-ink-400">
                <div className="mb-1 font-semibold text-ink-200">Para o controle de acesso funcionar de verdade</div>
                Remova o compartilhamento direto das pastas de projeto com os funcionários no Google Drive. Assim o sistema passa a ser o único caminho até os
                arquivos, e todo acesso fica registrado.
              </div>
              <BotaoDesconectar />
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              <p className="text-sm text-ink-300">
                Sem o Drive conectado, os arquivos são guardados no próprio servidor (bom para testar). Para produção, conecte a conta da empresa:
              </p>
              {google.googleConfigurado() ? (
                <a href="/api/google/conectar" className="btn-primario">
                  Conectar Google Drive
                </a>
              ) : (
                <ol className="list-decimal space-y-1.5 pl-5 text-sm text-ink-300">
                  <li>
                    No{" "}
                    <a className="text-neon hover:underline" href="https://console.cloud.google.com/apis/library/drive.googleapis.com" target="_blank" rel="noreferrer">
                      Google Cloud Console
                    </a>
                    , ative a <b>Google Drive API</b>.
                  </li>
                  <li>
                    Crie um <b>ID do cliente OAuth</b> do tipo &quot;Aplicativo da Web&quot;.
                  </li>
                  <li>
                    URI de redirecionamento: <code className="rounded bg-ink-800 px-1.5 py-0.5 text-xs text-ink-100">{url || "{APP_URL}"}/api/google/callback</code>
                  </li>
                  <li>
                    Coloque <code className="text-xs">GOOGLE_CLIENT_ID</code> e <code className="text-xs">GOOGLE_CLIENT_SECRET</code> nas variáveis do servidor e reinicie.
                  </li>
                </ol>
              )}
            </div>
          )}
        </section>

        <section className="card p-6">
          <h2 className="font-semibold text-white">Modelos de etapas padrão</h2>
          <p className="mb-4 mt-1 text-xs text-ink-400">Usados ao criar um projeto, conforme o tipo. Os dias definem os prazos sugeridos em sequência.</p>
          <ListaModelos modelos={modelos} />
        </section>

        <section className="card p-6 xl:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-white">WhatsApp automático (API)</h2>
              <p className="mt-1 max-w-3xl text-xs text-ink-400">
                Com a API ligada, o sistema envia os avisos de tarefa e de etapa direto para o WhatsApp de cada pessoa (botão &quot;Enviar pelo sistema&quot;
                e opção de envio automático ao criar tarefa). Sem ela, tudo continua funcionando pelos links do WhatsApp.
              </p>
            </div>
            {whatsappApiAtiva() ? <Badge tom="verde">Ativa</Badge> : <Badge>Desligada</Badge>}
          </div>
          {!whatsappApiAtiva() && (
            <ol className="mt-4 list-decimal space-y-1.5 pl-5 text-sm text-ink-300">
              <li>
                Crie uma instância em <b>z-api.io</b> e conecte o WhatsApp da empresa lendo o QR Code.
              </li>
              <li>
                No servidor (Render → Environment), defina <code className="text-xs">ZAPI_INSTANCE_ID</code>, <code className="text-xs">ZAPI_TOKEN</code> e, se a
                conta exigir, <code className="text-xs">ZAPI_CLIENT_TOKEN</code>. Depois faça um novo deploy.
              </li>
            </ol>
          )}
          {notificacoes.length > 0 && (
            <div className="mt-5 overflow-x-auto">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Quando</th>
                    <th>Para</th>
                    <th>Status</th>
                    <th>Mensagem</th>
                  </tr>
                </thead>
                <tbody>
                  {notificacoes.map((n) => (
                    <tr key={n.id}>
                      <td className="whitespace-nowrap text-xs text-ink-400">{fmtDataHora(n.criadoEm)}</td>
                      <td className="text-sm">{n.usuario.nome}</td>
                      <td>{n.status === "ENVIADA" ? <Badge tom="verde">Enviada</Badge> : <Badge tom="vermelho">Erro</Badge>}</td>
                      <td className="max-w-[360px] truncate text-xs text-ink-400" title={n.erro ?? n.mensagem}>
                        {n.erro ?? n.mensagem.split("\n")[0]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

      </div>
    </>
  );
}
