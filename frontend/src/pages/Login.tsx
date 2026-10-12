import { useState  } from "react";
import React from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";

function Login() { 

    const { loginUser } = useAuth() // unpack only loginUser function from the auth context

    const navigate = useNavigate();

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (event: React.SubmitEvent<HTMLFormElement>)  => {
        event.preventDefault();
        
        setError("");
        setLoading(true);

        try {
            await loginUser(username, password);
            console.log("User logged in");
            navigate("/");
        }
        catch {
            setError("Invalid username or password");
        }
        finally {
            setLoading(false);
        }

    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px', background: 'var(--base)' }}>
            <div className="card" style={{ padding: '40px', maxWidth: '400px', width: '100%', textAlign: 'center', background: 'var(--surface)' }}>
                <h1 style={{ fontSize: '1.6rem', fontWeight: 600, color: 'var(--text-1)', marginBottom: '8px' }}>Welcome back</h1>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-2)', marginBottom: '32px' }}>Sign in to continue your exploration</p>

                <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
                    <div className="input-group">
                        <label htmlFor="username" className="input-label">Username</label>
                        <input 
                            id="username" 
                            type="text" 
                            className="input-field"
                            placeholder="Enter username"
                            value={username} 
                            autoComplete="off"
                            onChange={(e) => setUsername(e.target.value)} 
                        />
                    </div>
                    <div className="input-group">
                        <label htmlFor="password" className="input-label">Password</label>
                        <input 
                            id="password" 
                            type="password" 
                            className="input-field"
                            placeholder="Enter password"
                            value={password} 
                            onChange={(e) => setPassword(e.target.value)} 
                        />
                    </div>

                    {error && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: 'var(--red-dim)', color: 'var(--red)', borderRadius: 'var(--radius)', fontSize: '0.85rem', marginBottom: '16px' }}>
                            {error}
                        </div>
                    )}

                    <button className="btn btn-primary" style={{ width: '100%', padding: '12px', marginTop: '8px' }}>
                        {loading ? "Signing in..." : "Sign In"}
                    </button>
                </form>

                <div style={{ marginTop: '24px', fontSize: '0.85rem', color: 'var(--text-2)' }}>
                    Don't have an account? <Link to="/register" style={{ color: 'var(--blue)', fontWeight: 500 }}>Create one</Link>
                </div>
            </div>
        </div>
    )
}

export default Login