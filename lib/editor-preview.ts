// Client side: editor-only behaviour (navigation lock, click-to-select,
// postMessage drafts, placeholders) runs only inside a frame AND when the
// server verified this store's preview token - the layout then renders the
// marker element. ?editorPreview=1 alone no longer turns any of it on.
export const EDITOR_PREVIEW_MARKER_ID = "fype-editor-preview";
export const PREVIEW_TOKEN_PARAM = "previewToken";

function marker(): HTMLElement | null {
    if (typeof window === "undefined" || window.parent === window) return null;
    const el = document.getElementById(EDITOR_PREVIEW_MARKER_ID);
    return el?.dataset.verified === "1" ? el : null;
}

export function isEditorPreview(): boolean {
    return marker() !== null;
}

export function isEmbedPreview(): boolean {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("embedPreview") === "1";
}

/** The admin origins (EDITOR_ADMIN_ORIGINS) the server put on the marker; none outside a verified preview. */
export function editorAdminOrigins(): string[] {
    return (marker()?.dataset.adminOrigins ?? "").split(" ").filter(Boolean);
}

/** A message from the admin's customizer: our parent frame, at an allowed admin origin. */
export function isEditorMessage(event: MessageEvent): boolean {
    return typeof window !== "undefined" && event.source === window.parent && editorAdminOrigins().includes(event.origin);
}

/**
 * Posts to the parent customizer, never with "*": once per allowed admin
 * origin, and the browser delivers it only if that origin is the parent's.
 */
export function postToEditor(message: unknown): void {
    if (typeof window === "undefined" || window.parent === window) return;
    for (const origin of editorAdminOrigins()) window.parent.postMessage(message, origin);
}

/**
 * Removes ?previewToken= from the address (it's in the iframe's URL only for
 * the first request; the server has verified it by now). Uses the original
 * history.replaceState - EditorPreviewNavigationLock blocks URL changes.
 */
export function stripPreviewTokenFromUrl(replaceState: History["replaceState"] = window.history.replaceState.bind(window.history)): void {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(PREVIEW_TOKEN_PARAM)) return;
    url.searchParams.delete(PREVIEW_TOKEN_PARAM);
    replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}
