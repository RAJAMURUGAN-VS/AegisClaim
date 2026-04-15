import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'

// Auth Pages
import Login from './pages/auth/Login'

// Provider Pages
import PASubmissionForm from './pages/provider/PASubmissionForm'
import PAStatus from './pages/provider/PAStatus'

// Adjudicator Pages
import ReviewQueue from './pages/adjudicator/ReviewQueue'
import ReviewDetail from './pages/adjudicator/ReviewDetail'

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
  const { isAuthenticated, user } = useAuth()

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
  const { isAuthenticated, user } = useAuth()

  if (isAuthenticated && user) {
    switch (user.role) {
      case 'PROVIDER':
        return <Navigate to="/provider/submit" replace />
      case 'ADJUDICATOR':
        return <Navigate to="/adjudicator/queue" replace />
      case 'ADMIN':
        return <Navigate to="/admin/dashboard" replace />
      default:
        return <Navigate to="/login" replace />
    }
  }

  return <Outlet />
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route element={<PublicRoute />}>
            <Route path="/login" element={<Login />} />
          </Route>

          {/* Provider Routes */}
          <Route element={<ProtectedRoute allowedRoles={['PROVIDER']} />}>
            <Route path="/provider/submit" element={<PASubmissionForm />} />
            <Route path="/provider/status/:pa_id" element={<PAStatus />} />
          </Route>

          {/* Adjudicator Routes */}
          <Route element={<ProtectedRoute allowedRoles={['ADJUDICATOR']} />}>
            <Route path="/adjudicator/queue" element={<ReviewQueue />} />
            <Route path="/adjudicator/review/:pa_id" element={<ReviewDetail />} />
          </Route>

          {/* Admin Routes */}
          <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
            <Route path="/admin/dashboard" element={<Dashboard />} />
            <Route path="/admin/pa-list" element={<PAList />} />
            <Route path="/admin/analytics" element={<Analytics />} />
          </Route>

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App
