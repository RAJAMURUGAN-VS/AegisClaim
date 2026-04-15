# PA Workflow Frontend

A React + TypeScript frontend for the AI-Powered Prior Authorization (PA) Workflow system for health insurance.

## Tech Stack

- **Vite** - Fast build tool and dev server
- **React 18** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first styling
- **React Router v6** - Navigation
- **Axios** - API calls
- **TanStack Query** - Data fetching and caching
- **React Hook Form + Zod** - Form validation
- **Recharts** - Charts and graphs
- **Lucide React** - Icons

## Project Structure

```
src/
  /components
    /common        # Reusable UI components
    /layout        # Layout components (Sidebar, Header, PageLayout)
  /pages
    /provider      # Provider views
    /adjudicator   # Adjudicator views
    /admin         # Admin views
    /auth          # Authentication views
  /hooks           # Custom React Query hooks
  /services        # API service layer
  /types           # TypeScript type definitions
  /utils           # Utility functions
  /context         # React Context providers
```

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

3. Start the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Build for Production

```bash
npm run build
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Backend API URL | `http://localhost:8000/api/v1` |
| `VITE_APP_NAME` | Application name | `PA Workflow` |

## Routing

| Route | Component | Access |
|-------|-----------|--------|
| `/login` | Login | Public |
| `/provider/submit` | PA Submission Form | Provider |
| `/provider/status/:pa_id` | PA Status | Provider |
| `/adjudicator/queue` | Review Queue | Adjudicator |
| `/adjudicator/review/:pa_id` | Review Detail | Adjudicator |
| `/admin/dashboard` | Admin Dashboard | Admin |
| `/admin/pa-list` | All PA Requests | Admin |
| `/admin/analytics` | Analytics | Admin |

## Custom Color Scheme

The Tailwind config includes custom healthcare-professional colors:

- **Primary**: `#1F3864` (dark blue)
- **Secondary**: `#2E5FA3` (medium blue)
- **Success/Approve**: `#375623` (green)
- **Warning/Review**: `#C55A11` (orange)
- **Danger/Deny**: `#7B0000` (dark red)
- **Background**: `#F5F7FA`

## Features

### Authentication
- JWT-based authentication
- Token persistence in localStorage
- Auto-redirect to login on 401 errors
- Role-based route protection

### Data Fetching
- TanStack Query for server state management
- Caching and automatic refetching
- Optimistic updates

### Forms
- React Hook Form with Zod validation
- Accessible form inputs with error handling
- Custom validation rules for healthcare data (NPI, CPT, ICD codes)

### Components
- Fully typed React components
- Accessible UI with proper ARIA labels
- Consistent styling with Tailwind CSS
- Loading states and error handling

## API Integration

The `api.ts` service:
- Base URL: `http://localhost:8000/api/v1`
- Request interceptor adds JWT token
- Response interceptor handles 401/403 errors
- Proxy configured in `vite.config.ts`

## Next Steps

1. Implement full page components with forms and data tables
2. Add Recharts charts to the Dashboard and Analytics pages
3. Integrate with real backend endpoints
4. Add comprehensive error boundaries
5. Add unit tests with Vitest
6. Add E2E tests with Playwright

## License

MIT
