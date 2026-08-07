const API_URL = 'https://walz-backend.onrender.com';
let token = null;
let cart = [];

// --- AUTENTICACIÓN ---

async function handleRegister() {
    const first_name = document.getElementById('reg-firstname').value;
    const last_name = document.getElementById('reg-lastname').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;

    if (!email || !password || !first_name || !last_name) {
        showMessage('Completa todos los campos.', 'error');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, first_name, last_name, password, role: 'COMPRADOR' })
        });
        const data = await res.json();
        if (res.ok) {
            showMessage('Cuenta creada. Inicia sesión.', 'success');
            showLogin();
        } else {
            showMessage(data.detail || 'Error al registrarse.', 'error');
        }
    } catch (e) {
        showMessage('Error de conexión.', 'error');
    }
}

async function handleLogin() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
        showMessage('Ingresa correo y contraseña.', 'error');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (res.ok) {
            token = data.access_token;
            localStorage.setItem('walz_token', token);
            showMessage('Bienvenido a WalZ!', 'success');
            showMarketplace();
            loadProducts();
        } else {
            showMessage(data.detail || 'Credenciales incorrectas.', 'error');
        }
    } catch (e) {
        showMessage('Error de conexión.', 'error');
    }
}

function handleLogout() {
    token = null;
    localStorage.removeItem('walz_token');
    cart = [];
    showAuth();
    showMessage('Sesión cerrada.', 'success');
}

// --- MARKETPLACE ---

async function handleCreateProduct() {
    token = localStorage.getItem('walz_token');
    const name = document.getElementById('prod-name').value;
    const price = parseFloat(document.getElementById('prod-price').value);
    const stock = parseInt(document.getElementById('prod-stock').value);

    if (!name || isNaN(price) || isNaN(stock)) {
        showMessage('Completa los datos.', 'error');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/products/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name, price, stock, category: '' })
        });
        if (res.ok) {
            showMessage('Producto publicado!', 'success');
            document.getElementById('prod-name').value = '';
            document.getElementById('prod-price').value = '';
            document.getElementById('prod-stock').value = '';
            loadProducts();
        } else {
            const data = await res.json();
            console.log("❌ Error del backend:", data);  // <--- ESTA LÍNEA ES LA QUE AGREGASTE
            showMessage(data.detail || 'Error al publicar.', 'error');
        }
    } catch (e) {
        showMessage('Error de conexión.', 'error');
    }
}

async function loadProducts() {
    try {
        const res = await fetch(`${API_URL}/products/`);
        const products = await res.json();
        const list = document.getElementById('product-list');
        list.innerHTML = '';

        if (products.length === 0) {
            list.innerHTML = '<p style="color: #888;">No hay productos.</p>';
            return;
        }

        products.forEach(p => {
            const stockValue = Number(p.stock);
            const hasStock = stockValue > 0;

            list.innerHTML += `
                <div class="product-item">
                    <h4>${p.name}</h4>
                    <p>💰 $${p.price} | 📦 Stock: ${stockValue}</p>
                    <div class="product-actions">
                        ${hasStock ? `
                            <input type="number" id="qty-${p.id}" value="1" min="1" max="${stockValue}" style="width: 50px;">
                            <button onclick="addToCart('${p.id}', '${p.name}', ${p.price})">🛒 Agregar</button>
                        ` : `
                            <p style="color: #ff4444; font-weight: bold;">Sin stock</p>
                        `}
                    </div>
                </div>
            `;
        });
    } catch (e) {
        console.error(e);
    }
}

// --- CARRITO ---

function addToCart(id, name, price) {
    const qtyInput = document.getElementById(`qty-${id}`);
    const qty = parseInt(qtyInput.value) || 1;
    const existing = cart.find(item => item.id === id);
    if (existing) {
        existing.qty += qty;
    } else {
        cart.push({ id, name, price, qty });
    }
    showMessage(`✅ ${name} (x${qty}) agregado`, 'success');
    updateCartUI();
}

function updateCartUI() {
    const count = document.getElementById('cart-count');
    if (count) {
        const total = cart.reduce((sum, item) => sum + item.qty, 0);
        count.textContent = total;
    }
}

function toggleCart() {
    const section = document.getElementById('cart-section');
    if (section.style.display === 'none') {
        section.style.display = 'block';
        renderCart();
    } else {
        section.style.display = 'none';
    }
}

function renderCart() {
    const container = document.getElementById('cart-items');
    container.innerHTML = '';
    let total = 0;
    if (cart.length === 0) {
        container.innerHTML = '<p style="color:#888;">Carrito vacío.</p>';
        document.getElementById('cart-total').textContent = '';
        return;
    }
    cart.forEach((item, idx) => {
        const subtotal = item.price * item.qty;
        total += subtotal;
        container.innerHTML += `
            <div style="display:flex;justify-content:space-between;background:#222;padding:10px;margin:5px 0;">
                <span>${item.name} x${item.qty}</span>
                <span>$${subtotal} <button onclick="removeFromCart(${idx})" style="background:#a00;">X</button></span>
            </div>
        `;
    });
    document.getElementById('cart-total').textContent = `Total: $${total}`;
}

function removeFromCart(idx) {
    cart.splice(idx, 1);
    renderCart();
    updateCartUI();
}

async function checkout() {
    if (cart.length === 0) {
        showMessage('El carrito está vacío.', 'error');
        return;
    }

    const token = localStorage.getItem('walz_token');
    if (!token) {
        showMessage('Debes iniciar sesión para comprar.', 'error');
        return;
    }

    try {
        const res = await fetch('https://walz-backend.onrender.com/orders/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                items: cart.map(item => ({
                    product_id: item.productId,
                    quantity: item.quantity
                })),
                shipping_address: "Dirección de prueba"
            })
        });

        if (res.ok) {
            showMessage('✅ ¡Compra realizada con éxito!', 'success');
            cart = [];
            renderCartItems();
            updateCartUI();
            loadProducts();
            toggleCart();
        } else {
            const data = await res.json();
            showMessage(data.detail || 'Error al procesar la compra.', 'error');
        }
    } catch (e) {
        showMessage('Error de conexión al comprar.', 'error');
    }
}

// --- UI ---

function showMessage(text, type) {
    const box = document.getElementById('message-box');
    box.textContent = text;
    box.className = `message-box ${type}`;
    setTimeout(() => { box.className = 'message-box'; }, 4000);
}

function showRegister() {
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('register-form').style.display = 'block';
    document.getElementById('message-box').className = 'message-box';
}

function showLogin() {
    document.getElementById('login-form').style.display = 'block';
    document.getElementById('register-form').style.display = 'none';
    document.getElementById('message-box').className = 'message-box';
}

function showAuth() {
    document.getElementById('auth-section').style.display = 'block';
    document.getElementById('marketplace-section').style.display = 'none';
}

function showMarketplace() {
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('marketplace-section').style.display = 'block';
}