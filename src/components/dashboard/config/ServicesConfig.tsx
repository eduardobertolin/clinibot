"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AppointmentType, InsurancePlan } from "@/lib/supabase/types";
import { Trash2, Plus, ChevronDown, ChevronUp } from "lucide-react";

function ServiceItem({
  svc,
  allPlans,
  onRemove,
}: {
  svc: AppointmentType;
  allPlans: InsurancePlan[];
  onRemove: (id: string) => void;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [price, setPrice] = useState(svc.price?.toString() ?? "");
  const [particular, setParticular] = useState(svc.particular ?? true);
  const [maxPerDay, setMaxPerDay] = useState(svc.max_per_day?.toString() ?? "");
  const [selectedPlans, setSelectedPlans] = useState<string[]>(
    svc.insurance_plans?.map((p) => p.id) ?? []
  );
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();

    await supabase
      .from("appointment_types")
      .update({
        price: price !== "" ? parseFloat(price) : null,
        particular,
        max_per_day: maxPerDay !== "" ? parseInt(maxPerDay) : null,
      })
      .eq("id", svc.id);

    // Sync insurance junction: delete all then re-insert
    await supabase.from("appointment_type_insurance").delete().eq("appointment_type_id", svc.id);
    if (selectedPlans.length > 0) {
      await supabase.from("appointment_type_insurance").insert(
        selectedPlans.map((planId) => ({
          appointment_type_id: svc.id,
          insurance_plan_id: planId,
        }))
      );
    }

    setSaving(false);
    setExpanded(false);
    router.refresh();
  }

  function togglePlan(planId: string) {
    setSelectedPlans((prev) =>
      prev.includes(planId) ? prev.filter((id) => id !== planId) : [...prev, planId]
    );
  }

  const insuranceNames = (svc.insurance_plans || []).map((p) => p.name).join(", ");

  return (
    <div className="border-b border-gray-100 last:border-0 bg-white">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-900">{svc.name}</p>
          <p className="text-xs text-gray-400">
            {svc.duration_minutes} min
            {svc.price != null ? ` · R$ ${svc.price.toFixed(2)}` : ""}
            {insuranceNames ? ` · ${insuranceNames}` : ""}
          </p>
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-gray-400 hover:text-cyan-600 transition-colors"
          title="Editar detalhes"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        <button onClick={() => onRemove(svc.id)} className="text-gray-300 hover:text-red-500 transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 bg-gray-50">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Preço particular (R$)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Limite diário (opcional)</label>
              <input
                type="number"
                min="1"
                value={maxPerDay}
                onChange={(e) => setMaxPerDay(e.target.value)}
                placeholder="Sem limite"
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id={`particular-${svc.id}`}
              checked={particular}
              onChange={(e) => setParticular(e.target.checked)}
              className="rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
            />
            <label htmlFor={`particular-${svc.id}`} className="text-sm text-gray-700">
              Aceita pagamento particular
            </label>
          </div>

          {allPlans.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-1.5">Convênios aceitos</p>
              <div className="flex flex-wrap gap-2">
                {allPlans.map((plan) => (
                  <label
                    key={plan.id}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs cursor-pointer transition-colors ${
                      selectedPlans.includes(plan.id)
                        ? "bg-cyan-50 border-cyan-400 text-cyan-700"
                        : "border-gray-300 text-gray-500 hover:border-gray-400"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={selectedPlans.includes(plan.id)}
                      onChange={() => togglePlan(plan.id)}
                    />
                    {plan.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ServicesConfig({
  clinicId,
  services,
  insurancePlans,
}: {
  clinicId: string;
  services: AppointmentType[];
  insurancePlans: InsurancePlan[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [duration, setDuration] = useState("30");
  const [adding, setAdding] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setAdding(true);
    const supabase = createClient();
    await supabase.from("appointment_types").insert({
      clinic_id: clinicId,
      name: name.trim(),
      duration_minutes: parseInt(duration) || 30,
      particular: true,
      insurance_allowed: false,
    });
    setName("");
    setDuration("30");
    setAdding(false);
    router.refresh();
  }

  async function handleRemove(id: string) {
    const supabase = createClient();
    await supabase.from("appointment_types").delete().eq("id", id);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        {services.length === 0 ? (
          <p className="p-4 text-sm text-gray-400">Nenhum tipo de consulta cadastrado.</p>
        ) : (
          services.map((svc) => (
            <ServiceItem
              key={svc.id}
              svc={svc}
              allPlans={insurancePlans}
              onRemove={handleRemove}
            />
          ))
        )}
      </div>

      <form onSubmit={handleAdd} className="flex gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Consulta geral, Retorno..."
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
        />
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="10"
            max="240"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
          <span className="text-sm text-gray-500">min</span>
        </div>
        <button
          type="submit"
          disabled={adding || !name.trim()}
          className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Adicionar
        </button>
      </form>
    </div>
  );
}
