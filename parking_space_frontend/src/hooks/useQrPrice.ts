import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { QR_STICKER_PRICE } from '@/lib/config';

/**
 * Current QR sticker price in rupees (pack of 2), as set by admin on the
 * QR Config page. Falls back to the default while loading or if the request
 * fails. The amount actually charged is always the one the backend snapshots
 * onto the order.
 */
export const useQrPrice = (): number => {
  const { data } = useQuery({
    queryKey: ['qr-pricing'],
    queryFn: async () => (await api.get<{ stickerPricePaise: number }>('/util/qr-pricing')).data,
    staleTime: 60_000,
  });
  return data ? data.stickerPricePaise / 100 : QR_STICKER_PRICE;
};
