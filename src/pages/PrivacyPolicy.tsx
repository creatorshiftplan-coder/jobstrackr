import { ArrowLeft, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSmartBack } from "@/hooks/useSmartBack";

export default function PrivacyPolicy() {
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
                        <ShieldCheck className="h-5 w-5 text-white" />
                        <h1 className="font-display font-bold text-xl text-white">Privacy Policy</h1>
                    </div>
                    <div className="w-10" />
                </div>
            </header>

            <main className="px-4 py-4 space-y-4 max-w-3xl mx-auto">
                {/* Effective Date */}
                <p className="text-sm text-muted-foreground italic">
                    Last updated: January 24, 2026
                </p>

                {/* Introduction */}
                <Card className="border-0 shadow-card">
                    <CardContent className="p-4 text-sm text-muted-foreground">
                        <p>
                            JobsTrackr values your privacy and is committed to protecting your personal information. This Privacy Policy explains how we collect, use, store, and protect your data when you use the JobsTrackr mobile or web application.
                        </p>
                    </CardContent>
                </Card>

                {/* Section 1 */}
                <Section title="1. Information We Collect">
                    <p>We collect information only to provide core app functionality.</p>

                    <p className="font-medium text-foreground pt-2">a) Personal Information</p>
                    <p>When you create an account or update your profile, we may collect:</p>
                    <div className="pl-2 space-y-1">
                        <BulletPoint>Name</BulletPoint>
                        <BulletPoint>Date of birth</BulletPoint>
                        <BulletPoint>Gender</BulletPoint>
                        <BulletPoint>Category</BulletPoint>
                        <BulletPoint>Email address</BulletPoint>
                        <BulletPoint>Phone number</BulletPoint>
                        <BulletPoint>Address details (optional)</BulletPoint>
                    </div>

                    <p className="font-medium text-foreground pt-2">b) Documents Uploaded by Users</p>
                    <p className="pl-2">
                        Users may upload government-related documents such as certificates for profile updates. These documents are processed only for text extraction (OCR) and profile completion.
                    </p>

                    <p className="font-medium text-foreground pt-2">c) App Usage Information</p>
                    <p>We may collect limited usage data such as:</p>
                    <div className="pl-2 space-y-1">
                        <BulletPoint>Exams tracked by the user</BulletPoint>
                        <BulletPoint>Features used within the app</BulletPoint>
                        <BulletPoint>App performance and error logs</BulletPoint>
                    </div>
                </Section>

                {/* Section 2 */}
                <Section title="2. How We Use Your Information">
                    <p>We use your information strictly to:</p>
                    <div className="pl-2 space-y-1">
                        <BulletPoint>Track government exams and job notifications</BulletPoint>
                        <BulletPoint>Update user profiles using OCR (only after user confirmation)</BulletPoint>
                        <BulletPoint>Assist in form filling using saved profile data</BulletPoint>
                        <BulletPoint>Provide syllabus and expected cut-off insights</BulletPoint>
                        <BulletPoint>Send important exam-related notifications</BulletPoint>
                    </div>
                    <p className="font-semibold text-foreground pt-2">We do not sell or rent user data.</p>
                </Section>

                {/* Section 3 */}
                <Section title="3. OCR and AI Usage">
                    <div className="pl-2 space-y-1">
                        <BulletPoint>OCR is used only to extract text from user-uploaded documents</BulletPoint>
                        <BulletPoint>AI features are used to provide expected cut-off estimates and syllabus assistance</BulletPoint>
                        <BulletPoint>All extracted information is shown to the user for review before being saved</BulletPoint>
                        <BulletPoint>No document is processed without user action</BulletPoint>
                    </div>
                </Section>

                {/* Section 4 */}
                <Section title="4. Data Storage and Security">
                    <div className="pl-2 space-y-1">
                        <BulletPoint>User data is securely stored using encrypted cloud services (such as Supabase)</BulletPoint>
                        <BulletPoint>Industry-standard security measures are applied</BulletPoint>
                        <BulletPoint>Access to user data is restricted to authorized systems only</BulletPoint>
                    </div>
                </Section>

                {/* Section 5 */}
                <Section title="5. Data Sharing">
                    <p>We do not share personal data with third parties except:</p>
                    <div className="pl-2 space-y-1">
                        <BulletPoint>When required by law</BulletPoint>
                        <BulletPoint>For essential infrastructure services necessary to run the app securely</BulletPoint>
                    </div>
                </Section>

                {/* Section 6 */}
                <Section title="6. User Control and Data Deletion">
                    <div className="pl-2 space-y-1">
                        <BulletPoint>Users can update their profile information at any time</BulletPoint>
                        <BulletPoint>Users can request account and data deletion directly from the app or by contacting us</BulletPoint>
                        <BulletPoint>Upon deletion request, all personal data will be permanently removed within a reasonable time</BulletPoint>
                    </div>
                </Section>

                {/* Section 7 */}
                <Section title="7. Children's Privacy">
                    <p>
                        JobsTrackr is intended for users aged 18 years and above. We do not knowingly collect personal data from children.
                    </p>
                </Section>

                {/* Section 8 */}
                <Section title="8. Changes to This Privacy Policy">
                    <p>
                        We may update this Privacy Policy from time to time. Any changes will be reflected on this page with an updated revision date.
                    </p>
                </Section>

                {/* Section 9 */}
                <Section title="9. Contact Information">
                    <p>If you have any questions or concerns regarding this Privacy Policy, you can contact us at:</p>
                    <div className="pt-2 space-y-1">
                        <p>
                            📧 Email:{" "}
                            <a
                                href="mailto:support@jobstrackr.in"
                                className="text-[hsl(var(--blue-600))] font-medium hover:underline"
                            >
                                support@jobstrackr.in
                            </a>
                        </p>
                        <p>
                            🌐 Website:{" "}
                            <a
                                href="https://jobstrackr.in"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[hsl(var(--blue-600))] font-medium hover:underline"
                            >
                                https://jobstrackr.in
                            </a>
                        </p>
                    </div>
                </Section>
            </main>
        </div>
    );
}
