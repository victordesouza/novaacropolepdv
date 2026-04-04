import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, Camera, ArrowUpDown, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = ["Livraria", "Vestuário", "Velas", "Papelaria", "Brindes", "Outros"];

type SortKey = "name" | "price" | "stock_quantity" | "category";
type SortDir = "asc" | "desc";

export default function Products() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

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

  const sortedProducts = [...(products ?? [])].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (typeof av === "string" && typeof bv === "string") {
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    return sortDir === "asc" ? Number(av) - Number(bv) : Number(bv) - Number(av);
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const startBarcodeScanner = async () => {
    setScanning(true);
    const { Html5Qrcode } = await import("html5-qrcode");
    const scanner = new Html5Qrcode("product-barcode-scanner");
    scannerRef.current = scanner;
    try {
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 150 } },
        async (decodedText) => {
          await scanner.stop();
          setScanning(false);
          setForm(f => ({ ...f, barcode: decodedText }));
          toast.success("Código lido: " + decodedText);
        },
        () => {}
      );
    } catch {
      toast.error("Não foi possível acessar a câmera.");
      setScanning(false);
    }
  };

  const stopBarcodeScanner = async () => {
    if (scannerRef.current) { try { await scannerRef.current.stop(); } catch {} }
    setScanning(false);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      let image_url: string | null = null;

      if (imageFile) {
        const ext = imageFile.name.split(".").pop();
        const path = `${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("product-images")
          .upload(path, imageFile);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage
          .from("product-images")
          .getPublicUrl(path);
        image_url = urlData.publicUrl;
      }

      const { error } = await supabase.from("products").insert({
        name: form.name,
        barcode: form.barcode || null,
        description: form.description || null,
        category: form.category,
        price: parseFloat(form.price) || 0,
        cost_price: parseFloat(form.cost_price) || 0,
        stock_quantity: parseInt(form.stock_quantity) || 0,
        is_book: form.is_book,
        image_url,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Produto cadastrado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setOpen(false);
      resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resetForm = () => {
    setForm({ name: "", barcode: "", description: "", category: "Livraria", price: "", cost_price: "", stock_quantity: "", is_book: false });
    setImageFile(null);
    setImagePreview(null);
  };

  const SortButton = ({ label, field }: { label: string; field: SortKey }) => (
    <button onClick={() => toggleSort(field)} className="flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground">
      {label}
      <ArrowUpDown className={`h-3 w-3 ${sortKey === field ? "text-primary" : ""}`} />
    </button>
  );

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Produtos</h1>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { resetForm(); stopBarcodeScanner(); } }}>
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

              {/* Barcode with camera option */}
              <div>
                <Label>Código de Barras</Label>
                <div className="flex gap-2">
                  <Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} placeholder="Digite ou escaneie" />
                  <Button type="button" variant="outline" size="icon" onClick={scanning ? stopBarcodeScanner : startBarcodeScanner}>
                    <Camera className="h-4 w-4" />
                  </Button>
                </div>
                {scanning && (
                  <div className="mt-2 overflow-hidden rounded-lg border">
                    <div id="product-barcode-scanner" className="w-full" />
                  </div>
                )}
              </div>

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

              {/* Image upload */}
              <div>
                <Label>Imagem do Produto</Label>
                <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageSelect} />
                <div className="mt-1 flex items-center gap-3">
                  <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                    <ImageIcon className="mr-2 h-4 w-4" />
                    {imageFile ? "Trocar imagem" : "Selecionar imagem"}
                  </Button>
                  {imagePreview && (
                    <img src={imagePreview} alt="Preview" className="h-16 w-16 rounded-lg border object-cover" />
                  )}
                </div>
              </div>

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
                <th className="px-4 py-3 text-left"><SortButton label="Nome" field="name" /></th>
                <th className="hidden px-4 py-3 text-left md:table-cell"><SortButton label="Categoria" field="category" /></th>
                <th className="px-4 py-3 text-right"><SortButton label="Preço" field="price" /></th>
                <th className="px-4 py-3 text-right"><SortButton label="Estoque" field="stock_quantity" /></th>
              </tr>
            </thead>
            <tbody>
              {sortedProducts.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="px-4 py-3 font-medium">
                    <div className="flex items-center gap-3">
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="h-10 w-10 rounded border object-cover" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded border bg-muted">
                          <ImageIcon className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        {p.name}
                        {p.is_book && <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">Livro</span>}
                      </div>
                    </div>
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
              {sortedProducts.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Nenhum produto cadastrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </AppLayout>
  );
}
