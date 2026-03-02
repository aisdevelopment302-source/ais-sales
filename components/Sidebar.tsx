"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";

const nav = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/sales", label: "Sales", icon: "🧾" },
  { href: "/customers", label: "Customers", icon: "👥" },
  { href: "/items", label: "Items / Products", icon: "📦" },
  { href: "/analysis/monthly", label: "Monthly Analysis", icon: "📈" },
  { href: "/analysis/mill-scale", label: "Mill Scale", icon: "⚙️" },
  { href: "/analysis/melting-scrap", label: "Melting Scrap", icon: "🔥" },
  { href: "/geography", label: "Geographic", icon: "🌍" },
  { href: "/geography/cities", label: "Cities", icon: "🏙️" },
  { href: "/purchases", label: "Purchases", icon: "🛒" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const { user, signOut } = useAuth();

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (isMobile) {
      setIsOpen(false);
    }
  }, [pathname, isMobile]);

  return (
    <>
      {/* Mobile toggle button */}
      {isMobile && (
        <button
          className="sidebar-toggle"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle navigation"
        >
          {isOpen ? "✕" : "☰"}
        </button>
      )}

      {/* Mobile overlay */}
      {isMobile && isOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 999,
            top: 0,
          }}
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`sidebar${isMobile && isOpen ? " open" : ""}`}
        style={isMobile ? { boxShadow: "2px 0 8px rgba(0,0,0,0.3)" } : {}}
      >
        {/* Logo */}
        <div style={{ padding: "20px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ fontWeight: 700, color: "#fff", fontSize: isMobile ? 14 : 16 }}>
            AADINATH INDUSTRIES
          </div>
          <div style={{ fontSize: 10, color: "#64748b", marginTop: 3 }}>
            Sales Analytics · FY 2025-26
          </div>
        </div>

        {/* Nav */}
        <nav style={{ paddingTop: 8 }}>
          {nav.map((item) => {
            const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-link${isActive ? " active" : ""}`}
                onClick={() => isMobile && setIsOpen(false)}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User / Sign out */}
        {user && (
          <div style={{ padding: "16px", borderTop: "1px solid rgba(255,255,255,0.08)", marginTop: "auto" }}>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user.email}
            </div>
            <button
              onClick={signOut}
              style={{
                width: "100%",
                padding: "8px 12px",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 6,
                color: "#94a3b8",
                fontSize: 12,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </>
  );
}
