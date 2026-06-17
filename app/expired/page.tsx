/**
 * @fileoverview Custom 410 Gone page for expired short links.
 * Displayed when a user tries to access a short link that has expired.
 */

import Link from 'next/link';

export default async function ExpiredPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; expiredAt?: string }>;
}) {
  const params = await searchParams;
  const shortCode = params.code || 'unknown';
  const expiredAt = params.expiredAt 
    ? new Date(params.expiredAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* Hourglass/Clock Icon */}
        <div className="mb-6 flex justify-center">
          <svg
            className="w-24 h-24 text-amber-500 dark:text-amber-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        {/* Error Message */}
        <h1 className="text-6xl font-bold text-gray-900 dark:text-white mb-4">
          410
        </h1>
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
          Link Expired
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-2">
          This short link has expired and is no longer available.
        </p>

        {/* Short Code Display */}
        {shortCode !== 'unknown' && (
          <div className="mb-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-md border border-gray-300 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">Short Code:</p>
            <p className="font-mono text-lg text-gray-800 dark:text-gray-200">{shortCode}</p>
          </div>
        )}

        {/* Expiration Date Display */}
        {expiredAt && (
          <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">
            Expired on: {expiredAt}
          </p>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
          <Link
            href="/"
            className="inline-flex items-center justify-center px-6 py-3 bg-indigo-600 text-white font-medium rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-200"
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Create New Link
          </Link>
        </div>

        {/* Additional Help Text */}
        <p className="mt-8 text-sm text-gray-500 dark:text-gray-500">
          Links can be set to expire after a certain number of days. Create a new link to get started.
        </p>
      </div>
    </div>
  );
}
