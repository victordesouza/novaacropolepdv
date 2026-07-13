import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import POS from "./pages/POS";
import Reports from "./pages/Reports.tsx";
import Login from "./pages/Login";
import Users from "./pages/Users.tsx";
import Coupons from "./pages/Coupons";
import Catalogo from "./pages/Catalogo";
import NotFound from "./pages/NotFound";
import { getInitialRouteForRole, getStoredCurrentUser, isAdminRole } from "@/lib/auth";

const queryClient = new QueryClient();

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: Array<"Administrador" | "Recepção"> }) {
  const isAuth = localStorage.getItem("na-auth") === "true";
  const currentUser = getStoredCurrentUser();

  if (!isAuth) return <Navigate to="/login" replace />;
  if (!currentUser) return <Navigate to="/login" replace />;
  if (allowedRoles && currentUser && !allowedRoles.includes(currentUser.role)) {
    return <Navigate to={getInitialRouteForRole(currentUser.role)} replace />;
  }
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/catalogo" element={<Catalogo />} />
          <Route path="/" element={<ProtectedRoute allowedRoles={["Administrador"]}><Dashboard /></ProtectedRoute>} />
          <Route path="/products" element={<ProtectedRoute allowedRoles={["Administrador", "Recepção"]}><Products /></ProtectedRoute>} />
          <Route path="/pos" element={<ProtectedRoute allowedRoles={["Administrador", "Recepção"]}><POS /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute allowedRoles={["Administrador"]}><Reports /></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute allowedRoles={["Administrador"]}><Users /></ProtectedRoute>} />
          <Route path="/coupons" element={<ProtectedRoute allowedRoles={["Administrador"]}><Coupons /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
