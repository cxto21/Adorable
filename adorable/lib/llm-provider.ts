import { createAnthropic } from "@ai-sdk/anthropic";
import {
  createOpenAI,
  type OpenAIResponsesProviderOptions,
} from "@ai-sdk/openai";
import {
  stepCountIs,
  streamText,
  type UIMessage,
  type ToolSet,
  convertToModelMessages,
} from "ai";

type LlmProviderName = "openai" | "anthropic";

const DEFAULT_MODELS: Record<LlmProviderName, string> = {
  openai: "gpt-5.2-codex",
  anthropic: "claude-sonnet-4-20250514",
};

const getProviderName = (override?: string): LlmProviderName => {
  const value = (override ?? process.env["LLM_PROVIDER"])?.toLowerCase().trim();
  if (value === "anthropic" || value === "claude") return "anthropic";
  return "openai";
};

const getModelName = (provider: LlmProviderName, override?: string): string => {
  const model = override?.trim();
  if (model) return model;
  return DEFAULT_MODELS[provider];
};

type StreamLlmResponseParams = {
  system: string;
  messages: UIMessage[];
  tools: ToolSet;
  apiKey?: string;
  providerOverride?: string;
  modelOverride?: string;
  maxOutputTokensOverride?: number;
};

type StreamLlmResponseResult = {
  result: ReturnType<typeof streamText>;
  provider: LlmProviderName;
};

export const streamLlmResponse = async ({
  system,
  messages,
  tools,
  apiKey,
  providerOverride,
  modelOverride,
  maxOutputTokensOverride,
}: StreamLlmResponseParams): Promise<StreamLlmResponseResult> => {
  const provider = getProviderName(providerOverride);
  const modelName = getModelName(provider, modelOverride);
  const modelMessages = await convertToModelMessages(messages);

  if (provider === "openai") {
    const openaiProvider = apiKey ? createOpenAI({ apiKey }) : createOpenAI({});
    const result = streamText({
      system,
      model: openaiProvider.responses(modelName),
      messages: modelMessages,
      tools,
      maxOutputTokens: maxOutputTokensOverride,
      providerOptions: {
        openai: {
          reasoningEffort: "low",
        } satisfies OpenAIResponsesProviderOptions,
      },
      stopWhen: stepCountIs(100),
    });

    return {
      result,
      provider,
    };
  }

  const anthropicProvider = apiKey
    ? createAnthropic({ apiKey })
    : createAnthropic({});
  const result = streamText({
    system,
    model: anthropicProvider(modelName),
    messages: modelMessages,
    tools,
    maxOutputTokens: maxOutputTokensOverride,
    stopWhen: stepCountIs(100),
  });

  return {
    result,
    provider,
  };
};
