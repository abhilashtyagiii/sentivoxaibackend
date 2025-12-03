import { z } from "zod";

// User types
export const insertUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['admin', 'recruiter', 'candidate']).default('recruiter'),
  isDefaultPassword: z.boolean().optional()
});

export type InsertUser = z.infer<typeof insertUserSchema>;

export interface User {
  _id: string;
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'recruiter' | 'candidate';
  isDefaultPassword?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Candidate types
export const insertCandidateSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  appliedRole: z.string().min(1),
  recruiterId: z.string()
});

export type InsertCandidate = z.infer<typeof insertCandidateSchema>;

export interface Candidate {
  _id: string;
  name: string;
  email: string;
  appliedRole: string;
  recruiterId: string;
  interviewIds: string[];
  performance?: {
    averageScore?: number;
    totalInterviews?: number;
    strengths?: string[];
    weaknesses?: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

// Interview types
export const insertInterviewSchema = z.object({
  fileName: z.string(),
  filePath: z.string(),
  jobDescription: z.string().optional().default(''),
  recruiterName: z.string().optional(),
  candidateName: z.string().optional(),
  candidateId: z.string().optional(),
  recruiterId: z.string().optional()
});

export type InsertInterview = z.infer<typeof insertInterviewSchema>;

export interface Interview {
  _id: string;
  candidateId?: string;
  recruiterId?: string;
  fileName: string;
  filePath: string;
  jobDescription: string;
  recruiterName?: string;
  candidateName?: string;
  candidateOutcome?: string;
  outcomeUpdatedAt?: Date;
  resumeFileName?: string;
  resumeFilePath?: string;
  resumeText?: string;
  audioUrl?: string;
  transcript?: any;
  encryptedTranscript?: string;
  piiRedacted?: boolean;
  piiEntities?: any;
  voiceToneAnalysis?: any;
  sentimentAnalysis?: any;
  multiModalSentiment?: any;
  jdAnalysis?: any;
  embeddingAnalysis?: any;
  flowAnalysis?: any;
  graphFlowModel?: any;
  resumeAnalysis?: any;
  candidateReport?: any;
  recruiterReport?: any;
  explainabilityData?: any;
  processingStatus: string;
  processingSteps?: any[];
  apiUsageMetrics?: any;
  createdAt: Date;
  updatedAt: Date;
}

// Analysis Report types
export const insertAnalysisReportSchema = z.object({
  interviewId: z.string(),
  sentiment: z.any().optional(),
  jdRelevance: z.any().optional(),
  flow: z.any().optional(),
  recommendations: z.any().optional(),
  summary: z.any().optional(),
  recruiterSentiment: z.number().optional(),
  candidateEngagement: z.number().optional(),
  jdMatchScore: z.number().optional(),
  embeddingMatchScore: z.number().optional(),
  flowContinuityScore: z.number().optional(),
  voiceToneScore: z.number().optional(),
  insights: z.any().optional(),
  qaAnalysis: z.any().optional(),
  reportData: z.any().optional(),
  trainingRecommendations: z.any().optional(),
  scoreExplanations: z.any().optional()
});

export type InsertAnalysisReport = z.infer<typeof insertAnalysisReportSchema>;

export interface AnalysisReport {
  _id: string;
  interviewId: string;
  sentiment?: any;
  jdRelevance?: any;
  flow?: any;
  recommendations?: any;
  summary?: any;
  recruiterSentiment?: number;
  candidateEngagement?: number;
  jdMatchScore?: number;
  embeddingMatchScore?: number;
  flowContinuityScore?: number;
  voiceToneScore?: number;
  insights?: any;
  qaAnalysis?: any;
  reportData?: any;
  trainingRecommendations?: any;
  scoreExplanations?: any;
  createdAt: Date;
  updatedAt: Date;
}

// Recruiter Metrics types
export const insertRecruiterMetricsSchema = z.object({
  recruiterId: z.string().optional(),
  recruiterName: z.string(),
  interviewId: z.string(),
  totalInterviews: z.number().optional(),
  avgRelevance: z.number().optional(),
  avgSentiment: z.number().optional(),
  lastActivity: z.date().optional(),
  averageSentiment: z.number().optional(),
  questionRelevanceScore: z.number().optional(),
  flowContinuityScore: z.number().optional(),
  followUpQuality: z.number().optional(),
  logicalConnectionsScore: z.number().optional(),
  missedFollowUps: z.number().optional(),
  totalQuestions: z.number().optional(),
  performanceRating: z.string().optional(),
  strengths: z.any().optional(),
  weaknesses: z.any().optional()
});

export type InsertRecruiterMetrics = z.infer<typeof insertRecruiterMetricsSchema>;

export interface RecruiterMetrics {
  _id: string;
  recruiterId?: string;
  recruiterName: string;
  interviewId: string;
  totalInterviews?: number;
  avgRelevance?: number;
  avgSentiment?: number;
  lastActivity?: Date;
  averageSentiment?: number;
  questionRelevanceScore?: number;
  flowContinuityScore?: number;
  followUpQuality?: number;
  logicalConnectionsScore?: number;
  missedFollowUps?: number;
  totalQuestions?: number;
  performanceRating?: string;
  strengths?: any;
  weaknesses?: any;
  createdAt: Date;
  updatedAt: Date;
}

// Pipeline Monitoring types
export const insertPipelineMonitoringSchema = z.object({
  interviewId: z.string().optional(),
  stage: z.string(),
  status: z.string(),
  startTime: z.date().optional(),
  endTime: z.date().optional(),
  duration: z.number().optional(),
  apiCalls: z.number().optional(),
  tokensUsed: z.number().optional(),
  errorCount: z.number().optional(),
  errorDetails: z.any().optional(),
  metadata: z.any().optional()
});

export type InsertPipelineMonitoring = z.infer<typeof insertPipelineMonitoringSchema>;

export interface PipelineMonitoring {
  _id: string;
  interviewId?: string;
  stage: string;
  status: string;
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  apiCalls?: number;
  tokensUsed?: number;
  errorCount?: number;
  errorDetails?: any;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}
