import { useState, useEffect } from 'react';
import { createClient, updateClient } from '../api/rateLimiterClient';
import type { ClientConfig } from '../types';

interface ClientFormModalProps {
  isOpen:        boolean;
  clientToEdit:  ClientConfig | null;
  onClose:       () => void;      
  onSaved:       () => void;           
}

// Default form state — all fields empty
const EMPTY_FORM = {
  clientId:           '',
  name:               '',
  algorithm:          'SlidingWindow',
  limit:              100,
  windowSeconds:      60,
  refillRatePerSecond: 1,
  isEnabled:          true,
};

export function ClientFormModal({ isOpen, clientToEdit, onClose, onSaved }: ClientFormModalProps) {

  const [form,    setForm]    = useState(EMPTY_FORM);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (clientToEdit) {
      setForm({
        clientId:            clientToEdit.clientId,
        name:                clientToEdit.name               ?? '',
        algorithm:           clientToEdit.algorithm          ?? 'SlidingWindow',
        limit:               clientToEdit.limit              ?? 100,
        windowSeconds:       clientToEdit.windowSeconds      ?? 60,
        refillRatePerSecond: clientToEdit.refillRatePerSecond ?? 1,
        isEnabled:           clientToEdit.isEnabled,
      });
    } else {
      setForm(EMPTY_FORM);
    }

    setError(null);
  }, [isOpen, clientToEdit]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value, type } = e.target;

    setForm(prev => ({
      ...prev,
      [name]: type === 'number'   ? Number(value)
            : type === 'checkbox' ? (e.target as HTMLInputElement).checked
            : value,
    }));
  }

  async function handleSubmit() {
    if (!form.clientId.trim()) {
      setError('Client ID is required.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const config: ClientConfig = {
        clientId:            form.clientId.trim(),
        name:                form.name || null,
        algorithm:           form.algorithm,
        limit:               form.limit,
        windowSeconds:       form.windowSeconds,
        refillRatePerSecond: form.refillRatePerSecond,
        isEnabled:           form.isEnabled,
        createdAt:           clientToEdit?.createdAt ?? '',
        updatedAt:           '',
      };

      if (clientToEdit) {
        await updateClient(config.clientId, config);
      } else {
        await createClient(config);
      }

      onSaved();
      onClose(); 

    } catch {
      setError(clientToEdit ? 'Failed to update client.' : 'Failed to create client.');
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  const isEditing = clientToEdit !== null;

  return (
    <div
      onClick={onClose}
      style={{
        position:        'fixed',
        inset:           0,
        background:      'rgba(0,0,0,0.6)',
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        zIndex:          50,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background:   'var(--color-surface)',
          border:       '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding:      'var(--space-8)',
          width:        '100%',
          maxWidth:     '480px',
          display:      'flex',
          flexDirection: 'column',
          gap:          'var(--space-4)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 'var(--font-size-lg)', color: 'var(--color-text)' }}>
            {isEditing ? `Edit — ${clientToEdit.clientId}` : 'New Client'}
          </h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}
          >
            ✕
          </button>
        </div>

        {error && (
          <p style={{ color: 'var(--color-danger)', margin: 0, fontSize: 'var(--font-size-sm)' }}>
            {error}
          </p>
        )}

        <Field label="Client ID">
          <input
            name="clientId"
            value={form.clientId}
            onChange={handleChange}
            readOnly={isEditing}
            placeholder="e.g. my-service"
            style={inputStyle(isEditing)}
          />
        </Field>

        {/* Name */}
        <Field label="Name (optional)">
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="e.g. My Service"
            style={inputStyle()}
          />
        </Field>

        {/* Algorithm */}
        <Field label="Algorithm">
          <select name="algorithm" value={form.algorithm} onChange={handleChange} style={inputStyle()}>
            <option value="SlidingWindow">Sliding Window</option>
            <option value="TokenBucket">Token Bucket</option>
          </select>
        </Field>

        {/* Limit */}
        <Field label="Request Limit">
          <input
            name="limit"
            type="number"
            value={form.limit}
            onChange={handleChange}
            min={1}
            style={inputStyle()}
          />
        </Field>

        {/* Window seconds — only relevant for sliding window */}
        {form.algorithm === 'SlidingWindow' && (
          <Field label="Window (seconds)">
            <input
              name="windowSeconds"
              type="number"
              value={form.windowSeconds}
              onChange={handleChange}
              min={1}
              style={inputStyle()}
            />
          </Field>
        )}

        {/* Refill rate — only relevant for token bucket */}
        {form.algorithm === 'TokenBucket' && (
          <Field label="Refill Rate (per second)">
            <input
              name="refillRatePerSecond"
              type="number"
              value={form.refillRatePerSecond}
              onChange={handleChange}
              min={0.1}
              step={0.1}
              style={inputStyle()}
            />
          </Field>
        )}

        {/* Enabled toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <input
            id="isEnabled"
            name="isEnabled"
            type="checkbox"
            checked={form.isEnabled}
            onChange={handleChange}
          />
          <label htmlFor="isEnabled" style={{ color: 'var(--color-text)', fontSize: 'var(--font-size-sm)' }}>
            Enabled
          </label>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
          <button onClick={onClose} style={secondaryButtonStyle}>
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving} style={primaryButtonStyle}>
            {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Client'}
          </button>
        </div>

      </div>
    </div>
  );
}

// Field wraps a label + input pair so we don't repeat that layout everywhere
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
      <label style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function inputStyle(readOnly = false): React.CSSProperties {
  return {
    background:   readOnly ? 'var(--color-border)' : 'var(--color-bg)',
    border:       '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    color:        'var(--color-text)',
    padding:      '8px 10px',
    width:        '100%',
    opacity:      readOnly ? 0.6 : 1,
  };
}

const primaryButtonStyle: React.CSSProperties = {
  background:   'var(--color-primary)',
  color:        '#fff',
  border:       'none',
  borderRadius: 'var(--radius-sm)',
  padding:      '8px 20px',
  cursor:       'pointer',
  fontWeight:   600,
};

const secondaryButtonStyle: React.CSSProperties = {
  background:   'transparent',
  color:        'var(--color-text-muted)',
  border:       '1px solid var(--color-border)',
  borderRadius: 'var(--radius-sm)',
  padding:      '8px 20px',
  cursor:       'pointer',
};