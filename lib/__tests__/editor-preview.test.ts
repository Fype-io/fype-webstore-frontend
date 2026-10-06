import { describe, it, expect, afterEach, vi } from "vitest";
import { EDITOR_PREVIEW_MARKER_ID, editorAdminOrigins, isEditorMessage, isEditorPreview, postToEditor, stripPreviewTokenFromUrl } from "../editor-preview";

function addMarker(adminOrigins = "http://localhost:3000") {
    const marker = document.createElement("span");
    marker.id = EDITOR_PREVIEW_MARKER_ID;
    marker.dataset.verified = "1";
    marker.dataset.adminOrigins = adminOrigins;
    document.body.appendChild(marker);
}

const fakeParent = { postMessage: vi.fn() };
const inFrame = () => vi.spyOn(window, "parent", "get").mockReturnValue(fakeParent as unknown as Window);
const fromParent = (origin: string, source: unknown = fakeParent) =>
    new MessageEvent("message", { origin, data: { type: "X" }, source: source as MessageEventSource });

describe("isEditorPreview (client)", () => {
    afterEach(() => {
        fakeParent.postMessage.mockReset();
        document.body.innerHTML = "";
        window.history.replaceState(null, "", "/");
        vi.restoreAllMocks();
    });

    it("is true in a frame when the server rendered the verified marker", () => {
        addMarker();
        inFrame();
        expect(isEditorPreview()).toBe(true);
    });

    it("is false for ?editorPreview=1 without the marker", () => {
        window.history.replaceState(null, "", "/?editorPreview=1");
        inFrame();
        expect(isEditorPreview()).toBe(false);
    });

    it("is false outside a frame, even with the marker", () => {
        addMarker();
        expect(isEditorPreview()).toBe(false);
    });

    describe("editor messages", () => {
        it("accepts a message from the parent at an allowed admin origin only", () => {
            addMarker("http://localhost:3000 https://admin.example.com");
            inFrame();
            expect(isEditorMessage(fromParent("http://localhost:3000"))).toBe(true);
            expect(isEditorMessage(fromParent("https://admin.example.com"))).toBe(true);
            expect(isEditorMessage(fromParent("https://evil.example"))).toBe(false);
            expect(isEditorMessage(fromParent("http://localhost:3000", {}))).toBe(false);
        });

        it("accepts nothing without a verified marker", () => {
            inFrame();
            expect(editorAdminOrigins()).toEqual([]);
            expect(isEditorMessage(fromParent("http://localhost:3000"))).toBe(false);
        });

        it("accepts nothing when no admin origin is configured", () => {
            addMarker("");
            inFrame();
            expect(isEditorMessage(fromParent("http://localhost:3000"))).toBe(false);
        });

        it('posts to each allowed admin origin, never "*"', () => {
            addMarker("http://localhost:3000 https://admin.example.com");
            inFrame();
            postToEditor({ type: "X" });
            expect(fakeParent.postMessage.mock.calls).toEqual([
                [{ type: "X" }, "http://localhost:3000"],
                [{ type: "X" }, "https://admin.example.com"],
            ]);
        });

        it("posts nothing outside a verified preview", () => {
            inFrame();
            postToEditor({ type: "X" });
            expect(fakeParent.postMessage).not.toHaveBeenCalled();
        });
    });

    describe("stripPreviewTokenFromUrl", () => {
        it("removes only previewToken from the address, keeping the rest and the history state", () => {
            window.history.replaceState({ keep: 1 }, "", "/products?previewToken=tok&editorPreview=1&embedPreview=1#top");
            stripPreviewTokenFromUrl();
            expect(`${window.location.pathname}${window.location.search}${window.location.hash}`).toBe(
                "/products?editorPreview=1&embedPreview=1#top"
            );
            expect(window.history.state).toEqual({ keep: 1 });
        });

        it("leaves a URL without a token alone", () => {
            window.history.replaceState(null, "", "/?a=1");
            const replaceState = vi.fn();
            stripPreviewTokenFromUrl(replaceState);
            expect(replaceState).not.toHaveBeenCalled();
        });
    });
});
