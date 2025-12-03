import mongoose, { Schema, Document } from 'mongoose';

export interface ICandidate extends Document {
  _id: string;
  name: string;
  email: string;
  appliedRole: string;
  recruiterId: mongoose.Types.ObjectId;
  interviewIds: mongoose.Types.ObjectId[];
  performance?: {
    averageScore?: number;
    totalInterviews?: number;
    strengths?: string[];
    weaknesses?: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

const CandidateSchema = new Schema<ICandidate>({
  name: { type: String, required: true },
  email: { type: String, required: true },
  appliedRole: { type: String, required: true },
  recruiterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  interviewIds: [{ type: Schema.Types.ObjectId, ref: 'Interview' }],
  performance: {
    averageScore: Number,
    totalInterviews: Number,
    strengths: [String],
    weaknesses: [String]
  }
}, {
  timestamps: true
});

export const CandidateModel = mongoose.model<ICandidate>('Candidate', CandidateSchema);
