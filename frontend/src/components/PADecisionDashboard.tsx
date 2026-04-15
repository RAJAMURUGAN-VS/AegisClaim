/**
 * PA Decision Dashboard
 * Displays real-time AI decision (Approve/Review/Deny) with confidence scores,
 * fraud analysis, and explainable reasoning
 */

import React, { useEffect, useState } from "react";
import {
  CheckCircle,
  AlertCircle,
  XCircle,
  Loader,
  Download,
  Share2,
} from "lucide-react";
import { apiClient } from "../services/apiClient";
import { FraudScoreBar } from "./FraudScoreBar";
import { ExplainabilityCard } from "./ExplainabilityCard";

interface DecisionDashboardProps {
  paId: string;
}

type DecisionType = "AUTO_APPROVE" | "HUMAN_REVIEW" | "AUTO_DENY" | "PROCESSING";

interface PADecision {
  pa_id: string;
  status: string;
  decision: DecisionType | null;
  final_score: number | null;
  risk_flag: "LOW" | "MEDIUM" | "HIGH" | null;
  auth_code?: string;
  auth_valid_until?: string;
  created_at: string;
  decided_at: string;
  details: {
    agent_a_output: any;
    agent_b_output: any;
    agent_c_output: any;
  };
  scoresBreakdown?: {
    policy_score: number;
    clinical_score: number;
    fraud_score: number;
  };
}

