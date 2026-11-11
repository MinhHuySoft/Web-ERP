// Cấu hình điểm vào backend (chuẩn ERP-HTML mục 3.4).
// Bản demo trỏ vào mock HTML trong web/mock/. Khi có backend thật, đổi các URL dưới đây.
window.ERP_CONFIG = {
  appName: 'ERP Web',
  loginUrl: '/mock/login.html',
  sessionUrl: '/mock/session.html',
  menuUrl: '/mock/menu.html',
  homeUrl: '/mock/home.html',
  // Các origin được phép gọi (ngoài origin hiện tại). Để trống = chỉ cùng origin.
  allowedOrigins: [],
  contractVersion: '1.0',
  // Theme mặc định khi người dùng chưa chọn.
  defaultTheme: 'ribbon-classic',
  // Số tab giữ màn hình trong bộ nhớ. Tab ít dùng hơn sẽ "ngủ" (nhả bộ nhớ) và tự tải lại khi được chọn. 0 = không giới hạn.
  maxLiveTabs: 12,
};
