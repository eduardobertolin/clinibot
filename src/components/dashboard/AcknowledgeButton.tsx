"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AcknowledgeButton({ alertId }: { alertId: string }) {
  const router = useRouter();

  async function handleAcknowledge() {
    const supabase = createClient();
    await supabase
      .from("escalation_logs")
      .update({ status: "acknowledged" })
      .eq("id", alertId);
    router.refresh();
  }

  return (
    <button
      onClick={handleAcknowledge}
      className="flex-shrink-0 text-xs font-medium text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg transition-colors self-start"
    >
      Reconhecer
    </button>
  );
}
