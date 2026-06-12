/* ═══════════════════════════════════════════
   SHADOWFORGE MINI APP - APP LOGIC
   Telegram WebApp Integration
   ═══════════════════════════════════════════ */

// ── Product Data ──────────────────────────
const PRODUCTS = {
  basic: {
    id: 'basic',
    name: 'ShadowForge Basic',
    desc: '1 máy, key vĩnh viễn',
    price: 50000,
    priceFormatted: '50.000đ',
    maxActivations: 1,
    expiresDays: null,
  },
  pro: {
    id: 'pro',
    name: 'ShadowForge Pro',
    desc: '3 máy, key vĩnh viễn',
    price: 120000,
    priceFormatted: '120.000đ',
    maxActivations: 3,
    expiresDays: null,
  },
  ultimate: {
    id: 'ultimate',
    name: 'ShadowForge Ultimate',
    desc: 'Không giới hạn máy, key vĩnh viễn',
    price: 300000,
    priceFormatted: '300.000đ',
    maxActivations: 99,
    expiresDays: null,
  },
  monthly: {
    id: 'monthly',
    name: 'ShadowForge Monthly',
    desc: '1 máy, 30 ngày',
    price: 25000,
    priceFormatted: '25.000đ',
    maxActivations: 1,
    expiresDays: 30,
  },
};

// ── Payment Config ────────────────────────
// EDIT THIS: Thay bằng thông tin của anh
const PAYMENT = {
  bankName: 'MB Bank',
  accountNumber: '0123456789',
  accountName: 'NGUYEN MINH QUANG',
  momoNumber: '0123456789',
  momoName: 'NGUYEN MINH QUANG',
};

// ── API Config ────────────────────────────
const API_BASE = window.location.origin; // Same origin (bot server)

// ── State ─────────────────────────────────
let selectedProduct = null;
let orderId = null;

// ── Telegram WebApp Init ──────────────────
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  // Set colors to match our theme
  tg.setHeaderColor('#0a0a0f');
  tg.setBackgroundColor('#0a0a0f');
  tg.setBottomBarColor('#111118');
  console.log('Telegram WebApp initialized:', tg.initDataUnsafe?.user?.first_name);
}

// ── Particles Background ──────────────────
function initParticles() {
  const canvas = document.getElementById('particles');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  
  const particles = [];
  const count = 35;
  
  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.5 + 0.5,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      alpha: Math.random() * 0.4 + 0.1,
    });
  }
  
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      
      if (p.x < 0) p.x = canvas.width;
      if (p.x > canvas.width) p.x = 0;
      if (p.y < 0) p.y = canvas.height;
      if (p.y > canvas.height) p.y = 0;
      
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(138, 43, 226, ${p.alpha})`;
      ctx.fill();
    });
    
    // Draw connections
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(138, 43, 226, ${0.05 * (1 - dist / 120)})`;
          ctx.stroke();
        }
      }
    }
    
    requestAnimationFrame(animate);
  }
  
  animate();
  
  window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  });
}

// ── Product Selection ────────────────────
function selectProduct(productId) {
  selectedProduct = PRODUCTS[productId];
  
  // Update card styles
  document.querySelectorAll('.product-card').forEach((card) => {
    card.classList.remove('selected');
  });
  document.querySelector(`[data-product="${productId}"]`)?.classList.add('selected');
  
  // Show payment modal
  showPaymentModal();
}

