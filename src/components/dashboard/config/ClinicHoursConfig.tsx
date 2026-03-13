"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Schedule } from "@/lib/supabase/types";
import { Copy, Save } from "lucide-react";

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

function buildWeek(schedules: Schedule[]): DayState[] {
  return Array.from({ length: 7 }, (_, i) => {
    const s = schedules.find((x) => x.weekday === i);
    if (!s) return { ...DEFAULT_DAY };
    return {
      id: s.id,
      active: true,
      start_time: s.start_time.slice(0, 5),
      end_time: s.end_time.slice(0, 5),
      break_start: s.break_start?.slice(0, 5) ?? "12:00",
      break_end: s.break_end?.slice(0, 5) ?? "13:00",
    };
  });
}

export default function ClinicHoursConfig({
  clinicId,
  schedules,
}: {
  clinicId: string;
  schedules: Schedule[];
}) {
  const router = useRouter();
  const [week, setWeek] = useState<DayState[]>(() => buildWeek(schedules));
  const [saving, setSaving] = useState(false);

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
    setSaving(true);
    const supabase = createClient();
    const localWeek = [...week];

    for (let i = 0; i < 7; i++) {
      const day = localWeek[i];
      if (day.active) {
        const payload = {
          clinic_id: clinicId,
          doctor_id: null,
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
          if (data) localWeek[i] = { ...localWeek[i], id: data.id };
        }
      } else if (day.id) {
        await supabase.from("schedules").delete().eq("id", day.id);
        localWeek[i] = { ...localWeek[i], id: null };
      }
    }

    setWeek(localWeek);
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Define os dias e horários gerais de funcionamento da clínica. Usado pelo bot para informar pacientes.
      </p>

      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="grid grid-cols-[140px_1fr_1fr] bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200">
          <span>Dia</span>
          <span>Entrada / Saída</span>
          <span>Pausa</span>
        </div>

        {week.map((day, i) => (
          <div
            key={i}
            className={`grid grid-cols-[140px_1fr_1fr] items-center px-4 py-3 border-b border-gray-100 last:border-0 ${
              day.active ? "bg-white" : "bg-gray-50"
            }`}
          >
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <button
                type="button"
                onClick={() => updateDay(i, { active: !day.active })}
                className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${
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

            {day.active ? (
              <div className="flex items-center gap-1.5">
                <input type="time" value={day.start_time}
                  onChange={(e) => updateDay(i, { start_time: e.target.value })}
                  className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 w-28" />
                <span className="text-gray-400 text-xs">até</span>
                <input type="time" value={day.end_time}
                  onChange={(e) => updateDay(i, { end_time: e.target.value })}
                  className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 w-28" />
              </div>
            ) : (
              <span className="text-sm text-gray-300">—</span>
            )}

            {day.active ? (
              <div className="flex items-center gap-1.5">
                <input type="time" value={day.break_start}
                  onChange={(e) => updateDay(i, { break_start: e.target.value })}
                  className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 w-24" />
                <span className="text-gray-400 text-xs">-</span>
                <input type="time" value={day.break_end}
                  onChange={(e) => updateDay(i, { break_end: e.target.value })}
                  className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 w-24" />
              </div>
            ) : (
              <span className="text-sm text-gray-300">—</span>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button type="button" onClick={copyWeekdays} disabled={!week[1].active}
          title="Copia os horários de Segunda para Terça-Sexta"
          className="flex items-center gap-1.5 text-sm text-gray-600 border border-gray-300 px-3 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          <Copy className="w-3.5 h-3.5" />
          Repetir seg→sex
        </button>
        <button type="button" onClick={handleSave} disabled={saving}
          className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors ml-auto">
          <Save className="w-3.5 h-3.5" />
          {saving ? "Salvando..." : "Salvar horários"}
        </button>
      </div>
    </div>
  );
}
