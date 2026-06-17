/**
 * @fileoverview Provides configuration for Tailwind CSS, including plugins and theme settings.
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
	// Content arrays tell Tailwind where to scan for classes.
	content: [
		"./app/**/*.{js,ts,jsx,tsx,mdx}", // Scan all files in app directory
		"./pages/**/*.{js,ts,jsx,tsx,mdx}", // Scan all files in pages directory (if applicable)
		"./components/**/*.{js,ts,jsx,tsx,mdx}", // Scan all files in components directory
		"./src/**/*.{js,ts,jsx,tsx,mdx}", // Scan files in src directory (if used)
		// Add any other directories where you use Tailwind classes
	],
	// darkMode: 'class', // Enable dark mode based on 'dark' class on <html> element
	theme: {
		extend: {
			// Extend Tailwind's default theme
			colors: {
				// Example: Define custom colors
				// 'primary': '#ff6347',
				// 'secondary': '#4682b4',

				// Dark mode overrides (if darkMode is enabled)
				gray: {
					50: "#f9fafb",
					100: "#f3f4f6",
					200: "#e5e7eb",
					300: "#d1d5db",
					400: "#9ca3af",
					500: "#6b7280",
					600: "#4b5563",
					700: "#374151",
					800: "#1f2937", // Dark background
					900: "#111827", // Very dark background
				},
			},
			// Add custom spacing, typography, etc. here
			spacing: {
				"128": "32rem", // Example custom spacing
			},
			borderRadius: {
				"4xl": "2rem", // Example custom border radius
			},
			// backgroundImage: {
			//   'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
			//   'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-conic-stops))',
			// }
		},
		// You can also override entire theme properties if needed
		// screens: {
		//   'xs': '480px',
		//   'sm': '640px',
		//   'md': '768px',
		//   'lg': '1024px',
		//   'xl': '1280px',
		//   '2xl': '1536px',
		// },
	},
	plugins: [
		// Add Tailwind CSS plugins here
		// require('@tailwindcss/forms'), // Example: Forms plugin
		// require('@tailwindcss/typography'), // Example: Typography plugin
		// require('@tailwindcss/aspect-ratio'), // Example: Aspect Ratio plugin
		// require('@tailwindcss/container-queries'), // Example: Container Queries plugin
	],
};
