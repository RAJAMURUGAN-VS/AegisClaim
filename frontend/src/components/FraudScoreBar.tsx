/**
 * Fraud Score Bar Component
 * Displays visual fraud risk gauge (0-100) with anomaly flags
 */

import React from "react";
import { AlertTriangle, TrendingUp } from "lucide-react";

interface FraudScoreBarProps {
  fraudScore: number;
  anomalyFlags: string[];
  riskFlag: "LOW" | "MEDIUM" | "HIGH";
}

export const FraudScoreBar: React.FC<FraudScoreBarProps> = ({
  fraudScore,
  anomalyFlags,
  riskFlag,
}) => {
  // Convert fraud score to visual risk level (inverted: high score = low risk)
  const getRiskColor = (score: number) => {
    if (score >= 75) return "green"; // Low risk
    if (score >= 50) return "yellow"; // Medium risk
    return "red"; // High risk
  };

  const riskColor = getRiskColor(fraudScore);

  // Map anomaly flags to readable descriptions
  const anomalyDescriptions: Record<string, string> = {
    UPCODING_DETECTED: "💹 Upcoding detected — higher complexity codes than diagnosis warrants",
    UNBUNDLING_DETECTED: "📦 Unbundling detected — procedures billed separately that should be bundled",
    IMPOSSIBLE_DAY_BILLING: "⚠️ Impossible day billing — multiple procedures not medically feasible on same day",
    DUPLICATE_CLAIM: "🔁 Duplicate claim — similar request submitted recently",
    HIGH_FREQUENCY: "📊 High frequency — unusually high submission rate for provider",
    PROVIDER_RISK: "👨‍⚕️ Provider risk — high denial rate for this provider in specialty",
  };

  return (
    <div className="space-y-6">
      {/* Score Gauge */}
      <div>
        <div className="flex items-end justify-between mb-3">
          <div>
            <p className="text-sm text-slate-600 font-semibold mb-1">
              Fraud Risk Score
            </p>
            <div className="flex items-baseline gap-2">
              <div
                className={`text-4xl font-bold ${
                  riskColor === "green"
                    ? "text-green-600"
                    : riskColor === "yellow"
                      ? "text-yellow-600"
                      : "text-red-600"
                }`}
              >
                {fraudScore}
              </div>
              <span className="text-slate-600">/100</span>
              <span
                className={`text-sm font-semibold px-3 py-1 rounded-full ${
                  riskColor === "green"
                    ? "bg-green-100 text-green-800"
                    : riskColor === "yellow"
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-red-100 text-red-800"
                }`}
              >
                {riskColor === "green" ? "LOW RISK" : riskColor === "yellow" ? "MEDIUM RISK" : "HIGH RISK"}
              </span>
            </div>
          </div>
          <TrendingUp className="w-6 h-6 text-slate-400" />
        </div>

        {/* Progress bar */}
        <div className="w-full bg-slate-200 rounded-full h-4 overflow-hidden">
          <div
            className={`h-4 rounded-full transition-all duration-500 ${
              riskColor === "green"
                ? "bg-green-500"
                : riskColor === "yellow"
                  ? "bg-yellow-500"
                  : "bg-red-500"
            }`}
            style={{ width: `${fraudScore}%` }}
          ></div>
        </div>

        {/* Scale labels */}
        <div className="flex justify-between text-xs text-slate-600 mt-2 font-semibold">
          <span>0 (High Risk)</span>
          <span>50 (Medium)</span>
          <span>100 (Low Risk)</span>
        </div>
      </div>

      {/* Anomaly Flags */}
      {anomalyFlags.length > 0 && (
        <div
          className={`rounded-lg p-4 ${
            riskFlag === "HIGH"
              ? "bg-red-50 border border-red-200"
              : riskFlag === "MEDIUM"
                ? "bg-yellow-50 border border-yellow-200"
                : "bg-blue-50 border border-blue-200"
          }`}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                riskFlag === "HIGH"
                  ? "text-red-600"
                  : riskFlag === "MEDIUM"
                    ? "text-yellow-600"
                    : "text-blue-600"
              }`}
            />
            <div className="flex-1">
              <p
                className={`font-semibold mb-3 ${
                  riskFlag === "HIGH"
                    ? "text-red-900"
                    : riskFlag === "MEDIUM"
                      ? "text-yellow-900"
                      : "text-blue-900"
                }`}
              >
                {anomalyFlags.length} Fraud Signal
                {anomalyFlags.length > 1 ? "s" : ""} Detected
              </p>
              <ul className="space-y-2">
                {anomalyFlags.map((flag, idx) => (
                  <li
                    key={idx}
                    className={`text-sm ${
                      riskFlag === "HIGH"
                        ? "text-red-800"
                        : riskFlag === "MEDIUM"
                          ? "text-yellow-800"
                          : "text-blue-800"
                    }`}
                  >
                    • {anomalyDescriptions[flag] || flag}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Risk Interpretation */}
      <div
        className={`rounded-lg p-4 ${
          riskColor === "green"
            ? "bg-green-50 border border-green-200"
            : riskColor === "yellow"
              ? "bg-yellow-50 border border-yellow-200"
              : "bg-red-50 border border-red-200"
        }`}
      >
        <p
          className={`text-sm font-semibold ${
            riskColor === "green"
              ? "text-green-900"
              : riskColor === "yellow"
                ? "text-yellow-900"
                : "text-red-900"
          }`}
        >
          {riskColor === "green"
            ? "✓ No significant fraud signals detected. This claim appears legitimate."
            : riskColor === "yellow"
              ? "⚠️ Minor anomalies detected. Recommend additional verification steps."
              : "✗ Multiple fraud signals detected. Mandatory human review required."}
        </p>
      </div>
    </div>
  );
};
