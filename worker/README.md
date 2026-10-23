# RochesterCRE AI analyst (Cloudflare Worker)

This worker sits between the public site and the Gemini API so the API key is never exposed in the browser.
It accepts requests only from the site's origin, caps question length and history, rate-limits per IP,
and builds its prompt from the site's own `data/analyst-context.json`.

## Setup (free, about 5 minutes)

1. **Get a Gemini key.** Go to https://aistudio.google.com/apikey, sign in with Google, click **Create API key**.
   The free tier needs no credit card. Note that Google may use free-tier prompts to improve its products.
2. **Create the worker.** At https://dash.cloudflare.com sign up (free plan), then **Workers & Pages → Create →
   Create Worker**. Name it `rochestercre-analyst` and click **Deploy**.
3. **Paste the code.** Click **Edit code**, replace everything with `src/index.js` from this folder, click **Deploy**.
4. **Add the key as a secret.** In the worker go to **Settings → Variables and Secrets → Add**, type **Secret**,
   name `GEMINI_API_KEY`, paste the key, **Deploy**.
5. **Copy the worker URL** (like `https://rochestercre-analyst.<you>.workers.dev`) and set it as the repo variable
   `ANALYST_URL` (GitHub repo → Settings → Secrets and variables → Actions → Variables), then re-run the deploy workflow.

Optional variables (Settings → Variables): `MODEL` (default `gemini-3.8-flash`), `DATA_URL`, `ALLOWED_ORIGINS`.

With the Wrangler CLI instead: `npx wrangler deploy` then `npx wrangler secret put GEMINI_API_KEY`.
