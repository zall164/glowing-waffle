import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Gallery from './components/Gallery';
import ArtworkForm from './components/ArtworkForm';
import Settings from './components/Settings';
import Exhibitions from './components/Exhibitions';
import ExhibitionDetail from './components/ExhibitionDetail';
import Series from './components/Series';
import Admin from './components/Admin';
import Artist from './components/Artist';
import ArtistGallery from './components/ArtistGallery';
import Contact from './components/Contact';
import ForSale from './components/ForSale';
import Login from './components/Login';
import ProtectedRoute from './components/ProtectedRoute';
import './App.css';

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  
  const getThemeIcon = () => {
    if (theme === 'light') return '☀️';
    if (theme === 'dark') return '🌙';
    // Artistic themes hidden for now
    return '☀️';
  };
  
  return (
    <button onClick={toggleTheme} className="theme-toggle" aria-label="Toggle theme" title={`Current theme: ${theme}`}>
      {getThemeIcon()}
    </button>
  );
}

function Navigation() {
  const { isAuthenticated, user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const handleLogout = () => {
    logout();
    setMobileMenuOpen(false);
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  return (
    <nav className="navbar">
      <div className="nav-container">
        <div className="nav-header">
          <div className="nav-logo-container">
            <Link to="/" className="nav-logo" onClick={closeMobileMenu}>
              <span className="nav-logo-text">Artist Archive</span>
            </Link>
            {!isAuthenticated && (
              <Link to="/login" className="nav-logo-icon-link" onClick={closeMobileMenu}>
                <img src="/wiz.png" alt="" className="nav-logo-icon" />
              </Link>
            )}
            {isAuthenticated && (
              <img src="/wiz.png" alt="" className="nav-logo-icon" />
            )}
          </div>
          <button 
            className="nav-mobile-toggle" 
            onClick={toggleMobileMenu}
            aria-label="Toggle menu"
          >
            <span className={`hamburger ${mobileMenuOpen ? 'open' : ''}`}>
              <span></span>
              <span></span>
              <span></span>
            </span>
          </button>
        </div>
        <div className={`nav-links ${mobileMenuOpen ? 'open' : ''}`}>
          <Link to="/artist" className="nav-link" onClick={closeMobileMenu}>Artist</Link>
          <Link to="/" className="nav-link" onClick={closeMobileMenu}>Gallery</Link>
          <Link to="/for-sale" className="nav-link" onClick={closeMobileMenu}>For Sale</Link>
          <Link to="/series" className="nav-link" onClick={closeMobileMenu}>Series</Link>
          <Link to="/exhibitions" className="nav-link" onClick={closeMobileMenu}>Exhibitions</Link>
          <Link to="/contact" className="nav-link" onClick={closeMobileMenu}>Contact</Link>
          {isAuthenticated && (
            <>
              <Link to="/add" className="nav-link" onClick={closeMobileMenu}>Add/Edit Artwork</Link>
              <Link to="/settings" className="nav-link" onClick={closeMobileMenu}>Settings</Link>
            </>
          )}
          <div className="nav-auth-mobile">
            {isAuthenticated && (
              <button onClick={handleLogout} className="nav-link nav-button">
                Logout
              </button>
            )}
            <ThemeToggle />
          </div>
        </div>
      </div>
    </nav>
  );
}

function AppContent() {
  return (
    <Router>
      <div className="App">
        <Navigation />
        
        <main className="main-content">
          <Routes>
            <Route path="/artist" element={<Artist />} />
            <Route path="/artist/gallery" element={<ArtistGallery />} />
            <Route path="/" element={<Gallery />} />
            <Route path="/gallery" element={<Gallery />} />
            <Route path="/login" element={<Login />} />
            <Route path="/for-sale" element={<ForSale />} />
            <Route path="/series" element={<Series />} />
            <Route path="/exhibitions" element={<Exhibitions />} />
            <Route path="/exhibitions/:id" element={<ExhibitionDetail />} />
            <Route path="/contact" element={<Contact />} />
            <Route 
              path="/add" 
              element={
                <ProtectedRoute>
                  <ArtworkForm />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/edit/:id" 
              element={
                <ProtectedRoute>
                  <ArtworkForm />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/settings" 
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin" 
              element={
                <ProtectedRoute>
                  <Admin />
                </ProtectedRoute>
              } 
            />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

