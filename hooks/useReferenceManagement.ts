import React, { useState, useMemo } from 'react';
import { useMetaDataQuery } from './useMetaDataQuery';
import { useToast } from '../contexts/ToastContext';
import { useQueryClient } from '@tanstack/react-query';
import { CATEGORIES, CategoryKey } from '../utils/referenceConfig';
import { useCommandQueue } from '../contexts/CommandQueueContext';
import { QueueCommand } from '../types';

export const useReferenceManagement = () => {
    const { data: metaData, isLoading } = useMetaDataQuery();
    const [selectedCategory, setSelectedCategory] = useState<CategoryKey>('loaiNhap');
    const [searchTerm, setSearchTerm] = useState('');
    
    // Form States
    const [newValue, setNewValue] = useState(''); // Maps to Field 1 (value) / Row[0]
    const [newCode, setNewCode] = useState('');   // Maps to Field 2 (code)  / Row[1]
    const [newExtra, setNewExtra] = useState(''); // Maps to Field 3 (extra) / Row[2]
    
    // Edit Mode State
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState(''); // Stores the original 'value' (Col 1) to identify row for update
    
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { addToast } = useToast();
    const queryClient = useQueryClient();
    const { addCommand, queue } = useCommandQueue();

    const currentConfig = CATEGORIES.find(c => c.key === selectedCategory)!;
    const currentData = metaData ? metaData[selectedCategory] : [];

    // Filter Data Logic
    const filteredData = useMemo(() => {
        let data = currentData ? [...currentData] : [];
        
        // Apply pending commands from Global Queue (Optimistic UI)
        queue.forEach(cmd => {
            if (cmd.type === 'METADATA_BATCH' && Array.isArray(cmd.payload)) {
                cmd.payload.forEach((op: any) => {
                    if (op.category !== selectedCategory) return;
                    
                    if (op.operation === 'ADD') {
                        data.push([op.value, op.code, op.extra]);
                    } else if (op.operation === 'UPDATE') {
                        const idx = data.findIndex(row => row[0] === op.oldValue);
                        if (idx !== -1) {
                            data[idx] = [op.value, op.code, op.extra];
                        }
                    }
                });
            }
        });

        const term = searchTerm.toLowerCase();
        return data.filter(row => {
            const val = String(row[0] || '').toLowerCase();
            const code = String(row[1] || '').toLowerCase();
            const extra = String(row[2] || '').toLowerCase();
            return val.includes(term) || code.includes(term) || extra.includes(term);
        });
    }, [currentData, searchTerm, queue, selectedCategory]);

    const handleResetForm = () => {
        setNewValue('');
        setNewCode('');
        setNewExtra('');
        setIsEditing(false);
        setEditingId('');
    };

    const handleEdit = (row: string[]) => {
        setNewValue(row[0] || '');
        setNewCode(row[1] || '');
        setNewExtra(row[2] || '');
        setEditingId(row[0]); 
        setIsEditing(true);
    };

    // Hàm xử lý thay đổi input với logic In Hoa (Trừ NCC)
    const handleInputChange = (setter: React.Dispatch<React.SetStateAction<string>>, value: string, isStrictCode: boolean = false) => {
        if (selectedCategory === 'ncc') {
            setter(value); // NCC cho phép viết thường
        } else {
            let finalValue = value.toUpperCase();
            
            // Nếu là trường Mã quy định nghiêm ngặt (chỉ tiếng Anh + ký tự đặc biệt ASCII)
            // Áp dụng cho: Mã Viết Tắt, Mã Kiện, Mã Loại
            if (isStrictCode) {
                 finalValue = finalValue.replace(/[^\x00-\x7F]/g, "");
            }

            setter(finalValue); 
        }
    };

    const validateDuplicate = () => {
        if (!currentData) return null;

        // Helper để check trùng trong mảng dữ liệu
        const checkColumn = (colIndex: number, valueToCheck: string, fieldName: string) => {
            if (!valueToCheck) return null;
            const normalizedValue = valueToCheck.trim().toLowerCase();
            
            const isDuplicate = currentData.some(row => {
                // Nếu đang edit, bỏ qua dòng có Col 0 == editingId
                if (isEditing && row[0] === editingId) return false;

                const rowValue = String(row[colIndex] || '').trim().toLowerCase();
                return rowValue === normalizedValue;
            });

            return isDuplicate ? `Dữ liệu "${valueToCheck}" tại trường ${fieldName} đã tồn tại!` : null;
        };

        const hasField = (key: string) => currentConfig.fields.some(f => f.key === key);

        // Check Value (Col 0)
        if (hasField('value')) {
            const err = checkColumn(0, newValue, currentConfig.fields.find(f => f.key === 'value')?.label || 'Cột 1');
            if (err) return err;
        }
        // Check Code (Col 1)
        if (hasField('code')) {
            const err = checkColumn(1, newCode, currentConfig.fields.find(f => f.key === 'code')?.label || 'Cột 2');
            if (err) return err;
        }
        // Check Extra (Col 2)
        if (hasField('extra')) {
            const err = checkColumn(2, newExtra, currentConfig.fields.find(f => f.key === 'extra')?.label || 'Cột 3');
            if (err) return err;
        }

        return null;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!isEditing && !newValue.trim()) {
            addToast('Vui lòng nhập thông tin', 'warning');
            return;
        }

        // Validate trùng lặp
        const duplicateError = validateDuplicate();
        if (duplicateError) {
            addToast(duplicateError, 'error');
            return;
        }

        setIsSubmitting(true);
        try {
            // Construct payload for METADATA_BATCH
            // Even for single item, we use batch structure for consistency if we want
            // But CommandQueue handles 'METADATA_BATCH' type.
            // We can wrap single operation in an array.
            
            const operation = {
                category: selectedCategory,
                operation: isEditing ? 'UPDATE' : 'ADD',
                value: newValue,
                code: newCode,
                extra: newExtra,
                oldValue: isEditing ? editingId : undefined
            };

            const command: QueueCommand = {
                id: `META-${Date.now()}`,
                type: 'METADATA_BATCH',
                payload: [operation], // Wrap in array
                timestamp: Date.now(),
                status: 'PENDING'
            };

            await addCommand(command);
            
            addToast(isEditing ? 'Đã thêm lệnh cập nhật vào hàng đợi' : 'Đã thêm lệnh thêm mới vào hàng đợi', 'success');
            handleResetForm();
            
            // Optimistic update or invalidate queries?
            // Since it's async queue, invalidating immediately might not show changes yet.
            // But we rely on the background sync to eventually update and then we can re-fetch.
            // For now, just reset form.
            
        } catch (error) {
            addToast('Lỗi thao tác: ' + (error as Error).message, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return {
        // Data & State
        selectedCategory, setSelectedCategory,
        searchTerm, setSearchTerm,
        newValue, setNewValue,
        newCode, setNewCode,
        newExtra, setNewExtra,
        isEditing,
        isSubmitting,
        isLoading,
        currentConfig,
        filteredData,

        // Actions
        handleResetForm,
        handleEdit,
        handleInputChange,
        handleSubmit
    };
};