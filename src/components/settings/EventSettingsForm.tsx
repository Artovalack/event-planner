'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { saveEventSettings } from '@/actions/settings';
import { getSupabaseClient } from '@/lib/supabase/client';
import type { EventRow } from '@/types/database';

const currencies = [
    ['PHP', 'Philippine Peso (₱)'],
    ['USD', 'US Dollar ($)'],
    ['EUR', 'Euro (€)'],
    ['GBP', 'British Pound (£)'],
    ['JPY', 'Japanese Yen (¥)'],
    ['AUD', 'Australian Dollar (A$)'],
    ['CAD', 'Canadian Dollar (C$)'],
    ['SGD', 'Singapore Dollar (S$)'],
];

const timezones = [
    'Asia/Manila',
    'Asia/Singapore',
    'Asia/Tokyo',
    'Asia/Dubai',
    'Australia/Sydney',
    'Europe/London',
    'Europe/Paris',
    'America/Los_Angeles',
    'America/Chicago',
    'America/New_York',
    'UTC',
];

const bannerTypes = new Map([
    ['image/jpeg', 'jpg'],
    ['image/png', 'png'],
    ['image/webp', 'webp'],
]);

export default function EventSettingsForm({ event, bannerUrl }: { event: EventRow; bannerUrl: string | null }) {
    const router = useRouter();
    const [currencyCode, setCurrencyCode] = useState(event.currency_code ?? 'PHP');
    const [timezone, setTimezone] = useState(event.timezone ?? 'Asia/Manila');
    const [venueName, setVenueName] = useState(event.venue_name ?? '');
    const [venueAddress, setVenueAddress] = useState(event.venue_address ?? '');
    const [banner, setBanner] = useState<File | undefined>();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const updateBanner = (file?: File) => {
        if (file && !bannerTypes.has(file.type)) {
            setError('Banner must be a JPEG, PNG, or WebP image.');
            return;
        }
        if (file && file.size > 5 * 1024 * 1024) {
            setError('Banner image must be 5 MB or smaller.');
            return;
        }
        setError(null);
        setBanner(file);
        setPreviewUrl((current) => {
            if (current) URL.revokeObjectURL(current);
            return file ? URL.createObjectURL(file) : null;
        });
    };

    const submit = async (submitEvent: FormEvent<HTMLFormElement>) => {
        submitEvent.preventDefault();
        setSaving(true);
        setError(null);
        setNotice(null);
        let uploadedPath: string | null = null;
        let uploadCompleted = false;
        try {
            if (banner) {
                const extension = bannerTypes.get(banner.type);
                if (!extension) throw new Error('Banner must be a JPEG, PNG, or WebP image.');
                uploadedPath = `${event.id}/${crypto.randomUUID()}.${extension}`;
                const { error: uploadError } = await getSupabaseClient()
                    .storage.from('event-banners')
                    .upload(uploadedPath, banner, { contentType: banner.type, upsert: false });
                if (uploadError) throw new Error(`Unable to upload banner: ${uploadError.message}`);
                uploadCompleted = true;
            }

            const result = await saveEventSettings(event.id, {
                currency_code: currencyCode,
                timezone,
                venue_name: venueName,
                venue_address: venueAddress,
            }, uploadedPath ?? undefined);
            setNotice(result.warning ?? 'Event settings saved.');
            updateBanner(undefined);
            router.refresh();
        } catch (caughtError) {
            const message = caughtError instanceof Error ? caughtError.message : 'Unable to save event settings.';
            if (uploadedPath && uploadCompleted) {
                const { error: cleanupError } = await getSupabaseClient().storage.from('event-banners').remove([uploadedPath]);
                if (cleanupError) {
                    setError(`${message} The uploaded banner could not be cleaned up: ${cleanupError.message}`);
                } else {
                    setError(message);
                }
            } else {
                setError(message);
            }
        } finally {
            setSaving(false);
        }
    };

    return (
        <form className="planner-form-card event-settings-form" onSubmit={submit}>
            <div className="planner-form-heading"><h2>Preferences</h2><span className="event-settings-name">{event.title}</span></div>
            <div className="planner-form-grid">
                <label>Currency
                    <select value={currencyCode} onChange={(inputEvent) => setCurrencyCode(inputEvent.target.value)}>
                        {currencies.map(([code, label]) => <option value={code} key={code}>{label}</option>)}
                        {!currencies.some(([code]) => code === currencyCode) && <option value={currencyCode}>{currencyCode}</option>}
                    </select>
                </label>
                <label>Timezone
                    <select value={timezone} onChange={(inputEvent) => setTimezone(inputEvent.target.value)}>
                        {!timezones.includes(timezone) && <option value={timezone}>{timezone}</option>}
                        {timezones.map((zone) => <option value={zone} key={zone}>{zone}</option>)}
                    </select>
                </label>
                <label>Venue name<input maxLength={160} value={venueName} onChange={(inputEvent) => setVenueName(inputEvent.target.value)} placeholder="Venue or location name" /></label>
                <label>Venue address<input maxLength={300} value={venueAddress} onChange={(inputEvent) => setVenueAddress(inputEvent.target.value)} placeholder="Street, city, region" /></label>
                <label className="planner-form-wide event-banner-field">Banner image
                    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(inputEvent) => updateBanner(inputEvent.target.files?.[0])} />
                    <small>JPEG, PNG, or WebP. Maximum size: 5 MB.</small>
                    {(previewUrl || bannerUrl) && <img className="event-banner-preview" src={previewUrl ?? bannerUrl ?? ''} alt={`${event.title} banner preview`} />}
                </label>
            </div>
            {error && <p className="auth-error" role="alert">{error}</p>}
            {notice && <p className="auth-success" role="status">{notice}</p>}
            <div className="event-form-actions">
                <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</button>
            </div>
        </form>
    );
}
