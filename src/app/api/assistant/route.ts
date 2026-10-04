import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { prompt } = await request.json();

        return NextResponse.json({
            response: `Assistant: ${typeof prompt === 'string' && prompt.trim() ? prompt : 'No prompt provided.'}`,
        });
    } catch {
        return NextResponse.json({ error: 'Error processing request' }, { status: 500 });
    }
}