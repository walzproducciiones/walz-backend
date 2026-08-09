const API_URL = 'https://walz-backend.onrender.com';

let token = localStorage.getItem('walz_token');
let cart = [];

// =====================================================
// AUTENTICACIÓN
// =====================================================

async function handleRegister() {
    const first_name = document.getElementById('reg-firstname').value.trim();
    const last_name = document.getElementById('reg-lastname').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;

    if (!email || !password || !first_name || !last_name) {
        showMessage('Completa todos los campos.', 'error');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email,
                first_name,
                last_name,
                password,
                role: 'COMPRADOR'
            })
        });

        const data = await res.json();

        if (res.ok) {
            showMessage('Cuenta creada. Inicia sesión.', 'success');
            showLogin();
        } else {
            showMessage(
                data.detail || 'Error al registrarse.',
                'error'
            );
        }

    } catch (e) {
        console.error('Error registro:', e);
        showMessage('Error de conexión.', 'error');
    }
}


async function handleLogin() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
        showMessage('Ingresa correo y contraseña.', 'error');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email,
                password
            })
        });

        const data = await res.json();

        if (res.ok) {

            token = data.access_token;

            localStorage.setItem(
                'walz_token',
                token
            );

            showMessage(
                'Bienvenido a WalZ!',
                'success'
            );

            showMarketplace();

            await loadProducts();

            updateCartUI();

        } else {

            showMessage(
                data.detail || 'Credenciales incorrectas.',
                'error'
            );
        }

    } catch (e) {

        console.error('Error login:', e);

        showMessage(
            'Error de conexión.',
            'error'
        );
    }
}


function handleLogout() {

    token = null;

    localStorage.removeItem('walz_token');

    cart = [];

    updateCartUI();

    showAuth();

    showMessage(
        'Sesión cerrada.',
        'success'
    );
}


// =====================================================
// PRODUCTOS
// =====================================================

async function handleCreateProduct() {

    token = localStorage.getItem('walz_token');

    console.log(
        '📤 Token enviado:',
        token
    );

    if (!token) {
        showMessage(
            'Debes iniciar sesión.',
            'error'
        );
        return;
    }

    const name =
        document.getElementById('prod-name').value.trim();

    const price =
        parseFloat(
            document.getElementById('prod-price').value
        );

    const stock =
        parseInt(
            document.getElementById('prod-stock').value
        );

    if (!name || isNaN(price) || isNaN(stock)) {

        showMessage(
            'Completa los datos.',
            'error'
        );

        return;
    }

    try {

        const res = await fetch(
            `${API_URL}/products/`,
            {
                method: 'POST',

                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },

                body: JSON.stringify({
                    name,
                    price,
                    stock,
                    category: ''
                })
            }
        );

        if (res.ok) {

            showMessage(
                'Producto publicado!',
                'success'
            );

            document.getElementById(
                'prod-name'
            ).value = '';

            document.getElementById(
                'prod-price'
            ).value = '';

            document.getElementById(
                'prod-stock'
            ).value = '';

            await loadProducts();

        } else {

            const text = await res.text();

            console.error(
                '❌ Error backend:',
                text
            );

            let message = 'Error al publicar.';

            try {
                const data = JSON.parse(text);
                message = data.detail || message;
            } catch (_) {}

            showMessage(
                message,
                'error'
            );
        }

    } catch (e) {

        console.error(
            '🚨 Error de red:',
            e
        );

        showMessage(
            'Error de conexión.',
            'error'
        );
    }
}


