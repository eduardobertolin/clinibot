import Link from "next/link";
import { Activity, MessageSquare, Phone, CalendarDays } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">
      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-gray-900 to-gray-800 text-white">
        <div className="max-w-6xl mx-auto px-6 py-24 flex flex-col items-center text-center gap-8">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="bg-cyan-500 p-2.5 rounded-xl">
              <Activity className="h-7 w-7 text-white" />
            </div>
            <span className="text-2xl font-bold tracking-tight">Clini-bot</span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-6xl font-extrabold leading-tight max-w-3xl">
            Sua clínica atendendo{" "}
            <span className="text-cyan-400">24 horas</span>
          </h1>

          <p className="text-lg md:text-xl text-gray-300 max-w-2xl leading-relaxed">
            Secretária virtual com inteligência artificial que atende seus
            pacientes pelo WhatsApp e telefone — agendando consultas, tirando
            dúvidas e escalando emergências, sem pausas.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 pt-2">
            <Link
              href="/auth/signup"
              className="bg-cyan-500 hover:bg-cyan-600 text-white font-semibold px-8 py-3.5 rounded-xl transition-colors text-lg"
            >
              Começar grátis
            </Link>
            <Link
              href="/auth/login"
              className="border border-gray-500 hover:border-gray-300 text-gray-200 hover:text-white font-semibold px-8 py-3.5 rounded-xl transition-colors text-lg"
            >
              Entrar
            </Link>
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────── */}
      <section className="bg-gray-50 px-6 py-20">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 text-center">
            Tudo que sua clínica precisa
          </h2>
          <p className="text-gray-500 text-center mt-3 text-lg max-w-xl mx-auto">
            Automatize o atendimento e nunca mais perca um paciente por falta de
            resposta.
          </p>

          <div className="grid md:grid-cols-3 gap-8 mt-14">
            {/* Card 1 */}
            <div className="bg-white border border-gray-200 rounded-xl p-8 flex flex-col items-start gap-4">
              <div className="bg-cyan-50 text-cyan-600 p-3 rounded-xl">
                <MessageSquare className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900">
                Atendimento via WhatsApp
              </h3>
              <p className="text-gray-500 leading-relaxed">
                Responde mensagens instantaneamente, tira dúvidas sobre
                serviços, confirma e reagenda consultas — tudo pelo WhatsApp da
                clínica.
              </p>
            </div>

            {/* Card 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-8 flex flex-col items-start gap-4">
              <div className="bg-cyan-50 text-cyan-600 p-3 rounded-xl">
                <Phone className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900">
                Chamadas telefônicas
              </h3>
              <p className="text-gray-500 leading-relaxed">
                Atende ligações com voz natural em português, entende o
                paciente por reconhecimento de fala e agenda ou encaminha a
                chamada.
              </p>
            </div>

            {/* Card 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-8 flex flex-col items-start gap-4">
              <div className="bg-cyan-50 text-cyan-600 p-3 rounded-xl">
                <CalendarDays className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900">
                Agenda inteligente
              </h3>
              <p className="text-gray-500 leading-relaxed">
                Verifica disponibilidade em tempo real, evita conflitos de
                horário e envia lembretes automáticos para reduzir faltas.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────── */}
      <section className="bg-white px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 text-center">
            Como funciona
          </h2>
          <p className="text-gray-500 text-center mt-3 text-lg">
            Três passos para liberar sua recepção.
          </p>

          <div className="mt-14 flex flex-col gap-10">
            {/* Step 1 */}
            <div className="flex items-start gap-6">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-cyan-500 text-white flex items-center justify-center text-xl font-bold">
                1
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900">
                  Cadastre sua clínica
                </h3>
                <p className="text-gray-500 mt-1 leading-relaxed">
                  Crie sua conta gratuitamente e insira as informações básicas
                  da clínica — nome, endereço e telefone.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex items-start gap-6">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-cyan-500 text-white flex items-center justify-center text-xl font-bold">
                2
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900">
                  Configure médicos e horários
                </h3>
                <p className="text-gray-500 mt-1 leading-relaxed">
                  Adicione seus profissionais, serviços oferecidos e os
                  horários de atendimento de cada um.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex items-start gap-6">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-cyan-500 text-white flex items-center justify-center text-xl font-bold">
                3
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900">
                  Ative o atendimento automático
                </h3>
                <p className="text-gray-500 mt-1 leading-relaxed">
                  Conecte seu WhatsApp e número de telefone. A IA começa a
                  atender pacientes imediatamente, 24 horas por dia.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA Banner ─────────────────────────────────────────── */}
      <section className="bg-gray-900 px-6 py-20">
        <div className="max-w-3xl mx-auto text-center flex flex-col items-center gap-6">
          <h2 className="text-3xl md:text-4xl font-bold text-white">
            Pronto para automatizar seu atendimento?
          </h2>
          <p className="text-gray-400 text-lg max-w-xl">
            Comece agora e veja sua clínica funcionar mesmo fora do horário
            comercial.
          </p>
          <Link
            href="/auth/signup"
            className="bg-cyan-500 hover:bg-cyan-600 text-white font-semibold px-8 py-3.5 rounded-xl transition-colors text-lg"
          >
            Começar grátis
          </Link>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="bg-gray-950 px-6 py-10">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="bg-cyan-500 p-1.5 rounded-lg">
              <Activity className="h-4 w-4 text-white" />
            </div>
            <span className="text-white font-semibold">Clini-bot</span>
          </div>
          <p className="text-gray-500 text-sm">
            &copy; {new Date().getFullYear()} Clini-bot. Todos os direitos
            reservados.
          </p>
        </div>
      </footer>
    </main>
  );
}
