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
        showOutput('Vui lòng chọn ít nhất 2 file PDF hoặc hình ảnh', true);
        return;
    }
    
    try {
        showOutput('Đang tạo xem trước...');
        const previewContainer = document.getElementById('mergePreview');
        const previewCanvas = document.getElementById('mergePreviewCanvas');
        previewCanvas.innerHTML = '';
        
        // Reset zoom
        zoomLevels.merge = 100;
        document.getElementById('mergeZoomLevel').textContent = '100%';
        previewCanvas.style.transform = 'scale(1)';
        
        // Reset dữ liệu preview
        mergePreviewData = [];
        
        let pageIndex = 0;
        for (let i = 0; i < mergeFiles.length; i++) {
            const file = mergeFiles[i];
            
            if (file.type.startsWith('image/')) {
                // Hình ảnh chỉ có 1 trang
                mergePreviewData.push({
                    file: file,
                    label: `File ${i + 1}: ${file.name}`,
                    pageIndex: pageIndex,
                    isImage: true,
                    pageNumber: 1
                });
                await renderMergePreviewPage(file, `File ${i + 1}: ${file.name}`, pageIndex, previewCanvas, true);
                pageIndex++;
            } else {
                // PDF có thể có nhiều trang
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await PDFLib.PDFDocument.load(arrayBuffer);
                const pageCount = pdf.getPageCount();
                
                for (let p = 0; p < pageCount; p++) {
                    mergePreviewData.push({
                        file: file,
                        label: `File ${i + 1}: ${file.name} - Trang ${p + 1}/${pageCount}`,
                        pageIndex: pageIndex,
                        isImage: false,
                        pageNumber: p + 1
                    });
                    await renderMergePreviewPage(file, `File ${i + 1}: ${file.name} - Trang ${p + 1}/${pageCount}`, pageIndex, previewCanvas, false, p + 1);
                    pageIndex++;
                }
            }
        }
        
        previewContainer.style.display = 'block';
        showOutput('Xem trước thành công! Kéo thả để sắp xếp lại.');
    } catch (error) {
        showOutput('Lỗi: ' + error.message, true);
    }
});

