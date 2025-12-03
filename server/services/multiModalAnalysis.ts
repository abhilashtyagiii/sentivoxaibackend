/**
 * Multi-Modal Sentiment Analysis
 * Combines voice tone analysis with text-based sentiment for comprehensive emotional assessment
 */

import { extractVoiceTone, type VoiceToneSegment } from "./openai";

export interface MultiModalSentiment {
  overallScore: number;
  textSentiment: {
    positive: number;
    neutral: number;
    negative: number;
  };
  voiceTone: {
    positiveRatio: number;
    neutralRatio: number;
    negativeRatio: number;
    avgConfidence: number;
  };
  combinedAnalysis: {
    recruiter: {
      textScore: number;
      voiceScore: number;
      combinedScore: number;
      alignment: "aligned" | "misaligned" | "partially_aligned";
    };
    candidate: {
      textScore: number;
      voiceScore: number;
      combinedScore: number;
      alignment: "aligned" | "misaligned" | "partially_aligned";
    };
  };
  segments: Array<{
    text: string;
    speaker: string;
    textSentiment: "Positive" | "Neutral" | "Negative";
    voiceTone: "Positive" | "Neutral" | "Negative";
    agreement: boolean;
    confidence: number;
  }>;
}

/**
 * Analyze sentiment using both voice tone and text analysis
 */
export async function analyzeMultiModalSentiment(
  audioFilePath: string,
  textSentiment: any,
  transcriptSegments: any[]
): Promise<MultiModalSentiment> {
  console.log("Performing multi-modal sentiment analysis...");

  // Extract voice tone from audio
  const voiceToneSegments = await extractVoiceTone(audioFilePath);

  // Map voice tone to text segments
  const mappedSegments = mapVoiceToText(voiceToneSegments, transcriptSegments);

  // Calculate combined metrics
  const recruiterSegments = mappedSegments.filter(s => s.speaker === "Recruiter");
  const candidateSegments = mappedSegments.filter(s => s.speaker === "Candidate");

  const recruiterAnalysis = calculateCombinedSentiment(
    recruiterSegments,
    textSentiment.recruiterSentiment
  );

  const candidateAnalysis = calculateCombinedSentiment(
    candidateSegments,
    textSentiment.candidateSentiment
  );

  // Calculate voice tone distribution
  const voiceTone = calculateVoiceToneDistribution(voiceToneSegments);

  return {
    overallScore: (recruiterAnalysis.combinedScore + candidateAnalysis.combinedScore) / 2,
    textSentiment: {
      positive: textSentiment.recruiterSentiment.positive + textSentiment.candidateSentiment.positive,
      neutral: textSentiment.recruiterSentiment.neutral + textSentiment.candidateSentiment.neutral,
      negative: textSentiment.recruiterSentiment.negative + textSentiment.candidateSentiment.negative,
    },
    voiceTone,
    combinedAnalysis: {
      recruiter: recruiterAnalysis,
      candidate: candidateAnalysis,
    },
    segments: mappedSegments,
  };
}

/**
 * Map voice tone segments to transcript segments
 */
function mapVoiceToText(
  voiceSegments: VoiceToneSegment[],
  textSegments: any[]
): Array<{
  text: string;
  speaker: string;
  textSentiment: "Positive" | "Neutral" | "Negative";
  voiceTone: "Positive" | "Neutral" | "Negative";
  agreement: boolean;
  confidence: number;
}> {
  const mapped: any[] = [];

  for (const textSeg of textSegments) {
    // Find closest voice segment by timestamp
    const voiceSeg = voiceSegments.find(v => 
      Math.abs(v.timestamp - (textSeg.timestamp || 0)) < 5
    );

    const textSentiment = inferTextSentiment(textSeg.text);
    const voiceTone = voiceSeg?.tone || "Neutral";
    
    mapped.push({
      text: textSeg.text,
      speaker: textSeg.speaker,
      textSentiment,
      voiceTone,
      agreement: textSentiment === voiceTone,
      confidence: voiceSeg?.confidence || 0.5,
    });
  }

  return mapped;
}

/**
 * Infer text sentiment from segment
 */
function inferTextSentiment(text: string): "Positive" | "Neutral" | "Negative" {
  const lowerText = text.toLowerCase();
  
  const positiveWords = ["great", "excellent", "good", "yes", "absolutely", "definitely", "love", "best"];
  const negativeWords = ["no", "not", "never", "bad", "poor", "unfortunately", "difficult"];
  
  const positiveCount = positiveWords.filter(w => lowerText.includes(w)).length;
  const negativeCount = negativeWords.filter(w => lowerText.includes(w)).length;
  
  if (positiveCount > negativeCount) return "Positive";
  if (negativeCount > positiveCount) return "Negative";
  return "Neutral";
}

/**
 * Calculate combined sentiment from text and voice
 */
function calculateCombinedSentiment(
  segments: any[],
  textSentimentData: any
): {
  textScore: number;
  voiceScore: number;
  combinedScore: number;
  alignment: "aligned" | "misaligned" | "partially_aligned";
} {
  if (segments.length === 0) {
    return {
      textScore: 0,
      voiceScore: 0,
      combinedScore: 0,
      alignment: "aligned",
    };
  }

  // Calculate text score from sentiment data
  const textScore = textSentimentData.overallScore * 10; // Convert to 0-100

  // Calculate voice score
  const positiveVoice = segments.filter(s => s.voiceTone === "Positive").length;
  const negativeVoice = segments.filter(s => s.voiceTone === "Negative").length;
  const voiceScore = ((positiveVoice - negativeVoice) / segments.length + 1) * 50;

  // Combined score (weighted: 60% text, 40% voice)
  const combinedScore = textScore * 0.6 + voiceScore * 0.4;

  // Check alignment
  const agreementRatio = segments.filter(s => s.agreement).length / segments.length;
  let alignment: "aligned" | "misaligned" | "partially_aligned";
  
  if (agreementRatio > 0.7) alignment = "aligned";
  else if (agreementRatio < 0.4) alignment = "misaligned";
  else alignment = "partially_aligned";

  return {
    textScore: Math.round(textScore),
    voiceScore: Math.round(voiceScore),
    combinedScore: Math.round(combinedScore),
    alignment,
  };
}

/**
 * Calculate voice tone distribution
 */
function calculateVoiceToneDistribution(segments: VoiceToneSegment[]) {
  if (segments.length === 0) {
    return {
      positiveRatio: 0,
      neutralRatio: 0,
      negativeRatio: 0,
      avgConfidence: 0,
    };
  }

  const positive = segments.filter(s => s.tone === "Positive").length;
  const neutral = segments.filter(s => s.tone === "Neutral").length;
  const negative = segments.filter(s => s.tone === "Negative").length;
  const avgConfidence = segments.reduce((sum, s) => sum + s.confidence, 0) / segments.length;

  return {
    positiveRatio: positive / segments.length,
    neutralRatio: neutral / segments.length,
    negativeRatio: negative / segments.length,
    avgConfidence,
  };
}
