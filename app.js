// Cấu hình PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// Biến lưu trữ
let bookletFiles = {
    cover: null,
    content1: null,
    content2: null,
    back: null
};

let bookletMode = 'separate'; // 'separate' hoặc 'single'
let singleBookletFile = null;
let draggedElement = null;
let pageOrder = ['cover', 'back', 'content1', 'content2']; // Thứ tự mặc định
let mergeFiles = [];
let mergeFileOrder = [];

// Xử lý tabs
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
    });
});

// ===== GỘP PDF =====
document.getElementById('mergeFiles').addEventListener('change', (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    // Thêm file mới vào danh sách thay vì thay thế
    const newFiles = Array.from(files);
    newFiles.forEach(file => {
        // Kiểm tra xem file đã tồn tại chưa (dựa vào tên và kích thước)
        const exists = mergeFiles.some(f => f.name === file.name && f.size === file.size);
        if (!exists) {
            mergeFiles.push(file);
        }
    });
    
    // Cập nhật lại thứ tự
    mergeFileOrder = mergeFiles.map((_, index) => index);
    
    // Hiển thị danh sách file
    updateMergeFileList();
    
    // Reset input để có thể chọn lại cùng file
    e.target.value = '';
    
    // Ẩn preview khi chọn file mới
    document.getElementById('mergePreview').style.display = 'none';
});

function updateMergeFileList() {
    const fileList = document.getElementById('mergeFileList');
    fileList.innerHTML = '';
    
    if (mergeFiles.length === 0) {
        fileList.innerHTML = '<p style="color: #999;">Chưa có file nào được chọn</p>';
        return;
    }
    
    mergeFiles.forEach((file, index) => {
        const div = document.createElement('div');
        div.className = 'file-item';
        div.innerHTML = `
            <span>${index + 1}. ${file.name}</span>
            <button class="btn-small" onclick="removeMergeFile(${index})" style="background: #f5576c;">Xóa</button>
        `;
        fileList.appendChild(div);
    });
}

// Hàm xóa file khỏi danh sách
window.removeMergeFile = function(index) {
    mergeFiles.splice(index, 1);
    mergeFileOrder = mergeFiles.map((_, i) => i);
    updateMergeFileList();
    document.getElementById('mergePreview').style.display = 'none';
};

document.getElementById('previewMergeBtn').addEventListener('click', async () => {
    if (!mergeFiles || mergeFiles.length < 2) {
        showOutput('Vui lòng chọn ít nhất 2 file PDF', true);
        return;
    }
    
    try {
        showOutput('Đang tạo xem trước...');
        const previewContainer = document.getElementById('mergePreview');
        const previewCanvas = document.getElementById('mergePreviewCanvas');
        previewCanvas.innerHTML = '';
        
        for (let i = 0; i < mergeFiles.length; i++) {
            const file = mergeFiles[i];
            await renderMergePreview(file, `File ${i + 1}: ${file.name}`, i, previewCanvas);
        }
        
        previewContainer.style.display = 'block';
        showOutput('Xem trước thành công! Kéo thả để sắp xếp lại.');
    } catch (error) {
        showOutput('Lỗi: ' + error.message, true);
    }
});

document.getElementById('mergeBtn').addEventListener('click', async () => {
    if (!mergeFiles || mergeFiles.length < 2) {
        showOutput('Vui lòng chọn ít nhất 2 file PDF', true);
        return;
    }
    
    try {
        showOutput('Đang gộp PDF...');
        const mergedPdf = await PDFLib.PDFDocument.create();
        
        // Sử dụng thứ tự từ mergeFileOrder
        const orderedFiles = mergeFileOrder.map(index => mergeFiles[index]);
        
        for (let file of orderedFiles) {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await PDFLib.PDFDocument.load(arrayBuffer);
            const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            pages.forEach(page => mergedPdf.addPage(page));
        }
        
        const pdfBytes = await mergedPdf.save();
        downloadPDF(pdfBytes, 'merged.pdf');
        showOutput('Gộp PDF thành công!');
    } catch (error) {
        showOutput('Lỗi: ' + error.message, true);
    }
});

