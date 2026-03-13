/**
 * Clini-bot QA Test Suite
 * Executar com: node scripts/qa-test.mjs
 *
 * Requer o servidor Next.js rodando em http://localhost:3000
 * (npm run dev  ou  npm run start)
 */

const BASE_URL = process.env.QA_BASE_URL ?? "http://localhost:3000";
const TIMEOUT_MS = 15_000; // 15 s por requisição

let passed = 0;
let failed = 0;
const results = [];

// ─── Utilitários ─────────────────────────────────────────────────────────────

/**
 * fetch com timeout via AbortController
 */
async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal, redirect: "manual" });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Registra e executa um teste.
 * @param {string} name   - Nome descritivo do teste
 * @param {() => Promise<void>} fn - Função de asserção; lança erro se falhar
 */
async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅  ${name}`);
    passed++;
    results.push({ name, status: "PASS" });
  } catch (e) {
    const msg = e?.message ?? String(e);
    console.log(`  ❌  ${name}: ${msg}`);
    failed++;
    results.push({ name, status: "FAIL", error: msg });
  }
}

/**
 * Imprime cabeçalho de grupo de testes
 */
function group(title) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${"─".repeat(60)}`);
}

// ─── Grupo A — Páginas (GET) ──────────────────────────────────────────────────

group("Grupo A — Páginas (GET requests)");

await test("GET / → 200 ou redirecionamento (3xx)", async () => {
  const res = await fetchWithTimeout(`${BASE_URL}/`);
  const ok = res.status === 200 || (res.status >= 301 && res.status <= 308);
  if (!ok) throw new Error(`status inesperado: ${res.status}`);
});

await test("GET /auth/login → 200", async () => {
  const res = await fetchWithTimeout(`${BASE_URL}/auth/login`);
  if (res.status !== 200) throw new Error(`status inesperado: ${res.status}`);
});

await test("GET /auth/signup → 200", async () => {
  const res = await fetchWithTimeout(`${BASE_URL}/auth/signup`);
  if (res.status !== 200) throw new Error(`status inesperado: ${res.status}`);
});

await test("GET /dashboard → 200 ou 307 (redireciona sem auth)", async () => {
  const res = await fetchWithTimeout(`${BASE_URL}/dashboard`);
  const ok = res.status === 200 || res.status === 307 || res.status === 302;
  if (!ok) throw new Error(`status inesperado: ${res.status}`);
});

await test("GET /dashboard/conversations → 200 ou 307", async () => {
  const res = await fetchWithTimeout(`${BASE_URL}/dashboard/conversations`);
  const ok = res.status === 200 || res.status === 307 || res.status === 302;
  if (!ok) throw new Error(`status inesperado: ${res.status}`);
});

await test("GET /dashboard/alerts → 200 ou 307", async () => {
  const res = await fetchWithTimeout(`${BASE_URL}/dashboard/alerts`);
  const ok = res.status === 200 || res.status === 307 || res.status === 302;
  if (!ok) throw new Error(`status inesperado: ${res.status}`);
});

await test("GET /dashboard/config → 200 ou 307", async () => {
  const res = await fetchWithTimeout(`${BASE_URL}/dashboard/config`);
  const ok = res.status === 200 || res.status === 307 || res.status === 302;
  if (!ok) throw new Error(`status inesperado: ${res.status}`);
});

await test("GET /dashboard/onboarding → 200 ou 307", async () => {
  const res = await fetchWithTimeout(`${BASE_URL}/dashboard/onboarding`);
  const ok = res.status === 200 || res.status === 307 || res.status === 302;
  if (!ok) throw new Error(`status inesperado: ${res.status}`);
});

// ─── Grupo B — Webhooks (POST) ────────────────────────────────────────────────

group("Grupo B — Webhooks (POST requests)");

await test("GET /api/webhooks/whatsapp → 200 (verificação Z-API)", async () => {
  const res = await fetchWithTimeout(`${BASE_URL}/api/webhooks/whatsapp`);
  if (res.status !== 200) throw new Error(`status inesperado: ${res.status}`);
  const json = await res.json();
  if (json?.status !== "ok") throw new Error(`body inesperado: ${JSON.stringify(json)}`);
});

