// Receipt parser — the server-side replacement for v1's scanReceiptWithAI().
//
// v1 called api.anthropic.com straight from the browser with the user's own
// key in localStorage and `anthropic-dangerous-direct-browser-access: true`.
// That exposes the key to anyone with devtools and bills it to whoever pasted
// it. Here the key is a Supabase secret and the call happens server-side, which
// is the same move already made for meter-ocr.
//
// Deploy:
//   supabase functions deploy receipt-scan
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
// Verify JWT: ON (the caller must be a signed-in user).

import Anthropic from "npm:@anthropic-ai/sdk@0.68.0";

const SYSTEM = `You are a receipt parser for an aircraft maintenance app. \
Extract data and respond ONLY with valid JSON, no markdown, no explanation. \
Fields: amount (number, no $ sign, the total paid), date (YYYY-MM-DD or null), \
vendor (business name string or null), category (one of: \
inspection,engine,avionics,airframe,fuel,oil,parts,other), description (brief \
string, e.g. "100LL 47.7 gal @ $4.50/gal"). Category: fuel=fuel/avgas purchase, \
oil=oil/lubricants, inspection=annual/100hr, engine=engine work, \
avionics=avionics/instruments, airframe=structural/paint, parts=parts. \
Default other.

Also return two fields used to decide whether a closer second look is needed:
doc_type — "receipt" for a printed till or fuel-pump slip where the total is \
large and on its own line; "invoice" for a multi-line billing document with \
columns, line items, fees, or subtotals.
amount_confidence — 0..1, how certain you are of the DIGITS of amount \
specifically (not of finding the right field). Lower it below 0.9 whenever the \
total is small print, sits in a column of similar numbers, is near a fold or \
crease, or has a cents value you would not bet on. Being unsure is useful \
information here, so do not inflate it.`;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { base64, mimeType, model: reqModel } = await req.json();
    if (!base64) {
      return new Response(JSON.stringify({ error: "no image supplied" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const key = Deno.env.get("ANTHROPIC_API_KEY");
    if (!key) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY is not set on the function" }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    // Honour the mime the client actually sent. Hardcoding image/jpeg here made
    // Anthropic reject any PNG/WebP receipt with a media-type mismatch.
    const mime = String(mimeType ?? "image/jpeg").toLowerCase();
    const isPdf = mime.includes("pdf");
    const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

    if (!isPdf && !IMAGE_TYPES.includes(mime)) {
      return new Response(
        JSON.stringify({
          error: `Unsupported image type ${mime} — use a JPEG, PNG, WebP, GIF or PDF.`,
        }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    const block = isPdf
      ? {
          type: "document" as const,
          source: { type: "base64" as const, media_type: "application/pdf" as const, data: base64 },
        }
      : {
          type: "image" as const,
          source: {
            type: "base64" as const,
            media_type: mime as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
            data: base64,
          },
        };

    // A caller may pick the model, but only from this list — otherwise any
    // signed-in user could point the vendor key at the priciest model available.
    const ALLOWED = [
      "claude-haiku-4-5",
      "claude-sonnet-4-5",
      "claude-sonnet-5",
      "claude-opus-5",
    ];
    const model = reqModel ?? "claude-haiku-4-5";
    if (reqModel && !ALLOWED.includes(reqModel)) {
      return new Response(
        JSON.stringify({ error: `model must be one of: ${ALLOWED.join(", ")}` }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    const anthropic = new Anthropic({ apiKey: key });
    const msg = await anthropic.messages.create({
      model,
      max_tokens: 300,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [block, { type: "text", text: "Parse this receipt. Return JSON only." }],
        },
      ],
    });

    const text = msg.content
      .filter((c): c is { type: "text"; text: string } => c.type === "text")
      .map((c) => c.text)
      .join("")
      .replace(/```json|```/g, "")
      .trim();

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text);
    } catch {
      return new Response(
        JSON.stringify({ error: "Could not read that receipt — try a clearer photo." }),
        { status: 422, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ ...parsed, model, usage: msg.usage }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
