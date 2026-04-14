# React Frontend Setup Guide — AuthGuard AI

**Stack**: React 18 + TypeScript + Vite + TailwindCSS  
**Components**: Doctor Submission View, Decision Dashboard, Fraud Score Visualization  
**Status**: Production-ready scaffold | Ready for integration with backend API  

---

## Quick Start

### 1. Install Dependencies

```bash
cd d:\Sri Nithilan\Documents\GitHub\AegisClaim\frontend

npm install
```

**Dependencies Summary**:
- **React**: UI framework
- **React Router**: Page routing
- **Vite**: Fast build tool
- **TailwindCSS**: Utility-first styling
- **Lucide React**: Beautiful icons
- **Recharts**: Data visualization (fraud score bar)
- **React Dropzone**: Drag-and-drop file upload
- **Axios**: HTTP client
- **React Hot Toast**: Notifications
- **TypeScript**: Static typing

### 2. Configure Environment

Create `.env` file in `frontend/`:

```env
VITE_API_URL=http://localhost:8000/api/v1
VITE_AUTH_TOKEN_KEY=auth_token
VITE_APP_NAME=AuthGuard AI
```

### 3. Start Development Server

```bash
npm run dev
```

Server starts at: `http://localhost:3000`

### 4. Build for Production

```bash
npm run build
```

Output: `frontend/dist/` (ready for deployment)

---

## Component Architecture

### Core Components

#### `DoctorSubmissionView` (Main Entry Point)
**Purpose**: Multi-step PA submission form  
**Features**:
- 3-step wizard (Patient Info → Documents → Review)
- Drag-and-drop document upload
- Form validation
- Real-time file processing feedback

**Location**: `src/components/DoctorSubmissionView.tsx`

**Usage**:
```tsx
import { DoctorSubmissionView } from "./components/DoctorSubmissionView";

<DoctorSubmissionView />
```

---

#### `PADecisionDashboard`
**Purpose**: Display AI decision results  
**Features**:
- Real-time polling for decision status
- Final score (0-100) visualization
- Risk flag color-coded display
- Auth code display (if approved)
- Score breakdown (Policy/Clinical/Fraud)
- Integration with fraud analysis

**Location**: `src/components/PADecisionDashboard.tsx`

**Usage**:
```tsx
import { PADecisionDashboard } from "./components/PADecisionDashboard";

<PADecisionDashboard paId="PA-2026-XXXXXX" />
```

---

#### `FraudScoreBar`
**Purpose**: Visual fraud risk gauge  
**Features**:
- 0-100 score visualization
- Color-coded risk levels (Red/Yellow/Green)
- Anomaly flags display with descriptions
- Risk interpretation text

**Location**: `src/components/FraudScoreBar.tsx`

**Props**:
```tsx
{
  fraudScore: number;        // 0-100
  anomalyFlags: string[];    // List of detected anomalies
  riskFlag: "LOW" | "MEDIUM" | "HIGH";
}
```

---

#### `ExplainabilityCard`
**Purpose**: SHAP-style decision explanation  
**Features**:
- Feature importance decomposition
- Contribution analysis of each factor
- Decision factors breakdown
- Agent processing summaries
- Scoring formula display

**Location**: `src/components/ExplainabilityCard.tsx`

**Props**:
```tsx
{
  decision: PADecision;
  agentOutputs: {
    agent_a_output: any;
    agent_b_output: any;
    agent_c_output: any;
  };
}
```

---

### Service Layer

#### `apiClient.ts`
**Purpose**: Centralized API communication  
**Features**:
- Axios instance with auth interceptors
- Token management (localStorage)
- Auto-logout on 401
- Global error handling

**Key Methods**:
```typescript
apiClient.submitPARequest(formData)      // Submit PA
apiClient.getPAStatus(paId)             // Get decision
apiClient.uploadDocuments(paId, files)  // Upload docs
apiClient.pollPAStatus(paId)            // Poll until decision
```

**Location**: `src/services/apiClient.ts`

---

## UI Component Flow

