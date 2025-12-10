import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  FileText,
  Sparkles,
  LogOut,
  CreditCard,
  Download,
  Brain,
  Loader2,
} from "lucide-react";
import type { Transcription } from "@shared/schema";

export default function TranscriptionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: transcription, isLoading, refetch } = useQuery<Transcription>({
    queryKey: ["/api/transcriptions", id],
    refetchInterval: (query) => {
      const data = query.state.data as Transcription | undefined;
      return data?.status === "processing" ? 3000 : false;
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
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
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

  const downloadTranscription = async (format: "txt" | "docx") => {
    if (!transcription) return;
    try {
      const response = await fetch(`/api/transcriptions/${id}/download?format=${format}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Download failed");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${transcription.title}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      toast({
        title: "Erro no download",
        description: "Não foi possível baixar o arquivo.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center">
            <Skeleton className="h-8 w-48" />
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-6 py-8">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-96 w-full" />
        </main>
      </div>
    );
  }

  if (!transcription) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Transcrição não encontrada</h2>
            <p className="text-muted-foreground mb-4">
              A transcrição solicitada não existe ou foi removida.
            </p>
            <Button asChild>
              <Link href="/transcricoes">Voltar para Transcrições</Link>
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
              <Link href="/transcricoes">
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
                <span className="font-semibold">{user?.transcriptionCredits || 0}</span>
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

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold" data-testid="text-title">{transcription.title}</h1>
              {getStatusBadge(transcription.status)}
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {formatDate(transcription.createdAt)}
              </span>
              <span>{formatFileSize(transcription.fileSize)}</span>
              {transcription.wordCount && (
                <span>{transcription.wordCount.toLocaleString()} palavras</span>
              )}
              {transcription.pageCount && (
                <span>{transcription.pageCount} páginas</span>
              )}
            </div>
          </div>
          {transcription.status === "completed" && (
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => downloadTranscription("txt")} data-testid="button-download-txt">
                <Download className="mr-2 h-4 w-4" />
                TXT
              </Button>
              <Button variant="outline" onClick={() => downloadTranscription("docx")} data-testid="button-download-docx">
                <Download className="mr-2 h-4 w-4" />
                DOCX
              </Button>
              <Button asChild data-testid="button-analyze">
                <Link href={`/analises/nova?transcricao=${transcription.id}`}>
                  <Brain className="mr-2 h-4 w-4" />
                  Analisar
                </Link>
              </Button>
            </div>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Transcrição</CardTitle>
            <CardDescription>
              Arquivo original: {transcription.originalFileName}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {transcription.status === "processing" ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
                <h3 className="text-lg font-semibold mb-2">Processando transcrição...</h3>
                <p className="text-muted-foreground text-center max-w-md">
                  Sua transcrição está sendo processada. Isso pode levar alguns minutos dependendo do tamanho do arquivo.
                </p>
              </div>
            ) : transcription.status === "error" ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-destructive mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Erro na transcrição</h3>
                <p className="text-muted-foreground">
                  Ocorreu um erro ao processar este arquivo. Por favor, tente novamente.
                </p>
              </div>
            ) : transcription.transcriptionText ? (
              <ScrollArea className="h-[500px] pr-4">
                <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap" data-testid="text-transcription">
                  {transcription.transcriptionText}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Aguardando processamento...
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
