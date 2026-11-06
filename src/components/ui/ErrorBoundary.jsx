import React from "react";
import { WarningCircle, ArrowsClockwise } from "@phosphor-icons/react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary atrapó un error no controlado:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="card my-8 mx-auto max-w-xl text-center p-8 border-2 border-red-500/20 bg-red-50/50 dark:bg-red-950/20">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400">
            <WarningCircle size={32} weight="bold" />
          </div>
          <h2 className="mt-4 text-xl font-bold text-zinc-900 dark:text-zinc-100">
            Ocurrió un error al cargar esta sección
          </h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {this.state.error?.message || "Error inesperado de renderizado."}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={this.handleReset}
              className="btn btn-secondary flex items-center gap-2"
            >
              <ArrowsClockwise size={18} weight="bold" />
              Reintentar
            </button>
            <button
              onClick={() => window.location.reload()}
              className="btn btn-primary"
            >
              Recargar aplicación
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

