import Link from "next/link";

const ITEMS = [
  { href: "/admin/usuarios", title: "Usuários" },
  { href: "/admin/equipes",  title: "Equipes" },
  { href: "/admin/configuracoes", title: "Configurações" },
  { href: "/admin/empresas", title: "Empresas" },
  { href: "/admin/unidades", title: "Unidades" },
  { href: "/admin/afastamento-tipos", title: "Tipos de afastamento" },
];

export default function AdminHome() {
  return (
    <main className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-6">Administração</h1>
      <ul className="grid grid-cols-2 gap-4">
        {ITEMS.map(i => (
          <li key={i.href}>
            <Link href={i.href} className="block border rounded p-4 hover:bg-muted/30">{i.title}</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
