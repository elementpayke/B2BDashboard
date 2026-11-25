"use client";

import React from "react";

type Props = { children: React.ReactNode };

type State = { error: Error | null };

/** Prevent a invoices-screen render fault from taking down the whole dashboard shell. */
export default class InvoicesErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <section className="ep-panel ep-invoices-empty">
          <h3>Invoices couldn&apos;t load</h3>
          <p className="ep-invoices-muted">{this.state.error.message}</p>
          <button
            type="button"
            className="ep-invoices-btn ep-invoices-btn--primary"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </section>
      );
    }
    return this.props.children;
  }
}
