'use client';

import { useState, useTransition } from 'react';

type Tone = 'professional' | 'friendly' | 'concise';

export default function VendorOutreach({
    vendorId,
    vendorName,
    vendorEmail,
}: {
    vendorId: string;
    vendorName: string;
    vendorEmail: string | null;
}) {
    const [open, setOpen] = useState(false);
    const [purpose, setPurpose] = useState('');
    const [tone, setTone] = useState<Tone>('professional');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [recipient, setRecipient] = useState(vendorEmail ?? '');
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [busy, startTransition] = useTransition();

    const generate = (formData: FormData) => {
        setError('');
        setNotice('');
        setSubject('');
        setBody('');
        const inquiryPurpose = String(formData.get('purpose') ?? '').trim();
        const selectedTone = String(formData.get('tone') ?? 'professional') as Tone;
        startTransition(async () => {
            try {
                const response = await fetch('/api/ai/vendor-outreach', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ vendorId, purpose: inquiryPurpose, tone: selectedTone }),
                });
                const result = await response.json() as { error?: string; subject?: string; body?: string; email?: string | null };
                if (!response.ok) throw new Error(result.error ?? 'Unable to draft vendor outreach.');
                if (!result.subject || !result.body) throw new Error('The AI returned an incomplete email draft.');
                setSubject(result.subject);
                setBody(result.body);
                if (result.email) setRecipient(result.email);
                setNotice(`Draft ready for ${vendorName}. Review it before sending.`);
            } catch (caughtError) {
                setError(caughtError instanceof Error ? caughtError.message : 'Unable to draft vendor outreach.');
            }
        });
    };

    const openEmailClient = () => {
        if (!recipient.trim()) {
            setError('Enter the vendor’s email address before opening your email app.');
            return;
        }
        const href = `mailto:${encodeURIComponent(recipient.trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.location.assign(href);
    };

    return (
        <section className="vendor-outreach">
            {!open
                ? <button className="secondary-button vendor-outreach-trigger" type="button" onClick={() => setOpen(true)}>Draft inquiry email</button>
                : <div className="vendor-outreach-panel">
                    <div className="vendor-outreach-heading"><h3>AI vendor inquiry draft</h3><button className="text-button" type="button" onClick={() => { setOpen(false); setError(''); setNotice(''); }}>Close</button></div>
                    <form className="vendor-outreach-form" action={generate}>
                        <label>What do you need to ask?<textarea name="purpose" required maxLength={500} rows={3} value={purpose} onChange={(event) => setPurpose(event.target.value)} placeholder="Ask about availability, package pricing, setup, or a quote…" /></label>
                        <label>Tone<select name="tone" value={tone} onChange={(event) => setTone(event.target.value as Tone)}><option value="professional">Professional</option><option value="friendly">Friendly</option><option value="concise">Concise</option></select></label>
                        <button className="secondary-button" type="submit" disabled={busy}>{busy ? 'Drafting…' : 'Generate email draft'}</button>
                    </form>
                    {error && <p className="form-message form-message-error" role="alert">{error}</p>}
                    {notice && <p className="form-message form-message-success" role="status">{notice}</p>}
                    {body && <>
                        <label className="vendor-outreach-recipient">To<input type="email" value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="vendor@example.com" /></label>
                        <label className="vendor-outreach-recipient">Subject<input value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={180} /></label>
                        <label className="vendor-outreach-recipient">Message<textarea value={body} onChange={(event) => setBody(event.target.value)} rows={9} maxLength={6000} /></label>
                        <div className="vendor-outreach-actions">
                            <button className="primary-button" type="button" onClick={openEmailClient}>Open in email app</button>
                            <button className="text-button" type="button" onClick={() => {
                                void navigator.clipboard.writeText(`To: ${recipient}\nSubject: ${subject}\n\n${body}`)
                                    .then(() => setNotice('Draft copied to clipboard.'))
                                    .catch(() => setError('Clipboard unavailable. Select and copy the draft manually.'));
                            }}>Copy draft</button>
                        </div>
                    </>}
                </div>}
        </section>
    );
}
