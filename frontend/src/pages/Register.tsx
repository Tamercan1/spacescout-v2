import { useState  } from "react";
import React from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { register } from "../api/auth";

function Register() { 

    const { loginUser } = useAuth() // unpack only loginUser function from the auth context

    const navigate = useNavigate();

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const [inputErrors, setInputErrors] = useState<{ username?: string, password?: string}>({});

    const handleSubmit = async (event: React.SubmitEvent<HTMLFormElement>)  => {
        event.preventDefault();
        
        setError("");
        setInputErrors({});
        setLoading(true);

        try {
            if (password === confirmPassword) {
                await register(username, password);
                console.log("User successfully registered");
                try {
                    await loginUser(username, password);
                    navigate("/");
                } catch {
                    setError("Account created, but automatic sign-in failed. Please sign in directly.");
                }
            }
            else {
                setError("Password must match");
            }
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        catch (error: any) {

            if (error.response && error.response.status === 400) {
                const backendErrors = error.response.data;

                setInputErrors({
                    username: backendErrors.username ? backendErrors.username[0] : undefined,
                    password: backendErrors.password ? backendErrors.password[0] : undefined
                });
            }
            else {
                setError("Something went wrong. Please try again later.");
            }
        }
        finally {
            setLoading(false);
        }

    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px', background: 'var(--base)' }}>
            <div className="card" style={{ padding: '40px', maxWidth: '400px', width: '100%', textAlign: 'center', background: 'var(--surface)' }}>
                <h1 style={{ fontSize: '1.6rem', fontWeight: 600, color: 'var(--text-1)', marginBottom: '8px' }}>Create an account</h1>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-2)', marginBottom: '32px' }}>Start your space exploration journey</p>

                <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
                    <div className="input-group">
                        <label htmlFor="username" className="input-label">Username</label>
                        <input 
                            id="username" 
                            type="text" 
                            className="input-field"
                            placeholder="Choose a username"
                            value={username} 
                            autoComplete="off"
                            onChange={(e) => setUsername(e.target.value)}
                        />
                        {inputErrors.username && <span style={{ fontSize: '0.8rem', color: 'var(--red)', marginTop: '4px' }}>{inputErrors.username}</span>}
                    </div>

                    <div className="input-group">
                        <label htmlFor="password" className="input-label">Password</label>
                        <input 
                            id="password" 
                            type="password" 
                            className="input-field"
                            placeholder="Choose a password"
                            value={password} 
                            onChange={(e) => setPassword(e.target.value)} 
                        />
                        {inputErrors.password && <span style={{ fontSize: '0.8rem', color: 'var(--red)', marginTop: '4px' }}>{inputErrors.password}</span>}
                    </div>

                    <div className="input-group" style={{ marginBottom: '24px' }}>
                        <label htmlFor="confirmPassword" className="input-label">Confirm Password</label>
                        <input 
                            id="confirmPassword" 
                            type="password" 
                            className="input-field"
                            placeholder="Confirm your password"
                            value={confirmPassword} 
                            onChange={(e) => setConfirmPassword(e.target.value)} 
                        />
                    </div>

                    {error && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: 'var(--red-dim)', color: 'var(--red)', borderRadius: 'var(--radius)', fontSize: '0.85rem', marginBottom: '16px' }}>
                            {error}
                        </div>
                    )}

                    <button className="btn btn-primary" style={{ width: '100%', padding: '12px' }}>
                        {loading ? "Creating account..." : "Create Account"}
                    </button>
                </form>

                <div style={{ marginTop: '24px', fontSize: '0.85rem', color: 'var(--text-2)' }}>
                    Already have an account? <Link to="/login" style={{ color: 'var(--blue)', fontWeight: 500 }}>Sign in</Link>
                </div>
            </div>
        </div>
    )
}

export default Register