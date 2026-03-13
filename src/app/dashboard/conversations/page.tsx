import { createClient } from "@/lib/supabase/server";
import { getAuthUser, getOwnerClinic } from "@/lib/supabase/cached";
import { redirect } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageSquare, Phone } from "lucide-react";
import { ConversationMessage } from "@/lib/supabase/types";
import ConversationDetail from "@/components/dashboard/ConversationDetail";

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const params = await searchParams;

  const user = await getAuthUser();
  if (!user) redirect("/auth/login");

  const clinic = await getOwnerClinic(user.id);
  if (!clinic) redirect("/dashboard/onboarding");

  const supabase = await createClient();

  const { data: conversations } = await supabase
    .from("conversations")
    .select("*")
    .eq("clinic_id", clinic.id)
    .order("updated_at", { ascending: false })
    .limit(50);

  const selected = params.id
    ? conversations?.find((c) => c.id === params.id)
    : conversations?.[0];

  const totalOpen = (conversations || []).filter((c) => c.status !== "resolved").length;
  const escalated = (conversations || []).filter((c) => c.status === "escalated").length;
  const resolved = (conversations || []).filter((c) => c.status === "resolved").length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-6 flex-shrink-0">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Conversas</h1>
            <p className="text-sm text-gray-500 mt-1">Interações da secretária virtual com pacientes</p>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{totalOpen}</p>
              <p className="text-xs text-gray-500">Em aberto</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">{escalated}</p>
              <p className="text-xs text-gray-500">Escaladas</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{resolved}</p>
              <p className="text-xs text-gray-500">Resolvidas</p>
            </div>
          </div>
        </div>
      </div>

      {/* Split pane */}
      <div className="flex flex-1 min-h-0">
        {/* List */}
        <div className="w-72 border-r border-gray-200 bg-white flex flex-col flex-shrink-0">
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {!conversations || conversations.length === 0 ? (
              <p className="p-5 text-sm text-gray-400">Nenhuma conversa ainda.</p>
            ) : (
              conversations.map((conv) => {
                const messages = (conv.messages as ConversationMessage[]) || [];
                const last = messages[messages.length - 1];
                const isSelected = selected?.id === conv.id;
                return (
                  <a
                    key={conv.id}
                    href={`/dashboard/conversations?id=${conv.id}`}
                    className={`block px-4 py-3.5 hover:bg-gray-50 transition-colors ${
                      isSelected ? "bg-gray-100 border-l-2 border-l-cyan-500" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        conv.channel === "whatsapp" ? "bg-green-100" : "bg-cyan-100"
                      }`}>
                        {conv.channel === "whatsapp" ? (
                          <MessageSquare className="w-3.5 h-3.5 text-green-600" />
                        ) : (
                          <Phone className="w-3.5 h-3.5 text-cyan-600" />
                        )}
                      </div>
                      <p className="text-sm font-semibold text-gray-900 truncate flex-1">
                        {conv.patient_name || conv.patient_phone}
                      </p>
                      {conv.status === "escalated" && (
                        <span className="flex-shrink-0 w-2 h-2 bg-red-500 rounded-full" />
                      )}
                    </div>
                    {last && (
                      <p className="text-xs text-gray-400 truncate mt-1 pl-10">{last.content}</p>
                    )}
                    <p className="text-xs text-gray-300 pl-10 mt-0.5">
                      {format(parseISO(conv.updated_at), "d MMM, HH:mm", { locale: ptBR })}
                    </p>
                  </a>
                );
              })
            )}
          </div>
        </div>

        {/* Detail */}
        <div className="flex-1 overflow-y-auto">
          {selected ? (
            <ConversationDetail conversation={selected} />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400">
              <div className="text-center">
                <MessageSquare className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm">Selecione uma conversa</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
