import Link from "next/link";
import WishlistButton from "./WishlistButton";
import { calculateProductTax } from "@/utils/taxCalculator";
import type { StorefrontProduct, TaxSettings } from "@/types/storefront";
import { currencyPrefix } from "@/lib/currency";

const DEFAULT_PRODUCT_IMAGE =
    "https://i0.wp.com/mikeyarce.com/wp-content/uploads/2021/09/woocommerce-placeholder.png?ssl=1";

interface ProductCardProps {
    product: StorefrontProduct;
    globalTax?: TaxSettings;
    shopName?: string;
    storeId?: string;
    /** The store's currency (server component: can't read the currency context). */
    currency?: string | null;
}

export default function ProductCard({ product, globalTax, shopName, storeId, currency }: ProductCardProps) {
    const prefix = currencyPrefix(currency);
    const productImage = product.image || DEFAULT_PRODUCT_IMAGE;

    const price = Number(product.price) || 0;
    const compareAtPrice = Number(product.compareAtPrice) || 0;
    const maxPrice = Number(product.maxPrice) || 0;
    const hasDiscount = product.hasDiscount ?? false;
    const discountPercentage = product.discountPercentage ?? 0;

    const { displayPrice } = calculateProductTax(price, globalTax, {
        applied: product.taxApplied,
        rate: product.taxRate,
    });
    const { displayPrice: maxDisplayPrice } = calculateProductTax(maxPrice, globalTax, {
        applied: product.taxApplied,
        rate: product.taxRate,
    });
    const { displayPrice: compareDisplayPrice } = calculateProductTax(compareAtPrice, globalTax, {
        applied: product.taxApplied,
        rate: product.taxRate,
    });

    return (
        <div className="flex flex-col gap-3 group relative">
            <WishlistButton productId={product.productId} storeId={storeId} shopName={shopName} />

            <Link href={`/products/${product.productId}`}>
                <div
                    className="w-full bg-center bg-no-repeat aspect-square bg-cover rounded-lg overflow-hidden transition-transform duration-300 group-hover:scale-105 cursor-pointer"
                    style={{ backgroundImage: `url("${productImage}")` }}
                    aria-label={product.name}
                />

                <div className="flex flex-col gap-1 mt-3">
                    <p className="text-sm font-medium text-gray-900 truncate" title={product.name}>
                        {product.name}
                    </p>
                    <div className="flex items-center gap-2">
                        {hasDiscount && <p className="text-gray-500 text-sm line-through">{prefix}{compareDisplayPrice}</p>}
                        <p className="text-sm font-bold text-black flex items-baseline gap-1">
                            <span>
                                {product.hasVariants && price !== maxPrice
                                    ? `${prefix}${displayPrice} – ${prefix}${maxDisplayPrice}`
                                    : `${prefix}${displayPrice}`}
                            </span>
                        </p>
                        {hasDiscount && (
                            <span className="text-xs bg-black text-white px-2 py-1 rounded">{discountPercentage}% OFF</span>
                        )}
                    </div>
                </div>
            </Link>
        </div>
    );
}
