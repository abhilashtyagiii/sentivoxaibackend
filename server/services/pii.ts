import { detectPIIWithGemini } from "./gemini";

/**
 * Gemini-Powered PII Detection and Redaction Service
 * Uses Gemini AI to contextually detect and mask personally identifiable information
 * Falls back to regex patterns if AI detection fails
 */

export interface PIIEntity {
  type: "email" | "phone" | "ssn" | "address" | "credit_card" | "date_of_birth" | "name";
  value: string;
  position: number;
  confidence: number;
}

/**
 * Detect PII using Gemini for contextual understanding
 * Falls back to regex if AI detection fails
 */
export async function detectPII(text: string): Promise<PIIEntity[]> {
  try {
    // Try Gemini-powered detection first (saves OpenAI API calls)
    const aiEntities = await detectPIIWithGemini(text);

    // Also run regex patterns to catch anything AI missed
    const regexEntities = detectPIIWithRegex(text);

    // Merge and deduplicate
    const allEntities = [...aiEntities, ...regexEntities];
    const uniqueEntities = deduplicateEntities(allEntities);

    console.log(`✅ Gemini PII Detection: Found ${uniqueEntities.length} PII entities`);
    return uniqueEntities;
  } catch (error) {
    console.error("Gemini PII detection failed, falling back to regex:", error);
    // Fallback to regex-only detection
    return detectPIIWithRegex(text);
  }
}

/**
 * Deduplicate overlapping PII entities
 */
function deduplicateEntities(entities: PIIEntity[]): PIIEntity[] {
  const sorted = [...entities].sort((a, b) => a.position - b.position);
  const unique: PIIEntity[] = [];

  for (const entity of sorted) {
    const overlaps = unique.some(existing => {
      const existingEnd = existing.position + existing.value.length;
      const entityEnd = entity.position + entity.value.length;
      
      // Check if entities overlap
      return (
        (entity.position >= existing.position && entity.position < existingEnd) ||
        (entityEnd > existing.position && entityEnd <= existingEnd) ||
        (entity.position <= existing.position && entityEnd >= existingEnd)
      );
    });

    if (!overlaps) {
      unique.push(entity);
    }
  }

  return unique;
}

/**
 * Detect PII entities using regex patterns (fallback method)
 */
function detectPIIWithRegex(text: string): PIIEntity[] {
  const entities: PIIEntity[] = [];

  // Email pattern
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  let match;
  while ((match = emailRegex.exec(text)) !== null) {
    entities.push({
      type: "email",
      value: match[0],
      position: match.index,
      confidence: 0.95,
    });
  }

  // Phone pattern (various formats)
  const phoneRegex = /\b(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
  while ((match = phoneRegex.exec(text)) !== null) {
    entities.push({
      type: "phone",
      value: match[0],
      position: match.index,
      confidence: 0.9,
    });
  }

  // SSN pattern
  const ssnRegex = /\b\d{3}-\d{2}-\d{4}\b/g;
  while ((match = ssnRegex.exec(text)) !== null) {
    entities.push({
      type: "ssn",
      value: match[0],
      position: match.index,
      confidence: 0.98,
    });
  }

  // Credit card pattern (simplified)
  const ccRegex = /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g;
  while ((match = ccRegex.exec(text)) !== null) {
    entities.push({
      type: "credit_card",
      value: match[0],
      position: match.index,
      confidence: 0.85,
    });
  }

  // Simple address detection (street + number)
  const addressRegex = /\b\d+\s+[A-Z][a-z]+\s+(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln)\b/gi;
  while ((match = addressRegex.exec(text)) !== null) {
    entities.push({
      type: "address",
      value: match[0],
      position: match.index,
      confidence: 0.75,
    });
  }

  return entities;
}

/**
 * Redact PII from text
 */
export function redactPII(text: string, entities: PIIEntity[]): string {
  // Sort entities by position (descending) to replace from end to beginning
  const sorted = [...entities].sort((a, b) => b.position - a.position);

  let redacted = text;

  for (const entity of sorted) {
    const before = redacted.substring(0, entity.position);
    const after = redacted.substring(entity.position + entity.value.length);
    const replacement = `[REDACTED-${entity.type.toUpperCase()}]`;

    redacted = before + replacement + after;
  }

  return redacted;
}

/**
 * Redact PII but keep partial information for context
 */
export function partialRedact(text: string, entities: PIIEntity[]): string {
  const sorted = [...entities].sort((a, b) => b.position - a.position);

  let redacted = text;

  for (const entity of sorted) {
    let replacement: string;

    switch (entity.type) {
      case "email":
        const emailParts = entity.value.split("@");
        replacement = emailParts[0].substring(0, 2) + "***@" + emailParts[1];
        break;
      case "phone":
        const digits = entity.value.replace(/\D/g, "");
        replacement = "***-***-" + digits.slice(-4);
        break;
      case "ssn":
        replacement = "***-**-" + entity.value.slice(-4);
        break;
      case "credit_card":
        const ccDigits = entity.value.replace(/\D/g, "");
        replacement = "**** **** **** " + ccDigits.slice(-4);
        break;
      default:
        replacement = `[${entity.type.toUpperCase()}]`;
    }

    const before = redacted.substring(0, entity.position);
    const after = redacted.substring(entity.position + entity.value.length);

    redacted = before + replacement + after;
  }

  return redacted;
}
