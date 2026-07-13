import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { coupons as firebaseCoupons } from "@/integrations/firebase";
import type { Coupon, CouponDiscountType } from "@/integrations/firebase/types";

type CouponForm = {
  name: string;
  discountType: CouponDiscountType;
  discountValue: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'inactive';
};

const emptyForm: CouponForm = {
  name: "",
  discountType: "percent",
  discountValue: "",
  startDate: new Date().toISOString().split("T")[0],
  endDate: new Date().toISOString().split("T")[0],
  status: 'active',
};

export default function Coupons() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<CouponForm>({ ...emptyForm });

  const { data: coupons = [], isLoading } = useQuery({
    queryKey: ["coupons"],
    queryFn: async () => await firebaseCoupons.getCoupons(),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Informe o nome do cupom.");
      if (!form.discountValue.trim()) throw new Error("Informe o desconto.");
      const payload = {
        name: form.name,
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        startDate: form.startDate,
        endDate: form.endDate,
        status: form.status,
      };
      if (editingId) await firebaseCoupons.updateCoupon(editingId, payload);
      else await firebaseCoupons.createCoupon(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
      setOpen(false);
      setEditingId(null);
      setForm({ ...emptyForm });
      toast.success(editingId ? "Cupom atualizado!" : "Cupom cadastrado!");
    },
    onError: (error: any) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => await firebaseCoupons.deleteCoupon(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
      setDeleteId(null);
      toast.success("Cupom removido.");
    },
    onError: (error: any) => toast.error(error.message),
  });

  const openEdit = (coupon: Coupon) => {
    setEditingId(coupon.id);
    setForm({
      name: coupon.name,
      discountType: coupon.discountType,
      discountValue: String(coupon.discountValue),
      startDate: coupon.startDate,
      endDate: coupon.endDate,
      status: coupon.status,
    });
    setOpen(true);
  };

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Cupons</h1>
        <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) { setEditingId(null); setForm({ ...emptyForm }); } }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novo Cupom
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar Cupom" : "Novo Cupom"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
              <div>
                <Label>Nome *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Tipo de desconto *</Label>
                  <Select value={form.discountType} onValueChange={(value) => setForm({ ...form, discountType: value as CouponDiscountType })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">%</SelectItem>
                      <SelectItem value="currency">R$</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Desconto *</Label>
                  <Input type="number" min="0" step="0.01" value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: e.target.value })} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Data início *</Label>
                  <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required />
                </div>
                <div>
                  <Label>Data fim *</Label>
                  <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} required />
                </div>
              </div>
              <div>
                <Label>Status *</Label>
                <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value as 'active' | 'inactive' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando cupons...</p>
      ) : (
        <div className="grid gap-3">
          {coupons.map((coupon) => (
            <Card key={coupon.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{coupon.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {coupon.discountType === "percent" ? `${coupon.discountValue}%` : `R$ ${coupon.discountValue.toFixed(2)}`} · {coupon.startDate} até {coupon.endDate} · {coupon.status === "active" ? "Ativo" : "Inativo"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(coupon)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteId(coupon.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(value) => { if (!value) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cupom?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
