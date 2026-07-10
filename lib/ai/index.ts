import Anthropic from '@anthropic-ai/sdk';
import { SupabaseClient } from '@supabase/supabase-js';
import { countTodayAiCalls, fetchUserProfile, logAiCall } from '../db';

let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not defined in the environment.');
    }
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

export interface AiCallConfig {
  userId: string;
  callType: 'hint' | 'explanation' | 'variant' | 'classify' | 'report' | 'coach_update';
  systemPrompt: string;
  userMessage: string;
  fallbackRationale?: string; // Optional static fallback text
  temperature?: number;
  maxTokens?: number;
}

export interface AiCallResult {
  content: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  overCeiling: boolean;
}

/**
 * Resolves the daily ceiling for a user in priority order:
 * 1. user's profiles.ai_daily_ceiling
 * 2. AI_DAILY_CEILING environment variable
 * 3. Default (150)
 */
export async function resolveDailyCeiling(supabase: SupabaseClient, userId: string): Promise<number> {
  try {
    const profile = await fetchUserProfile(supabase, userId);
    if (profile && profile.ai_daily_ceiling !== null && profile.ai_daily_ceiling !== undefined) {
      return profile.ai_daily_ceiling;
    }
  } catch (error) {
    console.warn('Could not fetch user profile for daily ceiling check, falling back:', error);
  }

  const envCeiling = process.env.AI_DAILY_CEILING;
  if (envCeiling) {
    const parsed = parseInt(envCeiling, 10);
    if (!isNaN(parsed)) return parsed;
  }

  return 150; // Default ceiling
}

/**
 * Routes and executes Anthropic API calls while enforcing cost/daily ceiling and logging usage.
 * If over ceiling, gracefully returns the fallback rationale instead of blocking.
 */
export async function callAnthropicWithCeiling(
  supabase: SupabaseClient,
  config: AiCallConfig
): Promise<AiCallResult> {
  const { userId, callType, systemPrompt, userMessage, fallbackRationale, temperature = 0.2, maxTokens = 1000 } = config;

  // 1. Resolve daily ceiling and check current count
  const ceiling = await resolveDailyCeiling(supabase, userId);
  const todayCalls = await countTodayAiCalls(supabase, userId);

  if (todayCalls >= ceiling) {
    console.warn(`User ${userId} is over the daily AI ceiling of ${ceiling} (completed today: ${todayCalls}). Falling back.`);
    return {
      content: fallbackRationale || 'You have reached your daily AI limit. Please refer to your question rationale for guidance.',
      model: 'fallback-static',
      inputTokens: 0,
      outputTokens: 0,
      overCeiling: true,
    };
  }

  // 2. Select model based on call type
  // Haiku for classification, Sonnet for everything else (tutoring, generation, reports, coaching)
  const isClassification = callType === 'classify';
  const model = isClassification
    ? 'claude-3-5-haiku-20241022'
    : 'claude-3-5-sonnet-20241022'; // Defaulting to Sonnet

  // 3. Make Anthropic API Call
  const anthropic = getAnthropicClient();
  
  try {
    const response = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const contentText = response.content[0].type === 'text' ? response.content[0].text : '';
    const inputTokens = response.usage?.input_tokens ?? null;
    const outputTokens = response.usage?.output_tokens ?? null;

    // 4. Log call usage in ai_log
    await logAiCall(supabase, userId, callType, model, inputTokens, outputTokens);

    return {
      content: contentText,
      model,
      inputTokens,
      outputTokens,
      overCeiling: false,
    };
  } catch (err: any) {
    console.error('Anthropic API Call Failed:', err);
    // On hard error, fallback to static rationale to ensure "degrade, never block"
    if (fallbackRationale) {
      return {
        content: fallbackRationale,
        model: 'fallback-error',
        inputTokens: 0,
        outputTokens: 0,
        overCeiling: false,
      };
    }
    throw err;
  }
}
