import { UserModel } from "./models/User";
import { CandidateModel } from "./models/Candidate";
import { InterviewModel } from "./models/Interview";
import { AnalysisReportModel } from "./models/AnalysisReport";
import { RecruiterMetricsModel } from "./models/RecruiterMetrics";
import { PipelineMonitoringModel } from "./models/PipelineMonitoring";
import type {
  User, InsertUser, Candidate, InsertCandidate, Interview, InsertInterview,
  AnalysisReport, InsertAnalysisReport, RecruiterMetrics, InsertRecruiterMetrics,
  PipelineMonitoring, InsertPipelineMonitoring
} from "@shared/schema";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User | null>;
  getAllUsers(): Promise<User[]>;
  deleteUser(id: string): Promise<boolean>;
  
  // Candidate methods
  getCandidate(id: string): Promise<Candidate | null>;
  getCandidateByEmail(email: string): Promise<Candidate | null>;
  createCandidate(candidate: InsertCandidate): Promise<Candidate>;
  updateCandidate(id: string, data: Partial<Candidate>): Promise<Candidate | null>;
  getAllCandidates(): Promise<Candidate[]>;
  getCandidatesByRecruiter(recruiterId: string): Promise<Candidate[]>;
  deleteCandidate(id: string): Promise<boolean>;
  
  // Interview methods
  createInterview(interview: InsertInterview): Promise<Interview>;
  getInterview(id: string): Promise<Interview | null>;
  updateInterview(id: string, data: Partial<Interview>): Promise<Interview | null>;
  getAllInterviews(): Promise<Interview[]>;
  getInterviewsByRecruiter(recruiterId: string): Promise<Interview[]>;
  getInterviewsByCandidate(candidateId: string): Promise<Interview[]>;
  deleteInterview(id: string): Promise<boolean>;
  
  // Analysis Report methods
  createAnalysisReport(report: InsertAnalysisReport): Promise<AnalysisReport>;
  getAnalysisReportByInterviewId(interviewId: string): Promise<AnalysisReport | null>;
  getAllAnalysisReports(): Promise<AnalysisReport[]>;
  
  // Recruiter Metrics methods
  createRecruiterMetrics(metrics: InsertRecruiterMetrics): Promise<RecruiterMetrics>;
  getRecruiterMetricsByInterviewId(interviewId: string): Promise<RecruiterMetrics | null>;
  getAllRecruiterMetrics(): Promise<RecruiterMetrics[]>;
  getRecruiterMetricsByName(recruiterName: string): Promise<RecruiterMetrics[]>;
  getRecruiterMetricsByRecruiterId(recruiterId: string): Promise<RecruiterMetrics[]>;
  
  // Pipeline Monitoring methods
  createPipelineMonitoring(monitoring: InsertPipelineMonitoring): Promise<PipelineMonitoring>;
  getPipelineMonitoringByInterviewId(interviewId: string): Promise<PipelineMonitoring[]>;
  getAllPipelineMonitoring(): Promise<PipelineMonitoring[]>;
}

function convertToPlainObject(doc: any): any {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : doc;
  if (obj._id) {
    obj._id = obj._id.toString();
  }
  if (obj.candidateId) {
    obj.candidateId = obj.candidateId.toString();
  }
  if (obj.recruiterId) {
    obj.recruiterId = obj.recruiterId.toString();
  }
  if (obj.interviewId) {
    obj.interviewId = obj.interviewId.toString();
  }
  if (obj.interviewIds && Array.isArray(obj.interviewIds)) {
    obj.interviewIds = obj.interviewIds.map((id: any) => id.toString());
  }
  return obj;
}

export class MongoDBStorage implements IStorage {
  // User methods
  async getUser(id: string): Promise<User | null> {
    const user = await UserModel.findById(id);
    return convertToPlainObject(user);
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const user = await UserModel.findOne({ email: email.toLowerCase() });
    return convertToPlainObject(user);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const user = await UserModel.create({
      ...insertUser,
      email: insertUser.email.toLowerCase()
    });
    return convertToPlainObject(user);
  }

  async updateUser(id: string, data: Partial<User>): Promise<User | null> {
    const user = await UserModel.findByIdAndUpdate(
      id,
      data,
      { new: true }
    );
    return convertToPlainObject(user);
  }

  async getAllUsers(): Promise<User[]> {
    const users = await UserModel.find();
    return users.map(convertToPlainObject);
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await UserModel.findByIdAndDelete(id);
    return !!result;
  }

  // Candidate methods
  async getCandidate(id: string): Promise<Candidate | null> {
    const candidate = await CandidateModel.findById(id);
    return convertToPlainObject(candidate);
  }

  async getCandidateByEmail(email: string): Promise<Candidate | null> {
    const candidate = await CandidateModel.findOne({ email: email.toLowerCase() });
    return convertToPlainObject(candidate);
  }

