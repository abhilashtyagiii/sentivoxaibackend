import mongoose, { Schema, Document } from 'mongoose';

export interface IRecruiterMetrics extends Document {
  _id: string;
  recruiterId: mongoose.Types.ObjectId;
  recruiterName: string;
  interviewId: mongoose.Types.ObjectId;
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

const RecruiterMetricsSchema = new Schema<IRecruiterMetrics>({
  recruiterId: { type: Schema.Types.ObjectId, ref: 'User' },
  recruiterName: { type: String, required: true },
  interviewId: { type: Schema.Types.ObjectId, ref: 'Interview', required: true },
  totalInterviews: Number,
  avgRelevance: Number,
  avgSentiment: Number,
  lastActivity: Date,
  averageSentiment: Number,
  questionRelevanceScore: Number,
  flowContinuityScore: Number,
  followUpQuality: Number,
  logicalConnectionsScore: Number,
  missedFollowUps: Number,
  totalQuestions: Number,
  performanceRating: String,
  strengths: Schema.Types.Mixed,
  weaknesses: Schema.Types.Mixed
}, {
  timestamps: true
});

export const RecruiterMetricsModel = mongoose.model<IRecruiterMetrics>('RecruiterMetrics', RecruiterMetricsSchema);
