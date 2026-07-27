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
  callType: 'hint' | 'explanation' | 'variant' | 'classify' | 'report' | 'coach_update' | 'study_lesson';
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
    try {
      await logAiCall(supabase, userId, callType, 'fallback-static', 0, 0);
    } catch (logErr) {
      console.warn('ai_log write failed (over-ceiling):', logErr);
    }
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
    ? 'claude-haiku-4-5-20251001'
    : 'claude-sonnet-5'; // Defaulting to Sonnet

  // 3. Make Anthropic API Call
  const anthropic = getAnthropicClient();

  // claude-sonnet-5 rejects any explicit `temperature` other than its
  // default (1) with a 400 invalid_request_error ("deprecated for this
  // model") — confirmed live against this account. Haiku still accepts a
  // custom temperature, so only omit it for Sonnet calls.
  const supportsCustomTemperature = model !== 'claude-sonnet-5';

  try {
    const response = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      ...(supportsCustomTemperature ? { temperature } : {}),
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    // claude-sonnet-5 prepends a `thinking` content block before the `text`
    // block (confirmed live), so the first block is no longer reliably the
    // answer — find the first `text` block instead of assuming index 0.
    const textBlock = response.content.find((block) => block.type === 'text');
    const contentText = textBlock && textBlock.type === 'text' ? textBlock.text : '';
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
    try {
      await logAiCall(supabase, userId, callType, 'fallback-error', 0, 0);
    } catch (logErr) {
      console.warn('ai_log write failed (error path):', logErr);
    }
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
