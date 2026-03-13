"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Doctor, Schedule, AppointmentType, InsurancePlan } from "@/lib/supabase/types";
import { Copy, Save, ChevronDown, ChevronUp } from "lucide-react";

const DAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

interface DayState {
  id: string | null;
  active: boolean;
  start_time: string;
  end_time: string;
  break_start: string;
  break_end: string;
}

const DEFAULT_DAY: DayState = {
  id: null,
  active: false,
  start_time: "08:00",
  end_time: "18:00",
  break_start: "12:00",
  break_end: "13:00",
};

interface TypeLimitRow {
  appointment_type_id: string;
  max_per_day: string; // empty = no limit
  allow_consecutive: boolean;
}

interface InsuranceLimitRow {
  insurance_plan_id: string;
  max_per_day: string; // empty = no limit
}

function buildWeek(schedules: Schedule[], doctorId: string): DayState[] {
  return Array.from({ length: 7 }, (_, i) => {
    const s = schedules.find((x) => x.doctor_id === doctorId && x.weekday === i);
    if (!s) return { ...DEFAULT_DAY };
    return {
      id: s.id,
      active: true,
      start_time: s.start_time.slice(0, 5),
      end_time: s.end_time.slice(0, 5),
      break_start: (s as any).break_start?.slice(0, 5) ?? "12:00",
      break_end: (s as any).break_end?.slice(0, 5) ?? "13:00",
    };
  });
}

interface Props {
  doctors: Doctor[];
  schedules: Schedule[];
  appointmentTypes: Pick<AppointmentType, "id" | "name">[];
  insurancePlans: Pick<InsurancePlan, "id" | "name">[];
}

