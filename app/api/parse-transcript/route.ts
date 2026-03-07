import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import createClient from '@/lib/supabase-server'

const SYSTEM_PROMPT = `You are an AI that extracts structured data from a transcript about someone's professional context.
Parse the transcript and return a JSON object with the following structure:

{
  "profile": {
    "name": "string - full name",
    "role_title": "string - job title",
    "role_description": "string - core responsibilities and scope",
    "communication_style": "string - how they prefer to receive information",
    "thinking_style": "string - how they approach problems",
    "blind_spots": "string - what they want to be challenged on",
    "energy_drains": "string - what drains vs energizes them",
    "ai_instructions": "string - specific instructions for how AI should work with them"
  },
  "goals": [
    {
      "title": "string - concise goal name",
      "description": "string - success criteria and context",
      "priority": 1, // 1=P0, 2=P1, 3=P2
      "metrics": "string - key metrics if mentioned",
      "deadline": "string - YYYY-MM-DD format or empty string",
      "risks": "string - known risks or blockers"
    }
  ],
  "people": [
    {
      "name": "string - full name",
      "role": "string - their title/role",
      "relationship": "manager|report|stakeholder",
      "context": "string - what they care about, expectations",
      "strengths": "string",
      "growth_areas": "string",
      "motivations": "string",
      "communication_style": "string - how they prefer to work",
      "current_focus": "string",
      "risks_concerns": "string"
    }
  ],
  "backlog": [
    {
      "title": "string - concise item name",
      "description": "string - context and details",
      "category": "question|decision|process|idea|action"
    }
  ]
}

Rules:
- Extract ALL mentioned people, goals, questions, and backlog items
- Classify relationship types: "manager" for their boss, "report" for anyone they manage or lead (even without formal authority), "stakeholder" for cross-functional partners
- For goals, assign priority 1 (P0) to the most critical items, 2 (P1) for important but secondary, 3 (P2) for everything else
- For backlog, categorize: "question" for open questions they're wrestling with, "decision" for pending decisions, "process" for broken/frustrating processes, "idea" for things they'd like to do, "action" for committed actions they haven't started
- Where information is missing or unclear, leave the field as an empty string
- Tighten and clarify any rambling language, but preserve their voice and intent
- For ai_instructions, synthesize their preferences into direct instructions (e.g., "Be direct. Don't validate ideas to please me...")
- Return ONLY valid JSON, no markdown code blocks or other formatting`

/**
 * Find best match for an item in existing items by comparing lowercase titles/names.
 * Returns the matched existing item or null.
 */
function findMatch<T extends { id: string }>(
  parsedValue: string,
  existingItems: T[],
  getField: (item: T) => string
): T | null {
  if (!parsedValue) return null
  const normalizedParsed = parsedValue.toLowerCase().trim()

  // Exact match first
  const exact = existingItems.find(item => getField(item).toLowerCase().trim() === normalizedParsed)
  if (exact) return exact

  // Substring match (either direction) for close matches
  const substringMatch = existingItems.find(item => {
    const existing = getField(item).toLowerCase().trim()
    return existing.includes(normalizedParsed) || normalizedParsed.includes(existing)
  })
  return substringMatch || null
}

/**
 * Merge parsed fields into existing record, only overwriting with non-empty values.
 */
function mergeFields(existing: Record<string, any>, parsed: Record<string, any>, fields: string[]): Record<string, any> {
  const updates: Record<string, any> = {}
  for (const field of fields) {
    const newVal = parsed[field]
    if (newVal && newVal !== '') {
      updates[field] = newVal
    }
  }
  return updates
}

