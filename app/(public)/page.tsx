import { getSupabaseServer } from "@/lib/supabase/server";
import { publicLinks } from "@/lib/public-links";
import { LinktreeHero } from "@/components/home/linktree-hero";
import { PrivateShortcuts } from "@/components/home/private-shortcuts";
import { LinkGroup } from "@/components/home/link-group";

export default async function PublicLanding() {
  const supabase = await getSupabaseServer();
  const { data: { user: authUser } } = await supabase.auth.getUser();

  let user: { firstName: string } | null = null;
  if (authUser) {
    const { data: row } = await supabase
      .from("usuarios")
      .select("nome, administrador, equipe_usuarios(id)")
      .eq("id", authUser.id)
      .single();
    const isStaff =
      row?.administrador === true ||
      (Array.isArray((row as { equipe_usuarios?: unknown[] } | null)?.equipe_usuarios) &&
        ((row as { equipe_usuarios?: unknown[] })!.equipe_usuarios!.length ?? 0) > 0);
    const nome = row?.nome?.trim() ?? "";
    if (nome && isStaff) {
      user = { firstName: nome.split(/\s+/)[0]! };
    }
  }

  const greeting = user ? `Olá, ${user.firstName}` : "Bem-vindo à MAIA";
  const lead = user
    ? "Atalhos rápidos, formulários e sistemas auxiliares."
    : "Formulários públicos e sistemas auxiliares para colaboradores ENGEKO.";

  return (
    <div className="mx-auto max-w-3xl space-y-10 px-4 py-12">
      <section id="inicio">
        <LinktreeHero greeting={greeting} lead={lead} />
      </section>

      <PrivateShortcuts user={user} />

      {publicLinks.map((group) => (
        <section
          key={group.title}
          id={group.title === "Formulários" ? "formularios" : "sistemas"}
        >
          <LinkGroup group={group} />
        </section>
      ))}
    </div>
  );
}
