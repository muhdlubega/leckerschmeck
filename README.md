# LeckerSchmeck

Turn any recipe into a recipe you can actually follow.

LeckerSchmeck is a production-oriented Next.js-compatible React application for converting public recipe pages or pasted recipe text into a visual cooking workflow. It preserves the source, keeps original quantities immutable for reliable scaling, and lets a cook switch between Flow, Steps and Ingredients views.

## What is included

- Layered extraction: schema.org Recipe JSON-LD first, cleaned HTML second, AI only when needed.
- Mistral primary extraction with Gemini fallback on timeout, provider error, invalid JSON, or failed strict Zod validation.
- URL and redirect validation, public DNS checks, private/link-local/metadata blocking, protocol restrictions, timeouts, redirect and response-size limits.
- Strict, bounded Zod schemas for recipes, ingredients, instructions, flow nodes, imports and translations.
- Desktop dependency flow and a dedicated vertical mobile flow.
- Deterministic serving scaling, fractions, compatible unit conversion and temperature conversion. Volume-to-weight conversion is intentionally not guessed.
- Editable recipe title, servings, times, ingredients, preparation details, steps, temperatures and durations.
- Cook Mode with step navigation, relevant ingredients, dual temperatures and local timers.
- Device-local ingredient checks, recent recipes, theme and measurement preferences.
- Recipe translation with immutable original data and device-local translation caching.
- Print / Save as PDF, Markdown, plain text, JSON, CSV and 1200×630 recipe-card PNG exports.
- Durable 30-day D1 share IDs, Web Share, copy, email, WhatsApp, Telegram and QR codes.
- Recipe-specific social metadata for shared routes, accessible semantics, visible focus, reduced motion, responsive layout and print styling.
- Small WebMCP surface for importing a URL and rescaling servings.

## Local setup

Requirements: Node.js 22.13+ and pnpm.

1. Copy `.env.example` to `.env.local` and add at least one provider key. Mistral is attempted first; Gemini is the fallback.
2. Install dependencies with `pnpm install`.
3. Generate and apply the D1 migration in `drizzle/0000_shared_recipes.sql` for the local/hosted database.
4. Run `pnpm dev` and open the printed local URL.

The current provider calls use the official REST endpoints documented by [Mistral Chat Completions](https://docs.mistral.ai/api/endpoint/chat) and [Gemini GenerateContent](https://ai.google.dev/api/generate-content). Model names remain environment-configurable because provider catalogs change.

## Environment variables

```dotenv
MISTRAL_API_KEY=
MISTRAL_MODEL=mistral-small-latest
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.5-flash-lite
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Secrets are used only by server routes. Never expose provider keys through `NEXT_PUBLIC_*` variables.

## Commands

- `pnpm dev` — local development
- `pnpm build` — production Worker build
- `pnpm start` — run the built Worker locally
- `pnpm test` — deterministic unit and security tests
- `pnpm lint` — lint source
- `pnpm db:generate` — generate Drizzle migrations after schema changes

## Extraction behavior

The importer follows redirects manually and revalidates every destination. It accepts HTML only, streams at most 2.5 MB, and times out promptly. Authentication, paywalls, CAPTCHAs and anti-bot restrictions are never bypassed. Raw upstream or AI errors are logged server-side and replaced with stable user-facing error codes.

JSON-LD recipes that satisfy the local completeness test do not leave the server for AI processing. Incomplete pages are cleaned with Cheerio before sending a bounded, relevant excerpt to the configured model. Both provider results are accepted only after strict schema validation.

## Data and privacy

- Imported recipes and preferences are local to the browser unless the user explicitly creates a share link.
- A share stores only the validated recipe document in D1 and expires after 30 days.
- Translation caches are device-local and keyed by original recipe ID plus target language.
- No analytics or advertising SDK is included.

## Deployment

The generated Sites/Vinext build targets a Cloudflare-compatible Worker and keeps the application portable at the route and service layer. The D1 binding is named `DB` in `.openai/hosting.json`. Configure the same environment variables and apply the checked-in migration before production traffic. For Vercel, replace the D1 adapter with a small SQL repository implementing the same share operations; scraping, AI, schema, and UI layers are provider-neutral.
