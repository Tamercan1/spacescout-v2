import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useCredentials } from "../context/CredentialsContext";
import { User, Key, Settings as SettingsIcon, CheckCircle2, AlertCircle, RefreshCw, XCircle, ExternalLink } from 'lucide-react';
import { updateUserProfile } from "../api/user";
import type { ProviderCredential } from "../types/credentials";

function getLocalFallbackTheme(): 'dark' | 'light' {
    if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem('spacescout_theme');
        if (saved === 'dark' || saved === 'light') {
            return saved;
        }
    }
    if (typeof document !== 'undefined' && document.documentElement.classList.contains('theme-dark')) {
        return 'dark';
    }
    return 'light';
}

function isValidServerTheme(t?: string | null): t is 'dark' | 'light' {
    return t === 'dark' || t === 'light';
}

function applyThemeToDom(newTheme: 'dark' | 'light') {
    if (typeof document !== 'undefined') {
        if (newTheme === 'dark') {
            document.documentElement.classList.add('theme-dark');
            document.documentElement.classList.remove('theme-light');
        } else {
            document.documentElement.classList.add('theme-light');
            document.documentElement.classList.remove('theme-dark');
        }
    }
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem('spacescout_theme', newTheme);
    }
}

const THEME_DEBOUNCE_MS = 400;

