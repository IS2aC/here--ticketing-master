import "server-only";
import { z } from "zod";
import catalog from "@/creative-engine/library/bundled/catalog.json";
import { FONT_CATALOG } from "@/creative-engine/editor/fontCatalog";
import {
  COMPOSITIONS,
  groundedTexts,
  proposalsSchema,
  TEXT_LIMITS,
  type CardFacts,
  type Charter,
} from "@/creative-engine/host/proposals/charter";
import { defaultTexts, fallbackCharters } from "@/creative-engine/host/proposals/fallback";
import { EVENT_TIME_ZONE, eventType } from "@/lib/event-types";
import { formatDate, type EventOut } from "@/lib/events";

// Cartes proposées par l'IA (étape C1) : un modèle de langage reçoit les faits de l'événement et rend trois
// chartes en JSON (sortie structurée), validées par le schéma de l'éditeur. Sans fournisseur, ou s'il échoue,
// les chartes écrites à la main prennent le relais : la fonction marche toujours.
//
//   CARD_AI_PROVIDER         none (défaut) | openrouter | openai-compatible
//   CARD_AI_API_KEY          clé du fournisseur (obligatoire pour openrouter)
//   CARD_AI_MODEL            openrouter : anthropic/claude-haiku-5.5 par défaut ; openai-compatible : obligatoire
//   CARD_AI_BASE_URL         openrouter : https://openrouter.ai/api/v1 par défaut ; openai-compatible : …/v1
//   CARD_AI_TIMEOUT_SECONDS  délai maximal (défaut : 45)

const DEFAULTS = { baseUrl: "https://openrouter.ai/api/v1", model: "anthropic/claude-haiku-5.5" };

interface Config {
  readonly baseUrl: string;
  readonly apiKey: string | null;
  readonly model: string;
  readonly timeoutMs: number;
}

const env = (name: string) => process.env[name]?.trim() || null;

/** Fournisseur configuré, ou null : propositions sans IA. */
export function proposalsConfig(): Config | null {
  const provider = env("CARD_AI_PROVIDER") ?? "none";
  const timeoutMs = Math.min(120, Math.max(5, Number(env("CARD_AI_TIMEOUT_SECONDS") ?? 45) || 45)) * 1000;
  if (provider === "openrouter") {
    const apiKey = env("CARD_AI_API_KEY");
    if (!apiKey) return null;
    return { baseUrl: env("CARD_AI_BASE_URL") ?? DEFAULTS.baseUrl, apiKey, model: env("CARD_AI_MODEL") ?? DEFAULTS.model, timeoutMs };
  }
  if (provider === "openai-compatible") {
    const baseUrl = env("CARD_AI_BASE_URL");
    const model = env("CARD_AI_MODEL");
    if (!baseUrl || !model) return null;
    return { baseUrl: baseUrl.replace(/\/$/, ""), apiKey: env("CARD_AI_API_KEY"), model, timeoutMs };
  }
  return null;
}

const dayMonth = new Intl.DateTimeFormat("fr-FR", { timeZone: EVENT_TIME_ZONE, day: "numeric", month: "long" });
const hourMinute = new Intl.DateTimeFormat("fr-FR", { timeZone: EVENT_TIME_ZONE, hour: "numeric", minute: "2-digit" });

/** « 15 h », « 15 h 30 ». */
function hour(iso: string): string {
  const [h, m] = hourMinute.format(new Date(iso)).split(":");
  return m === "00" ? `${h} h` : `${h} h ${m}`;
}

/** Faits de l'événement, mis en forme pour la carte. */
export function cardFacts(event: EventOut): CardFacts {
  const deadline = event.rsvp_deadline ? dayMonth.format(new Date(event.rsvp_deadline)).replace(/^1 /, "1er ") : null;
  return {
    type: event.type,
    title: event.title.trim(),
    dateLine: `${formatDate(event.starts_at)} à ${hour(event.starts_at)}`,
    placeLines: [event.location_name, event.location_address].map((l) => l?.trim() ?? "").filter(Boolean).slice(0, 2),
    dressCode: event.dress_code?.trim() || null,
    theme: event.theme?.trim() || null,
    colors: event.colors ?? [],
    rsvpLine: deadline ? `Merci de confirmer votre présence avant le ${deadline}` : null,
    description: event.description?.trim() || null,
  };
}

const FONT_NOTES: Record<string, string> = {
  "Great Vibes": "calligraphie fluide, romantique",
  "Pinyon Script": "calligraphie anglaise, très élégante",
  "Playfair Display": "serif à fort contraste, chic",
  "Cormorant Garamond": "serif fin et raffiné",
  Cinzel: "capitales romaines, solennel",
  Poppins: "linéale ronde, moderne et lisible",
  Montserrat: "linéale géométrique, sobre",
  "Bebas Neue": "capitales condensées, affiche",
};

