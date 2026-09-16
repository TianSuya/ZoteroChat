import { Component, type ErrorInfo, type ReactNode } from "react";

import { report } from "../utils/report";

interface Props {
  children: ReactNode;
  label: string;
}

interface State {
  error: Error | null;
}

/**
 * Without this, a render-time throw unmounts the whole panel silently — the
 * sandbox has no console to surface React's own error report.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    report(
      `ERROR BOUNDARY [${this.props.label}]`,
      String(error?.message ?? error),
      String(error?.stack ?? "").slice(0, 900),
      String(info?.componentStack ?? "").slice(0, 600),
    );
  }

  override render() {
    if (this.state.error) {
      return (
        <div className="p-3 text-sm text-danger">
          Panel failed to render: {String(this.state.error.message)}
        </div>
      );
    }
    return this.props.children;
  }
}
