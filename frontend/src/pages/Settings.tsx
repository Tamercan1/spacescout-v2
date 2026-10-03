import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { User, Key, Settings as SettingsIcon, CheckCircle2, AlertCircle, RefreshCw, XCircle } from 'lucide-react';
import { getCredentials, saveCredential, deleteCredential, validateCredential } from "../api/credentials";
import type { ProviderCredential } from "../types/credentials";

export default function Settings() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState("account");

    // BYOK State
    const [credentials, setCredentials] = useState<ProviderCredential[]>([]);
    const [credsLoading, setCredsLoading] = useState(false);
    const [openRouterKey, setOpenRouterKey] = useState("");
    const [nasaKey, setNasaKey] = useState("");
    const [loadingProvider, setLoadingProvider] = useState<Record<string, string>>({});
    const [providerError, setProviderError] = useState<Record<string, string | null>>({});

    const fetchCredentials = async () => {
        setCredsLoading(true);
        try {
            const data = await getCredentials();
            setCredentials(data);
        } catch {
            console.error("Failed to load credentials");
        } finally {
            setCredsLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === "credentials") {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            fetchCredentials();
        }
    }, [activeTab]);

    const handleSave = async (provider: string, key: string) => {
        if (!key.trim()) return;
        setLoadingProvider(prev => ({ ...prev, [provider]: 'saving' }));
        setProviderError(prev => ({ ...prev, [provider]: null }));
        try {
            await saveCredential(provider, key);
            if (provider === 'openrouter') setOpenRouterKey("");
            if (provider === 'nasa') setNasaKey("");
            await fetchCredentials();
        } catch {
            setProviderError(prev => ({ ...prev, [provider]: "Failed to save API key." }));
        } finally {
            setLoadingProvider(prev => ({ ...prev, [provider]: '' }));
        }
    };

    const handleDelete = async (provider: string) => {
        if (!confirm(`Are you sure you want to remove your ${provider} key?`)) return;
        setLoadingProvider(prev => ({ ...prev, [provider]: 'deleting' }));
        setProviderError(prev => ({ ...prev, [provider]: null }));
        try {
            await deleteCredential(provider);
            await fetchCredentials();
        } catch {
            setProviderError(prev => ({ ...prev, [provider]: "Failed to delete API key." }));
        } finally {
            setLoadingProvider(prev => ({ ...prev, [provider]: '' }));
        }
    };

    const handleValidate = async (provider: string) => {
        setLoadingProvider(prev => ({ ...prev, [provider]: 'validating' }));
        setProviderError(prev => ({ ...prev, [provider]: null }));
        try {
            await validateCredential(provider);
            await fetchCredentials();
        } catch (err: unknown) {
            const error = err as { response?: { status: number, data?: { detail?: string } } };
            if (error.response?.status === 502) {
                setProviderError(prev => ({ ...prev, [provider]: error.response?.data?.detail || "Validation temporarily unavailable. Try again later." }));
            } else {
                setProviderError(prev => ({ ...prev, [provider]: "Failed to validate API key." }));
            }
            await fetchCredentials();
        } finally {
            setLoadingProvider(prev => ({ ...prev, [provider]: '' }));
        }
    };

    const getProviderCred = (provider: string) => credentials.find(c => c.provider === provider);

    const renderValidationState = (cred: ProviderCredential | undefined) => {
        if (!cred) return null;
        if (cred.is_valid === true) {
            return <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--green)' }}><CheckCircle2 size={14} /> API key verified</div>;
        }
        if (cred.is_valid === false) {
            return <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--red)' }}><XCircle size={14} /> API key could not be verified</div>;
        }
        return <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}><AlertCircle size={14} /> Not validated</div>;
    };

    const [theme, setTheme] = useState(() => {
        return document.documentElement.classList.contains('theme-dark') ? 'dark' : 'light';
    });

    const handleThemeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newTheme = e.target.value;
        setTheme(newTheme);
        if (newTheme === 'dark') {
            document.documentElement.classList.add('theme-dark');
            document.documentElement.classList.remove('theme-light');
        } else {
            document.documentElement.classList.add('theme-light');
            document.documentElement.classList.remove('theme-dark');
        }
    };

    return (
        <div className="settings-page">
            {/* Settings Navigation */}
            <div className="settings-nav">
                <div className="settings-nav__label">Settings</div>
                <div
                    className={`settings-nav__item ${activeTab === 'account' ? 'active' : ''}`}
                    onClick={() => setActiveTab("account")}
                >
                    <User size={14} /> Account
                </div>
                <div
                    className={`settings-nav__item ${activeTab === 'credentials' ? 'active' : ''}`}
                    onClick={() => setActiveTab("credentials")}
                >
                    <Key size={14} /> API Keys (BYOK)
                </div>
                <div
                    className={`settings-nav__item ${activeTab === 'preferences' ? 'active' : ''}`}
                    onClick={() => setActiveTab("preferences")}
                >
                    <SettingsIcon size={14} /> Preferences
                </div>
            </div>

            {/* Mobile Settings Tabs */}
            <div className="settings-tabs-mobile">
                <div
                    className={`settings-tab-pill ${activeTab === 'account' ? 'active' : ''}`}
                    onClick={() => setActiveTab("account")}
                >
                    Account
                </div>
                <div
                    className={`settings-tab-pill ${activeTab === 'credentials' ? 'active' : ''}`}
                    onClick={() => setActiveTab("credentials")}
                >
                    API Keys
                </div>
                <div
                    className={`settings-tab-pill ${activeTab === 'preferences' ? 'active' : ''}`}
                    onClick={() => setActiveTab("preferences")}
                >
                    Preferences
                </div>
            </div>

            {/* Settings Content */}
            <div className="settings-content">
                {activeTab === "account" && (
                    <div className="settings-section">
                        <h2 className="settings-section__title">Account</h2>
                        <p className="settings-section__sub">Your profile and login information.</p>

                        <div className="settings-row">
                            <div>
                                <div className="settings-row__label">Username</div>
                                <div className="settings-row__sub">Your display name</div>
                            </div>
                            <input type="text" className="settings-input" disabled value={user?.username || ''} />
                        </div>

                        <div className="settings-row">
                            <div>
                                <div className="settings-row__label">Email</div>
                                <div className="settings-row__sub">Used for account recovery</div>
                            </div>
                            <input type="text" className="settings-input" disabled value={user?.email || 'user@example.com'} />
                        </div>

                        <div className="settings-row">
                            <div>
                                <div className="settings-row__label">Password</div>
                                <div className="settings-row__sub">Last changed: never</div>
                            </div>
                            <button className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: '0.76rem' }}>Change password</button>
                        </div>

                        <div className="settings-section" style={{ marginTop: '32px' }}>
                            <h3 className="settings-section__title" style={{ color: 'var(--red)' }}>Danger zone</h3>
                            <p className="settings-section__sub">Permanent actions. These cannot be undone.</p>

                            <div className="settings-row" style={{ borderColor: 'var(--red-dim)' }}>
                                <div>
                                    <div className="settings-row__label">Delete account</div>
                                    <div className="settings-row__sub">Permanently deletes all explorations and data</div>
                                </div>
                                <button className="btn" style={{ border: '1px solid var(--red)', color: 'var(--red)', padding: '5px 10px', fontSize: '0.76rem' }}>Delete account</button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === "credentials" && (
                    <div className="settings-section">
                        <h2 className="settings-section__title">API Keys — Bring Your Own Key</h2>
                        <p className="settings-section__sub">
                            Optionally provide your own credentials. Your keys are stored securely and never exposed in API responses or logs.
                        </p>

                        {!getProviderCred('openrouter') && !getProviderCred('nasa') && (
                            <div className="byok-banner">
                                <strong>Using application defaults.</strong> Add your own OpenRouter and NASA keys below to use your quota instead of the shared application limit.
                            </div>
                        )}

                        {credsLoading && credentials.length === 0 ? (
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '24px' }}>Loading credentials...</div>
                        ) : (
                            <>
                                {/* OpenRouter Section */}
                                <div className="settings-row" style={{ alignItems: 'flex-start', paddingBottom: '24px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, paddingRight: '20px' }}>
                                        <div>
                                            <div className="settings-row__label">OpenRouter API Key</div>
                                            <div className="settings-row__sub">Used for AI exploration planning</div>
                                        </div>

                                        {getProviderCred('openrouter') && (
                                            <div style={{ fontSize: '0.85rem', marginTop: '4px' }}>
                                                {renderValidationState(getProviderCred('openrouter'))}
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'flex-end', width: '320px' }}>
                                        <div style={{ width: '100%' }}>
                                            <input
                                                type="password"
                                                className="settings-input"
                                                style={{ width: '100%' }}
                                                placeholder={getProviderCred('openrouter') ? "Enter new key to replace" : "sk-or-••••••••••••••••••"}
                                                value={openRouterKey}
                                                onChange={e => setOpenRouterKey(e.target.value)}
                                            />
                                            {getProviderCred('openrouter') && (
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px', textAlign: 'right' }}>
                                                    Configured ({getProviderCred('openrouter')?.key_hint})
                                                </div>
                                            )}
                                        </div>

                                        <div style={{ display: 'flex', gap: '8px', width: '100%', justifyContent: 'flex-end' }}>
                                            <button
                                                className="btn btn-primary"
                                                style={{ padding: '5px 10px', fontSize: '0.76rem' }}
                                                onClick={() => handleSave('openrouter', openRouterKey)}
                                                disabled={!openRouterKey.trim() || loadingProvider['openrouter'] === 'saving'}
                                            >
                                                {loadingProvider['openrouter'] === 'saving' ? 'Saving...' : getProviderCred('openrouter') ? 'Replace key' : 'Save key'}
                                            </button>

                                            {getProviderCred('openrouter') && (
                                                <>
                                                    <button
                                                        className="btn btn-secondary"
                                                        style={{ padding: '5px 10px', fontSize: '0.76rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                        onClick={() => handleValidate('openrouter')}
                                                        disabled={loadingProvider['openrouter'] === 'validating'}
                                                    >
                                                        {loadingProvider['openrouter'] === 'validating' ? <RefreshCw size={12} className="spinning" /> : null}
                                                        {loadingProvider['openrouter'] === 'validating' ? "Validating..." : "Validate"}
                                                    </button>
                                                    <button
                                                        className="btn btn-secondary"
                                                        style={{ padding: '5px 10px', fontSize: '0.76rem', color: 'var(--red)' }}
                                                        onClick={() => handleDelete('openrouter')}
                                                        disabled={loadingProvider['openrouter'] === 'deleting'}
                                                    >
                                                        {loadingProvider['openrouter'] === 'deleting' ? 'Removing...' : 'Remove'}
                                                    </button>
                                                </>
                                            )}
                                        </div>

                                        {providerError['openrouter'] && (
                                            <div style={{ color: 'var(--red)', fontSize: '0.8rem', textAlign: 'right' }}>
                                                {providerError['openrouter']}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* NASA Section */}
                                <div className="settings-row" style={{ alignItems: 'flex-start', paddingBottom: '24px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, paddingRight: '20px' }}>
                                        <div>
                                            <div className="settings-row__label">NASA API Key</div>
                                            <div className="settings-row__sub">NeoWs, APOD, DONKI, and more</div>
                                        </div>

                                        {getProviderCred('nasa') && (
                                            <div style={{ fontSize: '0.85rem', marginTop: '4px' }}>
                                                {renderValidationState(getProviderCred('nasa'))}
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'flex-end', width: '320px' }}>
                                        <div style={{ width: '100%' }}>
                                            <input
                                                type="password"
                                                className="settings-input"
                                                style={{ width: '100%' }}
                                                placeholder={getProviderCred('nasa') ? "Enter new key to replace" : "••••••••••••••••••"}
                                                value={nasaKey}
                                                onChange={e => setNasaKey(e.target.value)}
                                            />
                                            {getProviderCred('nasa') && (
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px', textAlign: 'right' }}>
                                                    Configured ({getProviderCred('nasa')?.key_hint})
                                                </div>
                                            )}
                                        </div>

                                        <div style={{ display: 'flex', gap: '8px', width: '100%', justifyContent: 'flex-end' }}>
                                            <button
                                                className="btn btn-primary"
                                                style={{ padding: '5px 10px', fontSize: '0.76rem' }}
                                                onClick={() => handleSave('nasa', nasaKey)}
                                                disabled={!nasaKey.trim() || loadingProvider['nasa'] === 'saving'}
                                            >
                                                {loadingProvider['nasa'] === 'saving' ? 'Saving...' : getProviderCred('nasa') ? 'Replace key' : 'Save key'}
                                            </button>

                                            {getProviderCred('nasa') && (
                                                <>
                                                    <button
                                                        className="btn btn-secondary"
                                                        style={{ padding: '5px 10px', fontSize: '0.76rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                        onClick={() => handleValidate('nasa')}
                                                        disabled={loadingProvider['nasa'] === 'validating'}
                                                    >
                                                        {loadingProvider['nasa'] === 'validating' ? <RefreshCw size={12} className="spinning" /> : null}
                                                        {loadingProvider['nasa'] === 'validating' ? "Validating..." : "Validate"}
                                                    </button>
                                                    <button
                                                        className="btn btn-secondary"
                                                        style={{ padding: '5px 10px', fontSize: '0.76rem', color: 'var(--red)' }}
                                                        onClick={() => handleDelete('nasa')}
                                                        disabled={loadingProvider['nasa'] === 'deleting'}
                                                    >
                                                        {loadingProvider['nasa'] === 'deleting' ? 'Removing...' : 'Remove'}
                                                    </button>
                                                </>
                                            )}
                                        </div>

                                        {providerError['nasa'] && (
                                            <div style={{ color: 'var(--red)', fontSize: '0.8rem', textAlign: 'right' }}>
                                                {providerError['nasa']}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}

                        <h3 className="settings-section__title">AI Model</h3>
                        <p className="settings-section__sub">Select which OpenRouter model SpaceScout uses for planning. Requires your own key.</p>

                        <div className="settings-row">
                            <div>
                                <div className="settings-row__label">Model</div>
                                <div className="settings-row__sub">Requires your own OpenRouter key</div>
                            </div>
                            <input type="text" className="settings-input" defaultValue="openrouter/free" />
                        </div>
                    </div>
                )}

                {activeTab === "preferences" && (
                    <div className="settings-section">
                        <h2 className="settings-section__title">Preferences</h2>
                        <p className="settings-section__sub">Customize your SpaceScout experience.</p>

                        <div className="settings-row">
                            <div>
                                <div className="settings-row__label">Theme</div>
                                <div className="settings-row__sub">Use dark or light theme</div>
                            </div>
                            <select
                                className="settings-input"
                                style={{ appearance: 'auto', cursor: 'pointer', width: 'auto' }}
                                value={theme}
                                onChange={handleThemeChange}
                            >
                                <option value="dark">Dark Theme</option>
                                <option value="light">Light Theme</option>
                            </select>
                        </div>

                        <div className="settings-row">
                            <div>
                                <div className="settings-row__label">Auto-expand discovery details</div>
                                <div className="settings-row__sub">Show full card content by default</div>
                            </div>
                            <div className="toggle on">
                                <div className="toggle__thumb"></div>
                            </div>
                        </div>

                        <div className="settings-row">
                            <div>
                                <div className="settings-row__label">Keep continue pane open</div>
                                <div className="settings-row__sub">Always show the exploration control</div>
                            </div>
                            <div className="toggle">
                                <div className="toggle__thumb"></div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
