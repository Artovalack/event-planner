'use client';

export default function PrintButton({ label = 'Print / Save PDF' }: { label?: string }) {
    return <button className="secondary-button print-control" type="button" onClick={() => window.print()}>{label}</button>;
}
