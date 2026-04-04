import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Package, AlertTriangle, ShoppingCart } from "lucide-react";
import AppLayout from "@/components/AppLayout";

export default function Dashboard() {
  const today = new Date().toISOString().split("T")[0];
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const { data: todaySales } = useQuery({
    queryKey: ["today-sales", today],
    queryFn: async () => {
      const { data } = await supabase
        .from("sales")
        .select("total_amount")
        .gte("created_at", today);
      return data?.reduce((sum, s) => sum + Number(s.total_amount), 0) ?? 0;
    },
  });

  const { data: monthlySales } = useQuery({
    queryKey: ["monthly-sales"],
    queryFn: async () => {
      const { data } = await supabase
        .from("sales")
        .select("total_amount")
        .gte("created_at", monthStart);
      return data?.reduce((sum, s) => sum + Number(s.total_amount), 0) ?? 0;
    },
  });

  const { data: todayCount } = useQuery({
    queryKey: ["today-sales-count", today],
    queryFn: async () => {
      const { count } = await supabase
        .from("sales")
        .select("*", { count: "exact", head: true })
        .gte("created_at", today);
      return count ?? 0;
    },
  });

  const { data: lowStock } = useQuery({
    queryKey: ["low-stock"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("*")
        .lte("stock_quantity", 5)
        .order("stock_quantity", { ascending: true });
      return data ?? [];
    },
  });

  const stats = [
    { label: "Vendas Hoje", value: `R$ ${(todaySales ?? 0).toFixed(2)}`, icon: DollarSign, color: "text-primary" },
    { label: "Qtd Vendas Hoje", value: todayCount ?? 0, icon: ShoppingCart, color: "text-accent" },
    { label: "Faturamento Mensal", value: `R$ ${(monthlySales ?? 0).toFixed(2)}`, icon: DollarSign, color: "text-success" },
    { label: "Estoque Baixo", value: lowStock?.length ?? 0, icon: AlertTriangle, color: "text-destructive" },
  ];

  return (
    <AppLayout>
      <h1 className="mb-6 text-2xl font-bold text-foreground">Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
              <s.icon className={`h-5 w-5 ${s.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {lowStock && lowStock.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Produtos com Estoque Baixo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {lowStock.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-sm text-muted-foreground">{p.category}</p>
                  </div>
                  <span className="rounded-full bg-destructive/10 px-3 py-1 text-sm font-semibold text-destructive">
                    {p.stock_quantity} un.
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </AppLayout>
  );
}
