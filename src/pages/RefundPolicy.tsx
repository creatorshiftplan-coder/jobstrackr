import { ArrowLeft, CreditCard, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function RefundPolicy() {
    const navigate = useNavigate();

    const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
        <Card className="border-0 shadow-card">
            <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-foreground">{title}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-sm text-muted-foreground space-y-2">
                {children}
            </CardContent>
        </Card>
    );

    const BulletPoint = ({ children }: { children: React.ReactNode }) => (
        <div className="flex items-start gap-2">
            <span className="text-muted-foreground mt-0.5">•</span>
            <span>{children}</span>
        </div>
    );

    return (
        <div className="min-h-screen bg-gradient-to-b from-[#E8F4FD] via-[#D6EEFF] to-[#F0F8FF] dark:from-[#101922] dark:via-[#141f2b] dark:to-[#1a2838] pb-8">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-[hsl(var(--blue-900))] px-4 py-4">
                <div className="flex items-center justify-between">
                    <button
                        onClick={() => navigate(-1)}
                        className="h-10 w-10 rounded-full bg-[hsl(var(--blue-700))] flex items-center justify-center hover:bg-[hsl(var(--blue-600))] transition-colors"
                    >
                        <ArrowLeft className="h-5 w-5 text-white" />
                    </button>
                    <div className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5 text-white" />
                        <h1 className="font-display font-bold text-xl text-white">Refund Policy</h1>
                    </div>
                    <div className="w-10" />
                </div>
            </header>

            <main className="px-4 py-4 space-y-4 max-w-3xl mx-auto">
                {/* Page Title */}
                <h2 className="text-xl font-bold text-foreground">
                    Refund & Cancellation Policy
                </h2>

                {/* Section 1 */}
                <Section title="1. Subscription Cancellation">
                    <p>
                        Users may cancel their subscription at any time. Subscription benefits will remain active until the end of the current billing period.
                    </p>
                </Section>

                {/* Section 2 */}
                <Section title="2. Refund Policy">
                    <div className="space-y-1">
                        <BulletPoint>Payments once made are generally non-refundable.</BulletPoint>
                        <BulletPoint>Refunds may be issued only in cases of duplicate or erroneous charges, subject to review.</BulletPoint>
                    </div>
                </Section>

                {/* Section 3 */}
                <Section title="3. Refund Requests">
                    <p>To request a refund, contact:</p>
                    <a
                        href="mailto:support@jobstrackr.in"
                        className="text-[hsl(var(--blue-600))] font-medium hover:underline"
                    >
                        support@jobstrackr.in
                    </a>
                </Section>

                {/* Contact Card */}
                <Card className="border-0 shadow-card bg-[hsl(var(--blue-100))] dark:bg-[hsl(var(--blue-900))]/30">
                    <CardContent className="p-4 flex items-start gap-3">
                        <div className="h-10 w-10 rounded-full bg-[hsl(var(--blue-600))]/10 flex items-center justify-center flex-shrink-0">
                            <Mail className="h-5 w-5 text-[hsl(var(--blue-600))]" />
                        </div>
                        <div className="flex-1">
                            <h4 className="font-semibold text-foreground mb-1">Contact Us</h4>
                            <p className="text-sm text-muted-foreground">
                                For any queries, support, or legal concerns:
                            </p>
                            <a
                                href="mailto:support@jobstrackr.in"
                                className="text-sm text-[hsl(var(--blue-600))] font-medium hover:underline"
                            >
                                support@jobstrackr.in
                            </a>
                        </div>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
