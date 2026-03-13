# UX Improvements Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar 3 melhorias de UX de alto impacto: badge de alertas na sidebar, resumo do dia no Dashboard e linha de horário atual no calendário.

**Architecture:** O badge de alertas é alimentado pelo layout server-side (conta open escalation_logs e passa como prop para a Sidebar). O Resumo do Dia é um novo componente server-rendered recebendo dados já buscados na dashboard/page.tsx + query adicional de conversas abertas. A linha de "agora" é um efeito client-side no WeeklyCalendar usando `useEffect` + `setInterval`.

**Tech Stack:** Next.js 15 App Router, Supabase (server client), Tailwind CSS, date-fns, lucide-react

---

## Chunk 1: Badge de Alertas na Sidebar

### Task 1: Passar contagem de alertas pelo Layout

**Files:**
- Modify: `src/app/dashboard/layout.tsx`
- Modify: `src/components/dashboard/Sidebar.tsx`

- [ ] **Step 1: Adicionar query de alertas abertos no layout**

Em `src/app/dashboard/layout.tsx`, após carregar a clínica, adicionar a contagem de alertas. Adicionar logo após a resolução de `clinic`:

```typescript
// Contar alertas abertos para exibir badge na sidebar
let openAlertsCount = 0;
if (clinic) {
  const { data: convIds } = await supabase
    .from("conversations")
    .select("id")
    .eq("clinic_id", clinic.id);
  const ids = convIds?.map((c) => c.id) ?? [];
  if (ids.length > 0) {
    const { count } = await supabase
      .from("escalation_logs")
      .select("id", { count: "exact", head: true })
      .eq("status", "open")
      .in("conversation_id", ids);
    openAlertsCount = count ?? 0;
  }
}
```

E passar a prop para o `<Sidebar>`:

```tsx
<Sidebar clinicName={clinic?.name || "Minha Clínica"} alertCount={openAlertsCount} />
```

- [ ] **Step 2: Aceitar e renderizar badge na Sidebar**

Em `src/components/dashboard/Sidebar.tsx`:

Atualizar a assinatura da função:
```typescript
export default function Sidebar({ clinicName, alertCount = 0 }: { clinicName: string; alertCount?: number }) {
```

Mover a lista de navItems para dentro do componente (pois o badge precisa ser dinâmico), ou manter como constante e tratar o badge inline na renderização. A abordagem mais simples é tratar inline:

No map dos navItems, detectar quando o item é "Alertas" e adicionar o badge:

```tsx
{navItems.map(({ href, label, icon: Icon }) => {
  const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
  const isAlerts = href === "/dashboard/alerts";
  return (
    <li key={href}>
      <Link
        href={href}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm ${
          active
            ? "bg-gray-100 text-gray-900 font-medium"
            : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
        }`}
      >
        <Icon className="w-4 h-4" strokeWidth={2} />
        <span className="flex-1">{label}</span>
        {isAlerts && alertCount > 0 && (
          <span className="bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 leading-none">
            {alertCount > 99 ? "99+" : alertCount}
          </span>
        )}
      </Link>
    </li>
  );
})}
```

- [ ] **Step 3: Verificar no browser**

Criar um alerta de teste no Supabase ou usar um existente. Verificar que:
- Badge vermelho aparece ao lado de "Alertas" quando há alertas abertos
- Badge some quando `alertCount === 0`
- Badge mostra "99+" quando count > 99
- O layout visual não quebra (texto e ícone continuam alinhados)

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/layout.tsx src/components/dashboard/Sidebar.tsx
git commit -m "feat: add open-alerts badge to sidebar nav item"
```

---

## Chunk 2: Linha de Horário Atual no Calendário

### Task 2: Indicador de "agora" no WeeklyCalendar

**Files:**
- Modify: `src/components/dashboard/WeeklyCalendar.tsx`

- [ ] **Step 1: Adicionar estado do indicador de horário**

Em `WeeklyCalendar.tsx`, adicionar após as declarações de estado existentes:

```typescript
// Indicador de horário atual
const [nowTop, setNowTop] = useState<number | null>(null);

function calcNowTop(): number | null {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  if (h < START_HOUR || h >= END_HOUR) return null;
  const offsetMins = (h - START_HOUR) * 60 + m;
  return (offsetMins / 60) * HOUR_HEIGHT;
}

useEffect(() => {
  setNowTop(calcNowTop());
  const interval = setInterval(() => setNowTop(calcNowTop()), 60_000);
  return () => clearInterval(interval);
}, []);
```

