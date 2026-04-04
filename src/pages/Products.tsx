import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Plus } from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = ["Livraria", "Vestuário", "Velas", "Papelaria", "Brindes", "Outros"];

export default function Products() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", barcode: "", description: "", category: "Livraria",
    price: "", cost_price: "", stock_quantity: "", is_book: false,
  });

  const { data: products, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("*").order("name");
      return data ?? [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("products").insert({
        name: form.name,
        barcode: form.barcode || null,
        description: form.description || null,
        category: form.category,
        price: parseFloat(form.price) || 0,
        cost_price: parseFloat(form.cost_price) || 0,
        stock_quantity: parseInt(form.stock_quantity) || 0,
        is_book: form.is_book,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Produto cadastrado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setOpen(false);
      setForm({ name: "", barcode: "", description: "", category: "Livraria", price: "", cost_price: "", stock_quantity: "", is_book: false });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Produtos</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Novo Produto</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader><DialogTitle>Cadastrar Produto</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
              <div className="flex items-center gap-3">
                <Switch checked={form.is_book} onCheckedChange={(v) => setForm({ ...form, is_book: v })} />
                <Label>É um livro?</Label>
              </div>
              <div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
              <div><Label>Código de Barras</Label><Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} /></div>
              <div><Label>Descrição</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div>
                <Label>Categoria</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Preço (R$)</Label><Input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
                <div><Label>Custo (R$)</Label><Input type="number" step="0.01" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} /></div>
              </div>
              <div><Label>Quantidade em Estoque</Label><Input type="number" value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })} /></div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Salvando..." : "Cadastrar"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nome</th>
                <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground md:table-cell">Categoria</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Preço</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Estoque</th>
              </tr>
            </thead>
            <tbody>
              {products?.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="px-4 py-3 font-medium">
                    {p.name}
                    {p.is_book && <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">Livro</span>}
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{p.category}</td>
                  <td className="px-4 py-3 text-right">R$ {Number(p.price).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={p.stock_quantity <= 5 ? "font-semibold text-destructive" : ""}>
                      {p.stock_quantity}
                    </span>
                  </td>
                </tr>
              ))}
              {products?.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Nenhum produto cadastrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </AppLayout>
  );
}
