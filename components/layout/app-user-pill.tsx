"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDownIcon, LogOutIcon, UserIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getSupabaseBrowser } from "@/lib/supabase/client";

interface AppUserPillProps {
  firstName: string;
  initials: string;
}

export function AppUserPill({ firstName, initials }: AppUserPillProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function handleSignOut() {
    setPending(true);
    await getSupabaseBrowser().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex items-center gap-2 rounded-full bg-muted px-2 py-1 text-sm hover:bg-muted/80 data-[popup-open]:bg-muted/80"
        aria-label={`Menu de ${firstName}`}
      >
        <Avatar size="sm">
          <AvatarFallback className="bg-[var(--brand-primary-600)] text-[10px] text-white">
            {initials}
          </AvatarFallback>
        </Avatar>
        <span className="font-medium text-foreground">{firstName}</span>
        <ChevronDownIcon className="size-4 opacity-60" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="min-w-[180px]">
        <DropdownMenuItem render={<Link href="/painel" />}>
          <UserIcon className="size-4" aria-hidden="true" />
          Perfil
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={pending}
          onClick={handleSignOut}
        >
          <LogOutIcon className="size-4" aria-hidden="true" />
          {pending ? "Saindo…" : "Sair"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
