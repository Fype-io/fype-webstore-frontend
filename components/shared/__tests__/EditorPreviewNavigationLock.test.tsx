import { describe, it, expect, afterEach, vi } from "vitest";
import { render } from "@testing-library/react";
import EditorPreviewNavigationLock from "../EditorPreviewNavigationLock";
import { EDITOR_PREVIEW_MARKER_ID } from "@/lib/editor-preview";

const address = () => `${window.location.pathname}${window.location.search}`;

describe("EditorPreviewNavigationLock", () => {
    afterEach(() => {
        document.body.innerHTML = "";
        vi.restoreAllMocks();
    });

    it("takes the preview token out of the address in a verified preview, then locks URL changes", () => {
        window.history.replaceState(null, "", "/products?previewToken=tok&editorPreview=1");
        const marker = document.createElement("span");
        marker.id = EDITOR_PREVIEW_MARKER_ID;
        marker.dataset.verified = "1";
        document.body.appendChild(marker);
        vi.spyOn(window, "parent", "get").mockReturnValue({} as Window);

        const { unmount } = render(<EditorPreviewNavigationLock />);

        expect(address()).toBe("/products?editorPreview=1");
        // The lock is on: a page change through history is ignored.
        window.history.pushState(null, "", "/elsewhere");
        expect(address()).toBe("/products?editorPreview=1");
        unmount();
        window.history.replaceState(null, "", "/");
    });

    it("takes a (rejected) token out of the address outside a verified preview too", () => {
        window.history.replaceState(null, "", "/?previewToken=bad");

        const { unmount } = render(<EditorPreviewNavigationLock />);

        expect(address()).toBe("/");
        unmount();
    });
});
