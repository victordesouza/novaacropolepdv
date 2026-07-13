import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as firebaseUsers from "@/integrations/firebase/queries/users";
import { auditLogs } from "@/integrations/firebase";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import type { User } from "@/integrations/firebase/types";
import { useAuth } from "@/hooks/useAuth";
import { getStoredCurrentUser, normalizeRole, type AppRole } from "@/lib/auth";

type UserForm = { username: string; password: string; role: AppRole };

const USER_ROLES: AppRole[] = ["Recepção", "Administrador"];

function formatAuditData(data: any) {
  if (data == null) return "—";
  if (typeof data === "string") return data;
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return "—";
  }
}

export default function Users() {
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();
  const actor = currentUser ?? getStoredCurrentUser();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<UserForm>({ username: "", password: "", role: "Recepção" });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      return await firebaseUsers.getUsers();
    },
  });

  const editingUser = editingId ? users.find((user) => user.id === editingId) ?? null : null;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.username.trim() || !form.password.trim() || !form.role) {
        throw new Error("Preencha todos os campos.");
      }

      const targetRole = normalizeRole(form.role);

      if (editingId) {
        const targetUser = users.find((user) => user.id === editingId);
        await firebaseUsers.updateUser(editingId, {
          username: form.username,
          password: form.password,
          role: targetRole,
        });

        if (actor) {
          await auditLogs.recordAuditLog({
            actorUserId: actor.id,
            actorUsername: actor.username,
            actorRole: actor.role,
            subjectUserId: editingId,
            subjectUsername: form.username,
            area: "Usuários",
            action: "update",
            data: {
              targetUserId: editingId,
              targetUsername: form.username,
              targetRole,
              previousUsername: targetUser?.username,
              previousRole: targetUser?.role,
            },
          }).catch((error) => console.error("Erro ao gravar log de usuário:", error));
        }
      } else {
        const existing = await firebaseUsers.getUserByUsername(form.username);
        if (existing) throw new Error("Usuário já existe.");

        const createdId = await firebaseUsers.createUser({
          username: form.username,
          password: form.password,
          role: targetRole,
        });

        if (actor) {
          await auditLogs.recordAuditLog({
            actorUserId: actor.id,
            actorUsername: actor.username,
            actorRole: actor.role,
            subjectUserId: createdId,
            subjectUsername: form.username,
            area: "Usuários",
            action: "create",
            data: {
              targetUserId: createdId,
              targetUsername: form.username,
              targetRole,
            },
          }).catch((error) => console.error("Erro ao gravar log de usuário:", error));
        }
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Usuário atualizado!" : "Usuário cadastrado!");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
      setOpen(false);
      setEditingId(null);
      setForm({ username: "", password: "", role: "Recepção" });
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

      if (actor && user) {
        await auditLogs.recordAuditLog({
          actorUserId: actor.id,
          actorUsername: actor.username,
          actorRole: actor.role,
          subjectUserId: user.id,
          subjectUsername: user.username,
          area: "Usuários",
          action: "delete",
          data: {
            targetUserId: user.id,
            targetUsername: user.username,
            targetRole: user.role,
          },
        }).catch((error) => console.error("Erro ao gravar log de usuário:", error));
      }
    },
    onSuccess: () => {
      toast.success("Usuário removido.");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
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
    setForm({ username: user.username, password: user.password, role: normalizeRole(user.role) });
    setOpen(true);
  };

  const openNewUser = () => {
    setEditingId(null);
    setForm({ username: "", password: "", role: "Recepção" });
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
              setForm({ username: "", password: "", role: "Recepção" });
            }
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={openNewUser}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Usuário
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar Usuário" : "Novo Usuário"}</DialogTitle>
            </DialogHeader>

            <div>
              <form onSubmit={handleSave}>
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

                <div>
                  <Label>Tipo de usuário *</Label>
                  <Select value={form.role} onValueChange={(value) => setForm({ ...form, role: value as AppRole })} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {USER_ROLES.map((role) => (
                        <SelectItem key={role} value={role}>
                          {role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div style={{ marginTop: "1rem" }}>
                    <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? "Salvando..." : "Salvar"}
                    </Button>
                </div>
              </form>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando usuários...</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Usuário</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tipo</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{user.username}</td>
                  <td className="px-4 py-3 text-muted-foreground">{normalizeRole(user.role)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(user)}
                        disabled={user.username === "admin"}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {user.username !== "admin" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleDelete(user.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">Nenhum usuário cadastrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </AppLayout>
  );
}