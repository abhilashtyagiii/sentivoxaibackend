import { transcribeAudio, analyzeSentiment, analyzeJDRelevance, analyzeFlow, analyzeContentType } from "./gemini";
import { analyzeResumeTranscriptAlignment } from "./resumeAnalysis";
import { generateCandidateReport, generateRecruiterReport } from "./resume-reports";
import { storage } from "../storage";
import type { Interview } from "@shared/schema";

export interface ProcessingStep {
  name: string;
  status: "pending" | "processing" | "complete" | "error";
  message: string;
  timestamp: Date;
}

export async function processInterview(interviewId: string): Promise<void> {
  const interview = await storage.getInterview(interviewId);
  if (!interview) {
    throw new Error("Interview not found");
  }

  const hasResume = !!interview.resumeText;
  
  const steps: ProcessingStep[] = [
    { name: "Transcribing Interview", status: "pending", message: "Converting audio to text transcript", timestamp: new Date() },
    { name: "Validating Format", status: "pending", message: "Checking interview structure and participants", timestamp: new Date() },
    { name: "Analyzing Conversation Tone", status: "pending", message: "Evaluating emotional engagement throughout interview", timestamp: new Date() },
    { name: "Matching Job Requirements", status: "pending", message: "Comparing responses with job description", timestamp: new Date() },
    { name: "Evaluating Interview Quality", status: "pending", message: "Assessing conversation flow and effectiveness", timestamp: new Date() },
    ...(hasResume ? [{ name: "Comparing Resume", status: "pending" as const, message: "Cross-checking resume with interview responses", timestamp: new Date() }] : []),
    { name: "Generating Insights", status: "pending", message: "Creating comprehensive analysis report", timestamp: new Date() }
  ];

  try {
    // Update processing status
    await storage.updateInterview(interviewId, {
      processingStatus: "processing",
      processingSteps: steps
    });

    // Step 1: Audio Transcription
    steps[0].status = "processing";
    steps[0].message = "Transcribing audio...";
    await storage.updateInterview(interviewId, { processingSteps: steps });
    
    const transcriptionResult = await transcribeAudio(interview.filePath);
    steps[0].status = "complete";
    steps[1].status = "processing";
    
    await storage.updateInterview(interviewId, {
      transcript: transcriptionResult,
      processingSteps: steps
    });

    // Step 2: Content Classification (smart analysis with validation)
    steps[1].status = "processing";
    await storage.updateInterview(interviewId, { processingSteps: steps });
    
    const contentAnalysis = await analyzeContentType(transcriptionResult.segments);
    console.log(`Content classified as: ${contentAnalysis.contentType} with ${contentAnalysis.speakerCount} speakers`);
    
    // Pre-analysis validation: Check if content is suitable for interview analysis
    if (contentAnalysis.speakerCount < 2) {
      steps[1].status = "error";
      steps[1].message = "Invalid Audio Format: Sentivox requires a two-person interview to perform analysis. This audio contains only one speaker.";
      
      await storage.updateInterview(interviewId, {
        processingStatus: "error",
        processingSteps: steps
      });
      
      throw new Error("Invalid Audio Format: Sentivox requires a two-person interview to perform analysis. Please upload a valid file.");
    }
    
    if (contentAnalysis.contentType !== 'interview' || !contentAnalysis.isJobRelated) {
      steps[1].status = "error";
      steps[1].message = `Content is not a job interview (detected: ${contentAnalysis.contentType}). Sentivox requires a two-person job interview for analysis.`;
      
      await storage.updateInterview(interviewId, {
        processingStatus: "error",
        processingSteps: steps
      });
      
      throw new Error(`Cannot analyze - content is not a job interview. Detected content type: ${contentAnalysis.contentType}`);
    }
    
    steps[1].status = "complete";
    steps[2].status = "processing";
    await storage.updateInterview(interviewId, { processingSteps: steps });

    // Steps 3-5: Run Sentiment, JD Relevance, and Flow analyses in parallel for faster processing
    steps[2].status = "processing";
    steps[3].status = "processing";
    steps[4].status = "processing";
    await storage.updateInterview(interviewId, { processingSteps: steps });
    
    const [sentimentResult, jdResult, flowResult] = await Promise.all([
      analyzeSentiment(transcriptionResult.segments, contentAnalysis),
      analyzeJDRelevance(interview.jobDescription, transcriptionResult.segments, contentAnalysis),
      analyzeFlow(transcriptionResult.segments, contentAnalysis)
    ]);
    
    steps[2].status = "complete";
    steps[3].status = "complete";
    steps[4].status = "complete";
    
    // Save all analysis results at once for efficiency
    await storage.updateInterview(interviewId, {
      sentimentAnalysis: sentimentResult,
      jdAnalysis: jdResult,
      flowAnalysis: flowResult,
      processingSteps: steps
    });

    // Step 6 (Optional): Resume Analysis
    if (hasResume && interview.resumeText) {
      const resumeStepIndex = steps.findIndex(s => s.name === "Comparing Resume");
      if (resumeStepIndex >= 0) {
        steps[resumeStepIndex].status = "processing";
        await storage.updateInterview(interviewId, { processingSteps: steps });

        const resumeAnalysisResult = await analyzeResumeTranscriptAlignment(
          interview.resumeText,
          transcriptionResult.segments,
          interview.jobDescription
        );

        steps[resumeStepIndex].status = "complete";
        steps[resumeStepIndex].message = "Resume comparison completed";

        await storage.updateInterview(interviewId, {
          resumeAnalysis: resumeAnalysisResult.resumeAnalysis,
          candidateReport: resumeAnalysisResult.candidateReport,
          recruiterReport: resumeAnalysisResult.recruiterReport,
          processingSteps: steps
        });
      }
    }

    // Step 6/7: Generate Report
    const reportStepIndex = steps.findIndex(s => s.name === "Generating Insights");
    if (reportStepIndex >= 0) {
      steps[reportStepIndex].status = "processing";
      await storage.updateInterview(interviewId, { processingSteps: steps });
    }
    const reportData = await generateAnalysisReport(
      transcriptionResult,
      sentimentResult,
      jdResult,
      flowResult
    );

    await storage.createAnalysisReport({
      interviewId,
      recruiterSentiment: sentimentResult.recruiterSentiment.overallScore,
      candidateEngagement: calculateEngagementScore(transcriptionResult.segments, sentimentResult.candidateSentiment),
      jdMatchScore: jdResult.overallScore,
      flowContinuityScore: flowResult.continuityScore,
      insights: flowResult.insights,
      qaAnalysis: extractQAAnalysis(transcriptionResult.segments, jdResult, sentimentResult),
      reportData
    });

    if (reportStepIndex >= 0) {
      steps[reportStepIndex].status = "complete";
      steps[reportStepIndex].message = "Comprehensive insights ready";
    }
    
    await storage.updateInterview(interviewId, {
      processingStatus: "complete",
      processingSteps: steps
    });

  } catch (error) {
    console.error("Processing failed:", error);
    const currentStep = steps.findIndex(s => s.status === "processing");
    if (currentStep >= 0) {
      steps[currentStep].status = "error";
      
      // Provide specific error messages for common issues
      if (error instanceof Error) {
        if (error.message.includes('GEMINI_API_KEY')) {
          steps[currentStep].message = 'GEMINI_API_KEY is missing or invalid. Please check your environment configuration.';
        } else if (error.message.includes('Failed to initialize Gemini')) {
          steps[currentStep].message = 'Failed to connect to Gemini AI. Please verify your GEMINI_API_KEY.';
        } else {
          steps[currentStep].message = error.message;
        }
      } else {
        steps[currentStep].message = 'Unknown error occurred during processing';
      }
    }
    
    await storage.updateInterview(interviewId, {
      processingStatus: "error",
      processingSteps: steps
    });
    throw error;
  }
}

