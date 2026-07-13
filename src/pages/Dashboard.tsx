import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import * as firebaseSales from "@/integrations/firebase/queries/sales";
import * as firebaseProducts from "@/integrations/firebase/queries/products";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Package, AlertTriangle, ShoppingCart } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function Dashboard() {
  const today = new Date().toISOString().split("T")[0];
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const { data: todaySales } = useQuery({
    queryKey: ["today-sales", today],
    queryFn: async () => {
      const todayDate = new Date(today);
      return await firebaseSales.getSalesTotalAmount(todayDate);
    },
  });

  const { data: monthlySales } = useQuery({
    queryKey: ["monthly-sales"],
    queryFn: async () => {
      return await firebaseSales.getSalesTotalAmount(new Date(monthStart));
    },
  });

  const { data: todayCount } = useQuery({
    queryKey: ["today-sales-count", today],
    queryFn: async () => {
      const todayDate = new Date(today);
      return await firebaseSales.getSalesCount(todayDate);
    },
  });

  const { data: lowStock } = useQuery({
    queryKey: ["low-stock"],
    queryFn: async () => {
      return await firebaseProducts.getLowStockProducts();
    },
  });

  const { data: allSales = [] } = useQuery({
    queryKey: ["dashboard-sales-history"],
    queryFn: async () => await firebaseSales.getSales(),
  });

  const monthlyChartData = useMemo(() => {
    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 12 }, (_, monthIndex) => {
      const monthSales = allSales.filter((sale) => {
        const date = new Date(sale.createdAt?.toDate?.() ?? sale.createdAt);
        return date.getFullYear() === currentYear && date.getMonth() === monthIndex;
      });

      return {
        month: monthNames[monthIndex],
        salesCount: monthSales.length,
        salesValue: monthSales.reduce((sum, sale) => sum + Number(sale.totalAmount), 0),
      };
    });
  }, [allSales]);

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
                    <p className="text-sm text-muted-foreground">
                      {p.category} · mínimo {p.stockAlertMinimum ?? 1}
                    </p>
                  </div>
                  <span className="rounded-full bg-destructive/10 px-3 py-1 text-sm font-semibold text-destructive">
                    {p.stockQuantity} un.
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg">Vendas por Mês</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value, name) => [name === "salesValue" ? `R$ ${Number(value).toFixed(2)}` : value, name === "salesValue" ? "Valor de vendas" : "Número de vendas"]} />
                <Bar dataKey="salesCount" name="salesCount" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                <Bar dataKey="salesValue" name="salesValue" fill="hsl(var(--success))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
