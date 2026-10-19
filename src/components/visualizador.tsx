"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Minus, Plus, ShieldAlert } from "lucide-react";

// pdf.js carregado do CDN: renderiza as páginas em <canvas>, sem barra de download do navegador.
const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174";

type PdfJs = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (src: { url: string; withCredentials?: boolean }) => { promise: Promise<PdfDoc> };
};
type PdfDoc = { numPages: number; getPage: (n: number) => Promise<PdfPage> };
type PdfPage = {
  getViewport: (o: { scale: number }) => { width: number; height: number };
  render: (o: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => { promise: Promise<void> };
};

let carregando: Promise<PdfJs> | null = null;
function carregarPdfJs(): Promise<PdfJs> {
  const w = window as unknown as { pdfjsLib?: PdfJs };
  if (w.pdfjsLib) return Promise.resolve(w.pdfjsLib);
  carregando ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `${PDFJS}/pdf.min.js`;
    s.onload = () => {
      const lib = (window as unknown as { pdfjsLib: PdfJs }).pdfjsLib;
      lib.GlobalWorkerOptions.workerSrc = `${PDFJS}/pdf.worker.min.js`;
      resolve(lib);
    };
    s.onerror = () => reject(new Error("Não foi possível carregar o visualizador."));
    document.head.appendChild(s);
  });
  return carregando;
}

function MarcaDagua({ texto }: { texto: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden select-none" aria-hidden>
      <div className="absolute -inset-1/2 flex rotate-[-28deg] flex-wrap content-start gap-x-24 gap-y-20 opacity-[0.10]">
        {Array.from({ length: 80 }).map((_, i) => (
          <span key={i} className="whitespace-nowrap text-sm font-bold text-black">
            {texto}
          </span>
        ))}
      </div>
    </div>
  );
}

function Pagina({ doc, numero, escala, marca }: { doc: PdfDoc; numero: number; escala: number; marca: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const [visivel, setVisivel] = useState(numero <= 2);
  const [tam, setTam] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setVisivel(true), { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visivel) return;
    let cancelado = false;
    (async () => {
      const page = await doc.getPage(numero);
      const largura = caixa.current?.parentElement?.clientWidth ?? 800;
      const base = page.getViewport({ scale: 1 });
      const s = (largura / base.width) * escala;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const vp = page.getViewport({ scale: s * dpr });
      const c = canvas.current;
      if (!c || cancelado) return;
      c.width = vp.width;
      c.height = vp.height;
      setTam({ w: vp.width / dpr, h: vp.height / dpr });
      await page.render({ canvasContext: c.getContext("2d")!, viewport: vp }).promise;
    })().catch(() => {});
    return () => {
      cancelado = true;
    };
  }, [visivel, doc, numero, escala]);

  return (
    <div
      ref={caixa}
      className="relative mx-auto mb-4 overflow-hidden bg-white shadow-lg"
      style={{ width: tam?.w ?? "100%", height: tam?.h ?? 900 }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <canvas ref={canvas} className="block h-full w-full" />
      <MarcaDagua texto={marca} />
    </div>
  );
}

export function VisualizadorPdf({ src, marca }: { src: string; marca: string }) {
  const [doc, setDoc] = useState<PdfDoc | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [escala, setEscala] = useState(1);

  useEffect(() => {
    let ativo = true;
    carregarPdfJs()
      .then((lib) => lib.getDocument({ url: src, withCredentials: true }).promise)
      .then((d) => ativo && setDoc(d))
      .catch((e) => ativo && setErro(e?.status === 403 || /403/.test(String(e?.message)) ? "Seu acesso a este arquivo foi bloqueado." : "Não foi possível abrir o PDF."));
    return () => {
      ativo = false;
    };
  }, [src]);

  if (erro)
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-sm text-red-300">
        <ShieldAlert className="h-6 w-6" />
        {erro}
      </div>
    );
  if (!doc)
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-ink-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando documento...
      </div>
    );

  return (
    <div>
      <div className="sticky top-14 z-10 mb-3 flex items-center justify-between rounded-xl border border-ink-700 bg-ink-900/95 px-3 py-2 text-xs text-ink-300 backdrop-blur lg:top-2">
        <span>{doc.numPages} página(s)</span>
        <div className="flex items-center gap-1">
          <button className="btn-fantasma btn-sm" onClick={() => setEscala((e) => Math.max(0.5, e - 0.25))} aria-label="Diminuir zoom">
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="w-12 text-center tabular-nums">{Math.round(escala * 100)}%</span>
          <button className="btn-fantasma btn-sm" onClick={() => setEscala((e) => Math.min(3, e + 0.25))} aria-label="Aumentar zoom">
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl bg-ink-950 p-3 sm:p-5">
        {Array.from({ length: doc.numPages }, (_, i) => (
          <Pagina key={`${i}-${escala}`} doc={doc} numero={i + 1} escala={escala} marca={marca} />
        ))}
      </div>
    </div>
  );
}

export function VisualizadorImagem({ src, marca, alt }: { src: string; marca: string; alt: string }) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-ink-950 p-3" onContextMenu={(e) => e.preventDefault()}>
      <div className="relative mx-auto w-fit">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="mx-auto max-h-[80vh] select-none" draggable={false} />
        <MarcaDagua texto={marca} />
      </div>
    </div>
  );
}
