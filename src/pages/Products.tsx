import React, { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as firebaseProducts from "@/integrations/firebase/queries/products";
import * as firebaseStorageQueries from "@/integrations/firebase/queries/storage";
import * as firebaseImageSearch from "@/integrations/firebase/queries/imageSearch";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, Camera, ArrowUpDown, Image as ImageIcon, Pencil, Trash2, X, Search, Filter, ChevronLeft, ChevronRight, Wand2, Loader2, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { formatBRL, maskBRL, parseBRL } from "@/lib/currency";

const CATEGORIES = ["Livraria", "Vestuário", "Velas", "Papelaria", "Brindes", "Outros"];

type SortKey = "name" | "price" | "stockQuantity" | "category";
type SortDir = "asc" | "desc";

interface ProductForm {
  name: string; barcode: string; description: string; category: string;
  price: string; cost_price: string; stock_quantity: string; is_book: boolean; author: string;
}

const emptyForm: ProductForm = {
  name: "", barcode: "", description: "", category: "Livraria",
  price: "", cost_price: "", stock_quantity: "", is_book: false, author: "",
};

// Interface para as sugestões da API do Google Books
interface ApiBookSuggestion {
  title: string;
  author: string;
  thumbnail: string | null;
}

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
  const [bookFilter, setBookFilter] = useState<string>("all");
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

  // Novos estados para melhorias
  const [showStockWarning, setShowStockWarning] = useState(false);
  const [searchingImage, setSearchingImage] = useState(false);
  
  // Estados para o Autocomplete do Google Books
  const [bookSuggestions, setBookSuggestions] = useState<ApiBookSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearchingBooks, setIsSearchingBooks] = useState(false);
  const suggestionRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { data: allProducts, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      return await firebaseProducts.getProducts();
    },
  });

  // Aplicar filtros e busca
  const filteredProducts = (allProducts ?? []).filter(product => {
    const matchesSearch = searchTerm === "" ||
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.author && product.author.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCategory = categoryFilter === "all" || product.category === categoryFilter;

    const matchesBookFilter =
      bookFilter === "all" ||
      (bookFilter === "books" && product.is_book) ||
      (bookFilter === "non-books" && !product.is_book);

    return matchesSearch && matchesCategory && matchesBookFilter;
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    const av = a[sortKey]; const bv = b[sortKey];
    if (typeof av === "string" && typeof bv === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    return sortDir === "asc" ? Number(av) - Number(bv) : Number(bv) - Number(av);
  });

  const totalProducts = sortedProducts.length;
  const totalPages = Math.ceil(totalProducts / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedProducts = sortedProducts.slice(startIndex, startIndex + itemsPerPage);

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

  const handleSearchProductImage = async () => {
    if (!form.name.trim()) {
      toast.error("Digite o nome do produto primeiro");
      return;
    }

    setSearchingImage(true);
    try {
      const imageUrl = await firebaseImageSearch.searchProductImage(
        form.name,
        form.author,
        form.is_book,
        form.barcode
      );

      if (imageUrl) {
        setImagePreview(imageUrl);
        setImageFile(null); 
        toast.success("Imagem encontrada! Use o botão Salvar para confirmar");
      } else {
        toast.error("Nenhuma imagem encontrada. Tente com outro nome");
      }
    } catch (error) {
      toast.error("Erro ao buscar imagem");
    } finally {
      setSearchingImage(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      let imageUrl: string | null = null;

      if (imageFile) {
        imageUrl = await firebaseStorageQueries.uploadProductImage(imageFile);
      }
      else if (imagePreview && imagePreview.startsWith('http')) {
        imageUrl = imagePreview;
      }

      const payload: any = {
        name: form.name,
        barcode: form.barcode || null,
        description: form.description || null,
        category: form.category,
        price: parseBRL(form.price),
        costPrice: parseBRL(form.cost_price),
        stockQuantity: parseInt(form.stock_quantity) || 0,
        isBook: form.is_book,
        author: form.author || null,
      };
      if (imageUrl) payload.imageUrl = imageUrl;

      if (editingId) {
        await firebaseProducts.updateProduct(editingId, payload);
      } else {
        if (!imageUrl) payload.imageUrl = null;
        await firebaseProducts.createProduct(payload);
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Produto atualizado!" : "Produto cadastrado!");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      closeDialog();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleSaveProduct = () => {
    // 1. Validação do Preço de Venda
    const numericPrice = parseBRL(form.price);
    
    if (!numericPrice || numericPrice <= 0) {
      toast.error("O preço de venda deve ser maior que zero.");
      return; // Interrompe o salvamento aqui
    }

    // 2. Validação do Estoque
    const stockQty = parseInt(form.stock_quantity) || 0;

    // Se estoque é 0 e não está editando, mostrar warning
    if (stockQty === 0 && !editingId) {
      setShowStockWarning(true);
    } else {
      saveMutation.mutate();
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await firebaseProducts.deleteProduct(id);
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
      cost_price: formatBRL(Number(product.costPrice)),
      stock_quantity: String(product.stockQuantity),
      is_book: product.isBook,
      author: product.author || "",
    });
    setImagePreview(product.imageUrl || null);
    setImageFile(null);
    setOpen(true);
  };

  const closeDialog = () => {
    setOpen(false);
    setEditingId(null);
    setForm({ ...emptyForm });
    setImageFile(null);
    setImagePreview(null);
    setBookSuggestions([]);
    setShowSuggestions(false);
    stopBarcodeScanner();
    stopCamera();
  };


  // --- Função de busca de livros (Apple Books API - Dados perfeitos para o Brasil e sem limite chato) ---
  const fetchBookSuggestions = async (query: string) => {
    if (!query || query.length < 3) {
      setBookSuggestions([]);
      return;
    }

    setIsSearchingBooks(true);
    try {
      // Busca focada em e-books no catálogo do Brasil
      const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=ebook&country=BR&limit=10`);
      const data = await response.json();

      if (data.results && data.results.length > 0) {
        const results = data.results.map((item: any) => ({
          title: item.trackName || "Sem título",
          author: item.artistName || "",
          // A Apple manda a imagem pequena, esse replace aumenta a resolução dela
          thumbnail: item.artworkUrl100 ? item.artworkUrl100.replace('100x100bb', '200x200bb') : null,
        }));
        
        // Remove duplicatas baseadas no título
        const uniqueResults = Array.from(new Map(results.map((item: any) => [item.title, item])).values()) as ApiBookSuggestion[];
        
        setBookSuggestions(uniqueResults.slice(0, 6));
        setShowSuggestions(uniqueResults.length > 0);
      } else {
        setBookSuggestions([]);
      }
    } catch (error) {
      console.error("Erro ao buscar livros:", error);
      setBookSuggestions([]);
    } finally {
      setIsSearchingBooks(false);
    }
  };


  const handleBookNameChange = (name: string) => {
    setForm({ ...form, name });
    
    if (form.is_book) {
      // Debounce para não fazer requests excessivos ao Google API
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      
      if (name.length >= 3) {
        setShowSuggestions(true);
        searchTimeoutRef.current = setTimeout(() => {
          fetchBookSuggestions(name);
        }, 500); // Aguarda 500ms após o usuário parar de digitar
      } else {
        setBookSuggestions([]);
        setShowSuggestions(false);
      }
    }
  };

  const selectSuggestion = (s: ApiBookSuggestion) => {
    setForm({
      ...form,
      name: s.title,
      author: s.author, // Preenche o autor automaticamente!
    });
    
    // Se a API retornou imagem, já colocamos no preview
    if (s.thumbnail) {
      setImagePreview(s.thumbnail);
      setImageFile(null);
    }
    
    setShowSuggestions(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionRef.current && !suggestionRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
            <form onSubmit={(e) => { e.preventDefault(); handleSaveProduct(); }} className="space-y-4">
              
              <div className="flex items-center gap-3 bg-muted/50 p-3 rounded-lg border border-border/50">
                <Switch checked={form.is_book} onCheckedChange={(v) => setForm({ ...form, is_book: v })} />
                <Label className="flex items-center gap-2 cursor-pointer">
                  <BookOpen className="h-4 w-4 text-primary" />
                  Este produto é um livro
                </Label>
              </div>

              <div className="relative" ref={suggestionRef}>
                <Label>Nome do {form.is_book ? "Livro" : "Produto"} *</Label>
                <div className="relative">
                   <Input 
                    value={form.name} 
                    onChange={(e) => handleBookNameChange(e.target.value)} 
                    onFocus={() => form.is_book && form.name.length >= 3 && setShowSuggestions(true)}
                    placeholder={form.is_book ? "Ex: Meditações, Marco Aurélio..." : "Ex: Caneca personalizada"}
                    required 
                  />
                  {isSearchingBooks && form.is_book && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  )}
                </div>
               
                {showSuggestions && form.is_book && (
                  <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover p-1 shadow-lg">
                    {bookSuggestions.length > 0 ? (
                      bookSuggestions.map((s, i) => (
                        <button
                          key={i}
                          type="button"
                          className="flex w-full items-center gap-3 rounded-sm px-2 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                          onClick={() => selectSuggestion(s)}
                        >
                          {s.thumbnail ? (
                            <img src={s.thumbnail} alt="" className="h-10 w-8 object-cover rounded shadow-sm border" />
                          ) : (
                            <div className="h-10 w-8 bg-muted flex items-center justify-center rounded border"><BookOpen className="h-4 w-4 text-muted-foreground" /></div>
                          )}
                          <div className="overflow-hidden flex-1">
                            <p className="font-medium truncate">{s.title}</p>
                            <p className="text-xs text-muted-foreground truncate">{s.author || "Autor desconhecido"}</p>
                          </div>
                          <Plus className="h-4 w-4 text-muted-foreground opacity-50" />
                        </button>
                      ))
                    ) : (
                      !isSearchingBooks && form.name.length >= 3 && (
                        <div className="p-3 text-sm text-center text-muted-foreground">
                          Nenhum livro encontrado na busca online.
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>

              {form.is_book && (
                <div>
                  <Label>Autor</Label>
                  <Input 
                    value={form.author} 
                    onChange={(e) => setForm({ ...form, author: e.target.value })} 
                    placeholder="Nome do autor" 
                    className={bookSuggestions.length > 0 && form.author ? "border-primary/50 bg-primary/5" : ""}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Preenchido automaticamente ao selecionar uma sugestão acima.</p>
                </div>
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
                  <Label>Preço de Venda (R$)</Label>
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
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" onClick={() => galleryInputRef.current?.click()}>
                    <ImageIcon className="mr-2 h-4 w-4" />Galeria
                  </Button>
                  <Button type="button" variant="outline" onClick={cameraActive ? stopCamera : startCamera}>
                    <Camera className="mr-2 h-4 w-4" />
                    {cameraActive ? "Parar Câmera" : "Câmera"}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleSearchProductImage} disabled={searchingImage || !form.name.trim()}>
                    <Wand2 className="mr-2 h-4 w-4" />
                    {searchingImage ? "Buscando..." : "🔍 Buscar"}
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

      <AlertDialog open={showStockWarning} onOpenChange={setShowStockWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ Produto sem estoque</AlertDialogTitle>
            <AlertDialogDescription>
              Você está cadastrando um produto com estoque zerado. Produtos sem estoque não podem ser vendidos no PDV. Tem certeza que deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowStockWarning(false)}>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setShowStockWarning(false);
              saveMutation.mutate();
            }}>
              Cadastrar mesmo assim
            </AlertDialogAction>
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
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt={p.name} className="h-10 w-10 rounded border object-cover" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded border bg-muted"><ImageIcon className="h-4 w-4 text-muted-foreground" /></div>
                      )}
                      <div>
                        <span>{p.name}</span>
                        {p.isBook && <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">Livro</span>}
                        {p.author && <p className="text-xs text-muted-foreground">{p.author}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{p.category}</td>
                  <td className="px-4 py-3 text-right">R$ {formatBRL(Number(p.price))}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={p.stockQuantity <= 5 ? "font-semibold text-destructive" : ""}>{p.stockQuantity}</span>
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