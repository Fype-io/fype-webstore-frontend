/**
 * Order numbers come from the store's order settings and start with "#" by
 * default (#1000). Put into a URL as-is, "#" starts the fragment: /orders/#1000
 * opens /orders, and /commerce/<store>/orders/#1000/track requests /orders/.
 * Every order number that goes into a path goes through orderSegment().
 */
export function orderSegment(orderNumber: string): string {
    return encodeURIComponent(orderNumber);
}

export interface OrderLinkTarget {
    orderId?: string | null;
    orderNumber: string;
}

/**
 * The storefront's order detail page: /orders/<orderId>. The id is a UUID, so the
 * URL stays clean (no %23) whatever prefix the store gives its order numbers. The
 * API and the detail page also accept the order number, used if the id is missing.
 */
export function orderHref(order: OrderLinkTarget): string {
    return `/orders/${orderSegment(order.orderId || order.orderNumber)}`;
}

/**
 * The App Router hands a page its dynamic params still percent-encoded, so the
 * [orderId] page gets "%231000" for #1000. A malformed escape (a stray "%" in a
 * hand-typed URL) is returned unchanged rather than throwing.
 */
export function decodeOrderParam(param: string): string {
    try {
        return decodeURIComponent(param);
    } catch {
        return param;
    }
}
