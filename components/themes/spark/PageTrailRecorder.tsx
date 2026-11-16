"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { recordPage } from "@/lib/back-target";

// Renders nothing. Notes each page the shopper visits (see lib/back-target.ts)
// so a collection page's Back link can lead to where they came from.
export default function PageTrailRecorder() {
    const pathname = usePathname();
    const search = useSearchParams()?.toString() ?? "";

    useEffect(() => {
        recordPage(search ? `${pathname}?${search}` : pathname);
    }, [pathname, search]);

    return null;
}
