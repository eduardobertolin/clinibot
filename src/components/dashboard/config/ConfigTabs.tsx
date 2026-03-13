"use client";

import { useState, type ReactNode } from "react";
import { Building2, UserRound, Stethoscope, Clock, HeartHandshake } from "lucide-react";

const tabs = [
  { label: "Clínica", icon: Building2 },
  { label: "Médicos", icon: UserRound },
  { label: "Serviços", icon: Stethoscope },
  { label: "Convênios", icon: HeartHandshake },
  { label: "Horários", icon: Clock },
] as const;

interface ConfigTabsProps {
  clinicSection: ReactNode;
  doctorsSection: ReactNode;
  servicesSection: ReactNode;
  insuranceSection: ReactNode;
  hoursSection: ReactNode;
}

export default function ConfigTabs({
  clinicSection,
  doctorsSection,
  servicesSection,
  insuranceSection,
  hoursSection,
}: ConfigTabsProps) {
  const [active, setActive] = useState(0);

  const sections = [clinicSection, doctorsSection, servicesSection, insuranceSection, hoursSection];

  return (
    <>
      <div className="flex gap-6 border-b border-gray-200 px-8 pt-4">
        {tabs.map((tab, i) => {
          const Icon = tab.icon;
          const isActive = active === i;
          return (
            <button
              key={tab.label}
              onClick={() => setActive(i)}
              className={`flex items-center gap-2 pb-3 text-sm transition-colors ${
                isActive
                  ? "border-b-2 border-cyan-500 text-cyan-600 font-medium"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="p-8 max-w-3xl">
        {sections[active]}
      </div>
    </>
  );
}
