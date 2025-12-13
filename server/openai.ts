import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const CHUNK_DURATION_SECONDS = 600;
const MAX_FILE_SIZE_MB = 25;

async function getAudioDuration(filePath: string): Promise<number> {
  try {
    const { stdout } = await execAsync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`
    );
    return parseFloat(stdout.trim()) || 0;
  } catch (error) {
    console.error("Error getting audio duration:", error);
    return 0;
  }
}

async function convertToMp3(inputPath: string): Promise<string> {
  const ext = path.extname(inputPath).toLowerCase();
  const supportedFormats = [".mp3", ".mp4", ".mpeg", ".mpga", ".m4a", ".wav", ".webm"];
  
  if (supportedFormats.includes(ext)) {
    const stats = fs.statSync(inputPath);
    if (stats.size <= MAX_FILE_SIZE_MB * 1024 * 1024) {
      return inputPath;
    }
  }
  
  const outputPath = inputPath.replace(/\.[^/.]+$/, "_converted.mp3");
  
  await execAsync(
    `ffmpeg -i "${inputPath}" -vn -acodec libmp3lame -ab 128k -ar 16000 -ac 1 -y "${outputPath}"`
  );
  
  return outputPath;
}

async function splitAudioIntoChunks(filePath: string, chunkDuration: number): Promise<string[]> {
  const duration = await getAudioDuration(filePath);
  
  if (duration <= chunkDuration) {
    return [filePath];
  }
  
  const chunks: string[] = [];
  const baseName = filePath.replace(/\.[^/.]+$/, "");
  const ext = path.extname(filePath);
  const numChunks = Math.ceil(duration / chunkDuration);
  
  for (let i = 0; i < numChunks; i++) {
    const startTime = i * chunkDuration;
    const chunkPath = `${baseName}_chunk${i}${ext}`;
    
    await execAsync(
      `ffmpeg -i "${filePath}" -ss ${startTime} -t ${chunkDuration} -acodec copy -y "${chunkPath}"`
    );
    
    chunks.push(chunkPath);
  }
  
  return chunks;
}

async function transcribeChunk(audioFilePath: string): Promise<string> {
  const audioReadStream = fs.createReadStream(audioFilePath);
  
  const transcription = await openai.audio.transcriptions.create({
    file: audioReadStream,
    model: "whisper-1",
    language: "pt",
  });
  
  return transcription.text;
}

export async function transcribeAudio(audioFilePath: string): Promise<{ text: string }> {
  let convertedPath: string | null = null;
  let chunks: string[] = [];
  
  try {
    convertedPath = await convertToMp3(audioFilePath);
    
    const duration = await getAudioDuration(convertedPath);
    const stats = fs.statSync(convertedPath);
    const fileSizeMB = stats.size / (1024 * 1024);
    
    if (duration > CHUNK_DURATION_SECONDS || fileSizeMB > MAX_FILE_SIZE_MB) {
      console.log(`Audio is ${duration}s / ${fileSizeMB.toFixed(2)}MB - splitting into chunks`);
      chunks = await splitAudioIntoChunks(convertedPath, CHUNK_DURATION_SECONDS);
      
      const transcriptions: string[] = [];
      for (let i = 0; i < chunks.length; i++) {
        console.log(`Transcribing chunk ${i + 1}/${chunks.length}...`);
        const text = await transcribeChunk(chunks[i]);
        transcriptions.push(text);
      }
      
      return { text: transcriptions.join(" ") };
    } else {
      const text = await transcribeChunk(convertedPath);
      return { text };
    }
  } finally {
    if (convertedPath && convertedPath !== audioFilePath && fs.existsSync(convertedPath)) {
      try { fs.unlinkSync(convertedPath); } catch (e) {}
    }
    for (const chunk of chunks) {
      if (chunk !== convertedPath && fs.existsSync(chunk)) {
        try { fs.unlinkSync(chunk); } catch (e) {}
      }
    }
  }
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
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { 
        role: "user", 
        content: `Realize uma análise de conteúdo qualitativa baseada em Bardin do seguinte texto transcrito de uma entrevista:\n\n${transcriptionText}` 
      }
    ],
    response_format: { type: "json_object" },
    max_tokens: 8192,
  });

  const result = JSON.parse(response.choices[0].message.content || "{}");

  return {
    analysis: result.analysis || "",
    categories: result.categories || [],
    themes: result.themes || [],
    quotes: result.quotes || [],
  };
}