export async function POST(request: NextRequest) {
  try {
    const { transcript } = await request.json()

    if (!transcript || typeof transcript !== 'string') {
      return NextResponse.json({ error: 'Transcript is required' }, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
    }

    // Get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Call Claude to parse the transcript
    const anthropic = new Anthropic({ apiKey })
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Parse this transcript and extract structured data:\n\n${transcript}`,
        },
      ],
    })

    // Extract text from response
    const responseText = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('')

    // Parse JSON from response (handle potential markdown code blocks)
    let parsed: any
    try {
      parsed = JSON.parse(responseText)
    } catch {
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1])
      } else {
        throw new Error('Failed to parse AI response as JSON')
      }
    }

    // Fetch existing data for dedup matching
    const [existingGoals, existingPeople, existingBacklog] = await Promise.all([
      supabase.from('goals').select('*').eq('user_id', user.id),
      supabase.from('people').select('*').eq('user_id', user.id),
      supabase.from('backlog').select('*').eq('user_id', user.id),
    ])

    // Upsert profile (already deduped via unique constraint)
    if (parsed.profile) {
      const { error: profileError } = await supabase
        .from('user_profile')
        .upsert({
          user_id: user.id,
          name: parsed.profile.name || '',
          role_title: parsed.profile.role_title || '',
          role_description: parsed.profile.role_description || '',
          communication_style: parsed.profile.communication_style || '',
          thinking_style: parsed.profile.thinking_style || '',
          blind_spots: parsed.profile.blind_spots || '',
          energy_drains: parsed.profile.energy_drains || '',
          ai_instructions: parsed.profile.ai_instructions || '',
        }, { onConflict: 'user_id' })

      if (profileError) console.error('Error upserting profile:', profileError)
    }

    // Dedup goals: match by title, update existing or insert new
    let goalsCreated = 0, goalsUpdated = 0
    if (parsed.goals?.length > 0) {
      const existing = existingGoals.data || []
      for (const g of parsed.goals) {
        const match = findMatch(g.title, existing, (item: any) => item.title)
        if (match) {
          const updates = mergeFields(match, {
            description: g.description || '',
            priority: g.priority || undefined,
            metrics: g.metrics || '',
            deadline: g.deadline || undefined,
            risks: g.risks || '',
          }, ['description', 'priority', 'metrics', 'deadline', 'risks'])

          if (Object.keys(updates).length > 0) {
            const { error } = await supabase.from('goals').update(updates).eq('id', match.id)
            if (!error) goalsUpdated++
            else console.error('Error updating goal:', error)
          }
        } else {
          const { error } = await supabase.from('goals').insert({
            user_id: user.id,
            title: g.title || '',
            description: g.description || '',
            priority: g.priority || 2,
            metrics: g.metrics || '',
            deadline: g.deadline || null,
            risks: g.risks || '',
            position: 0,
          })
          if (!error) goalsCreated++
          else console.error('Error inserting goal:', error)
        }
      }
    }

    // Dedup people: match by name, update existing or insert new
    let peopleCreated = 0, peopleUpdated = 0
    if (parsed.people?.length > 0) {
      const existing = existingPeople.data || []
      for (const p of parsed.people) {
        const match = findMatch(p.name, existing, (item: any) => item.name)
        if (match) {
          const updates = mergeFields(match, {
            role: p.role || '',
            relationship: p.relationship || undefined,
            context: p.context || '',
            strengths: p.strengths || '',
            growth_areas: p.growth_areas || '',
            motivations: p.motivations || '',
            communication_style: p.communication_style || '',
            current_focus: p.current_focus || '',
            risks_concerns: p.risks_concerns || '',
          }, ['role', 'relationship', 'context', 'strengths', 'growth_areas', 'motivations', 'communication_style', 'current_focus', 'risks_concerns'])

          if (Object.keys(updates).length > 0) {
            const { error } = await supabase.from('people').update(updates).eq('id', match.id)
            if (!error) peopleUpdated++
            else console.error('Error updating person:', error)
          }
        } else {
          const { error } = await supabase.from('people').insert({
            user_id: user.id,
            name: p.name || '',
            role: p.role || '',
            relationship: p.relationship || 'stakeholder',
            context: p.context || '',
            strengths: p.strengths || '',
            growth_areas: p.growth_areas || '',
            motivations: p.motivations || '',
            communication_style: p.communication_style || '',
            current_focus: p.current_focus || '',
            risks_concerns: p.risks_concerns || '',
            position: 0,
          })
          if (!error) peopleCreated++
          else console.error('Error inserting person:', error)
        }
      }
    }

    // Dedup backlog: match by title, update existing or insert new
    let backlogCreated = 0, backlogUpdated = 0
    if (parsed.backlog?.length > 0) {
      const existing = existingBacklog.data || []
      for (const b of parsed.backlog) {
        const match = findMatch(b.title, existing, (item: any) => item.title)
        if (match) {
          const updates = mergeFields(match, {
            description: b.description || '',
            category: b.category || undefined,
          }, ['description', 'category'])

          if (Object.keys(updates).length > 0) {
            const { error } = await supabase.from('backlog').update(updates).eq('id', match.id)
            if (!error) backlogUpdated++
            else console.error('Error updating backlog item:', error)
          }
        } else {
          const { error } = await supabase.from('backlog').insert({
            user_id: user.id,
            title: b.title || '',
            description: b.description || '',
            category: b.category || 'action',
            position: 0,
          })
          if (!error) backlogCreated++
          else console.error('Error inserting backlog item:', error)
        }
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        goalsCreated,
        goalsUpdated,
        goalsCount: goalsCreated + goalsUpdated,
        peopleCreated,
        peopleUpdated,
        peopleCount: peopleCreated + peopleUpdated,
        backlogCreated,
        backlogUpdated,
        backlogCount: backlogCreated + backlogUpdated,
        profileUpdated: !!parsed.profile,
      },
      parsed,
    })
  } catch (error: any) {
    console.error('Error parsing transcript:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to parse transcript' },
      { status: 500 }
    )
  }
}
