import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";

type User = { username: string; password: string };

const STORAGE_KEY = "na-users";

function getUsers(): User[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const users: User[] = raw ? JSON.parse(raw) : [];
    if (!users.find((u) => u.username === "admin")) {
      users.unshift({ username: "admin", password: "novaacropole" });
    }
    return users;
  } catch {
    return [{ username: "admin", password: "novaacropole" }];
  }
}

function saveUsers(users: User[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
}

export default function Users() {
  const [users, setUsers] = useState<User[]>(getUsers);
  const [open, setOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [form, setForm] = useState({ username: "", password: "" });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.username.trim() || !form.password.trim()) {
      toast.error("Preencha todos os campos.");
      return;
    }

    const updated = [...users];
    if (editIndex !== null) {
      updated[editIndex] = { username: form.username, password: form.password };
      toast.success("Usuário atualizado!");
    } else {
      if (users.find((u) => u.username === form.username)) {
        toast.error("Usuário já existe.");
        return;
      }
      updated.push({ username: form.username, password: form.password });
      toast.success("Usuário cadastrado!");
    }
    saveUsers(updated);
    setUsers(updated);
    setOpen(false);
    setEditIndex(null);
    setForm({ username: "", password: "" });
  };

  const handleDelete = (index: number) => {
    if (users[index].username === "admin") {
      toast.error("Não é possível excluir o admin.");
      return;
    }
    const updated = users.filter((_, i) => i !== index);
    saveUsers(updated);
    setUsers(updated);
    toast.success("Usuário removido.");
  };

  const openEdit = (index: number) => {
    setEditIndex(index);
    setForm({ username: users[index].username, password: users[index].password });
    setOpen(true);
  };

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Usuários</h1>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditIndex(null); setForm({ username: "", password: "" }); } }}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Novo Usuário</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>{editIndex !== null ? "Editar Usuário" : "Novo Usuário"}</DialogTitle></DialogHeader>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <Label>Usuário *</Label>
                <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required disabled={editIndex !== null && users[editIndex]?.username === "admin"} />
              </div>
              <div>
                <Label>Senha *</Label>
                <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
              </div>
              <Button type="submit" className="w-full">Salvar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {users.map((u, i) => (
          <Card key={u.username}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">{u.username}</CardTitle>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(i)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                {u.username !== "admin" && (
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(i)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{u.username === "admin" ? "Administrador" : "Operador"}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppLayout>
  );
}
