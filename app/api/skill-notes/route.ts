import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { getSupabaseServerClient, fetchSkillNoteForSkill, upsertSkillNote } from '@/lib/db';

export const dynamic = 'force-dynamic';

const SkillNoteRequestSchema = z.object({
  skillId: z.string().uuid(),
  content: z.string().min(1),
});

export async function POST(req: NextRequest) {
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = SkillNoteRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { skillId, content } = parsed.data;

  const cookieStore = cookies();
  const supabase = getSupabaseServerClient({ getAll: () => cookieStore.getAll() });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const existing = await fetchSkillNoteForSkill(supabase, user.id, skillId);

  const today = new Date().toISOString().slice(0, 10);
  const timestampedEntry = `[Study Mode — ${today}]: ${content}`;
  const newContent = existing?.content
    ? `${existing.content}\n${timestampedEntry}`
    : timestampedEntry;

  const updated = await upsertSkillNote(supabase, {
    user_id: user.id,
    skill_id: skillId,
    content: newContent,
    updated_at: new Date().toISOString(),
  });

  return NextResponse.json({ success: true, note: updated });
}
