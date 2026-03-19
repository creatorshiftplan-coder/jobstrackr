import { ArrowLeft, Mail, Clock, Calendar, Wifi, RefreshCw, Globe, AlertTriangle, Bug, Camera, Shield, Trash2, Heart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSmartBack } from "@/hooks/useSmartBack";

export default function Help() {
  const navigate = useNavigate();
  const handleBack = useSmartBack("/");

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#E8F4FD] via-[#D6EEFF] to-[#F0F8FF] pb-8">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[hsl(var(--blue-900))] px-4 py-4">
        <div className="flex items-center justify-between">
          <button
            onClick={handleBack}
            className="h-10 w-10 rounded-full bg-[hsl(var(--blue-700))] flex items-center justify-center hover:bg-[hsl(var(--blue-600))] transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-white" />
          </button>
          <h1 className="font-display font-bold text-xl text-white">Help & Support</h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="px-4 py-4 space-y-4">
        {/* Need Help Section */}
        <Card className="border-0 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              💬 Need Help?
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm text-muted-foreground space-y-2">
            <p>We're here to assist you with JobsTrackr features like:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Exam tracking & notifications</li>
              <li>Profile setup & editing</li>
              <li>Document upload & OCR</li>
              <li>Form helper guidance</li>
              <li>Account & login issues</li>
            </ul>
            <p className="pt-2">If you have any questions or face any issue, feel free to contact us anytime.</p>
          </CardContent>
        </Card>

        {/* Contact Support Section */}
        <Card className="border-0 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              📞 Contact Support
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <Mail className="h-4 w-4 text-[hsl(var(--blue-700))]" />
              <span className="text-foreground">contact@jobstrackr.in</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Clock className="h-4 w-4 text-[hsl(var(--blue-700))]" />
              <span className="text-muted-foreground">Response Time: Within 24–48 hours</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Calendar className="h-4 w-4 text-[hsl(var(--blue-700))]" />
              <span className="text-muted-foreground">Available: Monday to Saturday</span>
            </div>
          </CardContent>
        </Card>

        {/* Before Contacting Us Section */}
        <Card className="border-0 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              🙋 Before Contacting Us
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm text-muted-foreground">
            <p className="mb-2">Please check:</p>
            <ul className="space-y-2">
              <li className="flex items-center gap-2">
                <Wifi className="h-4 w-4 text-[hsl(var(--blue-700))]" />
                Your internet connection
              </li>
              <li className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-[hsl(var(--blue-700))]" />
                That you're using the latest app version
              </li>
              <li className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-[hsl(var(--blue-700))]" />
                If information is verified from official sources
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Important Notice Section */}
        <Card className="border-0 shadow-card bg-amber-50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg text-amber-800">
              <AlertTriangle className="h-5 w-5" />
              Important Notice
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm text-amber-700 space-y-2">
            <p><strong>JobsTrackr only assists users with exam updates and form guidance.</strong></p>
            <p>We are not a Government app and do not accept job applications.</p>
            <p className="font-medium">Always verify all details from official Government sources.</p>
          </CardContent>
        </Card>

        {/* Report an Issue Section */}
        <Card className="border-0 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              📝 Report an Issue
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm text-muted-foreground space-y-2">
            <p>If you notice incorrect exam information, missing updates, or any bugs:</p>
            <ul className="space-y-2 ml-2">
              <li className="flex items-center gap-2">
                <Bug className="h-4 w-4 text-[hsl(var(--blue-700))]" />
                Use the "Report Issue" button
              </li>
              <li className="flex items-center gap-2">
                <Camera className="h-4 w-4 text-[hsl(var(--blue-700))]" />
                Provide a screenshot if possible
              </li>
            </ul>
            <p className="pt-1">This helps us improve faster.</p>
            <Button variant="outline" className="w-full mt-3" onClick={() => window.open('mailto:contact@jobstrackr.in?subject=Bug Report')}>
              Report Issue
            </Button>
          </CardContent>
        </Card>

        {/* Privacy & Security Section */}
        <Card className="border-0 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              🔐 Privacy & Security
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm text-muted-foreground space-y-2">
            <div className="flex items-start gap-2">
              <Shield className="h-4 w-4 text-[hsl(var(--blue-700))] mt-0.5" />
              <p>All your personal documents and data are encrypted and protected.</p>
            </div>
            <div className="flex items-start gap-2">
              <Trash2 className="h-4 w-4 text-[hsl(var(--blue-700))] mt-0.5" />
              <p>You can delete your data anytime from the app settings.</p>
            </div>
          </CardContent>
        </Card>

        {/* Thank You Section */}
        <Card className="border-0 shadow-card bg-[hsl(var(--blue-100))]">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-[hsl(var(--blue-700))]">
              <Heart className="h-5 w-5" />
              <span className="font-medium">Thank You for Using JobsTrackr!</span>
            </div>
            <p className="text-sm text-[hsl(var(--blue-600))] mt-1">
              Your feedback helps us make the app better every day.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