export const PADecisionDashboard: React.FC<DecisionDashboardProps> = ({ paId }) => {
  const [decision, setDecision] = useState<PADecision | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "assistant"; text: string }>>([
    {
      role: "assistant",
      text: "I am your PA medical advisor/analyst assistant. Ask about clinical necessity, policy fit, fraud signals, or next steps.",
    },
  ]);

  useEffect(() => {
    const fetchDecision = async () => {
      try {
        setLoading(true);
        // Poll for decision with timeout
        const result = await apiClient.pollPAStatus(paId);
        setDecision(result);
      } catch (err: any) {
        setError(err.message || "Failed to fetch PA decision");
      } finally {
        setLoading(false);
      }
    };

    fetchDecision();
  }, [paId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-lg font-semibold text-slate-900">
            AI Pipeline Processing...
          </p>
          <p className="text-sm text-slate-600 mt-2">
            Analyzing documents, validating policies, and scoring fraud risk
          </p>
          <div className="mt-6 text-xs text-slate-600">
            This typically completes in under 30 seconds
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <p className="text-lg font-semibold text-slate-900">Error</p>
          <p className="text-sm text-slate-600 mt-2">{error}</p>
        </div>
      </div>
    );
  }

  if (!decision) {
    return null;
  }

  const decisionConfig = {
    PROCESSING: {
      icon: Loader,
      color: "slate",
      title: "⌛ PROCESSING",
      subtitle: "AI pipeline is still processing this request",
      bg: "bg-slate-50",
      borderColor: "border-slate-200",
      textColor: "text-slate-900",
    },
    AUTO_APPROVE: {
      icon: CheckCircle,
      color: "green",
      title: "✓ APPROVED",
      subtitle: "Authorization code issued",
      bg: "bg-green-50",
      borderColor: "border-green-200",
      textColor: "text-green-900",
    },
    HUMAN_REVIEW: {
      icon: AlertCircle,
      color: "blue",
      title: "📋 UNDER REVIEW",
      subtitle: "Pending human adjudicator review",
      bg: "bg-blue-50",
      borderColor: "border-blue-200",
      textColor: "text-blue-900",
    },
    AUTO_DENY: {
      icon: XCircle,
      color: "red",
      title: "✗ DENIED",
      subtitle: "Policy exclusion detected",
      bg: "bg-red-50",
      borderColor: "border-red-200",
      textColor: "text-red-900",
    },
  };

  const resolvedDecision: DecisionType = decision.decision ?? "PROCESSING";
  const resolvedScore = decision.final_score ?? 0;
  const resolvedRiskFlag: "LOW" | "MEDIUM" | "HIGH" = decision.risk_flag ?? "LOW";

  const handleChatSubmit = async () => {
    const message = chatInput.trim();
    if (!message || chatLoading) {
      return;
    }

    setChatMessages((prev) => [...prev, { role: "user", text: message }]);
    setChatInput("");
    setChatLoading(true);
    try {
      const response = await apiClient.chatWithPAContext(paId, message);
      setChatMessages((prev) => [...prev, { role: "assistant", text: response.answer || "No response available." }]);
    } catch (chatError: any) {
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", text: chatError?.message || "Chat request failed. Please try again." },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const config = decisionConfig[resolvedDecision];
  const Icon = config.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-slate-900">
            📊 Prior Authorization Decision
          </h1>
          <p className="text-slate-600 mt-2">PA ID: {paId}</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Decision Card */}
        <div
          className={`${config.bg} border-2 ${config.borderColor} rounded-xl p-8 mb-8`}
        >
          <div className="flex items-start gap-6">
            <Icon className={`w-16 h-16 text-${config.color}-600 flex-shrink-0`} />
            <div className="flex-1">
              <h2 className={`text-3xl font-bold ${config.textColor}`}>
                {config.title}
              </h2>
              <p className={`text-lg mt-2 ${config.textColor} opacity-80`}>
                {config.subtitle}
              </p>

              {/* Auth Code (if approved) */}
              {decision.decision === "AUTO_APPROVE" && decision.auth_code && (
                <div className="mt-6 bg-white rounded-lg p-4 border border-green-200">
                  <p className="text-xs text-slate-600 uppercase tracking-wide mb-2">
                    Authorization Code
                  </p>
                  <div className="flex items-center gap-3">
                    <code className="text-2xl font-mono font-bold text-green-700">
                      {decision.auth_code}
                    </code>
                    <button className="p-2 hover:bg-slate-100 rounded transition-colors">
                      <Share2 className="w-5 h-5 text-slate-600" />
                    </button>
                  </div>
                  <p className="text-xs text-slate-600 mt-3">
                    Valid until: <strong>{decision.auth_valid_until}</strong>
                  </p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2">
              <button className="px-4 py-2 bg-slate-100 text-slate-900 rounded-lg font-medium hover:bg-slate-200 transition-colors flex items-center gap-2">
                <Download className="w-4 h-4" />
                Download
              </button>
              <button className="px-4 py-2 bg-slate-100 text-slate-900 rounded-lg font-medium hover:bg-slate-200 transition-colors flex items-center gap-2">
                <Share2 className="w-4 h-4" />
                Share
              </button>
            </div>
          </div>
        </div>

        {/* Scores Grid */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          {/* Final Score */}
          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-blue-500">
            <p className="text-sm text-slate-600 font-semibold uppercase tracking-wide mb-3">
              Final Decision Score
            </p>
            <div className="flex items-baseline gap-2">
              <div className="text-4xl font-bold text-blue-600">
                {resolvedScore.toFixed(0)}
              </div>
              <span className="text-slate-600">/100</span>
            </div>
            <div className="mt-4 w-full bg-slate-200 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all"
                style={{ width: `${resolvedScore}%` }}
              ></div>
            </div>
            <p className="text-xs text-slate-600 mt-3">
              {resolvedScore >= 85
                ? "Auto-approval threshold exceeded"
                : resolvedScore >= 60
                  ? "Review required"
                  : "Below approval threshold"}
            </p>
          </div>

          {/* Risk Flag */}
          <div
            className={`bg-white rounded-xl shadow-md p-6 border-l-4 ${
              resolvedRiskFlag === "HIGH"
                ? "border-red-500"
                : resolvedRiskFlag === "MEDIUM"
                  ? "border-yellow-500"
                  : "border-green-500"
            }`}
          >
            <p className="text-sm text-slate-600 font-semibold uppercase tracking-wide mb-3">
              Fraud Risk Flag
            </p>
            <div
              className={`text-3xl font-bold ${
                resolvedRiskFlag === "HIGH"
                  ? "text-red-600"
                  : resolvedRiskFlag === "MEDIUM"
                    ? "text-yellow-600"
                    : "text-green-600"
              }`}
            >
              {resolvedRiskFlag}
            </div>
            <p className="text-xs text-slate-600 mt-3">
              {resolvedRiskFlag === "HIGH"
                ? "Mandatory human review triggered"
                : resolvedRiskFlag === "MEDIUM"
                  ? "Minor anomalies detected"
                  : "No fraud signals detected"}
            </p>
          </div>

          {/* Processing Time */}
          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-slate-500">
            <p className="text-sm text-slate-600 font-semibold uppercase tracking-wide mb-3">
              Processing Time
            </p>
            <div className="text-3xl font-bold text-slate-900">
              2.3<span className="text-lg">s</span>
            </div>
            <p className="text-xs text-slate-600 mt-3">
              Multi-agent AI pipeline completed
            </p>
          </div>
        </div>

        {/* Score Breakdown */}
        {decision.scoresBreakdown && (
          <div className="grid grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-md p-6">
              <p className="text-sm text-slate-600 font-semibold mb-2">
                Policy Compliance Score
              </p>
              <p className="text-2xl font-bold text-slate-900 mb-2">
                {decision.scoresBreakdown.policy_score}
              </p>
              <p className="text-xs text-slate-600">40% of final score</p>
            </div>
            <div className="bg-white rounded-xl shadow-md p-6">
              <p className="text-sm text-slate-600 font-semibold mb-2">
                Clinical Match Score
              </p>
              <p className="text-2xl font-bold text-slate-900 mb-2">
                {decision.scoresBreakdown.clinical_score}
              </p>
              <p className="text-xs text-slate-600">35% of final score</p>
            </div>
            <div className="bg-white rounded-xl shadow-md p-6">
              <p className="text-sm text-slate-600 font-semibold mb-2">
                Fraud Risk Score
              </p>
              <p className="text-2xl font-bold text-slate-900 mb-2">
                {decision.scoresBreakdown.fraud_score}
              </p>
              <p className="text-xs text-slate-600">25% of final score</p>
            </div>
          </div>
        )}

        {/* Fraud Analysis */}
        <div className="bg-white rounded-xl shadow-md p-8 mb-8">
          <h3 className="text-xl font-bold text-slate-900 mb-6">
            🔍 Fraud Analysis
          </h3>
          <FraudScoreBar
            fraudScore={decision.details.agent_c_output?.fraud_score || 75}
            anomalyFlags={
              decision.details.agent_c_output?.anomaly_flags || []
            }
            riskFlag={resolvedRiskFlag}
          />
        </div>

        {/* Explainability Card */}
        <div className="mb-8">
          <ExplainabilityCard
            decision={decision}
            agentOutputs={decision.details}
          />
        </div>

        {/* Context-aware Chat */}
        <div className="bg-white rounded-xl shadow-md p-8 mb-8">
          <h3 className="text-xl font-bold text-slate-900 mb-2">
            Clinical Advisor Chat
          </h3>
          <p className="text-sm text-slate-600 mb-4">
            Ask questions using the current PA report, extracted document insights, and active agent outputs.
          </p>

          <div className="border border-slate-200 rounded-lg p-4 h-72 overflow-y-auto bg-slate-50 space-y-3">
            {chatMessages.map((msg, idx) => (
              <div
                key={idx}
                className={`max-w-[85%] px-4 py-3 rounded-lg text-sm whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "ml-auto bg-blue-600 text-white"
                    : "mr-auto bg-white border border-slate-200 text-slate-900"
                }`}
              >
                {msg.text}
              </div>
            ))}
            {chatLoading && (
              <div className="mr-auto bg-white border border-slate-200 text-slate-900 px-4 py-3 rounded-lg text-sm">
                Thinking as medical advisor...
              </div>
            )}
          </div>

          <div className="mt-4 flex gap-2">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleChatSubmit();
                }
              }}
              placeholder="Ask about decision rationale, missing evidence, risk signals, or recommended next steps..."
              className="flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
            <button
              onClick={() => void handleChatSubmit()}
              disabled={chatLoading || !chatInput.trim()}
              className="px-5 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </div>
        </div>
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
