export type EventRow = {
    id: string;
    title: string;
    description?: string | null;
    date?: string | null;
    location?: string | null;
    created_at?: string;
};

export type EventInput = {
    title: string;
    description: string | null;
    date: string | null;
    location: string | null;
};
