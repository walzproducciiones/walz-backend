// ==========================================
// CONFIGURACIÓN
// ==========================================
const API_URL = 'http://localhost:8000';
let token = null;
let user = null;

// ==========================================
// UTILIDADES
// ==========================================
function showMessage(elementId, text, type = 'success') {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.textContent = text;
    el.className = 'message ' + type;
    el.style.display = 'block';
}

function clearMessages() {
    document.querySelectorAll('.message').forEach(el => {
        el.textContent = '';
        el.className = 'message';
        el.style.display = 'none';
    });
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
    document.getElementById(screenId).style.display = 'block';
    clearMessages();
}

// ==========================================
// AUTENTICACIÓN
// ==========================================
function showRegister() {
    showScreen('registerScreen');
}

function showLogin() {
    showScreen('loginScreen');
}

async function register() {
    clearMessages();
    const email = document.getElementById('registerEmail').value.trim();
    const business = document.getElementById('registerBusiness').value.trim();
    const password = document.getElementById('registerPassword').value.trim();

    if (!email || !business || !password) {
        showMessage('registerMessage', '❌ Todos los campos son obligatorios', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, business_name: business })
        });

        const data = await response.json();
        if (response.ok) {
            showMessage('registerMessage', '✅ ¡Usuario creado! Ahora inicia sesión.', 'success');
            setTimeout(() => showLogin(), 1500);
        } else {
            showMessage('registerMessage', '❌ ' + (data.detail || 'Error al registrar'), 'error');
        }
    } catch (error) {
        showMessage('registerMessage', '❌ Error de conexión: ' + error.message, 'error');
    }
}

async function login() {
    clearMessages();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value.trim();

    if (!email || !password) {
        showMessage('loginMessage', '❌ Email y contraseña son obligatorios', 'error');
        return;
    }

    try {
        const formData = new URLSearchParams();
        formData.append('username', email);
        formData.append('password', password);

        const response = await fetch(`${API_URL}/api/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData
        });

        const data = await response.json();
        if (response.ok) {
            token = data.access_token;
            user = { id: data.user_id, email: email };
            document.getElementById('userName').textContent = email;
            showScreen('dashboardScreen');
            loadProducts();
        } else {
            showMessage('loginMessage', '❌ Credenciales incorrectas', 'error');
        }
    } catch (error) {
        showMessage('loginMessage', '❌ Error de conexión: ' + error.message, 'error');
    }
}

function logout() {
    token = null;
    user = null;
    showScreen('loginScreen');
}

// ==========================================
// PRODUCTOS
// ==========================================
async function loadProducts() {
    const list = document.getElementById('productList');
    list.innerHTML = '<p>Cargando productos...</p>';

    try {
        const response = await fetch(`${API_URL}/api/products`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            if (response.status === 401) {
                list.innerHTML = '<p style="color:red;">⚠️ Sesión expirada. Inicia sesión nuevamente.</p>';
                setTimeout(() => logout(), 2000);
                return;
            }
            throw new Error('Error al cargar productos');
        }

        const products = await response.json();
        if (products.length === 0) {
            list.innerHTML = '<p>📭 No tienes productos aún. ¡Crea el primero!</p>';
            return;
        }

        list.innerHTML = products.map(p => `
            <div class="product-card">
                <h4>${p.name}</h4>
                <div class="price">$ ${p.price}</div>
                <div class="stock">📦 Stock: ${p.stock}</div>
                <div style="font-size:0.8rem;color:#888;margin-top:4px;">${p.description || ''}</div>
            </div>
        `).join('');
    } catch (error) {
        list.innerHTML = '<p style="color:red;">❌ Error al cargar productos: ' + error.message + '</p>';
    }
}

async function createProduct() {
    clearMessages();
    const name = document.getElementById('productName').value.trim();
    const price = parseFloat(document.getElementById('productPrice').value);
    const description = document.getElementById('productDescription').value.trim();
    const stock = parseInt(document.getElementById('productStock').value) || 0;

    if (!name || isNaN(price) || price <= 0) {
        showMessage('productMessage', '❌ Nombre y precio válido son obligatorios', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/products`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name, price, description, stock })
        });

        const data = await response.json();
        if (response.ok) {
            showMessage('productMessage', '✅ ¡Producto creado!', 'success');
            // Limpiar campos
            document.getElementById('productName').value = '';
            document.getElementById('productPrice').value = '';
            document.getElementById('productDescription').value = '';
            document.getElementById('productStock').value = '';
            loadProducts(); // Recargar lista
        } else {
            showMessage('productMessage', '❌ ' + (data.detail || 'Error al crear producto'), 'error');
        }
    } catch (error) {
        showMessage('productMessage', '❌ Error de conexión: ' + error.message, 'error');
    }
}

// ==========================================
// INICIO: Mostrar pantalla de login
// ==========================================
showScreen('loginScreen');