import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ProviderTypeProvider } from './context/ProviderContext'
import { DateRangeProvider } from './hooks'

// Auth Pages
import Login from './pages/auth/Login'

// Provider Pages
import PASubmissionForm from './pages/provider/PASubmissionForm'
import PAStatus from './pages/provider/PAStatus'
import RealProviderSubmissionForm from './pages/provider/RealProviderSubmissionForm'
import RealProviderStatus from './pages/provider/RealProviderStatus'

// Adjudicator Pages
import ReviewQueue from './pages/adjudicator/ReviewQueue'
import ReviewDetail from './pages/adjudicator/ReviewDetail'
import AdjudicatorReview from './pages/provider/AdjudicatorReview'

// Admin Pages
import Dashboard from './pages/admin/Dashboard'
import PAList from './pages/admin/PAList'
import Analytics from './pages/admin/Analytics'

// Layout
import PageLayout from './components/layout/PageLayout'

// Protected Route Component
interface ProtectedRouteProps {
  allowedRoles: string[]
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles }) => {
  const { isAuthenticated, user, isLoading } = useAuth()

  // While auth is loading, show a loading spinner
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/login" replace />
  }

  return (
    <PageLayout>
      <Outlet />
    </PageLayout>
  )
}

// Public Route - redirects to appropriate dashboard if already authenticated
const PublicRoute = () => {
  const { isAuthenticated, user, isLoading } = useAuth()

  // While auth is loading, show a loading spinner
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (isAuthenticated && user) {
    switch (user.role) {
      case 'PROVIDER': {
        // Respect persisted providerType for redirect destination
        const providerType = localStorage.getItem('providerType') || 'testing'
        return <Navigate to={providerType === 'real' ? '/real-provider/submit' : '/provider/submit'} replace />
      }
      case 'ADJUDICATOR':
        return <Navigate to="/adjudicator/queue" replace />
      case 'ADMIN':
        return <Navigate to="/admin/dashboard" replace />
      case 'MEDICAL_DIRECTOR':
        return <Navigate to="/adjudicator/queue" replace />
      default:
        return <Navigate to="/login" replace />
    }
  }

  return <Outlet />
}

function App() {
  return (
    <ProviderTypeProvider>
      <AuthProvider>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            {/* Public Routes */}
            <Route element={<PublicRoute />}>
              <Route path="/login" element={<Login />} />
            </Route>

            {/* Provider Routes */}
            <Route element={<ProtectedRoute allowedRoles={['PROVIDER']} />}>
              <Route path="/provider/submit" element={<PASubmissionForm />} />
              <Route path="/provider/status/:pa_id" element={<PAStatus />} />
              <Route path="/real-provider/submit" element={<RealProviderSubmissionForm />} />
              <Route path="/real-provider/status/:pa_id" element={<RealProviderStatus />} />
            </Route>

            {/* Adjudicator Routes */}
            <Route element={<ProtectedRoute allowedRoles={['ADJUDICATOR', 'MEDICAL_DIRECTOR']} />}>
              <Route path="/adjudicator/queue" element={<ReviewQueue />} />
              <Route path="/adjudicator/review/:pa_id" element={<ReviewDetail />} />
              <Route path="/adjudicator/adjudicate/:pa_id" element={<AdjudicatorReview />} />
            </Route>

            {/* Admin Routes */}
            <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
              <Route element={<DateRangeProvider><Outlet /></DateRangeProvider>}>
                <Route path="/admin/dashboard" element={<Dashboard />} />
                <Route path="/admin/pa-list" element={<PAList />} />
                <Route path="/admin/analytics" element={<Analytics />} />
              </Route>
            </Route>

            {/* Default redirect */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ProviderTypeProvider>
  )
}

export default App
