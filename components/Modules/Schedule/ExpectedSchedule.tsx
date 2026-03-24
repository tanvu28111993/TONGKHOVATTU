import React, { useState } from 'react';
import { ExpectedScheduleTable } from './ExpectedScheduleTable';
import { ExpectedScheduleToolbar } from './ExpectedScheduleToolbar';
import { ImportScheduleModal } from './ImportScheduleModal';
import { EditScheduleModal } from './EditScheduleModal';
import { SCHEDULE_COLUMNS } from '../../../utils/scheduleColumnConfig';
import { ScheduleItem } from '../../../types';
import { useToast } from '../../../contexts/ToastContext';
import { useScheduleFilter } from '../../../hooks/useScheduleFilter';
import { useScheduleQuery } from '../../../hooks/useScheduleQuery';

export const ExpectedSchedule: React.FC = () => {
  const { schedule, isLoading, isFetching, refresh, updateLocalData } = useScheduleQuery();
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  
  // Edit Modal State
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const { addToast } = useToast();

  // Use the worker-based filter hook
  const {
    displayData,
    totalQuantity,
    isFiltering,
    filters,
    sortConfig,
    updateFilter,
    handleSort,
    exportAndDownloadCSV
  } = useScheduleFilter(schedule);

  const handleImport = (newItems: ScheduleItem[]) => {
      updateLocalData([...schedule, ...newItems]);
  };

  const handleExportCSV = () => {
      exportAndDownloadCSV(SCHEDULE_COLUMNS, "Lich_Du_Kien");
  };

  const handleRowDoubleClick = (item: ScheduleItem) => {
      setEditingItem(item);
      setIsEditModalOpen(true);
  };

  const handleUpdateItem = (updatedItem: ScheduleItem & { oldId?: string }) => {
      const newData = schedule.map(item => {
          // If ID changed (LVT -> LVTS), we match by oldId
          if (updatedItem.oldId && item.id === updatedItem.oldId) {
              return updatedItem;
          }
          // Normal update
          if (item.id === updatedItem.id) {
              return updatedItem;
          }
          return item;
      });
      updateLocalData(newData);
      addToast("Cập nhật thành công!", "success");
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-950">
      <div className="flex-1 overflow-hidden p-4 flex flex-col gap-4">
          <ExpectedScheduleToolbar 
            totalQuantity={totalQuantity}
            totalRows={displayData.length}
            isPending={isFiltering}
            isSyncing={isFetching || isLoading} 
            filterState={filters}
            onUpdateFilter={updateFilter}
            onRefresh={refresh}
            onExportCSV={handleExportCSV}
            onImportClick={() => setIsImportModalOpen(true)}
            columns={SCHEDULE_COLUMNS}
          />

          <ExpectedScheduleTable 
            data={displayData}
            columns={SCHEDULE_COLUMNS}
            isLoading={isLoading}
            isSyncing={isFiltering}
            sortConfig={sortConfig}
            onSort={handleSort}
            searchColumn={filters.searchColumn !== 'all' ? filters.searchColumn : undefined}
            onRowDoubleClick={handleRowDoubleClick}
          />
      </div>

      <ImportScheduleModal 
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={handleImport}
      />

      <EditScheduleModal 
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        item={editingItem}
        onSave={handleUpdateItem}
      />
    </div>
  );
};
