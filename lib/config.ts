/** URL of the Cloudflare Worker that proxies the AI analyst to Gemini. Override with NEXT_PUBLIC_ANALYST_URL. */
export const ANALYST_URL = process.env.NEXT_PUBLIC_ANALYST_URL || "https://rochestercre-analyst.gagevanq.workers.dev";
