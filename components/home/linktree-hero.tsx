import Image from "next/image";

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
      <a href="https://fapptory.me" target="_blank" rel="noopener noreferrer" className="shrink-0">
        <Image
          src="/fapptory-mark.svg"
          alt="Fapptory"
          width={37}
          height={37}
        />
      </a>
    </div>
  );
}
