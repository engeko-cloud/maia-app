import type { EventoType } from "@/lib/eventos";

export type TipoEntidade = "afastamento" | "ocorrencia" | "investigacao";

export type EventoTone = "new" | "approved" | "rejected" | "muted";

export function formatEventoVerb(evento: EventoType): string {
  switch (evento) {
    case "criado":         return "criou";
    case "aprovado":       return "aprovou";
    case "rejeitado":      return "rejeitou";
    case "resubmetido":    return "resubmeteu";
    case "cancelado":      return "cancelou";
    case "fluig_enviado":  return "enviou ao Fluig";
    case "fluig_erro":     return "falhou no Fluig";
    case "email_enviado":  return "enviou email";
  }
}

export function formatEntidadeNoun(tipo: TipoEntidade): string {
  switch (tipo) {
    case "afastamento":   return "afastamento";
    case "ocorrencia":    return "ocorrência";
    case "investigacao":  return "investigação";
  }
}

export function eventoDotTone(evento: EventoType): EventoTone {
  switch (evento) {
    case "aprovado":                              return "approved";
    case "rejeitado":
    case "cancelado":                             return "rejected";
    case "criado":
    case "resubmetido":                           return "new";
    case "fluig_enviado":
    case "fluig_erro":
    case "email_enviado":                         return "muted";
  }
}
