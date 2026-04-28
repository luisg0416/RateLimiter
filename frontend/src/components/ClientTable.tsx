import { useState, useEffect } from 'react';
import { getAllClients, deleteClient } from '../api/rateLimiterClient';
import type { ClientConfig } from '../types';

interface ClientTableProps {
  onSelectClient: (clientId: string) => void;
  onEditClient:   (config: ClientConfig) => void;
  onNewClient:    () => void;
  refreshTrigger: number;
}

export function ClientTable({ onSelectClient, onEditClient, onNewClient, refreshTrigger }: ClientTableProps) {

  const [clients, setClients]   = useState<ClientConfig[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error,   setError]     = useState<string | null>(null);

  useEffect(() => {
    async function fetchClients() {
      try {
        setLoading(true);
        setError(null);                      
        const data = await getAllClients();
        setClients(data);
      } catch {
        setError('Failed to load clients.');
      } finally {
        setLoading(false);
      }
    }

    fetchClients();
  }, [refreshTrigger]); 

  async function handleDelete(clientId: string) {
    try {
      await deleteClient(clientId);
      // Filter out the deleted client from the local array
      setClients(prev => prev.filter(c => c.clientId !== clientId));
    } catch {
      setError(`Failed to delete client ${clientId}.`);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ color: 'var(--color-text)' }}>Clients</h2>
        <button onClick={onNewClient}>+ New Client</button>
      </div>

      {/* Loading state */}
      {loading && <p style={{ color: 'var(--color-text-muted)' }}>Loading...</p>}

      {/* Error state */}
      {error && <p style={{ color: 'var(--color-danger)' }}>{error}</p>}

      {/* Empty state */}
      {!loading && !error && clients.length === 0 && (
        <p style={{ color: 'var(--color-text-muted)' }}>No clients configured yet.</p>
      )}

      {/* Table */}
      {!loading && clients.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Client ID', 'Algorithm', 'Limit', 'Window (s)', 'Status', 'Actions'].map(col => (
                <th
                  key={col}
                  style={{
                    textAlign:     'left',
                    padding:       '8px 12px',
                    color:         'var(--color-text-muted)',
                    fontFamily:    'var(--font-mono)',
                    fontSize:      '11px',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    borderBottom:  '1px solid var(--color-border)',
                  }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {clients.map(client => (
              <tr
                key={client.clientId}
                style={{ borderBottom: '1px solid var(--color-border)' }}
              >
                <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', color: 'var(--color-text)' }}>
                  {client.clientId}
                </td>
                <td style={{ padding: '10px 12px', color: 'var(--color-text-muted)' }}>
                  {client.algorithm ?? 'Default'}
                </td>
                <td style={{ padding: '10px 12px', color: 'var(--color-text-muted)' }}>
                  {client.limit ?? 'Default'}
                </td>
                <td style={{ padding: '10px 12px', color: 'var(--color-text-muted)' }}>
                  {client.windowSeconds ?? 'Default'}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ color: client.isEnabled ? 'var(--color-success)' : 'var(--color-danger)' }}>
                    {client.isEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </td>
                <td style={{ padding: '10px 12px', display: 'flex', gap: '8px' }}>
                  <button onClick={() => onSelectClient(client.clientId)}>
                    Select
                  </button>
                  <button onClick={() => onEditClient(client)}>
                    Edit
                  </button>
                  <button onClick={() => handleDelete(client.clientId)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}