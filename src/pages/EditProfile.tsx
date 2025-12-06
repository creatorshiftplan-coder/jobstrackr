import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BottomNav } from "@/components/BottomNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile, Profile } from "@/hooks/useProfile";
import { DocumentUploader } from "@/components/DocumentUploader";
import { OCRResultModal } from "@/components/OCRResultModal";
import { toast } from "sonner";

export default function EditProfile() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { profile, isLoading, upsertProfile } = useProfile();
  const [activeTab, setActiveTab] = useState("personal");
  const [ocrData, setOcrData] = useState<Record<string, any> | null>(null);
  const [showOcrModal, setShowOcrModal] = useState(false);

  const [formData, setFormData] = useState<Partial<Profile>>({});

  // Merge profile data with form data
  const currentData = { ...profile, ...formData };

  const handleInputChange = (field: keyof Profile, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    try {
      await upsertProfile.mutateAsync(formData);
      setFormData({});
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleOCRComplete = (_documentId: string, extractedData: any) => {
    setOcrData(extractedData);
    setShowOcrModal(true);
  };

  const handleOCRConfirm = async (selectedFields: Record<string, any>) => {
    // Map OCR fields to profile fields
    const profileUpdate: Partial<Profile> = {};
    
    Object.entries(selectedFields).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        (profileUpdate as any)[key] = value;
      }
    });

    if (Object.keys(profileUpdate).length > 0) {
      try {
        await upsertProfile.mutateAsync(profileUpdate);
        toast.success("Profile updated from OCR data");
      } catch (error) {
        // Error handled in hook
      }
    }
    setShowOcrModal(false);
    setOcrData(null);
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    navigate("/auth");
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b border-border px-4 py-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <h1 className="font-display font-bold text-xl text-foreground">Edit Profile</h1>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={upsertProfile.isPending || Object.keys(formData).length === 0}
          >
            {upsertProfile.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      <main className="px-4 py-6 space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="personal">Personal</TabsTrigger>
            <TabsTrigger value="contact">Contact</TabsTrigger>
            <TabsTrigger value="category">Category</TabsTrigger>
            <TabsTrigger value="documents">Docs</TabsTrigger>
          </TabsList>

          {/* Personal Details Tab */}
          <TabsContent value="personal" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Personal Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Full Name (as per Class 10)</Label>
                  <Input
                    id="full_name"
                    value={currentData.full_name || ""}
                    onChange={(e) => handleInputChange("full_name", e.target.value)}
                    placeholder="Enter your full name"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="father_name">Father's Name</Label>
                    <Input
                      id="father_name"
                      value={currentData.father_name || ""}
                      onChange={(e) => handleInputChange("father_name", e.target.value)}
                      placeholder="Father's name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mother_name">Mother's Name</Label>
                    <Input
                      id="mother_name"
                      value={currentData.mother_name || ""}
                      onChange={(e) => handleInputChange("mother_name", e.target.value)}
                      placeholder="Mother's name"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date_of_birth">Date of Birth</Label>
                    <Input
                      id="date_of_birth"
                      type="date"
                      value={currentData.date_of_birth || ""}
                      onChange={(e) => handleInputChange("date_of_birth", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gender">Gender</Label>
                    <Select
                      value={currentData.gender || ""}
                      onValueChange={(value) => handleInputChange("gender", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="marital_status">Marital Status</Label>
                  <Select
                    value={(currentData as any).marital_status || ""}
                    onValueChange={(value) => handleInputChange("marital_status" as keyof Profile, value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Single">Single</SelectItem>
                      <SelectItem value="Married">Married</SelectItem>
                      <SelectItem value="Divorced">Divorced</SelectItem>
                      <SelectItem value="Widowed">Widowed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="aadhar_number">Aadhaar Number</Label>
                    <Input
                      id="aadhar_number"
                      value={currentData.aadhar_number || ""}
                      onChange={(e) => handleInputChange("aadhar_number", e.target.value)}
                      placeholder="12-digit Aadhaar"
                      maxLength={12}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pan_number">PAN Number</Label>
                    <Input
                      id="pan_number"
                      value={currentData.pan_number || ""}
                      onChange={(e) => handleInputChange("pan_number", e.target.value.toUpperCase())}
                      placeholder="10-char PAN"
                      maxLength={10}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Contact Tab */}
          <TabsContent value="contact" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Mobile Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={currentData.phone || ""}
                    onChange={(e) => handleInputChange("phone", e.target.value)}
                    placeholder="10-digit mobile number"
                    maxLength={10}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={currentData.email || ""}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    placeholder="your@email.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Full Address</Label>
                  <Textarea
                    id="address"
                    value={currentData.address || ""}
                    onChange={(e) => handleInputChange("address", e.target.value)}
                    placeholder="House No, Street, City, State"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pincode">PIN Code</Label>
                  <Input
                    id="pincode"
                    value={(currentData as any).pincode || ""}
                    onChange={(e) => handleInputChange("pincode" as keyof Profile, e.target.value)}
                    placeholder="6-digit PIN code"
                    maxLength={6}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Category Tab */}
          <TabsContent value="category" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Category & Community Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={currentData.category || ""}
                    onValueChange={(value) => handleInputChange("category", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="General">General</SelectItem>
                      <SelectItem value="OBC">OBC</SelectItem>
                      <SelectItem value="SC">SC</SelectItem>
                      <SelectItem value="ST">ST</SelectItem>
                      <SelectItem value="EWS">EWS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="caste_name">Caste Name</Label>
                    <Input
                      id="caste_name"
                      value={currentData.caste_name || ""}
                      onChange={(e) => handleInputChange("caste_name", e.target.value)}
                      placeholder="Enter caste name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="caste_certificate_number">Certificate No.</Label>
                    <Input
                      id="caste_certificate_number"
                      value={currentData.caste_certificate_number || ""}
                      onChange={(e) => handleInputChange("caste_certificate_number", e.target.value)}
                      placeholder="Certificate number"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sub_category">Sub-Category (if applicable)</Label>
                  <Select
                    value={(currentData as any).sub_category || ""}
                    onValueChange={(value) => handleInputChange("sub_category" as keyof Profile, value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select if applicable" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="None">None</SelectItem>
                      <SelectItem value="PwBD">PwBD (Person with Benchmark Disability)</SelectItem>
                      <SelectItem value="Ex-Serviceman">Ex-Serviceman</SelectItem>
                      <SelectItem value="Freedom Fighter">Freedom Fighter Dependent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="current_status">Current Status</Label>
                  <Select
                    value={(currentData as any).current_status || ""}
                    onValueChange={(value) => handleInputChange("current_status" as keyof Profile, value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Student">Student</SelectItem>
                      <SelectItem value="Job Seeker">Job Seeker</SelectItem>
                      <SelectItem value="Employed">Employed</SelectItem>
                      <SelectItem value="Self-Employed">Self-Employed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents" className="space-y-4 mt-4">
            <DocumentUploader onOCRComplete={handleOCRComplete} />
          </TabsContent>
        </Tabs>
      </main>

      {/* OCR Result Modal */}
      {ocrData && (
        <OCRResultModal
          isOpen={showOcrModal}
          onClose={() => {
            setShowOcrModal(false);
            setOcrData(null);
          }}
          extractedData={ocrData}
          onConfirm={handleOCRConfirm}
        />
      )}

      <BottomNav />
    </div>
  );
}