async function loadProducts() {

    try {

        const res = await fetch(
            `${API_URL}/products/`
        );

        if (!res.ok) {
            throw new Error(
                `HTTP ${res.status}`
            );
        }

        const products = await res.json();

        const list =
            document.getElementById(
                'product-list'
            );

        if (!list) {
            console.error(
                'No existe #product-list'
            );
            return;
        }

        list.innerHTML = '';

        if (
            !products ||
            products.length === 0
        ) {

            list.innerHTML =
                '<p style="color:#888;">No hay productos.</p>';

            return;
        }

        products.forEach(product => {

            const stockValue =
                Number(product.stock);

            const hasStock =
                stockValue > 0;

            list.innerHTML += `

                <div class="product-item">

                    <h4>
                        ${escapeHtml(product.name)}
                    </h4>

                    <p>
                        💰 $${product.price}
                        |
                        📦 Stock: ${stockValue}
                    </p>

                    <div class="product-actions">

                        ${
                            hasStock

                            ?

                            `
                            <input
                                type="number"
                                id="qty-${product.id}"
                                value="1"
                                min="1"
                                max="${stockValue}"
                                style="width:50px;"
                            >

                            <button
                                type="button"
                                onclick="addToCart(
                                    '${product.id}',
                                    '${escapeJs(product.name)}',
                                    ${Number(product.price)},
                                    ${stockValue}
                                )"
                            >
                                🛒 Agregar
                            </button>
                            `

                            :

                            `
                            <p
                                style="
                                    color:#ff4444;
                                    font-weight:bold;
                                "
                            >
                                Sin stock
                            </p>
                            `
                        }

                    </div>

                </div>
            `;
        });

    } catch (e) {

        console.error(
            'Error cargando productos:',
            e
        );
    }
}


// =====================================================
// CARRITO
// =====================================================

function addToCart(
    id,
    name,
    price,
    stock
) {

    console.log(
        '🛒 Agregando producto:',
        {
            id,
            name,
            price,
            stock
        }
    );

    const qtyInput =
        document.getElementById(
            `qty-${id}`
        );

    let qty = 1;

    if (qtyInput) {

        qty =
            parseInt(
                qtyInput.value
            ) || 1;
    }

    if (qty < 1) {
        qty = 1;
    }

    if (qty > stock) {

        showMessage(
            `Solo hay ${stock} unidades disponibles.`,
            'error'
        );

        return;
    }

    const existing =
        cart.find(
            item => item.id === id
        );

    if (existing) {

        if (
            existing.qty + qty > stock
        ) {

            showMessage(
                `No puedes agregar más de ${stock} unidades.`,
                'error'
            );

            return;
        }

        existing.qty += qty;

    } else {

        cart.push({
            id: id,
            name: name,
            price: Number(price),
            qty: qty,
            stock: stock
        });
    }

    console.log(
        '🛒 Carrito:',
        cart
    );

    showMessage(
        `✅ ${name} (x${qty}) agregado`,
        'success'
    );

    updateCartUI();
}


function updateCartUI() {

    const count =
        document.getElementById(
            'cart-count'
        );

    if (!count) {
        return;
    }

    const total =
        cart.reduce(
            (sum, item) =>
                sum + item.qty,
            0
        );

    count.textContent = total;
}


function toggleCart() {

    const section =
        document.getElementById(
            'cart-section'
        );

    if (!section) {
        console.error(
            'No existe #cart-section'
        );
        return;
    }

    const isHidden =
        section.style.display === 'none' ||
        section.style.display === '';

    if (isHidden) {

        section.style.display =
            'block';

        renderCart();

    } else {

        section.style.display =
            'none';
    }
}


function renderCart() {

    const container =
        document.getElementById(
            'cart-items'
        );

    const totalElement =
        document.getElementById(
            'cart-total'
        );

    if (!container) {
        console.error(
            'No existe #cart-items'
        );
        return;
    }

    container.innerHTML = '';

    let total = 0;

    if (cart.length === 0) {

        container.innerHTML =
            'Carrito vacío.';

        if (totalElement) {
            totalElement.textContent = '';
        }

        return;
    }

    cart.forEach(
        (item, index) => {

            const subtotal =
                item.price *
                item.qty;

            total += subtotal;

            container.innerHTML += `

                <div
                    style="
                        display:flex;
                        justify-content:space-between;
                        align-items:center;
                        background:#222;
                        padding:10px;
                        margin:5px 0;
                    "
                >

                    <span>
                        ${escapeHtml(item.name)}
                        x${item.qty}
                    </span>

                    <span>
                        $${subtotal.toFixed(2)}

                        <button
                            type="button"
                            onclick="removeFromCart(${index})"
                            style="background:#a00;"
                        >
                            X
                        </button>
                    </span>

                </div>
            `;
        }
    );

    if (totalElement) {

        totalElement.textContent =
            `Total: $${total.toFixed(2)}`;
    }
}


