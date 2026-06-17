/**
 * @fileoverview Factory function to get the appropriate repository instance.
 * Reads the STORAGE_DRIVER environment variable to determine which repository to instantiate.
 * Uses a singleton pattern to ensure only one instance of a repository is created per driver type.
 */

import { LinkRepository } from './types';
import { JsonFileRepository } from './json-repository';
import { MySqlRepository } from './mysql-repository';

let jsonRepoInstance: LinkRepository | null = null;
let mysqlRepoInstance: LinkRepository | null = null;

/**
 * Returns a singleton instance of the appropriate LinkRepository based on the environment.
 * Reads the STORAGE_DRIVER environment variable. Defaults to 'json'.
 * @returns {LinkRepository} An instance of the configured repository.
 */
export function getRepository(): LinkRepository {
  const driver = process.env.STORAGE_DRIVER || 'json';

  switch (driver) {
    case 'mysql':
      if (!mysqlRepoInstance) {
        mysqlRepoInstance = new MySqlRepository();
        console.log('Initialized MySQL repository.');
      }
      return mysqlRepoInstance;
    case 'json':
    default:
      if (!jsonRepoInstance) {
        jsonRepoInstance = new JsonFileRepository();
        console.log('Initialized JSON file repository.');
      }
      return jsonRepoInstance;
  }
}
