"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ items }: { items: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <ul className="flex gap-1 whitespace-nowrap">
      {items.map((i) => {
        const active = i.href === "/" ? path === "/" : path.startsWith(i.href);
        return (
          <li key={i.href}>
            <Link
              href={i.href}
              aria-current={active ? "page" : undefined}
              className={`inline-flex items-center min-h-[40px] px-1.5 md:px-2 text-[12px] md:text-[13px] font-extrabold uppercase tracking-[0.07em] no-underline border-b-[3px] ${
                active ? "border-signal" : "border-transparent hover:border-ink"
              }`}
              style={{ fontStretch: "88%" }}
            >
              {i.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
