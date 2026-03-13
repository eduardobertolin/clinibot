import { createClient } from "@/lib/supabase/server";
import { getAuthUser, getOwnerClinic } from "@/lib/supabase/cached";
import { redirect } from "next/navigation";
import ClinicConfigForm from "@/components/dashboard/config/ClinicConfigForm";
import ClinicHoursConfig from "@/components/dashboard/config/ClinicHoursConfig";
import DoctorsConfig from "@/components/dashboard/config/DoctorsConfig";
import ServicesConfig from "@/components/dashboard/config/ServicesConfig";
import InsurancePlansConfig from "@/components/dashboard/config/InsurancePlansConfig";
import WorkingHoursConfig from "@/components/dashboard/config/WorkingHoursConfig";
import ConfigTabs from "@/components/dashboard/config/ConfigTabs";

export default async function ConfigPage() {
  const user = await getAuthUser();
  if (!user) redirect("/auth/login");

  const clinicBase = await getOwnerClinic(user.id);
  if (!clinicBase) redirect("/dashboard/onboarding");

  const supabase = await createClient();

  // Fetch full clinic row (getOwnerClinic returns only id + name)
  const { data: clinics } = await supabase
    .from("clinics")
    .select("*")
    .eq("id", clinicBase.id)
    .limit(1);

  const clinic = clinics?.[0] ?? null;
  if (!clinic) redirect("/dashboard/onboarding");

  // Wave 1: fetch everything that doesn't depend on doctor IDs (4 queries in parallel)
  const [
    { data: doctors },
    { data: services },
    { data: insurancePlans },
    { data: clinicSchedules },
  ] = await Promise.all([
    supabase.from("doctors").select("*").eq("clinic_id", clinic.id).eq("active", true).order("name"),
    supabase
      .from("appointment_types")
      .select("*, appointment_type_insurance(insurance_plan_id, insurance_plans(id, name, code, active))")
      .eq("clinic_id", clinic.id)
      .order("name"),
    supabase.from("insurance_plans").select("*").eq("clinic_id", clinic.id).order("name"),
    supabase.from("schedules").select("*").eq("clinic_id", clinic.id).is("doctor_id", null).order("weekday"),
  ]);

  // Wave 2: doctor schedules need doctor IDs from wave 1 (no extra doctor fetch)
  const doctorIds = (doctors || []).map((d) => d.id);
  const { data: doctorSchedules } = doctorIds.length > 0
    ? await supabase.from("schedules").select("*").in("doctor_id", doctorIds).order("weekday")
    : { data: [] };

  // Reshape services to include insurance_plans array
  const servicesWithPlans = (services || []).map((svc) => ({
    ...svc,
    insurance_plans: (svc.appointment_type_insurance || [])
      .map((r: { insurance_plans: { id: string; name: string; code: string | null; active: boolean } | null }) => r.insurance_plans)
      .filter(Boolean),
  }));

  return (
    <>
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
        <p className="text-sm text-gray-500 mt-1">Gerencie os dados da clínica, médicos e horários</p>
      </div>

      <ConfigTabs
        clinicSection={
          <section>
            <h2 className="text-base font-semibold text-gray-800 mb-1">Dados da clínica</h2>
            <p className="text-sm text-gray-400 mb-4">Nome e contato exibidos para os pacientes.</p>
            <ClinicConfigForm clinic={clinic} />
          </section>
        }
        doctorsSection={
          <section>
            <h2 className="text-base font-semibold text-gray-800 mb-1">Médicos</h2>
            <p className="text-sm text-gray-400 mb-4">Cadastre os profissionais que atendem na clínica.</p>
            <DoctorsConfig clinicId={clinic.id} doctors={doctors || []} />
          </section>
        }
        servicesSection={
          <section>
            <h2 className="text-base font-semibold text-gray-800 mb-1">Tipos de consulta</h2>
            <p className="text-sm text-gray-400 mb-4">
              Serviços oferecidos com duração, preço e convênios aceitos. Clique em ▾ para editar detalhes.
            </p>
            <ServicesConfig
              clinicId={clinic.id}
              services={servicesWithPlans}
              insurancePlans={insurancePlans || []}
            />
          </section>
        }
        insuranceSection={
          <section>
            <h2 className="text-base font-semibold text-gray-800 mb-1">Convênios</h2>
            <p className="text-sm text-gray-400 mb-4">
              Planos de saúde aceitos pela clínica. Após cadastrar, associe aos tipos de consulta na aba Serviços.
            </p>
            <InsurancePlansConfig clinicId={clinic.id} plans={insurancePlans || []} />
          </section>
        }
        hoursSection={
          <section className="space-y-10">
            <div>
              <h2 className="text-base font-semibold text-gray-800 mb-1">Horários da clínica</h2>
              <ClinicHoursConfig clinicId={clinic.id} schedules={clinicSchedules ?? []} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-800 mb-1">Horários por médico</h2>
              <p className="text-sm text-gray-400 mb-4">Agenda individual de cada profissional.</p>
              <WorkingHoursConfig
                doctors={doctors || []}
                schedules={doctorSchedules ?? []}
                appointmentTypes={(services || []).map((s) => ({ id: s.id, name: s.name }))}
                insurancePlans={(insurancePlans || []).filter((p) => p.active).map((p) => ({ id: p.id, name: p.name }))}
              />
            </div>
          </section>
        }
      />
    </>
  );
}
