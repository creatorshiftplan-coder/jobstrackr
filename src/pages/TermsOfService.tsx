import { ArrowLeft, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSmartBack } from "@/hooks/useSmartBack";

export default function TermsOfService() {
    const navigate = useNavigate();
    const handleBack = useSmartBack("/");

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
                        onClick={handleBack}
                        className="h-10 w-10 rounded-full bg-[hsl(var(--blue-700))] flex items-center justify-center hover:bg-[hsl(var(--blue-600))] transition-colors"
                    >
                        <ArrowLeft className="h-5 w-5 text-white" />
                    </button>
                    <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-white" />
                        <h1 className="font-display font-bold text-xl text-white">Terms & Conditions</h1>
                    </div>
                    <div className="w-10" />
                </div>
            </header>

            <main className="px-4 py-4 space-y-4 max-w-3xl mx-auto">
                {/* Effective Date */}
                <p className="text-sm text-muted-foreground italic">
                    Effective Date: January 12, 2026
                </p>

                {/* Introduction */}
                <Card className="border-0 shadow-card">
                    <CardContent className="p-4 text-sm text-muted-foreground">
                        <p>
                            By accessing or using Jobstrackr, you agree to the following Terms and Conditions.
                        </p>
                    </CardContent>
                </Card>

                {/* Section 1 */}
                <Section title="1. Nature of Service">
                    <p>
                        Jobstrackr provides exam tracking, notifications, and AI-assisted informational tools. Information is aggregated from publicly available sources and is provided for convenience only.
                    </p>
                </Section>

                {/* Section 2 */}
                <Section title="2. No Government Affiliation">
                    <p>
                        Jobstrackr is not affiliated with any government entity. Users must verify all information from official sources before taking action.
                    </p>
                </Section>

                {/* Section 3 */}
                <Section title="3. User Responsibilities">
                    <div className="space-y-1">
                        <BulletPoint>Users are responsible for the accuracy of information they provide.</BulletPoint>
                        <BulletPoint>Automated scraping, misuse, or abuse of the platform is prohibited.</BulletPoint>
                    </div>
                </Section>

                {/* Section 4 */}
                <Section title="4. Subscription & Payments">
                    <div className="space-y-1">
                        <BulletPoint>Jobstrackr offers free and paid subscription plans.</BulletPoint>
                        <BulletPoint>Paid subscriptions provide enhanced features and higher daily usage limits.</BulletPoint>
                        <BulletPoint>Subscription benefits are valid only during the active subscription period.</BulletPoint>
                    </div>
                </Section>

                {/* Section 5 */}
                <Section title="5. Refund & Cancellation Policy">
                    <p>
                        Subscriptions can be cancelled at any time from the app or through the respective app store.
                    </p>
                    <div className="space-y-1 mt-2">
                        <BulletPoint>Cancellation takes effect at the end of the current billing period.</BulletPoint>
                        <BulletPoint>Refunds for unused portions are not provided except as required by law.</BulletPoint>
                        <BulletPoint>If you experience technical issues preventing use, contact support within 7 days for a prorated refund.</BulletPoint>
                        <BulletPoint>
                            Refund requests:{" "}
                            <a href="mailto:support@jobstrackr.in" className="text-[hsl(var(--blue-600))] font-medium hover:underline">
                                support@jobstrackr.in
                            </a>
                        </BulletPoint>
                    </div>
                </Section>

                {/* Section 6 */}
                <Section title="6. Limitation of Liability">
                    <p>
                        Jobstrackr shall not be liable for missed deadlines, incorrect information, or outcomes related to exams or job applications.
                    </p>
                </Section>

                {/* Section 7 */}
                <Section title="7. Account Termination">
                    <p>
                        We reserve the right to suspend or terminate accounts that violate these terms.
                    </p>
                </Section>

                {/* Section 8 */}
                <Section title="8. Governing Law">
                    <p>
                        These terms are governed by the laws of India.
                    </p>
                </Section>
            </main>
        </div>
    );
}
