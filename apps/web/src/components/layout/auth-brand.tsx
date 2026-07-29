import Image from 'next/image';
import { cn } from '@/lib/utils';

type AuthBrandProps = {
  title: string;
  subtitle?: string;
  hint?: string;
  className?: string;
};

/** Circular logo + headings at the top of an auth card (legacy sign-in style). */
export function AuthBrand({ title, subtitle, hint, className }: AuthBrandProps) {
  return (
    <div className={cn('flex flex-col items-center space-y-2 text-center', className)}>
      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-border bg-card shadow-sm">
        <Image
          src="/logos/abdc_logo_sm.png"
          alt="Abdulkadeer & Co."
          width={52}
          height={52}
          className="h-12 w-12 object-contain"
          priority
        />
      </div>
      <h1 className="pt-1 text-xl font-bold text-foreground">{title}</h1>
      {subtitle ? (
        <p className="max-w-xs text-sm text-muted-foreground">{subtitle}</p>
      ) : null}
      {hint ? <p className="text-xs text-muted-foreground/80">{hint}</p> : null}
    </div>
  );
}

const FOOTER_LINKS = ['Company Profile', 'About', 'Services', 'Contact Us'];

/** Quiet footer link row under auth cards (legacy sign-in style). */
export function AuthCardFooter() {
  return (
    <div className="flex items-center justify-center gap-4 border-t border-border pt-4">
      {FOOTER_LINKS.map((label) => (
        <span key={label} className="text-xs text-muted-foreground">
          {label}
        </span>
      ))}
    </div>
  );
}
