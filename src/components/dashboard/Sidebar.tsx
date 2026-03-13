"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  CalendarDays,
  MessageSquare,
  Settings,
  Bell,
  LogOut,
  Activity,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Agenda", icon: CalendarDays },
  { href: "/dashboard/conversations", label: "Conversas", icon: MessageSquare },
  { href: "/dashboard/alerts", label: "Alertas", icon: Bell },
  { href: "/dashboard/config", label: "Configurações", icon: Settings },
];

export default function Sidebar({ clinicName, alertCount = 0 }: { clinicName: string; alertCount?: number }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  }

  return (
    <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
      {/* Logo / Clinic name */}
      <div className="p-6 border-b border-gray-100">
        <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="w-10 h-10 bg-cyan-500 rounded-xl flex items-center justify-center">
            <Activity className="w-6 h-6 text-white" strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900">Clini-bot</p>
            <p className="text-xs text-gray-400 truncate">{clinicName}</p>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <div className="flex-1 p-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-3">
          Menu
        </p>
        <nav>
          <ul className="space-y-1">
            {navItems.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
              const isAlerts = href === "/dashboard/alerts";
              return (
                <li key={href}>
                  <Link
                    href={href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm ${
                      active
                        ? "bg-gray-100 text-gray-900 font-medium"
                        : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                    }`}
                  >
                    <Icon className="w-4 h-4" strokeWidth={2} />
                    <span className="flex-1">{label}</span>
                    {isAlerts && alertCount > 0 && (
                      <span className="bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 leading-none">
                        {alertCount > 99 ? "99+" : alertCount}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      {/* Logout */}
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors w-full"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </div>
    </aside>
  );
}
