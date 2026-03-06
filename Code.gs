/**
 * KHO GIẤY - BACKEND API (Google Apps Script)
 * 
 * Hướng dẫn cài đặt:
 * 1. Copy toàn bộ nội dung file này vào dự án Apps Script của bạn.
 * 2. Đảm bảo file Google Sheet có các Sheet sau (hoặc đổi tên trong CONFIG):
 *    - DM_LOAI_NHAP
 *    - DM_LOAI_VT
 *    - DM_KIEN_GIAY
 *    - DM_LOAI_GIAY
 *    - DM_NCC
 *    - DM_NSX
 *    - DATA_NHAP_KHO (Dữ liệu nhập kho)
 * 3. Deploy lại Web App với quyền "Anyone" (Ai cũng có thể truy cập).
 */

// --- CẤU HÌNH ---
const CONFIG = {
  SHEET_NAMES: {
    loaiNhap: 'DM_LOAI_NHAP',
    loaiVt: 'DM_LOAI_VT',
    kienGiay: 'DM_KIEN_GIAY',
    loaiGiay: 'DM_LOAI_GIAY',
    ncc: 'DM_NCC',
    nsx: 'DM_NSX',
    inventory: 'DATA_NHAP_KHO'
  },
  // Mapping cột cho từng danh mục (để đảm bảo thứ tự đúng)
  // Index 0: Value, Index 1: Code, Index 2: Extra
  CATEGORY_COLUMNS: {
    loaiNhap: [0, 1],       // Col A, B
    loaiVt: [0, 1],         // Col A, B
    kienGiay: [0, 1],       // Col A, B
    loaiGiay: [0, 1],       // Col A, B
    ncc: [0, 1, 2],         // Col A, B, C
    nsx: [0]                // Col A
  }
};

// --- API HANDLERS ---

function doGet(e) {
  const params = e.parameter;
  const action = params.action;

  if (action === 'getMetaData') {
    return handleGetMetaData();
  } else if (action === 'getInventory') {
    return handleGetInventory(params.lastUpdated);
  }

  return responseJSON({ error: 'Invalid Action (GET)' });
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    if (action === 'batch') {
      return handleBatch(data.commands);
    }

    return responseJSON({ error: 'Invalid Action (POST)' });
  } catch (err) {
    return responseJSON({ error: 'Server Error: ' + err.toString() });
  }
}

// --- LOGIC XỬ LÝ ---

function handleGetMetaData() {
  const result = {};
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  Object.keys(CONFIG.SHEET_NAMES).forEach(key => {
    if (key === 'inventory') return; // Skip inventory sheet
    
    const sheetName = CONFIG.SHEET_NAMES[key];
    const sheet = ss.getSheetByName(sheetName);
    if (sheet) {
      // Lấy dữ liệu từ dòng 2 (bỏ header)
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        const values = sheet.getRange(2, 1, lastRow - 1, 3).getValues(); // Lấy max 3 cột
        // Filter bỏ dòng trống
        result[key] = values.filter(row => row[0] !== '');
      } else {
        result[key] = [];
      }
    } else {
      result[key] = [];
    }
  });

  return responseJSON({ success: true, data: result });
}

function handleGetInventory(lastUpdated) {
  // Logic lấy dữ liệu tồn kho (giả lập hoặc thực tế tùy cấu trúc sheet của bạn)
  // Ở đây trả về rỗng để tập trung vào phần MetaData theo yêu cầu
  return responseJSON({ success: true, data: [], serverTimestamp: Date.now() });
}

function handleBatch(commands) {
  const results = [];
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const lock = LockService.getScriptLock();

  // Wait for up to 30 seconds for other processes to finish.
  if (lock.tryLock(30000)) {
    try {
      commands.forEach(cmd => {
        let res = { id: cmd.id, success: true };
        try {
          if (cmd.type === 'METADATA_BATCH') {
            handleMetadataBatch(ss, cmd.payload);
          } else {
            // Handle other command types if needed
          }
        } catch (e) {
          res.success = false;
          res.message = e.toString();
        }
        results.push(res);
      });
    } catch (e) {
      return responseJSON({ success: false, message: "Batch Error: " + e.toString() });
    } finally {
      lock.releaseLock();
    }
  } else {
    return responseJSON({ success: false, message: "Server Busy" });
  }

  return responseJSON({ success: true, results: results });
}

function handleMetadataBatch(ss, operations) {
  operations.forEach(op => {
    const category = op.category;
    const sheetName = CONFIG.SHEET_NAMES[category];
    if (!sheetName) throw new Error("Unknown category: " + category);

    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      // Nếu chưa có sheet thì tạo mới và thêm header
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(['Value', 'Code', 'Extra']); // Header mặc định
    }

    if (op.operation === 'ADD') {
      // Chuẩn bị dòng dữ liệu: Value, Code, Extra
      const rowData = [op.value, op.code || '', op.extra || ''];
      sheet.appendRow(rowData);
    } else if (op.operation === 'UPDATE') {
      const data = sheet.getDataRange().getValues();
      const oldValue = op.oldValue;
      
      // Tìm dòng cần sửa (bỏ qua header - index 0)
      // Giả sử cột 0 (Value) là khóa chính để tìm kiếm
      let found = false;
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(oldValue)) {
          // Cập nhật dữ liệu
          // Set Value (Col 1)
          sheet.getRange(i + 1, 1).setValue(op.value);
          // Set Code (Col 2)
          if (op.code !== undefined) sheet.getRange(i + 1, 2).setValue(op.code);
          // Set Extra (Col 3)
          if (op.extra !== undefined) sheet.getRange(i + 1, 3).setValue(op.extra);
          
          found = true;
          break;
        }
      }
      
      if (!found) {
        // Nếu không tìm thấy dòng cũ để sửa, coi như là ADD mới (fallback)
        const rowData = [op.value, op.code || '', op.extra || ''];
        sheet.appendRow(rowData);
      }
    }
  });
}

// --- UTILS ---

function responseJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
