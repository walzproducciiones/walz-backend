const API_URL = 'https://walz-backend.onrender.com';
let token = null;
let cart = [];

// --- FUNCIONES DE AUTENTICACIÓN ---

async function handleRegister() {
    const first_name = document.getElementById('reg-firstname').value;
    const last_name = document.getElementById('reg-lastname').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;

    if(!email || !password || !first_name || !last_name) {
        showMessage('Por favor completa todos los campos.', 'error');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, first_name, last_name, password, role: 'COMPRADOR', phone: '' })
        });
        const data = await res.json();
        if(res.ok) {
            showMessage('¡Cuenta creada con éxito! Ahora inicia sesión.', 'success');
            showLogin();
        } else {
            showMessage(data.detail || 'Error al registrarse.', 'error');
        }
    } catch(e) {
        showMessage('Error de conexión con el servidor.', 'error');
    }
}

async function handleLogin() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    if(!email || !password) {
        showMessage('Por favor ingresa tu correo y contraseña.', 'error');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if(res.ok) {
            token = data.access_token;
            localStorage.setItem('walz_token', token);
            showMessage('¡Bienvenido a WalZ!', 'success');
            showMarketplace();
            loadProducts();
        } else {
            showMessage(data.detail || 'Credenciales incorrectas.', 'error');
        }
    } catch(e) {
        showMessage('Error de conexión con el servidor.', 'error');
    }
}

function handleLogout() {
    token = null;
    localStorage.removeItem('walz_token');
    cart = [];
    showAuth();
    showMessage('Sesión cerrada.', 'success');
}

// --- FUNCIONES DEL MARKETPLACE ---

async function handleCreateProduct() {
    token = localStorage.getItem('walz_token');
    const name = document.getElementById('prod-name').value;
    const price = parseFloat(document.getElementById('prod-price').value);
    const stock = parseInt(document.getElementById('prod-stock').value);

    if(!name || isNaN(price) || isNaN(stock)) {
        showMessage('Completa los datos del producto.', 'error');
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
        if(res.ok) {
            showMessage('¡Producto publicado con éxito!', 'success');
            document.getElementById('prod-name').value = '';
            document.getElementById('prod-price').value = '';
            document.getElementById('prod-stock').value = '';
            loadProducts();
        } else {
            const data = await res.json();
            showMessage(data.detail || 'Error al publicar el producto.', 'error');
        }
    } catch(e) {
        showMessage('Error de conexión.', 'error');
    }
}

async function loadProducts() {
    try {
        const res = await fetch(`${API_URL}/products/`);
        const products = await res.json();
        const list = document.getElementById('product-list');
        list.innerHTML = '';
        
        if(products.length === 0) {
            list.innerHTML = '<p style="color: #888;">Aún no hay productos publicados.</p>';
            return;
        }

        products.forEach(p => {
            list.innerHTML += `
                <div class="product-item">
                    <div class="product-info">
                        <h4>${p.name}</h4>
                        <p>💰 $${p.price} | 📦 Stock: ${p.stock}</p>
                    </div>
                    <div class="product-actions">
                        <input type="number" id="qty-${p.id}" value="1" min="1" max="${p.stock}" style="width: 50px; padding: 5px; margin-right: 5px;">
                        <button onclick="addToCart('${p.id}', '${p.name}', ${p.price})" class="buy-btn">🛒 Agregar</button>
                    </div>
                </div>
            `;
        });
    } catch(e) {
        console.error('Error cargando productos:', e);
    }
}

// --- CARRITO DE COMPRAS ---

function addToCart(productId, productName, price) {
    console.log("🛒 CLICK DETECTADO para:", productName);
    const qtyInput = document.getElementById(`qty-${productId}`);
    const quantity = parseInt(qtyInput.value);

    if(!quantity || quantity < 1) {
        showMessage('Selecciona una cantidad válida.', 'error');
        return;
    }

    const existingItem = cart.find(item => item.productId === productId);
    if(existingItem) {
        existingItem.quantity += quantity;
    } else {
        cart.push({ productId, productName, price, quantity });
    }

    showMessage(`✅ ${productName} (x${quantity}) agregado al carrito`, 'success');
    updateCartUI();
}

function updateCartUI() {
    const cartCount = document.getElementById('cart-count');
    if(cartCount) {
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
        cartCount.textContent = totalItems;
    }
}

function toggleCart() {
    const cartSection = document.getElementById('cart-section');
    if(cartSection.style.display === 'none') {
        cartSection.style.display = 'block';
        renderCartItems();
    } else {
        cartSection.style.display = 'none';
    }
}

function renderCartItems() {
    const container = document.getElementById('cart-items');
    container.innerHTML = '';
    let total = 0;

    if(cart.length === 0) {
        container.innerHTML = '<p style="color: #888;">El carrito está vacío.</p>';
        document.getElementById('cart-total').textContent = '';
        return;
    }

    cart.forEach((item, index) => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        container.innerHTML += `
            <div class="product-item" style="display: flex; justify-content: space-between;">
                <div>
                    <strong>${item.productName}</strong> (x${item.quantity})
                </div>
                <div>
                    $${itemTotal}
                    <button onclick="removeFromCart(${index})" style="width: auto; padding: 2px 8px; background: #aa0000;">X</button>
                </div>
            </div>
        `;
    });

    document.getElementById('cart-total').textContent = `Total: $${total}`;
}

function removeFromCart(index) {
    cart.splice(index, 1);
    renderCartItems();
    updateCartUI();
}

async function checkout() {
    if(cart.length === 0) {
        showMessage('El carrito está vacío.', 'error');
        return;
    }

    token = localStorage.getItem('walz_token');
    const firstItem = cart[0];

    try {
        const res = await fetch(`${API_URL}/orders/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                items: [{ product_id: firstItem.productId, quantity: firstItem.quantity }],
                shipping_address: "Dirección de prueba"
            })
        });

        if(res.ok) {
            showMessage(`✅ Compra de ${firstItem.productName} realizada con éxito!`, 'success');
            cart = [];
            renderCartItems();
            updateCartUI();
            loadProducts();
            toggleCart();
        } else {
            const data = await res.json();
            showMessage(data.detail || 'Error al procesar la compra.', 'error');
        }
    } catch(e) {
        showMessage('Error de conexión al comprar.', 'error');
    }
}

// --- FUNCIONES DE UI ---

function showMessage(text, type) {
    const box = document.getElementById('message-box');
    box.textContent = text;
    box.className = `message-box ${type}`;
    setTimeout(() => { box.className = 'message-box'; }, 5000);
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