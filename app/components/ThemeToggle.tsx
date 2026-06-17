'use client';

/**
 * @fileoverview Theme toggle component for switching between light and dark mode.
 * Persists user preference to localStorage and respects system preference as fallback.
 * Features: Keyboard shortcut (Ctrl+Shift+D), Auto-switch based on time
 */

import { useEffect, useState, useCallback } from 'react';

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [autoMode, setAutoMode] = useState(false);

  // Check if current time is night (6pm to 6am)
  const isNightTime = useCallback(() => {
    const hour = new Date().getHours();
    return hour >= 18 || hour < 6;
  }, []);

  // Toggle theme function (can be called from button or keyboard)
  const toggleTheme = useCallback(() => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    localStorage.setItem('theme', newTheme ? 'dark' : 'light');
    localStorage.removeItem('theme-auto'); // Disable auto mode when manually toggled
    setAutoMode(false);
    document.documentElement.classList.toggle('dark', newTheme);
  }, [isDark]);

  // Initialize theme on mount
  useEffect(() => {
    setMounted(true);
    
    // Check if auto mode is enabled
    const isAuto = localStorage.getItem('theme-auto') === 'true';
    setAutoMode(isAuto);
    
    // Determine theme based on auto mode or stored preference
    let shouldBeDark;
    if (isAuto) {
      shouldBeDark = isNightTime();
    } else {
      const stored = localStorage.getItem('theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      shouldBeDark = stored === 'dark' || (!stored && prefersDark);
    }
    
    setIsDark(shouldBeDark);
    document.documentElement.classList.toggle('dark', shouldBeDark);
  }, [isNightTime]);

  // Keyboard shortcut: Ctrl+Shift+D
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        toggleTheme();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleTheme]);

  // Auto-switch based on time (check every minute)
  useEffect(() => {
    if (!autoMode) return;

    const interval = setInterval(() => {
      const shouldBeNight = isNightTime();
      if (shouldBeNight !== isDark) {
        setIsDark(shouldBeNight);
        document.documentElement.classList.toggle('dark', shouldBeNight);
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [autoMode, isDark, isNightTime]);

  // Don't render until mounted to prevent hydration mismatch
  if (!mounted) {
    return (
      <div className="w-9 h-9" /> // Placeholder to prevent layout shift
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-md hover:bg-gray-700 transition-colors duration-200"
      title={isDark ? 'Switch to Light Mode (Ctrl+Shift+D)' : 'Switch to Dark Mode (Ctrl+Shift+D)'}
      aria-label="Toggle theme"
    >
      {isDark ? (
        // Sun Icon (Light Mode)
        <svg 
          className="w-5 h-5 text-yellow-300" 
          fill="currentColor" 
          viewBox="0 0 20 20"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path 
            fillRule="evenodd" 
            d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" 
            clipRule="evenodd" 
          />
        </svg>
      ) : (
        // Moon Icon (Dark Mode)
        <svg 
          className="w-5 h-5 text-gray-700" 
          fill="currentColor" 
          viewBox="0 0 20 20"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
        </svg>
      )}
    </button>
  );
}
