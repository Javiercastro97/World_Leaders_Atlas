import { expect, test, type Page } from "@playwright/test";

/** Solo las tarjetas de los fixtures (otros tests publican convocatorias adicionales). */
const fixtureCards = (page: Page) => page.getByTestId("event-card").filter({ hasText: "[PRUEBA E2E]" });

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

test.describe("inicio", () => {
  test("mapa, capas y listado equivalente", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/la vivienda/i);
    const activate = page.getByRole("button", { name: "Activar mapa interactivo" });
    if (await activate.isVisible()) await activate.click();
    await expect(page.getByRole("region", { name: /mapa interactivo/i })).toBeVisible();
    const toggle = page.getByRole("button", { name: "Colectivos" });
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    // Todo lo del mapa está también en el listado lateral
    const panel = page.getByRole("complementary", { name: "Panel de información" });
    await expect(panel.getByRole("button", { name: /Alicante/ }).first()).toBeVisible();
    await panel.getByRole("button", { name: /Alicante/ }).first().click();
    await expect(panel.getByRole("link", { name: /ver convocatoria original/i })).toHaveAttribute("href", /example\.org/);
    // Contadores con contexto temporal
    await expect(page.getByText(/Practicados · 2024/).filter({ visible: true })).toHaveCount(1);
    await noHorizontalScroll(page);
  });

  test("los marcadores son botones accesibles por teclado", async ({ page }) => {
    await page.goto("/");
    // En móvil el mapa interactivo se carga bajo demanda
    const activate = page.getByRole("button", { name: "Activar mapa interactivo" });
    if (await activate.isVisible()) await activate.click();
    const markers = page.locator("button.mk");
    await expect(markers.first()).toBeVisible({ timeout: 15_000 });
    await expect(markers.first()).toHaveAttribute("aria-label", /.+/);
  });
});

test.describe("agenda", () => {
  test("pestañas y filtros sin JavaScript necesario", async ({ page }) => {
    await page.goto("/agenda?tab=proximas");
    await expect(fixtureCards(page)).toHaveCount(4);
    await page.getByRole("link", { name: /^Mañana/ }).click();
    await expect(fixtureCards(page)).toHaveCount(1);
    await expect(page.getByTestId("event-card").first()).toContainText("Convoca:");
    await page.goto("/agenda?tab=proximas&provincia=PR-03");
    await expect(fixtureCards(page)).toHaveCount(2);
    await page.goto("/agenda?tab=proximas&provincia=PR-08");
    await expect(page.getByRole("status")).toContainText(/No hay convocatorias/);
  });

  test("página provincial SEO", async ({ page }) => {
    await page.goto("/agenda/alicante?tab=proximas");
    await expect(page).toHaveTitle(/Alicante/);
    await expect(fixtureCards(page)).toHaveCount(2);
  });
});

test.describe("ficha de convocatoria", () => {
  test("procedencia, CTAs y calendario", async ({ page, request }) => {
    await page.goto("/convocatorias/prueba-manana-alicante");
    await expect(page.getByTestId("source-box")).toContainText("Abrir publicación original");
    const actions = page.getByTestId("event-actions").filter({ visible: true });
    await expect(actions.getByRole("link", { name: /ver convocatoria original/i })).toBeVisible();
    await expect(actions.getByRole("button", { name: /compartir/i })).toBeVisible();
    const ics = await request.get("/api/events/prueba-manana-alicante/ics");
    expect(ics.headers()["content-type"]).toContain("text/calendar");
    expect(await ics.text()).toContain("BEGIN:VEVENT");
    const jsonLd = await page.locator('script[type="application/ld+json"]').first().textContent();
    expect(JSON.parse(jsonLd!)["@type"]).toBe("Event");
    await noHorizontalScroll(page);
  });

  test("una convocatoria pendiente no muestra el punto exacto", async ({ page }) => {
    await page.goto("/convocatorias/prueba-pendiente-alicante");
    await expect(page.getByText("Pendiente de verificación").first()).toBeVisible();
    await expect(page.getByText("[PRUEBA] Plaza pública")).toHaveCount(0);
    await expect(page.getByText(/Ubicación aproximada/)).toBeVisible();
  });
});

