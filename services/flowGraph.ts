/**
 * Graph-based flow continuity analysis
 * Models conversation as a directed graph to detect logical connections and missed follow-ups
 */

export interface FlowNode {
  id: string;
  type: "question" | "answer";
  text: string;
  timestamp: number;
  speaker: string;
  category?: string;
}

export interface FlowEdge {
  from: string;
  to: string;
  type: "direct_response" | "follow_up" | "topic_shift" | "disconnected";
  strength: number;
  logicalConnection: string;
}

export interface MissedFollowUp {
  afterNode: string;
  suggestedQuestion: string;
  suggestedQuestions?: string[];
  importance: "high" | "medium" | "low";
  reasoning: string;
  specificContext?: string;
  answerExcerpt?: string;
  followUpType?: "technical_depth" | "behavioral" | "clarification" | "project_details" | "quantification" | "team_collaboration";
}

export interface FlowGraphAnalysis {
  nodes: FlowNode[];
  edges: FlowEdge[];
  missedFollowUps: MissedFollowUp[];
  logicalConnectionScore: number;
  topicCoherence: number;
  conversationBranches: string[][];
}

/**
 * Build conversation flow graph from Q&A pairs
 */
export function buildFlowGraph(
  questions: Array<{ text: string; timestamp?: number }>,
  answers: Array<{ text: string; timestamp?: number }>
): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];

  // Create nodes for questions and answers
  for (let i = 0; i < questions.length; i++) {
    const qNode: FlowNode = {
      id: `q${i}`,
      type: "question",
      text: questions[i].text,
      timestamp: questions[i].timestamp || i * 2,
      speaker: "recruiter",
    };
    nodes.push(qNode);

    if (answers[i]) {
      const aNode: FlowNode = {
        id: `a${i}`,
        type: "answer",
        text: answers[i].text,
        timestamp: answers[i].timestamp || i * 2 + 1,
        speaker: "candidate",
      };
      nodes.push(aNode);

      // Direct question-answer edge
      edges.push({
        from: qNode.id,
        to: aNode.id,
        type: "direct_response",
        strength: 1.0,
        logicalConnection: "Direct response to question",
      });
    }
  }

  // Detect follow-up connections between consecutive questions
  for (let i = 0; i < questions.length - 1; i++) {
    const currentQ = questions[i];
    const nextQ = questions[i + 1];

    // Analyze if next question follows up on previous answer
    const connectionType = analyzeQuestionConnection(currentQ.text, nextQ.text);

    edges.push({
      from: `a${i}`,
      to: `q${i + 1}`,
      type: connectionType.type,
      strength: connectionType.strength,
      logicalConnection: connectionType.reasoning,
    });
  }

  return { nodes, edges };
}

/**
 * Analyze connection between consecutive questions
 */
function analyzeQuestionConnection(prevQ: string, nextQ: string): {
  type: "follow_up" | "topic_shift" | "disconnected";
  strength: number;
  reasoning: string;
} {
  const prevWords = prevQ.toLowerCase().split(/\s+/);
  const nextWords = nextQ.toLowerCase().split(/\s+/);

  // Check for shared keywords (simple heuristic)
  const sharedKeywords = prevWords.filter(w => nextWords.includes(w) && w.length > 4);

  if (sharedKeywords.length >= 2) {
    return {
      type: "follow_up",
      strength: 0.8,
      reasoning: `Follow-up on same topic (${sharedKeywords.slice(0, 2).join(", ")})`,
    };
  } else if (sharedKeywords.length === 1) {
    return {
      type: "topic_shift",
      strength: 0.5,
      reasoning: "Related but different topic",
    };
  } else {
    return {
      type: "disconnected",
      strength: 0.2,
      reasoning: "No clear logical connection",
    };
  }
}

/**
 * Detect missed follow-up opportunities with specific, actionable feedback
 */
