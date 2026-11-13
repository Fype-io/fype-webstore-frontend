import { describe, it, expect } from "vitest";
import { countryName } from "../AddressList";

describe("saved address country", () => {
    it("shows a country code as its name", () => {
        expect(countryName("IN")).toBe("India");
        expect(countryName("ae")).toBe("United Arab Emirates");
    });

    it("leaves a country that is already a name, or empty, as saved", () => {
        expect(countryName("India")).toBe("India");
        expect(countryName(undefined)).toBe("");
    });
});
