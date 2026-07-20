import type { Config } from 'tailwindcss';

// ACA green identity translated to Tailwind (see docs/DESIGN_SYSTEM.md).
export default {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          hover: 'hsl(var(--aca-primary-hover))',
        },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        sidebar: { from: 'hsl(var(--aca-sidebar-from))', to: 'hsl(var(--aca-sidebar-to))' },
      },
      borderRadius: { lg: 'var(--radius)', md: 'calc(var(--radius) - 0.2rem)', sm: 'calc(var(--radius) - 0.4rem)' },
      boxShadow: { aca: 'var(--shadow-aca)' },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      backgroundImage: {
        sidebar: 'linear-gradient(180deg, hsl(var(--aca-sidebar-from)) 0%, hsl(var(--aca-sidebar-to)) 100%)',
      },
    },
  },
  plugins: [],
} satisfies Config;
