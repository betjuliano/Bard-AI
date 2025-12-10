import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";
import { Link } from "wouter";

export default function CheckoutCancelPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Card className="max-w-md w-full mx-4">
        <CardHeader>
          <CardTitle className="text-center">Pagamento Cancelado</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center space-y-6">
            <XCircle className="h-16 w-16 mx-auto text-muted-foreground" />
            <div>
              <h2 className="text-xl font-semibold mb-2">Pagamento não concluído</h2>
              <p className="text-muted-foreground">
                Seu pagamento foi cancelado. Nenhum valor foi cobrado.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Button asChild data-testid="button-try-again">
                <Link href="/creditos">Tentar Novamente</Link>
              </Button>
              <Button variant="outline" asChild data-testid="button-go-home">
                <Link href="/">Voltar ao Início</Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
