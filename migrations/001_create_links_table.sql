-- Create the links table
CREATE TABLE IF NOT EXISTS links (
    id VARCHAR(36) PRIMARY KEY, -- UUID
    shortCode VARCHAR(10) NOT NULL UNIQUE, -- Increased length slightly for safety, though 6 is often sufficient
    originalUrl TEXT NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expiresAt TIMESTAMP NULL,
    clickCount INT DEFAULT 0,
    lastClickedAt TIMESTAMP NULL
);

-- Add indexes for performance
CREATE INDEX idx_shortCode ON links (shortCode); -- Already unique, but explicit index can help some engines
CREATE INDEX idx_createdAt ON links (createdAt);
