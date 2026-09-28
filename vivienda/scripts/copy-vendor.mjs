// Copia el worker de MapLibre (ES module + chunk compartido) a /public para servirlo desde
// nuestro propio origen. Se ejecuta en postinstall/predev/prebuild.
import { cpSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const pkg = JSON.parse(readFileSync(path.join(root, "node_modules/maplibre-gl/package.json"), "utf8"));
const dest = path.join(root, "public/vendor/maplibre");
rmSync(dest, { recursive: true, force: true });
mkdirSync(path.join(dest, pkg.version), { recursive: true });
for (const f of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  cpSync(path.join(root, "node_modules/maplibre-gl/dist", f), path.join(dest, pkg.version, f));
}
console.log(`maplibre ${pkg.version} → public/vendor/maplibre/${pkg.version}`);
