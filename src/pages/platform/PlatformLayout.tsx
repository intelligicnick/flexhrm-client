import React, { useMemo, useState } from "react";
import { NavLink, Outlet, useLocation } from 'react-router';
import { ChevronDown, ChevronRight, LogOut, Menu, X } from "lucide-react";
import { PLATFORM_MODULES, PLATFORM_MODULE_GROUPS } from "./platformModules";
import { usePlatformAuth } from "../../hooks/usePlatformAuth";

export default function PlatformLayout() {
  const { admin, logout } = usePlatformAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const grouped = useMemo(() => {
    const map = new Map<string, typeof PLATFORM_MODULES>();
    for (const group of PLATFORM_MODULE_GROUPS) {
      map.set(group, PLATFORM_MODULES.filter((m) => m.group === group));
    }
    return map;
  }, []);

  function toggleGroup(group: string) {
    setCollapsedGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  }

  const activeModule = PLATFORM_MODULES.find((m) => location.pathname.startsWith(m.path));

  return (
    <div className="min-h-screen bg-slate-100 flex">
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
        />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-72 bg-slate-900 text-white flex flex-col transform transition-transform lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-4 py-4 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-bold text-base">Flex HRM Platform</h1>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">
                Super Admin Console
              </p>
            </div>
            <button
              type="button"
              className="lg:hidden text-slate-400"
              onClick={() => setSidebarOpen(false)}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
          {PLATFORM_MODULE_GROUPS.map((group) => {
            const items = grouped.get(group) ?? [];
            if (items.length === 0) return null;
            const collapsed = collapsedGroups[group];
            return (
              <div key={group}>
                <button
                  type="button"
                  onClick={() => toggleGroup(group)}
                  className="w-full flex items-center justify-between px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-300"
                >
                  {group}
                  {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                </button>
                {!collapsed && (
                  <div className="space-y-0.5 mb-2">
                    {items.map((mod) => (
                      <NavLink
                        key={mod.id}
                        to={mod.path}
                        onClick={() => setSidebarOpen(false)}
                        className={({ isActive }) =>
                          `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                            isActive
                              ? "bg-[#ff791a] text-white font-semibold"
                              : "text-slate-300 hover:bg-slate-800 hover:text-white"
                          }`
                        }
                      >
                        <mod.icon size={16} className="shrink-0" />
                        <span className="truncate">{mod.label}</span>
                        {mod.implemented && (
                          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                        )}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="text-xs text-slate-400 mb-2 truncate">
            {admin?.name ?? admin?.username ?? "Platform Admin"}
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white"
          >
            <LogOut size={14} /> Logout
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-30">
          <button
            type="button"
            className="lg:hidden text-slate-600"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>
          <div>
            <h2 className="font-bold text-slate-800 text-sm">
              {activeModule?.label ?? "Platform Admin"}
            </h2>
            {activeModule?.description && (
              <p className="text-xs text-slate-500 hidden sm:block">{activeModule.description}</p>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
