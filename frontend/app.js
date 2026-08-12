const API_URL = "https://walz-backend.onrender.com";

let token = localStorage.getItem("walz_token");
let cart = [];

// =====================================================
// AUTENTICACIÓN
// =====================================================

async function handleRegister() {
    const first_name = document.getElementById("reg-firstname").value.trim();
    const last_name = document.getElementById("reg-lastname").value.trim();
    const email = document.getElementById("reg-email").value.trim();
    const password = document.getElementById("reg-password").value;

    if (!email || !password || !first_name || !last_name) {
        showMessage("Completa todos los campos.", "error");
        return;
    }

    try {
        const res = await fetch(`${API_URL}/auth/register`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email,
                first_name,
                last_name,
                password,
                role: "COMPRADOR"
            })
        });

        const data = await res.json();

        if (res.ok) {
            showMessage("Cuenta creada. Inicia sesión.", "success");
            showLogin();
        } else {
            showMessage(
                data.detail || "Error al registrarse.",
                "error"
            );
        }

    } catch (e) {
        console.error("Error registro:", e);
        showMessage("Error de conexión.", "error");
    }
}


async function handleLogin() {
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;

    if (!email || !password) {
        showMessage("Ingresa correo y contraseña.", "error");
        return;
    }

    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email,
                password
            })
        });

        const data = await res.json();

        console.log("Respuesta login:", data);

        if (res.ok) {

            token = data.access_token;

            localStorage.setItem(
                "walz_token",
                token
            );

            showMessage(
                "Bienvenido a WalZ!",
                "success"
            );

            showMarketplace();

            await loadProducts();

            updateCartUI();

        } else {

            showMessage(
                data.detail || "Credenciales incorrectas.",
                "error"
            );
        }

    } catch (e) {

        console.error(
            "Error al iniciar sesión:",
            e
        );

        showMessage(
            "Error de conexión.",
            "error"
        );
    }
}


function handleLogout() {

    token = null;

    localStorage.removeItem("walz_token");

    cart = [];

    updateCartUI();

    showAuth();

    showMessage(
        "Sesión cerrada.",
        "success"
    );
}


// =====================================================
// PRODUCTOS
// =====================================================

async function handleCreateProduct() {

    token = localStorage.getItem("walz_token");

    console.log(
        "Token enviado:",
        token
    );

    if (!token) {
        showMessage(
            "Debes iniciar sesión.",
            "error"
        );
        return;
    }

    const name =
        document.getElementById("prod-name").value.trim();

    const price =
        parseFloat(
            document.getElementById("prod-price").value
        );

    const stock =
        parseInt(
            document.getElementById("prod-stock").value
        );

    if (!name || isNaN(price) || isNaN(stock)) {

        showMessage(
            "Completa los datos.",
            "error"
        );

        return;
    }

    try {

        const res = await fetch(
            `${API_URL}/products/`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },

                body: JSON.stringify({
                    name,
                    price,
                    stock,
                    category: ""
                })
            }
        );

        const text = await res.text();

        console.log(
            "Respuesta creación producto:",
            text
        );

        if (res.ok) {

            showMessage(
                "Producto publicado!",
                "success"
            );

            document.getElementById(
                "prod-name"
            ).value = "";

            document.getElementById(
                "prod-price"
            ).value = "";

            document.getElementById(
                "prod-stock"
            ).value = "";

            await loadProducts();

        } else {

            let message = "Error al publicar.";

            try {
                const data = JSON.parse(text);
                message = data.detail || message;
            } catch (_) {}

            showMessage(
                message,
                "error"
            );
        }

    } catch (e) {

        console.error(
            "Error de red:",
            e
        );

        showMessage(
            "Error de conexión.",
            "error"
        );
    }
}


// =====================================================
// CARGAR PRODUCTOS
// =====================================================


async function loadProducts() {

    try {

        const res = await fetch(
            `${API_URL}/products/`
        );

        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }

        const products = await res.json();

        // Guardamos los productos originales
        window.walzProducts = products;

        // Mostramos todos los productos
        renderProducts(products);

    } catch (e) {

        console.error(
            "Error cargando productos:",
            e
        );
    }
}


// =====================================================
// MOSTRAR PRODUCTOS
// =====================================================

// =====================================================
// MOSTRAR PRODUCTOS
// =====================================================

