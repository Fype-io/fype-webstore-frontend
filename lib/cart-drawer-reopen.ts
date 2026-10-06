// Checkout is headless (no theme, so no cart drawer), so its Back button
// can't open the drawer itself. It leaves a one-shot flag in sessionStorage
// and the theme's cart shell opens the drawer when the storefront next
// renders. The flag expires quickly so it can't open the drawer on some
// unrelated later visit.
const REOPEN_CART_DRAWER_KEY = "sf:reopen-cart-drawer";
const REOPEN_CART_DRAWER_TTL_MS = 10_000;

export function requestCartDrawerReopen(): void {
    try {
        sessionStorage.setItem(REOPEN_CART_DRAWER_KEY, String(Date.now()));
    } catch {
        // Storage blocked (private mode etc.) - the drawer just stays closed.
    }
}

export function consumeCartDrawerReopen(): boolean {
    try {
        const requestedAt = Number(sessionStorage.getItem(REOPEN_CART_DRAWER_KEY));
        if (!requestedAt) return false;
        sessionStorage.removeItem(REOPEN_CART_DRAWER_KEY);
        return Date.now() - requestedAt < REOPEN_CART_DRAWER_TTL_MS;
    } catch {
        return false;
    }
}
