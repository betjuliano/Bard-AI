import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Clock,
  Sparkles,
  LogOut,
  CreditCard,
  Brain,
  Loader2,
  Tag,
  Quote,
  BookOpen,
} from "lucide-react";
import type { Analysis, Transcription } from "@shared/schema";

export default function AnalysisDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const { data: analysis, isLoading } = useQuery<Analysis>({
    queryKey: ["/api/analyses", id],
    refetchInterval: (query) => {
      const data = query.state.data as Analysis | undefined;
      return data?.status === "processing" ? 3000 : false;
    },
  });

  const { data: transcription } = useQuery<Transcription>({
    queryKey: ["/api/transcriptions", analysis?.transcriptionId?.toString()],
    enabled: !!analysis?.transcriptionId,
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
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
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

  const categories = analysis?.categories as string[] | null;
  const themes = analysis?.themes as { name: string; count: number }[] | null;
  const quotes = analysis?.quotes as { text: string; category: string }[] | null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center">
            <Skeleton className="h-8 w-48" />
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-6 py-8">
          <Skeleton className="h-8 w-64 mb-4" />
          <div className="grid lg:grid-cols-2 gap-6">
            <Skeleton className="h-96" />
            <Skeleton className="h-96" />
          </div>
        </main>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Análise não encontrada</h2>
            <p className="text-muted-foreground mb-4">
              A análise solicitada não existe ou foi removida.
            </p>
            <Button asChild>
              <Link href="/analises">Voltar para Análises</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/analises">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <Link href="/" className="flex items-center gap-2">
              <FileAudio className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold hidden sm:inline">IA Transcreve</span>
            </Link>
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
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold" data-testid="text-title">{analysis.title}</h1>
            {getStatusBadge(analysis.status)}
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {formatDate(analysis.createdAt)}
            </span>
            {analysis.theoreticalFrameworkFileName && (
              <span className="flex items-center gap-1">
                <BookOpen className="h-4 w-4" />
                {analysis.theoreticalFrameworkFileName}
              </span>
            )}
          </div>
        </div>

        {analysis.status === "processing" ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
              <h3 className="text-lg font-semibold mb-2">Processando análise...</h3>
              <p className="text-muted-foreground text-center max-w-md">
                Nossa IA está realizando a análise de conteúdo baseada em Bardin. Isso pode levar alguns minutos.
              </p>
            </CardContent>
          </Card>
        ) : analysis.status === "error" ? (
          <Card>
            <CardContent className="text-center py-12">
              <Brain className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Erro na análise</h3>
              <p className="text-muted-foreground">
                Ocorreu um erro ao processar a análise. Por favor, tente novamente.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="lg:row-span-2">
              <CardHeader>
                <CardTitle>Transcrição Original</CardTitle>
                <CardDescription>
                  {transcription?.title || "Carregando..."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px] pr-4">
                  <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                    {transcription?.transcriptionText || "Carregando transcrição..."}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Tabs defaultValue="analysis" className="space-y-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="analysis">Análise</TabsTrigger>
                <TabsTrigger value="categories">Categorias</TabsTrigger>
                <TabsTrigger value="quotes">Citações</TabsTrigger>
              </TabsList>

              <TabsContent value="analysis">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Brain className="h-5 w-5" />
                      Análise de Conteúdo
                    </CardTitle>
                    <CardDescription>
                      Fundamentada na metodologia de Laurence Bardin
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[400px] pr-4">
                      <div className="prose prose-sm dark:prose-invert max-w-none" data-testid="text-analysis">
                        {analysis.analysisResult || "Análise não disponível."}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="categories">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Tag className="h-5 w-5" />
                      Categorias Identificadas
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {categories && categories.length > 0 ? (
                      <div className="space-y-4">
                        {categories.map((category, index) => (
                          <div key={index} className="flex items-start gap-3 p-3 bg-muted rounded-md">
                            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary font-semibold text-sm flex-shrink-0">
                              {index + 1}
                            </div>
                            <div>
                              <p className="font-medium">{category}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center py-8">
                        Nenhuma categoria identificada ainda.
                      </p>
                    )}

                    {themes && themes.length > 0 && (
                      <div className="mt-6">
                        <h4 className="font-semibold mb-3">Frequência de Temas</h4>
                        <div className="space-y-2">
                          {themes.map((theme, index) => (
                            <div key={index} className="flex items-center justify-between">
                              <span className="text-sm">{theme.name}</span>
                              <Badge variant="secondary">{theme.count}x</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="quotes">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Quote className="h-5 w-5" />
                      Citações Relevantes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[400px] pr-4">
                      {quotes && quotes.length > 0 ? (
                        <div className="space-y-4">
                          {quotes.map((quote, index) => (
                            <div key={index} className="border-l-2 border-primary pl-4 py-2">
                              <p className="text-sm italic mb-2">"{quote.text}"</p>
                              <Badge variant="outline" size="sm">{quote.category}</Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-center py-8">
                          Nenhuma citação extraída ainda.
                        </p>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </main>
    </div>
  );
}
