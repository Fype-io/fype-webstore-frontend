"use client";

import { useEffect, useState } from "react";

// Phones get a slide's portrait image — max-width 767px is everything below Tailwind's `md`, the breakpoint the rest
// of Spark switches layout at. The editor's mobile preview is a 390px iframe, so it matches too.
export const MOBILE_IMAGE_MEDIA = "(max-width: 767px)";

// srcset splits candidates on whitespace, so a URL with a raw space would be cut short there (unlike `src`, which
// takes it whole).
export const toSrcSetUrl = (url: string) => url.replace(/\s/g, encodeURIComponent);

// How many times the viewport has crossed MOBILE_IMAGE_MEDIA since mount — 0 on the server and at hydration, so it
// never causes a mismatch. Used to remount the <picture>: when its source starts or stops matching in place (the
// editor's device toggle resizes the preview iframe without reloading it), Chrome keeps painting the old image until
// the new one has fully downloaded — seconds of the desktop image on a phone-sized screen. A fresh <picture> picks
// the right image from the start instead.
export function useMobileMediaFlips() {
    const [flips, setFlips] = useState(0);
    useEffect(() => {
        if (typeof window.matchMedia !== "function") return;
        const query = window.matchMedia(MOBILE_IMAGE_MEDIA);
        const onChange = () => setFlips((n) => n + 1);
        query.addEventListener("change", onChange);
        return () => query.removeEventListener("change", onChange);
    }, []);
    return flips;
}
