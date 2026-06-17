/**
 * @fileoverview Root layout for the Next.js application.
 * Sets up the basic HTML structure, including head and body tags.
 * Applies global styles and font configurations.
 */

import { Inter } from 'next/font/google';
import './globals.css'; // Tailwind CSS import

// Initialize the Inter font - subset 'latin' for broad character support
const inter = Inter({ subsets: ['latin'] });

// Default metadata for the entire application
export const metadata = {
  title: 'URL Shortener',
  description: 'Professional grade URL Shortener',
};

/**
 * Root layout component.
 * Wraps all pages and ensures a consistent structure and styling.
 * @param {object} props - Component props.
 * @param {React.ReactNode} props.children - The content of the current page or nested layout.
 * @returns {JSX.Element} The root HTML structure.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Get the storage driver from environment variables for display purposes
  const storageDriver = process.env.STORAGE_DRIVER || 'json';

  return (
    <html lang="en">
      {/* Apply dark mode class and basic styling */}
      <body className={`${inter.className} bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white transition-colors duration-300`}>
        {/* Main container for the application content */}
        <div className="min-h-screen flex flex-col">
          {/* Header section - Displays active storage driver */}
          <header className="bg-gray-800 text-white shadow-md sticky top-0 z-50">
            <div className="container mx-auto px-4 py-3 flex justify-between items-center">
              <h1 className="text-xl font-semibold">URL Shortener</h1>
              {/* Display storage driver with a dynamic background color */}
              <span className={`text-sm px-3 py-1 rounded-full font-medium
                ${storageDriver === 'mysql' ? 'bg-green-500' : 'bg-blue-500'}
              `}>
                Storage: {storageDriver.toUpperCase()}
              </span>
            </div>
          </header>

          {/* Main content area */}
          <main className="flex-grow container mx-auto px-4 py-8">
            {children}
          </main>

          {/* Footer section */}
          <footer className="bg-gray-800 text-gray-300 text-center py-4">
            © {new Date().getFullYear()} URL Shortener. All rights reserved.
          </footer>
        </div>
      </body>
    </html>
  );
}