// ── Payment Modal ─────────────────────────
function showPaymentModal() {
  if (!selectedProduct) return;
  
  orderId = 'SF-' + Math.random().toString(36).substring(2, 10).toUpperCase();
  
  const modal = document.getElementById('paymentModal');
  const title = document.getElementById('modalTitle');
  const body = document.getElementById('modalBody');
  
  title.textContent = `🧾 Đơn hàng #${orderId}`;
  
  body.innerHTML = `
    <div class="payment-info">
      <div class="bank-row">
        <span class="label">Sản phẩm:</span>
        <span class="value">${selectedProduct.name}</span>
      </div>
      <div class="bank-row">
        <span class="label">Mô tả:</span>
        <span class="value">${selectedProduct.desc}</span>
      </div>
      <div class="bank-row">
        <span class="label">Số tiền:</span>
        <span class="value" style="color: var(--accent-orange); font-size: 1rem;">
          ${selectedProduct.priceFormatted}
        </span>
      </div>
    </div>
    
    <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 12px;">
      <strong>💳 Thông tin chuyển khoản:</strong>
    </p>
    
    <div class="payment-info">
      <div class="bank-row">
        <span class="label">🏦 Ngân hàng:</span>
        <span class="value">${PAYMENT.bankName}</span>
      </div>
      <div class="bank-row">
        <span class="label">📋 Số TK:</span>
        <span class="value" style="font-size: 0.85rem;">${PAYMENT.accountNumber}</span>
      </div>
      <div class="bank-row">
        <span class="label">👤 Chủ TK:</span>
        <span class="value">${PAYMENT.accountName}</span>
      </div>
    </div>
    
    <div class="payment-info" style="margin-top: 8px;">
      <div class="bank-row">
        <span class="label">📱 MoMo:</span>
        <span class="value">${PAYMENT.momoNumber}</span>
      </div>
      <div class="bank-row">
        <span class="label">👤 Tên:</span>
        <span class="value">${PAYMENT.momoName}</span>
      </div>
    </div>
    
    <div class="payment-note">
      ⚠️ <strong>Nội dung chuyển khoản:</strong><br>
      <code>SF ${orderId}</code>
    </div>
    
    <input 
      type="text" 
      class="input-field" 
      id="cusName" 
      placeholder="Tên của bạn (để ghi nhận)" 
      value="${tg?.initDataUnsafe?.user?.first_name || ''}"
    >
    
    <p style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 16px;">
      Sau khi chuyển khoản, nhấn nút bên dưới. Hệ thống sẽ kiểm tra và gửi key qua Telegram.
    </p>
    
    <button class="btn-primary" id="confirmPayment" onclick="confirmPayment()">
      ✅ Tôi đã chuyển khoản - Nhận Key
    </button>
    
    <p style="text-align: center; margin-top: 12px; font-size: 0.72rem; color: var(--text-muted);">
      Hoặc gõ <code>/paid ${orderId} ${selectedProduct.id}</code> trong bot
    </p>
  `;
  
  modal.classList.add('active');
}

function closeModal() {
  document.getElementById('paymentModal').classList.remove('active');
}

// ── Confirm Payment → Get Key ────────────
async function confirmPayment() {
  const btn = document.getElementById('confirmPayment');
  const cusName = document.getElementById('cusName')?.value || 'Telegram User';
  
  btn.disabled = true;
  btn.innerHTML = '<span class="loading-spinner"></span> Đang tạo key...';
  
  try {
    const res = await fetch(`${API_BASE}/api/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: selectedProduct.id,
        customerName: cusName,
      }),
    });
    
    const data = await res.json();
    
    if (data.success) {
      closeModal();
      showSuccessModal(data.licenseKey);
      
      // Send result back to Telegram bot
      if (tg) {
        tg.sendData(JSON.stringify({
          action: 'order_completed',
          orderId: data.orderId,
          licenseKey: data.licenseKey,
          product: data.product,
        }));
      }
    } else {
      showToast('Lỗi tạo key: ' + (data.error || 'Thử lại sau'), 'error');
    }
  } catch (e) {
    showToast('Lỗi kết nối! Kiểm tra lại mạng hoặc thử /paid trong bot', 'error');
    console.error(e);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '✅ Tôi đã chuyển khoản - Nhận Key';
  }
}

// ── Success Modal ─────────────────────────
function showSuccessModal(key) {
  document.getElementById('keyDisplay').textContent = key;
  document.getElementById('successModal').classList.add('active');
}

function closeSuccessModal() {
  document.getElementById('successModal').classList.remove('active');
  // Reset selection
  selectedProduct = null;
  document.querySelectorAll('.product-card').forEach((c) => c.classList.remove('selected'));
}

// ── Toast Notification ────────────────────
function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ── Close modals on overlay click ─────────
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('active');
  }
});

// ── Init ──────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initParticles();
  
  console.log('ShadowForge Mini App loaded');
  console.log('Products:', Object.keys(PRODUCTS).length);
});
