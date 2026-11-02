import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full max-w-3xl mx-auto my-12 p-8 rounded-3xl bg-[#140827] border border-pink-500/30 text-center shadow-[0_0_40px_rgba(236,72,153,0.2)]">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-pink-300 mb-2 font-['Kantumruy_Pro']">
            មានបញ្ហាក្នុងការបង្ហាញទំព័រនេះ (Something went wrong)
          </h2>
          <p className="text-xs text-gray-400 mb-6 font-mono max-w-md mx-auto">
            {this.state.error?.message || 'Unexpected application error'}
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                if (this.props.onReset) this.props.onReset();
              }}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500 text-white font-bold text-xs shadow-lg hover:brightness-110 transition-all"
            >
              🔄 ព្យាយាមម្ដងទៀត (Retry)
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="px-5 py-2.5 rounded-xl bg-purple-900/60 hover:bg-purple-800/80 text-purple-200 border border-purple-500/30 font-bold text-xs transition-all"
            >
              ← ត្រឡប់ទៅទំព័រដើម (Home)
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

