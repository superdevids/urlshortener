/**
 * @fileoverview Provides the LinkRepository interface and associated types.
 */

export interface Link {
  id: string;
  shortCode: string;
  originalUrl: string;
  createdAt: string; // ISO string format
  expiresAt: string | null; // ISO string format or null
  clickCount: number;
  lastClickedAt: string | null; // ISO string format or null
}

/**
 * Input type for creating a new link.
 * 'customAlias' is optional and must be unique if provided.
 * 'expiresInDays' is optional.
 */
export interface CreateLinkInput {
  originalUrl: string;
  customAlias?: string;
  expiresInDays?: number;
}
