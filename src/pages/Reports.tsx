import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { formatBRL } from "@/lib/currency";

const CATEGORIES = ["Todas", "Livraria", "Vestuário", "Velas", "Papelaria", "Brindes", "Outros"];

function downloadCSV(filename: string, headers: string[], rows: string[][]) {
  const bom = "\uFEFF";
  const csv = bom + [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

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

  const downloadStock = () => {
    if (!products) return;
    const headers = ["Nome", "Código de Barras", "Categoria", "Autor", "Preço", "Custo", "Estoque", "Descrição"];
    const rows = products.map((p) => [
      p.name, p.barcode || "", p.category, (p as any).author || "",
      formatBRL(Number(p.price)), formatBRL(Number(p.cost_price)),
      String(p.stock_quantity), p.description || "",
    ]);
    downloadCSV(`estoque_${new Date().toISOString().split("T")[0]}.csv`, headers, rows);
  };

  const downloadSales = () => {
    if (!salesData) return;
    const headers = ["Data", "Cliente", "Pagamento", "Total"];
    const rows = salesData.monthSales.map((s) => [
      new Date(s.created_at).toLocaleDateString("pt-BR"),
      s.customer_name || "—", s.payment_method,
      formatBRL(Number(s.total_amount)),
    ]);
    downloadCSV(`vendas_${new Date().toISOString().split("T")[0]}.csv`, headers, rows);
  };

  return (
    <AppLayout>
      <h1 className="mb-6 text-2xl font-bold text-foreground">Relatórios</h1>
      <Tabs defaultValue="stock">
        <TabsList>
          <TabsTrigger value="stock">Estoque Completo</TabsTrigger>
          <TabsTrigger value="financial">Relatório Financeiro</TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="mt-4 space-y-4">
          <div className="flex items-center gap-3">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="outline" onClick={downloadStock}><Download className="mr-2 h-4 w-4" />Baixar CSV</Button>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nome</th>
                  <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground sm:table-cell">Código</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Categoria</th>
                  <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground lg:table-cell">Autor</th>
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
                    <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">{(p as any).author || "—"}</td>
                    <td className="px-4 py-3 text-right">R$ {formatBRL(Number(p.price))}</td>
                    <td className="px-4 py-3 text-right">R$ {formatBRL(Number(p.cost_price))}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={p.stock_quantity <= 5 ? "font-semibold text-destructive" : ""}>{p.stock_quantity}</span>
                    </td>
                  </tr>
                ))}
                {products?.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Nenhum produto encontrado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="financial" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="text-sm text-muted-foreground">Total Geral</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold text-primary">R$ {formatBRL(salesData?.totalAll ?? 0)}</p></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-sm text-muted-foreground">Mês Atual</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold text-success">R$ {formatBRL(salesData?.totalMonth ?? 0)}</p></CardContent>
              </Card>
            </div>
            <Button variant="outline" onClick={downloadSales}><Download className="mr-2 h-4 w-4" />Baixar CSV</Button>
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
                    <td className="px-4 py-3 text-right font-semibold">R$ {formatBRL(Number(s.total_amount))}</td>
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
