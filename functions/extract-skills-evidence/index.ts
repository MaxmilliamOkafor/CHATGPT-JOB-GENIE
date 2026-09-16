/**
 * EXTRACTION RUNS HERE BECAUSE THE CREDENTIAL DOES.
 *
 * A browser extension cannot hold an API key. Anything shipped to the
 * page is readable by anyone who installs it, so the model call lives on
 * the server and the key comes from the environment.
 *
 * This function does one thing: it sends the posting to the model under
 * a fixed specification and returns what came back, unchanged. It does
 * NOT decide whether a returned skill is real. That is done in the
 * extension by skill-evidence.js, against the posting text the extension
 * already has, because a validator that trusts the same service it is
 * validating is not a validator.
 *
 * The posting is DATA. It travels as a separate JSON user message and is
 * never concatenated into the instructions, so text inside a job advert
 * cannot rewrite the specification it is being read under.
 */
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { EXTRACTION_PROMPT, SKILL_SCHEMA } from "./prompt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// The reference implementation's ceiling, kept: a posting longer than
// this is a page that was scraped wrong, and sending it costs money to
// learn that.
const MAX_CHARS = 100000;

const fail = (status: number, code: string, message: string) =>
  new Response(JSON.stringify({ error: code, message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let body: { jobDescription?: string; model?: string };
  try {
    body = await req.json();
  } catch (_e) {
    return fail(400, "bad_request", "Expected a JSON body.");
  }

  const jd = typeof body.jobDescription === "string" ? body.jobDescription : "";
  if (!jd.trim()) {
    return fail(400, "empty_input", "The job description is empty.");
  }
  if (jd.length > MAX_CHARS) {
    return fail(413, "input_too_large",
      `The job description exceeds ${MAX_CHARS} characters; narrow the input.`);
  }

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    // Named precisely, because "extraction failed" sends someone looking
    // at the posting when the problem is a missing secret.
    return fail(503, "no_credentials",
      "OPENAI_API_KEY is not set for this function; live extraction is unavailable.");
  }

  const model = typeof body.model === "string" && body.model.trim()
    ? body.model.trim()
    : (Deno.env.get("OPENAI_MODEL") || "gpt-4o-2024-08-06");

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        store: false,
        instructions: EXTRACTION_PROMPT,
        input: [{
          role: "user",
          content: JSON.stringify({ job_description: jd }),
        }],
        text: {
          format: {
            type: "json_schema",
            name: "skills",
            strict: true,
            schema: SKILL_SCHEMA,
          },
        },
      }),
    });
  } catch (_e) {
    // No cause text: it can carry the request, and the request carries
    // the credential.
    return fail(502, "provider_unreachable",
      "The extraction service could not be reached.");
  }

  if (!response.ok) {
    // The status only. An upstream error body can echo request material.
    return fail(502, "provider_error",
      `The extraction service returned HTTP ${response.status}; check model access and quota.`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (_e) {
    return fail(502, "provider_error", "The extraction service returned an unreadable reply.");
  }

  // Returned as received. Unwrapping, validating and matching all happen
  // in the extension, against the posting it holds.
  return new Response(JSON.stringify({ response: payload, model }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
