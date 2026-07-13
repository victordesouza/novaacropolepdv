import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpen, Search, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import * as firebaseProducts from "@/integrations/firebase/queries/products";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatBRL } from "@/lib/currency";
import logo from "@/assets/logo-nova-acropole.png";

export default function Catalogo() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(timeout);
  }, [search]);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["catalogo-products", debouncedSearch],
    queryFn: async () => {
      if (debouncedSearch) {
        return await firebaseProducts.searchProducts(debouncedSearch);
      }
      return await firebaseProducts.getProducts();
    },
  });

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(38,96,85,0.18),_transparent_35%),linear-gradient(180deg,#f7f5ef_0%,#f2eee6_100%)] text-foreground">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Nova Acrópole" className="h-11 w-auto" />
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Catálogo público</p>
            <h1 className="text-lg font-semibold">Nova Acrópole</h1>
          </div>
        </div>
        <Button asChild variant="outline">
          <Link to="/login">Entrar</Link>
        </Button>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-3xl border border-white/60 bg-white/80 shadow-[0_20px_80px_rgba(24,39,31,0.08)] backdrop-blur">
          <div className="grid gap-8 p-6 lg:grid-cols-[1.2fr_0.8fr] lg:p-10">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
                <Sparkles className="h-3.5 w-3.5" />
                Espaço aberto para consulta
              </div>
              <div className="space-y-3">
                <h2 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
                  Explore o catálogo da Nova Acrópole com uma navegação limpa e silenciosa.
                </h2>
                <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
                  Busque livros e produtos disponíveis sem precisar entrar no sistema. Esta área é pública, sem estoque visível e sem edição.
                </p>
              </div>

              <div className="relative max-w-2xl">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Pesquisar por nome, autor, código ou categoria..."
                  className="h-14 rounded-2xl border-white/80 bg-white pl-11 text-base shadow-sm"
                />
              </div>
            </div>

            <Card className="border-0 bg-emerald-950 text-white shadow-none">
              <CardContent className="flex h-full flex-col justify-between p-6 sm:p-8">
                <div className="space-y-3">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
                    <BookOpen className="h-6 w-6" />
                  </div>
                  <p className="text-sm uppercase tracking-[0.25em] text-emerald-200">Acesso público</p>
                  <h3 className="text-2xl font-semibold">Consulta rápida ao acervo</h3>
                  <p className="text-sm leading-6 text-emerald-100/90">
                    Encontre materiais com uma experiência pensada para visitantes, sem painel administrativo e sem indicadores internos.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">{isLoading ? "Carregando..." : `${products.length} resultado(s)`}</p>
              <h3 className="text-xl font-semibold">Catálogo</h3>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {products.map((product) => (
              <Card key={product.id} className="overflow-hidden border-white/70 bg-white/85 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
                <CardContent className="space-y-4 p-4">
                  <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-muted/60">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground">
                        <BookOpen className="h-10 w-10" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h4 className="text-lg font-semibold leading-tight">{product.name}</h4>
                        <p className="text-sm text-muted-foreground">{product.category}</p>
                      </div>
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-800">
                        R$ {formatBRL(Number(product.price))}
                      </span>
                    </div>
                    {product.author && <p className="text-sm text-muted-foreground">Autor: {product.author}</p>}
                    {product.description && <p className="line-clamp-3 text-sm text-muted-foreground">{product.description}</p>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {!isLoading && products.length === 0 && (
            <div className="rounded-2xl border border-dashed bg-white/70 p-10 text-center text-muted-foreground">
              Nenhum produto encontrado para essa busca.
            </div>
          )}
        </section>
      </main>
    </div>
  );
}