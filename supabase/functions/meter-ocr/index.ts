// ============================================================================
// AeroTrack — meter-ocr Edge Function
// ----------------------------------------------------------------------------
// Parses a photo of a Hobbs / tach / flight meter into numeric readings using a
// Claude vision model. Holds the VENDOR Anthropic key server-side so customers
// never enter one. The parsed value is returned untouched — it is NOT applied
// to aircraft hours here; the client confirms it and calls apply_meter_reading()
// (which re-validates monotonicity + plausibility) so airworthiness math never
// trusts the model blindly.
//
// Deploy (Verify JWT ON is fine — the client sends the user's bearer token):
//   supabase functions deploy meter-ocr
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//   (optional) supabase secrets set OCR_MODEL=claude-sonnet-4-5
// ============================================================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: CORS });
  }

  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) {
    return json({ error: "ANTHROPIC_API_KEY not configured" }, 500);
  }

  let body: { image?: string; media_type?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }
  if (!body.image) return json({ error: "missing image" }, 400);

  const model = Deno.env.get("OCR_MODEL") ?? "claude-sonnet-4-5";
  const prompt =
    "This is a photo of an aircraft engine/airframe time meter (Hobbs, tach, " +
    "flight timer, and/or airframe total). Read the number(s) exactly as shown, " +
    "including the tenths digit. Watch for a mechanical drum caught mid-roll and " +
    "for the decimal point. Respond with ONLY minified JSON of the form " +
    '{"values":{"hobbs":1234.5,"tach":1180.2,"flight":980.1,"total":1402.3},' +
    '"confidence":0.0,"notes":"..."} — include only the meters you can actually ' +
    "read; omit the rest. confidence is 0..1. notes flags glare/ambiguity.";

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 400,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: body.media_type ?? "image/jpeg",
                data: body.image,
              },
            },
            { type: "text", text: prompt },
          ],
        },
      ],
    }),
  });

  if (!resp.ok) {
    return json({ error: `anthropic ${resp.status}`, detail: await resp.text() }, 502);
  }

  const data = await resp.json();
  const text: string = data?.content?.[0]?.text ?? "";
  // Extract the JSON object even if the model wrapped it in prose.
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return json({ error: "no JSON in model output", raw: text }, 502);

  try {
    const parsed = JSON.parse(match[0]);
    return json({ ...parsed, model });
  } catch {
    return json({ error: "unparseable model output", raw: text }, 502);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}
