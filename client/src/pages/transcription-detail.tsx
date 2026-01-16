import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  Save,
  Edit3,
  X,
  User,
  Mic,
  Trash2,
  Copy,
  Check,
  Pencil,
  Type,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { Transcription, TranscriptionSegment, TranscriptionChunkProgress } from "@shared/schema";
import { CheckCircle2, Circle, AlertCircle } from "lucide-react";

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hours}h ${remMins}m`;
  }
  return `${mins}m ${secs}s`;
}

interface SegmentEditorProps {
  segment: TranscriptionSegment;
  index: number;
  onUpdate: (index: number, text: string) => void;
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onCopy: (text: string) => void;
}

function SegmentEditor({ segment, index, onUpdate, isEditing, onStartEdit, onCancelEdit, onCopy }: SegmentEditorProps) {
  const [editText, setEditText] = useState(segment.text);

  useEffect(() => {
    setEditText(segment.text);
  }, [segment.text]);

  const handleSave = () => {
    onUpdate(index, editText);
  };

  const handleCancel = () => {
    setEditText(segment.text);
    onCancelEdit();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      handleCancel();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      handleSave();
    }
  };

  const getSpeakerIcon = (speaker?: string) => {
    if (!speaker) return <Mic className="h-4 w-4" />;
    if (speaker.toLowerCase().includes("entrevistador")) {
      return <User className="h-4 w-4" />;
    }
    return <Mic className="h-4 w-4" />;
  };

  const getSpeakerColor = (speaker?: string) => {
    if (!speaker) return "text-muted-foreground";
    if (speaker.toLowerCase().includes("entrevistador")) {
      return "text-blue-600 dark:text-blue-400";
    }
    return "text-green-600 dark:text-green-400";
  };

  return (
    <div className="group border-b border-border/50 py-3 last:border-0">
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center gap-1 min-w-[100px]">
          <Badge variant="outline" className="text-xs font-mono">
            {formatTimestamp(segment.start)}
          </Badge>
          {segment.speaker && (
            <div className={`flex items-center gap-1 text-xs ${getSpeakerColor(segment.speaker)}`}>
              {getSpeakerIcon(segment.speaker)}
              <span className="text-xs font-medium" data-testid={`text-speaker-${index}`}>
                {segment.speaker}
              </span>
            </div>
          )}
        </div>
        <div className="flex-1">
          {isEditing ? (
            <div className="space-y-2">
              <Textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={handleKeyDown}
                className="min-h-[80px] text-sm"
                data-testid={`textarea-segment-${index}`}
                autoFocus
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={handleSave} data-testid={`button-save-segment-${index}`}>
                    <Save className="mr-1 h-3 w-3" />
                    Salvar
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleCancel}>
                    <X className="mr-1 h-3 w-3" />
                    Cancelar
                  </Button>
                </div>
                <span className="text-xs text-muted-foreground">
                  {editText.split(/\s+/).filter(Boolean).length} palavras
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <div 
                className="flex-1 text-sm leading-relaxed cursor-pointer hover-elevate rounded p-2 -m-2"
                onClick={onStartEdit}
                data-testid={`text-segment-${index}`}
              >
                {segment.text}
                <Edit3 className="h-3 w-3 ml-2 inline-block opacity-0 group-hover:opacity-50 transition-opacity" />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  onCopy(segment.text);
                }}
                data-testid={`button-copy-segment-${index}`}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TranscriptionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [editingSegmentIndex, setEditingSegmentIndex] = useState<number | null>(null);
  const [localSegments, setLocalSegments] = useState<TranscriptionSegment[]>([]);
  const [isFullEditMode, setIsFullEditMode] = useState(false);
  const [fullEditText, setFullEditText] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);

  const { data: transcription, isLoading, refetch } = useQuery<Transcription>({
    queryKey: ["/api/transcriptions", id],
    refetchInterval: (query) => {
      const data = query.state.data as Transcription | undefined;
      return data?.status === "processing" ? 2000 : false;
    },
  });

  useEffect(() => {
    if (transcription?.segments) {
      setLocalSegments(transcription.segments);
    }
    if (transcription?.transcriptionText) {
      setFullEditText(transcription.transcriptionText);
    }
    if (transcription?.title) {
      setEditedTitle(transcription.title);
    }
  }, [transcription]);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "Você tem alterações não salvas. Deseja realmente sair?";
        return e.returnValue;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const saveMutation = useMutation({
    mutationFn: async (data: { transcriptionText?: string; segments?: TranscriptionSegment[]; title?: string }) => {
      return apiRequest("PUT", `/api/transcriptions/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transcriptions", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/transcriptions"] });
      setHasUnsavedChanges(false);
      toast({
        title: "Salvo com sucesso",
        description: "As alterações foram salvas.",
      });
    },
    onError: () => {
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as alterações.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/transcriptions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transcriptions"] });
      toast({
        title: "Transcrição excluída",
        description: "A transcrição foi removida com sucesso.",
      });
      navigate("/transcricoes");
    },
    onError: () => {
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir a transcrição.",
        variant: "destructive",
      });
    },
  });

  const handleSegmentUpdate = useCallback((index: number, newText: string) => {
    setLocalSegments(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], text: newText };
      return updated;
    });
    setEditingSegmentIndex(null);
    setHasUnsavedChanges(true);
  }, []);

  const handleSaveAll = () => {
    const transcriptionText = localSegments.map(s => s.text).join("\n\n");
    saveMutation.mutate({ transcriptionText, segments: localSegments });
  };

  const handleSaveFullText = () => {
    saveMutation.mutate({ transcriptionText: fullEditText });
    setIsFullEditMode(false);
  };

  const handleSaveTitle = () => {
    if (editedTitle.trim() && editedTitle !== transcription?.title) {
      saveMutation.mutate({ title: editedTitle.trim() });
    }
    setIsEditingTitle(false);
  };

  const handleCancelTitleEdit = () => {
    setEditedTitle(transcription?.title || "");
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveTitle();
    }
    if (e.key === "Escape") {
      handleCancelTitleEdit();
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(true);
      toast({
        title: "Copiado",
        description: "Texto copiado para a área de transferência.",
      });
      setTimeout(() => setCopiedText(false), 2000);
    } catch (error) {
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar o texto.",
        variant: "destructive",
      });
    }
  };

  const copyFullTranscription = () => {
    if (transcription?.transcriptionText) {
      copyToClipboard(transcription.transcriptionText);
    }
  };

  const handleSaveAllRef = useRef(handleSaveAll);
  handleSaveAllRef.current = handleSaveAll;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (hasUnsavedChanges && !saveMutation.isPending) {
          handleSaveAllRef.current();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasUnsavedChanges, saveMutation.isPending]);

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    const first = firstName?.charAt(0) || "";
    const last = lastName?.charAt(0) || "";
    return (first + last).toUpperCase() || "U";
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "-";
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
      
      toast({
        title: "Download iniciado",
        description: `Arquivo ${transcription.title}.${format} baixado.`,
      });
    } catch (error) {
      toast({
        title: "Erro no download",
        description: "Não foi possível baixar o arquivo.",
        variant: "destructive",
      });
    }
  };

  const getCurrentWordCount = () => {
    if (isFullEditMode) {
      return fullEditText.split(/\s+/).filter(Boolean).length;
    }
    return transcription?.wordCount || 0;
  };

  const getCurrentCharCount = () => {
    if (isFullEditMode) {
      return fullEditText.length;
    }
    return transcription?.transcriptionText?.length || 0;
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

  const hasSegments = localSegments && localSegments.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/transcricoes" data-testid="button-back">
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
                <span className="font-semibold">{user?.credits || 0}</span>
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
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              {isEditingTitle ? (
                <div className="flex items-center gap-2">
                  <Input
                    ref={titleInputRef}
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    onKeyDown={handleTitleKeyDown}
                    className="text-2xl font-bold h-auto py-1 px-2 max-w-md"
                    data-testid="input-title"
                  />
                  <Button size="icon" variant="ghost" onClick={handleSaveTitle} data-testid="button-save-title">
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={handleCancelTitleEdit}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 group">
                  <h1 className="text-2xl font-bold" data-testid="text-title">{transcription.title}</h1>
                  {transcription.status === "completed" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => setIsEditingTitle(true)}
                      data-testid="button-edit-title"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}
              {getStatusBadge(transcription.status)}
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {formatDate(transcription.createdAt)}
              </span>
              <span>{formatFileSize(transcription.fileSize)}</span>
              {transcription.duration && (
                <span>{formatDuration(transcription.duration)}</span>
              )}
              {transcription.wordCount && (
                <span>{transcription.wordCount.toLocaleString()} palavras</span>
              )}
              {transcription.pageCount && (
                <span>{transcription.pageCount} páginas</span>
              )}
            </div>
          </div>
          {transcription.status === "completed" && (
            <div className="flex flex-wrap items-center gap-2">
              {hasUnsavedChanges && (
                <Button onClick={handleSaveAll} disabled={saveMutation.isPending} data-testid="button-save-all">
                  {saveMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Salvar Alterações
                </Button>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={copyFullTranscription}
                    data-testid="button-copy-all"
                  >
                    {copiedText ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copiar texto completo</TooltipContent>
              </Tooltip>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" data-testid="button-download">
                    <Download className="mr-2 h-4 w-4" />
                    Baixar
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => downloadTranscription("txt")} data-testid="button-download-txt">
                    <FileText className="mr-2 h-4 w-4" />
                    Formato TXT
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => downloadTranscription("docx")} data-testid="button-download-docx">
                    <FileText className="mr-2 h-4 w-4" />
                    Formato DOCX
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button asChild data-testid="button-analyze">
                <Link href={`/analises/nova?transcricao=${transcription.id}`}>
                  <Brain className="mr-2 h-4 w-4" />
                  Analisar
                </Link>
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="icon" className="text-destructive hover:text-destructive" data-testid="button-delete">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir transcrição?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação não pode ser desfeita. A transcrição "{transcription.title}" será permanentemente removida.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel data-testid="button-cancel-delete">Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteMutation.mutate()}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      disabled={deleteMutation.isPending}
                      data-testid="button-confirm-delete"
                    >
                      {deleteMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="mr-2 h-4 w-4" />
                      )}
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
            <div>
              <CardTitle>Transcrição</CardTitle>
              <CardDescription>
                Arquivo original: {transcription.originalFileName}
              </CardDescription>
            </div>
            {transcription.status === "completed" && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Type className="h-4 w-4" />
                <span data-testid="text-word-count">
                  {getCurrentWordCount().toLocaleString()} palavras
                </span>
                <span className="text-muted-foreground/50">|</span>
                <span data-testid="text-char-count">
                  {getCurrentCharCount().toLocaleString()} caracteres
                </span>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {transcription.status === "processing" ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
                <h3 className="text-lg font-semibold mb-2">Processando transcrição...</h3>
                {transcription.totalChunks && transcription.totalChunks > 1 ? (
                  <div className="w-full max-w-md space-y-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Progresso</span>
                      <span className="font-medium" data-testid="text-progress">
                        {transcription.completedChunks || 0} de {transcription.totalChunks} partes
                      </span>
                    </div>
                    <Progress 
                      value={((transcription.completedChunks || 0) / transcription.totalChunks) * 100} 
                      className="h-2"
                      data-testid="progress-bar"
                    />
                    {transcription.chunkProgress && transcription.chunkProgress.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <p className="text-xs text-muted-foreground mb-2">Detalhes por parte:</p>
                        <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
                          {(transcription.chunkProgress as TranscriptionChunkProgress[]).map((chunk, idx) => (
                            <div 
                              key={idx}
                              className="flex flex-col items-center justify-center"
                              title={`Parte ${idx + 1}: ${chunk.status}`}
                              data-testid={`chunk-status-${idx}`}
                            >
                              {chunk.status === "completed" ? (
                                <CheckCircle2 className="h-5 w-5 text-green-500" />
                              ) : chunk.status === "processing" ? (
                                <Loader2 className="h-5 w-5 text-primary animate-spin" />
                              ) : chunk.status === "error" ? (
                                <AlertCircle className="h-5 w-5 text-destructive" />
                              ) : (
                                <Circle className="h-5 w-5 text-muted-foreground/50" />
                              )}
                              <span className="text-[10px] text-muted-foreground mt-0.5">{idx + 1}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {transcription.isPremiumQuality && (
                      <div className="flex items-center justify-center gap-2 mt-4">
                        <Badge variant="secondary" className="gap-1">
                          <Sparkles className="h-3 w-3" />
                          Qualidade Premium
                        </Badge>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center max-w-md">
                    Sua transcrição está sendo processada. Isso pode levar alguns minutos dependendo do tamanho do arquivo.
                  </p>
                )}
              </div>
            ) : transcription.status === "error" ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-destructive mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Erro na transcrição</h3>
                <p className="text-muted-foreground">
                  Ocorreu um erro ao processar este arquivo. Por favor, tente novamente.
                </p>
              </div>
            ) : hasSegments ? (
              <Tabs defaultValue="segments" className="w-full">
                <TabsList className="mb-4">
                  <TabsTrigger value="segments" data-testid="tab-segments">
                    <Clock className="mr-2 h-4 w-4" />
                    Com Timestamps
                  </TabsTrigger>
                  <TabsTrigger value="full" data-testid="tab-full">
                    <FileText className="mr-2 h-4 w-4" />
                    Texto Completo
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="segments">
                  <ScrollArea className="h-[500px] pr-4">
                    <div className="space-y-1">
                      {localSegments.map((segment, index) => (
                        <SegmentEditor
                          key={index}
                          segment={segment}
                          index={index}
                          onUpdate={handleSegmentUpdate}
                          isEditing={editingSegmentIndex === index}
                          onStartEdit={() => setEditingSegmentIndex(index)}
                          onCancelEdit={() => setEditingSegmentIndex(null)}
                          onCopy={copyToClipboard}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>
                <TabsContent value="full">
                  <div className="space-y-4">
                    {isFullEditMode ? (
                      <>
                        <Textarea
                          value={fullEditText}
                          onChange={(e) => {
                            setFullEditText(e.target.value);
                            setHasUnsavedChanges(true);
                          }}
                          className="min-h-[400px] font-mono text-sm"
                          data-testid="textarea-full-edit"
                        />
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Button onClick={handleSaveFullText} disabled={saveMutation.isPending}>
                              {saveMutation.isPending ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <Save className="mr-2 h-4 w-4" />
                              )}
                              Salvar
                            </Button>
                            <Button variant="outline" onClick={() => {
                              setFullEditText(transcription.transcriptionText || "");
                              setIsFullEditMode(false);
                              setHasUnsavedChanges(false);
                            }}>
                              <X className="mr-2 h-4 w-4" />
                              Cancelar
                            </Button>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {fullEditText.split(/\s+/).filter(Boolean).length} palavras | {fullEditText.length} caracteres
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <ScrollArea className="h-[500px] pr-4">
                          <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap" data-testid="text-transcription">
                            {transcription.transcriptionText}
                          </div>
                        </ScrollArea>
                        <Button variant="outline" onClick={() => setIsFullEditMode(true)} data-testid="button-edit-full">
                          <Edit3 className="mr-2 h-4 w-4" />
                          Editar Texto Completo
                        </Button>
                      </>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            ) : transcription.transcriptionText ? (
              <div className="space-y-4">
                {isFullEditMode ? (
                  <>
                    <Textarea
                      value={fullEditText}
                      onChange={(e) => {
                        setFullEditText(e.target.value);
                        setHasUnsavedChanges(true);
                      }}
                      className="min-h-[400px] font-mono text-sm"
                      data-testid="textarea-full-edit"
                    />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Button onClick={handleSaveFullText} disabled={saveMutation.isPending}>
                          {saveMutation.isPending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="mr-2 h-4 w-4" />
                          )}
                          Salvar
                        </Button>
                        <Button variant="outline" onClick={() => {
                          setFullEditText(transcription.transcriptionText || "");
                          setIsFullEditMode(false);
                          setHasUnsavedChanges(false);
                        }}>
                          <X className="mr-2 h-4 w-4" />
                          Cancelar
                        </Button>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {fullEditText.split(/\s+/).filter(Boolean).length} palavras | {fullEditText.length} caracteres
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <ScrollArea className="h-[500px] pr-4">
                      <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap" data-testid="text-transcription">
                        {transcription.transcriptionText}
                      </div>
                    </ScrollArea>
                    <Button variant="outline" onClick={() => setIsFullEditMode(true)} data-testid="button-edit-full">
                      <Edit3 className="mr-2 h-4 w-4" />
                      Editar Texto
                    </Button>
                  </>
                )}
              </div>
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

        {hasUnsavedChanges && (
          <div className="fixed bottom-6 right-6 z-50">
            <Card className="bg-primary text-primary-foreground shadow-lg">
              <CardContent className="flex items-center gap-4 p-4">
                <span className="text-sm font-medium">Você tem alterações não salvas</span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleSaveAll}
                  disabled={saveMutation.isPending}
                  data-testid="button-save-floating"
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Salvar (Ctrl+S)
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
