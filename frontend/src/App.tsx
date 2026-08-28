import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Audit from './pages/Audit';
import ShareLink from './pages/ShareLink';
import ProtectedRoute from './components/ProtectedRoute';
import Members from './pages/Members';
import AcceptInvite from './pages/AcceptInvite';
import Trash from './pages/Trash';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/audit"
        element={
          <ProtectedRoute>
            <Audit />
          </ProtectedRoute>
        }
      />
      <Route path="/trash" element={<ProtectedRoute><Trash /></ProtectedRoute>} />
      <Route
        path="/org/members"
        element={
          <ProtectedRoute>
            <Members />
          </ProtectedRoute>
        }
      />
      <Route
        path="/invite/:token"
        element={
          <ProtectedRoute>
            <AcceptInvite />
          </ProtectedRoute>
        }
      />
      <Route path="/share/:token" element={<ShareLink />} />
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;
