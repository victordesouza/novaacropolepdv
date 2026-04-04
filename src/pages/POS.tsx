import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Camera, Search, Trash2, ShoppingCart, X } from "lucide-react";
import { toast } from "sonner";
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

  // Search products
  useEffect(() => {
    if (!search.trim()) { setResults([]); return; }
    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from("products")
        .select("*")
        .or(`name.ilike.%${search}%,barcode.eq.${search}`)
        .limit(10);
      setResults(data ?? []);
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock_quantity) {
          toast.error("Estoque insuficiente!");
          return prev;
        }
        return prev.map((i) => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      if (product.stock_quantity <= 0) {
        toast.error("Produto sem estoque!");
        return prev;
      }
      return [...prev, { product, quantity: 1 }];
    });
    setSearch("");
    setResults([]);
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
  };

  const total = cart.reduce((sum, i) => sum + Number(i.product.price) * i.quantity, 0);

  const finalizeMutation = useMutation({
    mutationFn: async () => {
      // Create sale
      const { data: sale, error: saleError } = await supabase
        .from("sales")
        .insert({ total_amount: total, payment_method: paymentMethod, customer_name: customerName || null })
        .select()
        .single();
      if (saleError) throw saleError;

      // Create sale items
      const items = cart.map((i) => ({
        sale_id: sale.id,
        product_id: i.product.id,
        quantity: i.quantity,
        unit_price: Number(i.product.price),
      }));
      const { error: itemsError } = await supabase.from("sale_items").insert(items);
      if (itemsError) throw itemsError;

      // Update stock
      for (const item of cart) {
        const { error } = await supabase
          .from("products")
          .update({ stock_quantity: item.product.stock_quantity - item.quantity })
          .eq("id", item.product.id);
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
    // Dynamic import to avoid SSR issues
    const { Html5Qrcode } = await import("html5-qrcode");
    const scanner = new Html5Qrcode(scannerContainerId);
    scannerRef.current = scanner;
    try {
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 150 } },
        async (decodedText) => {
          await scanner.stop();
          setScanning(false);
          const { data } = await supabase
            .from("products")
            .select("*")
            .eq("barcode", decodedText)
            .maybeSingle();
          if (data) {
            addToCart(data);
            toast.success(`Produto encontrado: ${data.name}`);
          } else {
            toast.error("Produto não encontrado para este código.");
          }
        },
        () => {}
      );
    } catch {
      toast.error("Não foi possível acessar a câmera.");
      setScanning(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch {}
    }
    setScanning(false);
  };

  return (
    <AppLayout>
      <h1 className="mb-6 text-2xl font-bold text-foreground">Ponto de Venda</h1>
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Search / Scanner */}
        <div className="space-y-4 lg:col-span-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-10"
                placeholder="Buscar por nome ou código de barras..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
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
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className="flex w-full items-center justify-between border-b p-3 text-left transition-colors last:border-0 hover:bg-muted"
                >
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-sm text-muted-foreground">{p.category} · Estoque: {p.stock_quantity}</p>
                  </div>
                  <span className="font-semibold text-primary">R$ {Number(p.price).toFixed(2)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Cart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Carrinho ({cart.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {cart.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground">Carrinho vazio</p>
            ) : (
              <div className="max-h-60 space-y-2 overflow-y-auto">
                {cart.map((item) => (
                  <div key={item.product.id} className="flex items-center justify-between rounded-lg border p-2">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.quantity}x R$ {Number(item.product.price).toFixed(2)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">
                        R$ {(Number(item.product.price) * item.quantity).toFixed(2)}
                      </span>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeFromCart(item.product.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t pt-4">
              <div className="mb-4 flex items-center justify-between text-lg font-bold">
                <span>Total</span>
                <span className="text-primary">R$ {total.toFixed(2)}</span>
              </div>
              <div className="space-y-3">
                <div>
                  <Label>Cliente</Label>
                  <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Nome do cliente (opcional)" />
                </div>
                <div>
                  <Label>Pagamento</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="PIX">PIX</SelectItem>
                      <SelectItem value="Cartão">Cartão</SelectItem>
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
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
