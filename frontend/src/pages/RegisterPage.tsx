import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, Eye, EyeOff, Check, X } from 'lucide-react';
import { Button, Input } from '../components/common';
import { useAuthStore, toast } from '../stores';

const RegisterPage: React.FC = () => {
    const navigate = useNavigate();
    const { register, isLoading } = useAuthStore();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Password requirements
    const passwordChecks = {
        length: password.length >= 8,
        uppercase: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        number: /[0-9]/.test(password),
    };

    const validate = () => {
        const newErrors: Record<string, string> = {};

        if (!name || name.trim().length < 2) {
            newErrors.name = 'Name must be at least 2 characters';
        }

        if (!email) {
            newErrors.email = 'Email is required';
        } else if (!/\S+@\S+\.\S+/.test(email)) {
            newErrors.email = 'Please enter a valid email';
        }

        if (!password) {
            newErrors.password = 'Password is required';
        } else if (!Object.values(passwordChecks).every(Boolean)) {
            newErrors.password = 'Password does not meet requirements';
        }

        if (password !== confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validate()) return;

        try {
            await register(email, password, name);
            toast.success('Account created!', 'Welcome to our platform.');
            navigate('/create-workspace');
        } catch (error: any) {
            const message = error.response?.data?.error?.message || 'Registration failed';
            toast.error('Registration failed', message);
        }
    };

    const PasswordCheck: React.FC<{ passed: boolean; label: string }> = ({ passed, label }) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', marginBottom: 4 }}>
            {passed ? (
                <Check size={14} style={{ color: 'var(--success)' }} />
            ) : (
                <X size={14} style={{ color: 'var(--text-muted)' }} />
            )}
            <span style={{ fontSize: 'var(--text-xs)', color: passed ? 'var(--success)' : 'var(--text-muted)' }}>
                {label}
            </span>
        </div>
    );

    return (
        <div
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
                        Create your account
                    </h1>
                    <p style={{ color: 'var(--text-muted)' }}>
                        Get started with your workspace
                    </p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: 'var(--space-md)' }}>
                        <Input
                            label="Full Name"
                            type="text"
                            placeholder="John Doe"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            error={errors.name}
                        />
                    </div>

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

                    <div style={{ marginBottom: 'var(--space-sm)', position: 'relative' }}>
                        <Input
                            label="Password"
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Create a password"
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

                    {/* Password requirements */}
                    {password && (
                        <div style={{ marginBottom: 'var(--space-md)', paddingLeft: 4 }}>
                            <PasswordCheck passed={passwordChecks.length} label="At least 8 characters" />
                            <PasswordCheck passed={passwordChecks.uppercase} label="One uppercase letter" />
                            <PasswordCheck passed={passwordChecks.lowercase} label="One lowercase letter" />
                            <PasswordCheck passed={passwordChecks.number} label="One number" />
                        </div>
                    )}

                    <div style={{ marginBottom: 'var(--space-lg)' }}>
                        <Input
                            label="Confirm Password"
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Confirm your password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            error={errors.confirmPassword}
                        />
                    </div>

                    <Button
                        type="submit"
                        isLoading={isLoading}
                        style={{ width: '100%', marginBottom: 'var(--space-lg)' }}
                    >
                        Create Account
                    </Button>

                    <div className="text-center">
                        <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                            Already have an account?{' '}
                        </span>
                        <Link to="/login" style={{ color: 'var(--primary-light)', fontSize: 'var(--text-sm)' }}>
                            Sign in
                        </Link>
                    </div>
                </form>

                <p style={{
                    marginTop: 'var(--space-xl)',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text-muted)',
                    textAlign: 'center'
                }}>
                    By creating an account, you agree to our{' '}
                    <a href="#" style={{ color: 'var(--primary-light)' }}>Terms of Service</a>
                    {' '}and{' '}
                    <a href="#" style={{ color: 'var(--primary-light)' }}>Privacy Policy</a>
                </p>
            </div>
        </div>
    );
};

export default RegisterPage;
