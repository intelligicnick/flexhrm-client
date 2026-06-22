import React, { useMemo } from "react";
import { Link, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Home, Map, LayoutGrid, LogOut, Eye } from "lucide-react";
import { useHRMS } from "../../context/HRMSContext";
import { useObserverStats } from "./useObserverStats";

function getPageTitle(pathname: string): string {
  if (pathname === "/observer" || pathname === "/observer/") return "Dashboard";
  if (pathname.startsWith("/observer/map")) return "Supervisors Map";
  if (pathname.startsWith("/observer/menu")) return "All Modules";
  if (pathname.startsWith("/observer/salary")) return "Salary";
  if (pathname.startsWith("/observer/visits")) return "Visits";
  if (pathname.startsWith("/observer/commitments")) return "Commitment Diary";
  if (pathname.startsWith("/observer/tenders")) return "Tenders";
  if (pathname.startsWith("/observer/contracts")) return "Contracts";
  if (pathname.startsWith("/observer/car-papers")) return "Car Papers";
  if (pathname.startsWith("/observer/it-renewals")) return "IT Renewals";
  if (pathname.startsWith("/observer/licenses")) return "Licenses";
  if (pathname.startsWith("/observer/expenses")) return "Expenses";
  if (pathname.startsWith("/observer/partner-pay")) return "Partner Pay";
  return "Observer Admin";
}

function ObserverLayoutInner() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoggedIn, authBootstrapping, sessionUser, handleLogout } = useHRMS();
  const { alertCount } = useObserverStats();

  const pageTitle = useMemo(() => getPageTitle(location.pathname), [location.pathname]);
  const showNav = !location.pathname.includes("/login");

  const logout = async () => {
    try {
      await handleLogout("/observer/login");
    } catch {
      navigate("/observer/login", { replace: true });
    }
  };

  if (authBootstrapping) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center text-slate-400 bg-[#f4f6f9]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#ff791a] border-t-transparent animate-spin" />
          <p className="text-sm font-medium">Loading…</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <Navigate to="/observer/login" replace />;
  }

  const navItems = [
    { to: "/observer", icon: Home, label: "Home", exact: true },
    { to: "/observer/map", icon: Map, label: "Map" },
    { to: "/observer/menu", icon: LayoutGrid, label: "Modules", badge: alertCount },
  ];

  return (
    <div className="min-h-[100dvh] bg-[#f4f6f9] flex flex-col max-w-lg mx-auto w-full">
      <header className="sticky top-0 z-30 safe-area-top">
        <div className="bg-gradient-to-br from-[#0C1E4A] via-[#152a5c] to-[#1a3568] px-4 pt-3 pb-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <Eye size={12} className="text-orange-300/80" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-orange-300/80">
                  Observer Admin
                </p>
              </div>
              <h1 className="text-base font-black text-white truncate">{pageTitle}</h1>
              <p className="text-[11px] text-slate-300 mt-0.5 truncate">{sessionUser || "Admin"}</p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="p-2 text-white/80 hover:text-white cursor-pointer"
              title="Logout"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className={`flex-1 px-4 pt-4 ${showNav ? "pb-24" : "pb-4"}`}>
        <Outlet />
      </main>

      {showNav && (
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg z-30 safe-area-bottom px-3 pt-2 pb-2 bg-[#f4f6f9] border-t border-slate-200 shadow-[0_-8px_24px_-12px_rgba(15,23,42,0.1)]">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-lg shadow-slate-200/50 flex">
            {navItems.map(({ to, icon: Icon, label, exact, badge }) => {
              const active = exact ? location.pathname === to : location.pathname.startsWith(to);
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex-1 relative py-2.5 flex flex-col items-center gap-0.5 text-[10px] font-bold transition rounded-xl mx-0.5 my-1 ${
                    active ? "text-[#ff791a] bg-orange-50" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <Icon size={20} strokeWidth={active ? 2.5 : 2} />
                  {label}
                  {badge ? (
                    <span className="absolute top-0.5 right-2 min-w-[14px] h-[14px] px-0.5 rounded-full bg-red-500 text-white text-[8px] font-black flex items-center justify-center">
                      {badge > 9 ? "9+" : badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}

export default function ObserverLayout() {
  return <ObserverLayoutInner />;
}
