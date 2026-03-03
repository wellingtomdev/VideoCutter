import { filesApi } from './filesApi';
import { cutApi } from './cutApi';
import { jobsApi } from './jobsApi';
import { suggestionsApi } from './suggestionsApi';

export const api = {
  ...filesApi,
  ...cutApi,
  ...jobsApi,
  ...suggestionsApi,
};