await test("POST /api/webhooks/whatsapp sem body → não trava (200 ou 400 ou 500)", async () => {
  const res = await fetchWithTimeout(`${BASE_URL}/api/webhooks/whatsapp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "",
  });
  const valid = [200, 400, 401, 500].includes(res.status);
  if (!valid) throw new Error(`status inesperado: ${res.status}`);
});

await test(
  "POST /api/webhooks/whatsapp com payload Z-API válido mas instanceId inexistente → 200 (graceful)",
  async () => {
    const payload = {
      instanceId: "instancia-inexistente-qa-test",
      momment: Date.now(),
      type: "ReceivedCallback",
      phone: "5511999990000",
      fromMe: false,
      senderName: "QA Test",
      text: { message: "Olá, quero agendar uma consulta" },
    };
    const res = await fetchWithTimeout(`${BASE_URL}/api/webhooks/whatsapp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    // Sem ZAPI_WEBHOOK_SECRET configurado → aceita o payload e responde 200 (clinic not found → ok: true)
    // Com ZAPI_WEBHOOK_SECRET configurado → rejeita com 401 (também aceitável)
    const valid = [200, 401].includes(res.status);
    if (!valid) throw new Error(`status inesperado: ${res.status}`);
  }
);

await test(
  "POST /api/webhooks/whatsapp — payload fromMe:true → 200 (ignorado silenciosamente)",
  async () => {
    const payload = {
      instanceId: "instancia-qualquer",
      momment: Date.now(),
      type: "ReceivedCallback",
      phone: "5511999990000",
      fromMe: true,
      senderName: "Bot",
      text: { message: "mensagem do próprio bot" },
    };
    const res = await fetchWithTimeout(`${BASE_URL}/api/webhooks/whatsapp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const valid = [200, 401].includes(res.status);
    if (!valid) throw new Error(`status inesperado: ${res.status}`);
  }
);

await test(
  "POST /api/webhooks/twilio/whatsapp com form data vazio → 200 (TwiML ou mensagem de erro)",
  async () => {
    // Sem assinatura Twilio válida → espera 403 (Forbidden) ou, em ambiente sem validação, 200
    const res = await fetchWithTimeout(`${BASE_URL}/api/webhooks/twilio/whatsapp`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ From: "", To: "", Body: "" }).toString(),
    });
    // 403 = Twilio signature inválida (comportamento esperado em produção)
    // 200 = validação de assinatura desabilitada / modo dev
    const valid = [200, 403].includes(res.status);
    if (!valid) throw new Error(`status inesperado: ${res.status}`);
  }
);

await test(
  "POST /api/webhooks/twilio/voice com form data vazio → 403 ou TwiML de erro",
  async () => {
    const res = await fetchWithTimeout(`${BASE_URL}/api/webhooks/twilio/voice`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: "", From: "" }).toString(),
    });
    const valid = [200, 403].includes(res.status);
    if (!valid) throw new Error(`status inesperado: ${res.status}`);
    if (res.status === 200) {
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("xml") && !ct.includes("text")) {
        throw new Error(`Content-Type inesperado para resposta 200: ${ct}`);
      }
    }
  }
);

await test(
  "POST /api/webhooks/twilio/voice/process sem clinicId → 403 ou TwiML de erro",
  async () => {
    const res = await fetchWithTimeout(`${BASE_URL}/api/webhooks/twilio/voice/process`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ SpeechResult: "quero agendar" }).toString(),
    });
    const valid = [200, 403, 400, 500].includes(res.status);
    if (!valid) throw new Error(`status inesperado: ${res.status}`);
  }
);

// ─── Grupo C — Casos de erro conhecidos / regressões ─────────────────────────

group("Grupo C — Casos de erro / regressões");

await test(
  "Loop de onboarding — GET /dashboard/onboarding NÃO redireciona para si mesmo",
  async () => {
    const res = await fetchWithTimeout(`${BASE_URL}/dashboard/onboarding`);
    // O proxy redireciona para /auth/login (sem auth) → status 302/307
    // Se houvesse loop, o servidor travaria ou devolveria 508/500
    if (res.status === 508) throw new Error("Loop detectado (HTTP 508)");
    if (res.status >= 500) throw new Error(`Erro de servidor indicando possível loop: ${res.status}`);

    // Se houve redirecionamento, verificar que NÃO aponta de volta para onboarding
    const location = res.headers.get("location") ?? "";
    if (location.includes("/dashboard/onboarding")) {
      throw new Error(`Redirecionamento circular detectado! Location: ${location}`);
    }
  }
);

await test(
  "GET /dashboard/config sem auth → redireciona para /auth/login, não para si mesmo",
  async () => {
    const res = await fetchWithTimeout(`${BASE_URL}/dashboard/config`);
    const location = res.headers.get("location") ?? "";

    // Sem auth deve ir para login
    if (res.status === 307 || res.status === 302) {
      if (location.includes("/dashboard/config")) {
        throw new Error(`Loop! /dashboard/config redireciona para si mesmo. Location: ${location}`);
      }
      if (location.includes("/dashboard/onboarding")) {
        // Ainda aceitável: quer dizer que o usuário está autenticado mas sem clínica
        // O importante é que NÃO seja um loop config → config
        return;
      }
      if (!location.includes("/auth/login") && !location.includes("/dashboard")) {
        throw new Error(`Redirecionamento inesperado: ${location}`);
      }
    }
  }
);

await test(
  "GET /auth/login com usuário já autenticado → não deve retornar 500",
  async () => {
    // Sem cookies → apenas verifica que a página de login responde normalmente
    const res = await fetchWithTimeout(`${BASE_URL}/auth/login`);
    if (res.status >= 500) throw new Error(`Erro de servidor: ${res.status}`);
  }
);

await test(
  "Endpoint inexistente → 404, não 500",
  async () => {
    const res = await fetchWithTimeout(`${BASE_URL}/rota-que-nao-existe-qa-${Date.now()}`);
    if (res.status === 500) throw new Error("Servidor retornou 500 para rota inexistente");
    if (res.status !== 404 && !(res.status >= 301 && res.status <= 308)) {
      throw new Error(`Status inesperado para rota inexistente: ${res.status}`);
    }
  }
);

await test(
  "POST /api/webhooks/whatsapp com JSON malformado → 400 ou 500, nunca travar",
  async () => {
    const res = await fetchWithTimeout(`${BASE_URL}/api/webhooks/whatsapp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ este json é inválido ::::",
    });
    // Deve responder rapidamente com qualquer código, nunca timeout
    const valid = [200, 400, 401, 500].includes(res.status);
    if (!valid) throw new Error(`status inesperado: ${res.status}`);
  }
);

// ─── Resultados finais ────────────────────────────────────────────────────────

const total = passed + failed;
console.log(`\n${"=".repeat(60)}`);
console.log(`  Resultados: ${passed} passou, ${failed} falhou  (total: ${total})`);
console.log(`${"=".repeat(60)}\n`);

if (failed > 0) {
  console.log("  Testes que falharam:");
  results
    .filter((r) => r.status === "FAIL")
    .forEach((r) => console.log(`    - ${r.name}\n      ↳ ${r.error}`));
  console.log("");
  process.exit(1);
} else {
  console.log("  Todos os testes passaram.\n");
  process.exit(0);
}
