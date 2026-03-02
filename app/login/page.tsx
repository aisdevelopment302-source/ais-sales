"use client";

import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getRedirectResult } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function LoginPage() {
  const { user, loading, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [redirectLoading, setRedirectLoading] = useState(true);

  // Complete the redirect sign-in flow when Google redirects back
  useEffect(() => {
    getRedirectResult(auth)
      .catch(() => {})
      .finally(() => setRedirectLoading(false));
  }, []);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/");
    }
  }, [user, loading, router]);

  if (loading || redirectLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div style={{ color: "#64748b" }}>Loading...</div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "#f0f4f8",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: "48px 40px",
          boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
          textAlign: "center",
          maxWidth: 360,
          width: "100%",
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 20, color: "#1e293b", marginBottom: 4 }}>
          AADINATH INDUSTRIES
        </div>
        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 36 }}>
          Sales Analytics Dashboard
        </div>

        <button
          onClick={signInWithGoogle}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            width: "100%",
            padding: "12px 20px",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            background: "#fff",
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 500,
            color: "#1e293b",
            transition: "background 0.15s",
          }}
          onMouseOver={(e) => (e.currentTarget.style.background = "#f8fafc")}
          onMouseOut={(e) => (e.currentTarget.style.background = "#fff")}
        >
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#4285F4" d="M45.52 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h12.09c-.52 2.76-2.1 5.1-4.48 6.67v5.54h7.26c4.25-3.92 6.65-9.7 6.65-16.22z"/>
            <path fill="#34A853" d="M24 46c6.48 0 11.92-2.15 15.89-5.82l-7.26-5.54c-2.02 1.36-4.6 2.16-8.63 2.16-6.64 0-12.27-4.49-14.28-10.53H2.18v5.73C6.14 41.46 14.42 46 24 46z"/>
            <path fill="#FBBC05" d="M9.72 26.27A14.77 14.77 0 0 1 9 24c0-.79.14-1.55.72-2.27v-5.73H2.18A23.97 23.97 0 0 0 0 24c0 3.86.93 7.51 2.18 10.73l7.54-5.73v-2.73z"/>
            <path fill="#EA4335" d="M24 9.5c3.74 0 7.08 1.29 9.72 3.82l7.29-7.29C36.91 2.15 31.48 0 24 0 14.42 0 6.14 4.54 2.18 13.27l7.54 5.73C11.73 13.99 17.36 9.5 24 9.5z"/>
          </svg>
          Sign in with Google
        </button>
      </div>
    </div>
  );
}
