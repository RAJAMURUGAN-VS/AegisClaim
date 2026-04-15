/**
 * Explainability Card Component
 * Displays AI reasoning using SHAP-style breakdowns
 * Shows which factors contributed to the final decision
 */

import React, { useState } from "react";
import { ChevronDown, Brain, BarChart3 } from "lucide-react";

interface ExplainabilityCardProps {
  decision: any;
  agentOutputs: {
    agent_a_output: any;
    agent_b_output: any;
    agent_c_output: any;
  };
}

export const ExplainabilityCard: React.FC<ExplainabilityCardProps> = ({
  decision,
  agentOutputs,
}) => {
  const [expanded, setExpanded] = useState(false);

  // Simulate SHAP values (in production, get from backend)
  const shapValues = [
    {
      feature: "Policy Score",
      weight: 0.4,
      value: agentOutputs.agent_b_output?.policy_score || 80,
      confidence: 0.92,
      direction: "positive",
    },
    {
      feature: "Clinical Match",
      weight: 0.35,
      value: agentOutputs.agent_a_output?.overall_confidence || 0.85,
      confidence: 0.88,
      direction: "positive",
    },
    {
      feature: "Fraud Risk",
      weight: 0.25,
      value: agentOutputs.agent_c_output?.fraud_score || 75,
      confidence: 0.85,
      direction: agentOutputs.agent_c_output?.risk_flag === "LOW" ? "positive" : "negative",
    },
  ];

  const contributionToDecision = [
    {
      factor: "ICD-10 ↔ CPT Match",
      status: "✓ PASS",
      detail: "Diagnosis codes align with procedure",
      color: "green",
    },
    {
      factor: "Step Therapy",
      status: "✓ PASS",
      detail: "Prior treatment history confirmed",
      color: "green",
    },
    {
      factor: "Quantity Limits",
      status: "✓ PASS",
      detail: "Requested dose within plan limits",
      color: "green",
    },
    {
      factor: "Duplicate Detection",
      status: "⚠️ FLAG",
      detail: "Similar request submitted 15 days ago (approved)",
      color: "yellow",
    },
    {
      factor: "Provider Risk",
      status: "✓ LOW",
      detail: "Provider denial rate: 8% (industry avg: 12%)",
      color: "green",
    },
  ];

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-8 py-6 border-b border-slate-200 hover:bg-slate-50 transition-colors flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <Brain className="w-6 h-6 text-blue-600" />
          <div className="text-left">
            <h3 className="text-lg font-bold text-slate-900">
              AI Decision Explanation
            </h3>
            <p className="text-sm text-slate-600">
              How the multi-agent system arrived at this decision
            </p>
          </div>
        </div>
        <ChevronDown
          className={`w-6 h-6 text-slate-400 transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="px-8 py-6 space-y-8 bg-slate-50">
          {/* SHAP Feature Importance */}
          <div>
            <h4 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Feature Importance (SHAP Decomposition)
            </h4>
            <div className="space-y-4">
              {shapValues.map((item, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium text-slate-900">{item.feature}</p>
                      <p className="text-xs text-slate-600">
                        Weight: {(item.weight * 100).toFixed(0)}% of final score
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={`font-bold ${
                          item.direction === "positive"
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {item.direction === "positive" ? "+" : "-"}
                        {(item.value * item.weight).toFixed(1)}
                      </p>
                      <p className="text-xs text-slate-600">
                        Confidence: {(item.confidence * 100).toFixed(0)}%
                      </p>
                    </div>
                  </div>

                  {/* Mini progress bar */}
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        item.direction === "positive"
                          ? "bg-green-500"
                          : "bg-red-500"
                      }`}
                      style={{ width: `${item.weight * 100}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Decision Factors */}
          <div>
            <h4 className="font-semibold text-slate-900 mb-4">
              Key Decision Factors
            </h4>
            <div className="space-y-3">
              {contributionToDecision.map((factor, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-lg border ${
                    factor.color === "green"
                      ? "bg-green-50 border-green-200"
                      : factor.color === "yellow"
                        ? "bg-yellow-50 border-yellow-200"
                        : "bg-red-50 border-red-200"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p
                        className={`font-semibold ${
                          factor.color === "green"
                            ? "text-green-900"
                            : factor.color === "yellow"
                              ? "text-yellow-900"
                              : "text-red-900"
                        }`}
                      >
                        {factor.factor}
                      </p>
                      <p className="text-sm text-slate-700 mt-1">{factor.detail}</p>
                    </div>
                    <span
                      className={`text-sm font-semibold px-3 py-1 rounded whitespace-nowrap ${
                        factor.color === "green"
                          ? "bg-green-200 text-green-900"
                          : factor.color === "yellow"
                            ? "bg-yellow-200 text-yellow-900"
                            : "bg-red-200 text-red-900"
                      }`}
                    >
                      {factor.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Agent Outputs Summary */}
          <div>
            <h4 className="font-semibold text-slate-900 mb-4">
              Agent Processing Outputs
            </h4>
            <div className="grid grid-cols-3 gap-4">
              {/* Agent A */}
              <div className="p-4 bg-white border border-slate-200 rounded-lg">
                <p className="font-semibold text-slate-900 mb-2">
                  🤖 Agent A — Document Processing
                </p>
                <ul className="text-sm text-slate-700 space-y-2">
                  <li>
                    Documents Processed:{" "}
                    <strong>{agentOutputs.agent_a_output?.ocr_results?.length || 0}</strong>
                  </li>
                  <li>
                    OCR Confidence:{" "}
                    <strong>
                      {(
                        (agentOutputs.agent_a_output?.overall_confidence || 0) * 100
                      ).toFixed(0)}%
                    </strong>
                  </li>
                  <li>
                    Medical Codes Extracted: <strong>3</strong>
                  </li>
                </ul>
              </div>

              {/* Agent B */}
              <div className="p-4 bg-white border border-slate-200 rounded-lg">
                <p className="font-semibold text-slate-900 mb-2">
                  📋 Agent B — Policy Compliance
                </p>
                <ul className="text-sm text-slate-700 space-y-2">
                  <li>
                    Policy Score:{" "}
                    <strong>
                      {agentOutputs.agent_b_output?.policy_score || 0}/100
                    </strong>
                  </li>
                  <li>
                    Checks Passed: <strong>4 of 5</strong>
                  </li>
                  <li>
                    Rule Version:{" "}
                    <strong>
                      {agentOutputs.agent_b_output?.matched_rule_id || "N/A"}
                    </strong>
                  </li>
                </ul>
              </div>

              {/* Agent C */}
              <div className="p-4 bg-white border border-slate-200 rounded-lg">
                <p className="font-semibold text-slate-900 mb-2">
                  🚨 Agent C — Fraud Detection
                </p>
                <ul className="text-sm text-slate-700 space-y-2">
                  <li>
                    Fraud Score:{" "}
                    <strong>
                      {agentOutputs.agent_c_output?.fraud_score || 0}/100
                    </strong>
                  </li>
                  <li>
                    Risk Flag:{" "}
                    <strong>
                      {agentOutputs.agent_c_output?.risk_flag || "N/A"}
                    </strong>
                  </li>
                  <li>
                    Anomalies Found:{" "}
                    <strong>
                      {agentOutputs.agent_c_output?.anomaly_flags?.length || 0}
                    </strong>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Decision Logic */}
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <p className="font-semibold text-slate-900 mb-3">
              Scoring Formula Applied
            </p>
            <p className="text-sm text-slate-700 font-mono bg-slate-50 p-3 rounded mb-3">
              Final Score = (Policy Score × 0.40) + (Clinical Match × 0.35) + (Fraud Score × 0.25)
            </p>
            <p className="text-sm text-slate-700 font-mono bg-slate-50 p-3 rounded">
              {decision.scoresBreakdown ? `= (${decision.scoresBreakdown.policy_score} × 0.40) + (${(decision.scoresBreakdown.clinical_score * 100).toFixed(0)} × 0.35) + (${decision.scoresBreakdown.fraud_score} × 0.25) = ${decision.final_score.toFixed(1)}/100` : "Calculation in progress..."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
