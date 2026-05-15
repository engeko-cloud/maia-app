"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function PortalHomeButton() {
  const router = useRouter();

  async function handleClick() {
    try {
      await fetch("/api/portal/logout", { method: "POST" });
    } catch {
      // Even if logout fails (network), we still navigate — the user's intent is to leave.
    }
    router.push("/");
    router.refresh();
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleClick}>
      Início
    </Button>
  );
}
