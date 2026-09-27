export default function Onboarding() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px', background: 'var(--base)' }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '40px', maxWidth: '500px', width: '100%', textAlign: 'center' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-1)', marginBottom: '16px' }}>Welcome to SpaceScout V2</h1>
                <p style={{ fontSize: '0.95rem', color: 'var(--text-2)', marginBottom: '32px' }}>
                    SpaceScout helps you explore space through natural language. Let's get started.
                </p>
                <button className="btn btn-primary" style={{ width: '100%', padding: '12px' }}>
                    Start Exploring
                </button>
            </div>
        </div>
    );
}
