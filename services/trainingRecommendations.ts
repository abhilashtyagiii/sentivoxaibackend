/**
 * Training Recommendations Generator
 * Provides actionable training recommendations based on recruiter performance gaps
 */

export interface TrainingRecommendation {
  area: string;
  priority: "critical" | "high" | "medium" | "low";
  issue: string;
  recommendation: string;
  resources: string[];
  expectedImprovement: string;
}

export interface PerformanceGap {
  metric: string;
  currentScore: number;
  targetScore: number;
  gap: number;
  severity: "critical" | "moderate" | "minor";
}

/**
 * Generate training recommendations based on analysis results
 */
// Category to question type mapping
const categoryQuestionMap: Record<string, { name: string; examples: string[] }> = {
  technicalSkills: {
    name: "Technical Skills",
    examples: [
      "Ask about specific technologies mentioned in the JD",
      "Request hands-on experience examples with required tools",
      "Probe technical problem-solving scenarios"
    ]
  },
  experienceLevel: {
    name: "Experience Level",
    examples: [
      "Ask about years of experience in relevant roles",
      "Inquire about progression and growth in their career",
      "Discuss specific projects that match the role's seniority"
    ]
  },
  culturalFit: {
    name: "Cultural Fit",
    examples: [
      "Ask about work style preferences and team collaboration",
      "Inquire about values alignment and company culture fit",
      "Discuss how they handle workplace challenges"
    ]
  },
  leadership: {
    name: "Leadership",
    examples: [
      "Ask about team management and mentoring experience",
      "Inquire about decision-making and conflict resolution",
      "Discuss examples of leading projects or initiatives"
    ]
  },
  educationQualifications: {
    name: "Education & Qualifications",
    examples: [
      "Ask about relevant degrees and certifications",
      "Inquire about specialized training and courses",
      "Discuss how their education applies to the role"
    ]
  },
  softSkills: {
    name: "Soft Skills",
    examples: [
      "Ask about communication and interpersonal skills",
      "Inquire about adaptability and problem-solving",
      "Discuss examples of teamwork and collaboration"
    ]
  },
  communication: {
    name: "Communication",
    examples: [
      "Ask about presentation and documentation skills",
      "Inquire about cross-functional collaboration",
      "Discuss examples of explaining complex topics"
    ]
  },
  problemSolving: {
    name: "Problem Solving",
    examples: [
      "Ask about analytical and critical thinking approach",
      "Inquire about handling complex challenges",
      "Discuss specific problem-solving methodologies used"
    ]
  },
  industryKnowledge: {
    name: "Industry Knowledge",
    examples: [
      "Ask about domain expertise and market understanding",
      "Inquire about industry trends and best practices",
      "Discuss relevant sector-specific experience"
    ]
  },
  motivationFit: {
    name: "Motivation & Career Goals",
    examples: [
      "Ask about career aspirations and growth plans",
      "Inquire about why they're interested in this role",
      "Discuss long-term goals and role alignment"
    ]
  }
};

