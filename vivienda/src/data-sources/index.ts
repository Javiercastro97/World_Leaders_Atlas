/**
 * Registro de proveedores de datos. Para añadir uno nuevo, ver DATA_SOURCES.md
 * ("Cómo añadir un proveedor"): implementa `DataSourceAdapter` y regístralo aquí.
 */
import { cgpjAdapter } from "./cgpj";
import { ineAdapter } from "./ine";
import { manualAdapter } from "./manual";
import type { DataSourceAdapter } from "./types";

export const ADAPTERS = {
  cgpj: cgpjAdapter,
  ine: ineAdapter,
  manual: manualAdapter,
} satisfies Record<string, DataSourceAdapter>;
