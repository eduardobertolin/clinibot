# Relatório QA — Clini-bot

## Cabeçalho

| Campo         | Valor                          |
|---------------|-------------------------------|
| Data do teste | <!-- ex: 2026-03-12 -->       |
| Versão / SHA  | <!-- git rev-parse --short HEAD --> |
| Ambiente      | <!-- dev / staging / prod --> |
| URL testada   | <!-- ex: http://localhost:3000 --> |
| Testador      |                               |

---

## Fluxos testados

### Páginas (GET)

- [ ] `GET /` — página inicial responde (200 ou redirect)
- [ ] `GET /auth/login` — página de login carrega sem erros
- [ ] `GET /auth/signup` — página de cadastro carrega sem erros
- [ ] `GET /dashboard` — redireciona para login quando sem autenticação
- [ ] `GET /dashboard` — carrega corretamente quando autenticado
- [ ] `GET /dashboard/conversations` — lista de conversas visível
- [ ] `GET /dashboard/alerts` — lista de alertas visível
- [ ] `GET /dashboard/config` — configurações da clínica carregam
- [ ] `GET /dashboard/onboarding` — guia de configuração inicial carrega

### Webhooks (POST)

- [ ] `GET /api/webhooks/whatsapp` — resposta `{"status":"ok"}` (verificação Z-API)
- [ ] `POST /api/webhooks/whatsapp` body vazio — não retorna 5xx / não trava
- [ ] `POST /api/webhooks/whatsapp` payload Z-API válido, instanceId inexistente — retorna `{"ok":true}`
- [ ] `POST /api/webhooks/whatsapp` payload `fromMe:true` — ignorado silenciosamente
- [ ] `POST /api/webhooks/twilio/whatsapp` form vazio sem assinatura — retorna 403
- [ ] `POST /api/webhooks/twilio/voice` form vazio sem assinatura — retorna 403
- [ ] `POST /api/webhooks/twilio/voice/process` sem clinicId — retorna 403 ou TwiML de erro

### Regressões conhecidas

- [ ] `/dashboard/onboarding` NÃO redireciona para si mesmo (loop eliminado)
- [ ] `/dashboard/config` sem auth redireciona para `/auth/login`, não para si mesmo
- [ ] JSON malformado no webhook WhatsApp — retorna 400/500, não trava o servidor
- [ ] Rota inexistente — retorna 404, não 500

### Fluxo manual E2E (requer credenciais reais)

- [ ] Envio de mensagem WhatsApp via Z-API → resposta do bot em PT-BR
- [ ] Solicitação de agendamento via WhatsApp → consulta criada no dashboard
- [ ] Cancelamento de consulta via WhatsApp → status atualizado no dashboard
- [ ] Ligação via Twilio → saudação em PT-BR com voz Polly.Camila
- [ ] Mensagem de emergência → alerta criado em `/dashboard/alerts`
- [ ] Login / logout via Supabase Auth
- [ ] Cadastro de nova clínica via `/dashboard/onboarding`
- [ ] Adição de médico e serviço via `/dashboard/config`

---

## Bugs encontrados

| # | Severidade | Descrição | Passos para reproduzir | Status |
|---|------------|-----------|------------------------|--------|
| 1 | <!-- Crítico / Alto / Médio / Baixo --> | | | <!-- Aberto / Em correção / Corrigido --> |
| 2 | | | | |

> **Escala de severidade:**
> - **Crítico** — sistema indisponível ou perda de dados
> - **Alto** — funcionalidade principal quebrada
> - **Médio** — funcionalidade degradada com contorno disponível
> - **Baixo** — cosmético ou caso extremo improvável

---

## Performance observada

| Página / Endpoint              | Tempo de resposta (ms) | Observação |
|-------------------------------|------------------------|------------|
| `GET /`                        |                        |            |
| `GET /auth/login`              |                        |            |
| `GET /dashboard`               |                        |            |
| `GET /dashboard/conversations` |                        |            |
| `GET /dashboard/alerts`        |                        |            |
| `GET /dashboard/config`        |                        |            |
| `POST /api/webhooks/whatsapp`  |                        |            |

> Referência: respostas de página devem ser < 2 s; webhooks devem responder em < 500 ms.

---

## Resultado do script automatizado

```
# Colar aqui a saída de: npm run qa
```

---

## Comentários gerais

<!-- Observações sobre estabilidade, comportamento inesperado, melhorias sugeridas -->

---

## Aprovação

| Papel        | Nome | Assinatura / Data |
|--------------|------|-------------------|
| QA           |      |                   |
| Desenvolvedor|      |                   |
| Responsável  |      |                   |
