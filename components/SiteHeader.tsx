"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon, type IconName } from "./Icon";

const NAV: { href: string; label: string; also?: string }[] = [
  { href: "/", label: "Home" },
  { href: "/browse", label: "Browse" },
  { href: "/people", label: "Family" },
  { href: "/calendar", label: "Birthdays & gatherings" },
  { href: "/upload", label: "Add photos", also: "/tag" },
];

const TABS: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/browse", label: "Browse", icon: "search" },
  { href: "/people", label: "Family", icon: "family" },
  { href: "/calendar", label: "Calendar", icon: "calendar" },
];

const ADD: { href: string; title: string; text: string; icon: IconName }[] = [
  { href: "/upload", title: "Photos", text: "Upload photos from your phone", icon: "photo" },
  { href: "/people/new", title: "Person", text: "Add family or a loved one", icon: "person" },
  { href: "/calendar#add-birthday", title: "Birthday", text: "Add a birthday to someone's profile", icon: "cake" },
  { href: "/people/new-date?kind=anniversary", title: "Anniversary", text: "Remember an important date", icon: "heart" },
  { href: "/calendar#add-gathering", title: "Gathering or event", text: "Bring everyone together", icon: "family" },
  { href: "/calendar#subscribe", title: "Connect a calendar", text: "Google Calendar or Apple Calendar", icon: "link" },
];

const current = (path: string, href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`));

export function SiteHeader({ name }: { name: string }) {
  const path = usePathname();
  const [adding, setAdding] = useState(false);
  useEffect(() => setAdding(false), [path]);
  useEffect(() => {
    if (!adding) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setAdding(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [adding]);
  // Tagging has its own Previous, Skip, and Save bar at the bottom on phones, in place of the tabs.
  const tagging = path.startsWith("/tag");

  return (
    <>
      <header className="site-header">
        <div className="site-header-inner">
          <Link href="/" className="brand">Dunya Family</Link>
          <Link href="/" className="phone-title">Dunya Family</Link>
          <nav aria-label="Main" className="main-nav">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} aria-current={current(path, n.href) || (n.also && current(path, n.also)) ? "page" : undefined}>{n.label}</Link>
            ))}
          </nav>
          <div className="header-tools">
            <Link href="/browse" className="icon-btn" aria-label="Search"><Icon name="search" size={22} /></Link>
            {/* The account menu arrives with "Which one is you?". For now this shows who this device is. */}
            <span className="me" role="img" aria-label={`You: ${name}`} title={name}>{name.trim().charAt(0).toUpperCase()}</span>
          </div>
        </div>
      </header>

      {!tagging && <nav aria-label="Main" className="tab-bar">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} aria-current={current(path, t.href) ? "page" : undefined}>
            <Icon name={t.icon} size={24} stroke={current(path, t.href) ? 1.8 : 1.6} />
            <span>{t.label}</span>
          </Link>
        ))}
        <button type="button" className="tab-add" aria-haspopup="dialog" aria-expanded={adding} onClick={() => setAdding(true)}>
          <span className="tab-add-dot"><Icon name="plus" size={20} stroke={2.2} style={{ color: "var(--paper)" }} /></span>
          <span>Add</span>
        </button>
      </nav>}

      {adding && (
        <div className="sheet-backdrop" onClick={() => setAdding(false)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="add-title" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-grip" aria-hidden="true" />
            <div className="sheet-head">
              <h2 id="add-title">What would you like to add?</h2>
              <button type="button" className="icon-btn" aria-label="Close" onClick={() => setAdding(false)}><Icon name="x" size={22} /></button>
            </div>
            <ul className="sheet-list">
              {ADD.map((a) => (
                <li key={a.href}>
                  <Link href={a.href}>
                    <span className="sheet-icon"><Icon name={a.icon} size={24} /></span>
                    <span><strong>{a.title}</strong><span className="small">{a.text}</span></span>
                    <Icon name="chevronRight" className="chev" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
