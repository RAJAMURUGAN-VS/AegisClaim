/**
 * PA Submission Form Component
 * Captures patient demographics, insurance, and clinical information
 */

import React from "react";
import { Zap } from "lucide-react";

interface PASubmissionFormProps {
  formData: {
    patientMemberId: string;
    payerName: string;
    insurancePlanId: string;
    requestingProviderNPI: string;
    icdCodes: string[];
    cptCodes: string[];
    dateOfService: string;
  };
  onChange: (field: string, value: any) => void;
  onNext: () => void;
}

// Mock payer list - in production, fetch from API
const PAYERS = [
  "Blue Cross Blue Shield",
  "Aetna",
  "Cigna",
  "Humana",
  "UnitedHealthcare",
  "Anthem",
];

export const PASubmissionForm: React.FC<PASubmissionFormProps> = ({
  formData,
  onChange,
  onNext,
}) => {
  const [searchingProvider, setSearchingProvider] = React.useState(false);

  const handleVerifyNPI = async () => {
    if (!formData.requestingProviderNPI || formData.requestingProviderNPI.length !== 10) {
      alert("Please enter a valid 10-digit NPI");
      return;
    }

    setSearchingProvider(true);
    // TODO: Call NPPES API to verify NPI
    setTimeout(() => {
      setSearchingProvider(false);
      alert("✓ NPI verified successfully");
    }, 1000);
  };

  return (
    <form className="space-y-8">
      {/* Row 1: Member ID & Payer */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-2">
            Patient Member ID <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            placeholder="8–20 alphanumeric characters"
            value={formData.patientMemberId}
            onChange={(e) => onChange("patientMemberId", e.target.value)}
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none placeholder:text-slate-400"
          />
          <p className="text-xs text-slate-600 mt-1">
            Must match payer records exactly
          </p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-2">
            Insurance Payer <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.payerName}
            onChange={(e) => onChange("payerName", e.target.value)}
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          >
            <option value="">Select insurance company...</option>
            {PAYERS.map((payer) => (
              <option key={payer} value={payer}>
                {payer}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Row 2: Plan ID & NPI */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-2">
            Insurance Plan ID <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.insurancePlanId}
            onChange={(e) => onChange("insurancePlanId", e.target.value)}
            disabled={!formData.payerName}
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-slate-100"
          >
            <option value="">Select plan...</option>
            <option value="PPO-2024">PPO 2024</option>
            <option value="HMO-2024">HMO 2024</option>
          </select>
          <p className="text-xs text-slate-600 mt-1">
            Populated based on payer selection
          </p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-2">
            Requesting Provider NPI (10-digit) <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="1234567890"
              maxLength={10}
              value={formData.requestingProviderNPI}
              onChange={(e) => onChange("requestingProviderNPI", e.target.value.replace(/\D/g, ""))}
              className="flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
            <button
              type="button"
              onClick={handleVerifyNPI}
              disabled={searchingProvider}
              className="px-4 py-3 bg-blue-100 text-blue-700 rounded-lg font-medium hover:bg-blue-200 disabled:opacity-50 flex items-center gap-2 whitespace-nowrap transition-colors"
            >
              {searchingProvider ? (
                <div className="w-4 h-4 border-2 border-blue-700 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Zap className="w-4 h-4" />
              )}
              Verify
            </button>
          </div>
        </div>
      </div>

      {/* Row 3: Date of Service */}
      <div>
        <label className="block text-sm font-semibold text-slate-900 mb-2">
          Date of Service <span className="text-red-500">*</span>
        </label>
        <input
          type="date"
          value={formData.dateOfService}
          onChange={(e) => onChange("dateOfService", e.target.value)}
          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
        />
        <p className="text-xs text-slate-600 mt-1">
          Must be within the last 90 days
        </p>
      </div>

      {/* Row 4: Medical Codes */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-2">
            ICD-10 Diagnosis Codes (at least 1) <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            placeholder="E11.9, I10 (comma-separated)"
            value={formData.icdCodes.join(", ")}
            onChange={(e) => onChange("icdCodes", e.target.value.split(",").map(c => c.trim()))}
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none placeholder:text-slate-400"
          />
          <p className="text-xs text-slate-600 mt-1">
            Extracted from documents or enter manually
          </p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-2">
            CPT/HCPCS Procedure Codes (at least 1) <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            placeholder="99213, 70450 (comma-separated)"
            value={formData.cptCodes.join(", ")}
            onChange={(e) => onChange("cptCodes", e.target.value.split(",").map(c => c.trim()))}
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none placeholder:text-slate-400"
          />
          <p className="text-xs text-slate-600 mt-1">
            Procedure or treatment codes
          </p>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex gap-4 pt-4">
        <button
          type="button"
          onClick={onNext}
          disabled={!formData.patientMemberId || !formData.payerName}
          className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Next: Upload Documents →
        </button>
      </div>
    </form>
  );
};
