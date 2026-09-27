export default function Explorations() {
    return (
        <div style={{ padding: '32px' }}>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--text-1)', marginBottom: '24px' }}>
                Explorations
            </h1>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                <div className="card" style={{ padding: '20px', cursor: 'pointer' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-1)', marginBottom: '8px' }}>Sample Exploration</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-2)' }}>3 discoveries • Just now</p>
                </div>
            </div>
        </div>
    );
}