function calculateEngagementScore(segments: any[], candidateSentiment: any): number {
  const candidateSegments = segments.filter((s: any) => s.speaker === "Candidate");
  
  if (candidateSegments.length === 0) {
    return 0; // No candidate participation
  }

  // Calculate multiple engagement factors
  const avgResponseLength = candidateSegments.reduce((acc: number, s: any) => acc + s.text.length, 0) / candidateSegments.length;
  const sentimentScore = candidateSentiment.overallScore * 10; // Convert 1-10 to 10-100 scale
  
  // Better length scoring: reward substantial responses
  let lengthScore = 0;
  if (avgResponseLength > 150) {
    lengthScore = 90; // Very detailed responses
  } else if (avgResponseLength > 100) {
    lengthScore = 80; // Good detail
  } else if (avgResponseLength > 50) {
    lengthScore = 70; // Decent responses
  } else if (avgResponseLength > 20) {
    lengthScore = 50; // Short but present
  } else {
    lengthScore = 30; // Very short responses
  }
  
  // Count questions answered (engagement breadth)
  const recruiterQuestions = segments.filter((s: any) => s.speaker === "Recruiter" && s.text?.includes("?")).length;
  const participationScore = recruiterQuestions > 0 ? Math.min(100, (candidateSegments.length / recruiterQuestions) * 70) : 70;
  
  // Weighted average: sentiment most important, then length, then participation
  const finalScore = Math.round((sentimentScore * 0.5) + (lengthScore * 0.3) + (participationScore * 0.2));
  
  return Math.max(10, Math.min(100, finalScore)); // Ensure between 10-100
}

