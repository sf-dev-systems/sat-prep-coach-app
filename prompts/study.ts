export interface StudyPromptContext {
  skill: {
    id: string
    name: string
    section: 'math' | 'rw' | 'strategy'
    domain: string | null
  }
  masterySnapshot: {
    p_mastery: number
    attempts_count: number
    last_practiced: string | null
  } | null
  recentErrors: Array<{
    ai_observation: string | null
    student_note: string | null
    created_at: string
  }>
  existingNote: string | null
  sampleQuestion: {
    stem: string
    correct_answer: string
    rationale: string
  } | null
}

import { AVA_LEARNER_PROFILE } from '../lib/learner-profile'

const { vark, instructionalStyle, avoidances, lessonConstraints } = AVA_LEARNER_PROFILE
const VARK_DIRECTIVE = `Ava learns by doing and writing (Kinesthetic ${vark.kinesthetic}, Read/Write ${vark.readWrite}; style: ${instructionalStyle}). Every lesson must: give one short rule she can write down, a checklist of steps, a worked example with explicit steps, an active 'do this now' prompt, a retrieval prompt to test memory, and a teach-back prompt asking her to restate the rule in her own words. No passive lecture blocks longer than ${lessonConstraints.maxPassiveParagraphs} short paragraph. No ${avoidances.join('. No ')}.`

const OUTPUT_SHAPE = `{
  "skill": {
    "id": "<uuid>",
    "name": "<string>",
    "section": "math" | "rw" | "strategy",
    "domain": "<string> | null"
  },
  "lesson": {
    "whyItMatters": "<one short paragraph>",
    "avaRule": "<one sentence rule Ava can write down>",
    "checklist": ["<step>", "<step>", ...],
    "commonTrap": "<one sentence describing the trap to avoid>",
    "workedExample": {
      "setup": "<problem setup>",
      "steps": ["<step>", "<step>", ...],
      "takeaway": "<one sentence generalizable takeaway>"
    },
    "doNowPrompt": "<active prompt — what to do right now>",
    "retrievalPrompt": "<memory test prompt>",
    "teachBackPrompt": "<prompt asking Ava to restate the rule in her own words>"
  },
  "context": {
    "usedErrorJournal": true | false,
    "usedExistingNote": true | false,
    "overCeiling": false,
    "source": "ai"
  }
}`

export function getStudyLessonPrompt(context: StudyPromptContext): { system: string; user: string } {
  const { skill, masterySnapshot, recentErrors, existingNote, sampleQuestion } = context

  const system = `You are a world-class AI SAT Coach building a personalized study lesson for one student, Ava.

VARK DIRECTIVE (mandatory — apply to every element of the lesson):
${VARK_DIRECTIVE}

You must respond with ONLY valid JSON — no markdown, no prose outside the JSON, no code fences. The JSON must exactly match this shape:
${OUTPUT_SHAPE}

Additional instructions:
- "checklist" must have at least 2 steps; "workedExample.steps" must have at least 2 steps.
- If recent error traps are provided, weave them into "commonTrap" and "workedExample" so Ava sees exactly what went wrong.
- If an existing note is provided, acknowledge it explicitly in "avaRule" or "workedExample" (phrase it as "You already noted: …" and build on it — do not simply repeat it).
- Keep every prose field concise. "whyItMatters" is one short paragraph. "avaRule" is one sentence. "commonTrap" is one sentence.`

  const userParts: string[] = []

  userParts.push(`Skill: ${skill.name}`)
  userParts.push(`Section: ${skill.section}${skill.domain ? ` — ${skill.domain}` : ''}`)

  if (masterySnapshot) {
    const pct = Math.round(masterySnapshot.p_mastery * 100)
    const lastPracticed = masterySnapshot.last_practiced
      ? new Date(masterySnapshot.last_practiced).toLocaleDateString()
      : 'never'
    userParts.push(
      `Mastery: ${pct}% (${masterySnapshot.attempts_count} attempt${masterySnapshot.attempts_count !== 1 ? 's' : ''}, last practiced ${lastPracticed})`
    )
  } else {
    userParts.push('Mastery: No data yet — this is Ava\'s first time studying this skill.')
  }

  if (recentErrors.length > 0) {
    const errorList = recentErrors
      .map((e, i) => {
        const parts: string[] = []
        if (e.ai_observation) parts.push(`Coach observation: ${e.ai_observation}`)
        if (e.student_note) parts.push(`Ava's note: ${e.student_note}`)
        return `Error ${i + 1} (${new Date(e.created_at).toLocaleDateString()}): ${parts.join(' | ')}`
      })
      .join('\n')
    userParts.push(`Recent error traps (weave these into the lesson):\n${errorList}`)
  }

  if (existingNote) {
    userParts.push(`Ava's existing note on this skill: ${existingNote}`)
  }

  if (sampleQuestion) {
    userParts.push(
      `Sample question for the worked example:\nStem: ${sampleQuestion.stem}\nCorrect answer: ${sampleQuestion.correct_answer}\nRationale: ${sampleQuestion.rationale}`
    )
  }

  userParts.push(`Build a complete study lesson for this skill. Return only the JSON.`)

  return { system, user: userParts.join('\n\n') }
}
