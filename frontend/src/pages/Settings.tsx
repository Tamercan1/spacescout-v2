import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { User, Key, Settings as SettingsIcon } from 'lucide-react';

export default function Settings() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState("account");

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
                        
                        <div className="byok-banner">
                            <strong>Using application defaults.</strong> Add your own OpenRouter and NASA keys below to use your quota instead of the shared application limit.
                        </div>

                        <div className="settings-row">
                            <div>
                                <div className="settings-row__label">OpenRouter API Key</div>
                                <div className="settings-row__sub">Used for AI exploration planning</div>
                            </div>
                            <input type="password" className="settings-input" placeholder="sk-or-••••••••••••••••••" />
                        </div>

                        <div className="settings-row" style={{ marginBottom: '24px' }}>
                            <div>
                                <div className="settings-row__label">NASA API Key</div>
                                <div className="settings-row__sub">NeoWs, APOD, DONKI, and more</div>
                            </div>
                            <input type="password" className="settings-input" placeholder="••••••••••••••••••" />
                        </div>
                        
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '32px' }}>
                            <button className="btn btn-primary" style={{ padding: '5px 10px', fontSize: '0.76rem' }}>Save keys</button>
                            <button className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: '0.76rem' }}>Test connection</button>
                        </div>

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
