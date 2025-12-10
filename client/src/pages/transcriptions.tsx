import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  FileText,
  Sparkles,
  LogOut,
  CreditCard,
  Trash2,
  Download,
  MoreVertical,
  Brain,
} from "lucide-react";
import { Link } from "wouter";
import type { Transcription } from "@shared/schema";

export default function TranscriptionsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: transcriptions, isLoading } = useQuery<Transcription[]>({
    queryKey: ["/api/transcriptions"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/transcriptions/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Transcrição excluída" });
      queryClient.invalidateQueries({ queryKey: ["/api/transcriptions"] });
    },
    onError: () => {
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir a transcrição.",
        variant: "destructive",
      });
    },
  });

  const filteredTranscriptions = transcriptions?.filter(
    (t) =>
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.transcriptionText?.toLowerCase().includes(searchQuery.toLowerCase())
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

  const downloadTranscription = async (id: number, title: string, format: "txt" | "docx") => {
    try {
      const response = await fetch(`/api/transcriptions/${id}/download?format=${format}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Download failed");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title}.${format}`;
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
              <Button variant="secondary" asChild>
                <Link href="/transcricoes">Transcrições</Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link href="/analises">Análises</Link>
              </Button>
            </nav>
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

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Transcrições</h1>
            <p className="text-muted-foreground">
              {transcriptions?.length || 0} transcrições
            </p>
          </div>
          <Button asChild data-testid="button-new-transcription">
            <Link href="/upload">
              <Plus className="mr-2 h-4 w-4" />
              Nova Transcrição
            </Link>
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar transcrições..."
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
        ) : filteredTranscriptions && filteredTranscriptions.length > 0 ? (
          <div className="grid gap-4">
            {filteredTranscriptions.map((transcription) => (
              <Card key={transcription.id} className="hover-elevate" data-testid={`card-transcription-${transcription.id}`}>
                <CardContent className="flex items-center gap-4 pt-6">
                  <div className="flex items-center justify-center h-12 w-12 rounded-md bg-muted flex-shrink-0">
                    <FileText className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <Link href={`/transcricoes/${transcription.id}`} className="flex-1 min-w-0 cursor-pointer">
                    <div className="font-semibold truncate">{transcription.title}</div>
                    <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(transcription.createdAt)}
                      </span>
                      <span>{formatFileSize(transcription.fileSize)}</span>
                      {transcription.wordCount && (
                        <span>{transcription.wordCount.toLocaleString()} palavras</span>
                      )}
                    </div>
                  </Link>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {getStatusBadge(transcription.status)}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid={`button-menu-${transcription.id}`}>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {transcription.status === "completed" && (
                          <>
                            <DropdownMenuItem asChild>
                              <Link href={`/analises/nova?transcricao=${transcription.id}`} className="cursor-pointer">
                                <Brain className="mr-2 h-4 w-4" />
                                Analisar com Bardin
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => downloadTranscription(transcription.id, transcription.title, "txt")}
                            >
                              <Download className="mr-2 h-4 w-4" />
                              Download TXT
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => downloadTranscription(transcription.id, transcription.title, "docx")}
                            >
                              <Download className="mr-2 h-4 w-4" />
                              Download DOCX
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}
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
                              <AlertDialogTitle>Excluir transcrição?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação não pode ser desfeita. A transcrição "{transcription.title}" será permanentemente excluída.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMutation.mutate(transcription.id)}
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
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {searchQuery ? "Nenhuma transcrição encontrada" : "Nenhuma transcrição ainda"}
              </h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery
                  ? "Tente uma busca diferente"
                  : "Comece enviando seu primeiro arquivo de áudio"}
              </p>
              {!searchQuery && (
                <Button asChild>
                  <Link href="/upload">
                    <Plus className="mr-2 h-4 w-4" />
                    Nova Transcrição
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
