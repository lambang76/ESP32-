"use client";

import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, MessageCircle, MessageSquareText, Pencil, Plus, Send, ShieldQuestion, Trash2, Wifi } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type Category = "Umum" | "Hardware" | "Firmware" | "Dashboard";
interface Post { id: string; user_id: string; author_name: string; category: Category; title: string; content: string; created_at: string; }
interface Reply { id: string; post_id: string; user_id: string; author_name: string; content: string; created_at: string; }

const categories: Category[] = ["Umum", "Hardware", "Firmware", "Dashboard"];
const inputClass = "w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/10";

export default function ForumPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState("");
  const [authorName, setAuthorName] = useState("Anggota");
  const [posts, setPosts] = useState<Post[]>([]);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("Semua");
  const [category, setCategory] = useState<Category>("Umum");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const loadForum = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const [postResult, replyResult] = await Promise.all([
      supabase.from("forum_posts").select("id,user_id,author_name,category,title,content,created_at").order("created_at", { ascending: false }).limit(100),
      supabase.from("forum_replies").select("id,post_id,user_id,author_name,content,created_at").order("created_at", { ascending: true }).limit(500),
    ]);
    if (postResult.error || replyResult.error) setError("Belum bisa memuat forum. Pastikan tabel forum sudah dibuat dengan SQL pada panduan.");
    else {
      setPosts((postResult.data ?? []) as Post[]);
      setReplies((replyResult.data ?? []) as Reply[]);
      setError("");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!supabase) { setError("Konfigurasi Supabase belum tersedia."); setReady(true); setLoading(false); return; }
    let active = true;
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      if (!session) { router.replace("/login"); return; }
      setUserId(session.user.id);
      const metadataName = session.user.user_metadata?.username;
      setAuthorName(typeof metadataName === "string" && metadataName ? metadataName : session.user.email?.split("@")[0] || "Anggota");
      setReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (!session) router.replace("/login");
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, [router]);

  useEffect(() => { if (ready && userId) void loadForum(); }, [ready, userId, loadForum]);

  async function createPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !userId) return;
    setSending(true); setError("");
    const { error: insertError } = await supabase.from("forum_posts").insert({
      user_id: userId, author_name: authorName, category, title: title.trim(), content: content.trim(),
    });
    if (insertError) setError("Postingan gagal dikirim. Periksa forum SQL/policy atau koneksi.");
    else { setTitle(""); setContent(""); await loadForum(); }
    setSending(false);
  }

  async function createReply(event: FormEvent<HTMLFormElement>, postId: string) {
    event.preventDefault();
    if (!supabase || !userId) return;
    const text = (replyDrafts[postId] || "").trim();
    if (!text) return;
    setSending(true); setError("");
    const { error: insertError } = await supabase.from("forum_replies").insert({
      post_id: postId, user_id: userId, author_name: authorName, content: text,
    });
    if (insertError) setError("Balasan gagal dikirim. Coba lagi.");
    else { setReplyDrafts((current) => ({ ...current, [postId]: "" })); await loadForum(); }
    setSending(false);
  }

  async function editPost(post: Post) {
    if (!supabase) return;
    const nextTitle = window.prompt("Ubah judul diskusi:", post.title);
    if (nextTitle === null) return;
    const nextContent = window.prompt("Ubah isi diskusi:", post.content);
    if (nextContent === null) return;
    if (nextTitle.trim().length < 3 || !nextContent.trim()) {
      setError("Judul minimal 3 karakter dan isi diskusi tidak boleh kosong.");
      return;
    }
    const { error: updateError } = await supabase.from("forum_posts").update({ title: nextTitle.trim(), content: nextContent.trim() }).eq("id", post.id).eq("user_id", userId);
    if (updateError) setError("Diskusi gagal diperbarui. Jalankan ulang forum.sql untuk memperbarui policy.");
    else await loadForum();
  }

  async function deletePost(post: Post) {
    if (!supabase || !window.confirm("Hapus diskusi ini beserta semua balasannya?")) return;
    const { error: deleteError } = await supabase.from("forum_posts").delete().eq("id", post.id).eq("user_id", userId);
    if (deleteError) setError("Diskusi gagal dihapus. Jalankan ulang forum.sql untuk memperbarui policy.");
    else await loadForum();
  }

  async function editReply(reply: Reply) {
    if (!supabase) return;
    const nextContent = window.prompt("Ubah balasan:", reply.content);
    if (nextContent === null) return;
    if (!nextContent.trim()) { setError("Balasan tidak boleh kosong."); return; }
    const { error: updateError } = await supabase.from("forum_replies").update({ content: nextContent.trim() }).eq("id", reply.id).eq("user_id", userId);
    if (updateError) setError("Balasan gagal diperbarui. Jalankan ulang forum.sql untuk memperbarui policy.");
    else await loadForum();
  }

  async function deleteReply(reply: Reply) {
    if (!supabase || !window.confirm("Hapus balasan ini?")) return;
    const { error: deleteError } = await supabase.from("forum_replies").delete().eq("id", reply.id).eq("user_id", userId);
    if (deleteError) setError("Balasan gagal dihapus. Jalankan ulang forum.sql untuk memperbarui policy.");
    else await loadForum();
  }

  const visiblePosts = categoryFilter === "Semua" ? posts : posts.filter((post) => post.category === categoryFilter);
  const dateLabel = (value: string) => new Date(value).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });

  return <main className="min-h-screen bg-[#07111e] text-slate-100">
    <header className="border-b border-white/10 bg-slate-950/50"><div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6"><Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white"><ArrowLeft size={17}/> <span className="hidden sm:inline">Dashboard</span></Link><div className="flex items-center gap-2 text-cyan-200"><MessageCircle size={19}/><span className="text-sm font-semibold sm:text-base">Forum Smart Garage</span></div><span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1.5 text-xs text-emerald-200"><Wifi size={13}/> Anggota</span></div></header>
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="order-2 min-w-0 space-y-4 lg:order-1">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-semibold tracking-[0.2em] text-cyan-300">RUANG KOLABORASI JTD</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Diskusi proyek</h1><p className="mt-2 text-sm text-slate-400">Tanya, berbagi solusi, dan bahas pengembangan Smart Garage bersama anggota.</p></div><button onClick={() => void loadForum()} className="self-start rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:border-slate-500">Muat ulang</button></div>
          <div className="flex gap-2 overflow-x-auto pb-1">{["Semua", ...categories].map((item) => <button key={item} onClick={() => setCategoryFilter(item)} className={"shrink-0 rounded-full border px-3 py-1.5 text-xs transition " + (categoryFilter === item ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-100" : "border-slate-800 text-slate-400 hover:border-slate-600")}>{item}</button>)}</div>
          {error && <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-200">{error}</p>}
          {loading ? <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8 text-center text-sm text-slate-400">Memuat diskusi...</div> : visiblePosts.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/30 p-8 text-center"><MessageSquareText className="mx-auto text-slate-600" size={28}/><p className="mt-3 font-medium">Belum ada diskusi di kategori ini</p><p className="mt-1 text-sm text-slate-500">Jadilah yang pertama memulai percakapan.</p></div> : visiblePosts.map((post) => {
            const postReplies = replies.filter((reply) => reply.post_id === post.id);
            return <article key={post.id} className="rounded-2xl border border-slate-800 bg-slate-900/55 p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-2"><span className="rounded-full border border-violet-300/15 bg-violet-300/[0.07] px-2.5 py-1 text-[11px] text-violet-200">{post.category}</span><time className="text-[11px] text-slate-500">{dateLabel(post.created_at)}</time></div><h2 className="mt-3 text-lg font-semibold">{post.title}</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">{post.content}</p><p className="mt-4 text-xs text-slate-500">Oleh <span className="text-slate-300">{post.author_name || "Anggota"}</span></p><div className="mt-3 flex gap-2">{post.user_id === userId && <><button type="button" onClick={() => void editPost(post)} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:border-cyan-400/40 hover:text-cyan-200"><Pencil size={13}/> Edit</button><button type="button" onClick={() => void deletePost(post)} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:border-rose-400/40 hover:text-rose-200"><Trash2 size={13}/> Hapus</button></>}</div><div className="mt-5 border-t border-slate-800 pt-4"><p className="mb-3 flex items-center gap-2 text-xs font-medium text-slate-400"><MessageCircle size={14}/> {postReplies.length} balasan</p>{postReplies.map((reply) => <div key={reply.id} className="mb-3 rounded-xl bg-slate-950/50 p-3"><p className="whitespace-pre-wrap text-sm text-slate-300">{reply.content}</p><p className="mt-2 text-[11px] text-slate-500">{reply.author_name || "Anggota"} · {dateLabel(reply.created_at)}</p>{reply.user_id === userId && <div className="mt-2 flex gap-3"><button type="button" onClick={() => void editReply(reply)} className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-cyan-200"><Pencil size={12}/> Edit</button><button type="button" onClick={() => void deleteReply(reply)} className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-rose-200"><Trash2 size={12}/> Hapus</button></div>} </div>)}<form onSubmit={(event) => void createReply(event, post.id)} className="flex gap-2"><input aria-label="Tulis balasan" value={replyDrafts[post.id] || ""} onChange={(event) => setReplyDrafts((current) => ({ ...current, [post.id]: event.target.value }))} maxLength={1000} placeholder="Tulis balasan..." className="min-w-0 flex-1 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/60"/><button disabled={sending || !(replyDrafts[post.id] || "").trim()} aria-label="Kirim balasan" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cyan-400 text-slate-950 disabled:opacity-40"><Send size={16}/></button></form></div></article>;
          })}
        </section>
        <aside className="order-1 h-fit lg:sticky lg:top-6 lg:order-2"><form onSubmit={createPost} className="rounded-2xl border border-slate-800 bg-slate-900/65 p-5 shadow-xl shadow-black/10 sm:p-6"><div className="mb-5 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-300/10 text-cyan-200"><Plus size={20}/></span><div><h2 className="font-semibold">Mulai diskusi</h2><p className="text-xs text-slate-500">Bagikan pertanyaan atau ide</p></div></div><label className="mb-2 block text-xs font-medium text-slate-400" htmlFor="forum-category">Kategori</label><select id="forum-category" value={category} onChange={(event) => setCategory(event.target.value as Category)} className={inputClass + " mb-4"}>{categories.map((item) => <option key={item}>{item}</option>)}</select><label className="mb-2 block text-xs font-medium text-slate-400" htmlFor="forum-title">Judul</label><input id="forum-title" required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Apa yang ingin didiskusikan?" className={inputClass + " mb-4"}/><label className="mb-2 block text-xs font-medium text-slate-400" htmlFor="forum-content">Isi diskusi</label><textarea id="forum-content" required maxLength={5000} rows={5} value={content} onChange={(event) => setContent(event.target.value)} placeholder="Ceritakan detailnya supaya anggota lain bisa membantu..." className={inputClass + " resize-y"}/><button disabled={sending || !title.trim() || !content.trim()} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"><Send size={16}/>{sending ? "Mengirim..." : "Publikasikan diskusi"}</button></form><div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/35 p-4"><p className="flex items-center gap-2 text-sm font-medium"><ShieldQuestion size={16} className="text-cyan-300"/> Ruang anggota</p><p className="mt-2 text-xs leading-5 text-slate-500">Diskusi hanya bisa dibaca dan ditulis setelah login. Jangan bagikan password, API key, atau kredensial perangkat di postingan.</p></div></aside>
      </div>
    </div>
  </main>;
}

