import { createClient } from "@/lib/supabase/server";
import { getAuthUser, getOwnerClinic } from "@/lib/supabase/cached";
import { redirect } from "next/navigation";
import { startOfWeek, addDays, parseISO, isToday } from "date-fns";
import WeeklyCalendar from "@/components/dashboard/WeeklyCalendar";
import type { CalendarAppointment } from "@/lib/supabase/types";
import { CalendarDays, CheckCircle2, Clock, Users, TrendingUp } from "lucide-react";
import DailyBriefing from "@/components/dashboard/DailyBriefing";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;

  // Both served from React cache — no extra round-trips vs layout
  const user = await getAuthUser();
  if (!user) redirect("/auth/login");

  const clinic = await getOwnerClinic(user.id);
  if (!clinic) redirect("/dashboard/onboarding");

  const supabase = await createClient();

  const baseDate = week ? parseISO(week) : new Date();
  const weekStart = startOfWeek(baseDate, { weekStartsOn: 1 });
  const weekEnd = addDays(weekStart, 7);

  // All 5 queries in parallel — escalation count now included (no sequential step)
  const [
    { data: doctors },
    { data: appointmentTypes },
    { data: appointments },
    { count: openAlerts },
    { count: openConversations },
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
    // Direct filter by clinic_id — requires orchestrator to insert clinic_id in escalation_logs
    supabase
      .from("escalation_logs")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinic.id)
      .eq("status", "open"),
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinic.id)
      .eq("status", "escalated"),
  ]);

  const confirmed = appointments?.filter((a) => a.status === "confirmed").length ?? 0;
  const scheduled = appointments?.filter((a) => a.status === "scheduled").length ?? 0;
  const completed = appointments?.filter((a) => a.status === "completed").length ?? 0;
  const total = appointments?.length ?? 0;
  const alertCount = openAlerts ?? 0;
  const todayAppointments = (appointments ?? []).filter((a) =>
    isToday(parseISO(a.start_datetime))
  ) as unknown as CalendarAppointment[];

  const stats = [
    {
      label: "Consultas esta semana",
      value: total,
      icon: CalendarDays,
      color: "text-cyan-600",
      bg: "bg-cyan-50",
      extra: null as string | null,
    },
    {
      label: "Confirmadas",
      value: confirmed,
      icon: CheckCircle2,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      extra: total > 0 ? `${Math.round((confirmed / total) * 100)}%` : null,
    },
    {
      label: "Agendadas",
      value: scheduled,
      icon: Clock,
      color: "text-amber-600",
      bg: "bg-amber-50",
      extra: null,
    },
    {
      label: "Atendidos",
      value: completed,
      icon: Users,
      color: "text-violet-600",
      bg: "bg-violet-50",
      extra: null,
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agenda</h1>
          <p className="text-sm text-gray-500 mt-1">Gerencie os agendamentos da semana</p>
        </div>
        {alertCount > 0 && (
          <a
            href="/dashboard/alerts"
            className="flex items-center gap-2 bg-red-50 text-red-700 border border-red-200 text-sm font-medium px-4 py-2 rounded-lg hover:bg-red-100 transition-colors"
          >
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            {alertCount} alerta{alertCount > 1 ? "s" : ""} aberto{alertCount > 1 ? "s" : ""}
          </a>
        )}
      </div>

      <div className="p-8 space-y-6">
        {/* Resumo do dia */}
        <DailyBriefing
          todayAppointments={todayAppointments}
          openAlerts={alertCount}
          openConversations={openConversations ?? 0}
        />

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{s.label}</p>
                    <div className="flex items-baseline gap-2 mt-2">
                      <p className="text-3xl font-bold text-gray-900">{s.value}</p>
                      {s.extra && (
                        <span className="flex items-center gap-0.5 text-xs font-medium text-emerald-600">
                          <TrendingUp className="w-3 h-3" />
                          {s.extra}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className={`${s.bg} p-2.5 rounded-lg`}>
                    <Icon className={`w-5 h-5 ${s.color}`} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <WeeklyCalendar
          appointments={(appointments ?? []) as unknown as CalendarAppointment[]}
          weekStartISO={weekStart.toISOString()}
          clinicId={clinic.id}
          doctors={doctors ?? []}
          appointmentTypes={appointmentTypes ?? []}
        />
      </div>
    </div>
  );
}
