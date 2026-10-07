'use client';

import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';

const WorkspaceHeader = dynamic(() => import('./WorkspaceHeader'), {
    ssr: false,
});

type WorkspaceHeaderLoaderProps = ComponentProps<typeof WorkspaceHeader>;

export default function WorkspaceHeaderLoader(props: WorkspaceHeaderLoaderProps) {
    return <WorkspaceHeader {...props} />;
}
