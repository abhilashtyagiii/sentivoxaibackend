import mongoose, { Schema, Document } from 'mongoose';

export interface IPipelineMonitoring extends Document {
  _id: string;
  interviewId?: mongoose.Types.ObjectId;
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

const PipelineMonitoringSchema = new Schema<IPipelineMonitoring>({
  interviewId: { type: Schema.Types.ObjectId, ref: 'Interview' },
  stage: { type: String, required: true },
  status: { type: String, required: true },
  startTime: Date,
  endTime: Date,
  duration: Number,
  apiCalls: Number,
  tokensUsed: Number,
  errorCount: Number,
  errorDetails: Schema.Types.Mixed,
  metadata: Schema.Types.Mixed
}, {
  timestamps: true
});

export const PipelineMonitoringModel = mongoose.model<IPipelineMonitoring>('PipelineMonitoring', PipelineMonitoringSchema);