function removeFromCart(index) {

    if (
        index < 0 ||
        index >= cart.length
    ) {
        return;
    }

    cart.splice(
        index,
        1
    );

    renderCart();

    updateCartUI();
}


// =====================================================
// CHECKOUT
// =====================================================

async function checkout() {

    if (cart.length === 0) {

        showMessage(
            'El carrito está vacío.',
            'error'
        );

        return;
    }

    const token =
        localStorage.getItem(
            'walz_token'
        );

    if (!token) {

        showMessage(
            'Debes iniciar sesión para comprar.',
            'error'
        );

        return;
    }

    /*
     * IMPORTANTE:
     *
     * addToCart() guarda:
     *
     * id
     * name
     * price
     * qty
     *
     * Por eso checkout debe enviar:
     *
     * product_id: item.id
     * quantity: item.qty
     */

    const items =
        cart.map(item => ({
            product_id: item.id,
            quantity: item.qty
        }));

    console.log(
        '📦 Checkout:',
        items
    );

    try {

        const res =
            await fetch(
                `${API_URL}/orders/`,
                {
                    method: 'POST',

                    headers: {
                        'Content-Type':
                            'application/json',

                        'Authorization':
                            `Bearer ${token}`
                    },

                    body: JSON.stringify({
                        items: items,
                        shipping_address:
                            'Dirección de prueba'
                    })
                }
            );

        const text =
            await res.text();

        console.log(
            '📥 Respuesta checkout:',
            text
        );

        if (res.ok) {

            showMessage(
                '✅ ¡Compra realizada con éxito!',
                'success'
            );

            cart = [];

            renderCart();

            updateCartUI();

            await loadProducts();

        } else {

            let message =
                'Error al procesar la compra.';

            try {

                const data =
                    JSON.parse(text);

                message =
                    data.detail ||
                    message;

            } catch (_) {}

            console.error(
                '❌ Error checkout:',
                text
            );

            showMessage(
                message,
                'error'
            );
        }

    } catch (e) {

        console.error(
            '🚨 Error checkout:',
            e
        );

        showMessage(
            'Error de conexión al comprar.',
            'error'
        );
    }
}


// =====================================================
// UTILIDADES
// =====================================================

function escapeHtml(value) {

    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}


function escapeJs(value) {

    return String(value)
        .replaceAll('\\', '\\\\')
        .replaceAll("'", "\\'")
        .replaceAll('"', '\\"')
        .replaceAll('\n', '\\n')
        .replaceAll('\r', '\\r');
}


// =====================================================
// MENSAJES
// =====================================================

function showMessage(
    text,
    type
) {

    const box =
        document.getElementById(
            'message-box'
        );

    if (!box) {
        console.log(text);
        return;
    }

    box.textContent = text;

    box.className =
        `message-box ${type}`;

    setTimeout(
        () => {
            box.className =
                'message-box';
        },
        4000
    );
}


// =====================================================
// UI AUTENTICACIÓN
// =====================================================

function showRegister() {

    document.getElementById(
        'login-form'
    ).style.display = 'none';

    document.getElementById(
        'register-form'
    ).style.display = 'block';

    document.getElementById(
        'message-box'
    ).className = 'message-box';
}


function showLogin() {

    document.getElementById(
        'login-form'
    ).style.display = 'block';

    document.getElementById(
        'register-form'
    ).style.display = 'none';

    document.getElementById(
        'message-box'
    ).className = 'message-box';
}


function showAuth() {

    document.getElementById(
        'auth-section'
    ).style.display = 'block';

    document.getElementById(
        'marketplace-section'
    ).style.display = 'none';
}


function showMarketplace() {

    document.getElementById(
        'auth-section'
    ).style.display = 'none';

    document.getElementById(
        'marketplace-section'
    ).style.display = 'block';
}