import { Fragment, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import * as firebaseProducts from "@/integrations/firebase/queries/products";
import * as firebaseSales from "@/integrations/firebase/queries/sales";
import { auditLogs } from "@/integrations/firebase";
import AppLayout from "@/components/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, ChevronDown, ChevronRight, FileSpreadsheet } from "lucide-react";
import { formatBRL } from "@/lib/currency";

const STOCK_CATEGORIES = ["Todas", "Livraria", "Cantina", "Loja"];
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function formatDateTime(value: any) {
  const date = value?.toDate?.() ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("pt-BR");
}

function formatDate(value: any) {
  const date = value?.toDate?.() ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("pt-BR");
}

function getSaleItemSubtotal(item: { quantity: number; unitPrice: number }) {
  return Number(item.unitPrice) * Number(item.quantity);
}

function formatDiscountLabel(discountType?: string | null, discountValue?: number | null) {
  if (!discountType || discountValue == null) return "—";
  return discountType === "percent" ? `${discountValue}%` : `R$ ${formatBRL(Number(discountValue))}`;
}

function downloadWorkbook(filename: string, sheets: Array<{ name: string; rows: Record<string, unknown>[] }>) {
  const workbook = XLSX.utils.book_new();
  sheets.forEach((sheet) => {
    const worksheet = XLSX.utils.json_to_sheet(sheet.rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
  });
  XLSX.writeFile(workbook, filename);
}

export default function Reports() {
  const currentDate = new Date();
  const [categoryFilter, setCategoryFilter] = useState("Todas");
  const [expandedSale, setExpandedSale] = useState<string | null>(null);
  const [reportMonth, setReportMonth] = useState(String(currentDate.getMonth()));
  const [reportYear, setReportYear] = useState(String(currentDate.getFullYear()));
  const [logSearch, setLogSearch] = useState("");
  const [logAreaFilter, setLogAreaFilter] = useState("Todas");
  const [logActionFilter, setLogActionFilter] = useState("Todas");
  const [logUserFilter, setLogUserFilter] = useState("Todas");
  const [logPage, setLogPage] = useState(1);
  const logPageSize = 10;

  const years = useMemo(() => {
    const currentYear = currentDate.getFullYear();
    return Array.from({ length: 6 }, (_, index) => String(currentYear - index));
  }, [currentDate]);

  const periodStart = useMemo(() => new Date(Number(reportYear), Number(reportMonth), 1), [reportMonth, reportYear]);
  const periodEnd = useMemo(() => new Date(Number(reportYear), Number(reportMonth) + 1, 1), [reportMonth, reportYear]);

  const { data: products = [] } = useQuery({
    queryKey: ["products-report", categoryFilter],
    queryFn: async () => await firebaseProducts.getProducts({ category: categoryFilter }),
  });

  const { data: salesData } = useQuery({
    queryKey: ["sales-report", reportMonth, reportYear],
    queryFn: async () => {
      const allSales = await firebaseSales.getSales(periodStart, periodEnd);
      const salesWithItems = await firebaseSales.getAllSalesWithItems();
      const monthSales = salesWithItems.filter((sale) => {
        const saleDate = new Date(sale.createdAt.toDate?.() ?? sale.createdAt);
        return saleDate >= periodStart && saleDate < periodEnd;
      });

      return {
        allSales,
        monthSales,
        totalAll: allSales.reduce((sum, sale) => sum + Number(sale.totalAmount), 0),
        totalMonth: monthSales.reduce((sum, sale) => sum + Number(sale.totalAmount), 0),
      };
    },
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["system-audit-logs"],
    queryFn: async () => await auditLogs.getAllAuditLogs(),
  });

  const logAreas = useMemo(() => ["Todas", ...Array.from(new Set(logs.map((log) => log.area).filter(Boolean)))], [logs]);
  const logActions = useMemo(() => ["Todas", ...Array.from(new Set(logs.map((log) => log.action).filter(Boolean)))], [logs]);
  const logUsers = useMemo(() => ["Todas", ...Array.from(new Set(logs.map((log) => log.actorUsername).filter(Boolean)))], [logs]);

  const filteredLogs = useMemo(() => {
    const searchTerm = logSearch.trim().toLowerCase();
    return logs.filter((log) => {
      const matchesArea = logAreaFilter === "Todas" || log.area === logAreaFilter;
      const matchesAction = logActionFilter === "Todas" || log.action === logActionFilter;
      const matchesUser = logUserFilter === "Todas" || log.actorUsername === logUserFilter;
      const haystack = [
        log.area,
        log.action,
        log.actorUsername,
        log.subjectUsername,
        JSON.stringify(log.data ?? {}),
      ].join(" ").toLowerCase();
      const matchesSearch = !searchTerm || haystack.includes(searchTerm);
      return matchesArea && matchesAction && matchesUser && matchesSearch;
    });
  }, [logs, logActionFilter, logAreaFilter, logSearch, logUserFilter]);

  const totalLogPages = Math.max(1, Math.ceil(filteredLogs.length / logPageSize));
  const paginatedLogs = useMemo(() => {
    const currentPage = Math.min(logPage, totalLogPages);
    const startIndex = (currentPage - 1) * logPageSize;
    return filteredLogs.slice(startIndex, startIndex + logPageSize);
  }, [filteredLogs, logPage, totalLogPages]);

  useEffect(() => {
    setLogPage((currentPage) => Math.min(currentPage, totalLogPages));
  }, [totalLogPages]);

  useEffect(() => {
    setLogPage(1);
  }, [logActionFilter, logAreaFilter, logSearch, logUserFilter]);

  const stockRows = products.map((product) => ({
    Nome: product.name,
    "Código de Barras": product.barcode || "",
    Categoria: product.category,
    Tags: (product.tags || []).join(", "),
    "Estoque Mínimo": product.stockAlertMinimum ?? 1,
    Estoque: product.stockQuantity,
    "Estoque Baixo": product.stockQuantity < (product.stockAlertMinimum ?? 1) ? "Sim" : "Não",
    Preço: formatBRL(Number(product.price)),
    Autor: product.author || "",
    Descrição: product.description || "",
  }));

  const financialRows = (salesData?.monthSales ?? []).map((sale) => ({
    "Data e hora": formatDateTime(sale.createdAt),
    Cliente: sale.customerName || "—",
    Vendedor: sale.sellerUsername || "—",
    Pagamento: sale.paymentMethod,
    "Subtotal bruto": formatBRL(sale.items.reduce((sum, item) => sum + getSaleItemSubtotal(item), 0)),
    "Desconto dos itens": formatBRL(sale.items.reduce((sum, item) => sum + Number(item.couponDiscountAmount ?? 0), 0)),
    "Desconto geral": formatDiscountLabel(sale.discountType, sale.discountValue),
    "Valor do desconto geral": formatBRL(Number(sale.discountAmount ?? 0)),
    "Total líquido": formatBRL(Number(sale.totalAmount)),
    Itens: sale.items.map((item) => {
      const itemSubtotal = getSaleItemSubtotal(item);
      const itemDiscount = Number(item.couponDiscountAmount ?? 0);
      const itemFinalTotal = Math.max(0, itemSubtotal - itemDiscount);
      const couponInfo = item.couponName ? `${item.couponName} (${formatDiscountLabel(item.couponDiscountType, item.couponDiscountValue)})` : "—";
      return `${item.product?.name || "?"} x${item.quantity} · unit R$ ${formatBRL(Number(item.unitPrice))} · cupom ${couponInfo} · desconto R$ ${formatBRL(itemDiscount)} · total R$ ${formatBRL(itemFinalTotal)}`;
    }).join("\n"),
  }));

  const logRows = logs.map((log) => ({
    DataHora: formatDateTime(log.createdAt),
    Área: log.area,
    Ação: log.action,
    Usuário: log.actorUsername,
    Perfil: log.actorRole,
    Sujeito: log.subjectUsername || "—",
    Dados: JSON.stringify(log.data ?? {}, null, 2),
  }));

  const filteredLogRows = filteredLogs.map((log) => ({
    DataHora: formatDateTime(log.createdAt),
    Área: log.area,
    Ação: log.action,
    Usuário: log.actorUsername,
    Perfil: log.actorRole,
    Sujeito: log.subjectUsername || "—",
    Dados: JSON.stringify(log.data ?? {}, null, 2),
  }));

  const downloadAllXlsx = () => downloadWorkbook(`relatorios_${new Date().toISOString().split("T")[0]}.xlsx`, [
    { name: "Estoque", rows: stockRows },
    { name: "Financeiro", rows: financialRows },
    { name: "Logs", rows: filteredLogRows },
  ]);

  const downloadStockXlsx = () => downloadWorkbook(`estoque_${new Date().toISOString().split("T")[0]}.xlsx`, [{ name: "Estoque", rows: stockRows }]);
  const downloadFinancialXlsx = () => downloadWorkbook(`financeiro_${reportYear}_${Number(reportMonth) + 1}.xlsx`, [{ name: "Financeiro", rows: financialRows }]);
  const downloadLogsXlsx = () => downloadWorkbook(`logs_${new Date().toISOString().split("T")[0]}.xlsx`, [{ name: "Logs", rows: filteredLogRows }]);

  const toggleExpand = (id: string) => setExpandedSale((prev) => (prev === id ? null : id));

  return (
    <AppLayout>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
        <Button variant="outline" onClick={downloadAllXlsx}>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Baixar XLSX geral
        </Button>
      </div>

      <Tabs defaultValue="stock">
        <TabsList>
          <TabsTrigger value="stock">Estoque</TabsTrigger>
          <TabsTrigger value="financial">Financeiro</TabsTrigger>
          <TabsTrigger value="logs">Logs Gerais</TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>{STOCK_CATEGORIES.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="outline" onClick={downloadStockXlsx}><Download className="mr-2 h-4 w-4" />Baixar XLSX</Button>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nome</th>
                  <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground sm:table-cell">Código</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Categoria</th>
                  <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground lg:table-cell">Tags</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Mínimo</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Estoque</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Preço</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id} className="border-t">
                    <td className="px-4 py-3 font-medium">{product.name}</td>
                    <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">{product.barcode || "—"}</td>
                    <td className="px-4 py-3">{product.category}</td>
                    <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">{(product.tags || []).join(", ") || "—"}</td>
                    <td className="px-4 py-3 text-right">{product.stockAlertMinimum ?? 1}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={product.stockQuantity < (product.stockAlertMinimum ?? 1) ? "font-semibold text-destructive" : ""}>{product.stockQuantity}</span>
                    </td>
                    <td className="px-4 py-3 text-right">R$ {formatBRL(Number(product.price))}</td>
                  </tr>
                ))}
                {products.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Nenhum produto encontrado.</td></tr>}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="financial" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Select value={reportMonth} onValueChange={setReportMonth}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Mês" /></SelectTrigger>
                <SelectContent>{MONTHS.map((month, index) => <SelectItem key={month} value={String(index)}>{month}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={reportYear} onValueChange={setReportYear}>
                <SelectTrigger className="w-32"><SelectValue placeholder="Ano" /></SelectTrigger>
                <SelectContent>{years.map((year) => <SelectItem key={year} value={year}>{year}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={downloadFinancialXlsx}><Download className="mr-2 h-4 w-4" />Baixar XLSX</Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-sm text-muted-foreground">Total do Período</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold text-primary">R$ {formatBRL(salesData?.totalMonth ?? 0)}</p></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm text-muted-foreground">Total Geral</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold text-success">R$ {formatBRL(salesData?.totalAll ?? 0)}</p></CardContent>
            </Card>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="w-8 px-2 py-3"></th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Data</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Cliente</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Vendedor</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Pagamento</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Desconto</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Total</th>
                </tr>
              </thead>
              <tbody>
                {salesData?.monthSales.map((sale) => (
                  <Fragment key={sale.id}>
                    <tr key={sale.id} className="cursor-pointer border-t hover:bg-muted/50" onClick={() => toggleExpand(sale.id)}>
                      <td className="px-2 py-3 text-center">
                        {sale.items.length > 0 && (expandedSale === sale.id ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />)}
                      </td>
                      <td className="px-4 py-3">{formatDateTime(sale.createdAt)}</td>
                      <td className="px-4 py-3">{sale.customerName || "—"}</td>
                      <td className="px-4 py-3">{sale.sellerUsername || "—"}</td>
                      <td className="px-4 py-3">{sale.paymentMethod}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <div className="space-y-1 text-xs">
                          <p><span className="font-medium">Itens:</span> R$ {formatBRL(sale.items.reduce((sum, item) => sum + Number(item.couponDiscountAmount ?? 0), 0))}</p>
                          <p><span className="font-medium">Geral:</span> {formatDiscountLabel(sale.discountType, sale.discountValue)} ({formatBRL(Number(sale.discountAmount ?? 0))})</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">R$ {formatBRL(Number(sale.totalAmount))}</td>
                    </tr>
                    {expandedSale === sale.id && sale.items.length > 0 && (
                      <tr key={`${sale.id}-items`}>
                        <td colSpan={7} className="bg-muted/30 px-8 py-4">
                          <div className="space-y-3">
                            <div className="grid gap-3 sm:grid-cols-4">
                              <div className="rounded-md border bg-background p-3">
                                <p className="text-xs text-muted-foreground">Subtotal bruto</p>
                                <p className="font-semibold">R$ {formatBRL(sale.items.reduce((sum, item) => sum + getSaleItemSubtotal(item), 0))}</p>
                              </div>
                              <div className="rounded-md border bg-background p-3">
                                <p className="text-xs text-muted-foreground">Desconto dos itens</p>
                                <p className="font-semibold">R$ {formatBRL(sale.items.reduce((sum, item) => sum + Number(item.couponDiscountAmount ?? 0), 0))}</p>
                              </div>
                              <div className="rounded-md border bg-background p-3">
                                <p className="text-xs text-muted-foreground">Desconto geral</p>
                                <p className="font-semibold">{formatDiscountLabel(sale.discountType, sale.discountValue)}</p>
                              </div>
                              <div className="rounded-md border bg-background p-3">
                                <p className="text-xs text-muted-foreground">Total líquido</p>
                                <p className="font-semibold text-primary">R$ {formatBRL(Number(sale.totalAmount))}</p>
                              </div>
                            </div>
                            <p className="text-xs font-semibold text-muted-foreground">Itens da venda:</p>
                            {sale.items.map((item) => (
                              <div key={item.id} className="rounded-md border bg-background px-3 py-2 text-sm">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="font-medium">{item.product?.name || "Produto removido"}</span>
                                  <span className="text-muted-foreground">
                                    {item.quantity}x R$ {formatBRL(Number(item.unitPrice))}
                                  </span>
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                  <span>Cupom: {item.couponName || "—"}</span>
                                  <span>Desconto: R$ {formatBRL(Number(item.couponDiscountAmount ?? 0))}</span>
                                  <span>Total do item: R$ {formatBRL(Math.max(0, getSaleItemSubtotal(item) - Number(item.couponDiscountAmount ?? 0)))}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {salesData?.monthSales.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Nenhuma venda no período selecionado.</td></tr>}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="logs" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Input placeholder="Buscar em logs..." value={logSearch} onChange={(e) => setLogSearch(e.target.value)} />
              <Select value={logAreaFilter} onValueChange={setLogAreaFilter}>
                <SelectTrigger><SelectValue placeholder="Área" /></SelectTrigger>
                <SelectContent>
                  {logAreas.map((area) => <SelectItem key={area} value={area}>{area}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={logActionFilter} onValueChange={setLogActionFilter}>
                <SelectTrigger><SelectValue placeholder="Ação" /></SelectTrigger>
                <SelectContent>
                  {logActions.map((action) => <SelectItem key={action} value={action}>{action}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={logUserFilter} onValueChange={setLogUserFilter}>
                <SelectTrigger><SelectValue placeholder="Usuário" /></SelectTrigger>
                <SelectContent>
                  {logUsers.map((user) => <SelectItem key={user} value={user}>{user}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={downloadLogsXlsx}><Download className="mr-2 h-4 w-4" />Baixar XLSX</Button>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Data e hora</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Área</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Ação</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Usuário</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Dados</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLogs.map((log) => (
                  <tr key={log.id} className="border-t align-top">
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatDateTime(log.createdAt)}</td>
                    <td className="px-4 py-3">{log.area}</td>
                    <td className="px-4 py-3 capitalize">{log.action}</td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <p className="font-medium">{log.actorUsername}</p>
                        <p className="text-xs text-muted-foreground">Sujeito: {log.subjectUsername || "—"}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <pre className="whitespace-pre-wrap break-words text-xs text-muted-foreground">{JSON.stringify(log.data ?? {}, null, 2)}</pre>
                    </td>
                  </tr>
                ))}
                {filteredLogs.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Nenhum log encontrado.</td></tr>}
              </tbody>
            </table>
          </div>

          {filteredLogs.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Mostrando {((Math.min(logPage, totalLogPages) - 1) * logPageSize) + 1} a {Math.min(Math.min(logPage, totalLogPages) * logPageSize, filteredLogs.length)} de {filteredLogs.length} logs
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={logPage <= 1} onClick={() => setLogPage((prev) => Math.max(1, prev - 1))}>Anterior</Button>
                <span className="text-sm text-muted-foreground">Página {Math.min(logPage, totalLogPages)} de {totalLogPages}</span>
                <Button variant="outline" size="sm" disabled={logPage >= totalLogPages} onClick={() => setLogPage((prev) => Math.min(totalLogPages, prev + 1))}>Próxima</Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}