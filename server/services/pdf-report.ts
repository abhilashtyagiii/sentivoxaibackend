import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Interview, AnalysisReport } from '@shared/schema';

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

export interface DetailedReportData {
  interview: Interview;
  report: AnalysisReport;
  timestamp: Date;
}

export function generateDetailedPDFReport(data: DetailedReportData): Uint8Array {
  // Handle different ways jsPDF might be imported
  const PDFConstructor = (jsPDF as any).default || jsPDF;
  const doc = new PDFConstructor();
  let yPosition = 25;
  const pageWidth = doc.internal.pageSize.getWidth();
  const margins = { left: 20, right: 20, top: 25, bottom: 25 };
  const contentWidth = pageWidth - margins.left - margins.right;

  // Color scheme
  const colors = {
    primary: [41, 128, 185],    // Blue
    secondary: [52, 73, 94],    // Dark gray
    accent: [241, 196, 15],     // Yellow
    success: [39, 174, 96],     // Green
    warning: [230, 126, 34],    // Orange
    danger: [231, 76, 60],      // Red
    light: [236, 240, 241],     // Light gray
    text: [44, 62, 80]          // Dark blue-gray
  };

  // Helper function to add bordered section
  const addSection = (title: string, bgColor = colors.light) => {
    checkPageBreak(35);
    
    // Background rectangle
    doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
    doc.rect(margins.left - 5, yPosition - 8, contentWidth + 10, 25, 'F');
    
    // Border
    doc.setDrawColor(colors.primary[0], colors.primary[1], colors.primary[2]);
    doc.setLineWidth(0.8);
    doc.rect(margins.left - 5, yPosition - 8, contentWidth + 10, 25);
    
    // Title text
    doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(title, margins.left, yPosition + 5);
    
    yPosition += 30;
    doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
  };

  // Helper function to add text with proper positioning and justification
  const addText = (text: string, x: number = margins.left, size: number = 10, style: 'normal' | 'bold' = 'normal', indent: number = 0, justify: boolean = true) => {
    checkPageBreak();
    doc.setFontSize(size);
    doc.setFont('helvetica', style);
    
    const maxWidth = contentWidth - indent - 10;
    const lines = doc.splitTextToSize(text, maxWidth);
    
    if (Array.isArray(lines)) {
      lines.forEach((line: string, index: number) => {
        if (index > 0) checkPageBreak();
        
        // Apply text justification for body text (not headers)
        if (justify && size <= 11 && lines.length > 1 && index < lines.length - 1) {
          // Justify text by distributing words evenly
          const words = line.trim().split(' ');
          if (words.length > 1) {
            const lineWidth = doc.getTextWidth(line);
            const spaceNeeded = maxWidth - lineWidth;
            const spaceBetweenWords = spaceNeeded / (words.length - 1);
            
            let currentX = x + indent;
            words.forEach((word, wordIndex) => {
              doc.text(word, currentX, yPosition);
              if (wordIndex < words.length - 1) {
                currentX += doc.getTextWidth(word) + doc.getTextWidth(' ') + spaceBetweenWords;
              }
            });
          } else {
            doc.text(line, x + indent, yPosition);
          }
        } else {
          doc.text(line, x + indent, yPosition);
        }
        
        yPosition += size === 14 ? 8 : size === 12 ? 7 : 6;
      });
    } else {
      doc.text(lines, x + indent, yPosition);
      yPosition += size === 14 ? 8 : size === 12 ? 7 : 6;
    }
  };

  // Helper function to add bullet points
  const addBulletPoint = (text: string, level: number = 0, style: 'normal' | 'bold' = 'normal') => {
    checkPageBreak(12);
    const bulletIndent = 12 + (level * 12);
    const textIndent = bulletIndent + 10;
    
    // Add bullet
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('•', margins.left + bulletIndent, yPosition);
    
    // Add text with proper wrapping
    doc.setFont('helvetica', style);
    const lines = doc.splitTextToSize(text, contentWidth - textIndent - 10);
    if (Array.isArray(lines)) {
      lines.forEach((line: string, index: number) => {
        if (index > 0) {
          checkPageBreak();
          yPosition += 2;
        }
        doc.text(line, margins.left + textIndent, yPosition);
        yPosition += 7;
      });
    } else {
      doc.text(lines, margins.left + textIndent, yPosition);
      yPosition += 7;
    }
    yPosition += 3;
  };

  // Helper function to convert long text into structured bullet points (optimized for brevity)
  const addTextAsBulletPoints = (text: string, level: number = 0, maxPoints: number = 3) => {
    // Split text into sentences and create bullet points for key insights
    const sentences = text.split(/[.!?]\s+/).filter(s => s.trim().length > 10);
    // Limit to most important points for concise reporting
    sentences.slice(0, maxPoints).forEach(sentence => {
      if (sentence.trim()) {
        addBulletPoint(sentence.trim() + (sentence.endsWith('.') || sentence.endsWith('!') || sentence.endsWith('?') ? '' : '.'), level);
      }
    });
  };

  // Helper function to add metric cards with proper grid layout
  let cardColumn = 0; // Track which column we're in (0 = left, 1 = right)
  const addMetricCard = (label: string, value: string, color = colors.primary) => {
    const cardWidth = (contentWidth - 15) / 2;
    const cardHeight = 25;
    const cardX = margins.left + (cardColumn === 0 ? 0 : cardWidth + 15);
    
    // Only check page break when starting a new row (left column)
    if (cardColumn === 0) checkPageBreak(35);
    
    // Card background
    doc.setFillColor(color[0], color[1], color[2]);
    doc.rect(cardX, yPosition - 5, cardWidth, cardHeight, 'F');
    
    // Card border
    doc.setDrawColor(color[0] - 20, color[1] - 20, color[2] - 20);
    doc.setLineWidth(0.3);
    doc.rect(cardX, yPosition - 5, cardWidth, cardHeight);
    
    // Label
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(label, cardX + 5, yPosition + 3);
    
    // Value
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(value, cardX + 5, yPosition + 15);
    
    doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
    
    // Move to next column or next row
    if (cardColumn === 0) {
      cardColumn = 1; // Move to right column
    } else {
      cardColumn = 0; // Move to left column of next row
      yPosition += 35; // Move down to next row
    }
  };

  // Helper function to check page break
  const checkPageBreak = (neededSpace: number = 15) => {
    if (yPosition > 270 - neededSpace) {
      doc.addPage();
      yPosition = margins.top;
    }
  };

  // Header with professional branding
  doc.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.rect(0, 0, pageWidth, 50, 'F');
  
  // Main title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('AI INTERVIEW ANALYSIS REPORT', margins.left, 25);
  
  // Subtitle
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Professional Assessment & Recommendations', margins.left, 35);
  
  // File and generation info
  doc.setFontSize(10);
  doc.text(`File: ${data.interview.fileName}`, margins.left, 43);
  doc.text(`Generated: ${data.timestamp.toLocaleString()}`, pageWidth - margins.right - 80, 43);
  
  yPosition = 65;
  doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);

  // Executive Summary
  addSection('EXECUTIVE SUMMARY');
  
  // Metric cards in 2x2 grid
  const jdScore = data.report.jdMatchScore || 0;
  const engagement = data.report.candidateEngagement || 0;
  const effectiveness = data.report.recruiterSentiment || 0;
  const flowScore = data.report.flowContinuityScore || 0;
  
  // Reset card column for new section
  cardColumn = 0;
  
  addMetricCard('Job Match Score', `${Math.round(jdScore)}%`, jdScore >= 70 ? colors.success : jdScore >= 40 ? colors.warning : colors.danger);
  addMetricCard('Candidate Engagement', `${Math.round(engagement)}%`, engagement >= 70 ? colors.success : engagement >= 40 ? colors.warning : colors.danger);
  addMetricCard('Recruiter Effectiveness', `${Math.round(effectiveness)}/10`, effectiveness >= 7 ? colors.success : effectiveness >= 4 ? colors.warning : colors.danger);
  addMetricCard('Flow Continuity', `${Math.round(flowScore)}%`, flowScore >= 70 ? colors.success : flowScore >= 40 ? colors.warning : colors.danger);
  
  // Ensure we move to next row if we ended on right column
  if (cardColumn === 1) yPosition += 35;
  yPosition += 15;

  // Detailed JD Analysis with Reasoning
  if (data.interview.jdAnalysis) {
    addSection('JOB DESCRIPTION RELEVANCE ANALYSIS');
    
    const jdData = data.interview.jdAnalysis as any;
    
    // Overall reasoning
    if (jdData.detailedReasoningCandidate) {
      addText('Candidate Performance Analysis:', margins.left, 12, 'bold', 0, false);
      yPosition += 3;
      addTextAsBulletPoints(jdData.detailedReasoningCandidate, 0);
      yPosition += 5;
    }

    if (jdData.detailedReasoningRecruiter) {
      addText('Recruiter Effectiveness Analysis:', margins.left, 12, 'bold', 0, false);
      yPosition += 3;
      addTextAsBulletPoints(jdData.detailedReasoningRecruiter, 0);
      yPosition += 5;
    }

    // Key Interview Examples (First 3 Q&A Pairs)
    if (jdData.questionRelevance && jdData.questionRelevance.length > 0) {
      addText('Key Interview Exchanges:', margins.left, 12, 'bold', 0, false);
      yPosition += 5;
      
      // Show first 3 Q&A pairs to maintain proper matching
      const maxPairs = Math.min(3, jdData.questionRelevance.length);
      
      for (let i = 0; i < maxPairs; i++) {
        const question = jdData.questionRelevance[i];
        const answer = jdData.answerAlignment && jdData.answerAlignment[i];
        
        addBulletPoint(`Q${i + 1}: ${question.question} (Score: ${question.relevanceScore || 0}/100)`);
        
        if (answer) {
          addBulletPoint(`Response: ${answer.answer} (Alignment: ${answer.alignmentScore || 0}/100)`, 1);
        }
        yPosition += 2;
      }
      yPosition += 5;
    }
  }

  // Sentiment & Behavioral Analysis
  if (data.interview.sentimentAnalysis) {
    addSection('SENTIMENT & BEHAVIORAL ANALYSIS');
    
    const sentimentData = data.interview.sentimentAnalysis as any;
    
    // Combined sentiment overview for brevity
    if (sentimentData.recruiterSentiment && sentimentData.candidateSentiment) {
      addBulletPoint(`Recruiter Effectiveness: ${sentimentData.recruiterSentiment.overallScore || 0}/10 (${Math.round((sentimentData.recruiterSentiment.positive || 0) * 100)}% positive tone)`);
      addBulletPoint(`Candidate Engagement: ${sentimentData.candidateSentiment.overallScore || 0}/10 (${Math.round((sentimentData.candidateSentiment.positive || 0) * 100)}% positive response)`);
      
      // Key insights only - focus on recruiter performance
      if (sentimentData.recruiterSentiment.reasoning) {
        addText('Recruiter Performance Insights:', margins.left, 11, 'bold', 0, false);
        yPosition += 3;
        addTextAsBulletPoints(sentimentData.recruiterSentiment.reasoning, 0, 2);
      }
      
      if (sentimentData.candidateSentiment.reasoning) {
        addText('Candidate Response Patterns:', margins.left, 11, 'bold', 0, false);
        yPosition += 3;
        addTextAsBulletPoints(sentimentData.candidateSentiment.reasoning, 0, 2);
      }
      yPosition += 5;
    }
  }

  // Interview Flow & Structure
  if (data.interview.flowAnalysis) {
    addSection('INTERVIEW FLOW & STRUCTURE');
    
    const flowData = data.interview.flowAnalysis as any;
    
    addBulletPoint(`Flow Continuity Score: ${flowData.continuityScore || 0}/100`, 0, 'bold');
    
    // Top 3 insights only for brevity
    if (flowData.insights && flowData.insights.length > 0) {
      addText('Key Flow Observations:', margins.left, 11, 'bold', 0, false);
      yPosition += 3;
      flowData.insights.slice(0, 3).forEach((insight: any) => {
        const insightText = typeof insight === 'string' ? insight : String(insight || '');
        if (insightText) {
          addBulletPoint(insightText.substring(0, 120) + (insightText.length > 120 ? '...' : ''));
        }
      });
      yPosition += 5;
    }

    // Show only high severity issues for focus
    if (flowData.flowBreaks && flowData.flowBreaks.length > 0) {
      const criticalIssues = flowData.flowBreaks.filter((issue: any) => issue.severity === 'high' || issue.severity === 'medium');
      if (criticalIssues.length > 0) {
        addText('Critical Flow Issues:', margins.left, 11, 'bold', 0, false);
        yPosition += 3;
        criticalIssues.slice(0, 3).forEach((issue: any) => {
          const severityLabel = issue.severity === 'high' ? 'HIGH' : 'MEDIUM';
          const displayIssue = issue.issue && issue.issue !== 'undefined' ? issue.issue : 'Flow interruption detected';
          addBulletPoint(`${severityLabel}: ${displayIssue}`);
        });
        yPosition += 5;
      }
    }
  }

  // Recruiter Recommendations
  addSection('KEY RECOMMENDATIONS');
  
  const recommendations = generateRecruiterRecommendations(data);
  // Limit to top 5 most important recommendations for brevity
  recommendations.slice(0, 5).forEach((rec: string) => {
    addBulletPoint(rec.substring(0, 150) + (rec.length > 150 ? '...' : ''));
  });

  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    
    // Footer line
    doc.setDrawColor(colors.primary[0], colors.primary[1], colors.primary[2]);
    doc.setLineWidth(0.5);
    doc.line(margins.left, 285, pageWidth - margins.right, 285);
    
    // Footer text
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
    doc.text(`Page ${i} of ${totalPages}`, margins.left, 290);
    doc.text('Generated by AI Interview Analysis System', pageWidth - margins.right - 80, 290);
  }
  
  doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);

  return doc.output('arraybuffer') as Uint8Array;
}

