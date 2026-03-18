import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { ScheduleItem } from '../../../types';
import { useCommandQueue } from '../../../contexts/CommandQueueContext';
import { QueueCommand } from '../../../types';
import { X, Upload, Check, AlertCircle, Search } from 'lucide-react';
import { useMetaDataQuery } from '../../../hooks/useMetaDataQuery';
import { useAuth } from '../../../hooks/useAuth';
import { Input } from '../../UI/Input';
import { Select } from '../../UI/Select';

interface ImportScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (items: ScheduleItem[]) => void;
}

interface CSVRow {
  [key: string]: string;
}

export const ImportScheduleModal: React.FC<ImportScheduleModalProps> = ({ isOpen, onClose, onImport }) => {
  const [parsedData, setParsedData] = useState<ScheduleItem[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  
  // Selection State
  const [materialType, setMaterialType] = useState<string>('');
  const [packetType, setPacketType] = useState<string>('');
  const [paperType, setPaperType] = useState<string>('');
  const [manufacturer, setManufacturer] = useState<string>('');
  
  // Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [searchColumn, setSearchColumn] = useState('all');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addCommand } = useCommandQueue();
  const { data: metaData } = useMetaDataQuery();
  const { user } = useAuth();

  useEffect(() => {
    if (isOpen) {
      setParsedData([]);
      setSelectedIndices(new Set());
      setError(null);
      setMaterialType('');
      setPacketType('');
      setPaperType('');
      setManufacturer('');
      setSearchTerm('');
      setSearchColumn('all');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // Convert to array of arrays
      const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: '' });
      
      const dataRows = rows.filter(row => {
         // Simple heuristic: Date column (index 0) should look like a date or be non-empty and not header keywords
         const firstCol = String(row[0] || '');
         if (!firstCol) return false;
         if (firstCol.includes('Ngày') || firstCol === '1') return false;
         return true;
      });

      const mappedItems: ScheduleItem[] = dataRows.map((row, index) => {
         const parseNumber = (val: any) => {
             if (!val) return 0;
             let cleanVal = String(val).replace(/\s/g, '');
             cleanVal = cleanVal.replace(',', '.');
             return parseFloat(cleanVal) || 0;
         };

         const formatDate = (dateVal: any) => {
             if (!dateVal) return '';
             
             // Check if it's an Excel serial date number
             if (typeof dateVal === 'number') {
                 // Excel dates are number of days since Jan 1, 1900
                 // Note: Excel incorrectly thinks 1900 is a leap year, so we subtract 1 day
                 const date = new Date(Math.round((dateVal - 25569) * 86400 * 1000));
                 const d = String(date.getDate()).padStart(2, '0');
                 const m = String(date.getMonth() + 1).padStart(2, '0');
                 const y = date.getFullYear();
                 return `${y}-${m}-${d}`;
             }
             
             const dateStr = String(dateVal);
             const parts = dateStr.split(/[\/\-]/); // Handle / or -
             if (parts.length === 3) {
                 // Assume DD/MM/YYYY
                 return `${parts[2]}-${parts[1]}-${parts[0]}`;
             }
             return dateStr;
         };

         return {
             id: `LVT-${Date.now()}-${index}`,
             purchaseDate: formatDate(row[0]),
             purchaseOrder: String(row[2] || ''),
             supplierCode: String(row[3] || ''),
             supplierName: String(row[4] || ''),
             materialCode: String(row[6] || ''),
             materialName: String(row[7] || ''),
             orderCustomer: String(row[19] || ''), // Col 19 -> Index 18
             gsm: parseNumber(row[11]), // Col 11 -> Index 10
             rollWidth: parseNumber(row[9]), // Col 9 -> Index 8
             length: parseNumber(row[12]), // Col 12 -> Index 11
             width: parseNumber(row[13]), // Col 13 -> Index 12
             quantity: parseNumber(row[14]), // Col 14 -> Index 13
             unit: String(row[8] || ''), // Col 8 -> Index 7
             expectedArrivalDate: formatDate(row[17]), // Col 17 -> Index 16
             materialType: 'Giấy' // Default, will be overridden by selection
         };
      });

      setParsedData(mappedItems);
      // Auto select all
      setSelectedIndices(new Set(mappedItems.map((_, i) => i)));
    } catch (e) {
      console.error(e);
      setError("Lỗi khi đọc file Excel. Vui lòng kiểm tra định dạng.");
    }
  };

  const toggleSelect = (index: number) => {
    const newSet = new Set(selectedIndices);
    if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      newSet.add(index);
    }
    setSelectedIndices(newSet);
  };

  const displayData = parsedData.map((item, index) => ({ item, index })).filter(({ item }) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    if (searchColumn === 'all') {
      return Object.values(item).some(val => String(val).toLowerCase().includes(term));
    }
    return String(item[searchColumn as keyof ScheduleItem] || '').toLowerCase().includes(term);
  });

  const toggleSelectAll = () => {
    const visibleIndices = displayData.map(d => d.index);
    const allVisibleSelected = visibleIndices.length > 0 && visibleIndices.every(idx => selectedIndices.has(idx));
    
    const newSet = new Set(selectedIndices);
    if (allVisibleSelected) {
      // Deselect all visible
      visibleIndices.forEach(idx => newSet.delete(idx));
    } else {
      // Select all visible
      visibleIndices.forEach(idx => newSet.add(idx));
    }
    setSelectedIndices(newSet);
  };

  const handleConfirm = async () => {
    try {
        const selectedItems = parsedData
            .filter((_, i) => selectedIndices.has(i))
            .map(item => ({
                ...item,
                materialType: materialType,
                packetType: packetType,
                paperType: paperType,
                manufacturer: manufacturer,
                importer: user?.username || 'Unknown',
                updatedAt: new Date().toISOString()
            }));

        if (selectedItems.length === 0) return;
        
        const command: QueueCommand = {
            id: `CMD-${Date.now()}`,
            type: 'SAVE_SCHEDULE',
            payload: selectedItems,
            timestamp: Date.now(),
            status: 'PENDING'
        };
        
        await addCommand(command);
        
        onImport(selectedItems);
        onClose();
    } catch (err) {
        setError("Lỗi khi lưu dữ liệu: " + (err as Error).message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-gray-700 rounded-xl w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Upload className="w-5 h-5 text-brand-purple" />
            Nhập Lịch Dự Kiến Từ Excel
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col p-4 gap-4">
          
          {/* Controls Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 p-4 bg-slate-800/50 rounded-lg border border-gray-700">
              {/* File Input */}
              <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-gray-400 uppercase">File Excel</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="file" 
                      accept=".xls,.xlsx" 
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      className="hidden" 
                    />
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full h-9 px-3 bg-slate-700 hover:bg-slate-600 border border-gray-600 rounded text-white text-sm flex items-center justify-center gap-2 transition-all active:scale-95 whitespace-nowrap"
                    >
                      <Upload className="w-3 h-3" />
                      {parsedData.length > 0 ? 'Chọn lại' : 'Chọn File'}
                    </button>
                  </div>
              </div>

              {/* Material Type */}
              <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-gray-400 uppercase">Loại vật tư</label>
                  <select 
                    value={materialType}
                    onChange={(e) => setMaterialType(e.target.value)}
                    className="h-9 px-2 bg-slate-900 border border-gray-700 rounded text-white text-sm focus:ring-1 focus:ring-brand-purple outline-none"
                  >
                      <option value="">-- Chọn --</option>
                      {metaData?.loaiVt?.map((item, idx) => (
                          <option key={idx} value={item[0]}>{item[0]}</option>
                      ))}
                  </select>
              </div>

              {/* Packet Type */}
              <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-gray-400 uppercase">Loại Kiện</label>
                  <select 
                    value={packetType}
                    onChange={(e) => setPacketType(e.target.value)}
                    className="h-9 px-2 bg-slate-900 border border-gray-700 rounded text-white text-sm focus:ring-1 focus:ring-brand-purple outline-none"
                  >
                      <option value="">-- Chọn --</option>
                      {metaData?.kienGiay?.map((item, idx) => (
                          <option key={idx} value={item[0]}>{item[0]}</option>
                      ))}
                  </select>
              </div>

              {/* Paper Type */}
              <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-gray-400 uppercase">Loại Giấy</label>
                  <select 
                    value={paperType}
                    onChange={(e) => setPaperType(e.target.value)}
                    className="h-9 px-2 bg-slate-900 border border-gray-700 rounded text-white text-sm focus:ring-1 focus:ring-brand-purple outline-none"
                  >
                      <option value="">-- Chọn --</option>
                      {metaData?.loaiGiay?.map((item, idx) => (
                          <option key={idx} value={item[0]}>{item[0]}</option>
                      ))}
                  </select>
              </div>

              {/* Manufacturer */}
              <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-gray-400 uppercase">Nhà sản xuất</label>
                  <select 
                    value={manufacturer}
                    onChange={(e) => setManufacturer(e.target.value)}
                    className="h-9 px-2 bg-slate-900 border border-gray-700 rounded text-white text-sm focus:ring-1 focus:ring-brand-purple outline-none"
                  >
                      <option value="">-- Chọn --</option>
                      {metaData?.nsx?.map((item, idx) => (
                          <option key={idx} value={item[0]}>{item[0]}</option>
                      ))}
                  </select>
              </div>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {/* Preview Table */}
          {parsedData.length > 0 && (
            <div className="flex flex-col gap-3 flex-1 overflow-hidden">
              <div className="flex items-center gap-3 justify-end">
                <Input 
                  icon={Search}
                  placeholder="Tìm kiếm..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  containerClassName="w-full md:w-[300px]"
                />
                <Select 
                  options={[
                    { value: 'all', label: 'Tất cả thông tin' },
                    { value: 'purchaseOrder', label: 'Đơn hàng' },
                    { value: 'supplierName', label: 'Nhà cung cấp' },
                    { value: 'materialCode', label: 'Mã vật tư' },
                    { value: 'materialName', label: 'Tên vật tư' },
                  ]}
                  value={searchColumn}
                  onChange={(e) => setSearchColumn(e.target.value)}
                  containerClassName="w-full md:w-[200px]"
                />
              </div>
              <div className="flex-1 overflow-auto border border-gray-800 rounded-lg bg-slate-950/50">
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="bg-slate-900 sticky top-0 z-10 text-gray-300 uppercase text-xs font-bold">
                    <tr>
                      <th className="p-3 border-b border-gray-800 w-10 text-center">
                        <input 
                          type="checkbox" 
                          checked={displayData.length > 0 && displayData.every(d => selectedIndices.has(d.index))}
                          onChange={toggleSelectAll}
                          className="rounded border-gray-600 bg-slate-800 text-brand-purple focus:ring-brand-purple"
                        />
                      </th>
                      <th className="p-3 border-b border-gray-800">Ngày mua</th>
                      <th className="p-3 border-b border-gray-800">Đơn hàng</th>
                      <th className="p-3 border-b border-gray-800">NCC</th>
                      <th className="p-3 border-b border-gray-800">Mã vật tư</th>
                      <th className="p-3 border-b border-gray-800">Tên vật tư</th>
                      <th className="p-3 border-b border-gray-800 text-right">Định lượng</th>
                      <th className="p-3 border-b border-gray-800 text-right">Khổ</th>
                      <th className="p-3 border-b border-gray-800 text-right">Dài</th>
                      <th className="p-3 border-b border-gray-800 text-right">SL</th>
                      <th className="p-3 border-b border-gray-800">Ngày về</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {displayData.map(({ item, index }) => (
                      <tr key={index} className={`hover:bg-slate-800/50 transition-colors ${selectedIndices.has(index) ? 'bg-brand-purple/10' : ''}`}>
                        <td className="p-3 text-center">
                          <input 
                            type="checkbox" 
                            checked={selectedIndices.has(index)}
                            onChange={() => toggleSelect(index)}
                            className="rounded border-gray-600 bg-slate-800 text-brand-purple focus:ring-brand-purple"
                          />
                        </td>
                        <td className="p-3 text-gray-300">{item.purchaseDate}</td>
                        <td className="p-3 text-gray-300">{item.purchaseOrder}</td>
                        <td className="p-3 text-gray-300">{item.supplierName}</td>
                        <td className="p-3 text-gray-300">{item.materialCode}</td>
                        <td className="p-3 text-gray-300">{item.materialName}</td>
                        <td className="p-3 text-right text-gray-300">{item.gsm}</td>
                        <td className="p-3 text-right text-gray-300">{item.rollWidth}</td>
                        <td className="p-3 text-right text-gray-300">{item.length}</td>
                        <td className="p-3 text-right text-gray-300">{item.quantity}</td>
                        <td className="p-3 text-gray-300">{item.expectedArrivalDate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800 flex justify-end gap-3 bg-slate-900 rounded-b-xl">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-gray-300 hover:text-white hover:bg-slate-800 rounded-lg transition-all active:scale-95"
          >
            Hủy bỏ
          </button>
          <button 
            onClick={handleConfirm}
            disabled={selectedIndices.size === 0}
            className="px-6 py-2 bg-brand-purple hover:bg-brand-purple/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg shadow-lg shadow-brand-purple/20 flex items-center gap-2 transition-all active:scale-95"
          >
            <Check className="w-4 h-4" />
            Nhập {selectedIndices.size} dòng
          </button>
        </div>
      </div>
    </div>
  );
};
