"use client";
import { useId, useState } from "react";

export type Option = { id: number; name: string; aliases?: string[] };
export type Picked = number | string;

/** Pick existing names (by id) or type a new one. New ones are sent as strings and created on save. */
export function TagPicker({
  label, options, value, onChange, placeholder, hint,
}: { label: string; options: Option[]; value: Picked[]; onChange: (v: Picked[]) => void; placeholder?: string; hint?: string }) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const id = useId();
  const t = text.trim().toLowerCase();
  const nameOf = (v: Picked) => (typeof v === "number" ? options.find((o) => o.id === v)?.name ?? "" : v);
  const matches = t
    ? options.filter((o) => !value.includes(o.id) && [o.name, ...(o.aliases ?? [])].some((n) => n.toLowerCase().includes(t))).slice(0, 6)
    : [];
  const exact = options.some((o) => [o.name, ...(o.aliases ?? [])].some((n) => n.toLowerCase() === t)) || value.some((v) => typeof v === "string" && v.toLowerCase() === t);
  const add = (v: Picked) => { onChange([...value, v]); setText(""); };

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="picked">
        {value.map((v) => (
          <button type="button" key={String(v)} className="pill on" onClick={() => onChange(value.filter((x) => x !== v))}>
            {nameOf(v)} <span aria-hidden="true">×</span><span className="sr-only">Remove</span>
          </button>
        ))}
      </div>
      <input
        id={id}
        value={text}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => { setText(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          if (matches[0]) add(matches[0].id);
          else if (text.trim() && !exact) add(text.trim());
        }}
      />
      {hint && <span className="hint">{hint}</span>}
      {open && (matches.length > 0 || (t && !exact)) && (
        <ul className="suggest">
          {matches.map((o) => (
            <li key={o.id}><button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => add(o.id)}>{o.name}</button></li>
          ))}
          {t && !exact && (
            <li><button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => add(text.trim())}>Add &ldquo;{text.trim()}&rdquo;</button></li>
          )}
        </ul>
      )}
    </div>
  );
}
