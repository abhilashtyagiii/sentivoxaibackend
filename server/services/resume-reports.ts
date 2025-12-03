import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { CandidateReportData, RecruiterReportData } from './resumeAnalysis';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

const colors = {
  primary: [41, 128, 185],
  secondary: [52, 73, 94],
  accent: [241, 196, 15],
  success: [39, 174, 96],
  warning: [230, 126, 34],
  danger: [231, 76, 60],
  light: [236, 240, 241],
  text: [44, 62, 80]
};

function initializePDF(title: string): jsPDF {
  const PDFConstructor = (jsPDF as any).default || jsPDF;
  const doc = new PDFConstructor();
  
  doc.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(title, doc.internal.pageSize.getWidth() / 2, 25, { align: 'center' });
  
  return doc;
}

function addPageBreak(doc: jsPDF, yPos: number, threshold: number = 30): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (yPos > pageHeight - threshold) {
    doc.addPage();
    return 25;
  }
  return yPos;
}

function addSection(doc: jsPDF, title: string, yPos: number): number {
  yPos = addPageBreak(doc, yPos, 35);
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - 40;
  
  doc.setFillColor(colors.light[0], colors.light[1], colors.light[2]);
  doc.rect(15, yPos - 8, contentWidth + 10, 20, 'F');
  
  doc.setDrawColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.setLineWidth(0.8);
  doc.rect(15, yPos - 8, contentWidth + 10, 20);
  
  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 20, yPos + 5);
  
  doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
  return yPos + 25;
}

