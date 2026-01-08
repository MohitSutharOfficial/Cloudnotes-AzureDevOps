import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, Eye, EyeOff } from 'lucide-react';
import { Button, Input } from '../components/common';
import { useAuthStore, toast } from '../stores';

const LoginPage: React.FC = () => {
    const navigate = useNavigate();
    const { login, isLoading } = useAuthStore();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

    const validate = () => {
        const newErrors: { email?: string; password?: string } = {};

        if (!email) {
            newErrors.email = 'Email is required';
        } else if (!/\S+@\S+\.\S+/.test(email)) {
            newErrors.email = 'Please enter a valid email';
        }

        if (!password) {
            newErrors.password = 'Password is required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validate()) return;

        try {
            await login(email, password);
            toast.success('Welcome back!', 'You have been logged in successfully.');
            navigate('/notes');
        } catch (error: any) {
            const message = error.response?.data?.error?.message || 'Invalid credentials';
            toast.error('Login failed', message);
        }
    };

    return (
        <div
            className="min-h-screen flex items-center justify-center"
            style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 'var(--space-lg)'
            }}
        >
            <div className="card" style={{ width: '100%', maxWidth: 420 }}>
                {/* Logo */}
                <div className="text-center mb-md" style={{ marginBottom: 'var(--space-xl)' }}>
                    <div
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 64,
                            height: 64,
                            background: 'var(--gradient-primary)',
                            borderRadius: 'var(--radius-xl)',
                            marginBottom: 'var(--space-md)',
                            boxShadow: 'var(--shadow-glow)'
                        }}
                    >
                        <Building2 size={32} color="white" />
                    </div>
                    <h1 style={{ fontSize: 'var(--text-2xl)', marginBottom: 'var(--space-xs)' }}>
                        Welcome back
                    </h1>
                    <p style={{ color: 'var(--text-muted)' }}>
                        Sign in to your workspace
                    </p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: 'var(--space-md)' }}>
                        <Input
                            label="Email"
                            type="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            error={errors.email}
                        />
                    </div>

                    <div style={{ marginBottom: 'var(--space-lg)', position: 'relative' }}>
                        <Input
                            label="Password"
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Enter your password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            error={errors.password}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            style={{
                                position: 'absolute',
                                right: 12,
                                top: 35,
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer'
                            }}
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-lg)' }}>
                        <Link to="/forgot-password" style={{ fontSize: 'var(--text-sm)', color: 'var(--primary-light)' }}>
                            Forgot password?
                        </Link>
                    </div>

                    <Button
                        type="submit"
                        isLoading={isLoading}
                        style={{ width: '100%', marginBottom: 'var(--space-lg)' }}
                    >
                        Sign In
                    </Button>

                    <div className="text-center">
                        <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                            Don't have an account?{' '}
                        </span>
                        <Link to="/register" style={{ color: 'var(--primary-light)', fontSize: 'var(--text-sm)' }}>
                            Sign up
                        </Link>
                    </div>
                </form>

                {/* Azure AD B2C option */}
                <div style={{ marginTop: 'var(--space-xl)' }}>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-md)',
                            marginBottom: 'var(--space-md)'
                        }}
                    >
                        <div style={{ flex: 1, height: 1, background: 'var(--border-color)' }} />
                        <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>OR</span>
                        <div style={{ flex: 1, height: 1, background: 'var(--border-color)' }} />
                    </div>

                    <Button
                        type="button"
                        variant="secondary"
                        style={{ width: '100%' }}
                        onClick={() => toast.info('Azure AD B2C', 'SSO integration coming soon!')}
                    >
                        <svg width="20" height="20" viewBox="0 0 21 21">
                            <path fill="#f25022" d="M1 1h9v9H1z" />
                            <path fill="#00a4ef" d="M1 11h9v9H1z" />
                            <path fill="#7fba00" d="M11 1h9v9h-9z" />
                            <path fill="#ffb900" d="M11 11h9v9h-9z" />
                        </svg>
                        Continue with Microsoft
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
