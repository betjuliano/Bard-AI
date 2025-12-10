import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { queryClient } from "@/lib/queryClient";

export default function CheckoutSuccessPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get("session_id");

    if (sessionId) {
      fetch(`/api/checkout/success?session_id=${sessionId}`, {
        credentials: "include",
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            toast({
              title: "Pagamento confirmado!",
              description: data.message,
            });
            queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
            queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
          }
          setProcessing(false);
        })
        .catch(() => {
          setProcessing(false);
        });
    } else {
      setProcessing(false);
    }
  }, [toast]);

  if (processing) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <Loader2 className="h-16 w-16 mx-auto text-primary animate-spin" />
              <h2 className="text-xl font-semibold">Processando pagamento...</h2>
              <p className="text-muted-foreground">Aguarde enquanto confirmamos seu pagamento</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Card className="max-w-md w-full mx-4">
        <CardHeader>
          <CardTitle className="text-center">Pagamento Confirmado</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center space-y-6">
            <CheckCircle className="h-16 w-16 mx-auto text-green-600" />
            <div>
              <h2 className="text-xl font-semibold mb-2">Obrigado pela compra!</h2>
              <p className="text-muted-foreground">
                Seus créditos foram adicionados à sua conta.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Button asChild data-testid="button-go-dashboard">
                <Link href="/">Ir para o Dashboard</Link>
              </Button>
              <Button variant="outline" asChild data-testid="button-view-credits">
                <Link href="/creditos">Ver Meus Créditos</Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
