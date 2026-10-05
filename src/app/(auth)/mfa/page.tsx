import MfaManager from '@/components/auth/MfaManager';

export default function MfaPage({ searchParams }: { searchParams: { mode?: string } }) {
    return <MfaManager initialChallenge={searchParams.mode === 'challenge'} />;
}
