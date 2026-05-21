import { NextResponse, type NextRequest } from "next/server";
import { requireAdminUser } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  getFluigEventos,
  type FluigEventosFilters,
} from "@/lib/dashboard/fluig-eventos";

const PAGE_SIZE_DEFAULT = 25;
const PAGE_SIZE_MAX = 100;

function parseStatus(v: string | null): FluigEventosFilters["status"] {
  return v === "enviado" || v === "erro" || v === "pending" ? v : "all";
}

export async function GET(req: NextRequest) {
  const me = await requireAdminUser();
  if (!me) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const filters: FluigEventosFilters = {
    status: parseStatus(sp.get("status")),
    q: (sp.get("q") ?? "").trim(),
    from: sp.get("from"),
    to: sp.get("to"),
  };
  const page = Math.max(1, Number(sp.get("page") ?? "1"));
  const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, Number(sp.get("page_size") ?? PAGE_SIZE_DEFAULT)));

  const admin = getSupabaseAdmin();
  const data = await getFluigEventos(admin, filters, page, pageSize);
  return NextResponse.json(data);
}
