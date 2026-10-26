import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Login dengan username belum dikonfigurasi. Silakan login dengan email atau hubungi admin." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  let body: { username?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Permintaan login tidak valid." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!/^[a-z0-9_]{3,24}$/.test(username) || !password) {
    return NextResponse.json({ error: "Username atau password tidak valid." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (profileError || !profile) {
    return NextResponse.json({ error: "Username atau password tidak valid." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const { data: userData, error: userError } = await admin.auth.admin.getUserById(profile.id);
  const email = userData.user?.email;
  if (userError || !email) {
    return NextResponse.json({ error: "Username atau password tidak valid." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const auth = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await auth.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    return NextResponse.json({ error: "Username atau password tidak valid." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  }, { headers: { "Cache-Control": "no-store" } });
}

