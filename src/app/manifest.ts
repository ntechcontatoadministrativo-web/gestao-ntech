import type { MetadataRoute } from "next";

// Permite instalar o sistema no celular ("Adicionar à tela inicial").
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NTECH Hub",
    short_name: "NTECH Hub",
    description: "Hub interno da NTECH: quadro, chamados, deploys e clientes.",
    start_url: "/painel",
    display: "standalone",
    background_color: "#0B0F0E",
    theme_color: "#0B0F0E",
    lang: "pt-BR",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
