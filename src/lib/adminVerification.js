import db from '@/api/base44Client';

/**
 * Runs AI-powered verification on an uploaded admin document.
 * Uses InvokeLLM with vision + web search to:
 *   1. Detect signs of digital doctoring/tampering in the document
 *   2. Cross-reference the submitter's identity against LinkedIn and
 *      other public internet sources (school directories, news, etc.)
 *
 * @param {Object} params
 * @param {string} params.file_url - URL of the uploaded document
 * @param {string} params.full_name - Submitter's full name
 * @param {string} params.email - Submitter's email
 * @param {string} params.school_name - School they claim to administer
 * @returns {Promise<Object>} Verification assessment with score, flags, recommendation
 */
export async function verifyAdminDocument({ file_url, full_name, email, school_name }) {
  const adminName = full_name || email || "unknown";

  const prompt = `You are a forensic document verification specialist working for a school transportation platform. Your job is to determine whether an uploaded administrator verification document is genuine or doctored, and to cross-reference the submitter's identity against public internet sources.

## Context
- Submitter name: "${adminName}"
- School they claim to administer: "${school_name}"
- Submitter email: "${email || "not provided"}"

## Step 1 — Document Authenticity Analysis
Examine the uploaded document image carefully for signs of digital manipulation or doctoring. Look for:
- Inconsistent fonts, sizing, or spacing that suggest edited text
- Mismatched resolution, compression artifacts, or pixelation in specific regions (sign of copy-paste)
- Blurred or feathered edges around text/logos (sign of cloning or layering)
- Inconsistent lighting, shadows, or reflections
- Misaligned text boxes, headers, or borders
- Digital noise patterns that differ across regions
- Watermarks or seals that appear altered, duplicated, or misplaced
- Text that does not align with the document's baseline or grid
- Any anachronisms or inconsistencies in dates, logos, or formatting
- Signs the document is a screenshot of a digitally fabricated file rather than a scan/photo of a physical document

## Step 2 — Public Source Cross-Reference
Search the internet for evidence that "${adminName}" is genuinely associated with "${school_name}" in an administrative or staff capacity. Look for:
- LinkedIn profiles showing this person works at this school or district
- Official school or district staff directory listings
- Public records, news articles, press releases, or board meeting minutes mentioning this person
- Professional education listings, conference speaker bios, or teacher/principal registry entries
- Any evidence that contradicts the claim (e.g., the name belongs to someone unaffiliated, or the school doesn't exist)

## Step 3 — Cross-Reference
Compare the name and role on the document with what you found in public sources. Determine whether the identity is corroborated, contradicted, or unverifiable.

## Your Response
Return a structured JSON assessment:
- authenticity_score: integer 0-100 — your confidence the document is genuine and unaltered (0 = clearly doctored, 100 = clearly authentic)
- name_match: "match" if public sources confirm this person at this school, "mismatch" if sources contradict it, "no_records" if no relevant public records were found
- public_sources_found: array of short descriptions of relevant public sources found (e.g., "LinkedIn: Principal at Riverside Elementary", "School website staff directory listing"). Empty array if none found.
- flags: array of specific red flags or concerns detected in the document or identity. Empty array if none.
- summary: a concise (1-3 sentence) explanation of your overall assessment
- recommendation: "approve" if the document appears genuine and identity is corroborated (or at least not contradicted), "review" if there are moderate concerns that warrant manual review, "reject" if the document shows clear signs of doctoring or the identity is contradicted by public sources`;

  const result = await db.integrations.Core.InvokeLLM({
    prompt,
    file_urls: [file_url],
    add_context_from_internet: true,
    model: "gemini_3_1_pro",
    response_json_schema: {
      type: "object",
      properties: {
        authenticity_score: { type: "number" },
        name_match: {
          type: "string",
          enum: ["match", "mismatch", "no_records"],
        },
        public_sources_found: {
          type: "array",
          items: { type: "string" },
        },
        flags: {
          type: "array",
          items: { type: "string" },
        },
        summary: { type: "string" },
        recommendation: {
          type: "string",
          enum: ["approve", "review", "reject"],
        },
      },
      required: [
        "authenticity_score",
        "name_match",
        "public_sources_found",
        "flags",
        "summary",
        "recommendation",
      ],
    },
  });

  return result;
}

/**
 * Maps an LLM verification recommendation to a status string stored on the user.
 */
export function recommendationToStatus(recommendation) {
  if (recommendation === "approve") return "passed";
  if (recommendation === "reject") return "failed";
  return "flagged";
}