"use client";

import { useActionState, useState } from "react";
import { login, signup, type AuthResult } from "@/app/auth/actions";

const inputClass =
  "w-full rounded-sm border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-500 focus:outline-none transition-colors";

export default function LoginForm({ initialError }: { initialError?: string }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const action = mode === "login" ? login : signup;
  const [state, formAction, pending] = useActionState<AuthResult, FormData>(action, {});

  // After a successful signup that needs confirmation, show a check-your-email panel.
  if (state.needsConfirmation) {
    return (
      <div className="w-full max-w-sm">
        <div className="rounded-sm border border-stone-200 bg-white p-8 text-center shadow-sm paper">
          <p className="font-display text-4xl text-stone-300 select-none">✉</p>
          <h1 className="mt-4 font-display text-2xl font-medium italic text-stone-800">
            Check your inbox
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-stone-500">
            We sent a confirmation link to{" "}
            <span className="font-medium text-stone-700">{state.email}</span>.
            Click it to activate your account, then log in.
          </p>
          <button
            onClick={() => location.reload()}
            className="mt-8 inline-block rounded-sm border border-stone-300 px-5 py-2.5 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-50"
          >
            Back to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <div className="rounded-sm border border-stone-200 bg-white p-8 shadow-sm paper">
        <h1 className="text-center font-display text-3xl font-semibold tracking-widest text-stone-900 uppercase">
          Eidora
        </h1>
        <p className="mt-2 text-center text-sm text-stone-500">
          {mode === "login" ? "Welcome back." : "Create your account."}
        </p>

        <form action={formAction} className="mt-8 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium text-stone-700">Email</label>
            <input id="email" name="email" type="email" autoComplete="email" required className={inputClass} placeholder="you@example.com" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium text-stone-700">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              className={inputClass}
              placeholder={mode === "signup" ? "At least 6 characters" : "••••••••"}
            />
          </div>

          {(state.error || initialError) && (
            <p className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error ?? initialError}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="mt-2 rounded-sm bg-stone-800 px-5 py-2.5 text-sm font-medium text-stone-50 transition-colors hover:bg-stone-700 disabled:opacity-50"
          >
            {pending ? "…" : mode === "login" ? "Log in" : "Sign up"}
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-stone-500">
        {mode === "login" ? "New to Eidora?" : "Already have an account?"}{" "}
        <button
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="font-medium text-stone-800 underline underline-offset-4 hover:text-stone-600"
        >
          {mode === "login" ? "Create an account" : "Log in"}
        </button>
      </p>
    </div>
  );
}
