import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

/**
 * Cities that actually have bookable spaces, pulled live from the API so the
 * customer city filter always matches real stored values (never a hardcoded
 * list that silently filters to nothing).
 */
export const useCities = (): string[] => {
  const { data } = useQuery({
    queryKey: ['location-cities'],
    queryFn: async () => (await api.get<{ cities: string[] }>('/locations/cities')).data.cities,
    staleTime: 5 * 60_000,
  });
  return data ?? [];
};
