"use client";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { classify, type MapOrg, type Selection } from "./types";

const MapCanvas = dynamic(() => import("./MapCanvas"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-sea" />,
});

/** Mapa del directorio: solo nodos de colectivos. Al pulsar se abre su ficha. */
export function OrgMap({ orgs }: { orgs: MapOrg[] }) {
  const router = useRouter();
  const [selection, setSelection] = useState<Selection>(null);
  const empty = useMemo(() => classify(null, "abs"), []);
  return (
    <div className="relative h-[46svh] min-h-[320px] border-2 border-ink bg-sea">
      <MapCanvas
        events={[]}
        orgs={orgs}
        layers={{ events: false, stats: false, orgs: true }}
        level="province"
        classified={empty}
        selection={selection}
        view="peninsula"
        flyTo={null}
        onHoverTerritory={() => {}}
        onSelect={(s) => {
          setSelection(s);
          if (s?.kind === "org") {
            const o = orgs.find((x) => x.id === s.id);
            if (o) router.push(`/colectivos/${o.slug}`);
          }
        }}
      />
    </div>
  );
}