function extractQAAnalysis(segments: any[], jdResult: any, sentimentResult?: any) {
  const qaList: any[] = [];
  let currentQ: any = null;
  
  for (const segment of segments) {
    if (segment.speaker === "Recruiter" && segment.text?.includes("?")) {
      if (currentQ) {
        qaList.push(currentQ);
      }
      
      // Find question relevance score and reasoning, properly handle 0 values
      const questionRelevance = jdResult.questionRelevance?.find((q: any) => q.question === segment.text);
      const relevanceScore = questionRelevance?.relevanceScore !== undefined ? questionRelevance.relevanceScore : 0;
      const reasoning = questionRelevance?.reasoning || null;
      
      currentQ = {
        question: segment.text || "",
        timestamp: segment.timestamp,
        answers: [],
        relevance: relevanceScore,
        reasoning: reasoning
      };
    } else if (segment.speaker === "Candidate" && currentQ) {
      // Find answer alignment from JD analysis
      const answerAlignment = jdResult.answerAlignment?.find((a: any) => a.answer === segment.text);
      const jdMatchScore = answerAlignment?.alignmentScore !== undefined ? answerAlignment.alignmentScore : 0;
      const answerReasoning = answerAlignment?.reasoning || null;
      
      // Use intent-matching score from analysis
      const matchData = answerAlignment?.matchData || {};
      const matchScore = matchData.matchScore || jdMatchScore || 50;
      const matchLevel = matchData.matchLevel || "Fair Match";
      const matchExplanation = matchData.explanation || answerReasoning || "Unable to generate explanation";
      
      currentQ.answers.push({
        text: segment.text || "",
        timestamp: segment.timestamp,
        matchScore: matchScore,
        matchLevel: matchLevel,
        matchExplanation: matchExplanation,
        jdMatch: jdMatchScore,
        reasoning: answerReasoning
      });
    }
  }
  
  if (currentQ) {
    qaList.push(currentQ);
  }
  
  return qaList;
}

async function generateAnalysisReport(transcription: any, sentiment: any, jd: any, flow: any) {
  return {
    summary: {
      interviewLength: transcription.segments.length > 0 ? "12:30" : "Unknown",
      questionsAsked: transcription.segments.filter((s: any) => s.speaker === "Recruiter" && s.text?.includes("?")).length,
      avgResponseLength: Math.round(transcription.segments
        .filter((s: any) => s.speaker === "Candidate")
        .reduce((acc: number, s: any) => acc + (s.text?.length || 0), 0) / transcription.segments.filter((s: any) => s.speaker === "Candidate").length || 1)
    },
    recommendations: [
      "Strong technical competency demonstrated",
      "Focus more on leadership experience in follow-up",
      "Consider discussing team collaboration scenarios"
    ]
  };
}