- [ ] **Step 2: Renderizar a linha no grid**

Dentro do map de `days`, na seção de "Day columns", após os hour lines e antes dos appointments, adicionar a linha vermelha apenas na coluna do dia atual:

```tsx
{/* Linha de horário atual */}
{isToday(day) && nowTop !== null && (
  <div
    className="absolute inset-x-0 z-10 pointer-events-none"
    style={{ top: `${nowTop}px` }}
  >
    <div className="relative flex items-center">
      <span className="w-2 h-2 rounded-full bg-red-500 absolute -left-1 -translate-y-1/2" />
      <div className="border-t-2 border-red-500 w-full" />
    </div>
  </div>
)}
```

Posicionar este bloco dentro da div da coluna do dia, antes da renderização dos appointments (entre os hour lines e os `dayAppts.map`).

- [ ] **Step 3: Verificar visualmente**

Abrir o dashboard na semana atual. Verificar que:
- Uma linha vermelha horizontal aparece na coluna de hoje na posição correta
- Um pequeno círculo vermelho aparece na extremidade esquerda da linha
- A linha não aparece em semanas passadas/futuras
- A linha não bloqueia clique nos appointments (pointer-events-none)
- A linha se move com o tempo (aguardar 1 minuto para confirmar ou testar com horário do sistema)

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/WeeklyCalendar.tsx
git commit -m "feat: add current-time indicator line to weekly calendar"
```

---

## Chunk 3: Resumo do Dia no Dashboard

### Task 3: Criar componente DailyBriefing

**Files:**
- Create: `src/components/dashboard/DailyBriefing.tsx`
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Criar o componente DailyBriefing**

Criar `src/components/dashboard/DailyBriefing.tsx`:

```tsx
import { format, parseISO, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarClock, AlertCircle, MessageSquare, CheckCircle2, Clock } from "lucide-react";
import type { CalendarAppointment } from "@/lib/supabase/types";

interface Props {
  todayAppointments: CalendarAppointment[];
  openAlerts: number;
  openConversations: number;
}