function splitTextIntoLines(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  words.forEach(word => {
    if ((currentLine + word).length <= maxCharsPerLine) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  });

  if (currentLine) lines.push(currentLine);
  return lines;
}

function generateRecruiterRecommendations(data: DetailedReportData): string[] {
  const recommendations: string[] = [];
  const jdScore = data.report.jdMatchScore || 0;
  const engagement = data.report.candidateEngagement || 0;
  const flowScore = data.report.flowContinuityScore || 0;
  const recruiterSentiment = data.report.recruiterSentiment || 0;

  // Extract insights from the actual interview data
  const jdAnalysis = data.interview.jdAnalysis as any;
  const sentimentData = data.interview.sentimentAnalysis as any;
  const flowData = data.interview.flowAnalysis as any;
  const transcription = data.interview.transcript as any;

  // Determine if this is a technical role based on job description
  const jobDesc = data.interview.jobDescription.toLowerCase();
  const isTechnicalRole = jobDesc.includes('developer') || jobDesc.includes('engineer') || 
                         jobDesc.includes('java') || jobDesc.includes('python') || 
                         jobDesc.includes('react') || jobDesc.includes('technical');

  // Primary hiring recommendation based on overall performance
  if (jdScore >= 75 && engagement >= 70) {
    recommendations.push('Strong recommendation: Candidate demonstrates excellent alignment with role requirements and shows high engagement. Advance to next interview stage.');
  } else if (jdScore >= 60 && engagement >= 60) {
    recommendations.push('Qualified candidate: Good fit for the role with solid technical foundation. Consider conducting focused technical assessment to validate specific skills.');
  } else if (jdScore >= 45 || engagement >= 50) {
    recommendations.push('Conditional consideration: Candidate shows potential but requires skill development. Evaluate if mentoring/training investment aligns with team needs.');
  } else {
    recommendations.push('Not recommended: Significant gaps in required qualifications and low engagement levels. Consider alternative candidates.');
  }

  // Technical assessment recommendations
  if (isTechnicalRole && jdScore >= 50) {
    const techSkills = jdAnalysis?.answerAlignment?.[0]?.keySkills || [];
    if (techSkills.length > 0) {
      recommendations.push(`Technical evaluation: Candidate claims experience in ${techSkills.slice(0, 3).join(', ')}. Conduct hands-on coding assessment to verify practical skills.`);
    } else {
      recommendations.push('Technical validation required: Limited technical detail provided during discussion. Design comprehensive technical interview to assess core competencies.');
    }
  }

  // Communication and soft skills assessment
  if (recruiterSentiment >= 7 && engagement >= 65) {
    recommendations.push('Communication strengths: Candidate demonstrates clear articulation and professional demeanor. Well-suited for collaborative team environment.');
  } else if (engagement < 50) {
    recommendations.push('Communication concerns: Low engagement may indicate communication challenges or lack of genuine interest. Explore motivation and cultural fit more thoroughly.');
  }

  // Interview process improvement recommendations
  if (flowScore < 70) {
    const flowIssues = flowData?.flowBreaks?.length || 0;
    if (flowIssues > 2) {
      recommendations.push('Interview process enhancement: Multiple flow disruptions detected. Consider structured interview format with predetermined question sequence for better candidate evaluation.');
    } else {
      recommendations.push('Interview optimization: Minor flow inconsistencies noted. Review question transitions to maintain conversation momentum and candidate comfort.');
    }
  }

  // Next steps based on candidate quality
  if (jdScore >= 60 && engagement >= 60) {
    recommendations.push('Immediate next steps: Schedule follow-up interview with technical team lead. Prepare specific scenario-based questions relevant to day-to-day responsibilities.');
    recommendations.push('Reference verification: Conduct thorough reference checks focusing on work quality, team collaboration, and technical problem-solving abilities.');
  } else if (jdScore >= 40) {
    recommendations.push('Additional evaluation needed: Consider panel interview or extended technical discussion to make informed hiring decision.');
  }

  // Salary and negotiation guidance (if mentioned in transcription)
  const transcriptText = transcription?.segments?.map((s: any) => s.text).join(' ') || '';
  if (transcriptText.toLowerCase().includes('salary') || transcriptText.toLowerCase().includes('expectation')) {
    recommendations.push('Compensation discussion: Salary expectations were discussed during interview. Ensure alignment with budget parameters before proceeding to offer stage.');
  }

  // Final documentation recommendation
  recommendations.push('Documentation requirement: Compile detailed interview notes with specific examples of candidate responses to support final hiring decision and provide feedback to unsuccessful candidates.');

  return recommendations;
}

export default generateDetailedPDFReport;