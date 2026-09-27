export default function Home() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100%', padding: '40px 20px' }}>
            <div style={{ textAlign: 'center', maxWidth: '600px', width: '100%' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, letterSpacing: '0.05em', color: 'var(--blue)', textTransform: 'uppercase', marginBottom: '12px' }}>
                    NASA-backed space exploration
                </div>
                <h1 style={{ fontSize: '2.4rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-1)', marginBottom: '32px', lineHeight: 1.2 }}>
                    What are you curious about today?
                </h1>
                
                <div className="input-group">
                    <input 
                        type="text" 
                        className="input-field" 
                        placeholder="e.g. Are there any asteroids approaching Earth?" 
                        style={{ padding: '16px 20px', fontSize: '1rem', borderRadius: 'var(--radius-lg)' }}
                    />
                </div>
                <button className="btn btn-primary" style={{ marginTop: '8px', padding: '12px 24px', fontSize: '1rem' }}>
                    Explore
                </button>
            </div>
        </div>
    );
}