function systemPrompt(): string {
  const compositions = COMPOSITIONS.map((id) => {
    const entry = catalog.find((c) => c.id === id);
    return `- ${id} : ${entry?.description ?? ""}`;
  }).join("\n");
  const fonts = FONT_CATALOG.map((f) => `- ${f.family} : ${FONT_NOTES[f.family] ?? ""}`).join("\n");
  return `Tu es directeur artistique pour Here!, qui envoie des cartes d'invitation sur WhatsApp en Côte d'Ivoire.
Tu proposes TROIS chartes de carte pour un événement, dans trois directions bien différentes : « classique », « moderne », « audacieuse ».
Tu ne dessines rien : le moteur compose la carte à partir de ta charte, dans une des compositions ci-dessous. Chacune a déjà la place du nom de l'invité, de sa table et du QR code.

Compositions :
${compositions}

Polices du titre et du texte :
${fonts}
Police du nom de l'invité : Playfair Display, Poppins ou Great Vibes seulement.

Règles :
- Textes en français, sans faute, sans emoji. Pas de guillemets décoratifs.
- N'invente AUCUN fait : ni nom, ni date, ni heure, ni lieu, ni chiffre. La date, le lieu, la tenue et le nom de l'invité sont ajoutés par le moteur.
- title : le titre principal, tiré du titre de l'événement (les noms exactement comme écrits), ${TEXT_LIMITS.title} caractères au plus, un retour à la ligne (\\n) au plus. Exemple : « Aïcha\\n& Koffi » pour « Mariage d'Aïcha & Koffi ».
- kicker : surtitre court (${TEXT_LIMITS.kicker} caractères au plus), par exemple « Nous nous marions ».
- guestLabel : ce qui précède le nom de l'invité (${TEXT_LIMITS.guestLabel} caractères au plus), par exemple « Invitation personnelle pour ».
- closing : une phrase de fin (${TEXT_LIMITS.closing} caractères au plus), sans date.
- tagline : une ligne facultative (chaîne vide sinon), tirée de la description sans rien ajouter.
- Si l'événement a un thème ou un code couleur, la charte « classique » les suit fidèlement (palette tirée du code couleur) ; les deux autres peuvent s'en écarter un peu.
- palette : couleurs #RRGGBB. title et text doivent être très lisibles sur background ; surface est un fond secondaire proche de background ; accent sert aux surtitres, filets et pastilles.
- ornamentTint : une couleur pour recolorer les ornements (feuillages, nuages, motifs), ou null pour garder leurs couleurs d'origine (conseillé pour les ornements multicolores : confettis, ballons, wax).
- Adapte le ton au type d'événement : sobre et respectueux pour des funérailles, chaleureux pour une famille, festif pour une soirée.
- name : un nom court et évocateur pour chaque charte (« Ivoire et or »).`;
}

function userPrompt(facts: CardFacts, photoColors: readonly string[]): string {
  return JSON.stringify({
    type: eventType(facts.type as EventOut["type"]).label,
    titre: facts.title,
    date: facts.dateLine,
    lieu: facts.placeLines.join(", ") || null,
    tenue: facts.dressCode,
    theme: facts.theme,
    code_couleur: facts.colors.length > 0 ? facts.colors : null,
    description: facts.description,
    couleurs_de_la_photo: photoColors.length > 0 ? photoColors : null,
  });
}

export interface ProposalsResult {
  readonly source: "ia" | "regles";
  readonly facts: CardFacts;
  readonly proposals: readonly Charter[];
}

async function askProvider(config: Config, facts: CardFacts, photoColors: readonly string[]): Promise<Charter[] | null> {
  const schema = z.toJSONSchema(proposalsSchema);
  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
        "X-Title": "Here! Creative Engine",
      },
      signal: AbortSignal.timeout(config.timeoutMs),
      body: JSON.stringify({
        model: config.model,
        temperature: 0.9,
        messages: [
          { role: "system", content: systemPrompt() },
          { role: "user", content: userPrompt(facts, photoColors) },
        ],
        response_format: { type: "json_schema", json_schema: { name: "chartes", strict: true, schema } },
      }),
    });
  } catch (error) {
    console.warn("Propositions de cartes : fournisseur injoignable", error);
    return null;
  }
  if (!response.ok) {
    console.warn(`Propositions de cartes : le fournisseur répond ${response.status}`);
    return null;
  }
  try {
    const body = (await response.json()) as { choices?: { message?: { content?: unknown } }[] };
    const content = body.choices?.[0]?.message?.content;
    const parsed = proposalsSchema.safeParse(typeof content === "string" ? JSON.parse(content) : content);
    if (!parsed.success) {
      console.warn("Propositions de cartes : réponse hors schéma", parsed.error.issues.slice(0, 3));
      return null;
    }
    return parsed.data.proposals;
  } catch {
    console.warn("Propositions de cartes : réponse illisible");
    return null;
  }
}

/** Trois chartes pour l'événement : celles de l'IA (textes vérifiés), complétées ou remplacées par les règles. */
export async function proposeCharters(event: EventOut, photoColors: readonly string[] = []): Promise<ProposalsResult> {
  const facts = cardFacts(event);
  const fallback = fallbackCharters(facts);
  const config = proposalsConfig();
  const charters = config ? await askProvider(config, facts, photoColors) : null;
  if (!charters) return { source: "regles", facts, proposals: fallback };
  const defaults = defaultTexts(facts);
  const checked = charters.map((charter) => ({ ...charter, texts: groundedTexts(charter.texts, defaults, facts) }));
  return { source: "ia", facts, proposals: [...checked, ...fallback].slice(0, 3) };
}
