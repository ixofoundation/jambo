import { useNames as useSharedNames, type UseNamesResult } from '@ixo/names-client/react';

import { PROFILE_INCLUDE, getNamesClient, type IncludeGroup } from 'lib/names';

/**
 * The `@ixo/names-client/react` hook over jambo's client, with one field set
 * per surface: lists and avatars by default.
 */
export function useNames(
  ids: readonly (string | null | undefined)[],
  include: readonly IncludeGroup[] = PROFILE_INCLUDE,
): UseNamesResult {
  return useSharedNames(getNamesClient(), ids, { include });
}
