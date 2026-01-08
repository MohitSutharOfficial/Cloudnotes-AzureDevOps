import React from 'react';
import { X } from 'lucide-react';
import { useUIStore } from '../../stores';

const ToastContainer: React.FC = () => {
    const { toasts, removeToast } = useUIStore();

    if (toasts.length === 0) return null;

    return (
        <div className="toast-container">
            {toasts.map((toast) => (
                <div key={toast.id} className={`toast toast-${toast.type}`}>
                    <div className="flex-1">
                        <div className="font-medium" style={{ color: 'var(--text-primary)' }}>
                            {toast.title}
                        </div>
                        {toast.message && (
                            <div className="text-sm" style={{ color: 'var(--text-muted)', marginTop: 4 }}>
                                {toast.message}
                            </div>
                        )}
                    </div>
                    <button
                        className="btn btn-ghost btn-icon"
                        onClick={() => removeToast(toast.id)}
                        style={{ marginLeft: 'var(--space-sm)' }}
                    >
                        <X size={16} />
                    </button>
                </div>
            ))}
        </div>
    );
};

export default ToastContainer;
