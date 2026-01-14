import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    // Check localStorage for saved preference
    const saved = localStorage.getItem('theme');
    if (saved && ['light', 'dark', 'artistic', 'artistic-dark'].includes(saved)) {
      return saved;
    }
    // Default to system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });

  useEffect(() => {
    // Save preference to localStorage
    localStorage.setItem('theme', theme);
    
    // Remove all theme classes
    document.documentElement.classList.remove('dark-theme', 'artistic-theme', 'artistic-dark-theme');
    
    // Apply theme class to document
    if (theme === 'dark') {
      document.documentElement.classList.add('dark-theme');
    } else if (theme === 'artistic') {
      document.documentElement.classList.add('artistic-theme');
    } else if (theme === 'artistic-dark') {
      document.documentElement.classList.add('artistic-theme', 'artistic-dark-theme');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => {
      if (prev === 'light') return 'dark';
      if (prev === 'dark') return 'light';
      // Skip artistic themes for now - just toggle between light and dark
      if (prev === 'artistic' || prev === 'artistic-dark') return 'light';
      return 'light';
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, isDark: theme === 'dark', isArtistic: theme === 'artistic' || theme === 'artistic-dark', toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};