// ===== TÁCH PDF =====
let splitMode = 'range'; // 'range' hoặc 'individual'

// Xử lý chuyển đổi mode tách
document.querySelectorAll('input[name="splitMode"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        splitMode = e.target.value;
        const rangeOptions = document.getElementById('rangeOptions');
        if (splitMode === 'range') {
            rangeOptions.style.display = 'flex';
        } else {
            rangeOptions.style.display = 'none';
        }
    });
});

document.getElementById('splitFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await PDFLib.PDFDocument.load(arrayBuffer);
        const pageCount = pdf.getPageCount();
        
        document.getElementById('splitInfo').innerHTML = `
            <strong>File:</strong> ${file.name}<br>
            <strong>Tổng số trang:</strong> ${pageCount}
        `;
        document.getElementById('splitTo').max = pageCount;
        document.getElementById('splitTo').value = pageCount;
        document.getElementById('splitFrom').max = pageCount;
        
        // Ẩn preview khi chọn file mới
        document.getElementById('splitPreview').style.display = 'none';
    } catch (error) {
        showOutput('Lỗi đọc file: ' + error.message, true);
    }
});

document.getElementById('previewSplitBtn').addEventListener('click', async () => {
    const file = document.getElementById('splitFile').files[0];
    if (!file) {
        showOutput('Vui lòng chọn file PDF', true);
        return;
    }
    
    try {
        showOutput('Đang tạo xem trước...');
        const previewContainer = document.getElementById('splitPreview');
        const previewCanvas = document.getElementById('splitPreviewCanvas');
        previewCanvas.innerHTML = '';
        
        const arrayBuffer = await file.arrayBuffer();
        
        if (splitMode === 'range') {
            const from = parseInt(document.getElementById('splitFrom').value);
            const to = parseInt(document.getElementById('splitTo').value);
            
            if (from > to) {
                showOutput('Trang bắt đầu phải nhỏ hơn trang kết thúc', true);
                return;
            }
            
            const pdf = await pdfjsLib.getDocument({data: arrayBuffer}).promise;
            
            for (let i = from; i <= to; i++) {
                const page = await pdf.getPage(i);
                const scale = 0.5;
                const viewport = page.getViewport({scale});
                
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                
                await page.render({canvasContext: context, viewport}).promise;
                
                const div = document.createElement('div');
                div.className = 'preview-page';
                div.appendChild(canvas);
                const p = document.createElement('p');
                p.textContent = `Trang ${i}`;
                div.appendChild(p);
                previewCanvas.appendChild(div);
            }
            
            showOutput(`Xem trước ${to - from + 1} trang thành công!`);
        } else {
            // Individual mode - hiển thị tất cả trang
            const pdfLib = await PDFLib.PDFDocument.load(arrayBuffer);
            const pageCount = pdfLib.getPageCount();
            const pdf = await pdfjsLib.getDocument({data: arrayBuffer}).promise;
            
            for (let i = 1; i <= pageCount; i++) {
                const page = await pdf.getPage(i);
                const scale = 0.5;
                const viewport = page.getViewport({scale});
                
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                
                await page.render({canvasContext: context, viewport}).promise;
                
                const div = document.createElement('div');
                div.className = 'preview-page';
                div.appendChild(canvas);
                const p = document.createElement('p');
                p.textContent = `Trang ${i} → page_${i}.pdf`;
                div.appendChild(p);
                previewCanvas.appendChild(div);
            }
            
            showOutput(`Xem trước ${pageCount} trang. Mỗi trang sẽ thành 1 file riêng.`);
        }
        
        previewContainer.style.display = 'block';
    } catch (error) {
        showOutput('Lỗi: ' + error.message, true);
    }
});

