"use client";

import * as React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Notification } from "@/hooks/use-notifications";
import { formatEntidadeNoun } from "@/lib/eventos-format";
import type { TipoEntidade } from "@/lib/eventos-format";

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface NotificationDialogProps {
  notification: Notification | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NotificationDialog({
  notification,
  open,
  onOpenChange,
}: NotificationDialogProps) {
  if (!notification) return null;

  const noun = capitalize(
    formatEntidadeNoun(notification.tipo_entidade as TipoEntidade),
  );
  const fullDate = format(
    new Date(notification.ocorrido_em),
    "d 'de' MMMM 'de' yyyy 'às' HH:mm",
    { locale: ptBR },
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton>
        <DialogHeader>
          <DialogTitle>{noun}</DialogTitle>
          <DialogDescription>
            {capitalize(notification.evento)} · {fullDate}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Fechar</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
