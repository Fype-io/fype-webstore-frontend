import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import SparkCollections from "../SparkCollections";
import { sparkDefaultConfig } from "../sparkConfig";
import type { CollectionTile, ShopIdentity } from "@/types/storefront";

vi.mock("@/lib/client-api", () => ({ getApi: vi.fn() }));
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
    usePathname: () => "/collections",
    useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/themes/spark/Header", () => ({ default: () => <div /> }));
vi.mock("@/components/themes/spark/SparkHeaderShell", () => ({ default: () => <div /> }));
vi.mock("@/components/themes/spark/sections/Footer", () => ({ default: () => <div /> }));

const shop = { shopId: "s1", shopName: "YB" } as unknown as ShopIdentity;
const tiles: CollectionTile[] = [
    { kind: "collection", _id: "c1", name: "Daily Wear", slug: "daily-wear", thumbnailUrl: "https://cdn.example.com/daily.png" },
    { kind: "group", _id: "g1", name: "Shop by Occasion", slug: "shop-by-occasion", thumbnailUrl: "https://cdn.example.com/occasion.png" },
];

describe("Collections page tile shape", () => {
    it("draws every tile image in a square, so a 1:1 thumbnail is shown whole (same shape as the homepage tile)", () => {
        render(<SparkCollections initialConfig={sparkDefaultConfig} shop={shop} navItems={[]} collections={tiles} />);

        for (const name of ["Daily Wear", "Shop by Occasion"]) {
            const frame = screen.getByAltText(name).parentElement as HTMLElement;
            expect(frame.className).toContain("aspect-square");
            expect(frame.className).not.toContain("aspect-[4/3]");
        }
    });
});
