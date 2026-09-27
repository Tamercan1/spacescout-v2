export default function Settings() {
    return (
        <div style={{ padding: '32px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--text-1)', marginBottom: '32px' }}>
                Settings
            </h1>
            
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '24px', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-1)', marginBottom: '16px' }}>Account</h2>
                <div className="input-group">
                    <label className="input-label">Username</label>
                    <input type="text" className="input-field" disabled value="CurrentUser" />
                </div>
            </div>

            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-1)', marginBottom: '8px' }}>Provider Credentials</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-2)', marginBottom: '16px' }}>
                    Bring your own keys to use custom models or access private data.
                </p>
                <div className="input-group">
                    <label className="input-label">OpenRouter API Key (Optional)</label>
                    <input type="password" className="input-field" placeholder="sk-or-..." />
                </div>
                <div className="input-group">
                    <label className="input-label">NASA API Key (Optional)</label>
                    <input type="password" className="input-field" placeholder="Enter NASA key" />
                </div>
                <button className="btn btn-primary" style={{ marginTop: '8px' }}>Save Credentials</button>
            </div>
        </div>
    );
}
