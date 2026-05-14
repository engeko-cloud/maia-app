import { FileIcon, FileImageIcon, FileTextIcon } from "lucide-react";

function pickIcon(filename: string) {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  if (["pdf", "txt", "md"].includes(ext)) return FileTextIcon;
  if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) return FileImageIcon;
  return FileIcon;
}

interface AttachmentChipProps {
  href: string;
  filename: string;
  /** Optional caption (size, uploaded-by, etc.). */
  caption?: string;
}

export function AttachmentChip({ href, filename, caption }: AttachmentChipProps) {
  const Icon = pickIcon(filename);
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-foreground transition-colors hover:border-[var(--brand-primary-600)] hover:bg-[var(--brand-primary-50)]"
    >
      <Icon className="size-4 text-[var(--color-fg-muted)]" aria-hidden="true" />
      <span className="flex flex-col leading-tight">
        <span className="font-medium">{filename}</span>
        {caption && <span className="text-xs text-[var(--color-fg-muted)]">{caption}</span>}
      </span>
    </a>
  );
}
