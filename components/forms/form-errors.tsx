import type { FieldErrors, FieldValues, FieldError } from "react-hook-form";

// Painel resumido dos erros de validação no topo do form, exibindo
// rótulo amigável + mensagem para cada campo inválido. Os formulários
// têm muitos campos condicionais — fica mais simples concentrar o
// feedback aqui do que pingar mensagens por baixo de cada Input.
export function FormErrors<T extends FieldValues>({
  errors,
  labels,
}: {
  errors: FieldErrors<T>;
  labels: Partial<Record<keyof T | string, string>>;
}) {
  const entries = flattenErrors(errors, labels);
  if (entries.length === 0) return null;
  return (
    <div
      role="alert"
      className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm"
    >
      <p className="font-medium text-destructive">
        Corrija os campos abaixo antes de enviar:
      </p>
      <ul className="mt-1 list-disc pl-5 text-destructive/90">
        {entries.map(({ key, label, message }) => (
          <li key={key}>
            <span className="font-medium">{label}</span>
            {message ? ` — ${message}` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}

function flattenErrors<T extends FieldValues>(
  errors: FieldErrors<T>,
  labels: Partial<Record<keyof T | string, string>>,
  prefix = "",
): { key: string; label: string; message?: string }[] {
  const out: { key: string; label: string; message?: string }[] = [];
  for (const [name, err] of Object.entries(errors)) {
    const key = prefix ? `${prefix}.${name}` : name;
    if (err && typeof err === "object" && "message" in err) {
      const fieldErr = err as FieldError;
      out.push({
        key,
        label: labels[key] ?? labels[name] ?? key,
        message: typeof fieldErr.message === "string" ? fieldErr.message : undefined,
      });
    } else if (err && typeof err === "object") {
      out.push(
        ...flattenErrors(err as FieldErrors<T>, labels, key),
      );
    }
  }
  return out;
}
