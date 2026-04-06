import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Camera, Search, Trash2, ShoppingCart, X, Plus, Minus, Package } from "lucide-react";
import { toast } from "sonner";
import { formatBRL } from "@/lib/currency";
import type { Database } from "@/integrations/supabase/types";

type Product = Database["public"]["Tables"]["products"]["Row"];
type CartItem = { product: Product; quantity: number };

export default function POS() {
  const queryClient = useQueryClient();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Dinheiro");
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<any>(null);
  const scannerContainerId = "barcode-scanner";

  useEffect(() => {
    if (!search.trim()) { setResults([]); return; }
    const timeout = setTimeout(async () => {
      const term = search.trim();
      const { data } = await supabase
        .from("products")
        .select("*")
        .or(`name.ilike.%${term}%,barcode.eq.${term},author.ilike.%${term}%`)
        .limit(10);
      setResults(data ?? []);
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock_quantity) { toast.error("Estoque insuficiente!"); return prev; }
        return prev.map((i) => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      if (product.stock_quantity <= 0) { toast.error("Produto sem estoque!"); return prev; }
      return [...prev, { product, quantity: 1 }];
    });
    setSearch("");
    setResults([]);
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) => prev.map((i) => {
      if (i.product.id !== productId) return i;
      const newQty = i.quantity + delta;
      if (newQty <= 0) return i;
      if (newQty > i.product.stock_quantity) { toast.error("Estoque insuficiente!"); return i; }
      return { ...i, quantity: newQty };
    }));
  };

  const removeFromCart = (productId: string) => setCart((prev) => prev.filter((i) => i.product.id !== productId));

  const total = cart.reduce((sum, i) => sum + Number(i.product.price) * i.quantity, 0);

  const finalizeMutation = useMutation({
    mutationFn: async () => {
      const { data: sale, error: saleError } = await supabase
        .from("sales")
        .insert({ total_amount: total, payment_method: paymentMethod, customer_name: customerName || null })
        .select().single();
      if (saleError) throw saleError;

      const items = cart.map((i) => ({ sale_id: sale.id, product_id: i.product.id, quantity: i.quantity, unit_price: Number(i.product.price) }));
      const { error: itemsError } = await supabase.from("sale_items").insert(items);
      if (itemsError) throw itemsError;

      for (const item of cart) {
        const { error } = await supabase.from("products").update({ stock_quantity: item.product.stock_quantity - item.quantity }).eq("id", item.product.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Venda finalizada com sucesso!");
      setCart([]);
      setCustomerName("");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["today-sales"] });
      queryClient.invalidateQueries({ queryKey: ["today-sales-count"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-sales"] });
      queryClient.invalidateQueries({ queryKey: ["low-stock"] });
    },
    onError: (e: any) => toast.error("Erro ao finalizar: " + e.message),
  });

  const startScanner = async () => {
    setScanning(true);
    const { Html5Qrcode } = await import("html5-qrcode");
    const scanner = new Html5Qrcode(scannerContainerId);
    scannerRef.current = scanner;
    try {
      await scanner.start(
        { facingMode: "environment" },
        { fps: 15, qrbox: { width: 300, height: 150 } },
        async (decodedText) => {
          await scanner.stop();
          setScanning(false);
          const { data } = await supabase.from("products").select("*").eq("barcode", decodedText).maybeSingle();
          if (data) { addToCart(data); toast.success(`Produto encontrado: ${data.name}`); }
          else toast.error("Produto não encontrado para este código.");
        },
        () => {}
      );
    } catch {
      toast.error("Não foi possível acessar a câmera.");
      setScanning(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) { try { await scannerRef.current.stop(); } catch {} }
    setScanning(false);
  };

  return (
    <AppLayout>
      <h1 className="mb-6 text-2xl font-bold text-foreground">Ponto de Venda</h1>

      {/* Seção de Busca - Topo */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Buscar Produtos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-10" placeholder="Buscar por nome, código ou autor..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Button variant="outline" onClick={scanning ? stopScanner : startScanner}>
              {scanning ? <X className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
            </Button>
          </div>

          {scanning && (
            <div className="overflow-hidden rounded-lg border">
              <div id={scannerContainerId} className="w-full" />
            </div>
          )}

          {results.length > 0 && (
            <div className="rounded-lg border">
              {results.map((p) => (
                <button key={p.id} onClick={() => addToCart(p)} className="flex w-full items-center gap-3 border-b p-3 text-left transition-colors last:border-0 hover:bg-muted">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="h-12 w-12 rounded border object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded border bg-muted">
                      <Package className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-medium">{p.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {p.category} · Estoque: {p.stock_quantity}
                      {p.author && ` · ${p.author}`}
                    </p>
                  </div>
                  <span className="font-semibold text-primary">R$ {formatBRL(Number(p.price))}</span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Carrinho - Embaixo, maior */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Carrinho de Compras ({cart.length} {cart.length === 1 ? 'item' : 'itens'})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {cart.length === 0 ? (
            <div className="py-8 text-center">
              <ShoppingCart className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">Carrinho vazio</p>
              <p className="text-xs text-muted-foreground">Use a busca acima para adicionar produtos</p>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Lista de produtos do carrinho */}
              <div className="space-y-3 lg:col-span-2">
                {cart.map((item) => (
                  <div key={item.product.id} className="flex items-center gap-4 rounded-lg border p-4">
                    {item.product.image_url ? (
                      <img src={item.product.image_url} alt={item.product.name} className="h-16 w-16 rounded border object-cover" />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded border bg-muted">
                        <Package className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{item.product.name}</p>
                      {item.product.author && (
                        <p className="text-sm text-muted-foreground">{item.product.author}</p>
                      )}
                      <p className="text-sm text-muted-foreground">
                        R$ {formatBRL(Number(item.product.price))} por unidade
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.product.id, -1)}>
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-12 text-center font-semibold">{item.quantity}</span>
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.product.id, 1)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">R$ {formatBRL(Number(item.product.price) * item.quantity)}</p>
                      <Button variant="ghost" size="sm" onClick={() => removeFromCart(item.product.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Resumo e finalização */}
              <div className="space-y-4 lg:col-span-1">
                <div className="rounded-lg bg-muted/50 p-4">
                  <div className="mb-4 flex items-center justify-between text-2xl font-bold">
                    <span>Total</span>
                    <span className="text-primary">R$ {formatBRL(total)}</span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <Label>Cliente</Label>
                      <Input
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Nome do cliente (opcional)"
                      />
                    </div>

                    <div>
                      <Label>Forma de Pagamento</Label>
                      <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Dinheiro">💵 Dinheiro</SelectItem>
                          <SelectItem value="PIX">📱 PIX</SelectItem>
                          <SelectItem value="Cartão">💳 Cartão</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      className="w-full"
                      size="lg"
                      disabled={cart.length === 0 || finalizeMutation.isPending}
                      onClick={() => finalizeMutation.mutate()}
                    >
                      {finalizeMutation.isPending ? "Finalizando..." : "Finalizar Venda"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}