document.getElementById('splitBtn').addEventListener('click', async () => {
    const file = document.getElementById('splitFile').files[0];
    if (!file) {
        showOutput('Vui lòng chọn file PDF', true);
        return;
    }
    
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await PDFLib.PDFDocument.load(arrayBuffer);
        
        if (splitMode === 'range') {
            // Tách theo khoảng trang thành 1 file
            const from = parseInt(document.getElementById('splitFrom').value);
            const to = parseInt(document.getElementById('splitTo').value);
            
            if (from > to) {
                showOutput('Trang bắt đầu phải nhỏ hơn trang kết thúc', true);
                return;
            }
            
            showOutput('Đang tách PDF...');
            const newPdf = await PDFLib.PDFDocument.create();
            
            const pages = await newPdf.copyPages(pdf, Array.from({length: to - from + 1}, (_, i) => from - 1 + i));
            pages.forEach(page => newPdf.addPage(page));
            
            const pdfBytes = await newPdf.save();
            downloadPDF(pdfBytes, `split_${from}-${to}.pdf`);
            showOutput(`Tách thành công trang ${from} đến ${to}!`);
        } else {
            // Tách từng trang thành file riêng
            showOutput('Đang tách từng trang...');
            const pageCount = pdf.getPageCount();
            
            for (let i = 0; i < pageCount; i++) {
                const newPdf = await PDFLib.PDFDocument.create();
                const [copiedPage] = await newPdf.copyPages(pdf, [i]);
                newPdf.addPage(copiedPage);
                
                const pdfBytes = await newPdf.save();
                downloadPDF(pdfBytes, `page_${i + 1}.pdf`);
                
                // Thêm delay nhỏ để tránh quá tải trình duyệt
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            showOutput(`Tách thành công ${pageCount} trang thành ${pageCount} file riêng biệt!`);
        }
    } catch (error) {
        showOutput('Lỗi: ' + error.message, true);
    }
});

// ===== TẠO SỔ PDF =====
// Xử lý chuyển đổi mode
document.querySelectorAll('input[name="bookletMode"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        bookletMode = e.target.value;
        if (bookletMode === 'separate') {
            document.getElementById('separateMode').style.display = 'grid';
            document.getElementById('singleMode').style.display = 'none';
        } else {
            document.getElementById('separateMode').style.display = 'none';
            document.getElementById('singleMode').style.display = 'block';
        }
    });
});

// Xử lý file đơn
document.getElementById('singleBookletFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await PDFLib.PDFDocument.load(arrayBuffer);
        const pageCount = pdf.getPageCount();
        
        const infoDiv = document.getElementById('singleFileInfo');
        if (pageCount !== 4) {
            infoDiv.innerHTML = `<span style="color: #c62828;">⚠️ File phải có đúng 4 trang. File này có ${pageCount} trang.</span>`;
            singleBookletFile = null;
        } else {
            infoDiv.innerHTML = `<span style="color: #2e7d32;">✓ File hợp lệ: ${file.name} (4 trang)</span>`;
            singleBookletFile = file;
        }
    } catch (error) {
        document.getElementById('singleFileInfo').innerHTML = `<span style="color: #c62828;">Lỗi đọc file: ${error.message}</span>`;
        singleBookletFile = null;
    }
});

document.getElementById('coverFile').addEventListener('change', (e) => {
    bookletFiles.cover = e.target.files[0];
});

document.getElementById('content1File').addEventListener('change', (e) => {
    bookletFiles.content1 = e.target.files[0];
});

document.getElementById('content2File').addEventListener('change', (e) => {
    bookletFiles.content2 = e.target.files[0];
});

document.getElementById('backFile').addEventListener('change', (e) => {
    bookletFiles.back = e.target.files[0];
});

document.getElementById('previewBookletBtn').addEventListener('click', async () => {
    // Kiểm tra mode và file
    if (bookletMode === 'separate') {
        if (!bookletFiles.cover || !bookletFiles.content1 || !bookletFiles.content2 || !bookletFiles.back) {
            showOutput('Vui lòng chọn đủ 4 file PDF', true);
            return;
        }
    } else {
        if (!singleBookletFile) {
            showOutput('Vui lòng chọn file PDF có 4 trang', true);
            return;
        }
    }
    
    try {
        showOutput('Đang tạo xem trước...');
        const previewContainer = document.getElementById('bookletPreview');
        const previewCanvas = document.getElementById('previewCanvas');
        previewCanvas.innerHTML = '';
        
        // Reset thứ tự về mặc định
        pageOrder = ['cover', 'back', 'content1', 'content2'];
        
        if (bookletMode === 'separate') {
            // Hiển thị preview cho từng file
            await renderPreviewDraggable(bookletFiles.cover, 'Trang đầu', 'cover', previewCanvas);
            await renderPreviewDraggable(bookletFiles.back, 'Trang cuối', 'back', previewCanvas);
            await renderPreviewDraggable(bookletFiles.content1, 'Nội dung 1', 'content1', previewCanvas);
            await renderPreviewDraggable(bookletFiles.content2, 'Nội dung 2', 'content2', previewCanvas);
        } else {
            // Hiển thị preview cho 4 trang của file đơn
            await renderPreviewFromSingleFileDraggable(singleBookletFile, previewCanvas);
        }
        
        previewContainer.style.display = 'block';
        showOutput('Xem trước thành công! Kéo thả để sắp xếp lại trang.');
    } catch (error) {
        showOutput('Lỗi: ' + error.message, true);
    }
});

