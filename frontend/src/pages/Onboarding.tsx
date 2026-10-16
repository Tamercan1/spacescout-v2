import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { completeOnboarding } from '../api/user';
import { saveCredential, validateCredential } from '../api/credentials';
import { 
    Compass, 
    Sparkles, 
    Database, 
    CheckCircle2, 
    XCircle, 
    ArrowRight, 
    ExternalLink,
    Loader2
} from 'lucide-react';

type Step = 'welcome' | 'setup-ai' | 'setup-nasa' | 'complete';

export default function Onboarding() {
    const navigate = useNavigate();
    const { updateUser } = useAuth();

    const [step, setStep] = useState<Step>('welcome');
    const [completing, setCompleting] = useState(false);

    // AI Step
    const [openrouterKey, setOpenrouterKey] = useState('');
    const [aiStatus, setAiStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
    const [aiMessage, setAiMessage] = useState('');

    // NASA Step
    const [nasaKey, setNasaKey] = useState('');
    const [nasaStatus, setNasaStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
    const [nasaMessage, setNasaMessage] = useState('');

    const handleFinish = async () => {
        setCompleting(true);
        try {
            const updatedUser = await completeOnboarding();
            updateUser(updatedUser);
            navigate('/');
        } catch (err) {
            console.error('Failed to complete onboarding', err);
            // Even if the network call failed, try navigating so the user is not stuck
            navigate('/');
        } finally {
            setCompleting(false);
        }
    };

    const handleTestAi = async () => {
        if (!openrouterKey.trim()) {
            setAiStatus('error');
            setAiMessage('Please enter an API key or click skip.');
            return;
        }

        setAiStatus('testing');
        setAiMessage('');

        try {
            await saveCredential('openrouter', openrouterKey.trim());
            const res = await validateCredential('openrouter');
            if (res.is_valid) {
                setAiStatus('success');
                setAiMessage('Connection verified successfully!');
            } else {
                setAiStatus('error');
                setAiMessage(res.detail || 'Could not verify key. Please check and try again.');
            }
        } catch {
            setAiStatus('error');
            setAiMessage('Failed to save or validate key. You can skip and configure later.');
        }
    };

    const handleTestNasa = async () => {
        if (!nasaKey.trim()) {
            setNasaStatus('error');
            setNasaMessage('Please enter an API key or click skip.');
            return;
        }

        setNasaStatus('testing');
        setNasaMessage('');

        try {
            await saveCredential('nasa', nasaKey.trim());
            const res = await validateCredential('nasa');
            if (res.is_valid) {
                setNasaStatus('success');
                setNasaMessage('NASA telemetry verified successfully!');
            } else {
                setNasaStatus('error');
                setNasaMessage(res.detail || 'Could not verify key. Please check and try again.');
            }
        } catch {
            setNasaStatus('error');
            setNasaMessage('Failed to save or validate key. You can skip and configure later.');
        }
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '24px',
            background: 'var(--base)',
            color: 'var(--text-1)'
        }}>
            <div className="card" style={{
                maxWidth: '460px',
                width: '100%',
                padding: '36px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg, 12px)',
                boxShadow: '0 12px 40px rgba(0,0,0,0.15)'
            }}>

                {/* ========================================================
                    WELCOME
                ======================================================== */}
                {step === 'welcome' && (
                    <div style={{ textAlign: 'center' }}>
                        <div style={{
                            width: '52px',
                            height: '52px',
                            borderRadius: '12px',
                            background: 'var(--surface-2)',
                            color: 'var(--blue)',
                            border: '1px solid var(--border)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: '20px'
                        }}>
                            <Compass size={28} />
                        </div>
                        <h1 style={{ fontSize: '1.45rem', fontWeight: 700, marginBottom: '8px' }}>
                            Welcome to SpaceScout
                        </h1>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-2)', lineHeight: 1.6, marginBottom: '28px' }}>
                            Turn your curiosity about space into discoveries backed by real NASA data.
                            <br /><br />
                            Before your first exploration, we'll guide you through a quick, two-step API setup so SpaceScout can connect to the cosmos.
                        </p>

                        <button
                            type="button"
                            className="btn btn-primary"
                            style={{ width: '100%', padding: '12px', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                            onClick={() => setStep('setup-ai')}
                        >
                            Start Quick Setup <ArrowRight size={16} />
                        </button>
                        <button
                            type="button"
                            className="btn btn-ghost"
                            style={{ width: '100%', padding: '10px', color: 'var(--text-2)' }}
                            disabled={completing}
                            onClick={handleFinish}
                        >
                            {completing ? 'Loading...' : 'Skip setup for now'}
                        </button>
                    </div>
                )}

                {/* ========================================================
                    STEP 1: OPENROUTER
                ======================================================== */}
                {step === 'setup-ai' && (
                    <div>
                        <div style={{ marginBottom: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                <span>Step 1 of 2</span>
                                <span>AI Engine</span>
                            </div>
                            <div style={{ width: '100%', height: '4px', background: 'var(--surface-2)', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{ width: '50%', height: '100%', background: 'var(--blue)', borderRadius: '4px' }} />
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--blue)' }}>
                                <Sparkles size={20} />
                            </div>
                            <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Connect AI Engine</h2>
                        </div>

                        <div style={{
                            padding: '16px',
                            background: 'var(--surface-2)',
                            borderRadius: 'var(--radius, 8px)',
                            border: '1px solid var(--border)',
                            marginBottom: '20px'
                        }}>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-2)', lineHeight: 1.5, marginBottom: '10px' }}>
                                SpaceScout uses <strong>OpenRouter</strong> to interpret natural language questions and coordinate NASA scientific tools.
                            </p>
                            <a
                                href="https://openrouter.ai/keys"
                                target="_blank"
                                rel="noreferrer"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.82rem', color: 'var(--blue)', textDecoration: 'none', fontWeight: 500 }}
                            >
                                Get a free OpenRouter key <ExternalLink size={12} />
                            </a>

                            <div style={{ marginTop: '16px' }}>
                                <label htmlFor="openrouter-key" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                                    OpenRouter API Key
                                </label>
                                <input
                                    id="openrouter-key"
                                    type="password"
                                    className="input-field"
                                    placeholder="sk-or-v1-..."
                                    value={openrouterKey}
                                    onChange={(e) => {
                                        setOpenrouterKey(e.target.value);
                                        if (aiStatus !== 'idle') {
                                            setAiStatus('idle');
                                            setAiMessage('');
                                        }
                                    }}
                                    style={{ width: '100%', padding: '10px 12px', fontSize: '0.88rem' }}
                                />
                            </div>

                            {aiStatus === 'success' && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--green)', fontSize: '0.82rem', marginTop: '10px' }}>
                                    <CheckCircle2 size={14} /> {aiMessage}
                                </div>
                            )}

                            {aiStatus === 'error' && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--red)', fontSize: '0.82rem', marginTop: '10px' }}>
                                    <XCircle size={14} /> {aiMessage}
                                </div>
                            )}
                        </div>

                        {aiStatus === 'success' ? (
                            <button
                                type="button"
                                className="btn btn-primary"
                                style={{ width: '100%', padding: '12px', marginBottom: '12px' }}
                                onClick={() => setStep('setup-nasa')}
                            >
                                Continue to Step 2
                            </button>
                        ) : (
                            <button
                                type="button"
                                className="btn btn-primary"
                                style={{ width: '100%', padding: '12px', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                disabled={aiStatus === 'testing'}
                                onClick={handleTestAi}
                            >
                                {aiStatus === 'testing' ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" /> Verifying...
                                    </>
                                ) : (
                                    'Test & Save Connection'
                                )}
                            </button>
                        )}

                        <div style={{ textAlign: 'center' }}>
                            <button
                                type="button"
                                className="btn btn-ghost"
                                style={{ fontSize: '0.85rem', color: 'var(--text-2)' }}
                                onClick={() => setStep('setup-nasa')}
                            >
                                Skip this step
                            </button>
                        </div>
                    </div>
                )}

                {/* ========================================================
                    STEP 2: NASA API
                ======================================================== */}
                {step === 'setup-nasa' && (
                    <div>
                        <div style={{ marginBottom: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                <span>Step 2 of 2</span>
                                <span>NASA Telemetry</span>
                            </div>
                            <div style={{ width: '100%', height: '4px', background: 'var(--surface-2)', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{ width: '100%', height: '100%', background: 'var(--blue)', borderRadius: '4px' }} />
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--blue)' }}>
                                <Database size={20} />
                            </div>
                            <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Connect NASA Data</h2>
                        </div>

                        <div style={{
                            padding: '16px',
                            background: 'var(--surface-2)',
                            borderRadius: 'var(--radius, 8px)',
                            border: '1px solid var(--border)',
                            marginBottom: '20px'
                        }}>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-2)', lineHeight: 1.5, marginBottom: '10px' }}>
                                Retrieve asteroid tracking, solar events, and planetary imagery directly from NASA databases.
                            </p>
                            <a
                                href="https://api.nasa.gov/"
                                target="_blank"
                                rel="noreferrer"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.82rem', color: 'var(--blue)', textDecoration: 'none', fontWeight: 500 }}
                            >
                                Generate a free NASA API key <ExternalLink size={12} />
                            </a>

                            <div style={{ marginTop: '16px' }}>
                                <label htmlFor="nasa-key" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                                    NASA API Key
                                </label>
                                <input
                                    id="nasa-key"
                                    type="password"
                                    className="input-field"
                                    placeholder="Enter your NASA API key"
                                    value={nasaKey}
                                    onChange={(e) => {
                                        setNasaKey(e.target.value);
                                        if (nasaStatus !== 'idle') {
                                            setNasaStatus('idle');
                                            setNasaMessage('');
                                        }
                                    }}
                                    style={{ width: '100%', padding: '10px 12px', fontSize: '0.88rem' }}
                                />
                            </div>

                            {nasaStatus === 'success' && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--green)', fontSize: '0.82rem', marginTop: '10px' }}>
                                    <CheckCircle2 size={14} /> {nasaMessage}
                                </div>
                            )}

                            {nasaStatus === 'error' && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--red)', fontSize: '0.82rem', marginTop: '10px' }}>
                                    <XCircle size={14} /> {nasaMessage}
                                </div>
                            )}
                        </div>

                        {nasaStatus === 'success' ? (
                            <button
                                type="button"
                                className="btn btn-primary"
                                style={{ width: '100%', padding: '12px', marginBottom: '12px' }}
                                onClick={() => setStep('complete')}
                            >
                                Finish Setup
                            </button>
                        ) : (
                            <button
                                type="button"
                                className="btn btn-primary"
                                style={{ width: '100%', padding: '12px', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                disabled={nasaStatus === 'testing'}
                                onClick={handleTestNasa}
                            >
                                {nasaStatus === 'testing' ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" /> Verifying...
                                    </>
                                ) : (
                                    'Test & Save Connection'
                                )}
                            </button>
                        )}

                        <div style={{ textAlign: 'center' }}>
                            <button
                                type="button"
                                className="btn btn-ghost"
                                style={{ fontSize: '0.85rem', color: 'var(--text-2)' }}
                                onClick={() => setStep('complete')}
                            >
                                Skip this step
                            </button>
                        </div>
                    </div>
                )}

                {/* ========================================================
                    COMPLETE
                ======================================================== */}
                {step === 'complete' && (
                    <div style={{ textAlign: 'center' }}>
                        <div style={{
                            width: '52px',
                            height: '52px',
                            borderRadius: '12px',
                            background: 'var(--green-dim, rgba(22, 163, 74, 0.1))',
                            color: 'var(--green)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: '20px'
                        }}>
                            <CheckCircle2 size={32} />
                        </div>

                        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '8px' }}>
                            You're ready to explore
                        </h2>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-2)', lineHeight: 1.6, marginBottom: '24px' }}>
                            SpaceScout is configured. You can always update or provide additional provider credentials anytime in Settings.
                        </p>

                        <div style={{
                            padding: '16px',
                            background: 'var(--surface-2)',
                            borderRadius: 'var(--radius, 8px)',
                            border: '1px solid var(--border)',
                            textAlign: 'left',
                            marginBottom: '24px'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-2)' }}>AI Engine:</span>
                                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: aiStatus === 'success' ? 'var(--green)' : 'var(--text-1)' }}>
                                    {aiStatus === 'success' ? 'Custom Key' : 'System Default'}
                                </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-2)' }}>NASA API:</span>
                                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: nasaStatus === 'success' ? 'var(--green)' : 'var(--text-1)' }}>
                                    {nasaStatus === 'success' ? 'Custom Key' : 'System Default'}
                                </span>
                            </div>
                        </div>

                        <button
                            type="button"
                            className="btn btn-primary"
                            style={{ width: '100%', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                            disabled={completing}
                            onClick={handleFinish}
                        >
                            {completing ? 'Launching...' : 'Start Exploring'}
                            {!completing && <ArrowRight size={16} />}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
