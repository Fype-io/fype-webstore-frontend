// Pure helper for the OTP boxes in AuthModal: what a paste (or an autofill that drops the whole
// code into one box) does to the four digit boxes.

export const OTP_LENGTH = 4;

export interface OtpFill {
    /** The four boxes after the paste. */
    next: string[];
    /** Box to focus afterwards (the one after the last digit that landed, or the last box). */
    focusIndex: number;
    /** True when all four boxes are filled, so the code can be verified straight away. */
    complete: boolean;
}

/**
 * Spreads pasted text over the boxes. Only digits are kept ("12 34", "1-2-3-4" and "Your code is 1234"
 * all work). A full code always starts at the first box wherever the paste landed; a partial one fills
 * from the box it was pasted into. Returns null when the text has no digits (nothing changes).
 */
export function fillOtp(current: string[], index: number, text: string): OtpFill | null {
    const digits = text.replace(/\D/g, "");
    if (digits === "") return null;

    const start = digits.length >= OTP_LENGTH ? 0 : Math.min(index, OTP_LENGTH - 1);
    const next = [...current];
    let last = start - 1;
    for (let i = 0; i < digits.length && start + i < OTP_LENGTH; i++) {
        next[start + i] = digits[i];
        last = start + i;
    }
    return {
        next,
        focusIndex: Math.min(last + 1, OTP_LENGTH - 1),
        complete: next.every((d) => d !== ""),
    };
}
