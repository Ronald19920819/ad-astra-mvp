"use client";

import Link, { type LinkProps } from "next/link";
import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import {
  type AnchorHTMLAttributes,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

type PendingNavigationLinkProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "children"> & {
    children: ReactNode | ((state: { isPending: boolean }) => ReactNode);
    pendingChildren?: ReactNode;
  };

function isPlainLeftClick(event: MouseEvent<HTMLAnchorElement>) {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.shiftKey
  );
}

function normaliseHref(href: PendingNavigationLinkProps["href"]) {
  if (typeof href === "string") return href;

  const pathname = href.pathname ?? "";
  const search = href.query
    ? `?${new URLSearchParams(
        Object.entries(href.query).flatMap(([key, value]) => {
          if (value === undefined) return [];
          if (Array.isArray(value)) {
            return value.map((entry) => [key, String(entry)]);
          }

          return [[key, String(value)]];
        }),
      ).toString()}`
    : "";
  const hash = href.hash ? `#${href.hash}` : "";

  return `${pathname}${search}${hash}`;
}

export function PendingNavigationLink({
  children,
  pendingChildren,
  href,
  onClick,
  target,
  ...props
}: PendingNavigationLinkProps) {
  const router = useRouter();
  usePathname();
  useSearchParams();
  const [isPendingLock, setIsPendingLock] = useState(false);
  const [isNavigating, startTransition] = useTransition();
  const resetTimerRef = useRef<number | null>(null);
  const nextHref = useMemo(() => normaliseHref(href), [href]);
  const isPending = isPendingLock || isNavigating;

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);

    if (event.defaultPrevented) return;

    if (isPending) {
      event.preventDefault();
      return;
    }

    if (!isPlainLeftClick(event)) return;
    if (target && target !== "_self") return;

    event.preventDefault();
    setIsPendingLock(true);
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }
    resetTimerRef.current = window.setTimeout(() => {
      setIsPendingLock(false);
      resetTimerRef.current = null;
    }, 8000);
    startTransition(() => {
      router.push(nextHref);
    });
  }

  return (
    <Link
      {...props}
      href={href}
      target={target}
      aria-busy={isPending || undefined}
      data-pending={isPending ? "true" : "false"}
      onClick={handleClick}
    >
      {isPending && pendingChildren
        ? pendingChildren
        : typeof children === "function"
          ? children({ isPending })
          : children}
    </Link>
  );
}

export default PendingNavigationLink;