document.getElementById('mergeBtn').addEventListener('click', async () => {
    if (!mergeFiles || mergeFiles.length < 2) {
        showOutput('Vui lòng chọn ít nhất 2 file PDF hoặc hình ảnh', true);
        return;
    }
    
    try {
        showOutput('Đang gộp PDF...');
        const mergedPdf = await PDFLib.PDFDocument.create();
        
        // Kiểm tra xem có preview không để lấy thứ tự
        const previewCanvas = document.getElementById('mergePreviewCanvas');
        const hasPreview = previewCanvas.children.length > 0;
        
        if (hasPreview) {
            // Sử dụng thứ tự từ preview
            const previewPages = Array.from(previewCanvas.children);
            
            for (let previewPage of previewPages) {
                const label = previewPage.querySelector('p').textContent;
                // Parse label để lấy file index và page number
                const match = label.match(/File (\d+):.*?(?:- Trang (\d+)\/(\d+))?/);
                if (match) {
                    const fileIndex = parseInt(match[1]) - 1;
                    const pageNumber = match[2] ? parseInt(match[2]) : 1;
                    const file = mergeFiles[fileIndex];
                    
                    if (file.type.startsWith('image/')) {
                        // Xử lý hình ảnh
                        await addImageToPdf(mergedPdf, file);
                    } else {
                        // Xử lý PDF - chỉ thêm trang cụ thể
                        await addPdfPageToPdf(mergedPdf, file, pageNumber - 1);
                    }
                }
            }
        } else {
            // Không có preview, sử dụng thứ tự mặc định
            for (let file of mergeFiles) {
                if (file.type.startsWith('image/')) {
                    await addImageToPdf(mergedPdf, file);
                } else {
                    // Thêm tất cả trang của PDF
                    const arrayBuffer = await file.arrayBuffer();
                    const pdf = await PDFLib.PDFDocument.load(arrayBuffer);
                    const pageIndices = pdf.getPageIndices();
                    
                    for (let i of pageIndices) {
                        await addPdfPageToPdf(mergedPdf, file, i);
                    }
                }
            }
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
        
        // Reset zoom
        zoomLevels.split = 100;
        document.getElementById('splitZoomLevel').textContent = '100%';
        previewCanvas.style.transform = 'scale(1)';
        
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
            
            const pageIndices = Array.from({length: to - from + 1}, (_, i) => from - 1 + i);
            
            for (let i of pageIndices) {
                const [copiedPage] = await newPdf.copyPages(pdf, [i]);
                
                // Áp dụng resize nếu cần
                if (resizeModes.split === 'a4' || resizeModes.split === 'letter') {
                    const targetSize = resizeModes.split === 'a4' ? PAGE_SIZES.a4 : PAGE_SIZES.letter;
                    const { width, height } = copiedPage.getSize();
                    const scale = Math.min(targetSize.width / width, targetSize.height / height);
                    
                    copiedPage.scale(scale, scale);
                    copiedPage.setSize(targetSize.width, targetSize.height);
                }
                
                newPdf.addPage(copiedPage);
            }
            
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
                
                // Áp dụng resize nếu cần
                if (resizeModes.split === 'a4' || resizeModes.split === 'letter') {
                    const targetSize = resizeModes.split === 'a4' ? PAGE_SIZES.a4 : PAGE_SIZES.letter;
                    const { width, height } = copiedPage.getSize();
                    const scale = Math.min(targetSize.width / width, targetSize.height / height);
                    
                    copiedPage.scale(scale, scale);
                    copiedPage.setSize(targetSize.width, targetSize.height);
                }
                
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
        
        // Reset zoom
        zoomLevels.booklet = 100;
        document.getElementById('bookletZoomLevel').textContent = '100%';
        previewCanvas.style.transform = 'scale(1)';
        
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
        
        // Áp dụng resize cho từng trang nếu cần
        if (resizeModes.booklet === 'a4' || resizeModes.booklet === 'letter') {
            const targetSize = resizeModes.booklet === 'a4' ? PAGE_SIZES.a4 : PAGE_SIZES.letter;
            
            for (let key in pages) {
                const page = pages[key];
                const { width, height } = page.getSize();
                const scale = Math.min(targetSize.width / width, targetSize.height / height);
                
                page.scale(scale, scale);
                page.setSize(targetSize.width, targetSize.height);
            }
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

async function renderMergePreviewPage(file, label, pageIndex, container, isImage = false, pageNumber = 1) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    // Kiểm tra xem file là PDF hay hình ảnh
    if (isImage || file.type.startsWith('image/')) {
        // Xử lý hình ảnh
        const img = new Image();
        const imageUrl = URL.createObjectURL(file);
        
        await new Promise((resolve, reject) => {
            img.onload = () => {
                const scale = 0.5;
                canvas.width = img.width * scale;
                canvas.height = img.height * scale;
                context.drawImage(img, 0, 0, canvas.width, canvas.height);
                URL.revokeObjectURL(imageUrl);
                resolve();
            };
            img.onerror = reject;
            img.src = imageUrl;
        });
    } else {
        // Xử lý PDF
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({data: arrayBuffer}).promise;
        const page = await pdf.getPage(pageNumber);
        
        const scale = 0.5;
        const viewport = page.getViewport({scale});
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        await page.render({canvasContext: context, viewport}).promise;
    }
    
    const div = document.createElement('div');
    div.className = 'preview-page';
    div.draggable = true;
    div.dataset.pageIndex = pageIndex;
    
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

async function renderMergePreview(file, label, fileIndex, container) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    // Kiểm tra xem file là PDF hay hình ảnh
    if (file.type.startsWith('image/')) {
        // Xử lý hình ảnh
        const img = new Image();
        const imageUrl = URL.createObjectURL(file);
        
        await new Promise((resolve, reject) => {
            img.onload = () => {
                const scale = 0.5;
                canvas.width = img.width * scale;
                canvas.height = img.height * scale;
                context.drawImage(img, 0, 0, canvas.width, canvas.height);
                URL.revokeObjectURL(imageUrl);
                resolve();
            };
            img.onerror = reject;
            img.src = imageUrl;
        });
    } else {
        // Xử lý PDF
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({data: arrayBuffer}).promise;
        const page = await pdf.getPage(1);
        
        const scale = 0.5;
        const viewport = page.getViewport({scale});
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        await page.render({canvasContext: context, viewport}).promise;
    }
    
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
        // Hoán đổi vị trí trong DOM
        const parent = this.parentNode;
        const draggedDOMIndex = Array.from(parent.children).indexOf(draggedElement);
        const targetDOMIndex = Array.from(parent.children).indexOf(this);
        
        if (draggedDOMIndex < targetDOMIndex) {
            parent.insertBefore(draggedElement, this.nextSibling);
        } else {
            parent.insertBefore(draggedElement, this);
        }
        
        // Cập nhật lại pageIndex cho tất cả các trang
        Array.from(parent.children).forEach((child, index) => {
            child.dataset.pageIndex = index;
        });
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

// ===== HÀM HỖ TRỢ =====

// Hàm load hình ảnh
function loadImage(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(img);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Không thể tải hình ảnh'));
        };
        img.src = url;
    });
}

// Hàm chuyển đổi hình ảnh sang JPEG
async function convertImageToJpeg(img) {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) {
                blob.arrayBuffer().then(resolve).catch(reject);
            } else {
                reject(new Error('Không thể chuyển đổi hình ảnh'));
            }
        }, 'image/jpeg', 0.95);
    });
}

