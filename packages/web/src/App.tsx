import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Navbar } from './components/layout';
import { Home, ProjectDetail, EndpointDetail, Login, Register, AuthVerify, Pricing } from './pages';
import { AuthProvider } from './hooks';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen flex flex-col">
          <Navbar />
          <main className="flex-1 flex flex-col">
            <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/auth/verify" element={<AuthVerify />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/projects/:projectId" element={<ProjectDetail />} />
          <Route path="/projects/:projectId/endpoints/:endpointId" element={<EndpointDetail />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
