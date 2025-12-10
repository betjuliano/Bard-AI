import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { FileAudio, Brain, CreditCard, BookOpen, Check, ArrowRight } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <FileAudio className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold">IA Transcreve</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button asChild data-testid="button-login">
              <a href="/api/login">Entrar</a>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="py-20 px-6">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              Transcreva entrevistas e realize{" "}
              <span className="text-primary">análises qualitativas</span>{" "}
              com inteligência artificial
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Plataforma especializada para pesquisadores. Transcrição automática com IA e análise de conteúdo baseada na metodologia de Bardin.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button size="lg" asChild data-testid="button-start-free">
                <a href="/api/login">
                  Começar Gratuitamente
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="#como-funciona">Como Funciona</a>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Experimente grátis: 1 transcrição de até 10MB incluída
            </p>
          </div>
        </section>

        <section id="recursos" className="py-20 px-6 bg-muted/30">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">Recursos para Pesquisadores</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Tudo o que você precisa para transformar suas entrevistas em dados analisáveis
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="hover-elevate">
                <CardHeader>
                  <FileAudio className="h-10 w-10 text-primary mb-2" />
                  <CardTitle className="text-lg">Transcrição Automática</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Envie arquivos de áudio MP3, WAV ou M4A e receba a transcrição completa em minutos usando tecnologia Whisper da OpenAI.
                  </CardDescription>
                </CardContent>
              </Card>

              <Card className="hover-elevate">
                <CardHeader>
                  <Brain className="h-10 w-10 text-primary mb-2" />
                  <CardTitle className="text-lg">Análise de Bardin</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Agente de IA especializado em análise de conteúdo qualitativa fundamentada na metodologia de Laurence Bardin.
                  </CardDescription>
                </CardContent>
              </Card>

              <Card className="hover-elevate">
                <CardHeader>
                  <BookOpen className="h-10 w-10 text-primary mb-2" />
                  <CardTitle className="text-lg">Referencial Teórico</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Envie seu referencial teórico em PDF ou TXT para que a IA realize análises contextualizadas à sua pesquisa.
                  </CardDescription>
                </CardContent>
              </Card>

              <Card className="hover-elevate">
                <CardHeader>
                  <CreditCard className="h-10 w-10 text-primary mb-2" />
                  <CardTitle className="text-lg">Pagamento Único</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Sem assinaturas. Pague R$ 35 por 100 páginas transcritas ou 1 análise qualitativa completa.
                  </CardDescription>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section id="como-funciona" className="py-20 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">Como Funciona</h2>
              <p className="text-muted-foreground">
                Três passos simples para transformar suas entrevistas em insights
              </p>
            </div>
            <div className="space-y-8">
              <div className="flex gap-6 items-start">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                  1
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Faça o Upload do Áudio</h3>
                  <p className="text-muted-foreground">
                    Envie seus arquivos de entrevistas em MP3, WAV ou M4A. A primeira transcrição de até 10MB é gratuita.
                  </p>
                </div>
              </div>

              <div className="flex gap-6 items-start">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                  2
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Receba a Transcrição</h3>
                  <p className="text-muted-foreground">
                    Nossa IA transcreve o áudio automaticamente. Você pode editar, exportar em TXT ou DOCX e organizar sua biblioteca.
                  </p>
                </div>
              </div>

              <div className="flex gap-6 items-start">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                  3
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Analise com Bardin</h3>
                  <p className="text-muted-foreground">
                    Selecione uma transcrição e ative o agente de análise qualitativa. Envie seu referencial teórico para uma análise contextualizada.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="precos" className="py-20 px-6 bg-muted/30">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">Preços Simples e Transparentes</h2>
              <p className="text-muted-foreground">
                Sem assinaturas ou taxas escondidas. Pague apenas pelo que usar.
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-8">
              <Card>
                <CardHeader>
                  <CardTitle>Plano Gratuito</CardTitle>
                  <CardDescription>Para experimentar a plataforma</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-3xl font-bold">R$ 0</div>
                  <ul className="space-y-3">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      <span>1 transcrição de até 10MB</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      <span>1 análise qualitativa Bardin</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      <span>Exportação em TXT</span>
                    </li>
                  </ul>
                  <Button className="w-full" variant="outline" asChild>
                    <a href="/api/login">Começar Grátis</a>
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-primary">
                <CardHeader>
                  <CardTitle>Créditos Pagos</CardTitle>
                  <CardDescription>Para projetos de pesquisa</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-3xl font-bold">
                    R$ 35
                    <span className="text-base font-normal text-muted-foreground"> / pacote</span>
                  </div>
                  <ul className="space-y-3">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      <span>100 páginas de transcrição</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      <span className="font-semibold">OU</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      <span>1 análise qualitativa completa</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      <span>Exportação em TXT e DOCX</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      <span>Upload de referencial teórico</span>
                    </li>
                  </ul>
                  <Button className="w-full" asChild>
                    <a href="/api/login">Comprar Créditos</a>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <FileAudio className="h-6 w-6 text-primary" />
              <span className="font-semibold">IA Transcreve</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Plataforma para pesquisadores qualitativos
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
