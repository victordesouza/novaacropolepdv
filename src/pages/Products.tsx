import React, { useState, useRef } from "react";
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
import { Plus, Camera, ArrowUpDown, Image as ImageIcon, Pencil, Trash2, X, Search, Filter, ChevronLeft, ChevronRight } from "lucide-react";
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
  const [cameraActive, setCameraActive] = useState(false);

  // Estados para filtros e paginação
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [bookFilter, setBookFilter] = useState<string>("all"); // "all", "books", "non-books"
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(12);

  const scannerRef = useRef<any>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm>({ ...emptyForm });

  const { data: allProducts, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("*").order("name");
      return data ?? [];
    },
  });

  // Aplicar filtros e busca
  const filteredProducts = (allProducts ?? []).filter(product => {
    // Filtro de busca (nome ou autor)
    const matchesSearch = searchTerm === "" ||
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.author && product.author.toLowerCase().includes(searchTerm.toLowerCase()));

    // Filtro de categoria
    const matchesCategory = categoryFilter === "all" || product.category === categoryFilter;

    // Filtro de tipo (livro ou não)
    const matchesBookFilter =
      bookFilter === "all" ||
      (bookFilter === "books" && product.is_book) ||
      (bookFilter === "non-books" && !product.is_book);

    return matchesSearch && matchesCategory && matchesBookFilter;
  });

  // Aplicar ordenação
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    const av = a[sortKey]; const bv = b[sortKey];
    if (typeof av === "string" && typeof bv === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    return sortDir === "asc" ? Number(av) - Number(bv) : Number(bv) - Number(av);
  });

  // Paginação
  const totalProducts = sortedProducts.length;
  const totalPages = Math.ceil(totalProducts / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedProducts = sortedProducts.slice(startIndex, startIndex + itemsPerPage);

  // Reset página quando filtros mudam
  const resetToFirstPage = () => setCurrentPage(1);

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

  const startCamera = async () => {
    try {
      setCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });
      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (error) {
      toast.error("Não foi possível acessar a câmera.");
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(track => track.stop());
      cameraStreamRef.current = null;
    }
    setCameraActive(false);
  };

  const takePicture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      if (context) {
        context.drawImage(video, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
            stopCamera();
            toast.success("Foto capturada!");
          }
        }, 'image/jpeg', 0.8);
      }
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setImageFile(file); setImagePreview(URL.createObjectURL(file)); }
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
    stopCamera();
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
                <div className="mt-1 flex items-center gap-2">
                  <Button type="button" variant="outline" onClick={() => galleryInputRef.current?.click()}>
                    <ImageIcon className="mr-2 h-4 w-4" />Galeria
                  </Button>
                  <Button type="button" variant="outline" onClick={cameraActive ? stopCamera : startCamera}>
                    <Camera className="mr-2 h-4 w-4" />
                    {cameraActive ? "Parar Câmera" : "Câmera"}
                  </Button>
                  {imagePreview && <img src={imagePreview} alt="Preview" className="h-16 w-16 rounded-lg border object-cover" />}
                </div>

                {cameraActive && (
                  <div className="mt-4 space-y-2">
                    <div className="relative overflow-hidden rounded-lg border">
                      <video
                        ref={videoRef}
                        className="w-full max-h-64 object-cover"
                        playsInline
                        muted
                      />
                      <Button
                        type="button"
                        onClick={takePicture}
                        className="absolute bottom-2 left-1/2 transform -translate-x-1/2"
                        size="lg"
                      >
                        📷 Tirar Foto
                      </Button>
                    </div>
                    <canvas ref={canvasRef} className="hidden" />
                  </div>
                )}
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

      {/* Filtros e Busca */}
      <div className="mb-6 rounded-lg border bg-card p-4">
        <div className="mb-4 flex items-center gap-2">
          <Filter className="h-4 w-4" />
          <h2 className="font-semibold">Filtros e Busca</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          {/* Busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-10"
              placeholder="Buscar por nome ou autor..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                resetToFirstPage();
              }}
            />
          </div>

          {/* Filtro de Categoria */}
          <Select value={categoryFilter} onValueChange={(value) => {
            setCategoryFilter(value);
            resetToFirstPage();
          }}>
            <SelectTrigger>
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {CATEGORIES.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Filtro de Tipo */}
          <Select value={bookFilter} onValueChange={(value) => {
            setBookFilter(value);
            resetToFirstPage();
          }}>
            <SelectTrigger>
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="books">📚 Apenas livros</SelectItem>
              <SelectItem value="non-books">📦 Produtos gerais</SelectItem>
            </SelectContent>
          </Select>

          {/* Info e Reset */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {totalProducts} produto{totalProducts !== 1 ? 's' : ''} encontrado{totalProducts !== 1 ? 's' : ''}
            </span>
            {(searchTerm || categoryFilter !== "all" || bookFilter !== "all") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchTerm("");
                  setCategoryFilter("all");
                  setBookFilter("all");
                  resetToFirstPage();
                }}
              >
                Limpar
              </Button>
            )}
          </div>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : (
        <>
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
                {paginatedProducts.map((p) => (
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
              {paginatedProducts.length === 0 && totalProducts === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Nenhum produto encontrado.</td></tr>
              )}
              {paginatedProducts.length === 0 && totalProducts > 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Nenhum produto encontrado com os filtros aplicados.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Mostrando {startIndex + 1} a {Math.min(startIndex + itemsPerPage, totalProducts)} de {totalProducts} produtos
            </p>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </Button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(page =>
                    page === 1 ||
                    page === totalPages ||
                    (page >= currentPage - 1 && page <= currentPage + 1)
                  )
                  .map((page, index, arr) => (
                    <React.Fragment key={page}>
                      {index > 0 && arr[index - 1] !== page - 1 && (
                        <span className="px-2 text-muted-foreground">...</span>
                      )}
                      <Button
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        className="w-8 h-8"
                        onClick={() => setCurrentPage(page)}
                      >
                        {page}
                      </Button>
                    </React.Fragment>
                  ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
              >
                Próxima
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
        </>
      )}
    </AppLayout>
  );
}