function renderProducts(products) {

    const list =
        document.getElementById(
            "product-list"
        );

    if (!list) {

        console.error(
            "No existe #product-list"
        );

        return;
    }

    list.innerHTML = "";

    if (
        !products ||
        products.length === 0
    ) {

        list.innerHTML =
            '<p style="color:#888;">No se encontraron productos.</p>';

        return;
    }


    products.forEach(product => {

        const stockValue =
            Number(product.stock);

        const hasStock =
            stockValue > 0;


        list.innerHTML += `

            <div
                class="product-item"
                onclick="openProductDetail('${product.id}')"
            >

                <div class="product-card-content">

                    <h4>
                        ${escapeHtml(product.name)}
                    </h4>

                    <p class="product-price">
                        💰 $${Number(product.price).toFixed(2)}
                    </p>

                    <p class="product-stock">
                        📦 Stock: ${stockValue}
                    </p>

                </div>


                <div
                    class="product-actions"
                    onclick="event.stopPropagation()"
                >

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
                        >

                        <button
                            type="button"
                            onclick="
                                addToCart(
                                    '${product.id}',
                                    '${escapeJs(product.name)}',
                                    ${Number(product.price)},
                                    ${stockValue}
                                )
                            "
                        >
                            🛒 Agregar
                        </button>
                        `

                        :

                        `
                        <p class="no-stock">
                            Sin stock
                        </p>
                        `
                    }

                </div>

            </div>
        `;
    });
}

// =====================================================
// FILTROS DE PRODUCTOS
// =====================================================

function filterProducts() {

    const products =
        window.walzProducts || [];

    const search =
        document.getElementById("product-search")
            ?.value
            .trim()
            .toLowerCase() || "";

    const minPrice =
        parseFloat(
            document.getElementById("price-min")?.value
        );

    const maxPrice =
        parseFloat(
            document.getElementById("price-max")?.value
        );

    const filteredProducts =
        products.filter(product => {

            const name =
                String(product.name || "")
                    .toLowerCase();

            const price =
                Number(product.price || 0);

            if (
                search &&
                !name.includes(search)
            ) {
                return false;
            }

            if (
                !isNaN(minPrice) &&
                price < minPrice
            ) {
                return false;
            }

            if (
                !isNaN(maxPrice) &&
                price > maxPrice
            ) {
                return false;
            }

            return true;
        });

    renderProducts(filteredProducts);
}


// =====================================================
// LIMPIAR FILTROS
// =====================================================

function clearProductFilters() {

    const search =
        document.getElementById(
            "product-search"
        );

    const minPrice =
        document.getElementById(
            "price-min"
        );

    const maxPrice =
        document.getElementById(
            "price-max"
        );

    if (search) {
        search.value = "";
    }

    if (minPrice) {
        minPrice.value = "";
    }

    if (maxPrice) {
        maxPrice.value = "";
    }

    renderProducts(
        window.walzProducts || []
    );
}


// =====================================================
// ABRIR FICHA DEL PRODUCTO
// =====================================================

function openProductDetail(productId) {

    console.log(
        "🔎 FICHA PRODUCTO:",
        productId
    );

    const products =
        window.walzProducts || [];

    const product =
        products.find(
            item => item.id === productId
        );

    if (!product) {

        console.error(
            "Producto no encontrado:",
            productId
        );

        return;
    }

    const modal =
        document.getElementById(
            "product-detail-modal"
        );

    if (!modal) {

        console.error(
            "No existe #product-detail-modal"
        );

        return;
    }

    const nameElement =
        document.getElementById(
            "detail-product-name"
        );

    const priceElement =
        document.getElementById(
            "detail-product-price"
        );

    const stockElement =
        document.getElementById(
            "detail-product-stock"
        );

    if (nameElement) {

        nameElement.textContent =
            product.name;
    }

    if (priceElement) {

        priceElement.textContent =
            `$${Number(product.price).toFixed(2)}`;
    }

    if (stockElement) {

        stockElement.textContent =
            product.stock > 0
                ? `📦 Stock disponible: ${product.stock}`
                : "Sin stock";
    }

    modal.dataset.productId =
        product.id;

    modal.style.display =
        "flex";
}


// =====================================================
// CERRAR FICHA
// =====================================================

function closeProductDetail() {

    const modal =
        document.getElementById(
            "product-detail-modal"
        );

    if (!modal) {
        return;
    }

    modal.style.display =
        "none";
}


// =====================================================
// AGREGAR AL CARRITO
// =====================================================



// =====================================================
// AGREGAR AL CARRITO
// =====================================================

function addToCart(
    id,
    name,
    price,
    stock
) {

    console.log("🛒 AGREGAR PRESIONADO");
    console.log("ID:", id);
    console.log("Nombre:", name);
    console.log("Precio:", price);
    console.log("Stock:", stock);

    const qtyInput =
        document.getElementById(`qty-${id}`);

    const qty =
        parseInt(qtyInput?.value) || 1;

    if (qty < 1) {

        showMessage(
            "La cantidad debe ser mayor a 0.",
            "error"
        );

        return;
    }

    const existing =
        cart.find(
            item => item.id === id
        );

    if (existing) {

        if (
            existing.qty + qty > existing.stock
        ) {

            showMessage(
                `No puedes agregar más de ${existing.stock} unidades.`,
                "error"
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
            stock: Number(stock)
        });
    }

    console.log(
        "🛒 CARRITO ACTUAL:",
        cart
    );

    showMessage(
        `✅ ${name} (x${qty}) agregado`,
        "success"
    );

    updateCartUI();

    // Si el carrito está abierto,
    // actualizarlo inmediatamente.
    const cartSection =
        document.getElementById(
            "cart-section"
        );

    if (
        cartSection &&
        cartSection.style.display !== "none"
    ) {
        renderCart();
    }
}


// =====================================================
// ACTUALIZAR CONTADOR
// =====================================================

function updateCartUI() {

    const count =
        document.getElementById(
            "cart-count"
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


// =====================================================
// ABRIR / CERRAR CARRITO
// =====================================================

function toggleCart() {

    const section =
        document.getElementById(
            "cart-section"
        );

    if (!section) {

        console.error(
            "No existe #cart-section"
        );

        return;
    }

    const isHidden =
        section.style.display === "none" ||
        section.style.display === "";

    if (isHidden) {

        section.style.display = "block";

        renderCart();

    } else {

        section.style.display = "none";
    }
}


// =====================================================
// MOSTRAR CARRITO
// =====================================================

function renderCart() {

    const container =
        document.getElementById(
            "cart-items"
        );

    const totalElement =
        document.getElementById(
            "cart-total"
        );

    if (!container) {

        console.error(
            "No existe #cart-items"
        );

        return;
    }

    container.innerHTML = "";

    let total = 0;


    // -------------------------------------------------
    // CARRITO VACÍO
    // -------------------------------------------------

    if (cart.length === 0) {

        container.innerHTML = `
            <div class="cart-empty">
                🛒 Carrito vacío.
            </div>
        `;

        if (totalElement) {

            totalElement.textContent =
                "Total: $0.00";
        }

        return;
    }


    // -------------------------------------------------
    // PRODUCTOS
    // -------------------------------------------------

    cart.forEach(
        (item, index) => {

            const subtotal =
                item.price * item.qty;

            total += subtotal;


            container.innerHTML += `

                <div class="cart-item">

                    <div class="cart-item-info">

                        <strong>
                            ${escapeHtml(item.name)}
                        </strong>

                        <span>
                            $${item.price.toFixed(2)}
                            c/u
                        </span>

                    </div>


                    <div class="cart-item-controls">

                        <button
                            type="button"
                            onclick="decreaseCartItem(${index})"
                        >
                            −
                        </button>


                        <span class="cart-qty">
                            ${item.qty}
                        </span>


                        <button
                            type="button"
                            onclick="increaseCartItem(${index})"
                        >
                            +
                        </button>


                        <span class="cart-subtotal">
                            $${subtotal.toFixed(2)}
                        </span>


                        <button
                            type="button"
                            onclick="removeFromCart(${index})"
                            class="cart-remove"
                        >
                            🗑️
                        </button>

                    </div>

                </div>
            `;
        }
    );


    // -------------------------------------------------
    // TOTAL
    // -------------------------------------------------

    if (totalElement) {

        totalElement.textContent =
            `Total: $${total.toFixed(2)}`;
    }
}


// =====================================================
// AUMENTAR CANTIDAD
// =====================================================

function increaseCartItem(index) {

    if (
        index < 0 ||
        index >= cart.length
    ) {
        return;
    }

    const item = cart[index];

    if (item.qty >= item.stock) {

        showMessage(
            `No puedes agregar más de ${item.stock} unidades de ${item.name}.`,
            "error"
        );

        return;
    }

    item.qty++;

    updateCartUI();

    renderCart();
}


// =====================================================
// DISMINUIR CANTIDAD
// =====================================================

function decreaseCartItem(index) {

    if (
        index < 0 ||
        index >= cart.length
    ) {
        return;
    }

    const item = cart[index];

    if (item.qty > 1) {

        item.qty--;

    } else {

        cart.splice(index, 1);
    }

    updateCartUI();

    renderCart();
}


// =====================================================
// ELIMINAR DEL CARRITO
// =====================================================

function removeFromCart(index) {

    if (
        index < 0 ||
        index >= cart.length
    ) {
        return;
    }

    const item =
        cart[index];

    cart.splice(index, 1);

    showMessage(
        `🗑️ ${item.name} eliminado del carrito.`,
        "success"
    );

    updateCartUI();

    renderCart();
}


// =====================================================
// CHECKOUT
// =====================================================

async function checkout() {

    if (cart.length === 0) {
        showMessage('El carrito está vacío.', 'error');
        return;
    }

    const token = localStorage.getItem('walz_token');

    console.log("🛒 CHECKOUT");
    console.log("Token existe:", !!token);
    console.log("Token:", token);

    if (!token) {
        showMessage('Debes iniciar sesión para comprar.', 'error');
        return;
    }

    const items = cart.map(item => ({
        product_id: item.id,
        quantity: item.qty
    }));

    console.log("📦 Items enviados:", items);

    try {

        const res = await fetch(`${API_URL}/orders/`, {
            method: 'POST',

            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },

            body: JSON.stringify({
                items: items,
                shipping_address: 'Dirección de prueba'
            })
        });

        const text = await res.text();

        console.log("📥 RESPUESTA CHECKOUT");
        console.log("HTTP:", res.status);
        console.log("Respuesta:", text);

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

            let message = 'Error al procesar la compra.';

            try {
                const data = JSON.parse(text);
                message = data.detail || message;
            } catch (_) {}

            console.error(
                '❌ Error checkout:',
                res.status,
                text
            );

            showMessage(message, 'error');
        }

    } catch (e) {

        console.error(
            '🚨 Error de conexión checkout:',
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
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


function escapeJs(value) {

    return String(value)
        .replaceAll("\\", "\\\\")
        .replaceAll("'", "\\'")
        .replaceAll("\n", "\\n")
        .replaceAll("\r", "\\r");
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
            "message-box"
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
                "message-box";

        },
        4000
    );
}


// =====================================================
// UI AUTENTICACIÓN
// =====================================================

function showRegister() {

    document.getElementById(
        "login-form"
    ).style.display = "none";

    document.getElementById(
        "register-form"
    ).style.display = "block";

    document.getElementById(
        "message-box"
    ).className = "message-box";
}


function showLogin() {

    document.getElementById(
        "login-form"
    ).style.display = "block";

    document.getElementById(
        "register-form"
    ).style.display = "none";

    document.getElementById(
        "message-box"
    ).className = "message-box";
}


function showAuth() {

    document.getElementById(
        "auth-section"
    ).style.display = "block";

    document.getElementById(
        "marketplace-section"
    ).style.display = "none";
}


function showMarketplace() {

    document.getElementById(
        "auth-section"
    ).style.display = "none";

    document.getElementById(
        "marketplace-section"
    ).style.display = "block";
}


// =====================================================
// HACER FUNCIONES GLOBALES
// NECESARIO PARA onclick="..."
// =====================================================

window.handleRegister = handleRegister;
window.handleLogin = handleLogin;
window.handleLogout = handleLogout;
window.handleCreateProduct = handleCreateProduct;

window.loadProducts = loadProducts;

window.addToCart = addToCart;
window.updateCartUI = updateCartUI;
window.toggleCart = toggleCart;
window.renderCart = renderCart;
window.removeFromCart = removeFromCart;
window.checkout = checkout;

window.showMessage = showMessage;

window.showRegister = showRegister;
window.showLogin = showLogin;
window.showAuth = showAuth;
window.showMarketplace = showMarketplace;


// =====================================================
// INICIO
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        console.log(
            "✅ WalZ app.js cargado correctamente"
        );

        console.log(
            "Token:",
            token ? "EXISTE" : "NO EXISTE"
        );

        updateCartUI();

        if (token) {

            showMarketplace();

            loadProducts();

        } else {

            showAuth();
        }
    }
);
