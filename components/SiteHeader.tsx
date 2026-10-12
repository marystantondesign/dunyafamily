"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "./Icon";

const NAV: { href: string; label: string; also?: string }[] = [
  { href: "/", label: "Home" },
  { href: "/browse", label: "Browse" },
  { href: "/people", label: "Family" },
  { href: "/calendar", label: "Calendar" },
  { href: "/prayer", label: "Prayer requests" },
  { href: "/upload", label: "Add photos", also: "/tag" },
];

const TABS: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/browse", label: "Browse", icon: "search" },
  { href: "/people", label: "Family", icon: "family" },
  { href: "/calendar", label: "Calendar", icon: "calendar" },
  { href: "/prayer", label: "Prayer", icon: "pray" },
];
// On phones the header shows the section's name where it has one of its own.
const PHONE_TITLES: [string, string][] = [["/prayer", "Prayer requests"], ["/people", "Family"], ["/you/reminders", "Text reminders"]];

const ADD: { href: string; title: string; text: string; icon: IconName }[] = [
  { href: "/upload", title: "Photos", text: "Upload photos from your phone", icon: "photo" },
  { href: "/albums", title: "Album", text: "Start a shared album everyone can add to", icon: "album" },
  { href: "/people/new", title: "Person", text: "Add family or a loved one", icon: "person" },
  { href: "/calendar#add-birthday", title: "Birthday", text: "Add a birthday to someone's profile", icon: "cake" },
  { href: "/people/new-date?kind=anniversary", title: "Anniversary", text: "Remember an important date", icon: "heart" },
  { href: "/calendar#add-gathering", title: "Gathering or event", text: "Bring everyone together", icon: "family" },
  { href: "/calendar#subscribe", title: "Connect a calendar", text: "Google Calendar or Apple Calendar", icon: "link" },
];

const current = (path: string, href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`));

type Me = { pid: number | null; name: string; avatarUrl: string | null; role: "family" | "admin" };

export function Avatar({ me, className = "me" }: { me: Pick<Me, "name" | "avatarUrl">; className?: string }) {
  return (
    <span className={className} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {me.avatarUrl ? <img src={me.avatarUrl} alt="" /> : me.name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

export async function logOut() {
  await fetch("/api/logout", { method: "POST" }).catch(() => undefined);
  window.location.href = "/enter";
}

/** Account menu (screen 23): who this device is, their page, settings, switch person, and log out. */
function AccountMenu({ me }: { me: Me }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("mousedown", onClick); };
  }, [open]);
  const first = me.name.split(" ")[0];
  return (
    <div className="account" ref={box}>
      {/* On phones the avatar opens the You page instead of a menu. */}
      <Link href="/you" className="me-link me-phone" aria-label={`You: ${me.name}`}><Avatar me={me} /></Link>
      <button type="button" className="me-link me-desktop" aria-label={`You: ${me.name}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Avatar me={me} />
      </button>
      {open && (
        <div className="account-menu" role="menu">
          <div className="account-head">
            <Avatar me={me} />
            <span><strong>{me.name}</strong><span className="small">{me.role === "admin" ? "Admin" : "Family"}</span></span>
          </div>
          <div className="account-group">
            <Link role="menuitem" href={me.pid ? `/people/${me.pid}` : "/enter/who"}><Icon name="person" size={20} /> Your page</Link>
            <Link role="menuitem" href="/you"><Icon name="gear" size={20} /> Settings</Link>
            <Link role="menuitem" href="/you/reminders"><Icon name="mail" size={20} /> Text reminders</Link>
            <Link role="menuitem" href="/enter/who"><Icon name="swap" size={20} /> Not {first}? Switch person</Link>
          </div>
          {me.role === "admin" && (
            <div className="account-group">
              <span className="account-label">Admin</span>
              <Link role="menuitem" href="/admin/homepage"><Icon name="home" size={20} /> Homepage photos</Link>
              <Link role="menuitem" href="/admin/family"><Icon name="family" size={20} /> Family tree</Link>
              <Link role="menuitem" href="/admin/deleted"><Icon name="trash" size={20} /> Recently deleted</Link>
              <Link role="menuitem" href="/admin/texts"><Icon name="mail" size={20} /> Texts sent</Link>
              <Link role="menuitem" href="/admin/password"><Icon name="lock" size={20} /> Family password</Link>
            </div>
          )}
          <div className="account-group">
            <button type="button" role="menuitem" onClick={logOut}><Icon name="logout" size={20} /> Log out</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function SiteHeader({ me }: { me: Me }) {
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
  const tagging = path.startsWith("/tag") || path.startsWith("/photos/") || path.startsWith("/slideshow");

  return (
    <>
      <header className="site-header">
        <div className="site-header-inner">
          <Link href="/" className="brand">Dunya Family</Link>
          <Link href="/" className="phone-title">{PHONE_TITLES.find(([href]) => current(path, href))?.[1] ?? "Dunya Family"}</Link>
          <nav aria-label="Main" className="main-nav">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} aria-current={current(path, n.href) || (n.also && current(path, n.also)) ? "page" : undefined}>{n.label}</Link>
            ))}
          </nav>
          <div className="header-tools">
            <Link href="/browse" className="icon-btn" aria-label="Search"><Icon name="search" size={22} /></Link>
            <AccountMenu me={me} />
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