test.describe("datos", () => {
  test("observatorio con metadatos obligatorios", async ({ page }) => {
    await page.goto("/datos");
    await expect(page.getByRole("heading", { name: "Evolución anual" })).toBeVisible();
    const meta = page.getByTestId("data-meta").first();
    for (const label of ["Fuente", "Periodo", "Última actualización", "Nota metodológica"]) await expect(meta).toContainText(label);
    await page.getByText("Ver tabla de datos").first().click();
    await expect(page.getByRole("table").first()).toContainText("99.999");
  });

  test("página territorial con texto derivado solo de datos", async ({ page }) => {
    await page.goto("/desahucios/alicante");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Desahucios en Alicante");
    await expect(page.getByText(/En 2024 se practicaron/)).toBeVisible();
  });

  test("memoria reproducible con control accesible", async ({ page }) => {
    await page.goto("/memoria");
    const slider = page.getByRole("slider");
    await expect(slider).toHaveAttribute("aria-valuetext", "2024");
    await slider.fill("0");
    await expect(slider).toHaveAttribute("aria-valuetext", "2023");
  });
});

test.describe("colectivos", () => {
  test("directorio, provincia y ficha", async ({ page }) => {
    await page.goto("/colectivos");
    await expect(page.getByRole("heading", { name: /Sindicato Norte/ })).toBeVisible();
    await page.goto("/colectivos/madrid");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Colectivos en Madrid");
    await page.goto("/colectivos/prueba-sindicato-norte");
    await expect(page.getByTestId("source-box")).toBeVisible();
    await expect(page.getByTestId("event-card").first()).toBeVisible();
  });
});

test.describe("envío ciudadano y moderación", () => {
  test.skip(!process.env.DATABASE_URL, "requiere DATABASE_URL (en producción sin BD los envíos están desactivados)");

  test("aviso → revisión → verificación → publicación", async ({ page }) => {
    const unique = `Colectivo E2E ${Date.now()}`;
    await page.goto("/avisa");
    await page.getByLabel("Tipo *").selectOption("asamblea");
    const d = new Date(Date.now() + 2 * 86400_000).toISOString().slice(0, 10);
    await page.getByLabel("Fecha *").fill(d);
    await page.getByLabel("Hora").fill("19:00");
    await page.getByLabel("Municipio *").fill("Elche");
    await page.getByLabel("Provincia *").selectOption("PR-03");
    await page.getByLabel("Organización convocante *").fill(unique);
    await page.getByLabel(/URL de la publicación original/).fill("https://example.org/e2e");
    await page.getByLabel("Descripción *").fill("Asamblea abierta de prueba. Tel 612345678");
    await page.getByRole("checkbox").check();
    await page.waitForTimeout(3200); // el sello anti-spam rechaza envíos en < 3 s
    await page.getByRole("button", { name: /enviar para revisión/i }).click();
    await expect(page).toHaveURL(/\/avisa\/gracias/);

    // No aparece publicada
    await page.goto("/agenda?tab=proximas");
    await expect(page.getByText(unique)).toHaveCount(0);

    // Moderación
    await page.goto("/moderacion");
    await page.getByLabel("Token de moderación").fill("e2e-token");
    await page.getByRole("button", { name: "Entrar" }).click();
    const card = page.locator("article", { hasText: unique });
    await expect(card).toContainText("Teléfono retirado");
    await card.getByRole("button", { name: "Empezar revisión" }).click();
    await page.locator("article", { hasText: unique }).getByRole("button", { name: "Marcar verificado" }).click();
    const verified = page.locator("article", { hasText: unique });
    await verified.locator('select[name="verification_status"]').selectOption("fuente_oficial");
    await verified.getByRole("button", { name: "Publicar" }).click();
    await expect(page.locator("section", { has: page.getByRole("heading", { name: /^Publicados/ }) })).toContainText(unique);

    await page.goto("/agenda?tab=proximas&provincia=PR-03");
    await expect(page.getByText(unique).first()).toBeVisible();
  });

  test("reportar información", async ({ page }) => {
    await page.goto("/reportar?tipo=event&id=prueba-manana-alicante");
    await page.getByLabel(/Aparecen datos personales/).check();
    await page.getByLabel(/Explícanos/).fill("Se ve un portal que no debería verse.");
    await page.waitForTimeout(3200);
    await page.getByRole("button", { name: "Enviar reporte" }).click();
    await expect(page.getByRole("heading", { name: "Reporte recibido" })).toBeVisible();
  });
});

test.describe("transparencia, SEO y PWA", () => {
  test("páginas públicas, sitemap, robots y manifest", async ({ page, request }) => {
    for (const p of ["/metodologia", "/fuentes", "/privacidad"]) {
      await page.goto(p);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).toContain("/desahucios/alicante");
    expect(sitemap).toContain("/agenda/madrid");
    expect(sitemap).toContain("/convocatorias/prueba-manana-alicante");
    expect(await (await request.get("/robots.txt")).text()).toMatch(/Disallow: \/moderacion/);
    const manifest = await (await request.get("/manifest.webmanifest")).json();
    expect(manifest.display).toBe("standalone");
    expect((await request.get("/sw.js")).ok()).toBe(true);
  });
});
