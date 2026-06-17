"use client";

/**
 * @fileoverview Footer component with theme preference indicator
 * Shows current theme mode and keyboard shortcut hint
 */

import { useEffect, useState } from "react";

export default function Footer() {
	const [isDark, setIsDark] = useState(false);
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);

		// Initial check
		const checkTheme = () => {
			setIsDark(document.documentElement.classList.contains("dark"));
		};

		checkTheme();

		// Watch for theme changes
		const observer = new MutationObserver(checkTheme);
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class"],
		});

		return () => observer.disconnect();
	}, []);

	if (!mounted) {
		return <footer className="bg-gray-800 text-gray-300 text-center py-4">© {new Date().getFullYear()} URL Shortener Vibe Coding. All rights reserved.</footer>;
	}

	return (
		<footer className="bg-gray-800 text-gray-300 py-4">
			<div className="container mx-auto px-4">
				<div className="flex flex-col sm:flex-row justify-between items-center gap-2">
					{/* Copyright */}
					<div className="text-sm">© {new Date().getFullYear()} URL Shortener Vibe Coding. All rights reserved.</div>

					{/* Theme indicator & keyboard shortcut */}
					<div className="flex items-center gap-4 text-xs text-gray-400">
						{/* Theme indicator */}
						<div className="flex items-center gap-2">
							<span className="text-gray-500">Theme:</span>
							<span className={`px-2 py-1 rounded-md font-medium ${isDark ? "bg-gray-700 text-yellow-300" : "bg-gray-700 text-gray-200"}`}>
								{isDark ? (
									<span className="flex items-center gap-1">
										<svg
											className="w-3 h-3"
											fill="currentColor"
											viewBox="0 0 20 20"
										>
											<path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
										</svg>
										Dark
									</span>
								) : (
									<span className="flex items-center gap-1">
										<svg
											className="w-3 h-3"
											fill="currentColor"
											viewBox="0 0 20 20"
										>
											<path
												fillRule="evenodd"
												d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
												clipRule="evenodd"
											/>
										</svg>
										Light
									</span>
								)}
							</span>
						</div>

						{/* Keyboard shortcut hint */}
						<div className="hidden md:flex items-center gap-1">
							<kbd className="px-2 py-0.5 bg-gray-700 rounded border border-gray-600 text-xs">Ctrl</kbd>
							<span>+</span>
							<kbd className="px-2 py-0.5 bg-gray-700 rounded border border-gray-600 text-xs">Shift</kbd>
							<span>+</span>
							<kbd className="px-2 py-0.5 bg-gray-700 rounded border border-gray-600 text-xs">D</kbd>
						</div>
					</div>
				</div>
			</div>
		</footer>
	);
}
