"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function PwaRegister() {
  const pathname = usePathname();
  const isAdminRoute =
    pathname.startsWith("/admin") ||
    pathname.toLowerCase().startsWith("/mimdamin");

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      window.location.protocol !== "file:"
    ) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    const targetManifest = isAdminRoute
      ? "/admin-manifest.webmanifest"
      : "/manifest.webmanifest";
    const targetTitle = isAdminRoute ? "ZANIMA Admin" : "ZANIMA TATTOO";

    const links = document.querySelectorAll<HTMLLinkElement>('link[rel="manifest"]');
    if (links.length === 0) {
      const link = document.createElement("link");
      link.rel = "manifest";
      link.href = targetManifest;
      document.head.appendChild(link);
    } else {
      links.forEach((link) => {
        if (link.getAttribute("href") !== targetManifest) {
          link.setAttribute("href", targetManifest);
        }
      });
    }

    const appleTitle = document.querySelector<HTMLMetaElement>(
      'meta[name="apple-mobile-web-app-title"]'
    );
    if (appleTitle && appleTitle.content !== targetTitle) {
      appleTitle.content = targetTitle;
    }
  }, [isAdminRoute]);

  return null;
}
