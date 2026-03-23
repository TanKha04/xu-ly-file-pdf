# Xử lý file PDF - Halloween Edition 🎃

Ứng dụng web đơn giản để xử lý file PDF với giao diện Halloween.

**Thiết kế bởi: Trầm Tấn Khá**

## Tính năng

### 1. Gộp PDF
- Chọn nhiều file PDF (có thể chọn từng file một)
- Xem trước trang đầu của mỗi file
- Kéo thả để sắp xếp lại thứ tự
- Gộp thành một file duy nhất

### 2. Tách PDF
- **Tách theo khoảng trang**: Tách từ trang X đến trang Y thành 1 file
- **Tách từng trang**: Mỗi trang thành 1 file riêng biệt
- Xem trước các trang sẽ tách

### 3. Tạo sổ PDF
- **Chế độ 4 file riêng**: Tải lên 4 file PDF riêng biệt
- **Chế độ 1 file**: Tải lên 1 file PDF có đúng 4 trang
- Xem trước bố cục sổ
- Kéo thả để sắp xếp lại trang
- Tạo sổ PDF với 2 trang in 2 mặt

## Cách sử dụng

1. Mở file `index.html` trong trình duyệt web
2. Chọn tab tương ứng với chức năng cần dùng
3. Tải lên file PDF
4. Xem trước và chỉnh sửa (nếu cần)
5. Thực hiện thao tác và tải về kết quả

## Deploy lên GitHub Pages

### Bước 1: Tạo Repository trên GitHub
1. Truy cập https://github.com
2. Đăng nhập (hoặc đăng ký nếu chưa có tài khoản)
3. Click nút **"New"** hoặc **"+"** > **"New repository"**
4. Đặt tên repository (ví dụ: `pdf-tools`)
5. Chọn **Public**
6. Click **"Create repository"**

### Bước 2: Upload code lên GitHub

**Cách 1: Upload trực tiếp trên web**
1. Trong repository vừa tạo, click **"uploading an existing file"**
2. Kéo thả các file: `index.html`, `styles.css`, `app.js`, `README.md`
3. Click **"Commit changes"**

**Cách 2: Dùng Git (nếu đã cài Git)**
```bash
# Mở terminal trong thư mục dự án
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/USERNAME/pdf-tools.git
git push -u origin main
```
*(Thay USERNAME bằng tên GitHub của bạn)*

### Bước 3: Bật GitHub Pages
1. Vào repository trên GitHub
2. Click tab **"Settings"**
3. Scroll xuống phần **"Pages"** (bên trái)
4. Ở **"Source"**, chọn **"main"** branch
5. Click **"Save"**
6. Đợi 1-2 phút

### Bước 4: Truy cập trang web
Link sẽ có dạng:
```
https://USERNAME.github.io/pdf-tools/
```

## Công nghệ sử dụng

- HTML5, CSS3, JavaScript
- PDF.js (hiển thị và đọc PDF)
- PDF-Lib (xử lý và tạo PDF)
- Giao diện Halloween với màu đỏ, cam, đen

## Lưu ý

- Tất cả xử lý được thực hiện trên trình duyệt (client-side)
- Không có dữ liệu nào được gửi lên server
- Hỗ trợ các trình duyệt hiện đại (Chrome, Firefox, Edge, Safari)
- File PDF được xử lý hoàn toàn trên máy người dùng

## Liên hệ

Thiết kế và phát triển bởi: **Trầm Tấn Khá**

---

🎃 Happy Halloween! 🦇
