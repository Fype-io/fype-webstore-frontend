"use client";

import { useEffect, useRef, useState } from "react";
import { Provider } from "react-redux";
import { makeStore } from "@/redux/store";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { setCurrentStoreId } from "@/lib/client-store-context";
import { isSignedOutSession, getAuthToken } from "@/lib/client-api";
import { fetchUserProfile, fetchCart, fetchGuestCart, fetchWishlist, markAuthChecked } from "@/redux/slices/userSlice";
import { isEditorPreview } from "@/lib/editor-preview";
import { StoreCurrencyProvider } from "./StoreCurrency";

function AuthBootstrap({ storeId }: { storeId: string }) {
    const dispatch = useAppDispatch();

    useEffect(() => {
        (async () => {
            if (isEditorPreview()) {
                dispatch(markAuthChecked());
                return;
            }
            if (isSignedOutSession() || !getAuthToken()) {
                dispatch(markAuthChecked());
                dispatch(fetchGuestCart({ storeId }));
                return;
            }
            const profileResult = await dispatch(fetchUserProfile({ storeId }));
            if (fetchUserProfile.fulfilled.match(profileResult)) {
                dispatch(fetchCart({ storeId }));
                dispatch(fetchWishlist({ storeId }));
            } else {
                dispatch(fetchGuestCart({ storeId }));
            }
        })();
    }, [dispatch, storeId]);

    return null;
}

// AuthBootstrap only runs once on mount. After OTP login the shopper is
// already past that, so cart/wishlist from the account would stay stale
// until the next add-to-cart. Hydrate whenever auth flips to signed-in
// after the initial bootstrap.
function CustomerSessionHydrate({ storeId }: { storeId: string }) {
    const dispatch = useAppDispatch();
    const { isAuthenticated, authChecked } = useAppSelector((state) => state.user);
    const skipInitial = useRef(true);

    useEffect(() => {
        if (!authChecked) return;
        if (skipInitial.current) {
            skipInitial.current = false;
            return;
        }
        if (isEditorPreview()) return;
        if (isAuthenticated) {
            dispatch(fetchCart({ storeId }));
            dispatch(fetchWishlist({ storeId }));
        }
    }, [authChecked, isAuthenticated, dispatch, storeId]);

    return null;
}

interface ProvidersProps {
    storeId?: string;
    /** The store's currency (public settings `currency`); prices show in it. */
    currency?: string | null;
    children: React.ReactNode;
}

export default function Providers({ storeId, currency, children }: ProvidersProps) {
    const [store] = useState(() => makeStore());

    useEffect(() => {
        setCurrentStoreId(storeId ?? null);
    }, [storeId]);

    return (
        <Provider store={store}>
            {storeId && <AuthBootstrap storeId={storeId} />}
            {storeId && <CustomerSessionHydrate storeId={storeId} />}
            <StoreCurrencyProvider currency={currency}>{children}</StoreCurrencyProvider>
        </Provider>
    );
}
