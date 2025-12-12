import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Lock, Loader2 } from "lucide-react";
import { useExams, ExamCredentials } from "@/hooks/useExams";

interface ExamCredentialsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    attemptId: string;
    examName: string;
    existingCredentials?: {
        applicationNumber: string | null;
        rollNumber: string | null;
        hasPassword: boolean;
    };
}

export function ExamCredentialsModal({
    open,
    onOpenChange,
    attemptId,
    examName,
    existingCredentials,
}: ExamCredentialsModalProps) {
    const { updateExamCredentials } = useExams();
    const [showPassword, setShowPassword] = useState(false);
    const [formData, setFormData] = useState<ExamCredentials>({
        applicationNumber: "",
        rollNumber: "",
        password: "",
    });

    // Reset form when modal opens with existing data
    useEffect(() => {
        if (open) {
            setFormData({
                applicationNumber: existingCredentials?.applicationNumber || "",
                rollNumber: existingCredentials?.rollNumber || "",
                password: "", // Never pre-fill password for security
            });
            setShowPassword(false);
        }
    }, [open, existingCredentials]);

    const handleSave = () => {
        updateExamCredentials.mutate(
            { attemptId, credentials: formData },
            {
                onSuccess: () => {
                    onOpenChange(false);
                },
            }
        );
    };

    const hasExistingData = existingCredentials?.applicationNumber ||
        existingCredentials?.rollNumber ||
        existingCredentials?.hasPassword;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        {hasExistingData ? "Edit" : "Add"} Application Details
                    </DialogTitle>
                    <DialogDescription>
                        {examName}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="applicationNumber">Application Number</Label>
                        <Input
                            id="applicationNumber"
                            placeholder="Enter your application number"
                            value={formData.applicationNumber}
                            onChange={(e) =>
                                setFormData({ ...formData, applicationNumber: e.target.value })
                            }
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="rollNumber">Roll Number</Label>
                        <Input
                            id="rollNumber"
                            placeholder="Enter your roll number"
                            value={formData.rollNumber}
                            onChange={(e) =>
                                setFormData({ ...formData, rollNumber: e.target.value })
                            }
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <div className="relative">
                            <Input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                placeholder={existingCredentials?.hasPassword ? "Enter new password to change" : "Enter your login password"}
                                value={formData.password}
                                onChange={(e) =>
                                    setFormData({ ...formData, password: e.target.value })
                                }
                                className="pr-10"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                {showPassword ? (
                                    <EyeOff className="h-4 w-4" />
                                ) : (
                                    <Eye className="h-4 w-4" />
                                )}
                            </button>
                        </div>
                        {existingCredentials?.hasPassword && (
                            <p className="text-xs text-muted-foreground">
                                Leave blank to keep existing password
                            </p>
                        )}
                    </div>

                    {/* Security Notice */}
                    <div className="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                        <Lock className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-green-700 dark:text-green-300">
                            Your password will be encrypted and securely stored. Only you can view it.
                        </p>
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={updateExamCredentials.isPending}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={updateExamCredentials.isPending}
                    >
                        {updateExamCredentials.isPending ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            "Save Details"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
