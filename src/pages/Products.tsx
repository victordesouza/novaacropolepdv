import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, Camera, ArrowUpDown, Image as ImageIcon, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { formatBRL, maskBRL, parseBRL } from "@/lib/currency";

const CATEGORIES = ["Livraria", "Vestuário", "Velas", "Papelaria", "Brindes", "Outros"];

type SortKey = "name" | "price" | "stock_quantity" | "category";
type SortDir = "asc" | "desc";

interface ProductForm {
  name: string; barcode: string; description: string; category: string;
  price: string; cost_price: string; stock_quantity: string; is_book: boolean; author: string;
}

const emptyForm: ProductForm = {
  name: "", barcode: "", description: "", category: "Livraria",
  price: "", cost_price: "", stock_quantity: "", is_book: false, author: "",
};

export default function Products() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<any>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [form, setForm] = useState<ProductForm>({ ...emptyForm });

  const { data: products, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("*").order("name");
      return data ?? [];
    },
  });

  const sortedProducts = [...(products ?? [])].sort((a, b) => {
    const av = a[sortKey]; const bv = b[sortKey];
    if (typeof av === "string" && typeof bv === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
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
        { fps: 15, qrbox: { width: 300, height: 150 } },
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
    if (file) { setImageFile(file); setImagePreview(URL.createObjectURL(file)); }
  };

  const openCamera = async () => {
    setCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch {
      toast.error("Não foi possível acessar a câmera.");
      setCameraOpen(false);
    }
  };

  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `foto_${Date.now()}.jpg`, { type: "image/jpeg" });
        setImageFile(file);
        setImagePreview(URL.createObjectURL(file));
      }
      closeCamera();
    }, "image/jpeg", 0.85);
  }, []);

  const closeCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      let image_url: string | null = null;
      if (imageFile) {
        const ext = imageFile.name.split(".").pop();
        const path = `${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("product-images").upload(path, imageFile);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);
        image_url = urlData.publicUrl;
      }

      const payload: any = {
        name: form.name,
        barcode: form.barcode || null,
        description: form.description || null,
        category: form.category,
        price: parseBRL(form.price),
        cost_price: parseBRL(form.cost_price),
        stock_quantity: parseInt(form.stock_quantity) || 0,
        is_book: form.is_book,
        author: form.author || null,
      };
      if (image_url) payload.image_url = image_url;

      if (editingId) {
        const { error } = await supabase.from("products").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        if (!image_url) payload.image_url = null;
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Produto atualizado!" : "Produto cadastrado!");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      closeDialog();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Produto excluído!");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setDeleteId(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (product: any) => {
    setEditingId(product.id);
    setForm({
      name: product.name,
      barcode: product.barcode || "",
      description: product.description || "",
      category: product.category,
      price: formatBRL(Number(product.price)),
      cost_price: formatBRL(Number(product.cost_price)),
      stock_quantity: String(product.stock_quantity),
      is_book: product.is_book,
      author: product.author || "",
    });
    setImagePreview(product.image_url || null);
    setImageFile(null);
    setOpen(true);
  };

  const closeDialog = () => {
    setOpen(false);
    setEditingId(null);
    setForm({ ...emptyForm });
    setImageFile(null);
    setImagePreview(null);
    stopBarcodeScanner();
    closeCamera();
  };

  const SortButton = ({ label, field }: { label: string; field: SortKey }) => (
    <button onClick={() => toggleSort(field)} className="flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground">
      {label}<ArrowUpDown className={`h-3 w-3 ${sortKey === field ? "text-primary" : ""}`} />
    </button>
  );

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Produtos</h1>
        <Dialog open={open} onOpenChange={(v) => { if (!v) closeDialog(); else setOpen(true); }}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Novo Produto</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader><DialogTitle>{editingId ? "Editar Produto" : "Cadastrar Produto"}</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
              <div className="flex items-center gap-3">
                <Switch checked={form.is_book} onCheckedChange={(v) => setForm({ ...form, is_book: v })} />
                <Label>É um livro?</Label>
              </div>
              <div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>

              {form.is_book && (
                <div><Label>Autor</Label><Input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} placeholder="Nome do autor (opcional)" /></div>
              )}

              <div>
                <Label>Código de Barras</Label>
                <div className="flex gap-2">
                  <Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} placeholder="Digite ou escaneie" />
                  <Button type="button" variant="outline" size="icon" onClick={scanning ? stopBarcodeScanner : startBarcodeScanner}>
                    {scanning ? <X className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
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
                <div>
                  <Label>Preço (R$)</Label>
                  <Input value={form.price} onChange={(e) => setForm({ ...form, price: maskBRL(e.target.value) })} placeholder="0,00" inputMode="numeric" />
                </div>
                <div>
                  <Label>Custo (R$)</Label>
                  <Input value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: maskBRL(e.target.value) })} placeholder="0,00" inputMode="numeric" />
                </div>
              </div>
              <div><Label>Quantidade em Estoque</Label><Input type="number" value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })} /></div>

              <div>
                <Label>Imagem do Produto</Label>
                <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageSelect} />
                <div className="mt-1 flex items-center gap-2">
                  <Button type="button" variant="outline" onClick={() => galleryInputRef.current?.click()}>
                    <ImageIcon className="mr-2 h-4 w-4" />Galeria
                  </Button>
                  <Button type="button" variant="outline" onClick={() => cameraInputRef.current?.click()}>
                    <Camera className="mr-2 h-4 w-4" />Câmera
                  </Button>
                  {imagePreview && <img src={imagePreview} alt="Preview" className="h-16 w-16 rounded-lg border object-cover" />}
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Salvando..." : editingId ? "Salvar Alterações" : "Cadastrar"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(v) => { if (!v) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
                <th className="px-4 py-3 text-right">Ações</th>
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
                        <div className="flex h-10 w-10 items-center justify-center rounded border bg-muted"><ImageIcon className="h-4 w-4 text-muted-foreground" /></div>
                      )}
                      <div>
                        <span>{p.name}</span>
                        {p.is_book && <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">Livro</span>}
                        {p.author && <p className="text-xs text-muted-foreground">{p.author}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{p.category}</td>
                  <td className="px-4 py-3 text-right">R$ {formatBRL(Number(p.price))}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={p.stock_quantity <= 5 ? "font-semibold text-destructive" : ""}>{p.stock_quantity}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteId(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
              {sortedProducts.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Nenhum produto cadastrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </AppLayout>
  );
}
