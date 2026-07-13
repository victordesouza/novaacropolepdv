import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { LayoutDashboard, Package, ShoppingCart, BarChart3, LogOut, Users, User, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import SessionExpiry from "@/components/SessionExpiry";
import logo from "@/assets/logo-nova-acropole.png";
import { getAreaFromPath } from "@/lib/audit";
import { auditLogs } from "@/integrations/firebase";
import { getStoredCurrentUser } from "@/lib/auth";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, adminOnly: true },
  { to: "/products", label: "Produtos", icon: Package },
  { to: "/pos", label: "PDV", icon: ShoppingCart },
  { to: "/coupons", label: "Cupons", icon: FileText, adminOnly: true },
  { to: "/reports", label: "Relatórios", icon: BarChart3, adminOnly: true },
  { to: "/users", label: "Usuários", icon: Users, adminOnly: true },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, getUserRole, getLoginDuration, logout: authLogout } = useAuth();
  const actor = currentUser ?? getStoredCurrentUser();

  useEffect(() => {
    if (!actor?.id || !actor?.username) return;

    void auditLogs.recordAuditLog({
      actorUserId: actor.id,
      actorUsername: actor.username,
      actorRole: actor.role,
      subjectUserId: actor.id,
      subjectUsername: actor.username,
      area: getAreaFromPath(location.pathname),
      action: "access",
      data: { pathname: location.pathname },
    }).catch((error) => console.error("Erro ao gravar log de acesso:", error));
  }, [actor?.id, actor?.role, actor?.username, location.pathname]);

  const visibleNavItems = navItems.filter((item) => !item.adminOnly || getUserRole() === "Administrador");

  const logout = () => {
    authLogout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-60 bg-sidebar text-sidebar-foreground md:flex md:flex-col">
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-4">
          <img src={logo} alt="Nova Acrópole" className="h-10 w-auto" />
          <span className="text-sm font-bold text-sidebar-primary-foreground leading-tight">Nova Acrópole</span>
        </div>
        <nav className="mt-4 flex-1 space-y-1 px-3">
          {visibleNavItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                location.pathname === item.to
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "hover:bg-sidebar-accent/50"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Informações do usuário logado */}
        {currentUser && (
          <div className="border-t border-sidebar-border p-3">
            <div className="flex items-center gap-3 rounded-lg bg-sidebar-accent/30 px-3 py-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <User className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">
                  {currentUser.username}
                </p>
                <div className="flex items-center gap-2 text-xs text-sidebar-foreground/80">
                  <span>{getUserRole()}</span>
                  {getLoginDuration() && (
                    <>
                      <span>•</span>
                      <span>{getLoginDuration()}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="border-t border-sidebar-border p-3">
          <button onClick={logout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent/50">
            <LogOut className="h-5 w-5" />
            Sair
          </button>
        </div>
      </aside>

      {/* Header Mobile */}
      <header className="fixed top-0 left-0 right-0 z-40 flex h-14 items-center justify-between border-b bg-background px-4 md:hidden">
        <div className="flex items-center gap-2">
          <img src={logo} alt="Nova Acrópole" className="h-8 w-auto" />
          <span className="text-sm font-bold">Nova Acrópole</span>
        </div>

        {currentUser && (
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className="text-sm font-medium">{currentUser.username}</p>
              <p className="text-xs text-muted-foreground">{getUserRole()}</p>
            </div>
            <button
              onClick={logout}
              className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </header>

      <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t bg-card md:hidden">
        {visibleNavItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium transition-colors",
              location.pathname === item.to
                ? "text-primary"
                : "text-muted-foreground"
            )}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </Link>
        ))}
      </nav>

      <main className="pb-20 pt-14 md:ml-60 md:pb-0 md:pt-0">
        <div className="p-4 md:p-8">{children}</div>
      </main>

      {/* Componente de aviso de expiração de sessão */}
      <SessionExpiry />
    </div>
  );
}
