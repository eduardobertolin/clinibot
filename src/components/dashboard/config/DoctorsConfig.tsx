"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Doctor } from "@/lib/supabase/types";
import { Trash2, Plus } from "lucide-react";

export default function DoctorsConfig({ clinicId, doctors }: { clinicId: string; doctors: Doctor[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [adding, setAdding] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setAdding(true);
    const supabase = createClient();
    await supabase.from("doctors").insert({
      clinic_id: clinicId,
      name: name.trim(),
      specialization: specialization.trim() || null,
      active: true,
    });
    setName("");
    setSpecialization("");
    setAdding(false);
    router.refresh();
  }

  async function handleRemove(id: string) {
    const supabase = createClient();
    await supabase.from("doctors").update({ active: false }).eq("id", id);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
        {doctors.length === 0 ? (
          <p className="p-4 text-sm text-gray-400">Nenhum médico cadastrado.</p>
        ) : (
          doctors.map((doc) => (
            <div key={doc.id} className="flex items-center gap-3 px-4 py-3 bg-white">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{doc.name}</p>
                {doc.specialization && <p className="text-xs text-gray-400">{doc.specialization}</p>}
              </div>
              <button onClick={() => handleRemove(doc.id)} className="text-gray-300 hover:text-red-500 transition-colors">
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
          placeholder="Nome do médico"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
        />
        <input
          value={specialization}
          onChange={(e) => setSpecialization(e.target.value)}
          placeholder="Especialização (opcional)"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
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
