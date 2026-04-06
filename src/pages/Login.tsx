import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { toast } from "sonner";
import logo from "@/assets/logo-nova-acropole.png";

type User = { username: string; password: string };

function getUsers(): User[] {
  try {
    const raw = localStorage.getItem("na-users");
    const users: User[] = raw ? JSON.parse(raw) : [];
    if (!users.find((u) => u.username === "admin")) {
      users.unshift({ username: "admin", password: "novaacropole" });
    }
    return users;
  } catch {
    return [{ username: "admin", password: "novaacropole" }];
  }
}

export default function Login() {
  const navigate = useNavigate();
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      const users = getUsers();
      const found = users.find((u) => u.username === user && u.password === password);
      if (found) {
        localStorage.setItem("na-auth", "true");
        toast.success("Bem-vindo à Nova Acrópole!");
        navigate("/");
      } else {
        toast.error("Usuário ou senha incorretos.");
      }
      setLoading(false);
    }, 500);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center pb-2">
          <img src={logo} alt="Nova Acrópole" className="mb-2 h-24 w-auto" />
          <p className="text-sm text-muted-foreground">Gestão de Estoque & PDV</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label>Usuário</Label>
              <Input value={user} onChange={(e) => setUser(e.target.value)} placeholder="Usuário" required />
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
