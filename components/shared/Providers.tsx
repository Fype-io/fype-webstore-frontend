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
import CompleteProfileModal from "./CompleteProfileModal";

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

// A signed-in shopper with no name on their account is asked for one on every
// page until they add it or sign out (CompleteProfileModal). Based on the profile
// loaded above, so it also catches accounts made before sign-in required a name.
function CompleteProfilePrompt({ storeId }: { storeId: string }) {
    const { user, isAuthenticated, authChecked } = useAppSelector((state) => state.user);
    if (!authChecked || !isAuthenticated || !user || (user.firstName || "").trim()) return null;
    if (isEditorPreview()) return null;
    return <CompleteProfileModal key={user.customerId} storeId={storeId} user={user} />;
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
            {storeId && <CompleteProfilePrompt storeId={storeId} />}
        </Provider>
    );
}
