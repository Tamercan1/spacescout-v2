export default function Explore() {
    return (
        <div className="explore-layout" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="exp-header" style={{ padding: '32px 32px 24px', background: 'var(--base)', flexShrink: 0 }}>
                <div className="exp-header__row1" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                    <h1 className="exp-header__title" style={{ fontSize: '1.4rem', fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--text-1)', lineHeight: 1.2 }}>
                        New Exploration
                    </h1>
                </div>
                <div className="exp-header__summary" style={{ fontSize: '0.95rem', color: 'var(--text-2)', fontWeight: 400, marginBottom: '12px', maxWidth: '800px', lineHeight: 1.6 }}>
                    This is your exploration workspace. Ask a question to begin.
                </div>
            </div>
            <div className="scroll-area" style={{ flex: 1, overflowY: 'auto', padding: '20px 28px 12px' }}>
                <div style={{ color: 'var(--text-3)', textAlign: 'center', width: '100%', gridColumn: '1 / -1', marginTop: '40px' }}>
                    No discoveries yet.
                </div>
            </div>
        </div>
    );
}