function addScoreBar(doc: jsPDF, label: string, score: number, yPos: number): number {
  yPos = addPageBreak(doc, yPos);
  const barWidth = 120;
  const barHeight = 8;
  const scorePercentage = (score / 10) * 100;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(label, 20, yPos);
  
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.rect(20, yPos + 3, barWidth, barHeight);
  
  const fillColor = score >= 7 ? colors.success : score >= 4 ? colors.warning : colors.danger;
  doc.setFillColor(fillColor[0], fillColor[1], fillColor[2]);
  doc.rect(20, yPos + 3, (barWidth * score) / 10, barHeight, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.text(`${score.toFixed(1)}/10`, 145, yPos + 9);
  
  return yPos + 18;
}

function addBulletList(doc: jsPDF, items: string[], yPos: number): number {
  items.forEach(item => {
    yPos = addPageBreak(doc, yPos);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('•', 20, yPos);
    
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(item, 155);
    lines.forEach((line: string, index: number) => {
      if (index > 0) {
        yPos += 6;
        yPos = addPageBreak(doc, yPos);
      }
      doc.text(line, 30, yPos);
    });
    yPos += 10;
  });
  return yPos;
}

export function generateCandidateReport(
  data: CandidateReportData,
  candidateName: string = "Candidate",
  interviewDate: Date = new Date()
): Uint8Array {
  const doc = initializePDF('Candidate Interview Performance Report');
  let yPos = 50;
  
  yPos = addSection(doc, '1. REPORT HEADER', yPos);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
  doc.text(`Report Date: ${interviewDate.toLocaleDateString()}`, 20, yPos);
  yPos += 7;
  doc.text(`Candidate Name: ${candidateName}`, 20, yPos);
  yPos += 7;
  doc.text(`Report Type: Candidate Interview Performance Report`, 20, yPos);
  yPos += 20;
  
  yPos = addSection(doc, '2. EXECUTIVE SUMMARY', yPos);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  const executiveSummary = `This report provides a comprehensive analysis of the candidate's interview performance. The overall performance score is ${data.overallScore.toFixed(1)}/10, indicating ${data.overallScore >= 7 ? 'strong competency' : data.overallScore >= 5 ? 'moderate competency with room for development' : 'significant development opportunities'}. ${data.summary}`;
  
  const summaryLines = doc.splitTextToSize(executiveSummary, 160);
  summaryLines.forEach((line: string) => {
    yPos = addPageBreak(doc, yPos);
    doc.text(line, 20, yPos);
    yPos += 6;
  });
  yPos += 15;
  
  yPos = addSection(doc, '3. OVERALL PERFORMANCE OVERVIEW', yPos);
  yPos = addScoreBar(doc, 'Overall Performance Score', data.overallScore, yPos);
  yPos += 10;
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  
  const performanceText = `The candidate achieved an overall performance score of ${data.overallScore.toFixed(1)}/10. ${data.overallScore >= 7 ? 'This indicates strong interview performance with well-articulated responses and clear demonstration of relevant competencies.' : data.overallScore >= 5 ? 'This reflects fair performance with some strong areas balanced by opportunities for improvement.' : 'This suggests the need for further skill development to meet the role requirements effectively.'}`;
  
  const perfLines = doc.splitTextToSize(performanceText, 160);
  perfLines.forEach((line: string) => {
    yPos = addPageBreak(doc, yPos);
    doc.text(line, 20, yPos);
    yPos += 6;
  });
  yPos += 15;
  
  yPos = addSection(doc, '4. JOB DESCRIPTION RELEVANCE ANALYSIS', yPos);
  yPos = addScoreBar(doc, 'Job Match Score', data.skillsDemonstration.score, yPos);
  yPos += 10;
  
  doc.setFont('helvetica', 'normal');
  
  const jdText = `Job description alignment score: ${data.skillsDemonstration.score.toFixed(1)}/10. ${data.skillsDemonstration.score >= 7 ? 'The candidate demonstrates excellent alignment with job requirements and possesses the key competencies needed for success in this role.' : data.skillsDemonstration.score >= 5 ? 'The candidate shows moderate alignment with job requirements. Some key areas match well, though certain skills may require further development.' : 'The candidate\'s current skill set shows limited alignment with the position requirements. Significant upskilling would be necessary for role readiness.'}`;
  
  const jdLines = doc.splitTextToSize(jdText, 160);
  jdLines.forEach((line: string) => {
    yPos = addPageBreak(doc, yPos);
    doc.text(line, 20, yPos);
    yPos += 6;
  });
  yPos += 10;
  
  yPos = addSection(doc, '5. SKILLS ASSESSMENT', yPos);
  
  doc.setFont('helvetica', 'normal');
  doc.text('The following skills were evaluated during the interview:', 20, yPos);
  yPos += 10;
  
  if (data.skillsDemonstration.demonstratedSkills.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.text('Skills Successfully Demonstrated:', 20, yPos);
    yPos += 8;
    doc.setFont('helvetica', 'normal');
    yPos = addBulletList(doc, data.skillsDemonstration.demonstratedSkills.slice(0, 8), yPos);
  }
  
  if (data.skillsDemonstration.claimedSkills.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.text('Skills Requiring Further Validation:', 20, yPos);
    yPos += 8;
    doc.setFont('helvetica', 'normal');
    yPos = addBulletList(doc, data.skillsDemonstration.claimedSkills.slice(0, 5), yPos);
  }
  
  yPos += 5;
  
  doc.setFont('helvetica', 'normal');
  const consistencyText = data.consistencyCheck.score >= 7 
    ? 'The candidate maintained strong consistency between resume claims and interview responses.'
    : data.consistencyCheck.score >= 5
    ? 'Response consistency was generally acceptable, with minor areas requiring clarification.'
    : 'Some inconsistencies were noted between resume information and interview responses.';
  
  const consLines = doc.splitTextToSize(consistencyText, 160);
  consLines.forEach((line: string) => {
    yPos = addPageBreak(doc, yPos);
    doc.text(line, 20, yPos);
    yPos += 6;
  });
  yPos += 10;
  
  yPos = addSection(doc, 'V. COMMUNICATION ASSESSMENT', yPos);
  yPos = addScoreBar(doc, 'Clarity of Expression', data.communicationRating.clarity, yPos);
  yPos = addScoreBar(doc, 'Confidence Level', data.communicationRating.confidence, yPos);
  yPos = addScoreBar(doc, 'Depth of Responses', data.communicationRating.depth, yPos);
  yPos += 10;
  
  yPos = addSection(doc, 'VI. QUESTION-WISE EVALUATION', yPos);
  doc.setFont('helvetica', 'normal');
  doc.text('The candidate demonstrated varying levels of competency across different question categories:', 20, yPos);
  yPos += 8;
  
  const questionEval = [
    'Technical questions: Responses showed ' + (data.skillsDemonstration.score >= 7 ? 'strong' : data.skillsDemonstration.score >= 5 ? 'moderate' : 'limited') + ' understanding of core concepts',
    'Behavioral questions: Communication was ' + (data.communicationRating.clarity >= 7 ? 'clear and articulate' : data.communicationRating.clarity >= 5 ? 'generally effective' : 'could be improved'),
    'Experience-based questions: Alignment with resume was ' + (data.consistencyCheck.score >= 7 ? 'excellent' : data.consistencyCheck.score >= 5 ? 'satisfactory' : 'inconsistent in some areas')
  ];
  yPos = addBulletList(doc, questionEval, yPos);
  
  yPos = addSection(doc, 'VII. KEY STRENGTHS', yPos);
  doc.setFont('helvetica', 'normal');
  doc.text('The following strengths were identified during the interview assessment:', 20, yPos);
  yPos += 8;
  yPos = addBulletList(doc, data.strengths.length > 0 ? data.strengths : ['Demonstrates foundational knowledge in the field', 'Shows willingness to learn and adapt'], yPos);
  
  yPos = addSection(doc, 'VIII. AREAS FOR IMPROVEMENT', yPos);
  doc.setFont('helvetica', 'normal');
  doc.text('To enhance future performance, consider focusing on the following areas:', 20, yPos);
  yPos += 8;
  yPos = addBulletList(doc, data.areasForImprovement.length > 0 ? data.areasForImprovement : ['Continue building practical experience', 'Strengthen communication of technical concepts'], yPos);
  
  yPos = addSection(doc, 'IX. FINAL RECOMMENDATION', yPos);
  doc.setFont('helvetica', 'bold');
  const recommendation = data.overallScore >= 7 
    ? 'RECOMMENDED FOR HIRE' 
    : data.overallScore >= 5 
    ? 'RECOMMENDED WITH RESERVATIONS' 
    : 'NOT RECOMMENDED AT THIS TIME';
  doc.setTextColor(data.overallScore >= 7 ? colors.success[0] : data.overallScore >= 5 ? colors.warning[0] : colors.danger[0], 
                    data.overallScore >= 7 ? colors.success[1] : data.overallScore >= 5 ? colors.warning[1] : colors.danger[1],
                    data.overallScore >= 7 ? colors.success[2] : data.overallScore >= 5 ? colors.warning[2] : colors.danger[2]);
  doc.setFontSize(12);
  doc.text(recommendation, 20, yPos);
  yPos += 10;
  
  doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  
  const recommendationText = data.overallScore >= 7
    ? 'The candidate demonstrates strong alignment with job requirements and exhibits the necessary competencies. They are recommended for progression to the next stage of the hiring process.'
    : data.overallScore >= 5
    ? 'The candidate shows promise but has some gaps that should be addressed. Consider additional interviews or skills assessment before making a final decision.'
    : 'The candidate does not currently meet the minimum requirements for this position. Significant development would be needed before they could be considered for this role.';
  
  const recLines = doc.splitTextToSize(recommendationText, 160);
  recLines.forEach((line: string) => {
    yPos = addPageBreak(doc, yPos);
    doc.text(line, 20, yPos);
    yPos += 6;
  });
  
  yPos = addPageBreak(doc, yPos + 20);
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text('This report is AI-generated and intended for developmental and assessment purposes.', 20, yPos);
  yPos += 5;
  doc.text(`Report generated on ${new Date().toLocaleDateString()} | Confidential - For Internal Use Only`, 20, yPos);
  
  return new Uint8Array(doc.output('arraybuffer'));
}

export function generateRecruiterReport(
  data: RecruiterReportData,
  recruiterName: string = "Recruiter",
  interviewDate: Date = new Date()
): Uint8Array {
  const doc = initializePDF(`Recruiter Interview Summary - ${recruiterName}`);
  let yPos = 50;
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
  doc.text(`Recruiter Name: ${recruiterName}`, 20, yPos);
  yPos += 7;
  doc.text(`Report Period: ${interviewDate.toLocaleDateString()}`, 20, yPos);
  yPos += 7;
  doc.text(`Report Type: Interview Quality & Efficiency Analysis`, 20, yPos);
  yPos += 20;
  
  yPos = addSection(doc, 'I. EXECUTIVE SUMMARY', yPos);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const summaryLines = doc.splitTextToSize(data.summary, 160);
  summaryLines.forEach((line: string) => {
    yPos = addPageBreak(doc, yPos);
    doc.text(line, 20, yPos);
    yPos += 6;
  });
  yPos += 10;
  
  yPos = addScoreBar(doc, 'Overall Interview Effectiveness', data.overallScore, yPos);
  yPos += 10;
  
  yPos = addSection(doc, 'II. JOB DESCRIPTION MATCH ANALYSIS', yPos);
  yPos = addScoreBar(doc, 'Average JD Match Score', data.questionQuality.resumeRelevance, yPos);
  yPos += 5;
  
  doc.setFont('helvetica', 'bold');
  doc.text('Interpretation:', 20, yPos);
  yPos += 7;
  doc.setFont('helvetica', 'normal');
  
  const jdMatchText = data.questionQuality.resumeRelevance >= 7
    ? 'The interview questions demonstrated excellent alignment with the job description, thoroughly assessing key requirements and competencies.'
    : data.questionQuality.resumeRelevance >= 5
    ? 'Questions showed moderate alignment with job requirements, though some key areas could be explored more thoroughly.'
    : 'Interview questions could be better aligned with the specific job requirements to ensure comprehensive candidate evaluation.';
  
  const jdLines = doc.splitTextToSize(jdMatchText, 160);
  jdLines.forEach((line: string) => {
    yPos = addPageBreak(doc, yPos);
    doc.text(line, 20, yPos);
    yPos += 6;
  });
  yPos += 10;
  
  yPos = addSection(doc, 'III. QUESTION QUALITY METRICS', yPos);
  yPos = addScoreBar(doc, 'Resume Relevance', data.questionQuality.resumeRelevance, yPos);
  yPos = addScoreBar(doc, 'Question Depth & Insight', data.questionQuality.depth, yPos);
  yPos = addScoreBar(doc, 'Candidate Engagement Level', data.questionQuality.engagement, yPos);
  yPos += 10;
  
  yPos = addSection(doc, 'IV. TOP QUESTIONS ASKED', yPos);
  doc.setFont('helvetica', 'normal');
  doc.text('Most effective questions that elicited valuable candidate responses:', 20, yPos);
  yPos += 8;
  
  const topQuestions = [
    'Experience-based questions about past projects and achievements',
    'Behavioral questions assessing problem-solving approach',
    'Technical questions aligned with job requirements'
  ];
  yPos = addBulletList(doc, topQuestions, yPos);
  
  yPos = addSection(doc, 'V. INTERVIEW COVERAGE ANALYSIS', yPos);
  
  if (data.interviewCoverage.experienceCovered.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.text('Experience Areas Thoroughly Covered:', 20, yPos);
    yPos += 8;
    yPos = addBulletList(doc, data.interviewCoverage.experienceCovered.slice(0, 8), yPos);
  }
  
  if (data.interviewCoverage.skillsCovered.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.text('Skills Successfully Assessed:', 20, yPos);
    yPos += 8;
    yPos = addBulletList(doc, data.interviewCoverage.skillsCovered.slice(0, 8), yPos);
  }
  
  yPos = addSection(doc, 'VI. RECRUITER EFFICIENCY METRICS', yPos);
  
  const efficiencyMetrics = [
    'Question clarity and structure: ' + (data.questionQuality.depth >= 7 ? 'Excellent' : data.questionQuality.depth >= 5 ? 'Good' : 'Needs improvement'),
    'Time management: Questions distributed effectively throughout interview',
    'Candidate engagement: ' + (data.questionQuality.engagement >= 7 ? 'High' : data.questionQuality.engagement >= 5 ? 'Moderate' : 'Could be improved'),
    'Follow-up effectiveness: ' + (data.questionQuality.depth >= 7 ? 'Strong probing questions used' : 'Consider more detailed follow-ups')
  ];
  yPos = addBulletList(doc, efficiencyMetrics, yPos);
  
  if (data.interviewCoverage.missedOpportunities.length > 0) {
    yPos = addSection(doc, 'VII. MISSED OPPORTUNITIES', yPos);
    doc.setFont('helvetica', 'normal');
    doc.text('Consider exploring these areas in future interviews for more comprehensive assessment:', 20, yPos);
    yPos += 8;
    yPos = addBulletList(doc, data.interviewCoverage.missedOpportunities, yPos);
  }
  
  yPos = addSection(doc, 'VIII. KEY STRENGTHS', yPos);
  doc.setFont('helvetica', 'normal');
  doc.text('Notable strengths observed in the interviewing approach:', 20, yPos);
  yPos += 8;
  yPos = addBulletList(doc, data.effectiveness.strengths.length > 0 ? data.effectiveness.strengths : ['Structured approach to interviews', 'Good rapport with candidates'], yPos);
  
  yPos = addSection(doc, 'IX. ACTIONABLE RECOMMENDATIONS', yPos);
  doc.setFont('helvetica', 'normal');
  doc.text('To enhance future interview effectiveness and candidate evaluation quality:', 20, yPos);
  yPos += 8;
  yPos = addBulletList(doc, data.effectiveness.improvements.length > 0 ? data.effectiveness.improvements : ['Continue using structured interview frameworks', 'Consider adding more behavioral questions'], yPos);
  
  yPos = addSection(doc, 'X. CONCLUSION & INSIGHTS', yPos);
  doc.setFont('helvetica', 'normal');
  
  const conclusionText = data.overallScore >= 7
    ? 'The interview demonstrated high quality with effective questioning, strong coverage of key areas, and excellent candidate engagement. This approach is well-suited for identifying qualified candidates.'
    : data.overallScore >= 5
    ? 'The interview showed good fundamentals but has room for improvement in certain areas. Implementing the recommendations above will enhance candidate assessment quality.'
    : 'Consider refining the interview approach to better align with job requirements and improve candidate evaluation effectiveness. Focus on the recommended improvements for better hiring outcomes.';
  
  const conclusionLines = doc.splitTextToSize(conclusionText, 160);
  conclusionLines.forEach((line: string) => {
    yPos = addPageBreak(doc, yPos);
    doc.text(line, 20, yPos);
    yPos += 6;
  });
  
  yPos = addPageBreak(doc, yPos + 20);
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text('This report is AI-generated to help improve interview quality and candidate assessment.', 20, yPos);
  yPos += 5;
  doc.text(`Report generated on ${new Date().toLocaleDateString()} | Confidential - For Internal Use Only`, 20, yPos);
  
  return new Uint8Array(doc.output('arraybuffer'));
}