// Hàm thêm hình ảnh vào PDF
async function addImageToPdf(pdfDoc, imageFile) {
    const img = await loadImage(imageFile);
    const imageBytes = await imageFile.arrayBuffer();
    
    let embeddedImage;
    if (imageFile.type === 'image/png') {
        embeddedImage = await pdfDoc.embedPng(imageBytes);
    } else {
        // Chuyển đổi các định dạng khác sang JPEG
        const jpegBytes = await convertImageToJpeg(img);
        embeddedImage = await pdfDoc.embedJpg(jpegBytes);
    }
    
    // Tạo trang với kích thước gốc của hình ảnh
    const page = pdfDoc.addPage([img.width, img.height]);
    
    page.drawImage(embeddedImage, {
        x: 0,
        y: 0,
        width: img.width,
        height: img.height
    });
}

// Hàm thêm một trang PDF vào PDF khác
async function addPdfPageToPdf(pdfDoc, pdfFile, pageIndex) {
    const arrayBuffer = await pdfFile.arrayBuffer();
    const sourcePdf = await PDFLib.PDFDocument.load(arrayBuffer);
    const [copiedPage] = await pdfDoc.copyPages(sourcePdf, [pageIndex]);
    pdfDoc.addPage(copiedPage);
}

// Biến lưu trữ zoom level cho các preview
let zoomLevels = {
    merge: 100,
    split: 100,
    booklet: 100
};

// Biến lưu trữ chế độ resize
let resizeModes = {
    merge: 'original',
    split: 'original',
    booklet: 'original'
};

// Biến lưu trữ dữ liệu preview để có thể render lại
let mergePreviewData = [];

// Kích thước chuẩn (points: 1 inch = 72 points)
const PAGE_SIZES = {
    a4: { width: 595.28, height: 841.89 }, // A4: 210mm x 297mm
    letter: { width: 612, height: 792 }     // Letter: 8.5" x 11"
};

// Hàm chuẩn hóa kích thước trang
async function resizePage(page, targetSize) {
    if (targetSize === 'original') {
        return page;
    }
    
    const { width, height } = page.getSize();
    let newWidth, newHeight;
    
    if (targetSize === 'a4') {
        newWidth = PAGE_SIZES.a4.width;
        newHeight = PAGE_SIZES.a4.height;
    } else if (targetSize === 'letter') {
        newWidth = PAGE_SIZES.letter.width;
        newHeight = PAGE_SIZES.letter.height;
    } else {
        return page; // original or unknown
    }
    
    // Scale để fit vào kích thước mới
    const scaleX = newWidth / width;
    const scaleY = newHeight / height;
    const scale = Math.min(scaleX, scaleY);
    
    page.scale(scale, scale);
    
    // Center trang trong kích thước mới
    const scaledWidth = width * scale;
    const scaledHeight = height * scale;
    const offsetX = (newWidth - scaledWidth) / 2;
    const offsetY = (newHeight - scaledHeight) / 2;
    
    page.setSize(newWidth, newHeight);
    
    return page;
}

// Lắng nghe thay đổi chế độ resize
document.querySelectorAll('input[name="mergeSizeMode"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        resizeModes.merge = e.target.value;
    });
});

document.querySelectorAll('input[name="splitSizeMode"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        resizeModes.split = e.target.value;
    });
});

document.querySelectorAll('input[name="bookletSizeMode"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        resizeModes.booklet = e.target.value;
    });
});

// Hàm zoom preview
window.zoomPreview = function(section, direction) {
    const step = 25;
    const min = 50;
    const max = 200;
    
    if (direction === 'in') {
        zoomLevels[section] = Math.min(zoomLevels[section] + step, max);
    } else {
        zoomLevels[section] = Math.max(zoomLevels[section] - step, min);
    }
    
    // Cập nhật label
    const label = document.getElementById(`${section}ZoomLevel`);
    if (label) {
        label.textContent = `${zoomLevels[section]}%`;
    }
    
    // Áp dụng zoom
    let canvasId;
    if (section === 'merge') {
        canvasId = 'mergePreviewCanvas';
    } else if (section === 'split') {
        canvasId = 'splitPreviewCanvas';
    } else if (section === 'booklet') {
        canvasId = 'previewCanvas';
    }
    
    const canvas = document.getElementById(canvasId);
    if (canvas) {
        const scale = zoomLevels[section] / 100;
        canvas.style.transform = `scale(${scale})`;
        canvas.style.transformOrigin = 'top center';
        canvas.style.transition = 'transform 0.3s ease';
    }
};
