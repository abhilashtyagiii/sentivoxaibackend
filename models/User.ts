import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  _id: string;
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'recruiter' | 'candidate';
  isDefaultPassword?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'recruiter', 'candidate'], default: 'recruiter' },
  isDefaultPassword: { type: Boolean, default: false }
}, {
  timestamps: true
});

export const UserModel = mongoose.model<IUser>('User', UserSchema);
