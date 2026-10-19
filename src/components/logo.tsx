export function LogoMarca({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="14" fill="#5CFF4F" />
      <path d="M18 46V22c0-3 2-5 5-5s4 1 5 3l9 16V18h9v24c0 3-2 5-5 5s-4-1-5-3l-9-16v18z" fill="#0B0F0E" />
    </svg>
  );
}

export function Logo({ subtitulo = true }: { subtitulo?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <LogoMarca />
      <div className="leading-tight">
        <div className="text-lg font-extrabold tracking-[0.08em] text-white">NTECH</div>
        {subtitulo && (
          <div className="whitespace-nowrap font-mono text-[10px] font-semibold tracking-[0.06em] text-ink-400">
            <span className="text-neon">~/</span>hub interno
          </div>
        )}
      </div>
    </div>
  );
}
