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
import Approvals from './pages/Approvals';
import Organizations from './pages/Organizations';
import OrgDrive from './pages/OrgDrive';
import JoinRequests from './pages/JoinRequests';
import MyOrganizations from './pages/MyOrganizations';

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
      <Route path="/approvals" element={<ProtectedRoute><Approvals /></ProtectedRoute>} />
      <Route path="/organizations" element={<ProtectedRoute><Organizations /></ProtectedRoute>} />
      <Route path="/organizations/mine" element={<ProtectedRoute><MyOrganizations /></ProtectedRoute>} />
      <Route path="/organizations/:orgId/drive" element={<ProtectedRoute><OrgDrive /></ProtectedRoute>} />
      <Route path="/organizations/:orgId/join-requests" element={<ProtectedRoute><JoinRequests /></ProtectedRoute>} />
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