export function detectMissedFollowUps(
  questions: Array<{ text: string }>,
  answers: Array<{ text: string; keySkills?: string[] }>,
  edges: FlowEdge[]
): MissedFollowUp[] {
  const missed: MissedFollowUp[] = [];

  for (let i = 0; i < answers.length - 1; i++) {
    const answer = answers[i];
    const question = questions[i];
    const nextQuestion = questions[i + 1];
    const answerText = answer.text.toLowerCase();
    const answerExcerpt = answer.text.substring(0, 150) + (answer.text.length > 150 ? "..." : "");

    // Detect numbers/metrics that weren't quantified
    const hasMetrics = /\d+|several|many|multiple|few|some/i.test(answer.text);
    const hasYearsExperience = /(\d+)\s*(year|yr)/i.test(answer.text);
    const hasProjectMention = /project|developed|built|created|implemented|designed/i.test(answerText);
    const hasTeamMention = /team|collaborate|led|managed|worked with/i.test(answerText);
    const hasToolMention = /using|with|technology|framework|library|platform/i.test(answerText);
    const hasResultMention = /result|outcome|achievement|success|improved|increased|reduced/i.test(answerText);

    // Check for technical skills that weren't explored
    if (answer.keySkills && answer.keySkills.length > 0 && nextQuestion) {
      const wasFollowedUp = answer.keySkills.some(skill =>
        nextQuestion.text.toLowerCase().includes(skill.toLowerCase())
      );

      if (!wasFollowedUp) {
        const primarySkill = answer.keySkills[0];
        missed.push({
          afterNode: `a${i}`,
          suggestedQuestion: `Can you walk me through a specific project where you used ${primarySkill}? What was your role and what were the technical challenges?`,
          suggestedQuestions: [
            `Can you walk me through a specific project where you used ${primarySkill}? What was your role and what were the technical challenges?`,
            `How many years of hands-on experience do you have with ${primarySkill}?`,
            `What was the most complex problem you solved using ${primarySkill}?`,
            `How do you stay updated with ${primarySkill}? Any recent certifications or training?`
          ],
          importance: "high",
          reasoning: `Candidate mentioned ${answer.keySkills.join(", ")} in their response but you didn't explore their depth of experience, specific use cases, or technical proficiency with these skills.`,
          specificContext: `After Question: "${question.text}"`,
          answerExcerpt: answerExcerpt,
          followUpType: "technical_depth"
        });
      }
    }

    // Detect project mentions without depth exploration
    if (hasProjectMention && nextQuestion && !nextQuestion.text.match(/project|tell me more|elaborate|example|specific/i)) {
      const projectMatch = answer.text.match(/project|developed|built|created|implemented|designed/i);
      if (projectMatch) {
        missed.push({
          afterNode: `a${i}`,
          suggestedQuestion: `That sounds interesting. Can you walk me through that project from start to finish? What was the problem, your approach, and the outcome?`,
          suggestedQuestions: [
            `Can you walk me through that project from start to finish? What was the problem, your approach, and the outcome?`,
            `What was your specific role in that project? Were you leading it or part of a team?`,
            `What were the biggest technical challenges you faced and how did you overcome them?`,
            `How did you measure the success of that project? What were the results?`
          ],
          importance: "high",
          reasoning: `Candidate mentioned a project but you moved on without exploring: their specific role, the technical challenges faced, the team structure, or measurable outcomes. This is a missed opportunity to assess their hands-on experience and problem-solving abilities.`,
          specificContext: `After Question: "${question.text}"`,
          answerExcerpt: answerExcerpt,
          followUpType: "project_details"
        });
      }
    }

    // Detect vague answers that need quantification
    if (nextQuestion && (hasMetrics || hasYearsExperience) && !nextQuestion.text.match(/how many|how much|specific|quantify|measure/i)) {
      missed.push({
        afterNode: `a${i}`,
        suggestedQuestion: `Can you quantify that for me? Specifically, what were the metrics or scale involved?`,
        suggestedQuestions: [
          `Can you quantify that for me? What were the specific numbers or metrics?`,
          `How many team members were involved? What was the project size or scale?`,
          `What was the measurable impact or result of your work?`,
          `Can you give me specific examples with numbers - team size, timelines, or outcomes?`
        ],
        importance: "medium",
        reasoning: `Candidate gave a vague response without specific numbers or metrics. You should have asked for quantifiable data to better assess the scale and impact of their experience.`,
        specificContext: `After Question: "${question.text}"`,
        answerExcerpt: answerExcerpt,
        followUpType: "quantification"
      });
    }

    // Detect team/collaboration mentions without depth
    if (nextQuestion && hasTeamMention && !nextQuestion.text.match(/team|collaborate|lead|management|role/i)) {
      missed.push({
        afterNode: `a${i}`,
        suggestedQuestion: `Tell me more about your role in the team. Did you lead any initiatives? How did you handle collaboration challenges?`,
        suggestedQuestions: [
          `Tell me more about your role in the team. Were you leading or contributing as an individual?`,
          `How large was the team? What was the reporting structure?`,
          `Can you describe a conflict or challenge you faced while collaborating and how you resolved it?`,
          `How did you ensure effective communication and coordination within the team?`
        ],
        importance: "medium",
        reasoning: `Candidate mentioned teamwork but you didn't explore their leadership abilities, team dynamics, conflict resolution skills, or collaboration style - important for assessing cultural fit and soft skills.`,
        specificContext: `After Question: "${question.text}"`,
        answerExcerpt: answerExcerpt,
        followUpType: "team_collaboration"
        });
    }

    // Check for disconnected edges (abrupt topic changes)
    const edge = edges.find(e => e.from === `a${i}` && e.to === `q${i + 1}`);
    if (edge && edge.type === "disconnected" && nextQuestion) {
      missed.push({
        afterNode: `a${i}`,
        suggestedQuestion: `Before we move on, can you elaborate on what you just mentioned? I'd like to understand that better.`,
        suggestedQuestions: [
          `Before we move on, can you elaborate on that? I want to make sure I understand fully.`,
          `That's interesting - can you give me a specific example to illustrate that?`,
          `Can you walk me through your thought process on that?`,
          `Tell me more about how you approached that situation.`
        ],
        importance: "medium",
        reasoning: `You changed topics abruptly without properly exploring the candidate's previous answer. This suggests rushed interviewing and may have missed valuable insights about their experience or thought process.`,
        specificContext: `After Question: "${question.text}", you jumped to: "${nextQuestion.text}"`,
        answerExcerpt: answerExcerpt,
        followUpType: "clarification"
      });
    }

    // Detect result/achievement mentions without STAR method follow-up
    if (hasResultMention && nextQuestion && !nextQuestion.text.match(/situation|task|action|result|context|challenge/i)) {
      missed.push({
        afterNode: `a${i}`,
        suggestedQuestion: `That's a great achievement. Can you walk me through the situation? What was the challenge, what actions did you take, and what were the measurable results?`,
        suggestedQuestions: [
          `Walk me through the situation: What was the context and the specific challenge you faced?`,
          `What was your specific task or goal in that situation?`,
          `What actions did you personally take to address this challenge?`,
          `What were the measurable results? How did you know you succeeded?`
        ],
        importance: "high",
        reasoning: `Candidate mentioned results or achievements but you didn't use the STAR method (Situation, Task, Action, Result) to validate their claim and understand their actual contribution versus team achievements.`,
        specificContext: `After Question: "${question.text}"`,
        answerExcerpt: answerExcerpt,
        followUpType: "behavioral"
      });
    }
  }

  // Deduplicate similar missed opportunities
  const deduplicated = deduplicateMissedFollowUps(missed);
  
  return deduplicated;
}