export default function Settings() {
    const { user, updateUser } = useAuth();
    const {
        credentials,
        isLoading: credsLoading,
        fetchCredentials,
        saveCredential: saveCred,
        deleteCredential: deleteCred,
        validateCredential: validateCred,
    } = useCredentials();
    const [activeTab, setActiveTab] = useState("account");

    // BYOK Local Input State
    const [openRouterKey, setOpenRouterKey] = useState("");
    const [nasaKey, setNasaKey] = useState("");
    const [loadingProvider, setLoadingProvider] = useState<Record<string, string>>({});
    const [providerError, setProviderError] = useState<Record<string, string | null>>({});

    // Profile State
    const [preferredModel, setPreferredModel] = useState(user?.profile?.preferred_model || "");
    const [savingModel, setSavingModel] = useState(false);
    const [modelSaved, setModelSaved] = useState(false);

    useEffect(() => {
        if (user?.profile) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setPreferredModel(user.profile.preferred_model || "");
        }
    }, [user]);

    const handleSaveModel = async () => {
        setSavingModel(true);
        setModelSaved(false);
        try {
            const updatedUser = await updateUserProfile({ preferred_model: preferredModel.trim() });
            updateUser(updatedUser);
            setModelSaved(true);
            setTimeout(() => setModelSaved(false), 3000);
        } catch (error) {
            console.error("Failed to save model", error);
        } finally {
            setSavingModel(false);
        }
    };

    useEffect(() => {
        if (activeTab === "credentials") {
            fetchCredentials();
        }
    }, [activeTab, fetchCredentials]);

    const handleSave = async (provider: string, key: string) => {
        if (!key.trim()) return;
        setLoadingProvider(prev => ({ ...prev, [provider]: 'saving' }));
        setProviderError(prev => ({ ...prev, [provider]: null }));
        try {
            await saveCred(provider, key);
            if (provider === 'openrouter') setOpenRouterKey("");
            if (provider === 'nasa') setNasaKey("");
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
            await deleteCred(provider);
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
            await validateCred(provider);
        } catch (err: unknown) {
            const error = err as { response?: { status: number, data?: { detail?: string } } };
            if (error.response?.status === 502) {
                setProviderError(prev => ({ ...prev, [provider]: error.response?.data?.detail || "Validation temporarily unavailable. Try again later." }));
            } else {
                setProviderError(prev => ({ ...prev, [provider]: "Failed to validate API key." }));
            }
            await fetchCredentials(true);
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

    // Theme Preference State
    const serverTheme = user?.profile?.theme;
    const [theme, setTheme] = useState<'dark' | 'light'>(() => {
        if (isValidServerTheme(serverTheme)) {
            return serverTheme;
        }
        return getLocalFallbackTheme();
    });

    const [savingTheme, setSavingTheme] = useState(false);
    const [themeError, setThemeError] = useState<string | null>(null);

    const initializedFromServerRef = useRef<boolean>(isValidServerTheme(serverTheme));
    const lastPersistedThemeRef = useRef<'dark' | 'light'>(
        isValidServerTheme(serverTheme) ? serverTheme : getLocalFallbackTheme()
    );
    const desiredThemeRef = useRef<'dark' | 'light'>(
        isValidServerTheme(serverTheme) ? serverTheme : getLocalFallbackTheme()
    );
    const isSavingRef = useRef<boolean>(false);
    const hasUserToggledRef = useRef<boolean>(false);
    const domSynchronizedRef = useRef<boolean>(false);
    const isMountedRef = useRef<boolean>(true);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
                debounceTimerRef.current = null;
                // Flush pending desired theme change immediately on unmount
                if (desiredThemeRef.current !== lastPersistedThemeRef.current) {
                    updateUserProfile({ theme: desiredThemeRef.current }).catch((err) => {
                        console.error("Failed to flush theme preference on unmount", err);
                    });
                }
            }
        };
    }, []);

    useEffect(() => {
        // Prevent profile loading or rerenders from overriding the user's active theme
        if (hasUserToggledRef.current) {
            return;
        }

        const currentServerTheme = user?.profile?.theme;
        if (isValidServerTheme(currentServerTheme)) {
            if (!domSynchronizedRef.current || currentServerTheme !== theme) {
                domSynchronizedRef.current = true;
                initializedFromServerRef.current = true;
                lastPersistedThemeRef.current = currentServerTheme;
                desiredThemeRef.current = currentServerTheme;
                setTheme(currentServerTheme);
                applyThemeToDom(currentServerTheme);
            }
        } else if (user?.profile && !initializedFromServerRef.current) {
            // Server profile loaded but has no valid theme; keep local fallback and ensure DOM sync
            initializedFromServerRef.current = true;
            domSynchronizedRef.current = true;
            applyThemeToDom(theme);
        } else if (!domSynchronizedRef.current) {
            // Initial mount with local fallback
            domSynchronizedRef.current = true;
            applyThemeToDom(theme);
        }
    }, [user?.profile, theme]);

    const [keepContinueOpen, setKeepContinueOpen] = useState(() => {
        return localStorage.getItem('spacescout_keep_continue_open') === 'true';
    });

    const toggleKeepContinueOpen = () => {
        const next = !keepContinueOpen;
        setKeepContinueOpen(next);
        localStorage.setItem('spacescout_keep_continue_open', String(next));
    };

    const processThemeQueue = async () => {
        if (isSavingRef.current) {
            return;
        }
        if (desiredThemeRef.current === lastPersistedThemeRef.current) {
            return;
        }
        isSavingRef.current = true;
        if (isMountedRef.current) {
            setSavingTheme(true);
        }

        while (desiredThemeRef.current !== lastPersistedThemeRef.current) {
            // If another debounce timer is active (user recently toggled), yield to the debounce timer
            if (debounceTimerRef.current) {
                break;
            }

            const targetTheme = desiredThemeRef.current;
            try {
                const updatedUser = await updateUserProfile({ theme: targetTheme });
                lastPersistedThemeRef.current = targetTheme;
                updateUser(updatedUser);
            } catch (err) {
                console.error("Failed to persist theme preference", err);
                // If the user's desired theme is still the one that failed:
                if (desiredThemeRef.current === targetTheme) {
                    const recoveryTheme = lastPersistedThemeRef.current;
                    desiredThemeRef.current = recoveryTheme;
                    applyThemeToDom(recoveryTheme);
                    if (isMountedRef.current) {
                        setTheme(recoveryTheme);
                        setThemeError("Unable to save theme preference. Reverted to previous theme.");
                    }
                    break;
                }
                // If desiredThemeRef.current changed while this request was in flight, loop continues
            }
        }

        isSavingRef.current = false;
        if (isMountedRef.current) {
            setSavingTheme(false);
        }
    };

    const toggleTheme = () => {
        const nextTheme = desiredThemeRef.current === 'dark' ? 'light' : 'dark';

        hasUserToggledRef.current = true;
        desiredThemeRef.current = nextTheme;
        setThemeError(null);
        setTheme(nextTheme);
        applyThemeToDom(nextTheme);

        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = null;
        }

        // Zero-API-call caching optimization:
        // If user rapidly toggled back to the currently persisted theme and no request is in-flight,
        // cancel persistence entirely!
        if (desiredThemeRef.current === lastPersistedThemeRef.current && !isSavingRef.current) {
            return;
        }

        debounceTimerRef.current = setTimeout(() => {
            debounceTimerRef.current = null;
            processThemeQueue();
        }, THEME_DEBOUNCE_MS);
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
                                <div className="settings-row settings-row--stacked-mobile" style={{ alignItems: 'flex-start', paddingBottom: '24px' }}>
                                    <div className="settings-row__info">
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

                                    <div className="settings-row__control">
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
                                <div className="settings-row settings-row--stacked-mobile" style={{ alignItems: 'flex-start', paddingBottom: '24px' }}>
                                    <div className="settings-row__info">
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

                                    <div className="settings-row__control">
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

                        <div className="settings-row settings-row--stacked-mobile" style={{ alignItems: 'flex-start', paddingBottom: '24px' }}>
                            <div className="settings-row__info">
                                <div>
                                    <div className="settings-row__label">Preferred Model</div>
                                    <div className="settings-row__sub" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                                        <div>The model used for SpaceScout's AI requests.</div>
                                        <div>
                                            <a href="https://openrouter.ai/collections/free-models" target="_blank" rel="noopener noreferrer" style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                padding: '5px 10px',
                                                backgroundColor: 'var(--surface-2)',
                                                border: '1px solid var(--border)',
                                                borderRadius: '6px',
                                                color: 'var(--text-1)',
                                                textDecoration: 'none',
                                                fontSize: '0.75rem',
                                                fontWeight: 500,
                                                transition: 'background 0.2s'
                                            }}
                                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--surface-3)'}
                                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'var(--surface-2)'}
                                            >
                                                Browse Free Models on OpenRouter <ExternalLink size={12} />
                                            </a>
                                        </div>
                                        {!user?.profile?.preferred_model && (
                                            <span style={{ color: 'var(--text-2)', marginTop: '4px' }}>Using default: <strong>openrouter/free</strong></span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="settings-row__control">
                                <div style={{ width: '100%' }}>
                                    <input 
                                        type="text" 
                                        className="settings-input" 
                                        style={{ width: '100%' }}
                                        placeholder="openrouter/free" 
                                        value={preferredModel}
                                        onChange={(e) => setPreferredModel(e.target.value)}
                                    />
                                </div>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    {modelSaved && <span style={{ fontSize: '0.8rem', color: 'var(--green)' }}><CheckCircle2 size={12} style={{display: 'inline', marginBottom: '-2px'}}/> Saved</span>}
                                    <button 
                                        className="btn btn-primary" 
                                        style={{ padding: '5px 10px', fontSize: '0.76rem' }}
                                        onClick={handleSaveModel}
                                        disabled={savingModel || preferredModel === (user?.profile?.preferred_model || "")}
                                    >
                                        {savingModel ? 'Saving...' : 'Save Preference'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === "preferences" && (
                    <div className="settings-section">
                        <h2 className="settings-section__title">Preferences</h2>
                        <p className="settings-section__sub">Customize your SpaceScout experience.</p>

                        <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                                <div>
                                    <div className="settings-row__label">Dark theme</div>
                                    <div className="settings-row__sub">Use dark or light theme</div>
                                </div>
                                <button
                                    type="button"
                                    className={`toggle ${theme === 'dark' ? 'on' : ''}`}
                                    onClick={toggleTheme}
                                    aria-label="Toggle dark theme"
                                    role="switch"
                                    aria-checked={theme === 'dark'}
                                    aria-busy={savingTheme}
                                >
                                    <div className="toggle__thumb"></div>
                                </button>
                            </div>
                            {themeError && (
                                <div style={{ color: 'var(--red)', fontSize: '0.8rem', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <AlertCircle size={14} />
                                    <span>{themeError}</span>
                                </div>
                            )}
                        </div>

                        <div className="settings-row">
                            <div>
                                <div className="settings-row__label">Keep continue pane open</div>
                                <div className="settings-row__sub">Always show the exploration control by default</div>
                            </div>
                            <button
                                type="button"
                                className={`toggle ${keepContinueOpen ? 'on' : ''}`}
                                onClick={toggleKeepContinueOpen}
                                aria-label="Toggle keep continue pane open"
                                role="switch"
                                aria-checked={keepContinueOpen}
                            >
                                <div className="toggle__thumb"></div>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
