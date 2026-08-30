import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as firebaseProducts from "@/integrations/firebase/queries/products";
import * as firebaseSales from "@/integrations/firebase/queries/sales";
import * as firebaseUsers from "@/integrations/firebase/queries/users";
import * as firebaseCoupons from "@/integrations/firebase/queries/coupons";
import { auditLogs } from "@/integrations/firebase";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Camera, Search, Trash2, ShoppingCart, X, Plus, Minus, Package } from "lucide-react";
import { toast } from "sonner";
import { formatBRL } from "@/lib/currency";
import type { Coupon, Product } from "@/integrations/firebase/types";
import { useAuth } from "@/hooks/useAuth";
import { getStoredCurrentUser } from "@/lib/auth";
import { buildSalePayload, getDiscountAmount, type DiscountMode } from "@/lib/checkout";

type CartItem = { product: Product; quantity: number; couponId: string | null };

function getCouponDiscountAmount(coupon: Coupon | undefined, amount: number) {
  if (!coupon) return 0;
  const discount = coupon.discountType === "percent" ? (amount * coupon.discountValue) / 100 : coupon.discountValue;
  return Math.min(Math.max(discount, 0), amount);
}

export default function POS() {
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();
  const actor = currentUser ?? getStoredCurrentUser();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Dinheiro");
  const [sellerUserId, setSellerUserId] = useState("");
  const [saleDiscountMode, setSaleDiscountMode] = useState<DiscountMode>("none");
  const [saleDiscountValue, setSaleDiscountValue] = useState("0");
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<any>(null);
  const scannerContainerId = "barcode-scanner";

  const { data: users = [] } = useQuery({
    queryKey: ["pos-users"],
    queryFn: async () => await firebaseUsers.getUsers(),
  });

  const { data: coupons = [] } = useQuery({
    queryKey: ["pos-coupons"],
    queryFn: async () => await firebaseCoupons.getCoupons(),
  });

  const validCoupons = coupons.filter((coupon) => {
    if (coupon.status !== "active") return false;
    const today = new Date();
    const start = new Date(`${coupon.startDate}T00:00:00`);
    const end = new Date(`${coupon.endDate}T23:59:59`);
    return today >= start && today <= end;
  });

  useEffect(() => {
    if (!sellerUserId && currentUser?.id) {
      setSellerUserId(currentUser.id);
    }
  }, [currentUser?.id, sellerUserId]);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!search.trim()) { setResults([]); return; }
    const timeout = setTimeout(async () => {
      const term = search.trim();
      const data = await firebaseProducts.searchProducts(term);
      setResults(data);
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stockQuantity && product.stockQuantity > 0) {
          toast.error("Estoque insuficiente!");
          return prev;
        }
        return prev.map((i) => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      if (product.stockQuantity < 0 && product.stockQuantity === 0) {
        // no-op: products may be registered with zero stock and still be sold.
      }
      return [...prev, { product, quantity: 1, couponId: null }];
    });
    setSearch("");
    setResults([]);
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) => prev.map((i) => {
      if (i.product.id !== productId) return i;
      const newQty = i.quantity + delta;
      if (newQty <= 0) return i;
      if (i.product.stockQuantity > 0 && newQty > i.product.stockQuantity) {
        toast.error("Estoque insuficiente!");
        return i;
      }
      return { ...i, quantity: newQty };
    }));
  };

  const removeFromCart = (productId: string) => setCart((prev) => prev.filter((i) => i.product.id !== productId));

  const getItemSubtotal = (item: CartItem) => Number(item.product.price) * item.quantity;
  const getItemCoupon = (item: CartItem) => validCoupons.find((coupon) => coupon.id === item.couponId);
  const getItemDiscount = (item: CartItem) => getCouponDiscountAmount(getItemCoupon(item), getItemSubtotal(item));
  const getItemTotal = (item: CartItem) => Math.max(0, getItemSubtotal(item) - getItemDiscount(item));
  const subtotalAfterCoupons = cart.reduce((sum, item) => sum + getItemTotal(item), 0);
  const normalizedSaleDiscountValue = Math.max(0, Number(saleDiscountValue) || 0);
  const saleDiscountAmount = getDiscountAmount({
    mode: saleDiscountMode,
    subtotal: subtotalAfterCoupons,
    value: normalizedSaleDiscountValue,
  });
  const total = Math.max(0, subtotalAfterCoupons - saleDiscountAmount);

  const finalizeMutation = useMutation({
    mutationFn: async () => {
      if (!sellerUserId && !currentUser?.id) {
        throw new Error("Selecione um vendedor para finalizar a venda.");
      }

      const finalSellerId = sellerUserId || currentUser?.id || "";
      const finalSeller = users.find((user) => user.id === finalSellerId);

      const items = cart.map((i) => ({
        productId: i.product.id,
        quantity: i.quantity,
        unitPrice: Number(i.product.price),
        couponId: i.couponId,
        couponName: getItemCoupon(i)?.name ?? null,
        couponDiscountType: getItemCoupon(i)?.discountType ?? null,
        couponDiscountValue: getItemCoupon(i)?.discountValue ?? null,
        couponDiscountAmount: getItemDiscount(i),
      }));

      const stockUpdates = cart.map((i) => ({
        productId: i.product.id,
        newQuantity: i.product.stockQuantity - i.quantity,
      }));

      if (cart.length === 0) {
        throw new Error("Adicione pelo menos um produto antes de finalizar.");
      }

      const salePayload = buildSalePayload({
        paymentMethod,
        customerName: customerName || null,
        sellerUserId: finalSellerId,
        sellerUsername: finalSeller?.username || currentUser?.username,
        discountType: saleDiscountMode === "none" ? undefined : saleDiscountMode,
        discountValue: normalizedSaleDiscountValue,
        discountAmount: saleDiscountAmount,
      });

      await firebaseSales.createSaleWithItems(
        {
          ...salePayload,
          totalAmount: total,
        },
        items,
        stockUpdates
      );

      if (actor) {
        await auditLogs.recordAuditLog({
          actorUserId: actor.id,
          actorUsername: actor.username,
          actorRole: actor.role,
          subjectUserId: finalSellerId,
          subjectUsername: finalSeller?.username || currentUser?.username,
          area: "PDV",
          action: "complete",
          data: {
            totalAmount: total,
            paymentMethod,
            customerName: customerName || null,
            items,
          },
        }).catch((error) => console.error("Erro ao gravar log de venda:", error));
      }
    },
    onSuccess: () => {
      toast.success("Venda finalizada com sucesso!");
      setCart([]);
      setCustomerName("");
      setSaleDiscountMode("none");
      setSaleDiscountValue("0");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["today-sales"] });
      queryClient.invalidateQueries({ queryKey: ["today-sales-count"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-sales"] });
      queryClient.invalidateQueries({ queryKey: ["low-stock"] });
      setSellerUserId(actor?.id ?? "");
    },
    onError: (e: any) => toast.error("Erro ao finalizar: " + e.message),
  });

  const startScanner = async () => {
    setScanning(true);
    // Importamos os formatos suportados
    const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
    
    // Filtro agressivo para a IA focar só em códigos de barras de produtos/livros
    const formatsToSupport = [
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.EAN_8,
      Html5QrcodeSupportedFormats.UPC_A,
      Html5QrcodeSupportedFormats.UPC_E,
    ];

    const scanner = new Html5Qrcode(scannerContainerId, { verbose: false, formatsToSupport });
    scannerRef.current = scanner;
    
    try {
      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 15,
          disableFlip: true, // Poupa processamento do celular
          qrbox: { width: 280, height: 120 }, // Caixa espremida horizontalmente
          videoConstraints: {
            facingMode: "environment",
            // O HACK DO ZOOM E FOCO CONTÍNUO
            advanced: [{ zoom: 2.5 }, { focusMode: "continuous" }] as any
          }
        },
        async (decodedText) => {
          // Quando ele acha o código, ele para a câmera na hora
          await scanner.stop();
          setScanning(false);
          
          // Lógica do seu PDV: Vai no banco e tenta achar o produto
          const data = await firebaseProducts.getProductByBarcode(decodedText);
          
          if (data) { 
            addToCart(data); 
            toast.success(`Produto encontrado: ${data.name}`); 
          } else {
            toast.error("Produto não encontrado para este código.");
          }
        },
        () => {
          // Deixamos vazio para não poluir a memória do celular com logs de "procurando..."
        }
      );
    } catch (error) {
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
              <Input ref={searchInputRef} className="pl-10" placeholder="Buscar por nome, código ou autor..." value={search} onChange={(e) => setSearch(e.target.value)} />
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
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.name} className="h-12 w-12 rounded border object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded border bg-muted">
                      <Package className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-medium">{p.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {p.category} · Estoque: {p.stockQuantity}
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
            <div className="space-y-6">
              <div className="space-y-3">
                {cart.map((item) => (
                  <div key={item.product.id} className="flex items-center gap-4 rounded-lg border p-4">
                    {item.product.imageUrl ? (
                      <img src={item.product.imageUrl} alt={item.product.name} className="h-16 w-16 rounded border object-cover" />
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
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.product.id, -1)}>
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-12 text-center font-semibold">{item.quantity}</span>
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.product.id, 1)}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <Select value={item.couponId ?? "none"} onValueChange={(value) => setCart((prev) => prev.map((current) => current.product.id === item.product.id ? { ...current, couponId: value === "none" ? null : value } : current))}>
                        <SelectTrigger className="w-52">
                          <SelectValue placeholder="Cupom no item" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sem cupom</SelectItem>
                          {validCoupons.map((coupon) => (
                            <SelectItem key={coupon.id} value={coupon.id}>
                              {coupon.name} ({coupon.discountType === "percent" ? `${coupon.discountValue}%` : `R$ ${coupon.discountValue.toFixed(2)}`})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">R$ {formatBRL(getItemTotal(item))}</p>
                      {getItemDiscount(item) > 0 && (
                        <p className="text-xs text-muted-foreground">desconto R$ {formatBRL(getItemDiscount(item))}</p>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => removeFromCart(item.product.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-lg bg-muted/50 p-4">
                <div className="mb-4 flex items-center justify-between text-2xl font-bold">
                  <span>Total</span>
                  <span className="text-primary">R$ {formatBRL(total)}</span>
                </div>

                <div className="mb-4 rounded-lg border bg-background p-3 text-sm text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span>Subtotal com cupons</span>
                    <span>R$ {formatBRL(subtotalAfterCoupons)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span>Desconto total</span>
                    <span>R$ {formatBRL(saleDiscountAmount)}</span>
                  </div>
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
                        <SelectItem value="Crédito">💳 Crédito</SelectItem>
                        <SelectItem value="Débito">💳 Débito</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label>Desconto total</Label>
                      <Select value={saleDiscountMode} onValueChange={(value) => setSaleDiscountMode(value as DiscountMode)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Sem desconto" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sem desconto</SelectItem>
                          <SelectItem value="percent">%</SelectItem>
                          <SelectItem value="currency">R$</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Valor do desconto</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={saleDiscountValue}
                        onChange={(e) => setSaleDiscountValue(e.target.value)}
                        disabled={saleDiscountMode === "none"}
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Vendedor *</Label>
                    <Select value={sellerUserId} onValueChange={setSellerUserId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o vendedor" />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.username} ({user.role})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    className="w-full"
                    size="lg"
                    disabled={cart.length === 0 || finalizeMutation.isPending || !sellerUserId}
                    onClick={() => finalizeMutation.mutate()}
                  >
                    {finalizeMutation.isPending ? "Finalizando..." : "Finalizar Venda"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}
