import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Navbar } from './components/layout';
import { Home, ProjectDetail, EndpointDetail, Login, Register, AuthVerify } from './pages';
import { AuthProvider } from './hooks';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/auth/verify" element={<AuthVerify />} />
          <Route path="/projects/:projectId" element={<ProjectDetail />} />
          <Route path="/projects/:projectId/endpoints/:endpointId" element={<EndpointDetail />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
