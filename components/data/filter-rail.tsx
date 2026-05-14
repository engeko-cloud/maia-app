"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SearchIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildFilterHref, parseFilterParams } from "@/lib/filter-rail";

export interface FilterChip {
  /** URL value for the status param. Empty string = "all". */
  value: string;
  label: string;
  /** Tone: "urgent" uses accent-soft when active (e.g. Pendentes). */
  tone?: "default" | "urgent";
}

interface FilterRailProps {
  basePath: string;
  /** Status chips shown to the right of the search input. First chip should be "all". */
  chips: FilterChip[];
  /** Placeholder for the search input. */
  searchPlaceholder?: string;
}

function FilterRailInner({ basePath, chips, searchPlaceholder = "Buscar…" }: FilterRailProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = parseFilterParams(Object.fromEntries(searchParams.entries()));

  const [draftQ, setDraftQ] = React.useState(current.q);
  React.useEffect(() => { setDraftQ(current.q); }, [current.q]);

  function commit(patch: { q?: string; status?: string }) {
    router.push(buildFilterHref(basePath, current, patch));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    commit({ q: draftQ });
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <form onSubmit={onSubmit} className="relative w-full max-w-sm">
        <SearchIcon
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-fg-muted)]"
          aria-hidden="true"
        />
        <input
          type="search"
          value={draftQ}
          onChange={(e) => setDraftQ(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full rounded-md border border-[var(--color-border)] bg-white py-1.5 pl-9 pr-3 text-sm placeholder:text-[var(--color-fg-subtle)] focus:border-[var(--brand-primary-600)] focus:outline-none"
        />
      </form>
      <div role="tablist" aria-label="Filtro de situação" className="flex flex-wrap items-center gap-1.5">
        {chips.map((chip) => {
          const active = current.status === chip.value;
          const isUrgent = chip.tone === "urgent";
          return (
            <button
              key={chip.value || "__all"}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => commit({ status: chip.value })}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? isUrgent
                    ? "bg-[var(--color-accent-soft)] text-[var(--brand-accent-600)]"
                    : "bg-[var(--brand-primary-50)] text-[var(--brand-primary-600)]"
                  : "text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-muted)] hover:text-foreground",
              )}
            >
              {chip.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FilterRailFallback({ chips, searchPlaceholder = "Buscar…" }: Pick<FilterRailProps, "chips" | "searchPlaceholder">) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full max-w-sm">
        <SearchIcon
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-fg-muted)]"
          aria-hidden="true"
        />
        <input
          type="search"
          disabled
          placeholder={searchPlaceholder}
          className="w-full rounded-md border border-[var(--color-border)] bg-white py-1.5 pl-9 pr-3 text-sm placeholder:text-[var(--color-fg-subtle)]"
        />
      </div>
      <div role="tablist" aria-label="Filtro de situação" className="flex flex-wrap items-center gap-1.5">
        {chips.map((chip) => (
          <span
            key={chip.value || "__all"}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-[var(--color-fg-muted)]"
          >
            {chip.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function FilterRail(props: FilterRailProps) {
  return (
    <React.Suspense fallback={<FilterRailFallback chips={props.chips} searchPlaceholder={props.searchPlaceholder} />}>
      <FilterRailInner {...props} />
    </React.Suspense>
  );
}
