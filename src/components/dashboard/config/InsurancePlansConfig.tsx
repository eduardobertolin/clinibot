"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { InsurancePlan } from "@/lib/supabase/types";
import { Trash2, Plus, ToggleLeft, ToggleRight } from "lucide-react";

export default function InsurancePlansConfig({
  clinicId,
  plans,
}: {
  clinicId: string;
  plans: InsurancePlan[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [adding, setAdding] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setAdding(true);
    const supabase = createClient();
    await supabase.from("insurance_plans").insert({
      clinic_id: clinicId,
      name: name.trim(),
      code: code.trim() || null,
      active: true,
    });
    setName("");
    setCode("");
    setAdding(false);
    router.refresh();
  }

  async function handleToggle(plan: InsurancePlan) {
    const supabase = createClient();
    await supabase
      .from("insurance_plans")
      .update({ active: !plan.active })
      .eq("id", plan.id);
    router.refresh();
  }

  async function handleRemove(id: string) {
    const supabase = createClient();
    await supabase.from("insurance_plans").delete().eq("id", id);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
        {plans.length === 0 ? (
          <p className="p-4 text-sm text-gray-400">Nenhum convênio cadastrado.</p>
        ) : (
          plans.map((plan) => (
            <div key={plan.id} className="flex items-center gap-3 px-4 py-3 bg-white">
              <div className="flex-1">
                <p className={`text-sm font-medium ${plan.active ? "text-gray-900" : "text-gray-400"}`}>
                  {plan.name}
                </p>
                {plan.code && (
                  <p className="text-xs text-gray-400">Código ANS: {plan.code}</p>
                )}
              </div>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  plan.active
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                {plan.active ? "Ativo" : "Inativo"}
              </span>
              <button
                onClick={() => handleToggle(plan)}
                title={plan.active ? "Desativar" : "Ativar"}
                className="text-gray-300 hover:text-cyan-500 transition-colors"
              >
                {plan.active ? (
                  <ToggleRight className="w-5 h-5 text-cyan-500" />
                ) : (
                  <ToggleLeft className="w-5 h-5" />
                )}
              </button>
              <button
                onClick={() => handleRemove(plan.id)}
                className="text-gray-300 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleAdd} className="flex gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome do convênio (ex: Unimed, Bradesco Saúde)"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
        />
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Código ANS (opcional)"
          className="w-36 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
        />
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
