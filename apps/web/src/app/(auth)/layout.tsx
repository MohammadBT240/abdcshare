import Image from 'next/image';

const HIGHLIGHTS = [
  'Trusted expertise across accounting, assurance, and corporate advisory.',
  'Practical guidance tailored to business and institutional needs.',
  'Professional standards with consistent, timely delivery.',
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Brand panel — legacy split layout, hidden on small screens */}
      <div className="relative hidden flex-1 items-center bg-gradient-to-br from-primary/5 via-background to-primary/10 lg:flex">
        <div className="mx-auto w-full max-w-md px-10">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border border-border bg-card shadow-aca">
            <Image
              src="/logos/abdc_logo_sm.png"
              alt=""
              width={64}
              height={64}
              className="h-14 w-14 object-contain"
              priority
            />
          </div>
          <h1 className="mt-8 text-3xl font-bold leading-tight text-foreground">
            Abdulkadeer &amp; Co. (Chartered Accountants)
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Reliable audit, tax, and advisory services that help organizations stay compliant and
            confidently grow.
          </p>
          <ul className="mt-6 space-y-3">
            {HIGHLIGHTS.map((item) => (
              <li key={item} className="flex gap-2 text-sm text-muted-foreground">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
