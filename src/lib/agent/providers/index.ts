import "server-only"
import { anthropicProvider } from "./anthropic"
import { geminiProvider } from "./gemini"
import type { AgentProvider, ModelProvider } from "./types"

const PROVIDERS: Record<AgentProvider, ModelProvider> = {
  gemini: geminiProvider,
  anthropic: anthropicProvider,
}

export const providerFor = (id: AgentProvider) => PROVIDERS[id]
