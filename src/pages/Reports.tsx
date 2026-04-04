import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const CATEGORIES = ["Todas", "Livraria", "Vestuário", "Velas", "Papelaria", "Brindes", "Outros"];

export default function Reports() {
  const [categoryFilter, setCategoryFilter] = useState("Todas");
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const { data: products } = useQuery({
    queryKey: ["products-report", categoryFilter],
    queryFn: async () => {
      let q = supabase.from("products").select("*").order("name");
      if (categoryFilter !== "Todas") q = q.eq("category", categoryFilter);
      const { data } = await q;
      return data ?? [];
    },
  });

  const { data: salesData } = useQuery({
    queryKey: ["sales-report"],
    queryFn: async () => {
      const { data: allSales } = await supabase.from("sales").select("*").order("created_at", { ascending: false });
      const { data: monthSales } = await supabase.from("sales").select("*").gte("created_at", monthStart).order("created_at", { ascending: false });
      const totalAll = allSales?.reduce((s, v) => s + Number(v.total_amount), 0) ?? 0;
      const totalMonth = monthSales?.reduce((s, v) => s + Number(v.total_amount), 0) ?? 0;
      return { allSales: allSales ?? [], monthSales: monthSales ?? [], totalAll, totalMonth };
    },
  });

  return (
    <AppLayout>
      <h1 className="mb-6 text-2xl font-bold text-foreground">Relatórios</h1>
      <Tabs defaultValue="stock">
        <TabsList>
          <TabsTrigger value="stock">Estoque Completo</TabsTrigger>
          <TabsTrigger value="financial">Relatório Financeiro</TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="mt-4 space-y-4">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nome</th>
                  <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground sm:table-cell">Código</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Categoria</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Preço</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Custo</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Estoque</th>
                </tr>
              </thead>
              <tbody>
                {products?.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">{p.barcode || "—"}</td>
                    <td className="px-4 py-3">{p.category}</td>
                    <td className="px-4 py-3 text-right">R$ {Number(p.price).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">R$ {Number(p.cost_price).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={p.stock_quantity <= 5 ? "font-semibold text-destructive" : ""}>{p.stock_quantity}</span>
                    </td>
                  </tr>
                ))}
                {products?.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Nenhum produto encontrado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="financial" className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-sm text-muted-foreground">Total Geral</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold text-primary">R$ {(salesData?.totalAll ?? 0).toFixed(2)}</p></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm text-muted-foreground">Mês Atual</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold text-success">R$ {(salesData?.totalMonth ?? 0).toFixed(2)}</p></CardContent>
            </Card>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Data</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Cliente</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Pagamento</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Total</th>
                </tr>
              </thead>
              <tbody>
                {salesData?.monthSales.map((s) => (
                  <tr key={s.id} className="border-t">
                    <td className="px-4 py-3">{new Date(s.created_at).toLocaleDateString("pt-BR")}</td>
                    <td className="px-4 py-3">{s.customer_name || "—"}</td>
                    <td className="px-4 py-3">{s.payment_method}</td>
                    <td className="px-4 py-3 text-right font-semibold">R$ {Number(s.total_amount).toFixed(2)}</td>
                  </tr>
                ))}
                {salesData?.monthSales.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Nenhuma venda neste mês.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
