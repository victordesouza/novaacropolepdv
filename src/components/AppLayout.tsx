import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Package, ShoppingCart, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/products", label: "Produtos", icon: Package },
  { to: "/pos", label: "PDV", icon: ShoppingCart },
  { to: "/reports", label: "Relatórios", icon: BarChart3 },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-60 bg-sidebar text-sidebar-foreground md:block">
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-6">
          <ShoppingCart className="h-6 w-6 text-sidebar-primary" />
          <span className="text-lg font-bold text-sidebar-primary-foreground">EstoquePDV</span>
        </div>
        <nav className="mt-4 space-y-1 px-3">
          {navItems.map((item) => (
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
      </aside>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t bg-card md:hidden">
        {navItems.map((item) => (
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

      <main className="pb-20 md:ml-60 md:pb-0">
        <div className="p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
