"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { resolveBackTarget, type BackTarget } from "@/lib/back-target";

// What the server renders, and what a shopper gets when there is nothing to go
// back to (shared link, new tab, editor preview).
const DEFAULT_TARGET: BackTarget = { href: "/collections", label: "Back to Collections" };

// Back link at the top of a collection page: leads to the page the shopper came
// from (home, the Collections list, the Shop...). The history only exists in the
// browser, so it is read after the page loads; until then the default shows.
export default function CollectionBackLink() {
    const pathname = usePathname();
    const [target, setTarget] = useState<BackTarget>(DEFAULT_TARGET);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- the history only exists in the browser, read after hydration
        setTarget(resolveBackTarget(window.location.pathname + window.location.search) ?? DEFAULT_TARGET);
    }, [pathname]);

    return (
        <Link
            href={target.href}
            className="flex items-center gap-2 text-sm font-semibold tracking-wide uppercase hover:text-gray-500 transition-colors mb-10"
        >
            <span className="material-symbols-outlined text-base">arrow_back</span> {target.label}
        </Link>
    );
}
