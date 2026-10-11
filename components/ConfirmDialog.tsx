"use client";
import { useEffect, useRef } from "react";

/** A small "are you sure?" box (screen 21). Keep is the default, so Enter or Escape never deletes by accident. */
export function ConfirmDialog({ title, body, keep, confirm, onKeep, onConfirm, image }: {
  title: string; body: string; keep: string; confirm: string; onKeep: () => void; onConfirm: () => void; image?: string;
}) {
  const keepRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    keepRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onKeep();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKeep]);
  return (
    <div className="modal-backdrop confirm-backdrop" onClick={onKeep}>
      <div className="confirm" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-body" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-head">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {image && <img src={image} alt="" />}
          <h2 id="confirm-title">{title}</h2>
        </div>
        <p id="confirm-body">{body}</p>
        <div className="confirm-actions">
          <button ref={keepRef} type="button" className="btn" onClick={onKeep}>{keep}</button>
          <button type="button" className="btn btn-danger" onClick={onConfirm}>{confirm}</button>
        </div>
      </div>
    </div>
  );
}
