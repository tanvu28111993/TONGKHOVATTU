import React, { useEffect, useRef } from 'react';
import { Loader2, RefreshCw, Search, Download, SlidersHorizontal, Upload } from 'lucide-react';
import { ScheduleItem } from '../../../types';
import { Card } from '../../UI/Card';
import { Input } from '../../UI/Input';
import { Select } from '../../UI/Select';
import { GLOBAL_EVENTS } from '../../../utils/constants';

// Define a local FilterState interface if not reusing the one from hooks
export interface ScheduleFilterState {
  searchTerm: string;
  searchColumn: string;
  showAdvancedFilters: boolean;
  // Add other filters if needed
}

interface ExpectedScheduleToolbarProps {
  totalQuantity: number;
  totalRows: number;
  isPending: boolean;
  isSyncing: boolean;
  
  filterState: ScheduleFilterState;
  onUpdateFilter: (key: keyof ScheduleFilterState, value: any) => void;
  
  onRefresh: () => void;
  onExportCSV: () => void;
  onImportClick: () => void;
  
  columns: { accessor: string; header: string }[];
}

export const ExpectedScheduleToolbar: React.FC<ExpectedScheduleToolbarProps> = ({
  totalQuantity,
  totalRows,
  isPending,
  isSyncing,
  filterState,
  onUpdateFilter,
  onRefresh,
  onExportCSV,
  onImportClick,
  columns
}) => {
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Listen for global shortcut Ctrl+F
  useEffect(() => {
    const handleFocus = () => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
    };
    window.addEventListener(GLOBAL_EVENTS.FOCUS_SEARCH, handleFocus);
    return () => window.removeEventListener(GLOBAL_EVENTS.FOCUS_SEARCH, handleFocus);
  }, []);
  
  // Transform columns for Select component
  const columnOptions = [
    { value: 'all', label: 'Tất cả thông tin' },
    ...columns.map(col => ({ value: col.accessor, label: col.header }))
  ];

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-col xl:flex-row gap-4 justify-between items-center w-full">
          {/* Stats Section */}
          <div className="flex items-center gap-2 mr-auto border-r border-gray-800 pr-4">
              <span className="text-sm font-medium text-gray-400">Tổng:</span>
              <span className="text-xl font-bold text-brand-purple">
                  {totalQuantity.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Tấn
              </span>
              <span className="text-xs text-gray-500 ml-2">({totalRows} Dòng)</span>
              {(isPending || isSyncing) && <Loader2 className="w-4 h-4 text-brand-purple animate-spin ml-2" />}
          </div>

          {/* Actions & Filters Section */}
          <div className="flex flex-col md:flex-row gap-3 w-full xl:w-auto items-center">

              <button onClick={onExportCSV} className="h-10 px-3 flex items-center gap-2 bg-blue-600/80 hover:bg-blue-700 border border-blue-500/50 text-white rounded-lg transition-all hover:shadow-lg active:scale-95 whitespace-nowrap">
                  <Download className="w-4 h-4" /><span className="hidden md:inline">CSV</span>
              </button>
              
              <button 
                onClick={onImportClick}
                className="h-10 px-3 flex items-center gap-2 bg-brand-purple hover:bg-brand-purple/90 text-white font-medium rounded-lg transition-colors shadow-lg shadow-brand-purple/20 whitespace-nowrap"
              >
                  <Upload className="w-4 h-4" /><span className="hidden md:inline">Tạo lịch</span>
              </button>
              
              <Input 
                ref={searchInputRef}
                icon={Search}
                placeholder="Tìm kiếm... (Ctrl+F)"
                value={filterState.searchTerm}
                onChange={(e) => onUpdateFilter('searchTerm', e.target.value)}
                containerClassName="w-full md:w-[250px]"
              />
              
              <Select 
                options={columnOptions}
                value={filterState.searchColumn}
                onChange={(e) => onUpdateFilter('searchColumn', e.target.value)}
                containerClassName="w-full md:w-[180px]"
              />
              
              <button 
                onClick={onRefresh} 
                className="h-10 px-4 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 border border-blue-500 text-white rounded-lg transition-all hover:shadow-lg active:scale-95 whitespace-nowrap" 
                disabled={isSyncing}
                title="Làm mới dữ liệu"
              >
                  <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} /><span className="hidden md:inline">Làm Mới</span>
              </button>
          </div>
      </div>
    </Card>
  );
};
