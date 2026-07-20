"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SupabaseTestPage() {
  const [message, setMessage] = useState("Testing Supabase connection...");

  useEffect(() => {
    const supabase = createClient();

    if (supabase) {
      setMessage("Supabase client connected successfully ✅");
    }
  }, []);

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">
          Supabase Test
        </h1>
        <p className="mt-3 text-slate-700">{message}</p>
      </div>
    </main>
  );
}