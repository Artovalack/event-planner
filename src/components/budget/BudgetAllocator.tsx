'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveBudgetItem } from '@/actions/planner';

type AllocationIdea = {
    name: string;
    category: string;
    weight: number;
    rationale: string;
};

type PricedIdea = AllocationIdea & { estimatedCost: number };

function priceIdeas(ideas: AllocationIdea[], total: number): PricedIdea[] {
    const totalCents = Math.round(total * 100);
    const weightTotal = ideas.reduce((sum, idea) => sum + idea.weight, 0);
    const shares = ideas.map((idea, index) => {
        const exactCents = totalCents * idea.weight / weightTotal;
        const baseCents = Math.floor(exactCents);
        return { index, cents: baseCents, remainder: exactCents - baseCents };
    });
    let centsLeft = totalCents - shares.reduce((sum, share) => sum + share.cents, 0);
    const priority = [...shares].sort((left, right) => right.remainder - left.remainder);
    for (let index = 0; index < centsLeft; index += 1) {
        priority[index % priority.length].cents += 1;
    }
    return ideas.map((idea, index) => ({
        ...idea,
        estimatedCost: shares[index].cents / 100,
    }));
}

export default function BudgetAllocator({
    eventId,
    currencyCode,
}: {
    eventId: string;
    currencyCode: string;
}) {
    const router = useRouter();
    const [totalBudget, setTotalBudget] = useState('');
    const [eventType, setEventType] = useState('');
    const [ideas, setIdeas] = useState<PricedIdea[]>([]);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [busy, startTransition] = useTransition();
    const formatter = new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: currencyCode,
        maximumFractionDigits: 2,
    });

    const generate = async (formData: FormData) => {
        setError('');
        setNotice('');
        setIdeas([]);
        const budget = Number(formData.get('totalBudget'));
        const type = String(formData.get('eventType') ?? '').trim();
        startTransition(async () => {
            try {
                const response = await fetch('/api/ai/budget-allocator', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ totalBudget: budget, eventType: type }),
                });
                const result = await response.json() as { error?: string; ideas?: AllocationIdea[] };
                if (!response.ok) throw new Error(result.error ?? 'Unable to generate a budget allocation.');
                if (!Array.isArray(result.ideas) || !result.ideas.length) {
                    throw new Error('The AI returned no budget items. Please try again.');
                }
                setIdeas(priceIdeas(result.ideas, budget));
            } catch (caughtError) {
                setError(caughtError instanceof Error ? caughtError.message : 'Unable to generate a budget allocation.');
            }
        });
    };

    const addIdea = (idea: PricedIdea) => {
        setError('');
        setNotice('');
        startTransition(async () => {
            try {
                await saveBudgetItem(eventId, {
                    item_name: idea.name,
                    category: idea.category,
                    estimated_cost: idea.estimatedCost,
                    actual_cost: 0,
                    payment_status: 'pending',
                });
                setIdeas((current) => current.filter((item) => item !== idea));
                setNotice(`${idea.name} was added to your budget.`);
                router.refresh();
            } catch (caughtError) {
                setError(caughtError instanceof Error ? caughtError.message : `Unable to add ${idea.name}.`);
            }
        });
    };

    return (
        <section className="budget-allocator planner-form-card">
            <div className="planner-form-heading">
                <div><p className="eyebrow">AI BUDGET ALLOCATOR</p><h2>Draft a budget breakdown</h2></div>
            </div>
            <p className="budget-allocator-description">Generate suggested line items from your total budget and event type. Review the estimates, then add only the items you want.</p>
            <form className="budget-allocator-form" action={generate}>
                <label>Total budget ({currencyCode})<input name="totalBudget" type="number" min="0.01" max="1000000000" step="0.01" required value={totalBudget} onChange={(event) => setTotalBudget(event.target.value)} /></label>
                <label>Event type<input name="eventType" required maxLength={120} value={eventType} onChange={(event) => setEventType(event.target.value)} placeholder="e.g. wedding, conference, birthday" /></label>
                <button className="secondary-button" type="submit" disabled={busy}>{busy ? 'Generating…' : 'Generate suggestions'}</button>
            </form>
            {error && <p className="form-message form-message-error" role="alert">{error}</p>}
            {notice && <p className="form-message form-message-success" role="status">{notice}</p>}
            {ideas.length > 0 && (
                <div className="budget-idea-list">
                    <div className="budget-idea-summary"><strong>Suggested breakdown</strong><span>Total: {formatter.format(ideas.reduce((sum, idea) => sum + idea.estimatedCost, 0))}</span></div>
                    {ideas.map((idea, index) => (
                        <article className="budget-idea" key={`${idea.category}-${idea.name}-${index}`}>
                            <div><strong>{idea.name}</strong><span className="category-label">{idea.category} · {formatter.format(idea.estimatedCost)}</span><p>{idea.rationale}</p></div>
                            <button type="button" className="text-button" disabled={busy} onClick={() => addIdea(idea)}>Add to budget</button>
                        </article>
                    ))}
                </div>
            )}
        </section>
    );
}
