import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";

// Haut des écrans d'accès : pastille, titre en deux temps (la fin en rouge) et phrase d'accompagnement.
export function AuthHeading({
  badge,
  badgeIcon = "calendrier",
  title,
  accent,
  children,
}: {
  badge?: string;
  badgeIcon?: IconName;
  title: string;
  accent?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-8">
      {badge ? (
        <p className="mb-6 inline-flex items-center gap-2 rounded-full bg-red/[0.07] px-3.5 py-1.5 text-[14px] font-semibold text-accent-text">
          <Icon name={badgeIcon} width={17} height={17} />
          {badge}
        </p>
      ) : null}
      <h1 className="font-heading text-[34px] leading-[1.08] font-extrabold tracking-[-0.025em] text-text sm:text-[42px]">
        {title}
        {accent ? (
          <>
            <br />
            <span className="text-accent-text">{accent}</span>
          </>
        ) : null}
      </h1>
      {children ? <p className="mt-4 max-w-[420px] text-[16px] leading-[1.55] text-text-muted">{children}</p> : null}
    </div>
  );
}
