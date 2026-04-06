import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, ChevronDown, ChevronRight } from "lucide-react";
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

type SaleItem = {
  id: string;
  quantity: number;
  unit_price: number;
  product_id: string;
  products: { name: string; barcode: string | null; author: string | null } | null;
};

type SaleWithItems = {
  id: string;
  created_at: string;
  customer_name: string | null;
  payment_method: string;
  total_amount: number;
  items: SaleItem[];
};

export default function Reports() {
  const [categoryFilter, setCategoryFilter] = useState("Todas");
  const [expandedSale, setExpandedSale] = useState<string | null>(null);
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

      const saleIds = (monthSales ?? []).map((s) => s.id);
      let itemsMap: Record<string, SaleItem[]> = {};
      if (saleIds.length > 0) {
        const { data: items } = await supabase
          .from("sale_items")
          .select("id, quantity, unit_price, product_id, products(name, barcode, author)")
          .in("sale_id", saleIds);
        if (items) {
          for (const item of items) {
            const saleId = (item as any).sale_id ?? saleIds.find(() => true);
          }
          const { data: itemsWithSale } = await supabase
            .from("sale_items")
            .select("id, sale_id, quantity, unit_price, product_id, products(name, barcode, author)")
            .in("sale_id", saleIds);
          if (itemsWithSale) {
            for (const item of itemsWithSale) {
              if (!itemsMap[item.sale_id]) itemsMap[item.sale_id] = [];
              itemsMap[item.sale_id].push(item as any);
            }
          }
        }
      }

      const monthSalesWithItems: SaleWithItems[] = (monthSales ?? []).map((s) => ({
        ...s,
        items: itemsMap[s.id] || [],
      }));

      const totalAll = allSales?.reduce((s, v) => s + Number(v.total_amount), 0) ?? 0;
      const totalMonth = monthSalesWithItems.reduce((s, v) => s + Number(v.total_amount), 0);
      return { allSales: allSales ?? [], monthSales: monthSalesWithItems, totalAll, totalMonth };
    },
  });

  const toggleExpand = (id: string) => setExpandedSale((prev) => (prev === id ? null : id));

  const downloadStock = () => {
    if (!products) return;
    const headers = ["Nome", "Código de Barras", "Categoria", "Autor", "Preço", "Custo", "Estoque", "Descrição"];
    const rows = products.map((p) => [
      p.name, p.barcode || "", p.category, p.author || "",
      formatBRL(Number(p.price)), formatBRL(Number(p.cost_price)),
      String(p.stock_quantity), p.description || "",
    ]);
    downloadCSV(`estoque_${new Date().toISOString().split("T")[0]}.csv`, headers, rows);
  };

  const downloadSales = () => {
    if (!salesData) return;
    const headers = ["Data", "Cliente", "Pagamento", "Total", "Itens"];
    const rows = salesData.monthSales.map((s) => [
      new Date(s.created_at).toLocaleDateString("pt-BR"),
      s.customer_name || "—",
      s.payment_method,
      formatBRL(Number(s.total_amount)),
      s.items.map((i) => `${(i.products as any)?.name || "?"} x${i.quantity} R$${formatBRL(Number(i.unit_price))}`).join(" | "),
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
                    <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">{p.author || "—"}</td>
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
                  <th className="w-8 px-2 py-3"></th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Data</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Cliente</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Pagamento</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Total</th>
                </tr>
              </thead>
              <tbody>
                {salesData?.monthSales.map((s) => (
                  <>
                    <tr key={s.id} className="border-t cursor-pointer hover:bg-muted/50" onClick={() => toggleExpand(s.id)}>
                      <td className="px-2 py-3 text-center">
                        {s.items.length > 0 && (
                          expandedSale === s.id ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </td>
                      <td className="px-4 py-3">{new Date(s.created_at).toLocaleDateString("pt-BR")}</td>
                      <td className="px-4 py-3">{s.customer_name || "—"}</td>
                      <td className="px-4 py-3">{s.payment_method}</td>
                      <td className="px-4 py-3 text-right font-semibold">R$ {formatBRL(Number(s.total_amount))}</td>
                    </tr>
                    {expandedSale === s.id && s.items.length > 0 && (
                      <tr key={`${s.id}-items`}>
                        <td colSpan={5} className="bg-muted/30 px-8 py-3">
                          <div className="space-y-1">
                            <p className="text-xs font-semibold text-muted-foreground mb-1">Itens da venda:</p>
                            {s.items.map((item) => (
                              <div key={item.id} className="flex items-center justify-between text-sm">
                                <span>{(item.products as any)?.name || "Produto removido"}</span>
                                <span className="text-muted-foreground">
                                  {item.quantity}x R$ {formatBRL(Number(item.unit_price))} = R$ {formatBRL(Number(item.unit_price) * item.quantity)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
                {salesData?.monthSales.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Nenhuma venda neste mês.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
