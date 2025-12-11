import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  FileAudio,
  ArrowLeft,
  Sparkles,
  LogOut,
  CreditCard,
  Check,
  FileText,
  Brain,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { Link } from "wouter";
import type { Payment } from "@shared/schema";

export default function CreditsPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: payments, isLoading: loadingPayments } = useQuery<Payment[]>({
    queryKey: ["/api/payments"],
  });

  const purchaseMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/checkout/create", {});
      return response.json();
    },
    onSuccess: (data: any) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Erro no pagamento",
        description: error.message,
        variant: "destructive",
      });
    },
  });

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

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="default" className="bg-green-600">Concluído</Badge>;
      case "pending":
        return <Badge variant="outline">Pendente</Badge>;
      case "failed":
        return <Badge variant="destructive">Falhou</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <Link href="/" className="flex items-center gap-2">
              <FileAudio className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold hidden sm:inline">IA Transcreve</span>
            </Link>
          </div>
          <div className="flex items-center gap-4">
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

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Meus Créditos</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie seus créditos de transcrição e análise
          </p>
        </div>

        <Card data-testid="card-unified-credits">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Créditos Unificados
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold mb-2">{user?.credits || 0}</div>
            <p className="text-sm text-muted-foreground mb-4">
              créditos disponíveis
            </p>
            <div className="space-y-2">
              {!user?.freeTranscriptionUsed && (
                <div className="flex items-center gap-2 p-3 bg-green-500/10 text-green-700 dark:text-green-400 rounded-md">
                  <Check className="h-4 w-4" />
                  <span className="text-sm">1 transcrição grátis disponível (até 10MB)</span>
                </div>
              )}
              {!user?.freeAnalysisUsed && (
                <div className="flex items-center gap-2 p-3 bg-green-500/10 text-green-700 dark:text-green-400 rounded-md">
                  <Check className="h-4 w-4" />
                  <span className="text-sm">1 análise grátis disponível (até 10 páginas)</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Comprar Créditos</CardTitle>
            <CardDescription>
              Pacote único de R$ 35,00 = 100 créditos unificados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-w-md mx-auto border rounded-lg p-6 space-y-4 border-primary">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-primary/10">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">100 Créditos</h3>
                  <p className="text-2xl font-bold">R$ 35</p>
                </div>
              </div>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span><strong>Transcrição:</strong> 1 crédito por página (1 página = 2 min de áudio)</span>
                </li>
                <li className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-muted-foreground" />
                  <span><strong>Análise:</strong> 20-80 créditos conforme tamanho do texto</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  Créditos unificados para qualquer serviço
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  Créditos não expiram
                </li>
              </ul>
              <Button 
                className="w-full" 
                onClick={() => purchaseMutation.mutate()}
                disabled={purchaseMutation.isPending}
                data-testid="button-buy-credits"
              >
                {purchaseMutation.isPending ? "Processando..." : "Comprar 100 Créditos"}
              </Button>
            </div>

            <div className="flex items-center justify-center gap-2 mt-6 text-sm text-muted-foreground">
              <ShieldCheck className="h-4 w-4" />
              Pagamento seguro via Stripe
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Histórico de Compras</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingPayments ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-md" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-3 w-1/4" />
                    </div>
                    <Skeleton className="h-6 w-20" />
                  </div>
                ))}
              </div>
            ) : payments && payments.length > 0 ? (
              <div className="space-y-3">
                {payments.map((payment) => (
                  <div key={payment.id} className="flex items-center gap-4 p-3 bg-muted/50 rounded-md">
                    <div className="flex items-center justify-center h-10 w-10 rounded-md bg-background">
                      <Sparkles className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">
                        {payment.creditsAmount} Créditos
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        <Clock className="h-3 w-3" />
                        {formatDate(payment.createdAt)}
                        <span>•</span>
                        R$ {(payment.amount / 100).toFixed(2)}
                      </div>
                    </div>
                    {getPaymentStatusBadge(payment.status)}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhuma compra realizada ainda</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
