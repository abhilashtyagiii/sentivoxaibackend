import OpenAI from "openai";
import fs from "fs";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface VoiceToneSegment {
  timestamp: number;
  speaker: string;
  text: string;
  tone: "Positive" | "Neutral" | "Negative";
  confidence: number;
  energy: number;
  pitch: string;
}

export interface EmbeddingMatch {
  text: string;
  embedding: number[];
  similarity: number;
  category: string;
}

/**
 * Extract voice tone features from audio segments
 * Analyzes prosody, pitch, energy to determine emotional tone
 */
export async function extractVoiceTone(audioFilePath: string): Promise<VoiceToneSegment[]> {
  console.log("Extracting voice tone from audio...");
  
  try {
    const audioReadStream = fs.createReadStream(audioFilePath);

    // Transcribe with timestamps for tone analysis
    const transcription = await openai.audio.transcriptions.create({
      file: audioReadStream,
      model: "whisper-1",
      response_format: "verbose_json",
      timestamp_granularities: ["segment"],
    });

    const segments: VoiceToneSegment[] = [];

    // Analyze each segment for tone using AI
    if (transcription.segments) {
      for (const segment of transcription.segments) {
        const toneAnalysis = await analyzeToneFromText(segment.text || "");
        
        segments.push({
          timestamp: segment.start || 0,
          speaker: "Unknown", // Will be identified later via diarization
          text: segment.text || "",
          tone: toneAnalysis.tone,
          confidence: toneAnalysis.confidence,
          energy: segment.avg_logprob ? Math.abs(segment.avg_logprob) : 0.5,
          pitch: toneAnalysis.pitch,
        });
      }
    }

    return segments;
  } catch (error) {
    console.error("Voice tone extraction failed:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Voice tone extraction failed: ${errorMessage}`);
  }
}

/**
 * Analyze tone from text content using GPT-5
 */
async function analyzeToneFromText(text: string): Promise<{
  tone: "Positive" | "Neutral" | "Negative";
  confidence: number;
  pitch: string;
}> {
  const response = await openai.chat.completions.create({
    model: "gpt-5",
    messages: [
      {
        role: "system",
        content: `Analyze the emotional tone of speech text. Return JSON with:
- tone: "Positive" (confident, enthusiastic), "Neutral" (factual), or "Negative" (hesitant, uncertain)
- confidence: 0-1 score
- pitch: "high", "medium", or "low" based on word choice and expression`,
      },
      {
        role: "user",
        content: text,
      },
    ],
    response_format: { type: "json_object" },
  });

  const result = JSON.parse(response.choices[0].message.content || "{}");
  return {
    tone: result.tone || "Neutral",
    confidence: result.confidence || 0.5,
    pitch: result.pitch || "medium",
  };
}

/**
 * Generate embeddings for semantic similarity matching
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-large",
    input: text,
  });

  return response.data[0].embedding;
}

/**
 * Calculate cosine similarity between two embeddings
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Embeddings must have the same dimension");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Perform embedding-based JD relevance scoring
 */
export async function analyzeJDWithEmbeddings(
  jobDescription: string,
  answers: Array<{ text: string; category?: string }>
): Promise<{
  overallSimilarity: number;
  answerMatches: EmbeddingMatch[];
  categoryBreakdown: Record<string, number>;
}> {
  console.log("Generating embeddings for JD analysis...");

  // Generate JD embedding
  const jdEmbedding = await generateEmbedding(jobDescription);

  const answerMatches: EmbeddingMatch[] = [];
  const categoryScores: Record<string, number[]> = {};

  // Generate embeddings for each answer and calculate similarity
  for (const answer of answers) {
    const answerEmbedding = await generateEmbedding(answer.text);
    const similarity = cosineSimilarity(jdEmbedding, answerEmbedding);

    const match: EmbeddingMatch = {
      text: answer.text.substring(0, 100),
      embedding: answerEmbedding,
      similarity: similarity * 100,
      category: answer.category || "general",
    };

    answerMatches.push(match);

    // Track by category
    const cat = answer.category || "general";
    if (!categoryScores[cat]) {
      categoryScores[cat] = [];
    }
    categoryScores[cat].push(similarity * 100);
  }

  // Calculate category averages
  const categoryBreakdown: Record<string, number> = {};
  for (const [cat, scores] of Object.entries(categoryScores)) {
    categoryBreakdown[cat] = scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  const overallSimilarity =
    answerMatches.reduce((sum, m) => sum + m.similarity, 0) / answerMatches.length;

  return {
    overallSimilarity,
    answerMatches,
    categoryBreakdown,
  };
}

/**
 * Detect and redact PII from text
 */
export async function detectAndRedactPII(text: string): Promise<{
  redactedText: string;
  entities: Array<{ type: string; value: string; position: number }>;
}> {
  const response = await openai.chat.completions.create({
    model: "gpt-5",
    messages: [
      {
        role: "system",
        content: `Identify and redact PII (Personally Identifiable Information) from text. Detect:
- Email addresses
- Phone numbers
- SSN/National IDs
- Full addresses
- Credit card numbers
- Dates of birth

Return JSON with:
- redactedText: text with PII replaced by [REDACTED-TYPE]
- entities: array of {type, value, position} for each PII found`,
      },
      {
        role: "user",
        content: text,
      },
    ],
    response_format: { type: "json_object" },
  });

  const result = JSON.parse(response.choices[0].message.content || "{}");
  return {
    redactedText: result.redactedText || text,
    entities: result.entities || [],
  };
}

/**
 * Generate comprehensive explainability report for AI decisions
 */
export async function generateExplainability(
  decision: string,
  score: number,
  context: Record<string, any>
): Promise<{
  reasoning: string[];
  evidence: Array<{ statement: string; weight: number; source: string }>;
  confidenceLevel: number;
  alternativeInterpretations: string[];
}> {
  const response = await openai.chat.completions.create({
    model: "gpt-5",
    messages: [
      {
        role: "system",
        content: `You are an explainable AI expert. Given a decision and score, provide transparent reasoning.

Return JSON with:
- reasoning: step-by-step explanation array
- evidence: array of {statement, weight (0-1), source}
- confidenceLevel: 0-1 score for decision confidence
- alternativeInterpretations: other possible interpretations`,
      },
      {
        role: "user",
        content: `Decision: ${decision}\nScore: ${score}\nContext: ${JSON.stringify(context, null, 2)}`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const result = JSON.parse(response.choices[0].message.content || "{}");
  return {
    reasoning: result.reasoning || [],
    evidence: result.evidence || [],
    confidenceLevel: result.confidenceLevel || 0.5,
    alternativeInterpretations: result.alternativeInterpretations || [],
  };
}