document.getElementById('createBookletBtn').addEventListener('click', async () => {
    // Kiểm tra mode và file
    if (bookletMode === 'separate') {
        if (!bookletFiles.cover || !bookletFiles.content1 || !bookletFiles.content2 || !bookletFiles.back) {
            showOutput('Vui lòng chọn đủ 4 file PDF', true);
            return;
        }
    } else {
        if (!singleBookletFile) {
            showOutput('Vui lòng chọn file PDF có 4 trang', true);
            return;
        }
    }
    
    try {
        showOutput('Đang tạo sổ PDF...');
        const bookletPdf = await PDFLib.PDFDocument.create();
        
        let pages = {};
        
        if (bookletMode === 'separate') {
            // Tải tất cả các file riêng biệt
            const coverPdf = await PDFLib.PDFDocument.load(await bookletFiles.cover.arrayBuffer());
            const backPdf = await PDFLib.PDFDocument.load(await bookletFiles.back.arrayBuffer());
            const content1Pdf = await PDFLib.PDFDocument.load(await bookletFiles.content1.arrayBuffer());
            const content2Pdf = await PDFLib.PDFDocument.load(await bookletFiles.content2.arrayBuffer());
            
            const [coverPage] = await bookletPdf.copyPages(coverPdf, [0]);
            const [backPage] = await bookletPdf.copyPages(backPdf, [0]);
            const [content1Page] = await bookletPdf.copyPages(content1Pdf, [0]);
            const [content2Page] = await bookletPdf.copyPages(content2Pdf, [0]);
            
            pages = { cover: coverPage, back: backPage, content1: content1Page, content2: content2Page };
        } else {
            // Tải file đơn và copy 4 trang trực tiếp
            const singlePdf = await PDFLib.PDFDocument.load(await singleBookletFile.arrayBuffer());
            const copiedPages = await bookletPdf.copyPages(singlePdf, [0, 1, 2, 3]);
            
            pages = {
                cover: copiedPages[0],
                content1: copiedPages[1],
                content2: copiedPages[2],
                back: copiedPages[3]
            };
        }
        
        // Sử dụng thứ tự từ pageOrder
        const orderedPages = pageOrder.map(key => pages[key]);
        
        // Embed các trang để có thể vẽ
        const embeddedPages = await Promise.all(orderedPages.map(page => bookletPdf.embedPage(page)));
        
        // Lấy kích thước trang gốc
        const page0Dims = embeddedPages[0].scale(1);
        
        // Tính toán scale để fit vào trang A4 ngang (842 x 595 points)
        const targetWidth = 842; // A4 landscape width
        const targetHeight = 595; // A4 landscape height
        const combinedWidth = page0Dims.width * 2;
        const scale = Math.min(targetWidth / combinedWidth, targetHeight / page0Dims.height);
        
        // Tạo trang đầu tiên: 2 trang đầu tiên trong pageOrder (side by side)
        const newPage1 = bookletPdf.addPage([targetWidth, targetHeight]);
        const scaledWidth = page0Dims.width * scale;
        const scaledHeight = page0Dims.height * scale;
        const offsetX = (targetWidth - scaledWidth * 2) / 2;
        const offsetY = (targetHeight - scaledHeight) / 2;
        
        newPage1.drawPage(embeddedPages[0], { 
            x: offsetX, 
            y: offsetY,
            width: scaledWidth,
            height: scaledHeight
        });
        newPage1.drawPage(embeddedPages[1], { 
            x: offsetX + scaledWidth, 
            y: offsetY,
            width: scaledWidth,
            height: scaledHeight
        });
        
        // Tạo trang thứ hai: 2 trang cuối trong pageOrder (side by side)
        const newPage2 = bookletPdf.addPage([targetWidth, targetHeight]);
        newPage2.drawPage(embeddedPages[2], { 
            x: offsetX, 
            y: offsetY,
            width: scaledWidth,
            height: scaledHeight
        });
        newPage2.drawPage(embeddedPages[3], { 
            x: offsetX + scaledWidth, 
            y: offsetY,
            width: scaledWidth,
            height: scaledHeight
        });
        
        const pdfBytes = await bookletPdf.save();
        downloadPDF(pdfBytes, 'booklet.pdf');
        showOutput('Tạo sổ PDF thành công! 📖 Hướng dẫn in: Chọn Paper size = A4/Letter, Scale = Fit to page, Orientation = Landscape (ngang)');
    } catch (error) {
        showOutput('Lỗi: ' + error.message, true);
    }
});