```
┌─────────────────────────────────────────┐
│         App Entry Point                 │
└────────────┬────────────────────────────┘
             │
    ┌────────▼────────┐
    │                 │
    └────────┬────────┘
             │
             ├─────► DoctorSubmissionView (View 1)
             │            │
             │            ├─► PASubmissionForm (Step 1: Patient Info)
             │            ├─► Document Upload Zone (Step 2)
             │            └─► Review Summary (Step 3)
             │
             └─────► PADecisionDashboard (View 2)
                          │
                          ├─► Decision Card (Approve/Review/Deny)
                          ├─► Score Cards (Final/Risk/Time)
                          ├─► FraudScoreBar
                          │    │
                          │    └─► Anomaly Flags Display
                          │
                          └─► ExplainabilityCard
                               │
                               ├─► SHAP Decomposition
                               ├─► Decision Factors
                               └─► Agent Summaries
```

---

## File Upload & Document Processing

### Supported Formats
- **PDF**: `.pdf`
- **Images**: `.jpg`, `.jpeg`, `.png`, `.tiff`
- **Max Size**: 10MB per file

### Upload Flow
1. User drags/drops files into zone
2. Client-side validation (type + size)
3. Toast notification for feedback
4. Files stored in component state
5. On submit: Create FormData, send to `/api/v1/pa/submit`
6. Backend uploads to S3, triggers OCR

### Error Handling
```typescript
// Invalid file type
toast.error(`❌ ${file.name} — Invalid file type`)

// File too large
toast.error(`❌ ${file.name} — Exceeds 10MB limit`)

// API error
toast.error(`❌ Submission failed: ${error.message}`)
```

---

## API Integration

### PA Submission Endpoint
**POST** `/api/v1/pa/submit`

**Request** (FormData):
```json
{
  "patient_member_id": "MEM123456",
  "payer_name": "Blue Cross",
  "plan_id": "PPO-2024",
  "provider_npi": "1234567890",
  "icd_codes": "E11.9,I10",
  "cpt_codes": "99213,70450",
  "date_of_service": "2026-04-10",
  "documents": [File, File, ...]
}
```

**Response**:
```json
{
  "pa_id": "PA-2026-XXXXXX",
  "status": "PENDING",
  "message": "PA submitted successfully"
}
```

---

### PA Status Endpoint
**GET** `/api/v1/pa/{paId}`

**Response**:
```json
{
  "pa_id": "PA-2026-XXXXXX",
  "status": "COMPLETED",
  "decision": "AUTO_APPROVE",
  "final_score": 87.5,
  "risk_flag": "LOW",
  "auth_code": "PA-2026-123456",
  "auth_valid_until": "2026-07-13",
  "details": {
    "agent_a_output": { ... },
    "agent_b_output": { ... },
    "agent_c_output": { ... }
  }
}
```

---

## Styling & Tailwind

