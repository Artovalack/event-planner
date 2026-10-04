type AssistantPanelProps = {
    prompt?: string;
};

export default function AssistantPanel({ prompt = 'How can I help with your event plan?' }: AssistantPanelProps) {
    return (
        <section className="rounded border bg-slate-50 p-4">
            <h3 className="mb-2 text-lg font-semibold">AI assistant</h3>
            <p>{prompt}</p>
        </section>
    );
}
