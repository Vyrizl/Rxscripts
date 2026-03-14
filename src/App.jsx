import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './lib/auth';
import { ToastProvider } from './lib/toast';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import Scripts from './pages/Scripts';
import ScriptDetail from './pages/ScriptDetail';
import UploadScript from './pages/UploadScript';
import Auth from './pages/Auth';
import Executors from './pages/Executors';
import Docs from './pages/Docs';
import Profile from './pages/Profile';
import Admin from './pages/Admin';
import VerifyEmail from './pages/VerifyEmail';
import Setup from './pages/Setup';
import { BlogList, BlogPost, BlogEditor } from './pages/Blog';
import Tos from './pages/Tos';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <Navbar />
            <main style={{ flex: 1 }}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/scripts" element={<Scripts />} />
                <Route path="/scripts/:slug" element={<ScriptDetail />} />
                <Route path="/upload" element={<UploadScript />} />
                <Route path="/login" element={<Auth />} />
                <Route path="/executors" element={<Executors />} />
                <Route path="/docs" element={<Docs />} />
                <Route path="/u/:username" element={<Profile />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/verify-email" element={<VerifyEmail />} />
                <Route path="/setup" element={<Setup />} />
                <Route path="/blog" element={<BlogList />} />
                <Route path="/blog/new" element={<BlogEditor />} />
                <Route path="/blog/:slug" element={<BlogPost />} />
                <Route path="/blog/:slug/edit" element={<BlogEditor />} />
                <Route path="/tos" element={<Tos />} />
              </Routes>
            </main>
            <Footer />
          </div>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