export default function WorkingHoursConfig({ doctors, schedules, appointmentTypes, insurancePlans }: Props) {
  const router = useRouter();
  const [selectedDoctorId, setSelectedDoctorId] = useState(doctors[0]?.id ?? "");
  const [week, setWeek] = useState<DayState[]>(() =>
    doctors[0] ? buildWeek(schedules, doctors[0].id) : Array(7).fill({ ...DEFAULT_DAY })
  );
  const [saving, setSaving] = useState(false);

  // Limits section
  const [limitsExpanded, setLimitsExpanded] = useState(false);
  const [typeLimits, setTypeLimits] = useState<TypeLimitRow[]>([]);
  const [insuranceLimits, setInsuranceLimits] = useState<InsuranceLimitRow[]>([]);
  const [savingLimits, setSavingLimits] = useState(false);

  async function loadLimits(doctorId: string) {
    const supabase = createClient();
    const [{ data: tl }, { data: il }] = await Promise.all([
      supabase.from("doctor_type_limits").select("*").eq("doctor_id", doctorId),
      supabase.from("doctor_insurance_limits").select("*").eq("doctor_id", doctorId),
    ]);

    setTypeLimits(
      appointmentTypes.map((at) => {
        const existing = (tl || []).find((r: any) => r.appointment_type_id === at.id);
        return {
          appointment_type_id: at.id,
          max_per_day: existing ? String(existing.max_per_day) : "",
          allow_consecutive: existing ? existing.allow_consecutive : true,
        };
      })
    );

    setInsuranceLimits(
      insurancePlans.map((ip) => {
        const existing = (il || []).find((r: any) => r.insurance_plan_id === ip.id);
        return {
          insurance_plan_id: ip.id,
          max_per_day: existing ? String(existing.max_per_day) : "",
        };
      })
    );
  }

  useEffect(() => {
    if (selectedDoctorId && limitsExpanded) {
      loadLimits(selectedDoctorId);
    }
  }, [selectedDoctorId, limitsExpanded]);

  function handleDoctorChange(id: string) {
    setSelectedDoctorId(id);
    setWeek(buildWeek(schedules, id));
  }

  function updateDay(i: number, patch: Partial<DayState>) {
    setWeek((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }

  function copyWeekdays() {
    const mon = week[1];
    if (!mon.active) return;
    setWeek((prev) =>
      prev.map((d, i) =>
        i >= 2 && i <= 5
          ? { ...d, active: true, start_time: mon.start_time, end_time: mon.end_time, break_start: mon.break_start, break_end: mon.break_end }
          : d
      )
    );
  }

  async function handleSave() {
    if (!selectedDoctorId) return;
    setSaving(true);
    const supabase = createClient();

    // Run all day upserts/deletes in parallel instead of sequentially
    await Promise.all(
      week.map(async (day, i) => {
        if (day.active) {
          const payload = {
            doctor_id: selectedDoctorId,
            weekday: i,
            start_time: day.start_time,
            end_time: day.end_time,
            break_start: day.break_start || null,
            break_end: day.break_end || null,
          };
          if (day.id) {
            await supabase.from("schedules").update(payload).eq("id", day.id);
          } else {
            const { data } = await supabase.from("schedules").insert(payload).select("id").single();
            if (data) week[i].id = data.id;
          }
        } else if (day.id) {
          await supabase.from("schedules").delete().eq("id", day.id);
          week[i].id = null;
        }
      })
    );

    setSaving(false);
    router.refresh();
  }

  async function handleSaveLimits() {
    if (!selectedDoctorId) return;
    setSavingLimits(true);
    const supabase = createClient();

    // Run all upserts/deletes in parallel instead of sequentially
    await Promise.all([
      ...typeLimits.map(async (row) => {
        const val = parseInt(row.max_per_day, 10);
        if (row.max_per_day !== "" && val >= 1) {
          await supabase.from("doctor_type_limits").upsert({
            doctor_id: selectedDoctorId,
            appointment_type_id: row.appointment_type_id,
            max_per_day: val,
            allow_consecutive: row.allow_consecutive,
          });
        } else {
          await supabase.from("doctor_type_limits")
            .delete()
            .eq("doctor_id", selectedDoctorId)
            .eq("appointment_type_id", row.appointment_type_id);
        }
      }),
      ...insuranceLimits.map(async (row) => {
        const val = parseInt(row.max_per_day, 10);
        if (row.max_per_day !== "" && val >= 1) {
          await supabase.from("doctor_insurance_limits").upsert({
            doctor_id: selectedDoctorId,
            insurance_plan_id: row.insurance_plan_id,
            max_per_day: val,
          });
        } else {
          await supabase.from("doctor_insurance_limits")
            .delete()
            .eq("doctor_id", selectedDoctorId)
            .eq("insurance_plan_id", row.insurance_plan_id);
        }
      }),
    ]);

    setSavingLimits(false);
    router.refresh();
  }

  if (doctors.length === 0) {
    return <p className="text-sm text-gray-400">Adicione um médico primeiro para configurar horários.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Doctor selector */}
      {doctors.length > 1 && (
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-600 font-medium">Médico:</label>
          <select
            value={selectedDoctorId}
            onChange={(e) => handleDoctorChange(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Week grid */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[120px_1fr_1fr_1fr] bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200">
          <span>Dia</span>
          <span>Entrada / Saída</span>
          <span>Pausa</span>
          <span></span>
        </div>

        {week.map((day, i) => (
          <div
            key={i}
            className={`grid grid-cols-[120px_1fr_1fr_40px] items-center px-4 py-3 border-b border-gray-100 last:border-0 transition-colors ${
              day.active ? "bg-white" : "bg-gray-50"
            }`}
          >
            {/* Day toggle */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <button
                type="button"
                onClick={() => updateDay(i, { active: !day.active })}
                className={`relative w-9 h-5 rounded-full transition-colors ${
                  day.active ? "bg-cyan-500" : "bg-gray-200"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    day.active ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
              <span className={`text-sm font-medium ${day.active ? "text-gray-900" : "text-gray-400"}`}>
                {DAYS[i]}
              </span>
            </label>

            {/* Work hours */}
            {day.active ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="time"
                  value={day.start_time}
                  onChange={(e) => updateDay(i, { start_time: e.target.value })}
                  className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 w-28"
                />
                <span className="text-gray-400 text-xs">até</span>
                <input
                  type="time"
                  value={day.end_time}
                  onChange={(e) => updateDay(i, { end_time: e.target.value })}
                  className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 w-28"
                />
              </div>
            ) : (
              <span className="text-sm text-gray-300">—</span>
            )}

            {/* Break */}
            {day.active ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="time"
                  value={day.break_start}
                  onChange={(e) => updateDay(i, { break_start: e.target.value })}
                  className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 w-24"
                />
                <span className="text-gray-400 text-xs">-</span>
                <input
                  type="time"
                  value={day.break_end}
                  onChange={(e) => updateDay(i, { break_end: e.target.value })}
                  className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 w-24"
                />
              </div>
            ) : (
              <span className="text-sm text-gray-300">—</span>
            )}

            <div />
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={copyWeekdays}
          disabled={!week[1].active}
          title="Copia os horários de Segunda para Terça-Sexta"
          className="flex items-center gap-1.5 text-sm text-gray-600 border border-gray-300 px-3 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Copy className="w-3.5 h-3.5" />
          Repetir seg→sex
        </button>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors ml-auto"
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? "Salvando..." : "Salvar horários"}
        </button>
      </div>

      {/* ── Limites de agenda ── */}
      {(appointmentTypes.length > 0 || insurancePlans.length > 0) && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => {
              const next = !limitsExpanded;
              setLimitsExpanded(next);
              if (next && selectedDoctorId) loadLimits(selectedDoctorId);
            }}
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-medium text-gray-700"
          >
            Limites de agenda
            {limitsExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>

          {limitsExpanded && (
            <div className="p-4 space-y-5 bg-white">
              {/* Por tipo de atendimento */}
              {appointmentTypes.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Por tipo de atendimento
                  </p>
                  <div className="space-y-2">
                    {typeLimits.map((row, idx) => {
                      const apptType = appointmentTypes.find((at) => at.id === row.appointment_type_id);
                      return (
                        <div key={row.appointment_type_id} className="flex items-center gap-3">
                          <span className="flex-1 text-sm text-gray-700">{apptType?.name}</span>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="1"
                              value={row.max_per_day}
                              onChange={(e) =>
                                setTypeLimits((prev) =>
                                  prev.map((r, i) => i === idx ? { ...r, max_per_day: e.target.value } : r)
                                )
                              }
                              placeholder="Sem limite"
                              className="w-28 border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            />
                            <span className="text-xs text-gray-400">máx/dia</span>
                          </div>
                          <label className={`flex items-center gap-1.5 text-sm whitespace-nowrap ${row.max_per_day ? "text-gray-600" : "text-gray-300 cursor-not-allowed"}`}>
                            <input
                              type="checkbox"
                              checked={row.allow_consecutive}
                              disabled={!row.max_per_day}
                              onChange={(e) =>
                                setTypeLimits((prev) =>
                                  prev.map((r, i) => i === idx ? { ...r, allow_consecutive: e.target.checked } : r)
                                )
                              }
                              className="rounded border-gray-300 text-cyan-600 focus:ring-cyan-500 disabled:opacity-40"
                            />
                            Permite consecutivos
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Por convênio */}
              {insurancePlans.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Por convênio
                  </p>
                  <div className="space-y-2">
                    {insuranceLimits.map((row, idx) => {
                      const plan = insurancePlans.find((p) => p.id === row.insurance_plan_id);
                      return (
                        <div key={row.insurance_plan_id} className="flex items-center gap-3">
                          <span className="flex-1 text-sm text-gray-700">{plan?.name}</span>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="1"
                              value={row.max_per_day}
                              onChange={(e) =>
                                setInsuranceLimits((prev) =>
                                  prev.map((r, i) => i === idx ? { ...r, max_per_day: e.target.value } : r)
                                )
                              }
                              placeholder="Sem limite"
                              className="w-28 border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            />
                            <span className="text-xs text-gray-400">máx/dia</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveLimits}
                  disabled={savingLimits}
                  className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  <Save className="w-3.5 h-3.5" />
                  {savingLimits ? "Salvando..." : "Salvar limites"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
