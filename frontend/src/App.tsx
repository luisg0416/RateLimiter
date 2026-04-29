import { useState } from 'react';
import { TrafficChart }      from './components/TrafficChart';
import { ClientTable }       from './components/ClientTable';
import { ClientFormModal }   from './components/ClientFormModal';
import { DemoButton }        from './components/DemoButton';
import type { ClientConfig } from './types';

export default function App() {

  // Which client the chart is currently monitoring
  const [selectedClientId, setSelectedClientId] = useState('test-client');

  // Modal state
  const [modalOpen,       setModalOpen]       = useState(false);
  const [clientToEdit,    setClientToEdit]    = useState<ClientConfig | null>(null);

  // Incrementing this causes ClientTable's useEffect to re-fetch
  const [refreshTrigger,  setRefreshTrigger]  = useState(0);

  function handleNewClient() {
    setClientToEdit(null);   // create mode
    setModalOpen(true);
  }

  function handleEditClient(config: ClientConfig) {
    setClientToEdit(config); // edit mode — modal pre-fills with this
    setModalOpen(true);
  }

  function handleSaved() {
    // Increment refreshTrigger so ClientTable re-fetches after save
    setRefreshTrigger(prev => prev + 1);
  }

  function handleClose() {
    setModalOpen(false);
    setClientToEdit(null);
  }

  return (
    <div style={{
      minHeight:       '100vh',
      background:      'var(--color-bg)',
      color:           'var(--color-text)',
      fontFamily:      'var(--font-sans)',
    }}>

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <header style={{
        borderBottom: '1px solid var(--color-border)',
        padding:      'var(--space-4) var(--space-8)',
        display:      'flex',
        alignItems:   'center',
        gap:          'var(--space-3)',
      }}>
        <h1 style={{ margin: 0, fontSize: 'var(--font-size-xl)', fontFamily: 'var(--font-mono)' }}>
          ⚡ Rate Limiter
        </h1>
        <span style={{
          fontSize:      '11px',
          fontFamily:    'var(--font-mono)',
          color:         'var(--color-text-muted)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          marginTop:     '2px',
        }}>
          Dashboard
        </span>
      </header>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <main style={{
        maxWidth: '1100px',
        margin:   '0 auto',
        padding:  'var(--space-8)',
        display:  'flex',
        flexDirection: 'column',
        gap:      'var(--space-8)',
      }}>

        {/* Live traffic chart for selected client */}
        <TrafficChart clientId={selectedClientId} />

        {/* Demo button — hammers the selected client */}
        <DemoButton clientId={selectedClientId} />

        {/* Client management table */}
        <ClientTable
          onSelectClient={setSelectedClientId}
          onEditClient={handleEditClient}
          onNewClient={handleNewClient}
          refreshTrigger={refreshTrigger}
        />

      </main>

      {/* ── Modal ───────────────────────────────────────────────────────── */}
      <ClientFormModal
        isOpen={modalOpen}
        clientToEdit={clientToEdit}
        onClose={handleClose}
        onSaved={handleSaved}
      />

    </div>
  );
}