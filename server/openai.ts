import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import type { TranscriptionSegment } from "@shared/schema";

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

async function splitAudioIntoChunks(filePath: string, chunkDuration: number): Promise<{ path: string; startOffset: number }[]> {
  const duration = await getAudioDuration(filePath);
  
  if (duration <= chunkDuration) {
    return [{ path: filePath, startOffset: 0 }];
  }
  
  const chunks: { path: string; startOffset: number }[] = [];
  const baseName = filePath.replace(/\.[^/.]+$/, "");
  const ext = path.extname(filePath);
  const numChunks = Math.ceil(duration / chunkDuration);
  
  for (let i = 0; i < numChunks; i++) {
    const startTime = i * chunkDuration;
    const chunkPath = `${baseName}_chunk${i}${ext}`;
    
    await execAsync(
      `ffmpeg -i "${filePath}" -ss ${startTime} -t ${chunkDuration} -acodec copy -y "${chunkPath}"`
    );
    
    chunks.push({ path: chunkPath, startOffset: startTime });
  }
  
  return chunks;
}

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function groupSegmentsByMinute(segments: TranscriptionSegment[]): TranscriptionSegment[] {
  if (segments.length === 0) return [];
  
  const groupedSegments: TranscriptionSegment[] = [];
  let currentMinute = Math.floor(segments[0].start / 60);
  let currentSegment: TranscriptionSegment = {
    start: segments[0].start,
    end: segments[0].end,
    text: segments[0].text,
    speaker: segments[0].speaker,
  };
  
  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i];
    const segMinute = Math.floor(seg.start / 60);
    
    if (segMinute === currentMinute) {
      currentSegment.text += " " + seg.text;
      currentSegment.end = seg.end;
      if (seg.speaker && seg.speaker !== currentSegment.speaker) {
        currentSegment.speaker = undefined;
      }
    } else {
      groupedSegments.push(currentSegment);
      currentMinute = segMinute;
      currentSegment = {
        start: seg.start,
        end: seg.end,
        text: seg.text,
        speaker: seg.speaker,
      };
    }
  }
  
  groupedSegments.push(currentSegment);
  return groupedSegments;
}

async function transcribeChunkWithTimestamps(audioFilePath: string, startOffset: number = 0): Promise<{
  text: string;
  segments: TranscriptionSegment[];
}> {
  const audioReadStream = fs.createReadStream(audioFilePath);
  
  const transcription = await openai.audio.transcriptions.create({
    file: audioReadStream,
    model: "whisper-1",
    language: "pt",
    response_format: "verbose_json",
    timestamp_granularities: ["segment"],
  });
  
  const segments: TranscriptionSegment[] = (transcription.segments || []).map((seg: any) => ({
    start: (seg.start || 0) + startOffset,
    end: (seg.end || 0) + startOffset,
    text: seg.text?.trim() || "",
    speaker: undefined,
  }));
  
  return {
    text: transcription.text,
    segments,
  };
}

async function identifySpeakers(segments: TranscriptionSegment[]): Promise<TranscriptionSegment[]> {
  if (segments.length === 0) return segments;
  
  const fullText = segments.map((s, i) => `[${i}] ${s.text}`).join("\n");
  
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Você é um especialista em identificar diferentes falantes em transcrições de entrevistas.
Analise o texto e identifique padrões de fala que indicam diferentes pessoas (entrevistador vs entrevistado).
Geralmente o entrevistador faz perguntas e o entrevistado responde.

Responda em JSON com o formato:
{
  "speakers": [
    {"index": 0, "speaker": "Entrevistador"},
    {"index": 1, "speaker": "Entrevistado 1"},
    ...
  ]
}

Use "Entrevistador" para quem faz perguntas e "Entrevistado 1", "Entrevistado 2", etc. para os entrevistados.
Se não conseguir distinguir, use "Falante" para todos.`
        },
        {
          role: "user",
          content: `Identifique os falantes nesta transcrição:\n\n${fullText.substring(0, 8000)}`
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 2048,
    });
    
    const result = JSON.parse(response.choices[0].message.content || "{}");
    const speakerMap = new Map<number, string>();
    
    if (result.speakers && Array.isArray(result.speakers)) {
      for (const s of result.speakers) {
        if (typeof s.index === 'number' && typeof s.speaker === 'string') {
          speakerMap.set(s.index, s.speaker);
        }
      }
    }
    
    return segments.map((seg, i) => ({
      ...seg,
      speaker: speakerMap.get(i) || seg.speaker,
    }));
  } catch (error) {
    console.error("Error identifying speakers:", error);
    return segments;
  }
}

export async function transcribeAudio(audioFilePath: string): Promise<{
  text: string;
  segments: TranscriptionSegment[];
  duration: number;
}> {
  let convertedPath: string | null = null;
  let chunks: { path: string; startOffset: number }[] = [];
  
  try {
    convertedPath = await convertToMp3(audioFilePath);
    
    const duration = await getAudioDuration(convertedPath);
    const stats = fs.statSync(convertedPath);
    const fileSizeMB = stats.size / (1024 * 1024);
    
    let allSegments: TranscriptionSegment[] = [];
    let fullText = "";
    
    if (duration > CHUNK_DURATION_SECONDS || fileSizeMB > MAX_FILE_SIZE_MB) {
      console.log(`Audio is ${duration}s / ${fileSizeMB.toFixed(2)}MB - splitting into chunks`);
      chunks = await splitAudioIntoChunks(convertedPath, CHUNK_DURATION_SECONDS);
      
      for (let i = 0; i < chunks.length; i++) {
        console.log(`Transcribing chunk ${i + 1}/${chunks.length}...`);
        const result = await transcribeChunkWithTimestamps(chunks[i].path, chunks[i].startOffset);
        fullText += (fullText ? " " : "") + result.text;
        allSegments = allSegments.concat(result.segments);
      }
    } else {
      const result = await transcribeChunkWithTimestamps(convertedPath);
      fullText = result.text;
      allSegments = result.segments;
    }
    
    console.log("Identifying speakers...");
    const segmentsWithSpeakers = await identifySpeakers(allSegments);
    
    const groupedSegments = groupSegmentsByMinute(segmentsWithSpeakers);
    
    return {
      text: fullText,
      segments: groupedSegments,
      duration: Math.round(duration),
    };
  } finally {
    if (convertedPath && convertedPath !== audioFilePath && fs.existsSync(convertedPath)) {
      try { fs.unlinkSync(convertedPath); } catch (e) {}
    }
    for (const chunk of chunks) {
      if (chunk.path !== convertedPath && fs.existsSync(chunk.path)) {
        try { fs.unlinkSync(chunk.path); } catch (e) {}
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
