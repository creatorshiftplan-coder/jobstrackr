import { useState } from "react";
import { ArrowLeft, Upload, FileText, Loader2, Trash2, Scan, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useDocuments } from "@/hooks/useDocuments";
import { useProfile } from "@/hooks/useProfile";
import { useEducation } from "@/hooks/useEducation";
import { useAuth } from "@/hooks/useAuth";
import { OCRResultModal } from "@/components/OCRResultModal";
import { BottomNav } from "@/components/BottomNav";
import { useSmartBack } from "@/hooks/useSmartBack";

const DOCUMENT_TYPES = [
  { value: "job_application", label: "Online Application Pdf" },
  { value: "identity_card", label: "Identity Proof" },
  { value: "marksheet", label: "Educational Mark Sheets" },
  { value: "certificate", label: "Educational Certificates" },
  { value: "caste_certificate", label: "Reservation / Eligibility Documents" },
];

// Define which fields belong to profiles vs education
const PROFILE_FIELDS = [
  'full_name', 'date_of_birth', 'gender', 'father_name', 'mother_name',
  'phone', 'email', 'address', 'aadhar_number', 'pan_number', 'passport_number',
  'category', 'caste_name', 'caste_certificate_number', 'caste_issuing_authority',
  'caste_issue_date', 'marital_status', 'pincode', 'ews_certificate_number',
  'ews_issuing_authority', 'sub_category', 'disability_type', 
  'disability_certificate_number', 'current_status'
];

const EDUCATION_FIELDS = [
  'board_university', 'institute_name', 'roll_number', 'qualification_type',
  'qualification_name', 'date_of_passing', 'marks_obtained', 'maximum_marks',
  'percentage', 'cgpa'
];

export default function Documents() {
  const navigate = useNavigate();
  const handleBack = useSmartBack("/");
  const { user, loading: authLoading } = useAuth();
  const { upsertProfile } = useProfile();
  const { addEducation } = useEducation();
  const { documents, isLoading, uploadDocument, processOCR, deleteDocument } = useDocuments();
  
  const [selectedType, setSelectedType] = useState("");
  const [ocrModalOpen, setOcrModalOpen] = useState(false);
  const [ocrData, setOcrData] = useState<Record<string, any>>({});

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedType) return;

    const doc = await uploadDocument.mutateAsync({ file, documentType: selectedType });
    if (doc) {
      setSelectedType("");
      e.target.value = "";
    }
  };

  const handleProcessOCR = async (doc: any) => {
    const result = await processOCR.mutateAsync({
      documentId: doc.id,
      documentType: doc.document_type,
      fileUrl: doc.file_url,
    });

    if (result) {
      setOcrData(result.extracted_fields);
      setOcrModalOpen(true);
    }
  };

  const handleConfirmOCR = (selectedFields: Record<string, any>) => {
    const profileData: Record<string, any> = {};
    const educationData: Record<string, any> = {};
    
    Object.entries(selectedFields).forEach(([key, value]) => {
      if (PROFILE_FIELDS.includes(key)) {
        profileData[key] = value;
      } else if (EDUCATION_FIELDS.includes(key)) {
        educationData[key] = value;
      }
    });
    
    if (Object.keys(profileData).length > 0) {
      upsertProfile.mutate(profileData);
    }
    
    if (Object.keys(educationData).length > 0) {
      if (!educationData.qualification_type) {
        educationData.qualification_type = educationData.qualification_name || 'other';
      }
      addEducation.mutate(educationData);
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "completed":
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Processed</Badge>;
      case "processing":
        return <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Processing</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  if (authLoading) {
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
    <div className="min-h-screen bg-background pb-20 md:pb-10">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-primary dark:bg-card px-4 py-4 md:hidden">
        <div className="flex items-center justify-between">
          <button
            onClick={handleBack}
            className="h-10 w-10 rounded-full bg-primary-foreground/20 flex items-center justify-center hover:bg-primary-foreground/30 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-primary-foreground dark:text-foreground" />
          </button>
          <h1 className="font-display font-bold text-xl text-primary-foreground dark:text-foreground">Upload Documents</h1>
          <div className="w-10" />
        </div>
      </header>

      <section className="hidden md:block border-b border-border/60 bg-[linear-gradient(135deg,hsl(var(--background))_0%,hsl(var(--secondary)/0.48)_46%,hsl(var(--primary)/0.12)_100%)]">
        <div className="mx-auto max-w-6xl px-6 py-8 lg:px-8">
          <div className="flex items-end justify-between gap-8">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                <Upload className="h-3.5 w-3.5" />
                OCR Assisted Uploads
              </div>
              <h1 className="font-display text-3xl font-bold tracking-tight text-foreground lg:text-4xl">Upload Documents</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground lg:text-base">
                Manage supporting documents, trigger OCR processing, and review extracted details from a cleaner desktop control panel.
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card/85 p-5 shadow-sm backdrop-blur-sm min-w-[240px]">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Uploaded Documents</p>
              <p className="mt-2 text-3xl font-bold text-foreground">{documents.length}</p>
              <p className="mt-1 text-sm text-muted-foreground">stored in your workspace</p>
            </div>
          </div>
        </div>
      </section>

      <main className="px-4 py-4 space-y-4 md:mx-auto md:max-w-6xl md:px-6 lg:px-8">
        {/* Info Card */}
        <Card className="border-0 shadow-card bg-primary/10 dark:bg-card">
          <CardContent className="p-4">
            <p className="text-sm text-primary dark:text-foreground">
              With the help of AI, we'll auto-fill your profile information with your confirmation.
            </p>
            <div className="flex items-start gap-2 mt-3 p-2 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-300">
                AI helps you save time by filling details. But sometimes small mistakes can slip through — please double-check before applying!
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Upload Section */}
        <Card className="border-0 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Upload className="h-5 w-5 text-primary" />
              Upload New Document
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select document type" />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button asChild disabled={!selectedType || uploadDocument.isPending}>
                <label className="cursor-pointer">
                  {uploadDocument.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={!selectedType || uploadDocument.isPending}
                  />
                </label>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Uploaded Documents */}
        <Card className="border-0 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5 text-primary" />
              Your Documents
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : documents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No documents uploaded yet. Upload your first document above!
              </p>
            ) : (
              <div className="space-y-3">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-secondary dark:bg-card border border-border"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate text-foreground">
                        {DOCUMENT_TYPES.find((t) => t.value === doc.document_type)?.label || doc.document_type}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{doc.file_name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(doc.ocr_status)}
                      {doc.ocr_status !== "completed" && doc.ocr_status !== "processing" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleProcessOCR(doc)}
                          disabled={processOCR.isPending}
                          className="text-xs"
                        >
                          {processOCR.isPending ? (
                            <>
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            <>
                              <Scan className="h-3 w-3 mr-1" />
                              Process
                            </>
                          )}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteDocument.mutate(doc.id)}
                        disabled={deleteDocument.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <OCRResultModal
        isOpen={ocrModalOpen}
        onClose={() => setOcrModalOpen(false)}
        extractedData={ocrData}
        onConfirm={handleConfirmOCR}
      />

      <BottomNav />
    </div>
  );
}
