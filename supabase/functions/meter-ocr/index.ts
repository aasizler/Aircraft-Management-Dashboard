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
// RESOLUTION
// The API downscales any image whose long edge exceeds 1568px, so on a photo of
// a whole instrument panel the hours text lands below the model's resolving
// power — a real G3X photo misread 5905.3 as 5505.3 on every attempt. The
// client therefore splits the photo into overlapping native-resolution tiles
// and calls this function once per tile, merging the results (see
// web/lib/image.ts tileImage). Tiles with no meter in them return empty values.
// Two cheaper designs were tried and measured against a real G3X photo, and
// both failed. Asking for a bounding box put the hours a third of the frame too
// low. Asking which of six drawn, numbered bands held them was stable in
// isolation but drifted between [4] and [3,4] in a full run, and the resulting
// full-width strip still downscales past the 1568 cap — one run read 4399.4 for
// 4349.4, another swapped the labels and called the airframe total "hobbs".
// Tiling costs more calls and is the only version that reads reliably.
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

/**
 * The read pass. Label aliases are spelled out because glass panels (G3X, G5)
 * print "ENGINE HOURS"/"TOTAL HOURS" rather than "Hobbs"/"Tach", and earlier
 * versions invented keys like `engine_hours` that the client then dropped on
 * the floor.
 */
const READ_PROMPT =
  "This is a photo of aircraft time meter(s) — a mechanical Hobbs/tach drum, " +
  "or an hours readout on a glass panel. Read the number(s) EXACTLY as shown, " +
  "including the tenths digit. Work digit by digit and re-check each one; a " +
  "single wrong digit corrupts a maintenance record. Watch for a mechanical " +
  "drum caught mid-roll, for glare, and for the decimal point.\n\n" +
  "Map each label you see to exactly one of these four keys:\n" +
  '  hobbs  — "HOBBS", "ENGINE HOURS", "ENG HRS", "ENGINE TIME"\n' +
  '  tach   — "TACH", "TACH TIME", "RECORDING TACH"\n' +
  '  flight — "FLIGHT TIME", "FLT TIME", "AIR TIME"\n' +
  '  total  — "TOTAL HOURS", "TOTAL TIME", "TT", "AIRFRAME"\n\n' +
  "Respond with ONLY minified JSON of the form " +
  '{"values":{"hobbs":1234.5,"total":1402.3},' +
  '"readings":[{"label":"ENGINE HOURS","value":1234.5,"key":"hobbs"}],' +
  '"confidence":0.0,"notes":"..."} — use ONLY those four key names in ' +
  '"values", include only meters you can actually read, and put the label ' +
  'exactly as printed in "readings". confidence is 0..1. notes flags ' +
  "glare/ambiguity or a digit you are unsure of.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: CORS });
  }

  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) {
    return json({ error: "ANTHROPIC_API_KEY not configured" }, 500);
  }

  // `mode` is accepted and ignored — the client sends it for compatibility
  // with the older two-pass deployment.
  let body: { image?: string; media_type?: string; mode?: string; model?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }
  if (!body.image) return json({ error: "missing image" }, 400);

  // A caller may pick the model, but only from this list — otherwise any signed-in
  // user could point the vendor key at the priciest model available.
  const ALLOWED = [
    "claude-haiku-4-5",
    "claude-sonnet-4-5",
    "claude-sonnet-5",
    "claude-opus-5",
  ];
  const model = body.model ?? Deno.env.get("OCR_MODEL") ?? "claude-sonnet-4-5";
  if (body.model && !ALLOWED.includes(body.model)) {
    return json({ error: `model must be one of: ${ALLOWED.join(", ")}` }, 400);
  }

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 600,
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
            { type: "text", text: READ_PROMPT },
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
    return json({ ...parsed, model, usage: data?.usage });
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
