import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const BASE = "http://127.0.0.1:3000";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const ARTIFACT_DIR =
  "C:\\Users\\Lucas\\.gemini\\antigravity\\brain\\d84b24a8-ffa0-4a16-a71b-c166b3d14592\\scratch";

const WIDTHS = [320, 360, 390, 430, 768, 1024, 1440];

class CdpClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 0;
    this.pending = new Map();
    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    };
  }
  async open() {
    if (this.ws.readyState === WebSocket.OPEN) return;
    await new Promise((res, rej) => {
      this.ws.onopen = res;
      this.ws.onerror = rej;
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  close() {
    this.ws.close();
  }
}

async function waitForChrome(port) {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (r.ok) return r.json();
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("Chrome DevTools não respondeu");
}

async function main() {
  await fs.mkdir(ARTIFACT_DIR, { recursive: true });
  const userDataDir = path.join(ARTIFACT_DIR, "chrome-profile");
  const chrome = spawn(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      "--remote-debugging-port=9223",
      `--user-data-dir=${userDataDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "about:blank",
    ],
    { stdio: "ignore" }
  );

  try {
    const targets = await waitForChrome(9223);
    const pageTarget = targets.find((t) => t.type === "page") || targets[0];
    const cdp = new CdpClient(pageTarget.webSocketDebuggerUrl);
    await cdp.open();
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Network.enable");

    const navigateAndCheck = async (url, width, height = 844) => {
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: width < 768,
      });
      await cdp.send("Page.navigate", { url });
      await new Promise((r) => setTimeout(r, 900));
      const evalRes = await cdp.send("Runtime.evaluate", {
        expression: `({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
          title: document.title,
          hasBody: Boolean(document.body && document.body.innerText.trim().length > 10)
        })`,
        returnByValue: true,
      });
      const val = evalRes.result.value;
      assert.ok(val.hasBody, `Página vazia em ${url} (${width}px)`);
      assert.ok(
        val.scrollWidth <= val.innerWidth + 1,
        `Overflow horizontal em ${url} @ ${width}px: scrollWidth=${val.scrollWidth} > innerWidth=${val.innerWidth}`
      );
      return val;
    };

    const screenshot = async (name) => {
      const res = await cdp.send("Page.captureScreenshot", { format: "png" });
      await fs.writeFile(
        path.join(ARTIFACT_DIR, name),
        Buffer.from(res.data, "base64")
      );
    };

    // 1. Verificar rotas públicas em todas as larguras
    for (const route of ["/", "/portfolio", "/orcamento", "/agendar", "/entrar"]) {
      for (const w of WIDTHS) {
        await navigateAndCheck(`${BASE}${route}`, w);
      }
      console.log(`OK público ${route} em todas as 7 larguras.`);
    }

    await navigateAndCheck(`${BASE}/`, 390);
    await screenshot("public-home-390.png");
    await navigateAndCheck(`${BASE}/`, 1440, 900);
    await screenshot("public-home-1440.png");

    // 2. Login via API no contexto do browser (fetch com credentials) para testar páginas Admin
    await navigateAndCheck(`${BASE}/entrar`, 1440, 900);
    await cdp.send("Runtime.evaluate", {
      expression: `(async () => {
        await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: ${JSON.stringify(process.env.ADMIN_BOOTSTRAP_EMAIL || "leticia@zanimatattoo.com.br")},
            password: ${JSON.stringify(process.env.ADMIN_BOOTSTRAP_PASSWORD || "Zanima@2026!")}
          })
        });
      })()`,
      awaitPromise: true,
    });

    for (const route of [
      "/admin",
      "/admin/agenda",
      "/admin/clientes",
      "/admin/projetos",
      "/admin/orcamentos",
      "/admin/financeiro",
      "/admin/mais",
      "/admin/estoque",
      "/admin/documentos",
      "/admin/fidelizacao",
      "/admin/configuracoes",
    ]) {
      for (const w of WIDTHS) {
        await navigateAndCheck(`${BASE}${route}`, w);
      }
      console.log(`OK admin ${route} em todas as 7 larguras.`);
    }

    await navigateAndCheck(`${BASE}/admin`, 390);
    await screenshot("admin-dashboard-390.png");
    await navigateAndCheck(`${BASE}/admin/financeiro`, 1440, 900);
    await screenshot("admin-financeiro-1440.png");

    // Testar alternância de tema para escuro e voltar ao claro
    await cdp.send("Runtime.evaluate", {
      expression: `(() => {
        const btn = document.querySelector('button[aria-label="Alternar tema claro ou escuro"]');
        if (btn) btn.click();
        return document.documentElement.getAttribute('data-theme');
      })()`,
      returnByValue: true,
    });
    await new Promise((r) => setTimeout(r, 300));
    await screenshot("admin-financeiro-dark-1440.png");
    await cdp.send("Runtime.evaluate", {
      expression: `(() => {
        const btn = document.querySelector('button[aria-label="Alternar tema claro ou escuro"]');
        if (btn) btn.click();
      })()`,
    });

    cdp.close();
    console.log("VALIDAÇÃO RESPONSIVA (320px–1440px) E VISUAL CONCLUÍDA!");
  } finally {
    chrome.kill("SIGKILL");
  }
}

main().catch((err) => {
  console.error("ERRO NO TESTE RESPONSIVO:", err);
  process.exit(1);
});
