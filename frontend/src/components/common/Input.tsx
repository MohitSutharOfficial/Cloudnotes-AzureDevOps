import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    helperText?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({
    label,
    error,
    helperText,
    className = '',
    ...props
}, ref) => {
    return (
        <div className="input-group">
            {label && (
                <label className="input-label">{label}</label>
            )}
            <input
                ref={ref}
                className={`input ${error ? 'input-error' : ''} ${className}`}
                {...props}
            />
            {error && <span className="error-message">{error}</span>}
            {helperText && !error && (
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{helperText}</span>
            )}
        </div>
    );
});

Input.displayName = 'Input';

export default Input;
