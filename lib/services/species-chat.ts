
import "server-only";

const SYSTEM_PROMPT = `You are SpeciesBot, an assistant that ONLY answers about animals and species:
- Allowed: habitat, diet, behavior, conservation status (IUCN), taxonomy, range/distribution, predators/prey, speed/size, notable adaptations.
- If asked something unrelated, say you only handle species/animal topics and invite a relevant question.
- Be concise and accurate; include scientific/common names when relevant.`;

const DEFAULT_MODEL =
  process.env.SPECIES_CHAT_MODEL ?? "gpt-4o-mini";

function buildHeaders(apiKey: string): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  if (process.env.OPENAI_ORG_ID) h["OpenAI-Organization"] = process.env.OPENAI_ORG_ID!;
  if (process.env.OPENAI_PROJECT_ID) h["OpenAI-Project"] = process.env.OPENAI_PROJECT_ID!;
  return h;
}

/** quick guard to avoid burning tokens on off-topic chats */
function isSpeciesTopic(text: string): boolean {
  return /(species|animal|habitat|diet|conservation|endangered|iucn|taxonomy|genus|family|range|distribution|ecosystem|predator|prey|speed|nocturnal|diurnal|extinct|status)/i.test(
    text
  );
}


interface OpenAIErrorBody {
  error?: { message?: string; type?: string | null };
}
function isOpenAIErrorBody(x: unknown): x is OpenAIErrorBody {
  return typeof x === "object" && x !== null && "error" in (x as Record<string, unknown>);
}

interface OpenAIChatMessage {
  role?: "system" | "user" | "assistant";
  content?: string | null;
}
interface OpenAIChatChoice {
  message?: OpenAIChatMessage;
}
interface OpenAIChatCompletion {
  choices?: OpenAIChatChoice[];
}
function isOpenAIChatCompletion(x: unknown): x is OpenAIChatCompletion {
  if (typeof x !== "object" || x === null) return false;
  const obj = x as { choices?: unknown };
  return obj.choices === undefined || Array.isArray(obj.choices);
}


export async function generateResponse(message: string): Promise<string> {
  const msg = message.trim();
  if (!msg) {
    return "Ask about a species—e.g., *“What’s the habitat and diet of the snow leopard?”*";
  }

  if (!isSpeciesTopic(msg)) {
    return "I’m a species-focused chatbot. Ask me about animals, habitats, diets, conservation status, taxonomy, or related topics.";
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return "This chatbot isn’t configured with an API key yet. Add OPENAI_API_KEY to `.env.local` and restart.";
  }

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: buildHeaders(apiKey),
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        temperature: 0.2,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: msg },
        ],
      }),
    });

    if (!resp.ok) {
      let detail = "";
      try {
        const j: unknown = await resp.json();
        detail =
          isOpenAIErrorBody(j) && typeof j.error?.message === "string"
            ? j.error.message
            : JSON.stringify(j);
      } catch {
        detail = await resp.text().catch(() => "");
      }
      if (process.env.NODE_ENV !== "production") {
        return `Provider error (${resp.status}): ${detail}`;
      }
      return "Sorry—my provider returned an error. Please try again.";
    }

    const raw: unknown = await resp.json();
    if (!isOpenAIChatCompletion(raw)) {
      return "Sorry—I couldn’t parse the provider response.";
    }

    const content =
      typeof raw.choices?.[0]?.message?.content === "string"
        ? raw.choices[0].message.content.trim()
        : undefined;

    return content ?? "Sorry—I couldn’t generate a response.";
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("generateResponse error:", err);
      return "Network or provider error (see server logs).";
    }
    return "Sorry—I ran into a temporary issue generating a response.";
  }
}
