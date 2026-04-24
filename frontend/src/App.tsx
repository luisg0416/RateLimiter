import { TrafficChart } from './components/TrafficChart';

function App() {
  return (
    <div style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>
      <h1 style={{ color: 'var(--color-text)', marginBottom: '1.5rem' }}>
        Rate Limiter Dashboard
      </h1>
      <TrafficChart clientId="test-client" />
    </div>
  );
}

export default App;