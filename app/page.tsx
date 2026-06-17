"use client";

/**
 * @fileoverview Main page component for the URL Shortener dashboard.
 * Includes form for creating short URLs and a table for managing existing links.
 * Fetches and displays a list of all created links, with search/filter capabilities.
 */

import Link from "next/link";
import { useState, useEffect, useMemo, useCallback } from "react";
import { shortenUrlSchema, ShortenUrlInput } from "@/lib/validators";
import { Link as LinkType } from "@/types";
import { isZodError, getErrorMessage } from "@/types/errors";

// --- Component ---
export default function HomePage() {
	// Form Input States
	const [originalUrl, setOriginalUrl] = useState("");
	const [customAlias, setCustomAlias] = useState("");
	const [expiresInDays, setExpiresInDays] = useState<string | "">("");

	// API Feedback States
	const [apiError, setApiError] = useState<string | null>(null);
	const [shortUrlData, setShortUrlData] = useState<{ shortCode: string; fullShortUrl: string; originalUrl: string } | null>(null);
	const [isLoading, setIsLoading] = useState(false);

	// Link Table States
	const [links, setLinks] = useState<LinkType[]>([]);
	const [isFetchingLinks, setIsFetchingLinks] = useState(true);
	const [deleteError, setDeleteError] = useState<string | null>(null);
	const [isDeleting, setIsDeleting] = useState<string | null>(null); // Track ID of link being deleted

	// Search/Filter state
	const [searchTerm, setSearchTerm] = useState("");

	// --- Memoized function to fetch links ---
	const fetchLinks = useCallback(async () => {
		setIsFetchingLinks(true);
		try {
			const response = await fetch("/api/links");
			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.error?.message || `HTTP error ${response.status}`);
			}
			const data: LinkType[] = await response.json();
			setLinks(data);
		} catch (error: unknown) {
			if (process.env.NODE_ENV === "development") {
				console.error("Failed to fetch links:", error);
			}
			setApiError(`Could not load your links. ${getErrorMessage(error)}`);
		} finally {
			setIsFetchingLinks(false);
		}
	}, []);

	// --- Effect to fetch links on mount ---
	useEffect(() => {
		fetchLinks();
	}, [fetchLinks]);

	// --- Handler: Create Short URL ---
	const handleShorten = async (e: React.FormEvent) => {
		e.preventDefault();
		setApiError(null);
		setShortUrlData(null);
		setIsLoading(true);

		const expiresInDaysNum = expiresInDays === "" ? undefined : parseInt(expiresInDays, 10);
		if (expiresInDays !== "" && (isNaN(expiresInDaysNum!) || expiresInDaysNum! <= 0)) {
			setApiError("Expires In (Days) must be a positive whole number.");
			setIsLoading(false);
			return;
		}

		try {
			// Zod validation before API call
			shortenUrlSchema.parse({ originalUrl, customAlias: customAlias || undefined, expiresInDays: expiresInDaysNum });

			const response = await fetch("/api/shorten", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ originalUrl, customAlias: customAlias || undefined, expiresInDays: expiresInDaysNum }),
			});

			const data = await response.json();

			if (!response.ok) {
				if (response.status === 409) setApiError("Custom alias is already in use. Please choose another.");
				else if (response.status === 400) {
					// Handle Zod validation errors - message can be string or object
					let errorList: string;
					if (data.error?.message && typeof data.error.message === "object") {
						errorList = Object.entries(data.error.message as Record<string, unknown>)
							.map(([field, messages]) => {
								const msgArray = Array.isArray(messages) ? messages : [String(messages)];
								return `${field}: ${msgArray.join(", ")}`;
							})
							.join("; ");
					} else {
						errorList = data.error?.message || "Please check your input.";
					}
					setApiError(`Invalid input: ${errorList}`);
				} else if (response.status === 429) setApiError("Rate limit exceeded. Please try again later.");
				else setApiError(data.error?.message || `Error creating short URL: ${response.statusText}`);

				setIsLoading(false);
				return;
			}

			// Success
			setShortUrlData(data);
			fetchLinks(); // Refresh link list

			// Clear form fields
			setOriginalUrl("");
			setCustomAlias("");
			setExpiresInDays("");
		} catch (err: unknown) {
			if (isZodError(err)) {
				const errorMessages = err.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
				setApiError(`Validation Error: ${errorMessages}`);
			} else {
				if (process.env.NODE_ENV === "development") {
					console.error("Frontend shortening error:", err);
				}
				setApiError(`An unexpected error occurred. ${getErrorMessage(err)}`);
			}
		} finally {
			setIsLoading(false);
		}
	};

	// --- Handler: Delete Link ---
	const handleDelete = async (id: string) => {
		if (!confirm("Are you sure you want to delete this link? This action cannot be undone.")) return;

		setIsDeleting(id);
		setDeleteError(null);
		try {
			const response = await fetch(`/api/links/${id}`, { method: "DELETE" });

			if (!response.ok) {
				if (response.status === 404) throw new Error("Link not found or already deleted.");
				throw new Error(`Failed to delete link. Server responded with ${response.status}`);
			}

			setLinks((prevLinks) => prevLinks.filter((link) => link.id !== id));
			setApiError(null); // Clear apiError if delete succeeds
		} catch (error: unknown) {
			if (process.env.NODE_ENV === "development") {
				console.error("Error deleting link:", error);
			}
			setDeleteError(getErrorMessage(error) || "Could not delete the link.");
		} finally {
			setIsDeleting(null);
		}
	};

	// --- Utility: Copy to Clipboard ---
	const handleCopy = useCallback((url: string) => {
		navigator.clipboard
			.writeText(url)
			.then(() => {
				alert("Short URL copied to clipboard!");
			})
			.catch((err: unknown) => {
				if (process.env.NODE_ENV === "development") {
					console.error("Failed to copy URL: ", err);
				}
				alert("Failed to copy URL. Please copy it manually.");
			});
	}, []);

	// --- Memoized Processed Links ---
	const processedLinks = useMemo(() => {
		const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
		return links.map((link) => ({
			...link,
			createdAtFmt: new Date(link.createdAt).toLocaleDateString(),
			expiresAtFmt: link.expiresAt ? new Date(link.expiresAt).toLocaleDateString() : "Never",
			isExpired: link.expiresAt ? new Date(link.expiresAt) < new Date() : false,
			fullShortUrl: new URL(`/${link.shortCode}`, baseUrl).toString(),
		}));
	}, [links]);

	// Filter links based on search term
	const filteredLinks = useMemo(() => {
		if (!searchTerm) return processedLinks; // Return all if no search term
		const lowerCaseSearchTerm = searchTerm.toLowerCase();

		return processedLinks.filter((link) => link.shortCode.toLowerCase().includes(lowerCaseSearchTerm) || link.originalUrl.toLowerCase().includes(lowerCaseSearchTerm) || link.createdAtFmt.toLowerCase().includes(lowerCaseSearchTerm));
	}, [processedLinks, searchTerm]); // Re-filter when links or search term change

	// --- Render ---
	return (
		<div className="container mx-auto px-4 py-8">
			<h1 className="text-4xl font-bold text-center my-8 text-gray-900 dark:text-white">URL Shortener Vibe Coding Dashboard</h1>

			{/* Create URL Form Section */}
			<div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 mb-10">
				<h2 className="text-2xl font-semibold mb-5 text-gray-900 dark:text-white">Create a New Short URL</h2>
				<form
					onSubmit={handleShorten}
					className="space-y-5"
				>
					{/* Original URL Input */}
					<div>
						<label
							htmlFor="originalUrl"
							className="block text-sm font-medium text-gray-700 dark:text-gray-300"
						>
							Original URL
						</label>
						<input
							id="originalUrl"
							type="url"
							value={originalUrl}
							onChange={(e) => setOriginalUrl(e.target.value)}
							required
							placeholder="https://example.com/your/very/long/url/here"
							className="mt-1 p-3 block w-full rounded-md bg-gray-200 border-gray-300 dark:border-gray-600 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
						/>
					</div>

					{/* Custom Alias Input */}
					<div>
						<label
							htmlFor="customAlias"
							className="block text-sm font-medium text-gray-700 dark:text-gray-300"
						>
							Custom Alias (Optional)
						</label>
						<div className="flex items-center space-x-0">
							<span className="text-sm sm:p-3 bg-indigo-600 text-white font-semibold rounded-md whitespace-nowrap hidden sm:inline sm:mr-2">{process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/</span>
							<input
								id="customAlias"
								type="text"
								value={customAlias}
								onChange={(e) => setCustomAlias(e.target.value.trim())}
								placeholder="my-alias (3-20 chars, alphanumeric, _, -)"
								className="p-3 flex-grow rounded-md bg-gray-200 border-gray-300 dark:border-gray-600 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
								maxLength={20}
							/>
						</div>
					</div>

					{/* Expires In Days Input */}
					<div>
						<label
							htmlFor="expiresInDays"
							className="block text-sm font-medium text-gray-700 dark:text-gray-300"
						>
							Expires In (Days) (Optional)
						</label>
						<input
							id="expiresInDays"
							type="number"
							value={expiresInDays}
							onChange={(e) => setExpiresInDays(e.target.value)}
							min="1"
							placeholder="e.g., 30"
							className="mt-1 p-3 block w-full rounded-md bg-gray-200 border-gray-300 dark:border-gray-600 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
						/>
					</div>

					{/* Error Message Display */}
					{(apiError || deleteError) && <p className="text-red-600 dark:text-red-400 text-center p-3 bg-red-50 dark:bg-red-900 rounded-md border border-red-200 dark:border-red-700">{apiError || deleteError}</p>}

					{/* Success Message Display */}
					{shortUrlData && (
						<div className="text-center p-4 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300 rounded-md shadow-inner border border-green-200 dark:border-green-700">
							<p className="font-medium mb-2">Short URL Created Successfully!</p>
							<div className="flex flex-col sm:flex-row items-center justify-center space-y-2 sm:space-y-0 sm:space-x-3">
								<Link
									href={shortUrlData.fullShortUrl}
									target="_blank"
									rel="noopener noreferrer"
									className="text-indigo-600 dark:text-indigo-400 hover:underline break-all font-mono text-sm"
									title={shortUrlData.fullShortUrl}
								>
									{shortUrlData.fullShortUrl}
								</Link>
								<button
									onClick={() => handleCopy(shortUrlData.fullShortUrl)}
									className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 text-sm transition duration-200"
									title="Copy to Clipboard"
								>
									Copy
								</button>
							</div>
						</div>
					)}

					{/* Submit Button */}
					<button
						type="submit"
						disabled={isLoading}
						className="w-full py-3 px-4 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
					>
						{isLoading ? "Creating..." : "Create Short URL"}
					</button>
				</form>
			</div>

			{/* Link Management Table Section */}
			<div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6">
				{/* Search/Filter Input */}
				<div className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-4 sm:space-y-0">
					<h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Your Short Links</h2>
					<div className="relative">
						<input
							type="text"
							placeholder="Search by short/original URL..."
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
							className="w-full sm:w-64 lg:w-80 pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
						/>
						<span className="absolute inset-y-0 left-0 flex items-center pl-3">
							<svg
								className="h-5 w-5 text-gray-400 dark:text-gray-300"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
								xmlns="http://www.w3.org/2000/svg"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth="2"
									d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
								></path>
							</svg>
						</span>
					</div>
				</div>

				{isFetchingLinks && <p className="text-center py-10 text-gray-500 dark:text-gray-400 animate-pulse">Loading your links...</p>}

				{!isFetchingLinks && filteredLinks.length === 0 && searchTerm === "" && <p className="text-center py-10 text-gray-500 dark:text-gray-400">No short links have been created yet.</p>}
				{!isFetchingLinks && filteredLinks.length === 0 && searchTerm !== "" && <p className="text-center py-10 text-gray-500 dark:text-gray-400">No links match your search criteria.</p>}

				{!isFetchingLinks && filteredLinks.length > 0 && (
					<div className="overflow-x-auto">
						<table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
							<thead className="bg-gray-50 dark:bg-gray-700">
								<tr>
									<th
										scope="col"
										className="px-4 py-3 text-nowrap text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
									>
										Short URL
									</th>
									<th
										scope="col"
										className="px-4 py-3 text-nowrap text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
									>
										Original URL
									</th>
									<th
										scope="col"
										className="px-4 py-3 text-nowrap text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
									>
										Clicks
									</th>
									<th
										scope="col"
										className="px-4 py-3 text-nowrap text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
									>
										Expires
									</th>
									<th
										scope="col"
										className="px-4 py-3 text-nowrap text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
									>
										Status
									</th>
									<th
										scope="col"
										className="px-4 py-3 text-nowrap text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
									>
										Actions
									</th>
								</tr>
							</thead>
							<tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
								{filteredLinks.map((link) => (
									<tr
										key={link.id}
										className={`${link.isExpired ? "opacity-60 italic bg-gray-50 dark:bg-gray-750" : ""} hover:bg-gray-50 dark:hover:bg-gray-750 transition duration-200`}
									>
										{/* Short URL Cell */}
										<td className="p-4 text-nowrap whitespace-nowrap text-sm font-mono">
											<Link
												href={link.fullShortUrl}
												target="_blank"
												rel="noopener noreferrer"
												className="text-indigo-600 dark:text-indigo-400 hover:underline break-all"
												title={`Visit ${link.fullShortUrl}`}
											>
												{link.shortCode}
											</Link>
										</td>
										{/* Original URL Cell */}
										<td className="p-4 text-nowrap text-sm break-all text-gray-700 dark:text-gray-300">
											<Link
												href={link.originalUrl}
												target="_blank"
												rel="noopener noreferrer"
												className="hover:underline"
												title={link.originalUrl}
											>
												{link.originalUrl.length > 50 ? link.originalUrl.substring(0, 50) + "..." : link.originalUrl}
											</Link>
										</td>
										{/* Clicks Cell */}
										<td className="p-4 text-nowrap whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">{link.clickCount}</td>
										{/* Expires Cell */}
										<td className="p-4 text-nowrap whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">{link.expiresAtFmt}</td>
										{/* Status Cell */}
										<td className="p-4 text-nowrap whitespace-nowrap">
											<span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${link.isExpired ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300" : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"}`}>{link.isExpired ? "Expired" : "Active"}</span>
										</td>
										{/* Actions Cell */}
										<td className="p-4 text-nowrap whitespace-nowrap text-sm">
											<div className="flex items-center space-x-3">
												<button
													onClick={() => handleCopy(link.fullShortUrl)}
													className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 disabled:text-gray-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-200"
													title="Copy Short URL"
													disabled={isDeleting !== null}
												>
													Copy
												</button>
												<button
													onClick={() => handleDelete(link.id)}
													className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 disabled:text-gray-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition duration-200"
													title="Delete Link"
													disabled={isDeleting === link.id}
												>
													{isDeleting === link.id ? "Deleting..." : "Delete"}
												</button>
											</div>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</div>
	);
}