export function generateTrainingRecommendations(
  jdAnalysis: any,
  flowAnalysis: any,
  sentimentAnalysis: any,
  missedFollowUps?: any[]
): {
  recommendations: TrainingRecommendation[];
  performanceGaps: PerformanceGap[];
  strengthAreas: string[];
  overallRating: "excellent" | "good" | "needs_improvement" | "poor";
} {
  const recommendations: TrainingRecommendation[] = [];
  const performanceGaps: PerformanceGap[] = [];
  const strengthAreas: string[] = [];

  // Analyze JD relevance
  if (jdAnalysis?.overallScore !== undefined) {
    if (jdAnalysis.overallScore < 60) {
      performanceGaps.push({
        metric: "JD Relevance",
        currentScore: jdAnalysis.overallScore,
        targetScore: 80,
        gap: 80 - jdAnalysis.overallScore,
        severity: jdAnalysis.overallScore < 40 ? "critical" : "moderate",
      });

      recommendations.push({
        area: "Job Description Alignment",
        priority: jdAnalysis.overallScore < 40 ? "critical" : "high",
        issue: "Questions are not well-aligned with job requirements",
        recommendation: "Study the job description thoroughly before interviews and prepare targeted questions for each requirement",
        resources: [
          "JD Analysis Training Module",
          "Competency-Based Interviewing Guide",
          "Technical Skills Assessment Framework",
        ],
        expectedImprovement: "Increase JD relevance score by 20-30 points",
      });
    } else if (jdAnalysis.overallScore >= 80) {
      strengthAreas.push("Strong job description alignment");
    }
  }

  // Analyze flow continuity
  if (flowAnalysis?.continuityScore !== undefined) {
    if (flowAnalysis.continuityScore < 70) {
      performanceGaps.push({
        metric: "Flow Continuity",
        currentScore: flowAnalysis.continuityScore,
        targetScore: 85,
        gap: 85 - flowAnalysis.continuityScore,
        severity: flowAnalysis.continuityScore < 50 ? "critical" : "moderate",
      });

      recommendations.push({
        area: "Conversation Flow",
        priority: flowAnalysis.continuityScore < 50 ? "critical" : "high",
        issue: "Questions lack logical flow and follow-up",
        recommendation: "Practice active listening and ask follow-up questions based on candidate responses. Build a narrative thread throughout the interview",
        resources: [
          "Active Listening Techniques",
          "Follow-up Question Framework",
          "Interview Flow Best Practices",
        ],
        expectedImprovement: "Improve flow continuity by 15-20 points",
      });
    } else if (flowAnalysis.continuityScore >= 85) {
      strengthAreas.push("Excellent conversation flow and continuity");
    }
  }

  // Analyze zero-score categories and recommend specific question types
  if (jdAnalysis?.categoryBreakdown) {
    const zeroScoreCategories: string[] = [];
    
    // Check each category for zero scores
    Object.entries(jdAnalysis.categoryBreakdown).forEach(([key, value]: [string, any]) => {
      if (value && typeof value === 'object' && value.score === 0) {
        // Check if it's actually "not discussed" vs just a poor score
        const details = value.details || "";
        if (details.toLowerCase().includes("not discussed") || 
            details.toLowerCase().includes("not mentioned") ||
            details === "Not discussed in interview") {
          zeroScoreCategories.push(key);
        }
      }
    });
    
    // Generate recommendations for each zero-score category
    zeroScoreCategories.forEach((category) => {
      const categoryInfo = categoryQuestionMap[category];
      if (categoryInfo) {
        recommendations.push({
          area: `Missing Coverage: ${categoryInfo.name}`,
          priority: "high",
          issue: `No questions asked about ${categoryInfo.name.toLowerCase()}`,
          recommendation: `Include questions to assess ${categoryInfo.name.toLowerCase()}. ${categoryInfo.examples[0]}`,
          resources: categoryInfo.examples.slice(1),
          expectedImprovement: `Cover ${categoryInfo.name.toLowerCase()} to improve JD alignment by 10-15 points`,
        });
      }
    });
  }

  // Analyze sentiment
  if (sentimentAnalysis?.recruiterSentiment) {
    const recruiterScore = sentimentAnalysis.recruiterSentiment.overallScore * 10;
    
    if (recruiterScore < 60) {
      recommendations.push({
        area: "Interview Tone",
        priority: "medium",
        issue: "Recruiter tone could be more positive and engaging",
        recommendation: "Practice maintaining an enthusiastic and welcoming demeanor. Show genuine interest in candidate responses",
        resources: [
          "Positive Interview Techniques",
          "Building Rapport with Candidates",
          "Non-verbal Communication in Interviews",
        ],
        expectedImprovement: "Increase candidate comfort and engagement",
      });
    }
  }

  // Determine overall rating
  const avgScore = [
    jdAnalysis?.overallScore || 0,
    flowAnalysis?.continuityScore || 0,
    (sentimentAnalysis?.recruiterSentiment?.overallScore || 0) * 10,
  ].reduce((a, b) => a + b, 0) / 3;

  let overallRating: "excellent" | "good" | "needs_improvement" | "poor";
  if (avgScore >= 85) overallRating = "excellent";
  else if (avgScore >= 70) overallRating = "good";
  else if (avgScore >= 50) overallRating = "needs_improvement";
  else overallRating = "poor";

  return {
    recommendations,
    performanceGaps,
    strengthAreas,
    overallRating,
  };
}