  async createCandidate(insertCandidate: InsertCandidate): Promise<Candidate> {
    const candidate = await CandidateModel.create({
      ...insertCandidate,
      email: insertCandidate.email.toLowerCase(),
      interviewIds: []
    });
    return convertToPlainObject(candidate);
  }

  async updateCandidate(id: string, data: Partial<Candidate>): Promise<Candidate | null> {
    const candidate = await CandidateModel.findByIdAndUpdate(
      id,
      data,
      { new: true }
    );
    return convertToPlainObject(candidate);
  }

  async getAllCandidates(): Promise<Candidate[]> {
    const candidates = await CandidateModel.find();
    return candidates.map(convertToPlainObject);
  }

  async getCandidatesByRecruiter(recruiterId: string): Promise<Candidate[]> {
    const candidates = await CandidateModel.find({ recruiterId });
    return candidates.map(convertToPlainObject);
  }

  async deleteCandidate(id: string): Promise<boolean> {
    const result = await CandidateModel.findByIdAndDelete(id);
    return !!result;
  }

  // Interview methods
  async createInterview(insertInterview: InsertInterview): Promise<Interview> {
    const interview = await InterviewModel.create({
      ...insertInterview,
      processingStatus: "pending",
      candidateOutcome: "pending",
      piiRedacted: false,
      processingSteps: []
    });
    return convertToPlainObject(interview);
  }

  async getInterview(id: string): Promise<Interview | null> {
    const interview = await InterviewModel.findById(id);
    return convertToPlainObject(interview);
  }

  async updateInterview(id: string, data: Partial<Interview>): Promise<Interview | null> {
    const interview = await InterviewModel.findByIdAndUpdate(
      id,
      data,
      { new: true }
    );
    return convertToPlainObject(interview);
  }

  async getAllInterviews(): Promise<Interview[]> {
    const interviews = await InterviewModel.find().sort({ createdAt: -1 });
    return interviews.map(convertToPlainObject);
  }

  async getInterviewsByRecruiter(recruiterId: string): Promise<Interview[]> {
    const interviews = await InterviewModel.find({ recruiterId }).sort({ createdAt: -1 });
    return interviews.map(convertToPlainObject);
  }

  async getInterviewsByCandidate(candidateId: string): Promise<Interview[]> {
    const interviews = await InterviewModel.find({ candidateId }).sort({ createdAt: -1 });
    return interviews.map(convertToPlainObject);
  }

  async deleteInterview(id: string): Promise<boolean> {
    const result = await InterviewModel.findByIdAndDelete(id);
    return !!result;
  }

  // Analysis Report methods
  async createAnalysisReport(insertReport: InsertAnalysisReport): Promise<AnalysisReport> {
    const report = await AnalysisReportModel.create(insertReport);
    return convertToPlainObject(report);
  }

  async getAnalysisReportByInterviewId(interviewId: string): Promise<AnalysisReport | null> {
    const report = await AnalysisReportModel.findOne({ interviewId });
    return convertToPlainObject(report);
  }

  async getAllAnalysisReports(): Promise<AnalysisReport[]> {
    const reports = await AnalysisReportModel.find();
    return reports.map(convertToPlainObject);
  }

  // Recruiter Metrics methods
  async createRecruiterMetrics(insertMetrics: InsertRecruiterMetrics): Promise<RecruiterMetrics> {
    const metrics = await RecruiterMetricsModel.create(insertMetrics);
    return convertToPlainObject(metrics);
  }

  async getRecruiterMetricsByInterviewId(interviewId: string): Promise<RecruiterMetrics | null> {
    const metrics = await RecruiterMetricsModel.findOne({ interviewId });
    return convertToPlainObject(metrics);
  }

  async getAllRecruiterMetrics(): Promise<RecruiterMetrics[]> {
    const metrics = await RecruiterMetricsModel.find();
    return metrics.map(convertToPlainObject);
  }

  async getRecruiterMetricsByName(recruiterName: string): Promise<RecruiterMetrics[]> {
    const metrics = await RecruiterMetricsModel.find({ recruiterName });
    return metrics.map(convertToPlainObject);
  }

  async getRecruiterMetricsByRecruiterId(recruiterId: string): Promise<RecruiterMetrics[]> {
    const metrics = await RecruiterMetricsModel.find({ recruiterId });
    return metrics.map(convertToPlainObject);
  }

  // Pipeline Monitoring methods
  async createPipelineMonitoring(insertMonitoring: InsertPipelineMonitoring): Promise<PipelineMonitoring> {
    const monitoring = await PipelineMonitoringModel.create(insertMonitoring);
    return convertToPlainObject(monitoring);
  }

  async getPipelineMonitoringByInterviewId(interviewId: string): Promise<PipelineMonitoring[]> {
    const monitoring = await PipelineMonitoringModel.find({ interviewId });
    return monitoring.map(convertToPlainObject);
  }

  async getAllPipelineMonitoring(): Promise<PipelineMonitoring[]> {
    const monitoring = await PipelineMonitoringModel.find();
    return monitoring.map(convertToPlainObject);
  }
}

export const storage = new MongoDBStorage();
