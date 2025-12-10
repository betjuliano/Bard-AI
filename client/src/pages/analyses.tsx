import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  FileAudio,
  Plus,
  Search,
  Clock,
  Sparkles,
  LogOut,
  CreditCard,
  Trash2,
  MoreVertical,
  Brain,
} from "lucide-react";
import { Link } from "wouter";
import type { Analysis } from "@shared/schema";

export default function AnalysesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: analyses, isLoading } = useQuery<Analysis[]>({
    queryKey: ["/api/analyses"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/analyses/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Análise excluída" });
      queryClient.invalidateQueries({ queryKey: ["/api/analyses"] });
    },
    onError: () => {
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir a análise.",
        variant: "destructive",
      });
    },
  });

  const filteredAnalyses = analyses?.filter((a) =>
    a.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    const first = firstName?.charAt(0) || "";
    const last = lastName?.charAt(0) || "";
    return (first + last).toUpperCase() || "U";
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="default" className="bg-green-600">Concluído</Badge>;
      case "processing":
        return <Badge variant="secondary">Processando</Badge>;
      case "pending":
        return <Badge variant="outline">Pendente</Badge>;
      case "error":
        return <Badge variant="destructive">Erro</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <FileAudio className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold">IA Transcreve</span>
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              <Button variant="ghost" asChild>
                <Link href="/">Dashboard</Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link href="/transcricoes">Transcrições</Link>
              </Button>
              <Button variant="secondary" asChild>
                <Link href="/analises">Análises</Link>
              </Button>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/creditos">
              <Button variant="outline" size="sm" className="gap-2">
                <Sparkles className="h-4 w-4" />
                <span className="font-semibold">{user?.analysisCredits || 0}</span>
              </Button>
            </Link>
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={user?.profileImageUrl || undefined} className="object-cover" />
                    <AvatarFallback>{getInitials(user?.firstName, user?.lastName)}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{user?.firstName} {user?.lastName}</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/creditos" className="cursor-pointer">
                    <CreditCard className="mr-2 h-4 w-4" />
                    Meus Créditos
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <a href="/api/logout" className="cursor-pointer text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sair
                  </a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Análises Bardin</h1>
            <p className="text-muted-foreground">
              {analyses?.length || 0} análises qualitativas
            </p>
          </div>
          <Button asChild data-testid="button-new-analysis">
            <Link href="/analises/nova">
              <Plus className="mr-2 h-4 w-4" />
              Nova Análise
            </Link>
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar análises..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search"
          />
        </div>

        {isLoading ? (
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="flex items-center gap-4 pt-6">
                  <Skeleton className="h-12 w-12 rounded-md" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-1/3" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredAnalyses && filteredAnalyses.length > 0 ? (
          <div className="grid gap-4">
            {filteredAnalyses.map((analysis) => (
              <Card key={analysis.id} className="hover-elevate" data-testid={`card-analysis-${analysis.id}`}>
                <CardContent className="flex items-center gap-4 pt-6">
                  <div className="flex items-center justify-center h-12 w-12 rounded-md bg-muted flex-shrink-0">
                    <Brain className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <Link href={`/analises/${analysis.id}`} className="flex-1 min-w-0 cursor-pointer">
                    <div className="font-semibold truncate">{analysis.title}</div>
                    <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(analysis.createdAt)}
                      </span>
                      {analysis.theoreticalFrameworkFileName && (
                        <span>Ref: {analysis.theoreticalFrameworkFileName}</span>
                      )}
                    </div>
                  </Link>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {getStatusBadge(analysis.status)}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem
                              className="text-destructive"
                              onSelect={(e) => e.preventDefault()}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Excluir
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir análise?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação não pode ser desfeita. A análise "{analysis.title}" será permanentemente excluída.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMutation.mutate(analysis.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="text-center py-12">
              <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {searchQuery ? "Nenhuma análise encontrada" : "Nenhuma análise ainda"}
              </h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery
                  ? "Tente uma busca diferente"
                  : "Comece selecionando uma transcrição para analisar"}
              </p>
              {!searchQuery && (
                <Button asChild>
                  <Link href="/analises/nova">
                    <Plus className="mr-2 h-4 w-4" />
                    Nova Análise
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
