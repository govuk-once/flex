/* eslint-disable no-undef */
(async () => {
  const status = document.getElementById("status");
  try {
    const res = await fetch("/docs/index.json", { cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { domains } = await res.json();
    if (!Array.isArray(domains) || domains.length === 0) {
      status.textContent = "no specs found — run `pnpm openapi:generate` first";
      return;
    }
    status.textContent = `${domains.length} domain(s)`;
    window.ui = SwaggerUIBundle({
      urls: domains.map((d) => ({ url: d.spec, name: d.name })),
      dom_id: "#swagger-ui",
      deepLinking: true,
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
      layout: "StandaloneLayout",
    });
  } catch (err) {
    status.textContent = `failed to load specs index: ${err.message}`;
  }
})();
