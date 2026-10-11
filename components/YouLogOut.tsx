"use client";
import { logOut } from "./SiteHeader";

export function YouLogOut() {
  return (
    <button type="button" className="you-logout" onClick={logOut}>
      <span><strong>Log out</strong><span>You&apos;ll need the family password to come back in</span></span>
    </button>
  );
}
