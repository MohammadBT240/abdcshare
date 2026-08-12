import { cn } from '@/lib/utils';

type AuthBrandProps = {
  title: string;
  subtitle?: string;
  className?: string;
};

/** Page title + optional subtitle at the top of an auth form. */
export function AuthBrand({ title, subtitle, className }: AuthBrandProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
      {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
    </div>
  );
}
