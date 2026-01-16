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
import { Switch } from "@/components/ui/switch";
import { 
  Users, CreditCard, Plus, ArrowLeft, Shield, Activity, 
  TrendingUp, AlertCircle, CheckCircle, Clock, Ban, 
  Eye, Trash2, DollarSign, Coins, FileText, BarChart3
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import type { User, Payment, UserAccessLog, CreditTransaction, SystemLog } from "@shared/schema";

const ADMIN_EMAIL = "admjulianoo@gmail.com";

type RevenueStats = {
  totalRevenue: number;
  totalPayments: number;
  completedPayments: number;
};

type PerformanceStats = {
  avgDuration: number;
  errorCount: number;
  warningCount: number;
  totalLogs: number;
};

type CreditSummary = {
  totalCreditsUsed: number;
  totalCreditsAdded: number;
  transactionCount: number;
};

export default function AdminPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditReason, setCreditReason] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [accessLogsDialogOpen, setAccessLogsDialogOpen] = useState(false);
  const [userFilter, setUserFilter] = useState<"all" | "active" | "inactive" | "free" | "paid">("all");

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

  const { data: allUsers = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users/all"],
    enabled: !!isAdmin,
  });

  const { data: payments = [], isLoading: paymentsLoading } = useQuery<Payment[]>({
    queryKey: ["/api/admin/payments"],
    enabled: !!isAdmin,
  });

  const { data: revenueStats } = useQuery<RevenueStats>({
    queryKey: ["/api/admin/revenue/stats"],
    enabled: !!isAdmin,
  });

  const { data: performanceStats } = useQuery<PerformanceStats>({
    queryKey: ["/api/admin/performance/stats"],
    enabled: !!isAdmin,
  });

  const { data: creditTransactions = [] } = useQuery<CreditTransaction[]>({
    queryKey: ["/api/admin/credit-transactions"],
    enabled: !!isAdmin,
  });

  const { data: creditSummary } = useQuery<CreditSummary>({
    queryKey: ["/api/admin/credit-transactions/summary"],
    enabled: !!isAdmin,
  });

  const { data: systemLogs = [] } = useQuery<SystemLog[]>({
    queryKey: ["/api/admin/system-logs"],
    enabled: !!isAdmin,
  });

  const { data: userAccessLogs = [] } = useQuery<UserAccessLog[]>({
    queryKey: ["/api/admin/users", selectedUser?.id, "access-logs"],
    enabled: !!isAdmin && !!selectedUser && accessLogsDialogOpen,
  });

  const addCreditsMutation = useMutation({
    mutationFn: async (data: { userId: string; creditType: string; amount: number; reason: string }) => {
      const response = await apiRequest("POST", "/api/admin/credits/manual", data);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/credit-transactions"] });
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

  const toggleUserStatusMutation = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: string; isActive: boolean }) => {
      const response = await apiRequest("PATCH", `/api/admin/users/${userId}/status`, { isActive });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users/all"] });
      toast({
        title: "Sucesso",
        description: "Status do usuário atualizado.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao atualizar status do usuário.",
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest("DELETE", `/api/admin/users/${userId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users/all"] });
      toast({
        title: "Sucesso",
        description: "Usuário desativado com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao desativar usuário.",
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
      creditType: "credits",
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

  const filteredUsers = allUsers.filter(u => {
    if (u.email === ADMIN_EMAIL) return false;
    switch (userFilter) {
      case "active": return u.isActive !== false;
      case "inactive": return u.isActive === false;
      case "free": return (u.credits || 0) === 0;
      case "paid": return (u.credits || 0) > 0;
      default: return true;
    }
  });

  const activeUsers = allUsers.filter(u => u.isActive !== false && u.email !== ADMIN_EMAIL).length;
  const inactiveUsers = allUsers.filter(u => u.isActive === false).length;
  const paidUsers = allUsers.filter(u => (u.credits || 0) > 0 && u.email !== ADMIN_EMAIL).length;
  const freeUsers = allUsers.filter(u => (u.credits || 0) === 0 && u.email !== ADMIN_EMAIL).length;

  const revenueChartData = payments
    .filter(p => p.status === "completed" && p.source === "stripe")
    .slice(0, 30)
    .reverse()
    .map(p => ({
      date: new Date(p.createdAt!).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      value: p.amount / 100,
    }));

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "error": return "text-red-500";
      case "warning": return "text-yellow-500";
      case "info": return "text-blue-500";
      default: return "text-muted-foreground";
    }
  };

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Usuários</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-users">{allUsers.length - 1}</div>
              <p className="text-xs text-muted-foreground">
                {activeUsers} ativos, {inactiveUsers} inativos
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-revenue">
                {formatCurrency(revenueStats?.totalRevenue || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                {revenueStats?.completedPayments || 0} pagamentos concluídos
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Créditos em Circulação</CardTitle>
              <Coins className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-credits-circulation">
                {creditSummary?.totalCreditsAdded || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                {creditSummary?.totalCreditsUsed || 0} utilizados
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Performance</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-performance">
                {Math.round(performanceStats?.avgDuration || 0)}ms
              </div>
              <p className="text-xs text-muted-foreground">
                {performanceStats?.errorCount || 0} erros, {performanceStats?.warningCount || 0} avisos
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="users" data-testid="tab-users" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Usuários</span>
            </TabsTrigger>
            <TabsTrigger value="tokens" data-testid="tab-tokens" className="gap-2">
              <Coins className="h-4 w-4" />
              <span className="hidden sm:inline">Tokens</span>
            </TabsTrigger>
            <TabsTrigger value="revenue" data-testid="tab-revenue" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Receita</span>
            </TabsTrigger>
            <TabsTrigger value="system" data-testid="tab-system" className="gap-2">
              <Activity className="h-4 w-4" />
              <span className="hidden sm:inline">Sistema</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle>Gestão de Usuários</CardTitle>
                    <CardDescription>
                      Controle usuários ativos, gratuitos e pagos.
                    </CardDescription>
                  </div>
                  <Select value={userFilter} onValueChange={(v) => setUserFilter(v as typeof userFilter)}>
                    <SelectTrigger className="w-[180px]" data-testid="select-user-filter">
                      <SelectValue placeholder="Filtrar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos ({allUsers.length - 1})</SelectItem>
                      <SelectItem value="active">Ativos ({activeUsers})</SelectItem>
                      <SelectItem value="inactive">Inativos ({inactiveUsers})</SelectItem>
                      <SelectItem value="paid">Pagos ({paidUsers})</SelectItem>
                      <SelectItem value="free">Gratuitos ({freeUsers})</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {usersLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="h-6 w-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum usuário encontrado.
                  </p>
                ) : (
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-3">
                      {filteredUsers.map((u) => (
                        <div
                          key={u.id}
                          className="flex items-center justify-between p-4 border rounded-lg hover-elevate"
                          data-testid={`row-user-${u.id}`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium truncate">
                                {u.firstName || u.fullName || "Sem nome"} {u.lastName || ""}
                              </p>
                              {u.isActive === false && (
                                <Badge variant="destructive" className="text-xs">Inativo</Badge>
                              )}
                              {(u.credits || 0) > 0 && (
                                <Badge variant="default" className="text-xs">Pago</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground truncate">{u.email}</p>
                            <div className="flex gap-2 mt-2 flex-wrap">
                              <Badge variant="secondary" className="text-xs">
                                {u.credits || 0} créditos
                              </Badge>
                              {u.freeTranscriptionUsed && (
                                <Badge variant="outline" className="text-xs">Trans. grátis</Badge>
                              )}
                              {u.freeAnalysisUsed && (
                                <Badge variant="outline" className="text-xs">Análise grátis</Badge>
                              )}
                              {u.lastLoginAt && (
                                <Badge variant="outline" className="text-xs">
                                  <Clock className="h-3 w-3 mr-1" />
                                  {formatDate(u.lastLoginAt)}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-2">
                              <Label htmlFor={`switch-${u.id}`} className="text-xs text-muted-foreground">
                                {u.isActive !== false ? "Ativo" : "Inativo"}
                              </Label>
                              <Switch
                                id={`switch-${u.id}`}
                                checked={u.isActive !== false}
                                onCheckedChange={(checked) => 
                                  toggleUserStatusMutation.mutate({ userId: u.id, isActive: checked })
                                }
                                data-testid={`switch-user-${u.id}`}
                              />
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                setSelectedUser(u);
                                setAccessLogsDialogOpen(true);
                              }}
                              data-testid={`button-logs-${u.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
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
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => setSelectedUser(u)}
                                  data-testid={`button-add-credits-${u.id}`}
                                >
                                  <Plus className="h-4 w-4" />
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
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                if (confirm(`Deseja realmente desativar o usuário ${u.email}?`)) {
                                  deleteUserMutation.mutate(u.id);
                                }
                              }}
                              data-testid={`button-delete-${u.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            <Dialog open={accessLogsDialogOpen} onOpenChange={setAccessLogsDialogOpen}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Histórico de Acessos</DialogTitle>
                  <DialogDescription>
                    Últimos acessos de {selectedUser?.firstName} {selectedUser?.lastName}
                  </DialogDescription>
                </DialogHeader>
                <ScrollArea className="h-[400px]">
                  {userAccessLogs.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      Nenhum registro de acesso encontrado.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {userAccessLogs.map((log) => (
                        <div key={log.id} className="p-3 border rounded-lg text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <Badge variant="outline">{log.action}</Badge>
                            <span className="text-muted-foreground">{formatDate(log.createdAt)}</span>
                          </div>
                          {log.ipAddress && (
                            <p className="text-muted-foreground mt-1">IP: {log.ipAddress}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="tokens">
            <div className="grid gap-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Créditos Adicionados</CardTitle>
                    <Plus className="h-4 w-4 text-green-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      +{creditSummary?.totalCreditsAdded || 0}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Créditos Utilizados</CardTitle>
                    <TrendingUp className="h-4 w-4 text-red-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">
                      -{creditSummary?.totalCreditsUsed || 0}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Transações</CardTitle>
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {creditSummary?.transactionCount || 0}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Histórico de Transações de Créditos</CardTitle>
                  <CardDescription>
                    Todas as movimentações de tokens dos usuários pagos.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    {creditTransactions.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">
                        Nenhuma transação registrada ainda.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {creditTransactions.map((tx) => (
                          <div
                            key={tx.id}
                            className="flex items-center justify-between p-3 border rounded-lg"
                            data-testid={`row-transaction-${tx.id}`}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant={tx.amount > 0 ? "default" : "secondary"}>
                                  {tx.type}
                                </Badge>
                                {tx.referenceType && (
                                  <Badge variant="outline">{tx.referenceType}</Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">
                                {tx.description || "-"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatDate(tx.createdAt)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className={`font-bold ${tx.amount > 0 ? "text-green-600" : "text-red-600"}`}>
                                {tx.amount > 0 ? "+" : ""}{tx.amount}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {tx.creditsBefore} → {tx.creditsAfter}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="revenue">
            <div className="grid gap-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
                    <DollarSign className="h-4 w-4 text-green-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {formatCurrency(revenueStats?.totalRevenue || 0)}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Pagamentos Concluídos</CardTitle>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {revenueStats?.completedPayments || 0}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total de Pagamentos</CardTitle>
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {revenueStats?.totalPayments || 0}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {revenueChartData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Receita por Período</CardTitle>
                    <CardDescription>Últimos pagamentos concluídos via Stripe</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={revenueChartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip 
                          formatter={(value: number) => formatCurrency(value * 100)}
                          labelFormatter={(label) => `Data: ${label}`}
                        />
                        <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Histórico de Pagamentos</CardTitle>
                  <CardDescription>Todos os pagamentos (Stripe e manuais)</CardDescription>
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
                      <div className="space-y-3">
                        {payments.map((p) => (
                          <div
                            key={p.id}
                            className="flex items-center justify-between p-3 border rounded-lg"
                            data-testid={`row-payment-${p.id}`}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant={p.source === "stripe" ? "default" : "secondary"}>
                                  {p.source === "stripe" ? "Stripe" : "Manual"}
                                </Badge>
                                <Badge variant={p.status === "completed" ? "default" : "outline"}>
                                  {p.status === "completed" ? "Concluído" : p.status}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">
                                {formatDate(p.createdAt)}
                              </p>
                              {p.reason && (
                                <p className="text-sm text-muted-foreground">
                                  Motivo: {p.reason}
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="font-bold">{p.creditsAmount} créditos</p>
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
            </div>
          </TabsContent>

          <TabsContent value="system">
            <div className="grid gap-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Tempo Médio</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {Math.round(performanceStats?.avgDuration || 0)}ms
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total de Logs</CardTitle>
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {performanceStats?.totalLogs || 0}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Erros</CardTitle>
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">
                      {performanceStats?.errorCount || 0}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Avisos</CardTitle>
                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-yellow-600">
                      {performanceStats?.warningCount || 0}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Logs do Sistema</CardTitle>
                  <CardDescription>
                    Monitoramento de desempenho e erros do sistema.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    {systemLogs.length === 0 ? (
                      <div className="text-center py-8">
                        <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                        <p className="text-muted-foreground">
                          Sistema funcionando normalmente. Nenhum log registrado.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {systemLogs.map((log) => (
                          <div
                            key={log.id}
                            className="p-3 border rounded-lg"
                            data-testid={`row-log-${log.id}`}
                          >
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className={getSeverityColor(log.severity)}>
                                  {log.severity.toUpperCase()}
                                </Badge>
                                <Badge variant="secondary">{log.eventType}</Badge>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {formatDate(log.createdAt)}
                              </span>
                            </div>
                            <p className="text-sm mt-2">{log.message}</p>
                            {log.durationMs && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Duração: {log.durationMs}ms
                              </p>
                            )}
                            {log.recommendation && (
                              <div className="mt-2 p-2 bg-muted rounded text-sm">
                                <span className="font-medium">Sugestão:</span> {log.recommendation}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
