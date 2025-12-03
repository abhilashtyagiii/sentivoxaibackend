import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { upload, resumeUpload } from "./utils/fileUpload";
import { processInterview } from "./services/analysis";
import { processEnhancedInterview } from "./services/enhancedAnalysis";
import { insertInterviewSchema } from "@shared/schema";
import { generateDetailedPDFReport } from "./services/pdf-report";
import { generateCandidateReport, generateRecruiterReport } from "./services/resume-reports";
import { parseDocument } from "./services/documentParser";
import { decrypt } from "./services/encryption";
import { requireAuth, requireRole } from "./routes/auth";
import path from "path";

export async function registerRoutes(app: Express): Promise<Server> {
  // Upload audio file and create interview
  app.post("/api/interviews", upload.single('audio'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No audio file uploaded" });
      }

      const { jobDescription, recruiterName, candidateName } = req.body;

      // Validate request data
      const interviewData = insertInterviewSchema.parse({
        fileName: req.file.originalname,
        filePath: req.file.path,
        jobDescription: jobDescription || ""
      });

      const interview = await storage.createInterview(interviewData);
      
      await storage.updateInterview(interview._id, {
        processingStatus: "uploaded",
        recruiterName: recruiterName || null,
        candidateName: candidateName || null
      });
      
      const updatedInterview = await storage.getInterview(interview._id);
      
      if (!updatedInterview) {
        return res.status(500).json({ message: "Failed to retrieve updated interview" });
      }
      
      res.json({ interview: { ...updatedInterview, id: updatedInterview._id } });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Update interview (for updating job description after upload)
  app.patch("/api/interviews/:id", async (req, res) => {
    try {
      const interview = await storage.getInterview(req.params.id);
      if (!interview) {
        return res.status(404).json({ message: "Interview not found" });
      }

      const { jobDescription } = req.body;
      if (jobDescription !== undefined) {
        const updatedInterview = await storage.updateInterview(req.params.id, {
          jobDescription
        });
        res.json({ interview: updatedInterview });
      } else {
        res.status(400).json({ message: "Job description is required" });
      }
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Upload resume for an interview
  app.post("/api/interviews/:id/resume", resumeUpload.single('resume'), async (req, res) => {
    try {
      const interview = await storage.getInterview(req.params.id);
      if (!interview) {
        return res.status(404).json({ message: "Interview not found" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "No resume file uploaded" });
      }

      console.log("Parsing resume:", req.file.originalname);
      const parsedResume = await parseDocument(req.file.path);
      
      const updatedInterview = await storage.updateInterview(req.params.id, {
        resumeFileName: req.file.originalname,
        resumeFilePath: req.file.path,
        resumeText: parsedResume.text
      });

      res.json({ 
        interview: updatedInterview,
        message: "Resume uploaded and parsed successfully"
      });
    } catch (error) {
      console.error("Resume upload error:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : 'Failed to upload resume' });
    }
  });

  // Upload job description file for an interview
  app.post("/api/interviews/:id/job-description", resumeUpload.single('jobDescriptionFile'), async (req, res) => {
    try {
      const interview = await storage.getInterview(req.params.id);
      if (!interview) {
        return res.status(404).json({ message: "Interview not found" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "No job description file uploaded" });
      }

      console.log("Parsing job description file:", req.file.originalname);
      const parsedDocument = await parseDocument(req.file.path);
      
      const updatedInterview = await storage.updateInterview(req.params.id, {
        jobDescription: parsedDocument.text
      });

      res.json({ 
        interview: updatedInterview,
        jobDescription: parsedDocument.text,
        message: "Job description uploaded and extracted successfully"
      });
    } catch (error) {
      console.error("Job description file upload error:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : 'Failed to upload job description file' });
    }
  });

  // Get interview status
  app.get("/api/interviews/:id", async (req, res) => {
    try {
      const interview = await storage.getInterview(req.params.id);
      if (!interview) {
        return res.status(404).json({ message: "Interview not found" });
      }
      res.json({ interview });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Get analysis report
  app.get("/api/interviews/:id/report", async (req, res) => {
    try {
      const interview = await storage.getInterview(req.params.id);
      if (!interview) {
        return res.status(404).json({ message: "Interview not found" });
      }

      const report = await storage.getAnalysisReportByInterviewId(req.params.id);
      if (!report) {
        return res.status(404).json({ message: "Analysis report not found. Processing may still be in progress." });
      }

      res.json({ 
        interview,
        report,
        transcription: interview.transcript,
        sentimentAnalysis: interview.sentimentAnalysis,
        multiModalSentiment: interview.multiModalSentiment,
        jdAnalysis: interview.jdAnalysis,
        embeddingAnalysis: interview.embeddingAnalysis,
        flowAnalysis: interview.flowAnalysis,
        graphFlowModel: interview.graphFlowModel,
        explainabilityData: interview.explainabilityData,
        voiceToneAnalysis: interview.voiceToneAnalysis,
        piiRedacted: interview.piiRedacted,
        piiEntities: interview.piiEntities,
        resumeAnalysis: interview.resumeAnalysis,
        candidateReport: interview.candidateReport,
        recruiterReport: interview.recruiterReport
      });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Get processing status
  app.get("/api/interviews/:id/status", async (req, res) => {
    try {
      const interview = await storage.getInterview(req.params.id);
      if (!interview) {
        return res.status(404).json({ message: "Interview not found" });
      }

      res.json({
        status: interview.processingStatus,
        steps: interview.processingSteps || []
      });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Download report as PDF
  app.get("/api/interviews/:id/download", async (req, res) => {
    try {
      const interview = await storage.getInterview(req.params.id);
      const report = await storage.getAnalysisReportByInterviewId(req.params.id);
      
      if (!interview || !report) {
        return res.status(404).json({ message: "Interview or report not found" });
      }

      const pdfBuffer = generateDetailedPDFReport({
        interview,
        report,
        timestamp: new Date()
      });

      const fileName = `interview-analysis-${interview.fileName.replace(/\.[^/.]+$/, "")}-${new Date().toISOString().split('T')[0]}.pdf`;
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(Buffer.from(pdfBuffer));
    } catch (error) {
      console.error('PDF generation error:', error);
      res.status(500).json({ message: error instanceof Error ? error.message : 'Failed to generate PDF report' });
    }
  });

  // Manually trigger analysis
  app.post("/api/interviews/:id/analyze", async (req, res) => {
    try {
      const interview = await storage.getInterview(req.params.id);
      if (!interview) {
        return res.status(404).json({ message: "Interview not found" });
      }

      if (interview.processingStatus === "processing" || interview.processingStatus === "complete") {
        return res.status(400).json({ message: "Interview is already being processed or complete" });
      }

      // Update job description if provided in request
      const { jobDescription, useEnhancedAnalysis } = req.body;
      if (jobDescription && jobDescription.trim()) {
        await storage.updateInterview(req.params.id, {
          jobDescription: jobDescription.trim()
        });
      }

      // Check if job description exists (either from original upload or from this request)
      const updatedInterview = await storage.getInterview(req.params.id);
      if (!updatedInterview?.jobDescription || updatedInterview.jobDescription.trim() === "") {
        return res.status(400).json({ message: "Job description is required for analysis" });
      }

      // Start processing in background (use enhanced analysis by default for all advanced features)
      // useEnhancedAnalysis can be set to false for faster, basic processing
      const shouldUseEnhanced = useEnhancedAnalysis !== false; // Default to true
      
      if (shouldUseEnhanced) {
        processEnhancedInterview(interview._id).catch(error => {
          console.error("Enhanced processing failed:", error);
        });
      } else {
        processInterview(interview._id).catch(error => {
          console.error("Background processing failed:", error);
        });
      }

      res.json({ message: "Analysis started", interview, mode: shouldUseEnhanced ? "enhanced" : "standard" });
    } catch (error) {
      console.error('Analyze trigger error:', error);
      res.status(500).json({ message: error instanceof Error ? error.message : 'Failed to start analysis' });
    }
  });

  // Generate and download detailed PDF report
  app.get("/api/interviews/:id/pdf", async (req, res) => {
    try {
      const interview = await storage.getInterview(req.params.id);
      const report = await storage.getAnalysisReportByInterviewId(req.params.id);
      
      if (!interview || !report) {
        return res.status(404).json({ message: "Interview or report not found" });
      }

      const pdfBuffer = generateDetailedPDFReport({
        interview,
        report,
        timestamp: new Date()
      });

      // Ensure we always send a proper Node Buffer regardless of the returned shape
      let outBuffer: Buffer;
      if (pdfBuffer instanceof Uint8Array) {
        outBuffer = Buffer.from(pdfBuffer);
      } else if (pdfBuffer && typeof (pdfBuffer as any).byteLength === 'number') {
        // covers ArrayBuffer and similar buffer-like objects
        outBuffer = Buffer.from(new Uint8Array(pdfBuffer as any));
      } else {
        outBuffer = Buffer.from(pdfBuffer as any);
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="interview-analysis-${interview.fileName}-${new Date().toISOString().split('T')[0]}.pdf"`);
      res.setHeader('Content-Length', String(outBuffer.length));
      res.end(outBuffer);
    } catch (error) {
      console.error('PDF generation error:', error);
      res.status(500).json({ message: error instanceof Error ? error.message : 'Failed to generate PDF report' });
    }
  });

  // Download candidate report
  app.get("/api/interviews/:id/candidate-report", async (req, res) => {
    try {
      const interview = await storage.getInterview(req.params.id);
      
      if (!interview) {
        return res.status(404).json({ message: "Interview not found" });
      }

      // Generate basic candidate report from available data if resume report not available
      let candidateData = interview.candidateReport;
      
      if (!candidateData) {
        const report = await storage.getAnalysisReportByInterviewId(req.params.id);
        
        if (!report) {
          return res.status(404).json({ message: "Analysis report not found. Interview may still be processing." });
        }

        // Create basic candidate report from general analysis
        const jdAnalysis = interview.jdAnalysis as any;
        const flowAnalysis = interview.flowAnalysis as any;
        const sentimentAnalysis = interview.sentimentAnalysis as any;
        
        // Calculate overall score based on multiple factors (0-10 scale)
        const engagementScore = (report.candidateEngagement || 50) / 10; // Convert % to 0-10
        const jdMatchScore = (report.jdMatchScore || 50) / 10; // Convert % to 0-10
        const overallScore = Math.round((engagementScore * 0.5 + jdMatchScore * 0.5) * 10) / 10;
        
        // Extract skills from JD analysis
        const categoryBreakdown = jdAnalysis?.categoryBreakdown || {};
        const technicalSkills = categoryBreakdown.technicalSkills || {};
        const demonstratedSkills = technicalSkills.matchedSkills || [];
        const claimedSkills = technicalSkills.missingSkills || [];
        
        // Get strengths and areas for improvement
        const insights = (report.insights as any[]) || [];
        const strengthAreas = Array.isArray(insights) ? insights
          .filter((i: any) => {
            const text = typeof i === 'string' ? i : String(i || '');
            return text.toLowerCase().includes('strength') || 
                   text.toLowerCase().includes('excellent') || 
                   text.toLowerCase().includes('good');
          })
          .map((i: any) => typeof i === 'string' ? i : String(i || ''))
          .slice(0, 3) : [];
        
        const improvementAreas = Array.isArray(insights) ? insights
          .filter((i: any) => {
            const text = typeof i === 'string' ? i : String(i || '');
            return text.toLowerCase().includes('improve') || 
                   text.toLowerCase().includes('consider') || 
                   text.toLowerCase().includes('develop');
          })
          .map((i: any) => typeof i === 'string' ? i : String(i || ''))
          .slice(0, 3) : [];
        
        candidateData = {
          overallScore: overallScore,
          summary: `Interview performance analysis for ${interview.candidateName || 'Candidate'}. Overall engagement: ${Math.round(report.candidateEngagement || 50)}%, Job description alignment: ${Math.round(report.jdMatchScore || 50)}%. ${strengthAreas.length > 0 ? 'Key strengths identified in communication and relevant experience.' : 'Opportunities for growth identified.'}`,
          skillsDemonstration: {
            score: jdMatchScore,
            claimedSkills: claimedSkills.slice(0, 5),
            demonstratedSkills: demonstratedSkills.slice(0, 5)
          },
          consistencyCheck: {
            score: Math.min(10, Math.round((report.candidateEngagement || 50) / 10)),
            inconsistencies: flowAnalysis?.inconsistencies || []
          },
          communicationRating: {
            clarity: Math.min(10, Math.max(1, Math.round(engagementScore * 0.9))),
            confidence: Math.min(10, Math.max(1, Math.round(engagementScore * 1.0))),
            depth: Math.min(10, Math.max(1, Math.round(jdMatchScore * 0.8)))
          },
          strengths: strengthAreas.length > 0 ? strengthAreas : ["Maintained professional communication throughout the interview"],
          areasForImprovement: improvementAreas.length > 0 ? improvementAreas : ["Continue to develop technical depth in responses"]
        };
      }

      const pdfBuffer = generateCandidateReport(
        candidateData as any,
        interview.candidateName || "Candidate",
        interview.createdAt || new Date()
      );

      let outBuffer: Buffer;
      if (pdfBuffer instanceof Uint8Array) {
        outBuffer = Buffer.from(pdfBuffer);
      } else if (pdfBuffer && typeof (pdfBuffer as any).byteLength === 'number') {
        outBuffer = Buffer.from(new Uint8Array(pdfBuffer as any));
      } else {
        outBuffer = Buffer.from(pdfBuffer as any);
      }

      // Generate meaningful filename with candidate name and date
      const candidateName = interview.candidateName ? interview.candidateName.replace(/[^a-zA-Z0-9-_]/g, '_') : 'Unknown';
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `Candidate_Report_${candidateName}_${dateStr}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', String(outBuffer.length));
      res.end(outBuffer);
    } catch (error) {
      console.error('Candidate report generation error:', error);
      res.status(500).json({ message: error instanceof Error ? error.message : 'Failed to generate candidate report' });
    }
  });

  // Download recruiter report
  app.get("/api/interviews/:id/recruiter-report", async (req, res) => {
    try {
      const interview = await storage.getInterview(req.params.id);
      
      if (!interview) {
        return res.status(404).json({ message: "Interview not found" });
      }

      // Generate basic recruiter report from available data if resume report not available
      let recruiterData = interview.recruiterReport;
      
      if (!recruiterData) {
        const report = await storage.getAnalysisReportByInterviewId(req.params.id);
        
        if (!report) {
          return res.status(404).json({ message: "Analysis report not found. Interview may still be processing." });
        }

        // Create basic recruiter report from general analysis
        const jdAnalysis = interview.jdAnalysis as any;
        const flowAnalysis = interview.flowAnalysis as any;
        const trainingRecs = report.trainingRecommendations as any;
        const qaAnalysis = report.qaAnalysis || [];
        
        // Calculate scores from available data
        const recruiterSentimentScore = report.recruiterSentiment || 5;
        const flowContinuityScore = report.flowContinuityScore || 70;
        const jdMatchScore = report.jdMatchScore || 50;
        
        // Calculate overall effectiveness score (0-10 scale)
        const overallScore = Math.round(((recruiterSentimentScore + (flowContinuityScore / 10)) / 2) * 10) / 10;
        
        // Extract question relevance from QA analysis
        const qaArray = Array.isArray(qaAnalysis) ? qaAnalysis : [];
        const relevantQuestions = qaArray.filter((qa: any) => qa.relevance >= 50).length;
        const totalQuestions = qaArray.length;
        const questionRelevanceScore = totalQuestions > 0 
          ? Math.min(10, Math.round((relevantQuestions / totalQuestions) * 10)) 
          : 7;
        
        // Get training recommendations
        const recommendations = trainingRecs?.recommendations || [];
        const performanceGaps = trainingRecs?.performanceGaps || [];
        const strengthAreas = trainingRecs?.strengthAreas || [];
        
        // Extract covered areas from JD analysis
        const categoryBreakdown = jdAnalysis?.categoryBreakdown || {};
        const experienceCovered = Object.entries(categoryBreakdown)
          .filter(([_, data]: [string, any]) => data?.score >= 60)
          .map(([key, _]) => key.replace(/([A-Z])/g, ' $1').trim())
          .slice(0, 3);
        
        const skillsCovered = categoryBreakdown.technicalSkills?.matchedSkills || [];
        const missedOpportunities = categoryBreakdown.technicalSkills?.missingSkills?.slice(0, 3) || [];
        
        recruiterData = {
          questionQuality: {
            resumeRelevance: questionRelevanceScore,
            depth: Math.min(10, Math.max(5, Math.round(jdMatchScore / 10))),
            engagement: Math.min(10, Math.max(5, recruiterSentimentScore))
          },
          interviewCoverage: {
            experienceCovered: experienceCovered.length > 0 ? experienceCovered : ["Technical skills", "Experience level"],
            skillsCovered: skillsCovered.slice(0, 5),
            missedOpportunities: missedOpportunities.length > 0 ? missedOpportunities : []
          },
          effectiveness: {
            score: overallScore,
            strengths: strengthAreas.length > 0 ? strengthAreas : ["Maintained professional and positive tone throughout"],
            improvements: recommendations.map((r: any) => r.recommendation || r).slice(0, 3)
          },
          overallScore: overallScore,
          summary: `Interview conducted by ${interview.recruiterName || 'Recruiter'} for ${interview.candidateName || 'Candidate'}. Overall effectiveness: ${overallScore}/10. Candidate engagement achieved: ${Math.round(report.candidateEngagement || 50)}%. ${performanceGaps.length > 0 ? 'Areas for improvement identified.' : 'Strong interview performance.'}`
        };
      }

      const pdfBuffer = generateRecruiterReport(
        recruiterData as any,
        interview.recruiterName || "Recruiter",
        interview.createdAt || new Date()
      );

      let outBuffer: Buffer;
      if (pdfBuffer instanceof Uint8Array) {
        outBuffer = Buffer.from(pdfBuffer);
      } else if (pdfBuffer && typeof (pdfBuffer as any).byteLength === 'number') {
        outBuffer = Buffer.from(new Uint8Array(pdfBuffer as any));
      } else {
        outBuffer = Buffer.from(pdfBuffer as any);
      }

      // Generate meaningful filename with recruiter name, candidate name, and date
      const recruiterName = interview.recruiterName ? interview.recruiterName.replace(/[^a-zA-Z0-9-_]/g, '_') : 'Unknown';
      const candidateName = interview.candidateName ? interview.candidateName.replace(/[^a-zA-Z0-9-_]/g, '_') : 'Unknown';
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `Recruiter_Report_${recruiterName}_Interview_${candidateName}_${dateStr}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', String(outBuffer.length));
      res.end(outBuffer);
    } catch (error) {
      console.error('Recruiter report generation error:', error);
      res.status(500).json({ message: error instanceof Error ? error.message : 'Failed to generate recruiter report' });
    }
  });

  // ===== Enhanced Features Routes =====

  // Get decrypted transcript
  app.get("/api/interviews/:id/transcript", async (req, res) => {
    try {
      const interview = await storage.getInterview(req.params.id);
      if (!interview) {
        return res.status(404).json({ message: "Interview not found" });
      }

      if (!interview.encryptedTranscript) {
        return res.status(404).json({ message: "Encrypted transcript not available" });
      }

      const decryptedTranscript = decrypt(interview.encryptedTranscript);
      res.json({ transcript: decryptedTranscript, piiRedacted: interview.piiRedacted });
    } catch (error) {
      console.error('Decrypt transcript error:', error);
      res.status(500).json({ message: error instanceof Error ? error.message : 'Failed to decrypt transcript' });
    }
  });

  // Get all interviews (for dashboards)
  app.get("/api/interviews", async (req, res) => {
    try {
      const interviews = await storage.getAllInterviews();
      const interviewsWithId = interviews.map(interview => ({
        ...interview,
        id: interview._id
      }));
      res.json({ interviews: interviewsWithId });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : 'Failed to fetch interviews' });
    }
  });

  // Get recruiter metrics by interview
  app.get("/api/interviews/:id/metrics", async (req, res) => {
    try {
      const metrics = await storage.getRecruiterMetricsByInterviewId(req.params.id);
      if (!metrics) {
        return res.status(404).json({ message: "Recruiter metrics not found" });
      }
      res.json({ metrics });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : 'Failed to fetch metrics' });
    }
  });

  // Get all recruiter metrics (for benchmarking)
  app.get("/api/recruiter-metrics", async (req, res) => {
    try {
      const { recruiterName } = req.query;
      let metrics;
      
      if (recruiterName && typeof recruiterName === 'string') {
        metrics = await storage.getRecruiterMetricsByName(recruiterName);
      } else {
        metrics = await storage.getAllRecruiterMetrics();
      }
      
      res.json({ metrics });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : 'Failed to fetch recruiter metrics' });
    }
  });

  // Get recruiter benchmarking data
  app.get("/api/benchmarking", async (req, res) => {
    try {
      const allMetrics = await storage.getAllRecruiterMetrics();
      
      // Calculate benchmarking statistics
      const recruiterGroups: Record<string, any[]> = {};
      allMetrics.forEach(metric => {
        if (!recruiterGroups[metric.recruiterName]) {
          recruiterGroups[metric.recruiterName] = [];
        }
        recruiterGroups[metric.recruiterName].push(metric);
      });

      const benchmarks = Object.entries(recruiterGroups).map(([name, metrics]) => {
        const avgQuestionRelevance = metrics.reduce((sum, m) => sum + (m.questionRelevanceScore || 0), 0) / metrics.length;
        const avgFlowContinuity = metrics.reduce((sum, m) => sum + (m.flowContinuityScore || 0), 0) / metrics.length;
        const avgFollowUpQuality = metrics.reduce((sum, m) => sum + (m.followUpQuality || 0), 0) / metrics.length;
        const totalInterviews = metrics.length;
        const avgMissedFollowUps = metrics.reduce((sum, m) => sum + (m.missedFollowUps || 0), 0) / metrics.length;

        return {
          recruiterName: name,
          totalInterviews,
          avgQuestionRelevance,
          avgFlowContinuity,
          avgFollowUpQuality,
          avgMissedFollowUps,
          performanceRating: metrics[0]?.performanceRating || "unknown",
        };
      });

      res.json({ benchmarks });
    } catch (error) {
      console.error('Benchmarking error:', error);
      res.status(500).json({ message: error instanceof Error ? error.message : 'Failed to fetch benchmarking data' });
    }
  });

  // Get pipeline monitoring data
  app.get("/api/pipeline-monitoring", async (req, res) => {
    try {
      const { interviewId } = req.query;
      let monitoring;
      
      if (interviewId && typeof interviewId === 'string') {
        monitoring = await storage.getPipelineMonitoringByInterviewId(interviewId);
      } else {
        monitoring = await storage.getAllPipelineMonitoring();
      }
      
      res.json({ monitoring });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : 'Failed to fetch monitoring data' });
    }
  });

  // Get comparison analytics
  app.get("/api/comparison", async (req, res) => {
    try {
      const interviews = await storage.getAllInterviews();
      const reports = await storage.getAllAnalysisReports();
      
      // Build comparison data
      const comparisons = interviews.map(interview => {
        const report = reports.find(r => r.interviewId === interview._id);
        return {
          id: interview._id,
          fileName: interview.fileName,
          date: interview.createdAt,
          status: interview.processingStatus,
          jdMatchScore: report?.jdMatchScore || 0,
          embeddingMatchScore: report?.embeddingMatchScore || 0,
          flowContinuityScore: report?.flowContinuityScore || 0,
          voiceToneScore: report?.voiceToneScore || 0,
          candidateEngagement: report?.candidateEngagement || 0,
          recruiterSentiment: report?.recruiterSentiment || 0,
        };
      });

      res.json({ comparisons });
    } catch (error) {
      console.error('Comparison analytics error:', error);
      res.status(500).json({ message: error instanceof Error ? error.message : 'Failed to fetch comparison data' });
    }
  });

  // Update candidate outcome
  app.patch("/api/interviews/:id/outcome", async (req, res) => {
    try {
      console.log(`[Outcome Update] Interview ID: ${req.params.id}, Body:`, JSON.stringify(req.body));
      
      const interview = await storage.getInterview(req.params.id);
      if (!interview) {
        console.error(`[Outcome Update] Interview not found: ${req.params.id}`);
        return res.status(404).json({ message: "Interview not found" });
      }

      const { outcome } = req.body;
      console.log(`[Outcome Update] Received outcome: "${outcome}" (type: ${typeof outcome})`);
      
      const validOutcomes = ['pending', 'next_stage', 'rejected'];
      if (!outcome || !validOutcomes.includes(outcome.toLowerCase())) {
        console.error(`[Outcome Update] Invalid outcome: "${outcome}". Must be one of: ${validOutcomes.join(', ')}`);
        return res.status(400).json({ 
          message: `Invalid outcome. Must be one of: ${validOutcomes.join(', ')}`,
          received: outcome 
        });
      }

      // Normalize to lowercase to handle case issues
      const normalizedOutcome = outcome.toLowerCase();
      console.log(`[Outcome Update] Normalizing outcome to: "${normalizedOutcome}"`);

      const updatedInterview = await storage.updateInterview(req.params.id, {
        candidateOutcome: normalizedOutcome,
        outcomeUpdatedAt: new Date()
      });

      if (!updatedInterview) {
        console.error(`[Outcome Update] Failed to update interview: ${req.params.id}`);
        return res.status(500).json({ message: "Failed to update interview outcome" });
      }

      console.log(`[Outcome Update] Successfully updated interview ${req.params.id} to outcome: ${normalizedOutcome}`);
      res.json({ 
        interview: updatedInterview, 
        message: "Candidate outcome updated successfully" 
      });
    } catch (error) {
      console.error('[Outcome Update] Error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to update outcome',
        error: error instanceof Error ? error.stack : 'Unknown error'
      });
    }
  });

  // Get recruiter analytics dashboard data
  app.get("/api/recruiter-dashboard", async (req, res) => {
    try {
      const { recruiterName } = req.query;
      const interviews = await storage.getAllInterviews();
      const reports = await storage.getAllAnalysisReports();
      const metrics = await storage.getAllRecruiterMetrics();

      let filteredInterviews = interviews;
      if (recruiterName && typeof recruiterName === 'string') {
        filteredInterviews = interviews.filter(i => i.recruiterName === recruiterName);
      }

      const totalInterviews = filteredInterviews.length;
      const completedInterviews = filteredInterviews.filter(i => i.processingStatus === 'complete');
      const nextStageCount = filteredInterviews.filter(i => i.candidateOutcome === 'next_stage').length;
      const rejectedCount = filteredInterviews.filter(i => i.candidateOutcome === 'rejected').length;
      const pendingCount = filteredInterviews.filter(i => i.candidateOutcome === 'pending').length;

      const progressionRate = totalInterviews > 0 ? (nextStageCount / totalInterviews) * 100 : 0;
      const rejectionRate = totalInterviews > 0 ? (rejectedCount / totalInterviews) * 100 : 0;

      const avgJdRelevance = completedInterviews.length > 0
        ? completedInterviews.reduce((sum, interview) => {
            const report = reports.find(r => r.interviewId === interview._id);
            return sum + (report?.jdMatchScore || 0);
          }, 0) / completedInterviews.length
        : 0;

      const avgCandidateCommunication = completedInterviews.length > 0
        ? completedInterviews.reduce((sum, interview) => {
            const report = reports.find(r => r.interviewId === interview._id);
            return sum + (report?.candidateEngagement || 0);
          }, 0) / completedInterviews.length
        : 0;

      const avgFlowContinuity = completedInterviews.length > 0
        ? completedInterviews.reduce((sum, interview) => {
            const report = reports.find(r => r.interviewId === interview._id);
            return sum + (report?.flowContinuityScore || 0);
          }, 0) / completedInterviews.length
        : 0;

      const effectivenessScore = ((progressionRate / 100) * 0.4 + (avgJdRelevance / 100) * 0.3 + (avgCandidateCommunication / 100) * 0.3) * 100;

      // Generate dynamic training recommendations
      const recommendations: string[] = [];
      
      if (progressionRate < 40 && totalInterviews > 0) {
        recommendations.push(`Low candidate progression rate (${progressionRate.toFixed(1)}%). Review your assessment criteria and consider if standards are too strict or if questions effectively evaluate candidate fit.`);
      }
      
      if (avgJdRelevance < 60 && completedInterviews.length > 0) {
        recommendations.push(`Job description alignment is below target (${avgJdRelevance.toFixed(1)}%). Prepare targeted questions that directly assess required skills and qualifications from the JD before each interview.`);
      }
      
      if (avgCandidateCommunication < 60 && completedInterviews.length > 0) {
        recommendations.push(`Candidate engagement score is low (${avgCandidateCommunication.toFixed(1)}%). Create a more welcoming environment by building rapport, showing genuine interest, and allowing candidates time to think and respond.`);
      }
      
      if (avgFlowContinuity < 70 && completedInterviews.length > 0) {
        recommendations.push(`Interview flow needs improvement (${avgFlowContinuity.toFixed(1)}%). Practice active listening and ask follow-up questions based on candidate responses to create natural conversation flow.`);
      }
      
      if (rejectionRate > 70 && totalInterviews > 5) {
        recommendations.push(`High rejection rate (${rejectionRate.toFixed(1)}%). Consider if your screening process before interviews can be improved, or if interview questions are identifying the right candidate qualities.`);
      }

      // Add positive reinforcement if doing well
      if (effectivenessScore >= 75 && recommendations.length === 0) {
        recommendations.push(`Excellent performance! Your interview effectiveness score is ${effectivenessScore.toFixed(1)}%. Continue maintaining high standards while staying open to continuous improvement.`);
      } else if (effectivenessScore >= 60 && recommendations.length < 2) {
        recommendations.push(`Good overall performance (${effectivenessScore.toFixed(1)}% effectiveness). Focus on the specific areas above to reach excellent level.`);
      }

      const interviewsWithDetails = filteredInterviews.map(interview => {
        const report = reports.find(r => r.interviewId === interview._id);
        return {
          ...interview,
          id: interview._id,
          report
        };
      });

      res.json({
        totalInterviews,
        completedInterviews: completedInterviews.length,
        nextStageCount,
        rejectedCount,
        pendingCount,
        progressionRate,
        rejectionRate,
        avgJdRelevance,
        avgCandidateCommunication,
        avgFlowContinuity,
        effectivenessScore,
        recommendations,
        interviews: interviewsWithDetails
      });
    } catch (error) {
      console.error('Recruiter dashboard error:', error);
      res.status(500).json({ message: error instanceof Error ? error.message : 'Failed to fetch recruiter dashboard data' });
    }
  });

  // Get candidate dashboard data
  app.get("/api/candidate-dashboard/:interviewId", async (req, res) => {
    try {
      const interview = await storage.getInterview(req.params.interviewId);
      if (!interview) {
        return res.status(404).json({ message: "Interview not found" });
      }

      const report = await storage.getAnalysisReportByInterviewId(req.params.interviewId);
      
      res.json({
        interview,
        report,
        candidateReport: interview.candidateReport,
        recruiterReport: interview.recruiterReport,
        transcription: interview.transcript,
        sentimentAnalysis: interview.sentimentAnalysis,
        jdAnalysis: interview.jdAnalysis,
        flowAnalysis: interview.flowAnalysis,
        resumeAnalysis: interview.resumeAnalysis
      });
    } catch (error) {
      console.error('Candidate dashboard error:', error);
      res.status(500).json({ message: error instanceof Error ? error.message : 'Failed to fetch candidate dashboard data' });
    }
  });

  // ============================================
  // ADMIN ROUTES
  // ============================================

  // Admin - Get analytics overview
  app.get("/api/admin/analytics/overview", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const interviews = await storage.getAllInterviews();
      const candidates = await storage.getAllCandidates();
      const reports = await storage.getAllAnalysisReports();

      const totalRecruiters = users.filter(u => u.role === 'recruiter').length;
      const totalCandidates = candidates.length;
      const totalInterviews = interviews.length;
      
      // Calculate average scores
      let totalSentiment = 0;
      let totalRelevance = 0;
      let validReports = 0;

      reports.forEach(report => {
        if (report.recruiterSentiment !== null && report.recruiterSentiment !== undefined) {
          totalSentiment += report.recruiterSentiment;
          validReports++;
        }
        if (report.jdMatchScore !== null && report.jdMatchScore !== undefined) {
          totalRelevance += report.jdMatchScore;
        }
      });

      const avgSentiment = validReports > 0 ? totalSentiment / validReports : 0;
      const avgRelevance = validReports > 0 ? totalRelevance / validReports : 0;

      res.json({
        totalRecruiters,
        totalCandidates,
        totalInterviews,
        avgSentiment,
        avgRelevance,
        recentInterviews: interviews.slice(0, 10)
      });
    } catch (error) {
      console.error('Admin analytics overview error:', error);
      res.status(500).json({ message: error instanceof Error ? error.message : 'Failed to fetch analytics' });
    }
  });

  // Admin - Get all recruiters with metrics
  app.get("/api/admin/recruiters", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const recruiters = users.filter(u => u.role === 'recruiter');
      const allMetrics = await storage.getAllRecruiterMetrics();
      
      const recruitersWithMetrics = await Promise.all(recruiters.map(async (recruiter) => {
        const recruiterMetrics = allMetrics.filter(m => m.recruiterId === recruiter._id);
        const interviews = await storage.getInterviewsByRecruiter(recruiter._id);
        
        let totalSentiment = 0;
        let totalRelevance = 0;
        let count = 0;

        recruiterMetrics.forEach(metric => {
          if (metric.averageSentiment) {
            totalSentiment += metric.averageSentiment;
            count++;
          }
          if (metric.questionRelevanceScore) {
            totalRelevance += metric.questionRelevanceScore;
          }
        });

        return {
          id: recruiter._id,
          name: recruiter.name,
          email: recruiter.email,
          totalInterviews: interviews.length,
          avgSentiment: count > 0 ? totalSentiment / count : 0,
          avgRelevance: count > 0 ? totalRelevance / count : 0,
          lastActivity: interviews.length > 0 ? interviews[0].createdAt : null
        };
      }));

      res.json({ recruiters: recruitersWithMetrics });
    } catch (error) {
      console.error('Admin recruiters error:', error);
      res.status(500).json({ message: error instanceof Error ? error.message : 'Failed to fetch recruiters' });
    }
  });

  // Admin - Get all candidates
  app.get("/api/admin/candidates", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const candidates = await storage.getAllCandidates();
      const candidatesWithDetails = await Promise.all(candidates.map(async (candidate) => {
        const interviews = await storage.getInterviewsByCandidate(candidate._id);
        
        return {
          ...candidate,
          totalInterviews: interviews.length,
          latestInterview: interviews.length > 0 ? interviews[0] : null
        };
      }));

      res.json({ candidates: candidatesWithDetails });
    } catch (error) {
      console.error('Admin candidates error:', error);
      res.status(500).json({ message: error instanceof Error ? error.message : 'Failed to fetch candidates' });
    }
  });

  // Admin - Get all users
  app.get("/api/admin/users", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const usersWithoutPasswords = users.map(({ password, ...user }) => user);
      res.json({ users: usersWithoutPasswords });
    } catch (error) {
      console.error('Admin users error:', error);
      res.status(500).json({ message: error instanceof Error ? error.message : 'Failed to fetch users' });
    }
  });

  // Admin - Delete user
  app.delete("/api/admin/user/:id", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const success = await storage.deleteUser(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error('Admin delete user error:', error);
      res.status(500).json({ message: error instanceof Error ? error.message : 'Failed to delete user' });
    }
  });

  // Admin - Get recruiter analytics
  app.get("/api/admin/analytics/recruiter/:id", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const recruiter = await storage.getUser(req.params.id);
      if (!recruiter || recruiter.role !== 'recruiter') {
        return res.status(404).json({ message: "Recruiter not found" });
      }

      const interviews = await storage.getInterviewsByRecruiter(req.params.id);
      const metrics = await storage.getRecruiterMetricsByRecruiterId(req.params.id);
      
      res.json({
        recruiter: {
          id: recruiter._id,
          name: recruiter.name,
          email: recruiter.email
        },
        totalInterviews: interviews.length,
        metrics,
        recentInterviews: interviews.slice(0, 10)
      });
    } catch (error) {
      console.error('Admin recruiter analytics error:', error);
      res.status(500).json({ message: error instanceof Error ? error.message : 'Failed to fetch recruiter analytics' });
    }
  });

  // Admin - Get candidate analytics
  app.get("/api/admin/analytics/candidate/:id", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const candidate = await storage.getCandidate(req.params.id);
      if (!candidate) {
        return res.status(404).json({ message: "Candidate not found" });
      }

      const interviews = await storage.getInterviewsByCandidate(req.params.id);
      const interviewsWithReports = await Promise.all(interviews.map(async (interview) => {
        const report = await storage.getAnalysisReportByInterviewId(interview._id);
        return { interview, report };
      }));
      
      res.json({
        candidate,
        totalInterviews: interviews.length,
        interviews: interviewsWithReports
      });
    } catch (error) {
      console.error('Admin candidate analytics error:', error);
      res.status(500).json({ message: error instanceof Error ? error.message : 'Failed to fetch candidate analytics' });
    }
  });

  // Admin - Generate candidate PDF report
  app.get("/api/admin/reports/candidate/:id/pdf", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const candidate = await storage.getCandidate(req.params.id);
      if (!candidate) {
        return res.status(404).json({ message: "Candidate not found" });
      }

      const interviews = await storage.getInterviewsByCandidate(req.params.id);
      const interviewsWithReports = await Promise.all(interviews.map(async (interview) => {
        const report = await storage.getAnalysisReportByInterviewId(interview._id);
        return { interview, report };
      }));

      // Generate simple PDF response
      const pdfBuffer = Buffer.from(`Candidate Report: ${candidate.name}`);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="candidate-${candidate.name}-report.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Admin candidate PDF error:', error);
      res.status(500).json({ message: error instanceof Error ? error.message : 'Failed to generate PDF' });
    }
  });

  // Admin - Generate recruiter PDF report
  app.get("/api/admin/reports/recruiter/:id/pdf", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const recruiter = await storage.getUser(req.params.id);
      if (!recruiter || recruiter.role !== 'recruiter') {
        return res.status(404).json({ message: "Recruiter not found" });
      }

      const interviews = await storage.getInterviewsByRecruiter(req.params.id);
      const metrics = await storage.getRecruiterMetricsByRecruiterId(req.params.id);

      // Generate simple PDF response
      const pdfBuffer = Buffer.from(`Recruiter Report: ${recruiter.name}`);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="recruiter-${recruiter.name}-report.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Admin recruiter PDF error:', error);
      res.status(500).json({ message: error instanceof Error ? error.message : 'Failed to generate PDF' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
