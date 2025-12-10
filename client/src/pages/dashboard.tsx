import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
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
  Brain,
  Plus,
  Clock,
  FileText,
  Sparkles,
  LogOut,
  User,
  CreditCard,
  ChevronRight,
} from "lucide-react";
import { Link } from "wouter";
import type { Transcription, Analysis } from "@shared/schema";

export default function Dashboard() {
  const { user } = useAuth();

  const { data: transcriptions, isLoading: loadingTranscriptions } = useQuery<Transcription[]>({
    queryKey: ["/api/transcriptions"],
  });

  const { data: analyses, isLoading: loadingAnalyses } = useQuery<Analysis[]>({
    queryKey: ["/api/analyses"],
  });

  const recentTranscriptions = transcriptions?.slice(0, 5) || [];
  const recentAnalyses = analyses?.slice(0, 3) || [];

  const totalTranscriptions = transcriptions?.length || 0;
  const completedTranscriptions = transcriptions?.filter(t => t.status === "completed").length || 0;
  const totalAnalyses = analyses?.length || 0;

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
              <Button variant="ghost" asChild>
                <Link href="/analises">Análises</Link>
              </Button>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/creditos">
              <Button variant="outline" size="sm" className="gap-2" data-testid="button-credits">
                <Sparkles className="h-4 w-4" />
                <span className="font-semibold">{user?.transcriptionCredits || 0}</span>
                <span className="text-muted-foreground">créditos</span>
              </Button>
            </Link>
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full" data-testid="button-user-menu">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={user?.profileImageUrl || undefined} alt={user?.firstName || "User"} className="object-cover" />
                    <AvatarFallback>{getInitials(user?.firstName, user?.lastName)}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {user?.firstName} {user?.lastName}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/creditos" className="flex items-center cursor-pointer">
                    <CreditCard className="mr-2 h-4 w-4" />
                    <span>Meus Créditos</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <a href="/api/logout" className="flex items-center cursor-pointer text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sair</span>
                  </a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-welcome">
            Olá, {user?.firstName || "Pesquisador"}
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie suas transcrições e análises qualitativas
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card data-testid="card-credits">
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Créditos Disponíveis</CardTitle>
              <Sparkles className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{user?.transcriptionCredits || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {user?.freeTranscriptionUsed ? "Teste gratuito utilizado" : "1 transcrição grátis disponível"}
              </p>
              <Button className="mt-4 w-full" variant="outline" asChild>
                <Link href="/creditos">Comprar Créditos</Link>
              </Button>
            </CardContent>
          </Card>

          <Card data-testid="card-transcriptions-count">
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Transcrições</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loadingTranscriptions ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-3xl font-bold">{completedTranscriptions}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {totalTranscriptions} total
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-analyses-count">
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Análises Bardin</CardTitle>
              <Brain className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loadingAnalyses ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-3xl font-bold">{totalAnalyses}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    análises realizadas
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>Ações Rápidas</CardTitle>
                <CardDescription>Inicie uma nova transcrição ou análise</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Button className="w-full justify-start gap-3 h-auto py-4" asChild data-testid="button-new-transcription">
                <Link href="/upload">
                  <div className="flex items-center justify-center h-10 w-10 rounded-md bg-primary/10">
                    <Plus className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-left">
                    <div className="font-semibold">Nova Transcrição</div>
                    <div className="text-sm text-muted-foreground font-normal">
                      Envie um arquivo de áudio para transcrever
                    </div>
                  </div>
                </Link>
              </Button>

              <Button variant="outline" className="w-full justify-start gap-3 h-auto py-4" asChild data-testid="button-new-analysis">
                <Link href="/analises/nova">
                  <div className="flex items-center justify-center h-10 w-10 rounded-md bg-primary/10">
                    <Brain className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-left">
                    <div className="font-semibold">Nova Análise Bardin</div>
                    <div className="text-sm text-muted-foreground font-normal">
                      Analise uma transcrição com IA
                    </div>
                  </div>
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>Transcrições Recentes</CardTitle>
                <CardDescription>Suas últimas transcrições</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/transcricoes">
                  Ver todas
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {loadingTranscriptions ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-md" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : recentTranscriptions.length > 0 ? (
                <div className="space-y-3">
                  {recentTranscriptions.map((transcription) => (
                    <Link
                      key={transcription.id}
                      href={`/transcricoes/${transcription.id}`}
                      className="flex items-center gap-3 p-2 -mx-2 rounded-md hover-elevate cursor-pointer"
                      data-testid={`link-transcription-${transcription.id}`}
                    >
                      <div className="flex items-center justify-center h-10 w-10 rounded-md bg-muted">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{transcription.title}</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                          <Clock className="h-3 w-3" />
                          {formatDate(transcription.createdAt)}
                        </div>
                      </div>
                      {getStatusBadge(transcription.status)}
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">Nenhuma transcrição ainda</p>
                  <Button className="mt-4" asChild>
                    <Link href="/upload">Criar Primeira Transcrição</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {recentAnalyses.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>Análises Recentes</CardTitle>
                <CardDescription>Suas últimas análises qualitativas</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/analises">
                  Ver todas
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentAnalyses.map((analysis) => (
                  <Link
                    key={analysis.id}
                    href={`/analises/${analysis.id}`}
                    className="flex items-center gap-3 p-2 -mx-2 rounded-md hover-elevate cursor-pointer"
                    data-testid={`link-analysis-${analysis.id}`}
                  >
                    <div className="flex items-center justify-center h-10 w-10 rounded-md bg-muted">
                      <Brain className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{analysis.title}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        <Clock className="h-3 w-3" />
                        {formatDate(analysis.createdAt)}
                      </div>
                    </div>
                    {getStatusBadge(analysis.status)}
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
