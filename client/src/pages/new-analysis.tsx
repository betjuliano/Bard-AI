import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Brain,
  Upload,
  X,
  Sparkles,
  LogOut,
  CreditCard,
  AlertCircle,
  FileText,
  BookOpen,
} from "lucide-react";
import { Link } from "wouter";
import type { Transcription } from "@shared/schema";

export default function NewAnalysisPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const preselectedTranscription = searchParams.get("transcricao");

  const [selectedTranscriptionId, setSelectedTranscriptionId] = useState<string>(
    preselectedTranscription || ""
  );
  const [title, setTitle] = useState("");
  const [theoreticalFile, setTheoreticalFile] = useState<File | null>(null);
  const [theoreticalText, setTheoreticalText] = useState("");
  const [dragActive, setDragActive] = useState(false);

  const hasAnalysisCredit = (user?.analysisCredits || 0) > 0 || !user?.freeTranscriptionUsed;
  const canAnalyze = hasAnalysisCredit;

  const { data: transcriptions } = useQuery<Transcription[]>({
    queryKey: ["/api/transcriptions"],
  });

  const completedTranscriptions = transcriptions?.filter(
    (t) => t.status === "completed"
  );

  const selectedTranscription = completedTranscriptions?.find(
    (t) => t.id.toString() === selectedTranscriptionId
  );

  useEffect(() => {
    if (selectedTranscription && !title) {
      setTitle(`Análise: ${selectedTranscription.title}`);
    }
  }, [selectedTranscription, title]);

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    const first = firstName?.charAt(0) || "";
    const last = lastName?.charAt(0) || "";
    return (first + last).toUpperCase() || "U";
  };

  const createAnalysisMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/analyses", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao criar análise");
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Análise iniciada",
        description: "A análise está sendo processada.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/analyses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setLocation(`/analises/${data.id}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar análise",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleTheoreticalFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleTheoreticalFile = (file: File) => {
    const validTypes = ["application/pdf", "text/plain"];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Formato inválido",
        description: "Por favor, envie um arquivo PDF ou TXT.",
        variant: "destructive",
      });
      return;
    }
    setTheoreticalFile(file);
    setTheoreticalText("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTranscriptionId || !title.trim()) return;

    const formData = new FormData();
    formData.append("transcriptionId", selectedTranscriptionId);
    formData.append("title", title.trim());

    if (theoreticalFile) {
      formData.append("theoreticalFramework", theoreticalFile);
    } else if (theoreticalText.trim()) {
      formData.append("theoreticalFrameworkText", theoreticalText.trim());
    }

    createAnalysisMutation.mutate(formData);
  };

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

      <main className="max-w-2xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Nova Análise Bardin</h1>
          <p className="text-muted-foreground mt-1">
            Realize uma análise de conteúdo qualitativa baseada em Laurence Bardin
          </p>
        </div>

        {!canAnalyze && (
          <Card className="mb-6 border-destructive">
            <CardContent className="flex items-center gap-4 pt-6">
              <AlertCircle className="h-8 w-8 text-destructive flex-shrink-0" />
              <div>
                <p className="font-medium">Sem créditos disponíveis</p>
                <p className="text-sm text-muted-foreground">
                  Você precisa de créditos de análise para continuar.
                </p>
                <Button className="mt-3" asChild>
                  <Link href="/creditos">Comprar Créditos</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Selecionar Transcrição
                </CardTitle>
                <CardDescription>
                  Escolha a transcrição que deseja analisar
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select
                  value={selectedTranscriptionId}
                  onValueChange={setSelectedTranscriptionId}
                >
                  <SelectTrigger data-testid="select-transcription">
                    <SelectValue placeholder="Selecione uma transcrição" />
                  </SelectTrigger>
                  <SelectContent>
                    {completedTranscriptions?.map((t) => (
                      <SelectItem key={t.id} value={t.id.toString()}>
                        {t.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedTranscription && (
                  <div className="p-4 bg-muted rounded-md">
                    <p className="text-sm text-muted-foreground">
                      {selectedTranscription.wordCount?.toLocaleString()} palavras •{" "}
                      {selectedTranscription.pageCount} páginas
                    </p>
                    <p className="text-sm mt-2 line-clamp-3">
                      {selectedTranscription.transcriptionText?.substring(0, 200)}...
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="title">Título da Análise</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex: Análise Qualitativa - Entrevista 01"
                    data-testid="input-title"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Referencial Teórico (Opcional)
                </CardTitle>
                <CardDescription>
                  Envie um arquivo PDF/TXT ou cole o texto do seu referencial para contextualizar a análise
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!theoreticalFile ? (
                  <>
                    <div
                      className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                        dragActive
                          ? "border-primary bg-primary/5"
                          : "border-muted-foreground/25 hover:border-muted-foreground/50"
                      }`}
                      onDragEnter={handleDrag}
                      onDragLeave={handleDrag}
                      onDragOver={handleDrag}
                      onDrop={handleDrop}
                    >
                      <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                      <p className="font-medium mb-1">
                        Arraste seu arquivo aqui
                      </p>
                      <p className="text-sm text-muted-foreground mb-3">PDF ou TXT</p>
                      <Label htmlFor="theoretical-upload">
                        <Button type="button" variant="outline" size="sm" asChild>
                          <span>Selecionar Arquivo</span>
                        </Button>
                      </Label>
                      <Input
                        id="theoretical-upload"
                        type="file"
                        accept=".pdf,.txt,application/pdf,text/plain"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            handleTheoreticalFile(e.target.files[0]);
                          }
                        }}
                        data-testid="input-theoretical-file"
                      />
                    </div>

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-card px-2 text-muted-foreground">ou cole o texto</span>
                      </div>
                    </div>

                    <Textarea
                      value={theoreticalText}
                      onChange={(e) => setTheoreticalText(e.target.value)}
                      placeholder="Cole aqui o texto do seu referencial teórico..."
                      className="min-h-[120px]"
                      data-testid="textarea-theoretical"
                    />
                  </>
                ) : (
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center h-10 w-10 rounded-md bg-primary/10">
                        <BookOpen className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{theoreticalFile.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {(theoreticalFile.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setTheoreticalFile(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Button
              type="submit"
              className="w-full"
              disabled={!selectedTranscriptionId || !title.trim() || !canAnalyze || createAnalysisMutation.isPending}
              data-testid="button-submit-analysis"
            >
              {createAnalysisMutation.isPending ? (
                "Processando..."
              ) : (
                <>
                  <Brain className="mr-2 h-4 w-4" />
                  Iniciar Análise Bardin
                </>
              )}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
