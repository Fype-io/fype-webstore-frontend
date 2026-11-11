/**
 * Which backend error messages a shopper may see. The backend (crmApp) writes its own messages with a `code` (a
 * CustomError); anything else - a server fault, a raw driver/courier/gateway error, a network failure - gets the
 * screen's own fallback text, so nothing technical ever shows on the storefront.
 *
 * - 4xx with a code: our message for something the shopper can fix ("Only 2 left in stock", "Invalid OTP").
 * - 429 without a code (the backend's global rate limiter): a friendly "too many requests".
 * - 5xx: only for codes whose message we wrote for shoppers (OTP_SEND_FAILED: "Too many attempts. Please try again
 *   later." - AuthModal reads that text to start its cooldown).
 * - INTERNAL_ERROR is the backend's own generic text for a hidden raw error: the screen's fallback says it better.
 */

export const TOO_MANY_REQUESTS_MESSAGE = "Too many requests. Please wait a moment and try again.";

/** 5xx codes whose message is written for shoppers. */
const SHOPPER_5XX_CODES = new Set(["OTP_SEND_FAILED"]);

export function shopperErrorMessage(status: number | undefined, body: unknown, fallback: string): string {
    const { code, message } = (body && typeof body === "object" ? body : {}) as { code?: unknown; message?: unknown };
    const text = typeof message === "string" ? message.trim() : "";
    const ownCode = typeof code === "string" && code !== "" && code !== "INTERNAL_ERROR" ? code : null;

    if (!status) return fallback;
    if (status === 429 && !ownCode) return TOO_MANY_REQUESTS_MESSAGE;
    if (!text || !ownCode) return fallback;
    if (status >= 400 && status < 500) return text;
    if (status >= 500 && SHOPPER_5XX_CODES.has(ownCode)) return text;
    return fallback;
}
