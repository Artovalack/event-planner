function zonedParts(timestamp: Date, timeZone: string): Record<string, number> {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(timestamp);
    return Object.fromEntries(parts.map((part) => [part.type, Number(part.value)]));
}

export function zonedDateFromIso(value: string | null, timeZone: string) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const parts = zonedParts(date, timeZone);
    return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

export function zonedDateTimeInput(value: string, timeZone: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const parts = zonedParts(date, timeZone);
    return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}T${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
}

export function zonedDateTimeToIso(date: string, time: string, timeZone: string) {
    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute] = time.split(':').map(Number);
    const expectedWallTime = Date.UTC(year, month - 1, day, hour, minute);
    let timestamp = expectedWallTime;

    for (let attempt = 0; attempt < 4; attempt += 1) {
        const actual = zonedParts(new Date(timestamp), timeZone);
        const actualWallTime = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute);
        const difference = expectedWallTime - actualWallTime;
        if (difference === 0) break;
        timestamp += difference;
    }

    const resolved = zonedParts(new Date(timestamp), timeZone);
    if (
        resolved.year !== year ||
        resolved.month !== month ||
        resolved.day !== day ||
        resolved.hour !== hour ||
        resolved.minute !== minute
    ) {
        throw new Error(`The time ${time} does not exist in ${timeZone} because of a daylight-saving transition.`);
    }
    return new Date(timestamp).toISOString();
}

export function formatTimeInTimezone(value: string, timeZone: string) {
    return new Intl.DateTimeFormat(undefined, {
        timeZone,
        hour: 'numeric',
        minute: '2-digit',
    }).format(new Date(value));
}
