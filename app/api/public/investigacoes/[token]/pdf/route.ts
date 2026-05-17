import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const VIEWABLE = new Set(["em_aprovacao", "aprovada"]);

export async function GET(_: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const admin = getSupabaseAdmin();
  const { data: inv, error } = await admin
    .from("investigacoes")
    .select("id, situacao")
    .eq("token_publico", token)
    .single();
  if (error || !inv) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!VIEWABLE.has(inv.situacao)) {
    return NextResponse.json({ error: "not_viewable", situacao: inv.situacao }, { status: 409 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL ?? process.env.APP_URL ?? "http://localhost:3000";
  const reportUrl = `${baseUrl}/ocorrencias/relatorio/${token}`;

  const puppeteer = await import("puppeteer-core");

  let executablePath: string;
  let launchArgs: string[];

  if (process.env.NODE_ENV === "development") {
    // @sparticuz/chromium ships a Linux binary — unusable on macOS. Use local Chrome.
    executablePath =
      process.env.CHROMIUM_PATH ??
      "/Applications/Chromium.app/Contents/MacOS/Chromium";
    launchArgs = ["--no-sandbox", "--disable-setuid-sandbox"];
  } else {
    const chromium = (await import("@sparticuz/chromium")).default;
    executablePath = await chromium.executablePath();
    launchArgs = chromium.args;
  }

  const browser = await puppeteer.launch({
    args: launchArgs,
    executablePath,
    headless: true,
    defaultViewport: { width: 1240, height: 1754 },
  });

  try {
    const page = await browser.newPage();
    await page.goto(reportUrl, { waitUntil: "networkidle0", timeout: 30000 });
    await page.emulateMediaType("print");
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "12mm", bottom: "12mm", left: "12mm", right: "12mm" },
    });

    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="investigacao-${token}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } finally {
    await browser.close();
  }
}
