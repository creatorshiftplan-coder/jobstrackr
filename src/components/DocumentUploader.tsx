import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDocuments } from "@/hooks/useDocuments";
import { Upload, FileText, Loader2, Trash2, Scan, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const DOCUMENT_TYPES = [
  { value: "job_application", label: "Job Application Form" },
  { value: "identity_card", label: "Identity Card (Aadhaar/PAN/Passport)" },
  { value: "marksheet", label: "Marksheet (Any Class/Degree)" },
  { value: "certificate", label: "Certificate (Any Class/Degree)" },
  { value: "caste_certificate", label: "Caste Certificate" },
];

interface DocumentUploaderProps {
  onOCRComplete?: (documentId: string, extractedData: any) => void;
}

export function DocumentUploader({ onOCRComplete }: DocumentUploaderProps) {
  const [selectedType, setSelectedType] = useState("");
  const { documents, isLoading, uploadDocument, processOCR, deleteDocument } = useDocuments();

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

    if (result && onOCRComplete) {
      onOCRComplete(doc.id, result.extracted_fields);
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

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <FileText className="h-5 w-5" />
          Upload Your Documents
        </CardTitle>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          With the help of AI, we'll auto-fill your profile information with your confirmation
        </p>
        <div className="flex items-start gap-2 mt-2 p-2 rounded-md bg-amber-50 border border-amber-200">
          <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">
            AI helps you save time by filling details. But sometimes small mistakes can slip through — please double-check before applying!
          </p>
        </div>
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

        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : documents.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No documents uploaded yet
          </p>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3 rounded-lg bg-secondary"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
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
                          Process with AI
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
  );
}
