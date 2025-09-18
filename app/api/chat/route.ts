import { NextResponse } from "next/server";
import { generateResponse } from "@/lib/services/species-chat";

export const dynamic = "force-dynamic";

const SPECIES_REGEX =
  /(species|animal|habitat|diet|conservation|endangered|iucn|taxonomy|genus|family|kingdom|range|distribution|ecosystem|predator|prey|mammal|bird|reptile|amphibian|fish|insect|arachnid|speed|nocturnal|diurnal)/i;

export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const message = (body as { message?: unknown })?.message;
    if (typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ error: "Missing or invalid 'message'." }, { status: 400 });
    }

    if (!SPECIES_REGEX.test(message)) {
      return NextResponse.json({
        response:
          "I’m a species-focused chatbot. Ask me about animals, habitats, diets, conservation status, taxonomy, or related topics.",
      });
    }

    const response = await generateResponse(message);
    return NextResponse.json({ response });
  } catch (err) {
    console.error("Chat route error:", err);
    return NextResponse.json(
      { error: "Upstream provider error. Please try again." },
      { status: 502 }
    );
  }
}

