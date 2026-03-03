"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";

interface NavChild {
  href: string;
  label: string;
}

interface NavItem {
  href: string;
  label: string;
  icon: string;
  children?: NavChild[];
}

const nav: NavItem[] = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/sales", label: "Sales", icon: "🧾" },
  { href: "/customers", label: "Customers", icon: "👥" },
  { href: "/items", label: "Items", icon: "📦" },
  {
    href: "/geography",
    label: "Geography",
    icon: "🌍",
    children: [
      { href: "/geography", label: "By State" },
      { href: "/geography/cities", label: "By City" },
    ],
  },
  {
    href: "/analysis/overall",
    label: "Analysis",
    icon: "📈",
    children: [
      { href: "/analysis/overall", label: "Overall" },
      { href: "/analysis/mill-scale", label: "Mill Scale" },
      { href: "/analysis/melting-scrap", label: "Melting Scrap" },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    // Auto-open groups that contain the current route
    const open = new Set<string>();
    nav.forEach((item) => {
      if (item.children?.some((c) => pathname.startsWith(c.href) && c.href !== "/")) {
        open.add(item.href);
      }
    });
    return open;
  });

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Close sidebar on mobile when navigating
  useEffect(() => {
    if (isMobile) setIsOpen(false);
  }, [pathname, isMobile]);

  // Auto-open group when navigating into it
  useEffect(() => {
    nav.forEach((item) => {
      if (item.children?.some((c) => pathname.startsWith(c.href) && c.href !== "/")) {
        setOpenGroups((prev) => new Set(prev).add(item.href));
      }
    });
  }, [pathname]);

  const toggleGroup = (href: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(href)) next.delete(href);
      else next.add(href);
      return next;
    });
  };

  return (
    <>
      {/* Mobile toggle */}
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
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 999 }}
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
            const hasChildren = !!item.children;
            const isGroupOpen = openGroups.has(item.href);
            const isActive = hasChildren
              ? item.children!.some((c) => pathname === c.href || (c.href !== "/" && pathname.startsWith(c.href)))
              : item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

            if (hasChildren) {
              return (
                <div key={item.href}>
                  {/* Group header — navigates AND toggles */}
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <Link
                      href={item.href}
                      className={`sidebar-link${isActive ? " active" : ""}`}
                      style={{ flex: 1, display: "flex", alignItems: "center", gap: 10 }}
                      onClick={() => isMobile && setIsOpen(false)}
                    >
                      <span>{item.icon}</span>
                      <span>{item.label}</span>
                    </Link>
                    <button
                      onClick={() => toggleGroup(item.href)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "#94a3b8",
                        padding: "10px 12px",
                        fontSize: 11,
                        lineHeight: 1,
                        transition: "transform 0.2s",
                        transform: isGroupOpen ? "rotate(90deg)" : "rotate(0deg)",
                        flexShrink: 0,
                      }}
                      aria-label={isGroupOpen ? "Collapse" : "Expand"}
                    >
                      ›
                    </button>
                  </div>

                  {/* Sub-links */}
                  {isGroupOpen && (
                    <div>
                      {item.children!.map((child) => {
                        const childActive =
                          child.href === item.href
                            ? pathname === child.href
                            : pathname === child.href || pathname.startsWith(child.href);
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={`sidebar-link${childActive ? " active" : ""}`}
                            style={{ paddingLeft: 36, fontSize: 13 }}
                            onClick={() => isMobile && setIsOpen(false)}
                          >
                            <span style={{ color: "#475569", fontSize: 10 }}>└</span>
                            <span>{child.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            // Flat link
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
