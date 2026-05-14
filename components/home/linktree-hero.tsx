import { ActivityIcon } from "lucide-react";

interface LinktreeHeroProps {
  greeting: string;
  lead: string;
}

export function LinktreeHero({ greeting, lead }: LinktreeHeroProps) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {greeting}
        </h1>
        <p className="max-w-md text-[var(--color-fg-muted)]">{lead}</p>
      </div>
      <div
        aria-hidden="true"
        className="grid size-16 shrink-0 place-items-center rounded-2xl bg-[linear-gradient(135deg,var(--brand-accent-500)_0%,var(--brand-primary-600)_100%)] text-white shadow-lg"
      >
        <ActivityIcon className="size-8" />
      </div>
    </div>
  );
}
