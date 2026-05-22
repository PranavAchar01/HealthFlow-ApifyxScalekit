import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { BaseChatModel } from "@langchain/core/messages";

interface ChatModelParams {
  temperature?: number;
  maxTokens?: number;
  modelName?: string;
}

export function createChatModel(params?: ChatModelParams): BaseChatModel {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

  if (geminiApiKey) {
    return new ChatGoogleGenerativeAI({
      apiKey: geminiApiKey,
      modelName: params?.modelName?.includes("gemini") ? params.modelName : "gemini-pro",
      temperature: params?.temperature,
      maxOutputTokens: params?.maxTokens,
    });
  }

  if (anthropicApiKey) {
    return new ChatAnthropic({
      apiKey: anthropicApiKey,
      modelName: params?.modelName?.includes("claude") ? params.modelName : "claude-sonnet-4-20250514",
      temperature: params?.temperature,
      maxTokens: params?.maxTokens,
    });
  }

  throw new Error("No API key provided for any chat model. Please set GEMINI_API_KEY or ANTHROPIC_API_KEY.");
}
