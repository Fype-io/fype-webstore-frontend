import { Suspense } from "react";
import "./spark.css";
import SparkCartShell from "./SparkCartShell";
import PageTrailRecorder from "./PageTrailRecorder";

interface LayoutProps {
    shopName?: string;
    storeId?: string;
    children: React.ReactNode;
}

// Cart drawer + header count badge live here so every Spark page shares
// the same add-to-cart behavior as Fype-E-Commerce-UI SparkTheme.
export default function Layout({ storeId, children }: LayoutProps) {
    return (
        <div className="spark-theme-root">
            {/* Own Suspense boundary so reading the query string can't hold back the page. */}
            <Suspense fallback={null}>
                <PageTrailRecorder />
            </Suspense>
            <SparkCartShell storeId={storeId}>{children}</SparkCartShell>
        </div>
    );
}
