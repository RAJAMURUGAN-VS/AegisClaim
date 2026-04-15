/**
 * Doctor's PA Submission View
 * - Drag-and-drop medical document upload
 * - Multi-step form with patient/payer info and clinical codes
 * - Real-time file validation
 */

import React, { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import toast from "react-hot-toast";
import { Upload, FileText, Trash2, CheckCircle } from "lucide-react";
import { apiClient } from "../services/apiClient";
import { PASubmissionForm } from "./PASubmissionForm";

interface DocumentFile {
  file: File;
  uploaded: boolean;
  confidence?: number;
}

interface DoctorSubmissionViewProps {
  onSubmitted?: (paId: string) => void;
}

export const DoctorSubmissionView: React.FC<DoctorSubmissionViewProps> = ({ onSubmitted }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [documents, setDocuments] = useState<DocumentFile[]>([]);
  const [formData, setFormData] = useState({
    patientMemberId: "",
    payerName: "",
    insurancePlanId: "",
    requestingProviderNPI: "",
    icdCodes: [] as string[],
    cptCodes: [] as string[],
    dateOfService: "",
  });
  const [submitting, setSubmitting] = useState(false);

  // Drag-and-drop handler
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const validFiles = acceptedFiles.filter((file) => {
      // Validate file type (PDF, JPG, PNG, TIFF)
      const validMimes = [
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/tiff",
      ];
      if (!validMimes.includes(file.type)) {
        toast.error(`❌ ${file.name} — Invalid file type. Use PDF, JPG, PNG, or TIFF.`);
        return false;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`❌ ${file.name} — File exceeds 10MB limit.`);
        return false;
      }

      return true;
    });

    const newDocuments = validFiles.map((file) => ({
      file,
      uploaded: false,
      confidence: undefined,
    }));

    setDocuments((prev) => [...prev, ...newDocuments]);
    toast.success(`✓ Added ${validFiles.length} document(s)`);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "image/*": [".jpg", ".jpeg", ".png", ".tiff"],
    },
  });

  const removeDocument = (index: number) => {
    setDocuments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFormChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    // Validation
    if (!formData.patientMemberId || !formData.payerName) {
      toast.error("❌ Please fill in all required fields");
      return;
    }

    if (documents.length === 0) {
      toast.error("❌ Please upload at least one document");
      return;
    }

    setSubmitting(true);
    try {
      // Build FormData for multipart upload
      const uploadFormData = new FormData();
      uploadFormData.append("patient_member_id", formData.patientMemberId);
      uploadFormData.append("payer_name", formData.payerName);
      uploadFormData.append("plan_id", formData.insurancePlanId);
      uploadFormData.append("provider_npi", formData.requestingProviderNPI);
      uploadFormData.append("icd_codes", JSON.stringify(formData.icdCodes));
      uploadFormData.append("cpt_codes", JSON.stringify(formData.cptCodes));
      uploadFormData.append("date_of_service", formData.dateOfService);

      // Append documents
      documents.forEach((doc) => {
        uploadFormData.append("documents", doc.file);
      });

      // Submit
      const response = await apiClient.submitPARequest(uploadFormData);

      toast.success(`✓ PA request submitted! ID: ${response.pa_id}`);
      onSubmitted?.(response.pa_id);
      setStep(3); // Move to decision dashboard
    } catch (error: any) {
      toast.error(`❌ Submission failed: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-slate-900">
            📋 Submit Prior Authorization Request
          </h1>
          <p className="text-slate-600 mt-2">
            Upload medical documents and patient information for rapid AI-powered approval
          </p>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex gap-4 mb-12">
          {[1, 2, 3].map((stepNum) => (
            <div
              key={stepNum}
              className={`flex-1 flex items-center gap-3 py-3 px-4 rounded-lg border-2 transition-all ${
                step === stepNum
                  ? "border-blue-500 bg-blue-50"
                  : step > stepNum
                    ? "border-green-500 bg-green-50"
                    : "border-slate-200 bg-slate-50"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                  step >= stepNum
                    ? "bg-blue-500 text-white"
                    : "bg-slate-300 text-slate-600"
                }`}
              >
                {step > stepNum ? "✓" : stepNum}
              </div>
              <span className="font-semibold text-sm text-slate-900">
                {stepNum === 1
                  ? "Patient & Payer"
                  : stepNum === 2
                    ? "Documents"
                    : "Review & Submit"}
              </span>
            </div>
          ))}
        </div>

        {/* Step 1: Patient & Payer Info */}
        {step === 1 && (
          <div className="bg-white rounded-xl shadow-md p-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">
              Step 1: Patient & Payer Information
            </h2>

            <PASubmissionForm
              formData={formData}
              onChange={handleFormChange}
              onNext={() => setStep(2)}
            />
          </div>
        )}

        {/* Step 2: Document Upload */}
        {step === 2 && (
          <div className="bg-white rounded-xl shadow-md p-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">
              Step 2: Upload Medical Documents
            </h2>

            {/* Drag-and-drop zone */}
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-all ${
                isDragActive
                  ? "border-blue-500 bg-blue-50"
                  : "border-slate-300 bg-slate-50 hover:border-slate-400"
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="mx-auto w-12 h-12 text-slate-400 mb-4" />
              <p className="text-lg font-semibold text-slate-900">
                {isDragActive
                  ? "Drop files here..."
                  : "Drag & drop medical documents here"}
              </p>
              <p className="text-sm text-slate-600 mt-2">
                or click to browse (PDF, JPEG, PNG, TIFF — max 10MB each)
              </p>
            </div>

            {/* Uploaded files list */}
            {documents.length > 0 && (
              <div className="mt-8">
                <h3 className="font-semibold text-slate-900 mb-4">
                  Uploaded Files ({documents.length})
                </h3>
                <div className="space-y-3">
                  {documents.map((doc, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200 hover:border-slate-300 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-blue-500" />
                        <div>
                          <p className="font-medium text-slate-900">
                            {doc.file.name}
                          </p>
                          <p className="text-xs text-slate-600">
                            {(doc.file.size / 1024 / 1024).toFixed(1)} MB
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        {doc.uploaded && doc.confidence !== undefined && (
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-5 h-5 text-green-500" />
                            <span className="text-sm text-green-700">
                              {(doc.confidence * 100).toFixed(0)}% confidence
                            </span>
                          </div>
                        )}

                        <button
                          onClick={() => removeDocument(idx)}
                          className="text-red-500 hover:text-red-700 transition-colors"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex gap-4 mt-8">
              <button
                onClick={() => setStep(1)}
                className="flex-1 px-6 py-3 border border-slate-300 rounded-lg font-medium text-slate-900 hover:bg-slate-50 transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={documents.length === 0}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Review & Submit */}
        {step === 3 && (
          <div className="bg-white rounded-xl shadow-md p-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">
              Step 3: Review & Submit
            </h2>

            {/* Summary */}
            <div className="grid grid-cols-2 gap-6 mb-8">
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-600">Patient Member ID</p>
                <p className="font-semibold text-slate-900 text-lg">
                  {formData.patientMemberId}
                </p>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-600">Insurance Payer</p>
                <p className="font-semibold text-slate-900 text-lg">
                  {formData.payerName}
                </p>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg col-span-2">
                <p className="text-sm text-slate-600">Documents to Process</p>
                <p className="font-semibold text-slate-900 text-lg">
                  {documents.length} file(s)
                </p>
              </div>
            </div>

            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full px-6 py-4 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Submitting to AI Pipeline...
                </>
              ) : (
                "✓ Submit PA Request"
              )}
            </button>

            <p className="text-xs text-slate-600 text-center mt-4">
              By submitting, you acknowledge that this information is accurate
              and complete.
            </p>
          </div>
        )}
      </div>

      {/* HIPAA Notice */}
      <div className="bg-yellow-50 border-t border-yellow-200 py-4 mt-12">
        <div className="max-w-6xl mx-auto px-4 text-center text-xs text-yellow-800">
          🔒 This system processes Protected Health Information (PHI).
          Unauthorized access is prohibited and subject to HIPAA penalties.
        </div>
      </div>
    </div>
  );
};
