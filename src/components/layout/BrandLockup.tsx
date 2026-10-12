export default function BrandLockup({ compact = false }: { compact?: boolean }) {
    return (
        <>
            <span className="brand-symbol" aria-hidden="true">
                <svg viewBox="0 0 40 40" fill="none">
                    <path d="M8 7h24v6H15v5h14v6H15v9H8V7Z" fill="currentColor" />
                    <path d="M26 7h6v6h-6z" fill="#ffdd4a" />
                </svg>
            </span>
            {!compact && (
                <span className="brand-wordmark">
                    <span>Event</span> <span>Planner</span>
                </span>
            )}
        </>
    );
}
