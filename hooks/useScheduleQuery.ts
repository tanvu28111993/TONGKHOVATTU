
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ScheduleService } from '../services/schedule';
import { ScheduleItem } from '../types';
import { useToast } from '../contexts/ToastContext';
import { useCallback } from 'react';
import { QUERY_KEYS } from '../utils/constants';

export const useScheduleQuery = () => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  const query = useQuery<ScheduleItem[]>({
    queryKey: QUERY_KEYS.SCHEDULE,
    queryFn: () => ScheduleService.getSchedule(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const refresh = useCallback(async () => {
      const res = await query.refetch();
      if (res.isSuccess) {
          addToast("Cập nhật lịch dự kiến thành công", "success");
      } else if (res.isError) {
          addToast("Lỗi tải lịch dự kiến", "error");
      }
  }, [query, addToast]);

  const updateLocalData = useCallback((newData: ScheduleItem[]) => {
      queryClient.setQueryData(QUERY_KEYS.SCHEDULE, newData);
  }, [queryClient]);

  return {
    schedule: query.data || [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refresh,
    updateLocalData
  };
};