// ===== HÀM HỖ TRỢ =====
async function renderPreview(file, label, container) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({data: arrayBuffer}).promise;
    const page = await pdf.getPage(1);
    
    const scale = 0.5;
    const viewport = page.getViewport({scale});
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    await page.render({canvasContext: context, viewport}).promise;
    
    const div = document.createElement('div');
    div.className = 'preview-page';
    div.appendChild(canvas);
    const p = document.createElement('p');
    p.textContent = label;
    div.appendChild(p);
    container.appendChild(div);
}

async function renderPreviewDraggable(file, label, pageKey, container) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({data: arrayBuffer}).promise;
    const page = await pdf.getPage(1);
    
    const scale = 0.5;
    const viewport = page.getViewport({scale});
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    await page.render({canvasContext: context, viewport}).promise;
    
    const div = document.createElement('div');
    div.className = 'preview-page';
    div.draggable = true;
    div.dataset.pageKey = pageKey;
    
    // Thêm sự kiện drag
    div.addEventListener('dragstart', handleDragStart);
    div.addEventListener('dragend', handleDragEnd);
    div.addEventListener('dragover', handleDragOver);
    div.addEventListener('drop', handleDrop);
    div.addEventListener('dragleave', handleDragLeave);
    
    div.appendChild(canvas);
    const p = document.createElement('p');
    p.textContent = label;
    div.appendChild(p);
    container.appendChild(div);
}

async function renderPreviewFromSingleFile(file, container) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({data: arrayBuffer}).promise;
    
    const labels = ['Trang đầu (Trang 1)', 'Nội dung 1 (Trang 2)', 'Nội dung 2 (Trang 3)', 'Trang cuối (Trang 4)'];
    
    for (let i = 1; i <= 4; i++) {
        const page = await pdf.getPage(i);
        const scale = 0.5;
        const viewport = page.getViewport({scale});
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        await page.render({canvasContext: context, viewport}).promise;
        
        const div = document.createElement('div');
        div.className = 'preview-page';
        div.appendChild(canvas);
        const p = document.createElement('p');
        p.textContent = labels[i - 1];
        div.appendChild(p);
        container.appendChild(div);
    }
}

async function renderPreviewFromSingleFileDraggable(file, container) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({data: arrayBuffer}).promise;
    
    const labels = ['Trang đầu (Trang 1)', 'Nội dung 1 (Trang 2)', 'Nội dung 2 (Trang 3)', 'Trang cuối (Trang 4)'];
    const pageKeys = ['cover', 'content1', 'content2', 'back'];
    
    for (let i = 1; i <= 4; i++) {
        const page = await pdf.getPage(i);
        const scale = 0.5;
        const viewport = page.getViewport({scale});
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        await page.render({canvasContext: context, viewport}).promise;
        
        const div = document.createElement('div');
        div.className = 'preview-page';
        div.draggable = true;
        div.dataset.pageKey = pageKeys[i - 1];
        
        // Thêm sự kiện drag
        div.addEventListener('dragstart', handleDragStart);
        div.addEventListener('dragend', handleDragEnd);
        div.addEventListener('dragover', handleDragOver);
        div.addEventListener('drop', handleDrop);
        div.addEventListener('dragleave', handleDragLeave);
        
        div.appendChild(canvas);
        const p = document.createElement('p');
        p.textContent = labels[i - 1];
        div.appendChild(p);
        container.appendChild(div);
    }
}

