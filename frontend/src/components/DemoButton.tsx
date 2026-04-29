import { useState } from 'react';
import { checkRateLimit } from '../api/rateLimiterClient';

interface DemoButtonProps {
  clientId: string;  // which client to hammer
}

const BURST_COUNT = 150;

export function DemoButton({ clientId }: DemoButtonProps) {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<{ allowed: number; blocked: number } | null>(null);

  async function handleDemo() {
    setRunning(true);
    setResults(null);

    let allowed = 0;
    let blocked = 0;

    const requests = Array.from({ length: BURST_COUNT }, () =>
      checkRateLimit({ clientId })
        .then(result => {
          if (result.isAllowed) allowed++;
          else blocked++;
        })
        .catch(() => {
          blocked++;
        })
    );

    await Promise.all(requests);

    setResults({ allowed, blocked });
    setRunning(false);
  }

  return (
    <div style={{
      background:   'var(--color-surface)',
      border:       '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)',
      padding:      'var(--space-6)',
      display:      'flex',
      alignItems:   'center',
      gap:          'var(--space-4)',
      flexWrap:     'wrap',
    }}>
      <div>
        <h3 style={{ margin: 0, color: 'var(--color-text)', fontSize: 'var(--font-size-base)' }}>
          Demo Mode
        </h3>
        <p style={{ margin: '4px 0 0', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
          Fires {BURST_COUNT} requests at <code style={{ color: 'var(--color-primary)' }}>{clientId}</code> to trigger rate limiting
        </p>
      </div>

      <button
        onClick={handleDemo}
        disabled={running}
        style={{
          background:   running ? 'var(--color-border)' : 'var(--color-danger)',
          color:        '#fff',
          border:       'none',
          borderRadius: 'var(--radius-sm)',
          padding:      '10px 24px',
          cursor:       running ? 'not-allowed' : 'pointer',
          fontWeight:   700,
          fontFamily:   'var(--font-mono)',
          fontSize:     'var(--font-size-sm)',
          letterSpacing: '0.08em',
          whiteSpace:   'nowrap',
        }}
      >
        {running ? 'Firing...' : '⚡ Run Demo'}
      </button>

      {/* Results summary — shown after demo completes */}
      {results && !running && (
        <div style={{ display: 'flex', gap: 'var(--space-4)', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-sm)' }}>
          <span style={{ color: 'var(--color-success)' }}>
            ✓ {results.allowed} allowed
          </span>
          <span style={{ color: 'var(--color-danger)' }}>
            ✗ {results.blocked} blocked
          </span>
        </div>
      )}
    </div>
  );
}