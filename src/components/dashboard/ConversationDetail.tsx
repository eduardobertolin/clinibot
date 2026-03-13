import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { User } from "lucide-react";
import { ConversationMessage, Conversation } from "@/lib/supabase/types";

export default function ConversationDetail({ conversation: conv }: { conversation: Conversation }) {
  const messages = (conv.messages as unknown as ConversationMessage[]) || [];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-cyan-100 flex items-center justify-center">
          <User className="w-4 h-4 text-cyan-600" />
        </div>
        <div>
        <p className="font-semibold text-gray-900">{conv.patient_name || conv.patient_phone}</p>
        <p className="text-sm text-gray-400">
          {conv.channel === "whatsapp" ? "WhatsApp" : "Telefone"} ·{" "}
          {conv.patient_phone} ·{" "}
          <span
            className={`font-medium ${
              conv.status === "escalated"
                ? "text-red-600"
                : conv.status === "active"
                ? "text-green-600"
                : "text-gray-400"
            }`}
          >
            {conv.status === "escalated" ? "Escalado" : conv.status === "active" ? "Ativo" : "Resolvido"}
          </span>
        </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-gray-50">
        {messages.length === 0 ? (
          <p className="text-sm text-gray-400 text-center">Nenhuma mensagem</p>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-start" : "justify-end"}`}
            >
              <div
                className={`max-w-sm px-4 py-2.5 rounded-2xl text-sm ${
                  msg.role === "user"
                    ? "bg-white border border-gray-200 text-gray-800 rounded-tl-sm"
                    : "bg-cyan-600 text-white rounded-tr-sm"
                }`}
              >
                <p>{msg.content}</p>
                <p
                  className={`text-xs mt-1 ${
                    msg.role === "user" ? "text-gray-400" : "text-cyan-200"
                  }`}
                >
                  {format(parseISO(msg.timestamp), "HH:mm", { locale: ptBR })}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
