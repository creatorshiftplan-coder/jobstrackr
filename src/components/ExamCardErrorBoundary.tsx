import { Component, ErrorInfo, ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ExamCardErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("ExamCard Error:", error, errorInfo);
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                this.props.fallback || (
                    <Card className="bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <AlertTriangle className="h-5 w-5 text-red-500" />
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-red-700 dark:text-red-300">
                                        Failed to load exam card
                                    </p>
                                    <p className="text-xs text-red-600 dark:text-red-400">
                                        {this.state.error?.message || "An unexpected error occurred"}
                                    </p>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={this.handleRetry}
                                    className="border-red-300 text-red-700 hover:bg-red-100"
                                >
                                    <RefreshCw className="h-4 w-4 mr-1" />
                                    Retry
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )
            );
        }

        return this.props.children;
    }
}
