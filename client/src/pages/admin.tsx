import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, CreditCard, Plus, FileText, ArrowLeft, Shield } from "lucide-react";
import type { User, Payment } from "@shared/schema";

const ADMIN_EMAIL = "admjulianoo@gmail.com";

export default function AdminPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [creditType, setCreditType] = useState<"transcription" | "analysis">("transcription");
  const [creditAmount, setCreditAmount] = useState("");
  const [creditReason, setCreditReason] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const isAdmin = user?.email === ADMIN_EMAIL && user?.isAdmin;

  const setupAdminMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/setup");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Sucesso",
        description: "Conta de administrador ativada.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao ativar conta de administrador.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (!authLoading && user?.email === ADMIN_EMAIL && !user?.isAdmin) {
      setupAdminMutation.mutate();
    }
  }, [authLoading, user]);

  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    enabled: !!isAdmin,
  });

  const { data: payments = [], isLoading: paymentsLoading } = useQuery<Payment[]>({
    queryKey: ["/api/admin/payments"],
    enabled: !!isAdmin,
  });

  const addCreditsMutation = useMutation({
    mutationFn: async (data: { userId: string; creditType: string; amount: number; reason: string }) => {
      const response = await apiRequest("POST", "/api/admin/credits/manual", data);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payments"] });
      toast({
        title: "Sucesso",
        description: data.message,
      });
      setDialogOpen(false);
      setSelectedUser(null);
      setCreditAmount("");
      setCreditReason("");
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao adicionar créditos.",
        variant: "destructive",
      });
    },
  });

  const handleAddCredits = () => {
    if (!selectedUser || !creditAmount || !creditReason) return;
    
    const amount = parseInt(creditAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Erro",
        description: "Quantidade de créditos inválida.",
        variant: "destructive",
      });
      return;
    }

    addCreditsMutation.mutate({
      userId: selectedUser.id,
      creditType,
      amount,
      reason: creditReason,
    });
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user || user.email !== ADMIN_EMAIL) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Acesso Restrito
            </CardTitle>
            <CardDescription>
              Esta página é restrita a administradores.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation("/")} variant="outline" className="w-full" data-testid="button-back-home">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar para Início
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (user.email === ADMIN_EMAIL && !user.isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Ativando conta de administrador...</p>
        </div>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(amount / 100);
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const totalRevenue = payments
    .filter(p => p.status === "completed" && p.source === "stripe")
    .reduce((sum, p) => sum + p.amount, 0);

  const totalManualCredits = payments
    .filter(p => p.source === "manual")
    .reduce((sum, p) => sum + p.creditsAmount, 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/")}
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-semibold">Painel Administrativo</h1>
            </div>
          </div>
          <Badge variant="outline" className="bg-primary/10">
            Admin
          </Badge>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Usuários</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-users">{users.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Receita Total (Stripe)</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-revenue">{formatCurrency(totalRevenue)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Créditos Manuais</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-manual-credits">{totalManualCredits}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="users" className="space-y-6">
          <TabsList>
            <TabsTrigger value="users" data-testid="tab-users">
              <Users className="h-4 w-4 mr-2" />
              Usuários
            </TabsTrigger>
            <TabsTrigger value="payments" data-testid="tab-payments">
              <CreditCard className="h-4 w-4 mr-2" />
              Pagamentos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>Usuários</CardTitle>
                <CardDescription>
                  Gerencie usuários e adicione créditos manualmente.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {usersLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="h-6 w-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : users.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum usuário cadastrado ainda.
                  </p>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-4">
                      {users.map((u) => (
                        <div
                          key={u.id}
                          className="flex items-center justify-between p-4 border rounded-lg"
                          data-testid={`row-user-${u.id}`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                              {u.firstName} {u.lastName}
                            </p>
                            <p className="text-sm text-muted-foreground truncate">
                              {u.email}
                            </p>
                            <div className="flex gap-2 mt-2 flex-wrap">
                              <Badge variant="secondary" className="text-xs">
                                Créditos: {u.credits || 0}
                              </Badge>
                              {u.freeTranscriptionUsed && (
                                <Badge variant="outline" className="text-xs">
                                  Transcrição grátis usada
                                </Badge>
                              )}
                              {u.freeAnalysisUsed && (
                                <Badge variant="outline" className="text-xs">
                                  Análise grátis usada
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Dialog open={dialogOpen && selectedUser?.id === u.id} onOpenChange={(open) => {
                            setDialogOpen(open);
                            if (!open) {
                              setSelectedUser(null);
                              setCreditAmount("");
                              setCreditReason("");
                            }
                          }}>
                            <DialogTrigger asChild>
                              <Button
                                size="sm"
                                onClick={() => setSelectedUser(u)}
                                data-testid={`button-add-credits-${u.id}`}
                              >
                                <Plus className="h-4 w-4 mr-1" />
                                Créditos
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Adicionar Créditos</DialogTitle>
                                <DialogDescription>
                                  Adicionar créditos para {u.firstName} {u.lastName} ({u.email})
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                  <Label htmlFor="creditType">Tipo de Crédito</Label>
                                  <Select
                                    value={creditType}
                                    onValueChange={(v) => setCreditType(v as "transcription" | "analysis")}
                                  >
                                    <SelectTrigger data-testid="select-credit-type">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="transcription">Transcrição (páginas)</SelectItem>
                                      <SelectItem value="analysis">Análise Bardin</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="amount">Quantidade</Label>
                                  <Input
                                    id="amount"
                                    type="number"
                                    min="1"
                                    max="10000"
                                    value={creditAmount}
                                    onChange={(e) => setCreditAmount(e.target.value)}
                                    placeholder="Ex: 100"
                                    data-testid="input-credit-amount"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="reason">Motivo</Label>
                                  <Textarea
                                    id="reason"
                                    value={creditReason}
                                    onChange={(e) => setCreditReason(e.target.value)}
                                    placeholder="Ex: Pagamento via PIX, Cortesia, etc."
                                    data-testid="input-credit-reason"
                                  />
                                </div>
                              </div>
                              <DialogFooter>
                                <Button
                                  variant="outline"
                                  onClick={() => setDialogOpen(false)}
                                  data-testid="button-cancel-credits"
                                >
                                  Cancelar
                                </Button>
                                <Button
                                  onClick={handleAddCredits}
                                  disabled={!creditAmount || !creditReason || addCreditsMutation.isPending}
                                  data-testid="button-confirm-credits"
                                >
                                  {addCreditsMutation.isPending ? "Adicionando..." : "Adicionar"}
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Pagamentos</CardTitle>
                <CardDescription>
                  Todos os pagamentos (Stripe e manuais).
                </CardDescription>
              </CardHeader>
              <CardContent>
                {paymentsLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="h-6 w-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : payments.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum pagamento registrado ainda.
                  </p>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-4">
                      {payments.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between p-4 border rounded-lg"
                          data-testid={`row-payment-${p.id}`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium">
                                {p.creditType === "transcription" ? "Transcrição" : "Análise"}
                              </p>
                              <Badge variant={p.source === "stripe" ? "default" : "secondary"}>
                                {p.source === "stripe" ? "Stripe" : "Manual"}
                              </Badge>
                              <Badge
                                variant={p.status === "completed" ? "default" : "outline"}
                              >
                                {p.status === "completed" ? "Concluído" : p.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {formatDate(p.createdAt)}
                            </p>
                            {p.reason && (
                              <p className="text-sm text-muted-foreground mt-1">
                                Motivo: {p.reason}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="font-medium">
                              {p.creditsAmount} créditos
                            </p>
                            {p.amount > 0 && (
                              <p className="text-sm text-muted-foreground">
                                {formatCurrency(p.amount)}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
