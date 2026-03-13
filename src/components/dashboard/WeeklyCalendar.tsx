"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  format,
  addDays,
  isToday,
  isSameDay,
  parseISO,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, MessageSquare, Phone, Monitor, Plus } from "lucide-react";
import type { CalendarAppointment } from "@/lib/supabase/types";
import NewAppointmentModal from "./NewAppointmentModal";
import AppointmentDetailModal from "./AppointmentDetailModal";

const HOUR_HEIGHT = 64; // px per hour
const START_HOUR = 7;
const END_HOUR = 20;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);

const STATUS_STYLE: Record<string, string> = {
  scheduled: "bg-blue-100 border-blue-400 text-blue-900",
  confirmed:  "bg-green-100 border-green-400 text-green-900",
  cancelled:  "bg-red-100 border-red-300 text-red-700 opacity-60",
  completed:  "bg-gray-100 border-gray-300 text-gray-700",
  no_show:    "bg-orange-100 border-orange-300 text-orange-800",
};

function calcNowTop(): number | null {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  if (h < START_HOUR || h >= END_HOUR) return null;
  return ((h - START_HOUR) * 60 + m) / 60 * HOUR_HEIGHT;
}

interface Doctor { id: string; name: string; }
interface AppointmentType { id: string; name: string; duration_minutes: number; }

interface Props {
  appointments: CalendarAppointment[];
  weekStartISO: string;
  clinicId: string;
  doctors: Doctor[];
  appointmentTypes: AppointmentType[];
}

