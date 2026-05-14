import Link from "next/link";

export default async function InvestigacaoSkeleton({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Investigação</h1>
      <p className="text-muted-foreground">
        Formulário de investigação (Ishikawa) será habilitado quando o time de segurança for ativado.
      </p>
      <Link href={`/ocorrencias/${id}`} className="text-primary underline mt-4 inline-block">← Voltar</Link>
    </main>
  );
}
