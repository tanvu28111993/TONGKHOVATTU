import React, { useState, useEffect } from 'react';
import { ExpectedScheduleTable } from './ExpectedScheduleTable';
import { ExpectedScheduleToolbar, ScheduleFilterState } from './ExpectedScheduleToolbar';
import { ImportScheduleModal } from './ImportScheduleModal';
import { EditScheduleModal } from './EditScheduleModal';
import { SCHEDULE_COLUMNS } from '../../../utils/scheduleColumnConfig';
import { ScheduleItem } from '../../../types';
import { ScheduleService } from '../../../services/schedule';
import { useToast } from '../../../contexts/ToastContext';
import { useScheduleFilter } from '../../../hooks/useScheduleFilter';

export const ExpectedSchedule: React.FC = () => {
  const [data, setData] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
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
  } = useScheduleFilter(data);

  const fetchData = async () => {
      try {
          setLoading(true);
          const items = await ScheduleService.getSchedule();
          setData(items);
      } catch (error) {
          console.error("Failed to fetch schedule", error);
          addToast("Lỗi tải dữ liệu lịch dự kiến", "error");
      } finally {
          setLoading(false);
      }
  };

  useEffect(() => {
      fetchData();
  }, []);

  const handleImport = (newItems: ScheduleItem[]) => {
      setData(prev => [...prev, ...newItems]);
  };

  const handleExportCSV = () => {
      exportAndDownloadCSV(SCHEDULE_COLUMNS, "Lich_Du_Kien");
  };

  const handleRowDoubleClick = (item: ScheduleItem) => {
      setEditingItem(item);
      setIsEditModalOpen(true);
  };

  const handleUpdateItem = (updatedItem: ScheduleItem) => {
      setData(prev => prev.map(item => item.id === updatedItem.id ? updatedItem : item));
      addToast("Cập nhật thành công!", "success");
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-950">
      <div className="flex-1 overflow-hidden p-4 flex flex-col gap-4">
          <ExpectedScheduleToolbar 
            totalQuantity={totalQuantity}
            totalRows={displayData.length}
            isPending={isFiltering}
            isSyncing={loading} 
            filterState={filters}
            onUpdateFilter={updateFilter}
            onRefresh={fetchData}
            onExportCSV={handleExportCSV}
            onImportClick={() => setIsImportModalOpen(true)}
            columns={SCHEDULE_COLUMNS}
          />

          <ExpectedScheduleTable 
            data={displayData}
            columns={SCHEDULE_COLUMNS}
            isLoading={loading}
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
