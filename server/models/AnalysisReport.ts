import mongoose, { Schema, Document } from 'mongoose';

export interface IAnalysisReport extends Document {
  _id: string;
  interviewId: mongoose.Types.ObjectId;
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

const AnalysisReportSchema = new Schema<IAnalysisReport>({
  interviewId: { type: Schema.Types.ObjectId, ref: 'Interview', required: true },
  sentiment: Schema.Types.Mixed,
  jdRelevance: Schema.Types.Mixed,
  flow: Schema.Types.Mixed,
  recommendations: Schema.Types.Mixed,
  summary: Schema.Types.Mixed,
  recruiterSentiment: Number,
  candidateEngagement: Number,
  jdMatchScore: Number,
  embeddingMatchScore: Number,
  flowContinuityScore: Number,
  voiceToneScore: Number,
  insights: Schema.Types.Mixed,
  qaAnalysis: Schema.Types.Mixed,
  reportData: Schema.Types.Mixed,
  trainingRecommendations: Schema.Types.Mixed,
  scoreExplanations: Schema.Types.Mixed
}, {
  timestamps: true
});

export const AnalysisReportModel = mongoose.model<IAnalysisReport>('AnalysisReport', AnalysisReportSchema);