/**
 * Remove duplicate or very similar missed follow-up opportunities
 */
function deduplicateMissedFollowUps(missed: MissedFollowUp[]): MissedFollowUp[] {
  const seen = new Set<string>();
  const result: MissedFollowUp[] = [];
  
  for (const item of missed) {
    const key = `${item.afterNode}-${item.followUpType}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  
  return result;
}

/**
 * Calculate logical connection score
 */
export function calculateLogicalScore(edges: FlowEdge[]): number {
  if (edges.length === 0) return 0;

  const avgStrength = edges.reduce((sum, e) => sum + e.strength, 0) / edges.length;
  return avgStrength * 100;
}

/**
 * Identify conversation branches (topic threads)
 */
export function identifyConversationBranches(
  nodes: FlowNode[],
  edges: FlowEdge[]
): string[][] {
  const branches: string[][] = [];
  let currentBranch: string[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];

    if (node.type === "question") {
      // Check if this is a topic shift
      const incomingEdge = edges.find(e => e.to === node.id);

      if (incomingEdge && incomingEdge.type === "topic_shift" && currentBranch.length > 0) {
        branches.push([...currentBranch]);
        currentBranch = [];
      }
    }

    currentBranch.push(node.id);
  }

  if (currentBranch.length > 0) {
    branches.push(currentBranch);
  }

  return branches;
}
