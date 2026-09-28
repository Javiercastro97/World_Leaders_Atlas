export function DemoBanner() {
  return (
    <div className="demo-band" role="note">
      <p className="mx-auto max-w-[1600px] px-4 md:px-6 py-2 text-[13px] font-bold tracking-wide">
        ENTORNO DE DESARROLLO · Se muestran datos DEMO / FICTICIOS marcados con [DEMO]. No corresponden a hechos reales y
        nunca se publican en producción.
      </p>
    </div>
  );
}

export function DemoTag() {
  return (
    <span className="inline-block bg-ink text-paper text-[10px] font-black tracking-widest px-1.5 py-0.5 align-middle">
      DEMO
    </span>
  );
}
