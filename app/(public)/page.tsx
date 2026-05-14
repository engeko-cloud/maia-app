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
      .select("nome")
      .eq("id", authUser.id)
      .single();
    const nome = row?.nome?.trim() ?? "";
    if (nome) {
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
