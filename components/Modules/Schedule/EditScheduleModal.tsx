import React, { useState, useEffect } from 'react';
import { ScheduleItem } from '../../../types';
import { X, Calendar, Save } from 'lucide-react';
import { useCommandQueue } from '../../../contexts/CommandQueueContext';
import { QueueCommand } from '../../../types';
import { useAuth } from '../../../hooks/useAuth';

interface EditScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ScheduleItem | null;
  onSave: (updatedItem: ScheduleItem) => void;
}

export const EditScheduleModal: React.FC<EditScheduleModalProps> = ({ 
  isOpen, 
  onClose, 
  item, 
  onSave 
}) => {
  const [expectedDate, setExpectedDate] = useState('');
  const { addCommand } = useCommandQueue();
  const { user } = useAuth();

  useEffect(() => {
    if (item && isOpen) {
        // Convert DD/MM/YYYY or YYYY-MM-DD to YYYY-MM-DD for input[type="date"]
        // Assuming item.expectedArrivalDate is stored as YYYY-MM-DD or DD/MM/YYYY
        // Let's try to parse it.
        const rawDate = item.expectedArrivalDate;
        if (!rawDate) {
            setExpectedDate('');
            return;
        }

        // If it's already YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
            setExpectedDate(rawDate);
        } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(rawDate)) {
            // DD/MM/YYYY -> YYYY-MM-DD
            const parts = rawDate.split('/');
            setExpectedDate(`${parts[2]}-${parts[1]}-${parts[0]}`);
        } else {
            setExpectedDate('');
        }
    }
  }, [item, isOpen]);

  if (!isOpen || !item) return null;

  const handleSave = async () => {
      if (!user) return;

      let newId = item.id;
      let oldId = undefined;

      // Check if ID needs to be updated (LVT -> LVTS)
      if (item.id.startsWith('LVT-')) {
          newId = item.id.replace('LVT-', 'LVTS-');
          oldId = item.id;
      }

      const updatedItem: ScheduleItem & { oldId?: string } = {
          ...item,
          id: newId,
          expectedArrivalDate: expectedDate, 
          importer: user.username,
          updatedAt: new Date().toISOString(),
          oldId: oldId
      };

      // Create command to save to server
      const command: QueueCommand = {
          id: `CMD-UPD-${Date.now()}`,
          type: 'SAVE_SCHEDULE', 
          payload: [updatedItem], 
          timestamp: Date.now(),
          status: 'PENDING'
      };

      await addCommand(command);
      onSave(updatedItem);
      onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-gray-700 rounded-xl w-full max-w-md shadow-2xl transform transition-all scale-100">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-brand-purple" />
            Cập Nhật Ngày Dự Kiến
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-400">Mã Đơn Hàng / Vật Tư</label>
                <div className="p-3 bg-slate-800 rounded-lg text-gray-300 text-sm">
                    <div className="font-bold text-white mb-1">{item.purchaseOrder}</div>
                    <div>{item.materialName}</div>
                </div>
            </div>

            <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-400">Ngày Dự Kiến Về Mới</label>
                <input 
                    type="date" 
                    value={expectedDate}
                    onChange={(e) => setExpectedDate(e.target.value)}
                    className="w-full h-10 px-3 bg-slate-950 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-brand-purple focus:border-transparent outline-none transition-all"
                />
            </div>
        </div>

        <div className="p-4 border-t border-gray-800 flex justify-end gap-3 bg-slate-800/50 rounded-b-xl">
            <button 
                onClick={onClose}
                className="px-4 py-2 text-gray-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors text-sm font-medium"
            >
                Hủy bỏ
            </button>
            <button 
                onClick={handleSave}
                className="px-4 py-2 bg-brand-purple hover:bg-brand-purple/90 text-white rounded-lg shadow-lg shadow-brand-purple/20 flex items-center gap-2 transition-all text-sm font-medium active:scale-95"
            >
                <Save className="w-4 h-4" />
                Lưu Thay Đổi
            </button>
        </div>
      </div>
    </div>
  );
};
