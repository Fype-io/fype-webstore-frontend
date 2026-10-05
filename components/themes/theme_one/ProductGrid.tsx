import Link from "next/link";
import { calculateProductTax } from "@/utils/taxCalculator";
import type { TaxSettings } from "@/types/storefront";
import { currencyPrefix } from "@/lib/currency";

export interface GridProduct {
    id: string;
    productId: string;
    name: string;
    price: number;
    maxPrice?: number;
    compareAtPrice?: number;
    hasVariants?: boolean;
    taxApplied?: boolean;
    taxRate?: number;
    hasDiscount?: boolean;
    discountPercentage?: number;
    imageUrl: string;
}

interface ProductGridProps {
    products: GridProduct[];
    title?: string;
    globalTax?: TaxSettings;
    /** The store's currency (server component: can't read the currency context). */
    currency?: string | null;
}

export default function ProductGrid({ products, title = "Fresh Drops", globalTax, currency }: ProductGridProps) {
    const prefix = currencyPrefix(currency);
    return (
        <section className="py-16 sm:py-24">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-center md:text-left mb-12">
                    {title}
                </h2>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 lg:gap-8">
                    {products.map((product) => {
                        const maxPrice = Number(product.maxPrice) || 0;
                        const price = Number(product.price) || 0;
                        const compareAtPrice = Number(product.compareAtPrice) || 0;
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
                            <Link
                                key={product.id || product.productId}
                                href={`/products/${product.productId}`}
                                className="flex flex-col gap-4 group cursor-pointer"
                            >
                                <div className="overflow-hidden rounded-lg">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={product.imageUrl}
                                        alt={product.name}
                                        loading="lazy"
                                        className="w-full aspect-square object-cover object-center group-hover:scale-105 transition-transform duration-300"
                                    />
                                </div>

                                <div>
                                    <h3 className="font-bold text-lg leading-snug">{product.name}</h3>

                                    <div className="flex items-center gap-2 mt-0.5">
                                        {hasDiscount && (
                                            <p className="text-gray-500 text-sm line-through">
                                                &#8377;{compareDisplayPrice}
                                            </p>
                                        )}
                                        <p className="text-black/80 font-medium flex items-baseline gap-1">
                                            <span>
                                                {product.hasVariants && price !== maxPrice
                                                    ? `${prefix}${displayPrice} - ${prefix}${maxDisplayPrice}`
                                                    : `${prefix}${displayPrice}`}
                                            </span>
                                        </p>
                                        {hasDiscount && (
                                            <span className="text-xs bg-black text-white px-2 py-1 rounded">
                                                {discountPercentage}% OFF
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
