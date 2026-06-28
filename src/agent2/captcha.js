import { config } from "../config.js";

export async function solveCaptchaImage(buffer, mimetype = "image/png") {
  if (!hasVision() || !buffer?.length) {
    throw new Error("Vision API not configured or captcha image is empty");
  }

  const baseUrl = (process.env.IMAGE_BASE_URL || process.env.LLM_BASE_URL || "").trim().replace(/\/+$/, "");
  if (!baseUrl) {
    throw new Error("VISION_BASE_URL or LLM_BASE_URL must be set in the environment");
  }

  const endpoint = baseUrl.includes("/chat/completions") ? baseUrl : `${baseUrl}/chat/completions`;
  const apiKey = (process.env.IMAGE_API_KEY || process.env.LLM_API_KEY || config.vision.apiKey || "").trim();
  if (!apiKey) {
    throw new Error("VISION_API_KEY or LLM_API_KEY must be set in the environment");
  }

  const model = (process.env.CAPTCHA_SOLVER_MODEL || process.env.LLM_MODEL || "").trim();
  if (!model) {
    throw new Error("VISION_MODEL or LLM_MODEL must be set in the environment");
  }

  const temperature = Number(process.env.VISION_TEMPERATURE ?? process.env.LLM_TEMPERATURE ?? "0");
  const maxTokens = Number(process.env.VISION_MAX_TOKENS ?? process.env.LLM_MAX_TOKENS ?? "20");
  const systemPrompt = process.env.VISION_PROMPT_SYSTEM || "You are an OCR assistant. Extract only the characters in the captcha image. Reply with the captcha text only, no explanation, no punctuation, no extra words.";
  const userPrompt = process.env.VISION_PROMPT_USER || "Read the captcha text in this image. Reply with ONLY the captcha text, nothing else. No spaces, no punctuation.";

  const body = {
    model: provider.model,
    temperature,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: prompts.system },
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: `data:${mimetype};base64,${buffer.toString("base64")}` } },
          { type: "text", text: prompts.user },
        ],
      },
    ],
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      ...provider.headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`${provider.name} vision ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  }

  const data = await res.json();
  const raw = (data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || "").trim();
  return parseCaptchaText(raw);
}

export async function solveCaptchaImage(buffer, mimetype = "image/png") {
  if (!buffer?.length) {
    throw new Error("Captcha image is empty");
  }

  const providers = buildCaptchaProviders();
  if (!providers.length) {
    throw new Error(
      "Captcha OCR is not configured. Set VISION_API_KEY for Gemini, or set OPENROUTER_API_KEY plus CAPTCHA_OPENROUTER_MODEL for OpenRouter.",
    );
  }

  const errors = [];
  for (const provider of providers) {
    try {
      return await solveWithProvider(provider, buffer, mimetype);
    } catch (err) {
      errors.push(`${provider.name}: ${err.message}`);
    }
  }

  throw new Error(`Captcha OCR failed with all configured providers: ${errors.join(" | ")}`);
}
