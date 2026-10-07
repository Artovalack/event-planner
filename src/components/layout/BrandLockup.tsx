export default function BrandLockup({ compact = false }: { compact?: boolean }) {
    return (
        <>
            <span className="brand-symbol" aria-hidden="true">
                <svg viewBox="0 0 40 40" fill="none">
                    <path d="M20 7.5c1.7 7.1 4.4 9.8 12.5 12.5-8.1 2.7-10.8 5.4-12.5 12.5-1.7-7.1-4.4-9.8-12.5-12.5C15.6 17.3 18.3 14.6 20 7.5Z" fill="currentColor" />
                    <circle cx="31.5" cy="9" r="2.5" fill="currentColor" />
                    <circle cx="9" cy="30.5" r="1.75" fill="currentColor" opacity=".7" />
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
