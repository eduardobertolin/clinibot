"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Activity, Mail } from "lucide-react";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();

    // Store clinic data in user metadata — used to create the clinic record
    // after the user confirms their e-mail and first logs in.
    const { data, error: signupError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { clinic_name: clinicName, clinic_phone: phone },
      },
    });

    if (signupError || !data.user) {
      setError(signupError?.message || "Erro ao criar conta. Tente novamente.");
      setLoading(false);
      return;
    }

    // If e-mail confirmation is disabled in Supabase, a session is returned
    // immediately — create the clinic and go straight to the dashboard.
    if (data.session) {
      await supabase.from("clinics").insert({
        name: clinicName,
        phone,
        owner_id: data.user.id,
      });
      window.location.href = "/dashboard/onboarding";
      return;
    }

    // Confirmation e-mail sent — show friendly waiting screen.
    setAwaitingConfirmation(true);
    setLoading(false);
  }

  if (awaitingConfirmation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-cyan-50/30 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-lg border border-gray-200 p-8 text-center space-y-5">
          <div className="w-16 h-16 bg-cyan-50 rounded-full flex items-center justify-center mx-auto">
            <Mail className="w-8 h-8 text-cyan-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Quase lá! Confirme seu e-mail</h2>
            <p className="text-sm text-gray-500 mt-2 leading-relaxed">
              Enviamos um link de confirmação para{" "}
              <span className="font-semibold text-gray-700">{email}</span>.
              <br /><br />
              Abra o e-mail e clique em <span className="font-medium">"Confirm your signup"</span> para
              ativar sua conta e acessar o painel da clínica.
            </p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            <p className="text-xs text-amber-700">
              Não recebeu o e-mail? Verifique a caixa de spam ou lixo eletrônico.
            </p>
          </div>
          <p className="text-xs text-gray-400">
            Após confirmar, você pode{" "}
            <Link href="/auth/login" className="text-cyan-600 hover:underline">
              entrar aqui
            </Link>
            .
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-cyan-50/30 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg border border-gray-200 p-8 space-y-6">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 bg-cyan-500 rounded-xl flex items-center justify-center mb-3">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <p className="text-lg font-bold text-gray-900 mb-4">Clini-bot</p>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cadastrar clínica</h1>
          <p className="text-sm text-gray-500 mt-1">Crie sua conta e configure o bot em minutos</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome da clínica</label>
            <input
              type="text"
              required
              value={clinicName}
              onChange={(e) => setClinicName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder="Clínica Dr. Silva"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telefone / WhatsApp da clínica</label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder="5511999999999"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder="Mínimo 8 caracteres"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors"
          >
            {loading ? "Criando conta..." : "Criar conta"}
          </button>
        </form>

        <p className="text-sm text-center text-gray-500">
          Já tem conta?{" "}
          <Link href="/auth/login" className="text-cyan-600 hover:underline font-medium">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
