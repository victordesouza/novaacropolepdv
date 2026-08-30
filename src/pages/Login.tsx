import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { toast } from "sonner";
import { users as firebaseUsers } from "@/integrations/firebase";
import { getInitialRouteForRole, normalizeRole } from "@/lib/auth";

export default function Login() {
  const navigate = useNavigate();
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const loggedInUser = await firebaseUsers.validateUser(user.trim(), password);

      if (!loggedInUser) {
        toast.error("Usuário ou senha incorretos.");
        setLoading(false);
        return;
      }

      localStorage.setItem("na-auth", "true");
      localStorage.setItem("na-current-user", JSON.stringify({
        id: loggedInUser.id,
        username: loggedInUser.username,
        role: normalizeRole(loggedInUser.role),
        loginTime: new Date().toISOString()
      }));
      toast.success(`Bem-vindo, ${loggedInUser.username}!`);
      navigate(getInitialRouteForRole(loggedInUser.role), { replace: true });
    } catch (e: any) {
      toast.error("Erro ao fazer login: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center pb-2 text-center">
          <div className="mb-2 flex h-12 w-full items-center justify-center rounded-md border bg-muted/40 text-base font-semibold tracking-wide text-muted-foreground">
            Acesso ao Sistema
          </div>
          <p className="text-sm text-muted-foreground">Gestão de Estoque & PDV</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label>Usuário</Label>
              <Input
                value={user}
                onChange={(e) => setUser(e.target.value)}
                placeholder="Usuário"
                required
                autoCapitalize="off"
                autoCorrect="off"
              />
            </div>
            <div>
              <Label>Senha</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha" required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
