import React from 'react';
import './ErrorBoundary.css';

export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('[ErrorBoundary]', error, errorInfo);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="error-boundary">
                    <div className="error-boundary-card">
                        <div className="error-boundary-icon">⚠️</div>
                        <h2>Something went wrong</h2>
                        <p>An unexpected error occurred. Please try refreshing the page.</p>
                        {this.state.error && (
                            <details className="error-boundary-details">
                                <summary>Error details</summary>
                                <pre>{this.state.error.message}</pre>
                            </details>
                        )}
                        <div className="error-boundary-actions">
                            <button
                                className="error-boundary-btn"
                                onClick={this.handleReset}
                            >
                                Try Again
                            </button>
                            <button
                                className="error-boundary-btn secondary"
                                onClick={() => window.location.reload()}
                            >
                                Reload Page
                            </button>
                        </div>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}
