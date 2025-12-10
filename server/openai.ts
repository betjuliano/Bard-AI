import OpenAI from "openai";
import fs from "fs";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function transcribeAudio(audioFilePath: string): Promise<{ text: string }> {
  const audioReadStream = fs.createReadStream(audioFilePath);

  const transcription = await openai.audio.transcriptions.create({
    file: audioReadStream,
    model: "whisper-1",
    language: "pt",
  });

  return {
    text: transcription.text,
  };
}

export async function analyzeWithBardin(
  transcriptionText: string,
  theoreticalFramework?: string
): Promise<{
  analysis: string;
  categories: string[];
  themes: { name: string; count: number }[];
  quotes: { text: string; category: string }[];
}> {
  const systemPrompt = `Você é um especialista em análise de conteúdo qualitativa, especificamente na metodologia de Laurence Bardin. Sua tarefa é realizar uma análise de conteúdo completa seguindo as três fases de Bardin:

1. **Pré-análise**: Leitura flutuante, escolha dos documentos, formulação de hipóteses e objetivos.
2. **Exploração do material**: Codificação, categorização e classificação dos dados.
3. **Tratamento dos resultados**: Inferência e interpretação.

Ao analisar o texto, você deve:
- Identificar unidades de registro (palavras, temas, frases)
- Criar categorias temáticas emergentes
- Identificar padrões e frequências
- Extrair citações relevantes que exemplifiquem cada categoria
- Realizar inferências baseadas nos dados

${theoreticalFramework ? `
**Referencial Teórico fornecido pelo pesquisador:**
${theoreticalFramework}

Use este referencial para contextualizar sua análise e fazer conexões teóricas.
` : ""}

Responda em formato JSON com a seguinte estrutura:
{
  "analysis": "Texto completo da análise de conteúdo baseada em Bardin",
  "categories": ["categoria1", "categoria2", ...],
  "themes": [{"name": "tema", "count": número de ocorrências}, ...],
  "quotes": [{"text": "citação do texto original", "category": "categoria relacionada"}, ...]
}`;

  const response = await openai.chat.completions.create({
    model: "gpt-5",
    messages: [
      { role: "system", content: systemPrompt },
      { 
        role: "user", 
        content: `Realize uma análise de conteúdo qualitativa baseada em Bardin do seguinte texto transcrito de uma entrevista:\n\n${transcriptionText}` 
      }
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 8192,
  });

  const result = JSON.parse(response.choices[0].message.content || "{}");

  return {
    analysis: result.analysis || "",
    categories: result.categories || [],
    themes: result.themes || [],
    quotes: result.quotes || [],
  };
}
