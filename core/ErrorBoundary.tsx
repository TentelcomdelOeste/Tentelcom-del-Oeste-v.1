
import { Component, ReactNode, ErrorInfo } from "react";
import { FiRefreshCw } from "react-icons/fi";
import { ActionButton } from "../design-system";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6 text-red-600">
              <FiRefreshCw className="text-3xl" />
            </div>
            <h2 className="text-2xl font-black text-slate-800 mb-4 tracking-tight">Algo salió mal</h2>
            <p className="text-slate-500 font-medium mb-8">La aplicación encontró un error inesperado. Por favor, intenta recargar la página.</p>
            <ActionButton 
              onClick={() => window.location.reload()}
              label="Recargar Aplicación"
              icon={<FiRefreshCw />}
              variant="primary"
            />
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
