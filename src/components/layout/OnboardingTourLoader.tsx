'use client';

import dynamic from 'next/dynamic';

const OnboardingTour = dynamic(() => import('@/components/layout/OnboardingTour'), {
    ssr: false,
});

export default function OnboardingTourLoader() {
    return <OnboardingTour />;
}
