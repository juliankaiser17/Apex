/**
 * APEX — Robust JSON Extractor & Parser for Vision Language Models
 * 
 * Responsibilities:
 * 1. Strips Markdown code fences (```json ... ``` or ``` ... ```)
 * 2. Ignores harmless leading/trailing conversational text
 * 3. Quote-aware and escape-aware scanner with balanced-depth tracking for braces and brackets
 * 4. Never uses naive ungrounded regexes like /\{.*\}/
 * 5. Strictly avoids guessing missing commas, quotes, brackets, or values (no arbitrary repair)
 * 6. Safely handles multiline string literals with unescaped control characters
 */

export interface JsonExtractionResult<T = any> {
  success: boolean;
  data?: T;
  extracted?: string;
  error?: string;
  rawText: string;
  isMalformed?: boolean;
}

/**
 * Deterministically locates and extracts the first complete, balanced JSON object or array.
 * Correctly accounts for braces, brackets, and quotes inside string literals and escape sequences.
 */
export function extractJsonPayload(rawText: string): string | null {
  if (!rawText || typeof rawText !== 'string') return null;

  let text = rawText.trim();
  if (!text) return null;

  // 1. Remove surrounding Markdown code fences if present
  const fullFenceMatch = text.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i);
  if (fullFenceMatch) {
    text = fullFenceMatch[1].trim();
  } else {
    // If enclosed in a code block anywhere, extract the first fenced block
    const innerFenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/i);
    if (innerFenceMatch && innerFenceMatch[1]) {
      const candidateInside = innerFenceMatch[1].trim();
      if (candidateInside.startsWith('{') || candidateInside.startsWith('[')) {
        text = candidateInside;
      }
    }
  }

  // 2. Locate first JSON object or array using a quote-aware, escape-aware scanner
  let startIndex = -1;
  let depth = 0;
  let inString = false;
  let isEscaped = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (!inString) {
      if (depth === 0) {
        if (ch === '{' || ch === '[') {
          startIndex = i;
          depth = 1;
        }
      } else {
        if (ch === '"') {
          inString = true;
          isEscaped = false;
        } else if (ch === '{' || ch === '[') {
          depth++;
        } else if (ch === '}' || ch === ']') {
          depth--;
          if (depth === 0) {
            // Found matching closing delimiter for root structure
            return text.substring(startIndex, i + 1).trim();
          }
        }
      }
    } else {
      // Inside string literal: ignore all braces and brackets
      if (isEscaped) {
        isEscaped = false;
      } else if (ch === '\\') {
        isEscaped = true;
      } else if (ch === '"') {
        inString = false;
      }
    }
  }

  return null;
}

/**
 * Sanitizes harmless unescaped raw control characters (literal newlines/tabs) inside string literals.
 * RFC 8259 forbids raw control chars inside JSON strings. VLMs often emit literal newlines.
 */
function sanitizeControlCharsInStrings(jsonStr: string): string {
  let out = '';
  let inStr = false;
  let esc = false;

  for (let i = 0; i < jsonStr.length; i++) {
    const ch = jsonStr[i];
    if (!inStr) {
      if (ch === '"') inStr = true;
      out += ch;
    } else {
      if (esc) {
        esc = false;
        out += ch;
      } else if (ch === '\\') {
        esc = true;
        out += ch;
      } else if (ch === '"') {
        inStr = false;
        out += ch;
      } else if (ch === '\n') {
        out += '\\n';
      } else if (ch === '\r') {
        out += '\\r';
      } else if (ch === '\t') {
        out += '\\t';
      } else {
        out += ch;
      }
    }
  }

  return out;
}

/**
 * Safely extracts and parses JSON from raw VLM output.
 * If extraction or parsing fails, returns isMalformed: true without inventing content.
 */
export function safeParseVlmJson<T = any>(rawText: string): JsonExtractionResult<T> {
  if (!rawText || typeof rawText !== 'string') {
    return {
      success: false,
      error: 'Empty or non-string response received from vision provider',
      rawText: rawText || '',
      isMalformed: true
    };
  }

  const extracted = extractJsonPayload(rawText);
  if (!extracted) {
    // Check if the candidate text was an attempted JSON structure that failed syntax
    let candidate = rawText.trim();
    const fenceMatch = candidate.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/i);
    if (fenceMatch) candidate = fenceMatch[1].trim();

    if ((candidate.startsWith('{') && candidate.endsWith('}')) || (candidate.startsWith('[') && candidate.endsWith(']'))) {
      try {
        const data = JSON.parse(candidate);
        return {
          success: true,
          data,
          extracted: candidate,
          rawText
        };
      } catch (syntaxErr: any) {
        return {
          success: false,
          error: syntaxErr?.message || 'Malformed JSON syntax',
          extracted: candidate,
          rawText,
          isMalformed: true
        };
      }
    }

    return {
      success: false,
      error: 'No complete, balanced JSON object or array found in provider response',
      rawText,
      isMalformed: true
    };
  }

  // Attempt 1: Standard JSON parse on extracted balanced structure
  try {
    const data = JSON.parse(extracted);
    return {
      success: true,
      data,
      extracted,
      rawText
    };
  } catch (initialErr: any) {
    // Attempt 2: Sanitize only raw literal newlines/control characters inside strings
    try {
      const sanitized = sanitizeControlCharsInStrings(extracted);
      const data = JSON.parse(sanitized);
      return {
        success: true,
        data,
        extracted: sanitized,
        rawText
      };
    } catch {
      // Genuinely malformed syntax (e.g. unescaped quote, missing comma, corrupted array)
      // Do NOT guess missing tokens or invent values!
      return {
        success: false,
        error: initialErr?.message || 'JSON parsing error',
        extracted,
        rawText,
        isMalformed: true
      };
    }
  }
}
