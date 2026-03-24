import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const COOKIE_NAME = "user-api-key";
const COOKIE_PROVIDER = "user-api-provider";
const COOKIE_MODEL = "user-api-model";
const COOKIE_MAX_OUTPUT_TOKENS = "user-api-max-output-tokens";

const DEFAULT_MODELS = {
  openai: "gpt-5.2-codex",
  anthropic: "claude-sonnet-4-20250514",
} as const;

type Provider = keyof typeof DEFAULT_MODELS;

const parseMaxOutputTokens = (value?: string): number | null => {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) return null;
  return parsed;
};

/** Check if a global API key is configured in the environment */
function hasGlobalKey(): boolean {
  return !!(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY);
}

/** GET – returns whether the user needs to provide a key */
export async function GET() {
  const jar = await cookies();
  const userKey = jar.get(COOKIE_NAME)?.value;
  const providerCookie = jar.get(COOKIE_PROVIDER)?.value;
  const userProvider: Provider =
    providerCookie === "anthropic" ? "anthropic" : "openai";
  const userModel =
    jar.get(COOKIE_MODEL)?.value?.trim() || DEFAULT_MODELS[userProvider];
  const userMaxOutputTokens = parseMaxOutputTokens(
    jar.get(COOKIE_MAX_OUTPUT_TOKENS)?.value,
  );

  return NextResponse.json({
    hasGlobalKey: hasGlobalKey(),
    hasUserKey: !!userKey,
    provider: userProvider,
    model: userModel,
    maxOutputTokens: userMaxOutputTokens,
  });
}

/** POST – save or delete the user's API key */
export async function POST(req: Request) {
  const body = (await req.json()) as {
    apiKey?: string;
    provider?: Provider;
    model?: string;
    maxOutputTokens?: number;
    action?: "save" | "delete";
  };

  const jar = await cookies();

  if (body.action === "delete") {
    jar.delete(COOKIE_NAME);
    jar.delete(COOKIE_PROVIDER);
    jar.delete(COOKIE_MODEL);
    jar.delete(COOKIE_MAX_OUTPUT_TOKENS);
    return NextResponse.json({ ok: true });
  }

  const apiKey = body.apiKey?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "API key is required" }, { status: 400 });
  }

  const provider: Provider =
    body.provider === "anthropic" ? "anthropic" : "openai";
  const model = body.model?.trim() || DEFAULT_MODELS[provider];

  // Basic validation
  if (provider === "openai" && !apiKey.startsWith("sk-")) {
    return NextResponse.json(
      { error: "OpenAI keys start with sk-" },
      { status: 400 },
    );
  }

  if (!model) {
    return NextResponse.json({ error: "Model is required" }, { status: 400 });
  }

  if (model.length > 120) {
    return NextResponse.json(
      { error: "Model is too long" },
      { status: 400 },
    );
  }

  const maxOutputTokens = body.maxOutputTokens;
  if (
    maxOutputTokens != null &&
    (!Number.isInteger(maxOutputTokens) || maxOutputTokens < 1)
  ) {
    return NextResponse.json(
      { error: "maxOutputTokens must be an integer >= 1" },
      { status: 400 },
    );
  }

  jar.set(COOKIE_NAME, apiKey, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    path: "/",
  });

  jar.set(COOKIE_PROVIDER, provider, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });

  jar.set(COOKIE_MODEL, model, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });

  if (maxOutputTokens != null) {
    jar.set(COOKIE_MAX_OUTPUT_TOKENS, String(maxOutputTokens), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
  } else {
    jar.delete(COOKIE_MAX_OUTPUT_TOKENS);
  }

  return NextResponse.json({ ok: true });
}
