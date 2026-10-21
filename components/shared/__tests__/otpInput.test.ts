import { describe, it, expect } from "vitest";
import { fillOtp } from "../otpInput";

const empty = ["", "", "", ""];

describe("fillOtp", () => {
    it("spreads a pasted full code over the four boxes and says it is complete", () => {
        expect(fillOtp(empty, 0, "1234")).toEqual({ next: ["1", "2", "3", "4"], focusIndex: 3, complete: true });
    });

    it("starts at the first box even when the code is pasted into a later one", () => {
        expect(fillOtp(["9", "9", "", ""], 2, "5678")).toMatchObject({ next: ["5", "6", "7", "8"], complete: true });
    });

    it("keeps only the digits (spaces, dashes, words)", () => {
        expect(fillOtp(empty, 0, "12 34")?.next).toEqual(["1", "2", "3", "4"]);
        expect(fillOtp(empty, 0, "1-2-3-4")?.next).toEqual(["1", "2", "3", "4"]);
        expect(fillOtp(empty, 0, "Your code is 4821.")?.next).toEqual(["4", "8", "2", "1"]);
        expect(fillOtp(empty, 0, " 1234\n")?.next).toEqual(["1", "2", "3", "4"]);
    });

    it("ignores digits beyond the fourth", () => {
        expect(fillOtp(empty, 0, "123456")).toMatchObject({ next: ["1", "2", "3", "4"], complete: true });
    });

    it("fills a partial paste from the box it landed in and moves on to the next empty one", () => {
        expect(fillOtp(empty, 1, "78")).toEqual({ next: ["", "7", "8", ""], focusIndex: 3, complete: false });
        expect(fillOtp(["1", "", "", ""], 1, "2")).toEqual({ next: ["1", "2", "", ""], focusIndex: 2, complete: false });
    });

    it("does not run past the last box", () => {
        expect(fillOtp(["1", "2", "3", ""], 3, "99")?.next).toEqual(["1", "2", "3", "9"]);
    });

    it("does nothing when the text has no digits", () => {
        expect(fillOtp(empty, 0, "abc")).toBeNull();
        expect(fillOtp(empty, 0, "")).toBeNull();
    });
});
