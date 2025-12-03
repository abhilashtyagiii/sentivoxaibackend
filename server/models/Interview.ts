import mongoose, { Schema, Document } from 'mongoose';

export interface IInterview extends Document {
  _id: string;
  candidateId?: mongoose.Types.ObjectId;
  recruiterId?: mongoose.Types.ObjectId;
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

const InterviewSchema = new Schema<IInterview>({
  candidateId: { type: Schema.Types.ObjectId, ref: 'Candidate' },
  recruiterId: { type: Schema.Types.ObjectId, ref: 'User' },
  fileName: { type: String, required: true },
  filePath: { type: String, required: true },
  jobDescription: { type: String, default: '' },
  recruiterName: String,
  candidateName: String,
  candidateOutcome: { type: String, default: 'pending' },
  outcomeUpdatedAt: Date,
  resumeFileName: String,
  resumeFilePath: String,
  resumeText: String,
  audioUrl: String,
  transcript: Schema.Types.Mixed,
  encryptedTranscript: String,
  piiRedacted: { type: Boolean, default: false },
  piiEntities: Schema.Types.Mixed,
  voiceToneAnalysis: Schema.Types.Mixed,
  sentimentAnalysis: Schema.Types.Mixed,
  multiModalSentiment: Schema.Types.Mixed,
  jdAnalysis: Schema.Types.Mixed,
  embeddingAnalysis: Schema.Types.Mixed,
  flowAnalysis: Schema.Types.Mixed,
  graphFlowModel: Schema.Types.Mixed,
  resumeAnalysis: Schema.Types.Mixed,
  candidateReport: Schema.Types.Mixed,
  recruiterReport: Schema.Types.Mixed,
  explainabilityData: Schema.Types.Mixed,
  processingStatus: { type: String, required: true, default: 'pending' },
  processingSteps: { type: [Schema.Types.Mixed], default: [] },
  apiUsageMetrics: Schema.Types.Mixed
}, {
  timestamps: true
});

export const InterviewModel = mongoose.model<IInterview>('Interview', InterviewSchema);
