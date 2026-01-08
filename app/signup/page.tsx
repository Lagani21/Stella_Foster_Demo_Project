"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Sign up failed.");
      setLoading(false);
      return;
    }
    await signIn("credentials", { email, password, redirect: false });
    window.location.href = "/";
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#E9EEF7] px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-blue-100 bg-white p-6 shadow"
      >
        <button
          type="button"
          onClick={() => (window.location.href = "/")}
          className="text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-900"
        >
          ← Back
        </button>
        <h1 className="text-lg font-semibold text-slate-900">Create account</h1>
        <p className="mt-1 text-sm text-slate-500">Save your sessions.</p>
        <div className="mt-4 space-y-3">
          <input
            type="text"
            placeholder="Name"
            className="w-full rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            type="email"
            placeholder="Email"
            className="w-full rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
        <button
          type="submit"
          className="mt-4 w-full rounded-full bg-[#92B5ED] px-4 py-2 text-sm font-semibold text-white"
          disabled={loading}
        >
          {loading ? "Creating..." : "Create account"}
        </button>
        <p className="mt-4 text-center text-xs text-slate-500">
          Already have an account? <a className="text-slate-900" href="/login">Sign in</a>
        </p>
      </form>
    </div>
  );
}
