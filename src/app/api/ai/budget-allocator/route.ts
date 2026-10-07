import { groq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import { NextResponse } from 'next/server';
import { getActiveEvent, getEventRole } from '@/lib/planner';
import { getSupabaseServerClient } from '@/lib/supabase/server';

type AllocationIdea = {
    name: string;
    category: string;
    weight: number;
    rationale: string;
};

function parseAllocationIdeas(value: string): AllocationIdea[] | null {
    const json = value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    let parsed: unknown;
    try {
        parsed = JSON.parse(json);
    } catch {
        return null;
    }
    if (!Array.isArray(parsed) || parsed.length < 3 || parsed.length > 12) return null;

    const ideas: AllocationIdea[] = [];
    for (const item of parsed) {
        if (typeof item !== 'object' || item === null) return null;
        const idea = item as Record<string, unknown>;
        if (
            typeof idea.name !== 'string' || !idea.name.trim() || idea.name.length > 120 ||
            typeof idea.category !== 'string' || !idea.category.trim() || idea.category.length > 80 ||
            typeof idea.weight !== 'number' || !Number.isFinite(idea.weight) || idea.weight <= 0 || idea.weight > 1_000_000 ||
            typeof idea.rationale !== 'string' || !idea.rationale.trim() || idea.rationale.length > 240
        ) return null;
        ideas.push({
            name: idea.name.trim(),
            category: idea.category.trim(),
            weight: idea.weight,
            rationale: idea.rationale.trim(),
        });
    }
    return ideas;
}

export async function POST(request: Request) {
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
    }
    if (typeof body !== 'object' || body === null) {
        return NextResponse.json({ error: 'Provide a total budget and event type.' }, { status: 400 });
    }

    const input = body as Record<string, unknown>;
    const totalBudget = input.totalBudget;
    const eventType = input.eventType;
    if (
        typeof totalBudget !== 'number' ||
        !Number.isFinite(totalBudget) ||
        totalBudget <= 0 ||
        totalBudget > 1_000_000_000 ||
        Math.round(totalBudget * 100) !== totalBudget * 100
    ) {
        return NextResponse.json({ error: 'Enter a budget greater than zero, with no more than two decimal places.' }, { status: 400 });
    }
    if (typeof eventType !== 'string' || !eventType.trim() || eventType.trim().length > 120) {
        return NextResponse.json({ error: 'Enter an event type up to 120 characters.' }, { status: 400 });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: 'The budget allocator is not configured. Add GROQ_API_KEY to the server environment.' }, { status: 503 });
    }

    try {
        const supabase = getSupabaseServerClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
        }

        const event = await getActiveEvent();
        if (!event) return NextResponse.json({ error: 'Select an event before creating a budget allocation.' }, { status: 400 });
        const role = await getEventRole(event.id);
        if (role !== 'admin' && role !== 'collaborator') {
            return NextResponse.json({ error: 'Only event admins and collaborators can generate budget allocations.' }, { status: 403 });
        }

        const { text } = await generateText({
            model: groq('openai/gpt-oss-20b'),
            maxTokens: 1200,
            temperature: 0.3,
            system: 'You are an event budget planner. Create practical, balanced budget categories based on the event type. Return only a JSON array with 5 to 10 objects, each containing name (short budget item name), category (short category), weight (positive numeric relative share; all weights need not sum to 100), and rationale (one concise sentence). Do not include currency amounts or exceed the available budget. Avoid duplicate categories and account for contingency where appropriate.',
            prompt: JSON.stringify({
                eventType: eventType.trim(),
                totalBudget,
                currency: event.currency_code ?? 'USD',
            }),
        });

        const ideas = parseAllocationIdeas(text);
        if (!ideas) {
            console.error('Budget allocator returned an invalid allocation format.');
            return NextResponse.json({ error: 'The AI returned an invalid allocation. Please try again.' }, { status: 502 });
        }
        return NextResponse.json({ ideas });
    } catch (error) {
        console.error('Unable to generate a budget allocation:', error);
        return NextResponse.json(
            { error: 'Unable to generate a budget allocation. Check the AI configuration and try again.' },
            { status: 502 },
        );
    }
}
