import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as firebaseUsers from "@/integrations/firebase/queries/users";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import type { User } from "@/integrations/firebase/types";

type UserForm = { username: string; password: string; role?: string };

export default function Users() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<UserForm>({ username: "", password: "", role: "Operador" });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      return await firebaseUsers.getUsers();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.username.trim() || !form.password.trim()) {
        throw new Error("Preencha todos os campos.");
      }

      if (editingId) {
        await firebaseUsers.updateUser(editingId, {
          username: form.username,
          password: form.password,
          role: (form.role || "Operador") as 'Admin' | 'Operador',
        });
      } else {
        const existing = await firebaseUsers.getUserByUsername(form.username);
        if (existing) throw new Error("Usuário já existe.");

        await firebaseUsers.createUser({
          username: form.username,
          password: form.password,
          role: (form.role || "Operador") as 'Admin' | 'Operador',
        });
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Usuário atualizado!" : "Usuário cadastrado!");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setOpen(false);
      setEditingId(null);
      setForm({ username: "", password: "", role: "Operador" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const user = users.find((u) => u.id === id);
      if (user?.username === "admin") {
        throw new Error("Não é possível excluir o admin.");
      }
      await firebaseUsers.deleteUser(id);
    },
    onSuccess: () => {
      toast.success("Usuário removido.");
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate();
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const openEdit = (user: User) => {
    setEditingId(user.id);
    setForm({ username: user.username, password: user.password, role: user.role || "Operador" });
    setOpen(true);
  };

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Usuários</h1>
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) {
              setEditingId(null);
              setForm({ username: "", password: "", role: "Operador" });
            }
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novo Usuário
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar Usuário" : "Novo Usuário"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <Label>Usuário *</Label>
                <Input
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  required
                  disabled={editingId ? users.find((u) => u.id === editingId)?.username === "admin" : false}
                />
              </div>
              <div>
                <Label>Senha *</Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando usuários...</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {users.map((u) => (
            <Card key={u.id}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">{u.username}</CardTitle>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openEdit(u)}
                    disabled={u.username === "admin"}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {u.username !== "admin" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleDelete(u.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{u.role}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
