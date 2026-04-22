import type { ReactNode } from 'react';

export interface AppShellItem {
  description?: string;
  href: string;
  label: string;
}

interface AppShellScaffoldProps {
  children: ReactNode;
  currentPath?: string;
  items: AppShellItem[];
  subtitle: string;
  title: string;
}

interface PageScaffoldProps {
  children?: ReactNode;
  description: string;
  eyebrow?: string;
  title: string;
}

export const AppShellScaffold = ({
  children,
  currentPath,
  items,
  subtitle,
  title,
}: AppShellScaffoldProps) => {
  return (
    <div
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at top, rgba(37, 99, 235, 0.12), transparent 35%), #f8fafc',
        color: '#0f172a',
      }}
    >
      <div
        style={{
          display: 'grid',
          gap: '1.5rem',
          gridTemplateColumns: '280px 1fr',
          margin: '0 auto',
          maxWidth: '1440px',
          padding: '1.5rem',
        }}
      >
        <aside
          style={{
            backgroundColor: 'rgba(255,255,255,0.9)',
            border: '1px solid rgba(148,163,184,0.25)',
            borderRadius: '1.25rem',
            padding: '1.5rem',
            position: 'sticky',
            top: '1.5rem',
            height: 'fit-content',
          }}
        >
          <p style={{ color: '#2563eb', fontSize: '0.75rem', fontWeight: 700, margin: 0 }}>
            FOUNDATION
          </p>
          <h1 style={{ fontSize: '1.5rem', margin: '0.5rem 0 0' }}>{title}</h1>
          <p style={{ color: '#475569', lineHeight: 1.6, marginBottom: '1.5rem' }}>{subtitle}</p>

          <nav aria-label="Primary">
            <ul style={{ display: 'grid', gap: '0.75rem', listStyle: 'none', margin: 0, padding: 0 }}>
              {items.map((item) => {
                const isActive = currentPath === item.href;

                return (
                  <li key={item.href}>
                    <a
                      href={item.href}
                      style={{
                        display: 'block',
                        textDecoration: 'none',
                        padding: '0.875rem 1rem',
                        borderRadius: '1rem',
                        backgroundColor: isActive ? '#dbeafe' : '#f8fafc',
                        border: `1px solid ${isActive ? '#93c5fd' : '#e2e8f0'}`,
                        color: '#0f172a',
                      }}
                    >
                      <strong style={{ display: 'block' }}>{item.label}</strong>
                      {item.description ? (
                        <span style={{ color: '#475569', display: 'block', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                          {item.description}
                        </span>
                      ) : null}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>

        <main>{children}</main>
      </div>
    </div>
  );
};

export const PageScaffold = ({ children, description, eyebrow, title }: PageScaffoldProps) => {
  return (
    <section
      style={{
        backgroundColor: 'rgba(255,255,255,0.92)',
        border: '1px solid rgba(148,163,184,0.25)',
        borderRadius: '1.25rem',
        padding: '1.5rem',
      }}
    >
      {eyebrow ? (
        <p style={{ color: '#2563eb', fontSize: '0.75rem', fontWeight: 700, margin: 0 }}>{eyebrow}</p>
      ) : null}
      <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem', marginTop: eyebrow ? '0.5rem' : 0 }}>
        {title}
      </h2>
      <p style={{ color: '#475569', lineHeight: 1.7, marginBottom: children ? '1.5rem' : 0 }}>{description}</p>
      {children}
    </section>
  );
};
