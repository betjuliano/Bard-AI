import { useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
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
  Upload,
  X,
  Sparkles,
  LogOut,
  CreditCard,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { Link } from "wouter";

const MAX_FREE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_FORMATS = ["audio/mpeg", "audio/wav", "audio/x-m4a", "audio/mp4", "audio/x-wav"];

export default function UploadPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const canUseFreeTrial = !user?.freeTranscriptionUsed;
  const hasCredits = (user?.transcriptionCredits || 0) > 0;
  const canTranscribe = canUseFreeTrial || hasCredits;

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    const first = firstName?.charAt(0) || "";
    const last = lastName?.charAt(0) || "";
    return (first + last).toUpperCase() || "U";
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/transcriptions/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao fazer upload");
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Upload realizado",
        description: "Sua transcrição está sendo processada.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/transcriptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setLocation(`/transcricoes/${data.id}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro no upload",
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
      handleFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFile = (selectedFile: File) => {
    if (!ACCEPTED_FORMATS.includes(selectedFile.type)) {
      toast({
        title: "Formato inválido",
        description: "Por favor, envie um arquivo MP3, WAV ou M4A.",
        variant: "destructive",
      });
      return;
    }

    if (canUseFreeTrial && selectedFile.size > MAX_FREE_SIZE) {
      toast({
        title: "Arquivo muito grande",
        description: "O teste gratuito permite arquivos de até 10MB. Compre créditos para arquivos maiores.",
        variant: "destructive",
      });
      return;
    }

    setFile(selectedFile);
    if (!title) {
      setTitle(selectedFile.name.replace(/\.[^/.]+$/, ""));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title.trim()) return;

    const formData = new FormData();
    formData.append("audio", file);
    formData.append("title", title.trim());

    uploadMutation.mutate(formData);
  };

  const removeFile = () => {
    setFile(null);
    setTitle("");
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
              <Button variant="outline" size="sm" className="gap-2">
                <Sparkles className="h-4 w-4" />
                <span className="font-semibold">{user?.transcriptionCredits || 0}</span>
                <span className="text-muted-foreground">créditos</span>
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

      <main className="max-w-2xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Nova Transcrição</h1>
          <p className="text-muted-foreground mt-1">
            Envie um arquivo de áudio para transcrever automaticamente
          </p>
        </div>

        {!canTranscribe && (
          <Card className="mb-6 border-destructive">
            <CardContent className="flex items-center gap-4 pt-6">
              <AlertCircle className="h-8 w-8 text-destructive flex-shrink-0" />
              <div>
                <p className="font-medium">Sem créditos disponíveis</p>
                <p className="text-sm text-muted-foreground">
                  Você já usou seu teste gratuito e não tem créditos. Compre créditos para continuar.
                </p>
                <Button className="mt-3" asChild>
                  <Link href="/creditos">Comprar Créditos</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Upload de Áudio</CardTitle>
              <CardDescription>
                Formatos aceitos: MP3, WAV, M4A
                {canUseFreeTrial && " • Máximo 10MB para teste gratuito"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {!file ? (
                <div
                  className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                    dragActive
                      ? "border-primary bg-primary/5"
                      : "border-muted-foreground/25 hover:border-muted-foreground/50"
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  data-testid="dropzone-audio"
                >
                  <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-medium mb-2">
                    Arraste seu arquivo de áudio aqui
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">ou</p>
                  <Label htmlFor="file-upload">
                    <Button type="button" variant="outline" asChild>
                      <span>Selecionar Arquivo</span>
                    </Button>
                  </Label>
                  <Input
                    id="file-upload"
                    type="file"
                    accept=".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/x-m4a"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        handleFile(e.target.files[0]);
                      }
                    }}
                    data-testid="input-file-upload"
                  />
                </div>
              ) : (
                <div className="border rounded-lg p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center h-12 w-12 rounded-md bg-primary/10">
                      <FileAudio className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={removeFile}
                      disabled={uploadMutation.isPending}
                      data-testid="button-remove-file"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  {uploadMutation.isPending && (
                    <div className="mt-4 space-y-2">
                      <Progress value={uploadProgress} />
                      <p className="text-sm text-muted-foreground text-center">
                        Processando transcrição...
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="title">Título da Transcrição</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Entrevista com Participante 01"
                  disabled={uploadMutation.isPending}
                  data-testid="input-title"
                />
              </div>

              {canUseFreeTrial && (
                <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm">
                    Esta será sua transcrição gratuita (até 10MB)
                  </span>
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={!file || !title.trim() || !canTranscribe || uploadMutation.isPending}
                data-testid="button-submit-upload"
              >
                {uploadMutation.isPending ? (
                  "Processando..."
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Iniciar Transcrição
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </form>
      </main>
    </div>
  );
}
