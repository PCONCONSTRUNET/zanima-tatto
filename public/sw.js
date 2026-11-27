// ZANIMA TATTOO Service Worker (Cache de marca estático)
// Regra estrita de privacidade e LGPD: NUNCA armazenar em cache dados financeiros,
// dados de saúde/prontuário, documentos assinados, rotas autenticadas ou arquivos privados.

const STATIC_CACHE = "zanima-static-v3";
const STATIC_ASSETS = [
  "/brand/zanima-logo.png",
  "/brand/zanima-monogram.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
  "/icons/favicon-64.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Rotas autenticadas, APIs e arquivos privados: estritamente network-only
  if (
    url.pathname.startsWith("/admin") ||
    url.pathname.startsWith("/minha-conta") ||
    url.pathname.startsWith("/api")
  ) {
    return;
  }

  // Apenas ativos visuais públicos estáticos da marca usam cache-first com atualização
  if (
    url.pathname.startsWith("/brand/") ||
    url.pathname.startsWith("/icons/")
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC_CACHE).then((c) => c.put(request, copy));
            }
            return res;
          })
      )
    );
  }
});
