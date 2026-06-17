/**
 * @fileoverview Repository interface for managing link data.
 * This defines the contract for all storage implementations.
 */

import { Link, CreateLinkInput } from '@/types';

export interface LinkRepository {
  /** Retrieves all links. */
  findAll(): Promise<Link[]>;
  /** Finds a link by its short code. */
  findByShortCode(code: string): Promise<Link | null>;
  /** Finds a link by its unique ID. */
  findById(id: string): Promise<Link | null>;
  /** Creates a new link. */
  create(data: CreateLinkInput): Promise<Link>;
  /** Deletes a link by its ID. Returns true if deletion was successful, false otherwise. */
  delete(id: string): Promise<boolean>;
  /** Increments the click count for a given short code and updates the last clicked timestamp. Does nothing if the link is expired. */
  incrementClick(shortCode: string): Promise<void>;
  /** Checks if a short code already exists. */
  existsByShortCode(code: string): Promise<boolean>;
}