export default function DailyBriefing({ todayAppointments, openAlerts, openConversations }: Props) {
  const now = new Date();
  const confirmed = todayAppointments.filter((a) => a.status === "confirmed").length;
  const scheduled = todayAppointments.filter((a) => a.status === "scheduled").length;
  const completed = todayAppointments.filter((a) => a.status === "completed").length;
  const remaining = todayAppointments.filter(
    (a) => (a.status === "scheduled" || a.status === "confirmed") && isAfter(parseISO(a.start_datetime), now)
  );
  const next = remaining[0] ?? null;

  const items = [
    {
      label: "Hoje",
      value: `${todayAppointments.length} consulta${todayAppointments.length !== 1 ? "s" : ""}`,
      sub: completed > 0 ? `${completed} atendida${completed !== 1 ? "s" : ""}` : `${confirmed + scheduled} a realizar`,
      icon: CalendarClock,
      iconClass: "text-cyan-600",
      bgClass: "bg-cyan-50",
      highlight: false,
    },
    {
      label: "Próxima consulta",
      value: next
        ? format(parseISO(next.start_datetime), "HH:mm", { locale: ptBR })
        : "–",
      sub: next ? next.patient_name : "Nenhuma consulta pendente",
      icon: Clock,
      iconClass: "text-violet-600",
      bgClass: "bg-violet-50",
      highlight: false,
    },
    {
      label: "Alertas abertos",
      value: String(openAlerts),
      sub: openAlerts > 0 ? "Requer atenção" : "Tudo tranquilo",
      icon: AlertCircle,
      iconClass: openAlerts > 0 ? "text-red-600" : "text-gray-400",
      bgClass: openAlerts > 0 ? "bg-red-50" : "bg-gray-50",
      highlight: openAlerts > 0,
    },
    {
      label: "Conversas abertas",
      value: String(openConversations),
      sub: openConversations > 0 ? "Aguardando resposta" : "Nenhuma pendente",
      icon: MessageSquare,
      iconClass: openConversations > 0 ? "text-amber-600" : "text-gray-400",
      bgClass: openConversations > 0 ? "bg-amber-50" : "bg-gray-50",
      highlight: openConversations > 0,
    },
  ];

  return (
    <div className={`rounded-xl border p-5 flex flex-col sm:flex-row gap-4 ${
      openAlerts > 0 ? "bg-red-50 border-red-200" : "bg-white border-gray-200"
    }`}>
      <div className="flex-1">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Resumo de hoje — {format(now, "EEEE, d 'de' MMMM", { locale: ptBR })}
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                className={`rounded-lg p-3 ${item.highlight ? "ring-1 ring-red-300" : ""} ${item.bgClass}`}
              >
                <div className="flex items-start gap-2">
                  <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${item.iconClass}`} strokeWidth={2} />
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500 truncate">{item.label}</p>
                    <p className="text-lg font-bold text-gray-900 leading-tight">{item.value}</p>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{item.sub}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Adicionar query de conversas abertas no dashboard/page.tsx**

Em `src/app/dashboard/page.tsx`, adicionar ao `Promise.all` existente uma query para contar conversas abertas:

```typescript
const [
  { data: doctors },
  { data: appointmentTypes },
  { data: appointments },
  conversationsResult,
  { count: openConversationsCount },  // novo
] = await Promise.all([
  supabase.from("doctors").select("id, name").eq("clinic_id", clinic.id).eq("active", true).order("name"),
  supabase.from("appointment_types").select("id, name, duration_minutes").eq("clinic_id", clinic.id).order("name"),
  supabase
    .from("appointments")
    .select("id, start_datetime, end_datetime, status, source, patient_name, patient_phone, doctors(name), appointment_types(name, duration_minutes)")
    .eq("clinic_id", clinic.id)
    .gte("start_datetime", weekStart.toISOString())
    .lt("start_datetime", weekEnd.toISOString())
    .order("start_datetime", { ascending: true }),
  supabase.from("conversations").select("id").eq("clinic_id", clinic.id),
  supabase.from("conversations").select("id", { count: "exact", head: true }).eq("clinic_id", clinic.id).eq("status", "open"),  // novo
]);

const openConversations = openConversationsCount ?? 0;
```

- [ ] **Step 3: Filtrar appointments de hoje e renderizar DailyBriefing**

Ainda em `dashboard/page.tsx`, adicionar import e filtro:

```typescript
import { startOfWeek, addDays, parseISO, isToday } from "date-fns";
import DailyBriefing from "@/components/dashboard/DailyBriefing";

// Após buscar appointments:
const todayAppointments = (appointments ?? []).filter((a) =>
  isToday(parseISO(a.start_datetime))
) as unknown as CalendarAppointment[];
```

E inserir o componente no JSX, entre o header e os stats cards:

```tsx
<div className="p-8 space-y-6">
  {/* Resumo do dia */}
  <DailyBriefing
    todayAppointments={todayAppointments}
    openAlerts={openAlerts}
    openConversations={openConversations}
  />

  {/* Stats (semana) */}
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
    {/* ... existente ... */}
  </div>

  <WeeklyCalendar ... />
</div>
```

- [ ] **Step 4: Verificar no browser**

Abrir `/dashboard` e verificar:
- Card "Resumo de hoje" aparece acima dos stats cards
- Mostra contagem correta de consultas de hoje
- "Próxima consulta" mostra horário e nome corretos (ou "–" se não houver)
- "Alertas abertos" fica vermelho com ring quando há alertas
- "Conversas abertas" fica âmbar quando há conversas pendentes
- Background do card fica vermelho suave quando há alertas
- Data formatada corretamente em PT-BR

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/DailyBriefing.tsx src/app/dashboard/page.tsx
git commit -m "feat: add daily briefing card to dashboard with today's summary"
```

---

## Verificação Final

- [ ] Abrir sidebar em qualquer página do dashboard com alertas abertos → badge vermelho visível
- [ ] Abrir `/dashboard` na semana atual → linha vermelha no horário correto + DailyBriefing com dados corretos
- [ ] Navegar entre semanas passadas/futuras → linha de "agora" não aparece
- [ ] Abrir dashboard sem alertas → badge não aparece, card DailyBriefing sem destaque vermelho
