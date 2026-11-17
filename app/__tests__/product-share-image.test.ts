import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";

// /products/[slug]/share-image: the product's primary image as a 1200x630 JPEG for link previews
// (WhatsApp, Facebook, X...). Only ever the primary image of a product of the store on this host.
//
// Applicability:
//   1. Input validation - covered: unknown store/product, no image, non-http image -> 404.
//   2. Tenant scoping - covered: the product is looked up in the store resolved from the request host.
//   3. Open proxy - covered: the only URL fetched is the product's own images[0].
//   4. Failure paths - covered: original unreachable -> 404; conversion fails -> redirect to the original.
//   5. Caching - covered: a cached conversion is returned without fetching or converting again.

vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: vi.fn() }));
vi.mock("@/lib/storefront-api", () => ({
    getApiBaseUrl: vi.fn().mockResolvedValue("https://api.example.com"),
    getShopByDomain: vi.fn(),
    getProductDetails: vi.fn(),
}));

import { headers } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getShopByDomain, getProductDetails } from "@/lib/storefront-api";
import { GET } from "../(storefront)/products/[slug]/share-image/route";

const IMAGE = "https://bucket.s3.amazonaws.com/shop-1/shirt.webp";

let transform: Mock;
let output: Mock;
let input: Mock;
let fetchMock: Mock;
let cacheStore: Map<string, Response>;

function setup(opts: { images?: string[]; product?: boolean; shop?: boolean; convertFails?: boolean; originalStatus?: number } = {}) {
    (headers as Mock).mockResolvedValue({ get: (key: string) => (key === "host" ? "shop.example.com" : null) });
    (getShopByDomain as Mock).mockResolvedValue(opts.shop === false ? null : { shopId: "shop-1", shopName: "Shop" });
    (getProductDetails as Mock).mockResolvedValue({
        product: opts.product === false ? null : { productId: "PROD-1", slug: "blue-shirt", name: "Blue Shirt", images: opts.images ?? [IMAGE, "https://x/2.jpg"] },
    });

    fetchMock = vi.fn().mockResolvedValue(new Response("original-bytes", { status: opts.originalStatus ?? 200 }));
    vi.stubGlobal("fetch", fetchMock);

    output = vi.fn().mockImplementation(async () => {
        if (opts.convertFails) throw new Error("ERROR 9412: not an image");
        return { image: () => new Response("jpeg-bytes").body };
    });
    transform = vi.fn().mockReturnValue({ output });
    input = vi.fn().mockReturnValue({ transform });
    (getCloudflareContext as Mock).mockResolvedValue({ env: { IMAGES: { input } } });

    cacheStore = new Map();
    vi.stubGlobal("caches", {
        default: {
            match: vi.fn(async (req: Request) => cacheStore.get(req.url)?.clone()),
            put: vi.fn(async (req: Request, res: Response) => void cacheStore.set(req.url, res)),
        },
    });
}

const get = (slug = "blue-shirt") => GET(new Request(`http://shop.example.com/products/${slug}/share-image`), { params: Promise.resolve({ slug }) });

describe("product share image", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, "warn").mockImplementation(() => {});
    });
    afterEach(() => vi.unstubAllGlobals());

    it("converts the primary image into a padded 1200x630 JPEG, cacheable", async () => {
        setup();
        const res = await get();
        expect(res.status).toBe(200);
        expect(res.headers.get("Content-Type")).toBe("image/jpeg");
        expect(res.headers.get("Cache-Control")).toBe("public, max-age=86400");
        expect(await res.text()).toBe("jpeg-bytes");

        expect(getProductDetails).toHaveBeenCalledWith("https://api.example.com", "shop-1", "blue-shirt");
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith(IMAGE);
        expect(transform).toHaveBeenCalledWith({ width: 1200, height: 630, fit: "pad", background: "#FFFFFF" });
        expect(output).toHaveBeenCalledWith(expect.objectContaining({ format: "image/jpeg" }));
    });

    it("returns the cached conversion without fetching or converting again", async () => {
        setup();
        await get();
        fetchMock.mockClear();
        input.mockClear();

        const res = await get();
        expect(res.status).toBe(200);
        expect(await res.text()).toBe("jpeg-bytes");
        expect(fetchMock).not.toHaveBeenCalled();
        expect(input).not.toHaveBeenCalled();
    });

    it("is 404 for an unknown store, an unknown product, or a product with no image", async () => {
        setup({ shop: false });
        expect((await get()).status).toBe(404);
        setup({ product: false });
        expect((await get()).status).toBe(404);
        setup({ images: [] });
        expect((await get()).status).toBe(404);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("never fetches an image that isn't an http(s) URL", async () => {
        setup({ images: ["javascript:alert(1)"] });
        expect((await get()).status).toBe(404);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("is 404 when the original image can't be fetched", async () => {
        setup({ originalStatus: 403 });
        expect((await get()).status).toBe(404);
        expect(input).not.toHaveBeenCalled();
    });

    it("redirects to the original when the Worker has no IMAGES binding", async () => {
        setup();
        (getCloudflareContext as Mock).mockResolvedValue({ env: {} });
        const res = await get();
        expect(res.status).toBe(302);
        expect(res.headers.get("Location")).toBe(IMAGE);
    });

    it("redirects to the original when the image can't be converted (an SVG, say), and logs it", async () => {
        setup({ convertFails: true });
        const res = await get();
        expect(res.status).toBe(302);
        expect(res.headers.get("Location")).toBe(IMAGE);
        expect(cacheStore.size).toBe(0);
        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("[share-image] conversion failed store=shop-1 product=PROD-1"));
    });
});