export default function WeeklyCalendar({
  appointments,
  weekStartISO,
  clinicId,
  doctors,
  appointmentTypes,
}: Props) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const weekStart = parseISO(weekStartISO);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const [newApptOpen, setNewApptOpen] = useState(false);
  const [newApptDate, setNewApptDate] = useState<Date | undefined>();
  const [selectedAppt, setSelectedAppt] = useState<CalendarAppointment | null>(null);

  // Indicador de horário atual
  const [nowTop, setNowTop] = useState<number | null>(null);

  useEffect(() => {
    setNowTop(calcNowTop());
    const interval = setInterval(() => setNowTop(calcNowTop()), 60_000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll to current time on mount
  useEffect(() => {
    if (scrollRef.current) {
      const now = new Date();
      const scrollTo = ((now.getHours() - START_HOUR) * HOUR_HEIGHT) - 80;
      scrollRef.current.scrollTop = Math.max(0, scrollTo);
    }
  }, []);

  function navigate(direction: "prev" | "next") {
    const newWeekStart = addDays(weekStart, direction === "prev" ? -7 : 7);
    router.push(`/dashboard?week=${format(newWeekStart, "yyyy-MM-dd")}`);
  }

  function openNewAppt(day?: Date) {
    setNewApptDate(day);
    setNewApptOpen(true);
  }

  function getPos(appt: CalendarAppointment) {
    const start = parseISO(appt.start_datetime);
    const offsetMins = (start.getHours() - START_HOUR) * 60 + start.getMinutes();
    const top = Math.max(0, (offsetMins / 60) * HOUR_HEIGHT);

    let dur = 30;
    if (appt.end_datetime) {
      const end = parseISO(appt.end_datetime);
      dur = (end.getTime() - start.getTime()) / 60000;
    } else if (appt.appointment_types?.duration_minutes) {
      dur = appt.appointment_types.duration_minutes;
    }

    return { top, height: Math.max(24, (dur / 60) * HOUR_HEIGHT) };
  }

  function SourceIcon({ source }: { source: string }) {
    if (source === "whatsapp") return <MessageSquare className="w-3 h-3 opacity-60" />;
    if (source === "phone") return <Phone className="w-3 h-3 opacity-60" />;
    return <Monitor className="w-3 h-3 opacity-60" />;
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Navigation */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <button
            onClick={() => navigate("prev")}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <p className="text-sm font-medium text-gray-700">
            {format(weekStart, "d 'de' MMMM", { locale: ptBR })} —{" "}
            {format(addDays(weekStart, 6), "d 'de' MMMM", { locale: ptBR })}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("next")}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
            <button
              onClick={() => openNewAppt()}
              className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Nova consulta
            </button>
          </div>
        </div>

        {/* Day headers */}
        <div className="flex border-b border-gray-200">
          <div className="w-14 flex-shrink-0" />
          {days.map((day) => (
            <div
              key={day.toISOString()}
              className={`flex-1 text-center py-2.5 border-l border-gray-100 ${
                isToday(day) ? "bg-cyan-50" : ""
              }`}
            >
              <p className="text-xs text-gray-400 uppercase font-medium tracking-wide">
                {format(day, "EEE", { locale: ptBR })}
              </p>
              <button
                onClick={() => openNewAppt(day)}
                className={`text-base font-bold mt-0.5 w-8 h-8 flex items-center justify-center mx-auto rounded-full transition-colors hover:bg-cyan-100 ${
                  isToday(day) ? "bg-cyan-600 text-white hover:bg-cyan-700" : "text-gray-800"
                }`}
                title={`Nova consulta em ${format(day, "dd/MM")}`}
              >
                {format(day, "d")}
              </button>
            </div>
          ))}
        </div>

        {/* Scrollable grid */}
        <div ref={scrollRef} className="overflow-y-auto" style={{ maxHeight: "580px" }}>
          <div className="flex" style={{ height: `${(END_HOUR - START_HOUR) * HOUR_HEIGHT}px` }}>
            {/* Time labels */}
            <div className="w-14 flex-shrink-0 relative select-none">
              {HOURS.slice(0, -1).map((h) => (
                <div
                  key={h}
                  className="absolute right-2 text-xs text-gray-400"
                  style={{ top: `${(h - START_HOUR) * HOUR_HEIGHT - 9}px` }}
                >
                  {String(h).padStart(2, "0")}:00
                </div>
              ))}
            </div>

            {/* Day columns */}
            {days.map((day) => {
              const dayAppts = appointments.filter((a) =>
                isSameDay(parseISO(a.start_datetime), day)
              );

              return (
                <div
                  key={day.toISOString()}
                  className={`flex-1 relative border-l border-gray-100 ${
                    isToday(day) ? "bg-cyan-50/20" : ""
                  }`}
                >
                  {/* Hour lines */}
                  {HOURS.slice(0, -1).map((h) => (
                    <div
                      key={h}
                      className="absolute inset-x-0 border-t border-gray-100"
                      style={{ top: `${(h - START_HOUR) * HOUR_HEIGHT}px` }}
                    />
                  ))}

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

                  {/* Appointments */}
                  {dayAppts.map((appt) => {
                    const { top, height } = getPos(appt);
                    const style = STATUS_STYLE[appt.status] ?? STATUS_STYLE.scheduled;

                    return (
                      <div
                        key={appt.id}
                        onClick={() => setSelectedAppt(appt)}
                        className={`absolute left-0.5 right-0.5 border-l-2 rounded-r-md px-1.5 py-0.5 overflow-hidden cursor-pointer hover:brightness-95 transition-all ${style}`}
                        style={{ top: `${top + 1}px`, height: `${height - 1}px` }}
                      >
                        <div className="flex items-start gap-1">
                          <p className="text-xs font-semibold leading-tight truncate flex-1">
                            {appt.patient_name}
                          </p>
                          <SourceIcon source={appt.source} />
                        </div>
                        {height > 38 && (
                          <p className="text-xs opacity-75 leading-tight truncate">
                            {appt.appointment_types?.name || "Consulta"}
                          </p>
                        )}
                        {height > 54 && appt.doctors?.name && (
                          <p className="text-xs opacity-60 leading-tight truncate">
                            {appt.doctors.name}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modals */}
      {newApptOpen && (
        <NewAppointmentModal
          clinicId={clinicId}
          doctors={doctors}
          appointmentTypes={appointmentTypes}
          defaultDate={newApptDate}
          onClose={() => setNewApptOpen(false)}
        />
      )}
      {selectedAppt && (
        <AppointmentDetailModal
          appointment={selectedAppt}
          onClose={() => setSelectedAppt(null)}
        />
      )}
    </>
  );
}
