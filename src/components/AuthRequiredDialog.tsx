import { useState, createContext, useContext, useCallback } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";

interface AuthRequiredContextType {
    showAuthRequired: (message?: string) => void;
}

const AuthRequiredContext = createContext<AuthRequiredContextType | undefined>(undefined);

export function useAuthRequired() {
    const context = useContext(AuthRequiredContext);
    if (!context) {
        throw new Error("useAuthRequired must be used within AuthRequiredProvider");
    }
    return context;
}

interface AuthRequiredProviderProps {
    children: React.ReactNode;
}

export function AuthRequiredProvider({ children }: AuthRequiredProviderProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [message, setMessage] = useState("Please login to use this feature");
    const navigate = useNavigate();

    const showAuthRequired = useCallback((customMessage?: string) => {
        if (customMessage) {
            setMessage(customMessage);
        } else {
            setMessage("Please login to use this feature");
        }
        setIsOpen(true);
    }, []);

    const handleLogin = () => {
        setIsOpen(false);
        // Clear guest mode when user decides to login
        localStorage.removeItem("guestMode");
        navigate("/auth");
    };

    const handleCancel = () => {
        setIsOpen(false);
    };

    return (
        <AuthRequiredContext.Provider value={{ showAuthRequired }}>
            {children}
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                            <Lock className="h-6 w-6 text-primary" />
                        </div>
                        <DialogTitle className="text-center">Login Required</DialogTitle>
                        <DialogDescription className="text-center">
                            {message}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
                        <Button variant="outline" onClick={handleCancel} className="w-full sm:w-auto">
                            Cancel
                        </Button>
                        <Button onClick={handleLogin} className="w-full sm:w-auto">
                            Login
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AuthRequiredContext.Provider>
    );
}
