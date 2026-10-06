import axios from "axios";
import { getApiErrorMessage } from "@/lib/client-api";

// Order-creation errors that mean the store's payment options changed after
// checkout loaded (crmApp codSetting.service.ts): the options shown are stale,
// so tell the customer to refresh rather than show a bare "not available".
// COD_MIN_ORDER_NOT_MET keeps the backend's message - it carries the amount.
const STALE_PAYMENT_OPTIONS =
    "This store's payment options have changed. Please refresh the page to see how you can pay.";

const ORDER_ERROR_MESSAGES: Record<string, string> = {
    COD_REQUIRES_LOGISTICS: `Cash on delivery isn't available for this store. ${STALE_PAYMENT_OPTIONS}`,
    COD_NOT_AVAILABLE: `Cash on delivery isn't available for this store. ${STALE_PAYMENT_OPTIONS}`,
    ORDER_NOW_NOT_AVAILABLE: STALE_PAYMENT_OPTIONS,
};

/** A customer-readable message for a failed order creation. */
export function orderErrorMessage(error: unknown, fallback: string): string {
    if (axios.isAxiosError(error)) {
        const code = (error.response?.data as { code?: string } | undefined)?.code;
        if (code && ORDER_ERROR_MESSAGES[code]) return ORDER_ERROR_MESSAGES[code];
    }
    return getApiErrorMessage(error, fallback);
}
