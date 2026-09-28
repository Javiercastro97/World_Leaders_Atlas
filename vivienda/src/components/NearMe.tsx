"use client";
/**
 * "Cerca de ti". Privacidad:
 *  - la geolocalización solo se solicita tras pulsar un botón y leer para qué se usa;
 *  - la posición se redondea a ~1 km en el navegador antes de enviarla;
 *  - la petición no se cachea ni se registra, y no se guarda nada en el dispositivo.
 * Alternativa sin geolocalización: municipio o código postal.
 */
import Link from "next/link";
import { useRef, useState } from "react";
import { coarsen, RADII_KM, searchMunicipios, displayMunicipioName, type MunicipioEntry, type MunicipioRow } from "@/lib/geo";
import { EVENT_TYPE_LABEL } from "@/lib/vocab";
import { humanDay } from "@/lib/dates";
import { provinceFromPostalCode } from "@/lib/territories";

interface NearEvent {
  id: string;
  slug: string;
  title: string;
  type: keyof typeof EVENT_TYPE_LABEL;
  date: string;
  time: string | null;
  timezone: "Europe/Madrid" | "Atlantic/Canary";
  organizer_name: string;
  distance_km: number;
  location: { municipality_name: string | null };
}

export function NearMe() {
  const [radius, setRadius] = useState<number>(25);
  const [state, setState] = useState<"idle" | "asking" | "loading" | "done" | "error">("idle");
  const [msg, setMsg] = useState<string | null>(null);
  const [events, setEvents] = useState<NearEvent[]>([]);
  const [origin, setOrigin] = useState<{ lat: number; lon: number; label: string } | null>(null);
  const [q, setQ] = useState("");
  const [suggest, setSuggest] = useState<MunicipioEntry[]>([]);
  const [provinceHint, setProvinceHint] = useState<{ slug: string; name: string } | null>(null);
  const muni = useRef<MunicipioRow[] | null>(null);

  async function search(lat: number, lon: number, label: string, r = radius) {
    const c = coarsen(lat, lon);
    setOrigin({ ...c, label });
    setState("loading");
    try {
      const res = await fetch(`/api/events?lat=${c.lat}&lon=${c.lon}&radius=${r}`, { cache: "no-store" });
      const body = await res.json();
      setEvents(body.events ?? []);
      setState("done");
    } catch {
      setState("error");
      setMsg("No se pudo consultar. Revisa tu conexión.");
    }
  }

  function useLocation() {
    if (!("geolocation" in navigator)) {
      setMsg("Tu navegador no permite geolocalización. Usa el buscador de municipio.");
      return;
    }
    setState("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => search(pos.coords.latitude, pos.coords.longitude, "tu ubicación aproximada"),
      () => {
        setState("idle");
        setMsg("No has concedido la ubicación. Puedes buscar por municipio o código postal.");
      },
      { enableHighAccuracy: false, maximumAge: 600_000, timeout: 15_000 },
    );
  }

  async function onQuery(v: string) {
    setQ(v);
    setProvinceHint(null);
    if (/^\d{5}$/.test(v.trim())) {
      const p = provinceFromPostalCode(v);
      setSuggest([]);
      if (p) setProvinceHint({ slug: p.slug, name: p.shortName });
      return;
    }
    if (v.trim().length < 2) return setSuggest([]);
    if (!muni.current) {
      try {
        muni.current = (await (await fetch("/geo/municipios.json")).json()) as MunicipioRow[];
      } catch {
        return;
      }
    }
    setSuggest(searchMunicipios(muni.current, v, 6));
  }

  return (
    <section id="cerca" className="border-t-2 border-ink pt-3" aria-labelledby="cerca-h">
      <h2 id="cerca-h" className="kicker">
        Cerca de ti
      </h2>
      <div className="field mt-3">
        <label htmlFor="near-radius">Radio</label>
        <select
          id="near-radius"
          className="input"
          value={radius}
          onChange={(e) => {
            const r = Number(e.target.value);
            setRadius(r);
            if (origin) search(origin.lat, origin.lon, origin.label, r);
          }}
        >
          {RADII_KM.map((r) => (
            <option key={r} value={r}>
              {r} km
            </option>
          ))}
        </select>
      </div>

      {state === "asking" ? (
        <div className="mt-3 border-2 border-ink p-3 text-sm space-y-2" role="dialog" aria-label="Permiso de ubicación">
          <p>
            Tu navegador te pedirá permiso. Usaremos la posición <strong>solo para esta búsqueda</strong>, redondeada a ~1 km,{" "}
            <strong>sin guardarla</strong> ni asociarla a ti.
          </p>
          <div className="flex gap-2">
            <button type="button" className="btn btn-ink btn-sm" onClick={useLocation}>
              De acuerdo
            </button>
            <button type="button" className="btn btn-sm" onClick={() => setState("idle")}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn w-full mt-3" onClick={() => setState("asking")}>
          Usar mi ubicación
        </button>
      )}

      <div className="field mt-4 relative">
        <label htmlFor="near-q">…o municipio / código postal</label>
        <input id="near-q" className="input" value={q} onChange={(e) => onQuery(e.target.value)} autoComplete="off" inputMode="search" placeholder="Getafe, 03203…" />
        {suggest.length > 0 && (
          <ul className="border-2 border-t-0 border-ink bg-card" role="listbox" aria-label="Municipios">
            {suggest.map((m) => (
              <li key={m.ine}>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 hover:bg-paper-2 focus-visible:bg-paper-2"
                  onClick={() => {
                    setSuggest([]);
                    setQ(displayMunicipioName(m.name));
                    search(m.lat, m.lon, displayMunicipioName(m.name));
                  }}
                >
                  {displayMunicipioName(m.name)}
                </button>
              </li>
            ))}
          </ul>
        )}
        {provinceHint && (
          <p className="hint">
            Ese código postal corresponde a la provincia de {provinceHint.name}.{" "}
            <Link href={`/agenda/${provinceHint.slug}`}>Ver su agenda</Link> o escribe el municipio para buscar por distancia.
          </p>
        )}
      </div>

      {msg && <p className="text-sm mt-2" role="status">{msg}</p>}
      {state === "loading" && <p className="text-sm mt-3" role="status">Buscando…</p>}
      {state === "done" && origin && (
        <div className="mt-3" aria-live="polite">
          <p className="text-sm text-ink-3">
            {events.length} convocatorias a menos de {radius} km de {origin.label}.
          </p>
          <ul>
            {events.map((e) => (
              <li key={e.id} className="border-t border-rule py-2">
                <Link href={`/convocatorias/${e.slug}`} className="no-underline hover:underline">
                  <span className="block text-xs font-bold uppercase text-signal">
                    {humanDay(e.date, new Date(), e.timezone, "short")} {e.time ?? ""} · {e.distance_km} km
                  </span>
                  <span className="block font-bold leading-snug">{e.title}</span>
                  <span className="block text-sm text-ink-3">
                    {EVENT_TYPE_LABEL[e.type]} · {e.organizer_name}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