// Xử lý drag and drop
function handleDragStart(e) {
    draggedElement = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
    document.querySelectorAll('.preview-page').forEach(item => {
        item.classList.remove('drag-over');
    });
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    
    if (draggedElement !== this) {
        // Hoán đổi vị trí trong mảng pageOrder
        const draggedKey = draggedElement.dataset.pageKey;
        const targetKey = this.dataset.pageKey;
        
        const draggedIndex = pageOrder.indexOf(draggedKey);
        const targetIndex = pageOrder.indexOf(targetKey);
        
        [pageOrder[draggedIndex], pageOrder[targetIndex]] = [pageOrder[targetIndex], pageOrder[draggedIndex]];
        
        // Hoán đổi vị trí trong DOM
        const parent = this.parentNode;
        const draggedIndex2 = Array.from(parent.children).indexOf(draggedElement);
        const targetIndex2 = Array.from(parent.children).indexOf(this);
        
        if (draggedIndex2 < targetIndex2) {
            parent.insertBefore(draggedElement, this.nextSibling);
        } else {
            parent.insertBefore(draggedElement, this);
        }
    }
    
    this.classList.remove('drag-over');
    return false;
}

function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

async function renderMergePreview(file, label, fileIndex, container) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({data: arrayBuffer}).promise;
    const page = await pdf.getPage(1);
    
    const scale = 0.5;
    const viewport = page.getViewport({scale});
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    await page.render({canvasContext: context, viewport}).promise;
    
    const div = document.createElement('div');
    div.className = 'preview-page';
    div.draggable = true;
    div.dataset.fileIndex = fileIndex;
    
    // Thêm sự kiện drag cho merge
    div.addEventListener('dragstart', handleMergeDragStart);
    div.addEventListener('dragend', handleDragEnd);
    div.addEventListener('dragover', handleDragOver);
    div.addEventListener('drop', handleMergeDrop);
    div.addEventListener('dragleave', handleDragLeave);
    
    div.appendChild(canvas);
    const p = document.createElement('p');
    p.textContent = label;
    div.appendChild(p);
    container.appendChild(div);
}

function handleMergeDragStart(e) {
    draggedElement = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
}

function handleMergeDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    
    if (draggedElement !== this) {
        // Hoán đổi vị trí trong mảng mergeFileOrder
        const draggedIndex = parseInt(draggedElement.dataset.fileIndex);
        const targetIndex = parseInt(this.dataset.fileIndex);
        
        const draggedOrderIndex = mergeFileOrder.indexOf(draggedIndex);
        const targetOrderIndex = mergeFileOrder.indexOf(targetIndex);
        
        [mergeFileOrder[draggedOrderIndex], mergeFileOrder[targetOrderIndex]] = 
            [mergeFileOrder[targetOrderIndex], mergeFileOrder[draggedOrderIndex]];
        
        // Hoán đổi vị trí trong DOM
        const parent = this.parentNode;
        const draggedDOMIndex = Array.from(parent.children).indexOf(draggedElement);
        const targetDOMIndex = Array.from(parent.children).indexOf(this);
        
        if (draggedDOMIndex < targetDOMIndex) {
            parent.insertBefore(draggedElement, this.nextSibling);
        } else {
            parent.insertBefore(draggedElement, this);
        }
    }
    
    this.classList.remove('drag-over');
    return false;
}

function downloadPDF(pdfBytes, filename) {
    const blob = new Blob([pdfBytes], {type: 'application/pdf'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function showOutput(message, isError = false) {
    const output = document.getElementById('output');
    output.textContent = message;
    output.className = 'output show' + (isError ? ' error' : '');
}
