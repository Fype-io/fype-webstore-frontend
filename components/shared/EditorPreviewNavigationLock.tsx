"use client";

import { useEffect } from "react";

import { isEditorPreview, isEmbedPreview, stripPreviewTokenFromUrl } from "@/lib/editor-preview";

function destinationChangesPage(url: string | URL | null | undefined): boolean {
    if (url == null || url === "") return false;
    try {
        const next = new URL(String(url), window.location.href);
        return next.pathname !== window.location.pathname || next.search !== window.location.search;
    } catch {
        return true;
    }
}

function isAnchorNavigation(event: MouseEvent): boolean {
    if (event.button !== 0) return false;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
    const target = event.target;
    if (!(target instanceof Element)) return false;
    const link = target.closest("a");
    if (!link) return false;
    if (link.hasAttribute("download")) return true;
    const href = link.getAttribute("href");
    if (href == null || href === "") return false;
    if (href.startsWith("mailto:") || href.startsWith("tel:")) return true;
    return destinationChangesPage(link.href);
}

export default function EditorPreviewNavigationLock() {
    useEffect(() => {
        // The server has checked the token by now; take it out of the address
        // before anything (history, a copied URL) can pick it up.
        stripPreviewTokenFromUrl();
        if (!isEditorPreview()) return;

        const html = document.documentElement;
        const body = document.body;
        const prevHtmlOverflow = html.style.overflow;
        const prevBodyOverflow = body.style.overflow;
        if (isEmbedPreview()) {
            html.style.overflow = "hidden";
            body.style.overflow = "hidden";
        }

        const onClick = (event: MouseEvent) => {
            if (!isAnchorNavigation(event)) return;
            event.preventDefault();
        };

        const onSubmit = (event: Event) => {
            event.preventDefault();
        };

        const onPopState = () => {
            window.history.pushState(null, "", `${window.location.pathname}${window.location.search}`);
        };

        const navigation = (window as Window & { navigation?: EventTarget }).navigation;
        const onNavigate = (event: Event) => {
            event.preventDefault();
        };

        const pushState = history.pushState.bind(history);
        const replaceState = history.replaceState.bind(history);
        history.pushState = function (data, unused, url) {
            if (destinationChangesPage(url)) return;
            return pushState(data, unused, url);
        };
        history.replaceState = function (data, unused, url) {
            if (destinationChangesPage(url)) return;
            return replaceState(data, unused, url);
        };

        const open = window.open.bind(window);
        window.open = function () {
            return null;
        };

        document.addEventListener("click", onClick, true);
        document.addEventListener("submit", onSubmit, true);
        window.addEventListener("popstate", onPopState);
        navigation?.addEventListener("navigate", onNavigate);

        return () => {
            document.removeEventListener("click", onClick, true);
            document.removeEventListener("submit", onSubmit, true);
            window.removeEventListener("popstate", onPopState);
            navigation?.removeEventListener("navigate", onNavigate);
            history.pushState = pushState;
            history.replaceState = replaceState;
            window.open = open;
            html.style.overflow = prevHtmlOverflow;
            body.style.overflow = prevBodyOverflow;
        };
    }, []);

    return null;
}
