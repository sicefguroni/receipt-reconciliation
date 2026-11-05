"use client";

import { BookOpenText, CalendarRange, CloudUpload, History } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Months", icon: CalendarRange },
  { href: "/upload", label: "Upload", icon: CloudUpload },
  { href: "/runs", label: "Runs", icon: History },
  { href: "/guide", label: "Guide", icon: BookOpenText },
] as const;

export function AppNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="main-nav">
      {links.map(({ href, label, icon: Icon }) => {
        const active =
          href === "/"
            ? pathname === href || pathname.startsWith("/review/") || pathname.startsWith("/pack/")
            : pathname.startsWith(href);
        return (
          <Link href={href} key={href} className={active ? "active" : undefined}>
            <Icon aria-hidden="true" size={17} strokeWidth={2} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
