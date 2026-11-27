import Image from "next/image";
import Link from "next/link";

export function BrandLogo({
  href = "/",
  compact = false,
  className = "",
}: {
  href?: string;
  compact?: boolean;
  className?: string;
}) {
  const inner = (
    <div className={`inline-flex items-center ${className}`}>
      <Image
        src="/brand/zanima-logo-horizontal.png"
        alt="ZANIMA ESTÚDIO"
        width={300}
        height={100}
        className={
          compact
            ? "h-8 w-auto object-contain shrink-0"
            : "h-10 w-auto object-contain shrink-0"
        }
        priority
      />
    </div>
  );

  if (!href) return inner;
  return (
    <Link href={href} className="inline-flex items-center focus:outline-none">
      {inner}
    </Link>
  );
}

export function BrandMonogramOnly({ size = 28 }: { size?: number }) {
  return (
    <Image
      src="/brand/zanima-monogram.png"
      alt="ZANIMA"
      width={size}
      height={size}
      className="object-contain shrink-0"
      style={{ width: size, height: size }}
    />
  );
}

export function PconSignature({ className = "" }: { className?: string }) {
  return (
    <span className={`text-[11px] text-[var(--text-secondary)] ${className}`}>
      DESENVOLVIDO POR{" "}
      <a
        href="https://www.instagram.com/pconconstrunet/"
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-[var(--text-primary)] hover:underline underline-offset-4 transition-colors"
      >
        P-CON CONSTRUNET LTDA
      </a>
    </span>
  );
}