### Color Scheme
- **Primary**: Blue (#3B82F6)
- **Success**: Green (#10B981)
- **Warning**: Yellow (#F59E0B)
- **Danger**: Red (#EF4444)
- **Neutral**: Slate (gray scale)

### Component Patterns

**Card**:
```tsx
<div className="bg-white rounded-xl shadow-md p-6 border border-slate-200">
  {/* Content */}
</div>
```

**Button - Primary**:
```tsx
<button className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors">
  Action
</button>
```

**Button - Secondary**:
```tsx
<button className="px-6 py-3 border border-slate-300 rounded-lg font-medium text-slate-900 hover:bg-slate-50 transition-colors">
  Cancel
</button>
```

**Badge - Success**:
```tsx
<span className="badge badge-green">✓ Passed</span>
```

---

## State Management

Currently using React `useState` and `useEffect` hooks. For state scaling, hook in **Zustand** (already in dependencies):

```typescript
// Store creation (future)
import create from 'zustand'

interface PAStore {
  paId: string | null
  decision: PADecision | null
  setPAId: (id: string) => void
  setDecision: (decision: PADecision) => void
}

const usePA = create<PAStore>((set) => ({
  paId: null,
  decision: null,
  setPAId: (id) => set(() => ({ paId: id })),
  setDecision: (decision) => set(() => ({ decision }))
}))
```

---

## Routing (Future Enhancement)

To add full SPA routing:

```bash
npm install react-router-dom
```

```tsx
// App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'

<BrowserRouter>
  <Routes>
    <Route path="/submit" element={<DoctorSubmissionView />} />
    <Route path="/dashboard/:paId" element={<PADecisionDashboard />} />
    <Route path="/login" element={<LoginPage />} />
  </Routes>
</BrowserRouter>
```

---

## Performance Optimization

### Code Splitting
```tsx
import { lazy } from 'react'

const DoctorSubmissionView = lazy(() => 
  import('./components/DoctorSubmissionView')
)

<Suspense fallback={<Loader />}>
  <DoctorSubmissionView />
</Suspense>
```

### Image Optimization
- Use WebP format for icons
- Lazy load images in decision dashboard
- Compress medical document previews

### API Polling
- Exponential backoff on failures
- Max 60 retries with 500ms interval
- Automatic cleanup

---

## Testing Setup

### Unit Tests (Jest + React Testing Library)

```bash
npm install --save-dev jest @testing-library/react @testing-library/jest-dom
```

**Example Test**:
```tsx
import { render, screen } from '@testing-library/react'
import { FraudScoreBar } from './FraudScoreBar'

test('displays fraud score correctly', () => {
  render(<FraudScoreBar fraudScore={85} anomalyFlags={[]} riskFlag="LOW" />)
  expect(screen.getByText('85')).toBeInTheDocument()
})
```

---

## Accessibility (A11y)

All components include:
- ✓ Semantic HTML elements
- ✓ ARIA labels on form inputs
- ✓ Color contrast ratios ≥ 4.5:1
- ✓ Keyboard navigation support
- ✓ Focus indicators on buttons

**Example**:
```tsx
<input
  aria-label="Patient Member ID"
  aria-required="true"
  required
/>
```

---

## Deployment

### Vercel (Recommended)
```bash
npm install -g vercel
vercel
```

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "preview"]
```

### Environment Variables
Set in platform dashboard:
```
VITE_API_URL=https://api.aegis-claim.com/api/v1
VITE_APP_NAME=AuthGuard AI
```

---

## Common Issues & Fixes

### Issue: Vite Hot Reload Not Working
**Solution**:
```bash
# Restart dev server
npm run dev
```

### Issue: Tailwind Classes Not Applied
**Solution**:
```bash
# Rebuild Tailwind
npm run build

# Check that content paths in tailwind.config.ts are correct
content: ["./src/**/*.{js,ts,jsx,tsx}"]
```

### Issue: API CORS Error
**Solution**: Backend already configured with CORS in FastAPI. Ensure `VITE_API_URL` matches backend URL.

---

## Next Steps

1. ✅ **Frontend Scaffold Created** — Ready for integration
2. 📋 **Connect to Backend** — Update `apiClient.ts` with production API URL
3. 🎨 **Customize Branding** — Update company logo, colors in components
4. 📱 **Mobile Responsiveness** — Test on mobile devices
5. 🧪 **Integration Testing** — Test with real backend responses
6. 📊 **Analytics** — Add tracking for user flows
7. 🔐 **Authentication** — Implement login flow with JWT tokens

---

## Frontend-Backend Integration Checklist

- [ ] Backend API `/api/v1/pa/submit` endpoint functional
- [ ] Backend API `/api/v1/pa/{paId}` endpoint functional  
- [ ] Backend properly returns PA decision within 30 seconds
- [ ] S3 document upload working
- [ ] CORS headers configured on backend
- [ ] Authentication middleware in place
- [ ] Frontend `.env` configured with correct `VITE_API_URL`
- [ ] End-to-end test: Submit PA → View Decision
- [ ] Error handling for network timeouts
- [ ] Loading states during processing

---

**Documentation Version**: 1.0  
**Last Updated**: April 14, 2026  
**Framework**: React 18 + TypeScript + Vite + TailwindCSS  
**Status**: ✓ Production-ready scaffold
