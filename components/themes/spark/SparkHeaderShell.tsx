"use client";

import { useEffect, useRef } from "react";
import Header from "./Header";
import type { SparkConfig } from "./sparkConfig";

interface SparkHeaderShellProps {
  config: SparkConfig;
  navItems: Array<{ label: string; href: string }>;
  shop: { shopId: string; shopName: string };
  isEditorPreview?: boolean;
  activeBlockId?: string | null;
  onAnnouncementClick?: (id: string) => void;
  onHeaderClick?: () => void;
  // Only true on home page when the first body section is image_banner
  heroOverlap?: boolean;
}

export default function SparkHeaderShell({
  config,
  navItems,
  shop,
  isEditorPreview = false,
  activeBlockId = null,
  onAnnouncementClick,
  onHeaderClick,
  heroOverlap = false,
}: SparkHeaderShellProps) {
  const { header, announcement_bar: announcementBar } = config.sections;
  const rootRef = useRef<HTMLDivElement>(null);

  // When the header floats over the hero, publish its height so the hero can
  // keep top-aligned content clear of it (see BannerSlider).
  useEffect(() => {
    const el = rootRef.current;
    if (!heroOverlap || !el) return;
    const publish = () => document.documentElement.style.setProperty("--spark-header-h", `${el.offsetHeight}px`);
    publish();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(publish) : null;
    observer?.observe(el);
    return () => {
      observer?.disconnect();
      document.documentElement.style.removeProperty("--spark-header-h");
    };
  }, [heroOverlap, header.hidden]);

  const { logo: logoSettings } = config.theme_settings;

  if (header.hidden) return null;

  const visibleAnnouncementBlocks = announcementBar.settings.show
    ? announcementBar.settings.blocks.filter((b) => !b.hidden)
    : [];

  const sectionProps = isEditorPreview
    ? {
        className: "relative group cursor-pointer",
        onClickCapture: (e: React.MouseEvent) => {
          e.preventDefault();
          onHeaderClick?.();
        },
      }
    : { className: "relative" };

  const className = heroOverlap
    ? `fixed inset-x-0 top-0 z-40${isEditorPreview ? " group cursor-pointer" : ""}`
    : header.settings.sticky_header
      ? `sticky top-0 z-40${isEditorPreview ? " group cursor-pointer" : ""}`
      : sectionProps.className;

  return (
    <div id="spark-section-header" ref={rootRef} {...sectionProps} className={className}>
      {isEditorPreview && (
        <div
          className={`absolute inset-0 z-100 pointer-events-none transition-colors ${
            activeBlockId ? "ring-2 ring-inset ring-blue-500" : "ring-0 group-hover:ring-1 group-hover:ring-inset group-hover:ring-blue-400"
          }`}
        >
          <span
            className={`absolute top-full left-0 mt-1 bg-blue-500 text-white text-[11px] font-medium px-2 py-0.5 transition-opacity ${
              activeBlockId ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            }`}
          >
            Header
          </span>
        </div>
      )}
      <Header
        header={header.settings}
        navItems={navItems}
        announcementBlocks={visibleAnnouncementBlocks}
        logoUrl={logoSettings.logo_url}
        logoWidth={logoSettings.logo_width}
        isEditorPreview={isEditorPreview}
        activeAnnouncementId={activeBlockId}
        onAnnouncementClick={onAnnouncementClick}
        heroOverlap={heroOverlap}
      />
    </div>
  );
}
