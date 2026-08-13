import Image from 'next/image';

const SUPPORTING =
  'Reliable audit, tax, and advisory services that help organizations stay compliant and confidently grow.';

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? 'flex items-center gap-3' : undefined}>
      <div
        className={
          compact
            ? 'flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-card'
            : 'flex h-16 w-16 items-center justify-center rounded-full border border-border bg-card'
        }
      >
        <Image
          src="/logos/abdc_logo_sm.png"
          alt=""
          width={compact ? 36 : 52}
          height={compact ? 36 : 52}
          className={compact ? 'h-8 w-8 object-contain' : 'h-12 w-12 object-contain'}
          priority
        />
      </div>
      {compact ? (
        <p className="text-sm font-semibold leading-snug text-foreground">
          Abdulkadeer &amp; Co.
        </p>
      ) : (
        <>
          <h1 className="mt-8 text-3xl font-bold leading-tight tracking-tight text-foreground">
            Abdulkadeer &amp; Co. (Chartered Accountants)
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{SUPPORTING}</p>
        </>
      )}
    </div>
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background lg:flex-row">
      {/* Mobile brand strip */}
      <div className="border-b border-border bg-gradient-to-br from-primary/5 via-background to-primary/10 px-6 py-5 lg:hidden">
        <BrandMark compact />
      </div>

      {/* Desktop brand plane */}
      <div className="relative hidden flex-1 items-center bg-gradient-to-br from-primary/5 via-background to-primary/10 lg:flex">
        <div className="mx-auto w-full max-w-md px-10">
          <BrandMark />
        </div>
      </div>

      {/* Form plane */}
      <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6 lg:py-12">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
