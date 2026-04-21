// App.tsx
// The root React component. main.tsx mounts this into the DOM.
// Right now it's a placeholder shell — we'll wire in the real
// layout (header, traffic chart, client table) once those
// components are built.

function App() {
  return (
    <div style={{ padding: '2rem', color: 'var(--color-text)' }}>
      <h1>Rate Limiter Dashboard</h1>
      <p style={{ color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
        Setting up...
      </p>
    </div>
  );
}

export default App;