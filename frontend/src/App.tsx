import React from "react";
import { DoctorSubmissionView } from "./components/DoctorSubmissionView";
import { PADecisionDashboard } from "./components/PADecisionDashboard";

/**
 * App Router
 * Simple routing between submission and decision views
 */

interface AppProps {
  view?: "submission" | "dashboard";
  paId?: string;
}

export const App: React.FC<AppProps> = ({ view = "submission", paId }) => {
  const [currentView, setCurrentView] = React.useState<"submission" | "dashboard">(view);
  const [currentPaId, setCurrentPaId] = React.useState<string | undefined>(paId);

  if (currentView === "dashboard" && currentPaId) {
    return <PADecisionDashboard paId={currentPaId} />;
  }

  return (
    <DoctorSubmissionView
      onSubmitted={(newPaId) => {
        setCurrentPaId(newPaId);
        setCurrentView("dashboard");
      }}
    />
  );
};

export default App;
