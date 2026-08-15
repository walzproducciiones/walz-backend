const API_URL = window.location.origin;

let token = localStorage.getItem("walz_token");
let currentUserId = localStorage.getItem("walz_user_id");
let currentUserRole = localStorage.getItem("walz_user_role") || "";

let cart = loadCart();
let pendingCheckout = null;

function getCartStorageKey() {
    return currentUserId
        ? `walz_cart_${currentUserId}`
        : null;
}

function loadCart() {
    try {
        const cartStorageKey = getCartStorageKey();

        if (!cartStorageKey) {
            return [];
        }

        const savedCart = localStorage.getItem(cartStorageKey);

        if (!savedCart) {
            return [];
        }

        const parsedCart = JSON.parse(savedCart);

        return Array.isArray(parsedCart)
            ? parsedCart
            : [];

    } catch (error) {
        console.error("Error recuperando carrito:", error);
        return [];
    }
}

function saveCart() {
    try {
        const cartStorageKey = getCartStorageKey();

        if (!cartStorageKey) {
            return;
        }

        localStorage.setItem(
            cartStorageKey,
            JSON.stringify(cart)
        );
    } catch (error) {
        console.error("Error guardando carrito:", error);
    }
}

function clearCartStorage() {
    const cartStorageKey = getCartStorageKey();

    if (cartStorageKey) {
        localStorage.removeItem(cartStorageKey);
    }
}

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

            currentUserId = data.user.id;
            localStorage.setItem("walz_user_id", currentUserId);
            currentUserRole = String(data.user.role || "").toUpperCase();
            localStorage.setItem("walz_user_role", currentUserRole);
            updateAdminBannerVisibility();
            cart = loadCart();

            showMessage(
                "Bienvenido a WalZ!",
                "success"
            );

            showMarketplace();

            await loadProducts();

            updateCartUI();
        document.body.classList.add("has-walz-news-bar");

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

    currentUserId = null;

    localStorage.removeItem("walz_user_id");
    currentUserRole = "";
    localStorage.removeItem("walz_user_role");
    updateAdminBannerVisibility();

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

    const category =
        document.getElementById("prod-category").value.trim();

    const description =
        document.getElementById("prod-description").value.trim();

    const imageUrl =
        document.getElementById("prod-image-url").value.trim();

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
                    category: category || null,
                    description: description || null,
                    image_url: imageUrl || null
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

            document.getElementById("prod-category").value = "";
            document.getElementById("prod-description").value = "";
            document.getElementById("prod-image-url").value = "";

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

        window.walzProducts = products;

        syncCartWithProducts(products);

        renderProducts(products);

    } catch (e) {

        console.error(
            "Error cargando productos:",
            e
        );
    }
}


function syncCartWithProducts(products) {

    if (!Array.isArray(products)) {
        return;
    }

    const productsById = new Map(
        products.map(product => [
            String(product.id),
            product
        ])
    );

    let cartChanged = false;

    const synchronizedCart = cart.reduce(
        (result, item) => {

            const product =
                productsById.get(String(item.id));

            if (!product) {
                cartChanged = true;
                return result;
            }

            const currentStock =
                Number(product.stock || 0);

            if (currentStock <= 0) {
                cartChanged = true;
                return result;
            }

            const synchronizedItem = {
                ...item,
                name: product.name,
                price: getProductEffectivePrice(product),
                stock: currentStock,
                qty: Math.min(
                    Number(item.qty || 1),
                    currentStock
                )
            };

            if (
                synchronizedItem.name !== item.name ||
                synchronizedItem.price !== Number(item.price) ||
                synchronizedItem.stock !== Number(item.stock) ||
                synchronizedItem.qty !== Number(item.qty)
            ) {
                cartChanged = true;
            }

            result.push(synchronizedItem);

            return result;
        },
        []
    );

    if (!cartChanged) {
        return;
    }

    cart = synchronizedCart;

    saveCart();
    updateCartUI();

    const cartSection =
        document.getElementById("cart-section");

    if (
        cartSection &&
        cartSection.style.display !== "none"
    ) {
        renderCart();
    }
}

// =====================================================
// MOSTRAR PRODUCTOS
// =====================================================

// =====================================================
// MOSTRAR PRODUCTOS
// =====================================================

function getProductImageUrl(value) {
    const url = String(value || "").trim();
    return /^https?:\/\//i.test(url) ? url : "";
}

function renderProductImage(value, altText, className) {
    const url = getProductImageUrl(value);
    if (!url) return `<div class="${className} product-image-placeholder">Sin imagen</div>`;
    return `<img class="${className}" src="${escapeHtml(url)}" alt="${escapeHtml(altText || "Producto")}" loading="lazy" onerror="this.outerHTML='<div class=&quot;${className} product-image-placeholder&quot;>Imagen no disponible</div>'">`;
}

function hasActiveProductOffer(product) {
    const normalPrice = Number(product?.price || 0);
    const offerPrice = Number(product?.offer_price || 0);
    return Boolean(product?.offer_active) && offerPrice > 0 && offerPrice < normalPrice;
}

function getProductEffectivePrice(product) {
    return hasActiveProductOffer(product)
        ? Number(product.offer_price)
        : Number(product.price || 0);
}

function renderProductPrice(product) {
    const normalPrice = Number(product?.price || 0);
    const effectivePrice = getProductEffectivePrice(product);

    if (hasActiveProductOffer(product)) {
        return `
            <span class="product-normal-price">$${normalPrice.toFixed(2)}</span>
            <span class="product-offer-price">$${effectivePrice.toFixed(2)}</span>
            <span class="product-offer-badge">Oferta</span>
        `;
    }

    return `<span class="product-current-price">$${normalPrice.toFixed(2)}</span>`;
}


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

                ${renderProductImage(product.image_url, product.name, "product-card-image")}

                <div class="product-card-content">

                    <h4>
                        ${escapeHtml(product.name)}
                    </h4>

                    <p class="product-price">${renderProductPrice(product)}</p>

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
                                    ${getProductEffectivePrice(product)},
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
                getProductEffectivePrice(product);

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

    const imageContainer = document.getElementById("detail-product-image-container");
    if (imageContainer) {
        imageContainer.innerHTML = renderProductImage(product.image_url, product.name, "detail-product-image");
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
        priceElement.innerHTML = renderProductPrice(product);
    }

    if (stockElement) {

        stockElement.textContent =
            product.stock > 0
                ? `📦 Stock disponible: ${product.stock}`
                : "Sin stock";
    }

    const categoryElement = document.getElementById("detail-product-category");
    const descriptionElement = document.getElementById("detail-product-description-text");

    if (categoryElement) {
        categoryElement.textContent = product.category
            ? `Categoria: ${product.category}`
            : "";
    }

    if (descriptionElement) {
        descriptionElement.textContent = product.description || "Producto disponible en WalZ.";
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
    saveCart();

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
        document.body.classList.add("cart-panel-open");

        renderCart();

    } else {

        section.style.display = "none";
        document.body.classList.remove("cart-panel-open");
    }
}


// =====================================================
// MIS PEDIDOS
// =====================================================

function showMyOrders() {
    hideBannerAdminSection();

    const marketplaceContent =
        document.getElementById("marketplace-content");

    const ordersSection =
        document.getElementById("orders-section");

    if (!marketplaceContent || !ordersSection) {
        console.error("No existe la sección de pedidos.");
        return;
    }

    marketplaceContent.style.display = "none";
    ordersSection.style.display = "block";

    const salesOrdersSection =
        document.getElementById("sales-orders-section");

    if (salesOrdersSection) {
        salesOrdersSection.style.display = "none";
    }

    loadMyOrders();
}


function showMarketplaceContent() {

    const marketplaceContent =
        document.getElementById("marketplace-content");

    const ordersSection =
        document.getElementById("orders-section");

    if (marketplaceContent) {
        marketplaceContent.style.display = "block";
    }

    if (ordersSection) {
        ordersSection.style.display = "none";
    }

    const salesOrdersSection =
        document.getElementById("sales-orders-section");

    if (salesOrdersSection) {
        salesOrdersSection.style.display = "none";
    }
    const myProductsSection =
        document.getElementById("my-products-section");

    if (myProductsSection) {
        myProductsSection.style.display = "none";
    }
    hideBannerAdminSection();
    loadProducts();
    loadActiveBanners();
}


async function loadMyOrders() {

    const container =
        document.getElementById("orders-content");

    token = localStorage.getItem("walz_token");

    if (!container) {
        console.error("No existe #orders-content");
        return;
    }

    if (!token) {
        renderOrdersSessionExpired();
        return;
    }

    container.innerHTML = `
        <div class="orders-state-card orders-loading">
            Cargando pedidos...
        </div>
    `;

    try {
        const res = await fetch(`${API_URL}/orders/`, {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        if (res.status === 401) {
            renderOrdersSessionExpired();
            return;
        }

        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.detail || `HTTP ${res.status}`);
        }

        const orders = await res.json();

        renderMyOrders(orders);

    } catch (ordersError) {
        console.error("Error cargando pedidos:", ordersError);

        container.innerHTML = `
            <div class="orders-state-card orders-error">
                <h3>No pudimos cargar tus pedidos</h3>
                <p>Verifica la conexion e intenta nuevamente.</p>
                <button type="button" onclick="loadMyOrders()">
                    Reintentar
                </button>
            </div>
        `;
    }
}


function renderOrdersSessionExpired() {

    const container =
        document.getElementById("orders-content");

    if (!container) {
        return;
    }

    container.innerHTML = `
        <div class="orders-state-card orders-error">
            <h3>Tu sesion vencio</h3>
            <p>Inicia sesion nuevamente. Tu carrito permanece guardado.</p>
            <button type="button" onclick="handleLogout()">
                Ir al inicio de sesion
            </button>
        </div>
    `;
}


function getOrderStatusInfo(status) {

    const normalizedStatus =
        String(status || "pending").toLowerCase();

    const statuses = {
        pending: {
            label: "Pendiente",
            className: "order-status-pending"
        },
        paid: {
            label: "Confirmado",
            className: "order-status-paid"
        },
        shipped: {
            label: "Enviado / listo para retirar",
            className: "order-status-shipped"
        },
        delivered: {
            label: "Entregado",
            className: "order-status-delivered"
        },
        cancelled: {
            label: "Cancelado",
            className: "order-status-cancelled"
        }
    };

    return statuses[normalizedStatus] || {
        label: normalizedStatus,
        className: "order-status-unknown"
    };
}


function getOrderDeliveryMethod(shippingAddress) {

    const address = String(shippingAddress || "");

    if (address.includes("Metodo: Retiro en el local")) {
        return "Retiro en el local";
    }

    if (address.includes("Metodo: Envio a domicilio")) {
        return "Envio a domicilio";
    }

    return "Entrega no especificada";
}


function renderMyOrders(orders) {

    const container =
        document.getElementById("orders-content");

    if (!container) {
        return;
    }

    if (!Array.isArray(orders) || orders.length === 0) {
        container.innerHTML = `
            <div class="orders-state-card orders-empty">
                <h3>Todavia no realizaste pedidos</h3>
                <p>Cuando completes una compra aparecera en esta seccion.</p>
                <button type="button" onclick="showMarketplaceContent()">
                    Explorar productos
                </button>
            </div>
        `;
        return;
    }

    const sortedOrders = [...orders].sort(
        (first, second) =>
            new Date(second.created_at || 0) -
            new Date(first.created_at || 0)
    );

    container.innerHTML = `
        <div class="orders-list">
            ${sortedOrders.map(order => {
                const createdAt = order.created_at
                    ? new Date(order.created_at).toLocaleString("es-AR")
                    : "Fecha no disponible";

                const itemCount = Array.isArray(order.items)
                    ? order.items.reduce(
                        (total, item) =>
                            total + Number(item.quantity || 0),
                        0
                    )
                    : 0;

                const statusInfo =
                    getOrderStatusInfo(order.status);

                const deliveryMethod =
                    getOrderDeliveryMethod(order.shipping_address);

                return `
                    <article class="order-item order-card">
                        <div class="order-card-header">
                            <div>
                                <span class="order-card-label">Pedido</span>
                                <h3>#${escapeHtml(String(order.id))}</h3>
                            </div>
                            <span class="order-status ${statusInfo.className}">
                                ${escapeHtml(statusInfo.label)}
                            </span>
                        </div>

                        <div class="order-card-summary">
                            <div>
                                <span>Fecha</span>
                                <strong>${escapeHtml(createdAt)}</strong>
                            </div>
                            <div>
                                <span>Entrega</span>
                                <strong>${escapeHtml(deliveryMethod)}</strong>
                            </div>
                            <div>
                                <span>Articulos</span>
                                <strong>${itemCount}</strong>
                            </div>
                            <div>
                                <span>Total</span>
                                <strong>$${Number(order.total_amount || 0).toFixed(2)}</strong>
                            </div>
                        </div>

                        <button
                            type="button"
                            onclick="openOrderDetail('${escapeJs(String(order.id))}')"
                        >
                            Ver pedido
                        </button>
                    </article>
                `;
            }).join("")}
        </div>
    `;
}

async function openOrderDetail(orderId) {

    const container =
        document.getElementById("orders-content");

    token = localStorage.getItem("walz_token");

    if (!container || !token) {
        showMessage("Debes iniciar sesión para ver el pedido.", "error");
        return;
    }

    container.innerHTML =
        '<p class="orders-loading">Cargando detalle del pedido...</p>';

    try {

        const res = await fetch(`${API_URL}/orders/${orderId}`, {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        if (res.status === 401) {
            renderOrdersSessionExpired();
            return;
        }

        if (res.status === 404) {
            renderOrderNotFound();
            return;
        }

        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.detail || `HTTP ${res.status}`);
        }

        const order = await res.json();
        const items = Array.isArray(order.items) ? order.items : [];

        renderOrderDetail(order, items);

    } catch (e) {

        console.error("Error cargando detalle del pedido:", e);

        container.innerHTML = `
            <p class="orders-error">
                No se pudo cargar el detalle. Verificá tu conexión e intentá nuevamente.
            </p>
            <button type="button" onclick="openOrderDetail('${escapeJs(String(orderId))}')">
                Reintentar
            </button>
            <button type="button" onclick="loadMyOrders()">
                Volver a mis pedidos
            </button>
        `;
    }
}


function renderOrderDetail(order, items) {

    const container = document.getElementById("orders-content");

    if (!container) {
        return;
    }

    const createdAt = order.created_at
        ? new Date(order.created_at).toLocaleString("es-AR")
        : "Fecha no disponible";

    const address = order.shipping_address || "Dirección no disponible";

    const canCancel = String(order.status || '').toLowerCase() === 'pending';

    container.innerHTML = `
        <button type="button" onclick="loadMyOrders()">
            ← Volver a mis pedidos
        </button>
        <article class="order-detail-card">
            <h3>Pedido #${escapeHtml(String(order.id))}</h3>
            <dl class="order-summary">
                <div><dt>Estado</dt><dd>${escapeHtml(order.status || "Sin estado")}</dd></div>
                <div><dt>Fecha</dt><dd>${escapeHtml(createdAt)}</dd></div>
                <div><dt>Dirección de envío</dt><dd>${escapeHtml(address)}</dd></div>
            </dl>
            <h4>Productos</h4>
            <div class="order-detail-items">
                ${items.map(item => {
                    const quantity = Number(item.quantity || 0);
                    const price = Number(item.price_at_purchase || 0);
                    const subtotal = quantity * price;

                    return `
                        <article class="order-detail-item">
                            <strong>${escapeHtml(item.product?.name || "Producto")}</strong>
                            <span>Cantidad: ${quantity}</span>
                            <span>Precio unitario: $${price.toFixed(2)}</span>
                            <strong>Subtotal: $${subtotal.toFixed(2)}</strong>
                        </article>
                    `;
                }).join("") || "<p>Este pedido no tiene artículos.</p>"}
            </div>
            <h3 class="order-total">Total: $${Number(order.total_amount || 0).toFixed(2)}</h3>
            ${canCancel ? `
                <div class="order-cancel-actions">
                    <button
                        type="button"
                        class="order-cancel-button"
                        onclick="cancelPendingOrder('${escapeJs(String(order.id))}')"
                    >
                        Cancelar pedido
                    </button>
                    <p>Al cancelar, las unidades volveran automaticamente al stock.</p>
                </div>
            ` : ""}
        </article>
    `;
}


async function cancelPendingOrder(orderId) {
    const token = localStorage.getItem("walz_token");

    if (!token) {
        showMessage("Tu sesion vencio. Inicia sesion nuevamente.", "error");
        handleLogout();
        return;
    }

    const confirmed = window.confirm(
        "¿Confirmas la cancelacion del pedido? Las unidades volveran al stock."
    );

    if (!confirmed) {
        return;
    }

    try {
        const res = await fetch(`${API_URL}/orders/${orderId}/cancel`, {
            method: "PATCH",
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        const data = await res.json().catch(() => ({}));

        if (res.status === 401) {
            showMessage("Tu sesion vencio. Inicia sesion nuevamente.", "error");
            handleLogout();
            return;
        }

        if (!res.ok) {
            throw new Error(data.detail || `HTTP ${res.status}`);
        }

        showMessage("Pedido cancelado. El stock fue restituido.", "success");
        await loadProducts();
        renderOrderDetail(data, Array.isArray(data.items) ? data.items : []);

    } catch (error) {
        console.error("Error cancelando pedido:", error);
        showMessage(error.message || "No se pudo cancelar el pedido.", "error");
    }
}

function renderOrderNotFound() {

    const container = document.getElementById("orders-content");

    if (!container) {
        return;
    }

    container.innerHTML = `
        <p class="orders-empty">El pedido solicitado no existe o ya no está disponible.</p>
        <button type="button" onclick="loadMyOrders()">
            Volver a mis pedidos
        </button>
    `;
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

    saveCart();

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

    saveCart();

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

    saveCart();

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

function checkout() {

    if (cart.length === 0) {
        showMessage("El carrito esta vacio.", "error");
        return;
    }

    const token = localStorage.getItem("walz_token");

    if (!token) {
        showMessage("Debes iniciar sesion para comprar.", "error");
        return;
    }

    const deliveryName =
        document.getElementById("delivery-name")?.value.trim() || "";

    const deliveryMethod =
        document.querySelector(
            'input[name="delivery-method"]:checked'
        )?.value || "delivery";

    const deliveryAddress =
        document.getElementById("delivery-address")?.value.trim() || "";

    const deliveryCity =
        document.getElementById("delivery-city")?.value.trim() || "";

    const deliveryPhone =
        document.getElementById("delivery-phone")?.value.trim() || "";

    const deliveryNotes =
        document.getElementById("delivery-notes")?.value.trim() || "";

    const deliveryError =
        document.getElementById("delivery-error");

    if (
        !deliveryName ||
        !deliveryPhone ||
        (
            deliveryMethod === "delivery" &&
            (!deliveryAddress || !deliveryCity)
        )
    ) {
        if (deliveryError) {
            deliveryError.textContent =
                deliveryMethod === "pickup"
                    ? "Completa nombre y telefono."
                    : "Completa nombre, direccion, ciudad y telefono.";
        }
        return;
    }

    if (deliveryError) {
        deliveryError.textContent = "";
    }

    const shippingAddress = [
        deliveryMethod === "pickup"
            ? "Metodo: Retiro en el local"
            : "Metodo: Envio a domicilio",
        `Destinatario: ${deliveryName}`,
        deliveryMethod === "delivery"
            ? `Direccion: ${deliveryAddress}`
            : "Direccion del local: A confirmar",
        deliveryMethod === "delivery"
            ? `Ciudad: ${deliveryCity}`
            : null,
        `Telefono: ${deliveryPhone}`,
        deliveryNotes
            ? `Observaciones: ${deliveryNotes}`
            : null
    ]
        .filter(Boolean)
        .join(" | ");

    pendingCheckout = {
        items: cart.map(item => ({
            product_id: item.id,
            quantity: item.qty
        })),
        shipping_address: shippingAddress,
        delivery: {
            method: deliveryMethod,
            name: deliveryName,
            address: deliveryAddress,
            city: deliveryCity,
            phone: deliveryPhone,
            notes: deliveryNotes
        },
        cart: cart.map(item => ({ ...item }))
    };

    renderCheckoutConfirmation();
}


function updateDeliveryMethod() {

    const method =
        document.querySelector(
            'input[name="delivery-method"]:checked'
        )?.value || "delivery";

    const addressFields =
        document.getElementById("delivery-address-fields");

    const pickupInformation =
        document.getElementById("pickup-information");

    const deliveryHeading =
        document.querySelector(".delivery-form > h3:nth-of-type(2)");

    if (addressFields) {
        addressFields.style.display =
            method === "pickup" ? "none" : "grid";
    }

    if (pickupInformation) {
        pickupInformation.style.display =
            method === "pickup" ? "block" : "none";
    }

    if (deliveryHeading) {
        deliveryHeading.textContent =
            method === "pickup"
                ? "Datos para el retiro"
                : "Datos de entrega";
    }

    const deliveryError =
        document.getElementById("delivery-error");

    if (deliveryError) {
        deliveryError.textContent = "";
    }
}


function renderCheckoutConfirmation() {

    if (!pendingCheckout) {
        return;
    }

    const modal =
        document.getElementById("checkout-confirmation-modal");

    const content =
        document.getElementById("checkout-confirmation-content");

    const error =
        document.getElementById("checkout-confirmation-error");

    if (!modal || !content) {
        return;
    }

    const total = pendingCheckout.cart.reduce(
        (sum, item) =>
            sum + Number(item.price) * Number(item.qty),
        0
    );

    content.innerHTML = `
        <div class="checkout-confirmation-items">
            ${pendingCheckout.cart.map(item => {
                const subtotal =
                    Number(item.price) * Number(item.qty);

                return `
                    <div class="checkout-confirmation-item">
                        <strong>${escapeHtml(item.name)}</strong>
                        <span>Cantidad: ${Number(item.qty)}</span>
                        <span>Precio unitario: $${Number(item.price).toFixed(2)}</span>
                        <strong>Subtotal: $${subtotal.toFixed(2)}</strong>
                    </div>
                `;
            }).join("")}
        </div>

        <h3>Total: $${total.toFixed(2)}</h3>

        <div class="checkout-confirmation-delivery">
            <h3>Datos de entrega</h3>
            <p><strong>Metodo:</strong> ${pendingCheckout.delivery.method === "pickup"
                ? "Retiro en el local"
                : "Envio a domicilio"
            }</p>
            <p><strong>Nombre:</strong> ${escapeHtml(pendingCheckout.delivery.name)}</p>
            ${pendingCheckout.delivery.method === "delivery"
                ? `<p><strong>Direccion:</strong> ${escapeHtml(pendingCheckout.delivery.address)}</p>
                   <p><strong>Ciudad:</strong> ${escapeHtml(pendingCheckout.delivery.city)}</p>`
                : `<p><strong>Direccion y horario del local:</strong> A confirmar</p>`
            }
            <p><strong>Telefono:</strong> ${escapeHtml(pendingCheckout.delivery.phone)}</p>
            ${pendingCheckout.delivery.notes
                ? `<p><strong>Observaciones:</strong> ${escapeHtml(pendingCheckout.delivery.notes)}</p>`
                : ""
            }
        </div>
    `;

    if (error) {
        error.textContent = "";
    }

    modal.style.display = "flex";
}


function closeCheckoutConfirmation() {

    const modal =
        document.getElementById("checkout-confirmation-modal");

    if (modal) {
        modal.style.display = "none";
    }

    pendingCheckout = null;
}


async function confirmCheckout() {

    if (!pendingCheckout) {
        return;
    }

    const token = localStorage.getItem("walz_token");
    const button =
        document.getElementById("confirm-checkout-button");
    const error =
        document.getElementById("checkout-confirmation-error");

    if (!token) {
        if (error) {
            error.textContent = "La sesion vencio. Inicia sesion nuevamente.";
        }
        return;
    }

    if (button) {
        button.disabled = true;
        button.textContent = "Procesando...";
    }

    const orderData = pendingCheckout;

    try {
        const res = await fetch(`${API_URL}/orders/checkout`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                items: orderData.items,
                shipping_address: orderData.shipping_address
            })
        });

        const responseText = await res.text();

        if (!res.ok) {
            let message = "Error al procesar la compra.";

            if (res.status === 401) {
                message =
                    "Tu sesion vencio. Inicia sesion nuevamente. El carrito permanece guardado.";
            } else {
                try {
                    const data = JSON.parse(responseText);
                    message = data.detail || message;
                } catch (_) {}
            }

            if (error) {
                error.textContent = message;
            }
            return;
        }

        const orders = JSON.parse(responseText);

        if (!Array.isArray(orders) || orders.length === 0) {
            throw new Error("El servidor no devolvio los pedidos creados.");
        }

        pendingCheckout = null;

        const modal =
            document.getElementById("checkout-confirmation-modal");

        if (modal) {
            modal.style.display = "none";
        }

        cart = [];
        clearCartStorage();
        renderCart();
        updateCartUI();
        document.body.classList.add("has-walz-news-bar");

        await loadProducts();

        const cartSection =
            document.getElementById("cart-section");
        const marketplaceContent =
            document.getElementById("marketplace-content");
        const ordersSection =
            document.getElementById("orders-section");

        if (cartSection) {
            cartSection.style.display = "none";
            document.body.classList.remove("cart-panel-open");
        }

        if (marketplaceContent) {
            marketplaceContent.style.display = "none";
        }

        if (ordersSection) {
            ordersSection.style.display = "block";

    const salesOrdersSection =
        document.getElementById("sales-orders-section");

    if (salesOrdersSection) {
        salesOrdersSection.style.display = "none";
    }
        }

        renderOrderSuccess(orders, orderData.delivery);

    } catch (checkoutError) {
        console.error("Error de conexion checkout:", checkoutError);

        if (error) {
            error.textContent =
                "Error de conexion. El carrito permanece intacto.";
        }

    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = "Confirmar compra";
        }
    }
}

function renderOrderSuccess(orders, delivery) {
    const container =
        document.getElementById("orders-content");

    if (!container) {
        return;
    }

    const createdOrders = Array.isArray(orders)
        ? orders
        : [orders];
    const method = delivery?.method === "pickup"
        ? "Retiro en el local"
        : "Envio a domicilio";
    const multipleOrders = createdOrders.length > 1;
    const grandTotal = createdOrders.reduce(
        (total, order) => total + Number(order.total_amount || 0),
        0
    );

    container.innerHTML = `
        <article class="order-success-card">
            <div class="order-success-icon" aria-hidden="true">&#10003;</div>

            <h2>${multipleOrders
                ? "Compra dividida correctamente por vendedor"
                : "Compra realizada correctamente"
            }</h2>
            <p>${multipleOrders
                ? `WalZ creo ${createdOrders.length} pedidos, uno para cada vendedor.`
                : "Tu pedido fue creado y ya esta registrado en WalZ."
            }</p>

            <div class="checkout-created-orders">
                ${createdOrders.map((order, index) => `
                    <div class="checkout-created-order">
                        <span>Pedido ${index + 1}</span>
                        <strong>#${escapeHtml(String(order.id || ""))}</strong>
                        <span>Estado: ${escapeHtml(order.status || "pending")}</span>
                        <strong>Total: $${Number(order.total_amount || 0).toFixed(2)}</strong>
                        <button
                            type="button"
                            onclick="openOrderDetail('${escapeJs(String(order.id || ""))}')"
                        >
                            Ver pedido
                        </button>
                    </div>
                `).join("")}
            </div>

            <dl class="order-success-summary">
                <div>
                    <dt>Pedidos creados</dt>
                    <dd>${createdOrders.length}</dd>
                </div>
                <div>
                    <dt>Metodo de entrega</dt>
                    <dd>${escapeHtml(method)}</dd>
                </div>
                <div>
                    <dt>Total general</dt>
                    <dd>$${grandTotal.toFixed(2)}</dd>
                </div>
            </dl>

            ${delivery?.method === "pickup"
                ? `<p class="order-success-note">
                       La direccion y el horario de retiro se confirmaran cuando cada pedido este listo.
                   </p>`
                : ""
            }

            <div class="order-success-actions">
                <button
                    type="button"
                    onclick="loadMyOrders()"
                >
                    Mis pedidos
                </button>

                <button
                    type="button"
                    onclick="showMarketplaceContent()"
                >
                    Volver al marketplace
                </button>
            </div>
        </article>
    `;
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
// FASE 5J - PEDIDOS RECIBIDOS
// =====================================================

function showReceivedOrders() {
    hideBannerAdminSection();
    const marketplaceContent =
        document.getElementById("marketplace-content");
    const ordersSection =
        document.getElementById("orders-section");
    const salesOrdersSection =
        document.getElementById("sales-orders-section");

    if (!salesOrdersSection) {
        console.error("No existe la seccion de pedidos recibidos.");
        return;
    }

    if (marketplaceContent) {
        marketplaceContent.style.display = "none";
    }

    if (ordersSection) {
        ordersSection.style.display = "none";
    }

    salesOrdersSection.style.display = "block";
    loadReceivedOrders();
}


async function loadReceivedOrders() {
    const container =
        document.getElementById("sales-orders-content");
    const currentToken =
        localStorage.getItem("walz_token");

    if (!container) {
        return;
    }

    if (!currentToken) {
        container.innerHTML = `
            <div class="orders-state-card orders-error">
                Tu sesion vencio. Inicia sesion nuevamente.
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="orders-state-card orders-loading">
            Cargando pedidos recibidos...
        </div>
    `;

    try {
        const res = await fetch(`${API_URL}/orders/seller/received`, {
            headers: {
                Authorization: `Bearer ${currentToken}`
            }
        });
        const data = await res.json().catch(() => ([]));

        if (res.status === 401) {
            showMessage("Tu sesion vencio. Inicia sesion nuevamente.", "error");
            handleLogout();
            return;
        }

        if (!res.ok) {
            throw new Error(data.detail || `HTTP ${res.status}`);
        }

        window.walzReceivedOrders = Array.isArray(data) ? data : [];
        applyReceivedOrdersFilters();

    } catch (error) {
        console.error("Error cargando pedidos recibidos:", error);
        container.innerHTML = `
            <div class="orders-state-card orders-error">
                <h3>No pudimos cargar los pedidos recibidos</h3>
                <p>${escapeHtml(error.message || "Error desconocido")}</p>
            </div>
        `;
    }
}


function renderReceivedOrders(orders) {
    const container =
        document.getElementById("sales-orders-content");

    if (!container) {
        return;
    }

    if (!Array.isArray(orders) || orders.length === 0) {
        const hasReceivedOrders =
            Array.isArray(window.walzReceivedOrders) &&
            window.walzReceivedOrders.length > 0;

        container.innerHTML = `
            <div class="orders-state-card orders-empty">
                <h3>${hasReceivedOrders
                    ? "No encontramos ventas con esos filtros"
                    : "Todavia no recibiste pedidos"
                }</h3>
                <p>${hasReceivedOrders
                    ? "Proba otra palabra o selecciona otro estado."
                    : "Cuando alguien compre uno de tus productos aparecera aqui."
                }</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="sales-orders-list">
            ${orders.map(order => {
                const statusInfo = getOrderStatusInfo(order.status);
                const createdAt = order.created_at
                    ? new Date(order.created_at).toLocaleString("es-AR")
                    : "Fecha no disponible";
                const items = Array.isArray(order.items) ? order.items : [];

                return `
                    <article class="order-card sales-order-card">
                        <div class="order-card-header">
                            <div>
                                <span class="order-card-label">Venta</span>
                                <h3>#${escapeHtml(String(order.id))}</h3>
                            </div>
                            <span class="order-status ${statusInfo.className}">
                                ${escapeHtml(statusInfo.label)}
                            </span>
                        </div>

                        <div class="sales-buyer-data">
                            <div><span>Comprador</span><strong>${escapeHtml(order.buyer?.name || "Sin nombre")}</strong></div>
                            <div><span>Email</span><strong>${escapeHtml(order.buyer?.email || "No disponible")}</strong></div>
                            <div><span>Telefono</span><strong>${escapeHtml(order.buyer?.phone || "Ver datos de entrega")}</strong></div>
                            <div><span>Fecha</span><strong>${escapeHtml(createdAt)}</strong></div>
                        </div>

                        <div class="sales-order-items">
                            ${items.map(item => `
                                <div class="sales-order-item">
                                    <strong>${escapeHtml(item.product_name || "Producto")}</strong>
                                    <span>Cantidad: ${Number(item.quantity || 0)}</span>
                                    <span>Precio: $${Number(item.price_at_purchase || 0).toFixed(2)}</span>
                                    <strong>Subtotal: $${Number(item.subtotal || 0).toFixed(2)}</strong>
                                </div>
                            `).join("")}
                        </div>

                        <div class="sales-delivery-data">
                            <span>Datos de entrega</span>
                            <p>${escapeHtml(order.shipping_address || "No disponibles")}</p>
                        </div>

                        <h3 class="order-total">
                            Total de tus productos: ${Number(order.seller_total || 0).toFixed(2)}
                        </h3>

                        ${renderSellerOrderActions(order)}
                    </article>
                `;
            }).join("")}
        </div>
    `;
}



function renderSellerOrderActions(order) {
    const status = String(order.status || "pending").toLowerCase();
    const orderId = escapeJs(String(order.id || ""));
    const isPickup = String(order.shipping_address || "")
        .toLowerCase()
        .includes("retiro en el local");

    if (status === "pending") {
        return `
            <div class="seller-order-actions">
                <button
                    type="button"
                    onclick="updateSellerOrderStatus('${orderId}', 'paid', 'Confirmar pedido')"
                >
                    Confirmar pedido
                </button>
                <button
                    type="button"
                    class="seller-cancel-button"
                    onclick="updateSellerOrderStatus('${orderId}', 'cancelled', 'Cancelar venta')"
                >
                    Cancelar venta
                </button>
            </div>
        `;
    }

    if (status === "paid") {
        const actionLabel = isPickup
            ? "Marcar listo para retirar"
            : "Marcar como enviado";

        return `
            <div class="seller-order-actions">
                <button
                    type="button"
                    onclick="updateSellerOrderStatus('${orderId}', 'shipped', '${actionLabel}')"
                >
                    ${actionLabel}
                </button>
                <button
                    type="button"
                    class="seller-cancel-button"
                    onclick="updateSellerOrderStatus('${orderId}', 'cancelled', 'Cancelar venta')"
                >
                    Cancelar venta
                </button>
            </div>
        `;
    }

    if (status === "shipped") {
        return `
            <div class="seller-order-actions">
                <button
                    type="button"
                    onclick="updateSellerOrderStatus('${orderId}', 'delivered', 'Marcar como entregado')"
                >
                    Marcar como entregado
                </button>
            </div>
        `;
    }

    return "";
}


async function updateSellerOrderStatus(orderId, newStatus, actionLabel) {
    const currentToken = localStorage.getItem("walz_token");

    if (!currentToken) {
        showMessage("Tu sesion vencio. Inicia sesion nuevamente.", "error");
        handleLogout();
        return;
    }

    const confirmed = window.confirm(
        `${actionLabel}: ¿confirmas esta accion?`
    );

    if (!confirmed) {
        return;
    }

    try {
        const res = await fetch(
            `${API_URL}/orders/seller/${orderId}/status`,
            {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${currentToken}`
                },
                body: JSON.stringify({ status: newStatus })
            }
        );
        const data = await res.json().catch(() => ({}));

        if (res.status === 401) {
            showMessage("Tu sesion vencio. Inicia sesion nuevamente.", "error");
            handleLogout();
            return;
        }

        if (!res.ok) {
            throw new Error(data.detail || `HTTP ${res.status}`);
        }

        showMessage("Estado del pedido actualizado.", "success");
        await loadReceivedOrders();

    } catch (error) {
        console.error("Error actualizando estado del pedido:", error);
        showMessage(
            error.message || "No se pudo actualizar el pedido.",
            "error"
        );
    }
}



function normalizeSalesSearchText(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim()
        .replace(/^#+/, "");
}


function applyReceivedOrdersFilters() {
    const allOrders = Array.isArray(window.walzReceivedOrders)
        ? window.walzReceivedOrders
        : [];
    const search = normalizeSalesSearchText(
        document.getElementById("sales-orders-search")?.value
    );
    const selectedStatus = String(
        document.getElementById("sales-orders-status-filter")?.value || ""
    ).toLowerCase();

    const filteredOrders = allOrders.filter(order => {
        const status = String(order.status || "").toLowerCase();

        if (selectedStatus && status !== selectedStatus) {
            return false;
        }

        if (!search) {
            return true;
        }

        const itemNames = (Array.isArray(order.items) ? order.items : [])
            .map(item => item.product_name || "")
            .join(" ");
        const searchableText = normalizeSalesSearchText([
            order.id,
            status,
            getOrderStatusInfo(status).label,
            order.buyer?.name,
            order.buyer?.email,
            order.buyer?.phone,
            order.shipping_address,
            itemNames
        ].join(" "));

        return searchableText.includes(search);
    });

    const counter =
        document.getElementById("sales-orders-results-count");

    if (counter) {
        counter.textContent = allOrders.length === filteredOrders.length
            ? `${allOrders.length} venta${allOrders.length === 1 ? "" : "s"}`
            : `${filteredOrders.length} de ${allOrders.length} ventas`;
    }

    renderReceivedOrders(filteredOrders);
}


function clearReceivedOrdersFilters() {
    const searchInput =
        document.getElementById("sales-orders-search");
    const statusFilter =
        document.getElementById("sales-orders-status-filter");

    if (searchInput) {
        searchInput.value = "";
    }

    if (statusFilter) {
        statusFilter.value = "";
    }

    applyReceivedOrdersFilters();
}



// =====================================================
// FASE 5K - MIS PRODUCTOS
// =====================================================

function showMyProducts() {
    hideBannerAdminSection();
    const marketplaceContent = document.getElementById("marketplace-content");
    const ordersSection = document.getElementById("orders-section");
    const salesOrdersSection = document.getElementById("sales-orders-section");
    const myProductsSection = document.getElementById("my-products-section");

    if (!myProductsSection) {
        console.error("No existe la seccion Mis productos.");
        return;
    }

    if (marketplaceContent) marketplaceContent.style.display = "none";
    if (ordersSection) ordersSection.style.display = "none";
    if (salesOrdersSection) salesOrdersSection.style.display = "none";
    myProductsSection.style.display = "block";

    loadMyProducts();
}


async function loadMyProducts() {
    const container = document.getElementById("my-products-content");
    const currentToken = localStorage.getItem("walz_token");

    if (!container) return;

    if (!currentToken) {
        container.innerHTML = '<div class="orders-state-card orders-error">Tu sesion vencio.</div>';
        return;
    }

    container.innerHTML = '<div class="orders-state-card">Cargando productos...</div>';

    try {
        const res = await fetch(`${API_URL}/products/mine`, {
            headers: { Authorization: `Bearer ${currentToken}` }
        });
        const data = await res.json().catch(() => ([]));

        if (res.status === 401) {
            showMessage("Tu sesion vencio. Inicia sesion nuevamente.", "error");
            handleLogout();
            return;
        }

        if (!res.ok) {
            throw new Error(data.detail || `HTTP ${res.status}`);
        }

        window.walzMyProducts = Array.isArray(data) ? data : [];
        applyMyProductsFilters();

    } catch (error) {
        console.error("Error cargando productos propios:", error);
        container.innerHTML = `
            <div class="orders-state-card orders-error">
                No pudimos cargar tus productos.
            </div>
        `;
    }
}


function applyMyProductsFilters() {
    const allProducts = Array.isArray(window.walzMyProducts)
        ? window.walzMyProducts
        : [];
    const search = normalizeSalesSearchText(
        document.getElementById("my-products-search")?.value
    );
    const selectedStatus = String(
        document.getElementById("my-products-status-filter")?.value || ""
    );

    const summary = document.getElementById("my-products-stock-summary");
    const activeCount = allProducts.filter(product => product.is_active).length;
    const pausedCount = allProducts.filter(product => !product.is_active).length;
    const lowStockCount = allProducts.filter(product => Number(product.stock) > 0 && Number(product.stock) <= 5).length;
    const outOfStockCount = allProducts.filter(product => Number(product.stock) <= 0).length;

    if (summary) {
        summary.innerHTML = `
            <button type="button" onclick="setMyProductsStatusFilter('')"><span>Total</span><strong>${allProducts.length}</strong></button>
            <button type="button" onclick="setMyProductsStatusFilter('active')"><span>Activos</span><strong>${activeCount}</strong></button>
            <button type="button" onclick="setMyProductsStatusFilter('paused')"><span>Pausados</span><strong>${pausedCount}</strong></button>
            <button type="button" class="low-stock" onclick="setMyProductsStatusFilter('low_stock')"><span>Stock bajo</span><strong>${lowStockCount}</strong></button>
            <button type="button" class="out-of-stock" onclick="setMyProductsStatusFilter('out_of_stock')"><span>Agotados</span><strong>${outOfStockCount}</strong></button>
        `;
    }

    const filteredProducts = allProducts.filter(product => {
        const stock = Number(product.stock || 0);
        if (selectedStatus === "active" && !product.is_active) return false;
        if (selectedStatus === "paused" && product.is_active) return false;
        if (selectedStatus === "low_stock" && !(stock > 0 && stock <= 5)) return false;
        if (selectedStatus === "out_of_stock" && stock > 0) return false;

        if (!search) return true;

        const searchable = normalizeSalesSearchText([
            product.id,
            product.name,
            product.category,
            product.description
        ].join(" "));

        return searchable.includes(search);
    });

    const counter = document.getElementById("my-products-results-count");
    if (counter) {
        counter.textContent = allProducts.length === filteredProducts.length
            ? `${allProducts.length} producto${allProducts.length === 1 ? "" : "s"}`
            : `${filteredProducts.length} de ${allProducts.length} productos`;
    }

    renderMyProducts(filteredProducts);
}


function setMyProductsStatusFilter(value) {
    const status = document.getElementById("my-products-status-filter");
    if (status) status.value = value;
    applyMyProductsFilters();
}


function clearMyProductsFilters() {
    const search = document.getElementById("my-products-search");
    const status = document.getElementById("my-products-status-filter");
    if (search) search.value = "";
    if (status) status.value = "";
    applyMyProductsFilters();
}


function renderMyProducts(products) {
    const container = document.getElementById("my-products-content");
    if (!container) return;

    if (!Array.isArray(products) || products.length === 0) {
        const hasProducts = Array.isArray(window.walzMyProducts) && window.walzMyProducts.length > 0;
        container.innerHTML = `
            <div class="orders-state-card my-products-empty">
                <h3>${hasProducts ? "No encontramos productos" : "Todavia no publicaste productos"}</h3>
                <p>${hasProducts ? "Proba otra busqueda." : "Publica tu primer producto desde el marketplace."}</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="my-products-list">
            ${products.map(product => `
                <article class="my-product-card">
                    ${renderProductImage(product.image_url, product.name, "my-product-image")}
                    <div class="my-product-card-header">
                        <div>
                            <span>Producto</span>
                            <h3>${escapeHtml(product.name || "Sin nombre")}</h3>
                        </div>
                        <div class="my-product-badges">
                            <span class="my-product-state ${product.is_active ? "active" : "paused"}">
                                ${product.is_active ? "Activo" : "Pausado"}
                            </span>
                            ${Number(product.stock || 0) <= 0
                                ? '<span class="my-product-stock-state out">Agotado</span>'
                                : Number(product.stock || 0) <= 5
                                    ? '<span class="my-product-stock-state low">Stock bajo</span>'
                                    : ''}
                        </div>
                    </div>
                    <div class="my-product-summary">
                        <div><span>Precio</span><strong class="my-product-price-display">${renderProductPrice(product)}</strong></div>
                        <div><span>Stock</span><strong>${Number(product.stock || 0)}</strong></div>
                        <div><span>Categoria</span><strong>${escapeHtml(product.category || "Sin categoria")}</strong></div>
                    </div>
                    <p class="my-product-code">Codigo: #${escapeHtml(String(product.id || ""))}</p>
                    ${String(window.walzEditingProductId || "") === String(product.id)
                        ? renderMyProductEditor(product)
                        : `<div class="my-product-actions">
                               <button
                                   type="button"
                                   onclick="startEditingMyProduct('${escapeJs(String(product.id))}')"
                               >
                                   Editar producto
                               </button>
                               <button
                                   type="button"
                                   class="${product.is_active ? "pause-product-button" : "reactivate-product-button"}"
                                   onclick="toggleMyProductStatus('${escapeJs(String(product.id))}', ${product.is_active ? "false" : "true"})"
                               >
                                   ${product.is_active ? "Pausar producto" : "Reactivar producto"}
                               </button>
                           </div>`
                    }
                </article>
            `).join("")}
        </div>
    `;
}



function startEditingMyProduct(productId) {
    window.walzEditingProductId = String(productId);
    applyMyProductsFilters();
}


function cancelEditingMyProduct() {
    window.walzEditingProductId = null;
    applyMyProductsFilters();
}


function renderMyProductEditor(product) {
    return `
        <div class="my-product-editor">
            <label>
                <span>Nombre</span>
                <input
                    id="edit-product-name-${escapeHtml(String(product.id))}"
                    type="text"
                    maxlength="200"
                    value="${escapeHtml(product.name || "")}"
                >
            </label>
            <label>
                <span>Precio normal</span>
                <input
                    id="edit-product-price-${escapeHtml(String(product.id))}"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value="${Number(product.price || 0)}"
                >
            </label>
            <label>
                <span>Precio de oferta</span>
                <input
                    id="edit-product-offer-price-${escapeHtml(String(product.id))}"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value="${product.offer_price == null ? "" : Number(product.offer_price)}"
                    placeholder="Opcional"
                >
            </label>
            <label class="my-product-offer-toggle">
                <input
                    id="edit-product-offer-active-${escapeHtml(String(product.id))}"
                    type="checkbox"
                    ${product.offer_active ? "checked" : ""}
                >
                <span>Oferta activa</span>
            </label>
            <label>
                <span>Stock</span>
                <input
                    id="edit-product-stock-${escapeHtml(String(product.id))}"
                    type="number"
                    min="0"
                    step="1"
                    value="${Number(product.stock || 0)}"
                >
            </label>
            <label>
                <span>Categoria</span>
                <input
                    id="edit-product-category-${escapeHtml(String(product.id))}"
                    type="text"
                    maxlength="100"
                    value="${escapeHtml(product.category || "")}"
                >
            </label>
            <label class="my-product-description-field">
                <span>Descripcion</span>
                <textarea
                    id="edit-product-description-${escapeHtml(String(product.id))}"
                    maxlength="1000"
                >${escapeHtml(product.description || "")}</textarea>
            </label>
            <label class="my-product-description-field">
                <span>Enlace de la imagen</span>
                <input
                    id="edit-product-image-${escapeHtml(String(product.id))}"
                    type="url"
                    value="${escapeHtml(product.image_url || "")}"
                    placeholder="https://..."
                >
            </label>
            <div class="my-product-editor-actions">
                <button
                    type="button"
                    onclick="saveMyProductChanges('${escapeJs(String(product.id))}')"
                >
                    Guardar cambios
                </button>
                <button type="button" onclick="cancelEditingMyProduct()">
                    Cancelar
                </button>
            </div>
        </div>
    `;
}


async function saveMyProductChanges(productId) {
    const currentToken = localStorage.getItem("walz_token");
    const name = document.getElementById(`edit-product-name-${productId}`)?.value.trim() || "";
    const price = Number(document.getElementById(`edit-product-price-${productId}`)?.value);
    const offerPriceText = document.getElementById(`edit-product-offer-price-${productId}`)?.value.trim() || "";
    const offerPrice = offerPriceText ? Number(offerPriceText) : null;
    const offerActive = Boolean(document.getElementById(`edit-product-offer-active-${productId}`)?.checked);
    const stock = Number(document.getElementById(`edit-product-stock-${productId}`)?.value);
    const category = document.getElementById(`edit-product-category-${productId}`)?.value.trim() || "";
    const description = document.getElementById(`edit-product-description-${productId}`)?.value.trim() || "";
    const imageUrl = document.getElementById(`edit-product-image-${productId}`)?.value.trim() || "";

    if (!name) {
        showMessage("El nombre del producto es obligatorio.", "error");
        return;
    }

    if (!Number.isFinite(price) || price <= 0) {
        showMessage("El precio debe ser mayor que cero.", "error");
        return;
    }

    if (!Number.isInteger(stock) || stock < 0) {
        showMessage("El stock debe ser un numero entero igual o mayor que cero.", "error");
        return;
    }

    if (offerActive && (!Number.isFinite(offerPrice) || offerPrice <= 0)) {
        showMessage("Ingresa un precio de oferta valido antes de activarla.", "error");
        return;
    }

    if (offerActive && offerPrice >= price) {
        showMessage("El precio de oferta debe ser menor que el precio normal.", "error");
        return;
    }

    if (!currentToken) {
        showMessage("Tu sesion vencio. Inicia sesion nuevamente.", "error");
        handleLogout();
        return;
    }

    try {
        const res = await fetch(`${API_URL}/products/${productId}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${currentToken}`
            },
            body: JSON.stringify({ name, price, offer_price: offerPrice, offer_active: offerActive, stock, category: category || null, description: description || null, image_url: imageUrl })
        });
        const data = await res.json().catch(() => ({}));

        if (res.status === 401) {
            showMessage("Tu sesion vencio. Inicia sesion nuevamente.", "error");
            handleLogout();
            return;
        }

        if (!res.ok) {
            throw new Error(data.detail || `HTTP ${res.status}`);
        }

        const index = (window.walzMyProducts || []).findIndex(
            product => String(product.id) === String(data.id)
        );

        if (index >= 0) {
            window.walzMyProducts[index] = data;
        }

        window.walzEditingProductId = null;
        showMessage("Producto actualizado correctamente.", "success");
        applyMyProductsFilters();
        await loadProducts();

    } catch (error) {
        console.error("Error actualizando producto:", error);
        showMessage(error.message || "No se pudo actualizar el producto.", "error");
    }
}

// =====================================================
// FASE 5K PASO 3 - PAUSAR Y REACTIVAR PRODUCTOS
async function toggleMyProductStatus(productId, shouldActivate) {
    const currentToken = localStorage.getItem("walz_token");
    const action = shouldActivate ? "reactivar" : "pausar";

    if (!currentToken) {
        showMessage("Tu sesion vencio. Inicia sesion nuevamente.", "error");
        handleLogout();
        return;
    }

    if (!confirm(`Confirmas que queres ${action} este producto?`)) return;

    try {
        const res = await fetch(`${API_URL}/products/${productId}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${currentToken}`
            },
            body: JSON.stringify({ is_active: Boolean(shouldActivate) })
        });
        const data = await res.json().catch(() => ({}));

        if (res.status === 401) {
            showMessage("Tu sesion vencio. Inicia sesion nuevamente.", "error");
            handleLogout();
            return;
        }

        if (!res.ok) {
            throw new Error(data.detail || `HTTP ${res.status}`);
        }

        const index = (window.walzMyProducts || []).findIndex(
            product => String(product.id) === String(data.id)
        );
        if (index >= 0) window.walzMyProducts[index] = data;

        showMessage(
            shouldActivate
                ? "Producto reactivado correctamente."
                : "Producto pausado correctamente.",
            "success"
        );
        applyMyProductsFilters();
        await loadProducts();

    } catch (error) {
        console.error("Error cambiando estado del producto:", error);
        showMessage(error.message || "No se pudo cambiar el estado del producto.", "error");
    }
}


// =====================================================
// FASE 5M - PUBLICIDAD Y BANNERS
// =====================================================

function updateAdminBannerVisibility() {
    const button = document.getElementById("banner-admin-button");
    if (button) button.style.display = currentUserRole === "ADMIN" ? "inline-flex" : "none";
}


async function loadCurrentUserProfile() {
    const currentToken = localStorage.getItem("walz_token");
    if (!currentToken) return;

    try {
        const response = await fetch(`${API_URL}/auth/me`, {
            headers: { Authorization: `Bearer ${currentToken}` }
        });
        if (!response.ok) return;
        const user = await response.json();
        currentUserRole = String(user.role || "").toUpperCase();
        localStorage.setItem("walz_user_role", currentUserRole);
        updateAdminBannerVisibility();
    } catch (error) {
        console.error("No se pudo cargar el perfil:", error);
    }
}


function getSafeBannerLink(value) {
    const url = String(value || "").trim();
    return /^https?:\/\//i.test(url) ? url : "";
}


function stopMarketplaceBannerRotation() {
    if (window.walzBannerTimer) {
        clearInterval(window.walzBannerTimer);
        window.walzBannerTimer = null;
    }
}


function startMarketplaceBannerRotation() {
    stopMarketplaceBannerRotation();
    const banners = Array.isArray(window.walzActiveBanners) ? window.walzActiveBanners : [];
    if (banners.length <= 1) return;

    window.walzBannerTimer = setInterval(() => {
        moveMarketplaceBanner(1, false);
    }, 6000);
}


function renderMarketplaceBanner() {
    const container = document.getElementById("marketplace-banners");
    const banners = Array.isArray(window.walzActiveBanners) ? window.walzActiveBanners : [];
    if (!container || banners.length === 0) return;

    const index = Math.max(0, Math.min(Number(window.walzBannerIndex || 0), banners.length - 1));
    window.walzBannerIndex = index;
    const banner = banners[index];
    const link = getSafeBannerLink(banner.link_url);

    container.innerHTML = `
        <article class="marketplace-banner-card">
            ${renderProductImage(banner.image_url, banner.title, "marketplace-banner-image")}
            <div class="marketplace-banner-copy">
                <span class="marketplace-banner-label">Publicidad</span>
                <h2>${escapeHtml(banner.title || "")}</h2>
                ${banner.subtitle ? `<p>${escapeHtml(banner.subtitle)}</p>` : ""}
                ${link ? `<a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(banner.button_text || "Ver mas")}</a>` : ""}
            </div>
            ${banners.length > 1 ? `
                <button type="button" class="banner-carousel-arrow previous" onclick="moveMarketplaceBanner(-1)" aria-label="Publicidad anterior">&#10094;</button>
                <button type="button" class="banner-carousel-arrow next" onclick="moveMarketplaceBanner(1)" aria-label="Publicidad siguiente">&#10095;</button>
                <div class="banner-carousel-dots">
                    ${banners.map((_, dotIndex) => `<button type="button" class="${dotIndex === index ? "active" : ""}" onclick="selectMarketplaceBanner(${dotIndex})" aria-label="Ver publicidad ${dotIndex + 1}"></button>`).join("")}
                </div>
            ` : ""}
        </article>
    `;
}


function moveMarketplaceBanner(direction, restartTimer = true) {
    const banners = Array.isArray(window.walzActiveBanners) ? window.walzActiveBanners : [];
    if (banners.length === 0) return;
    window.walzBannerIndex = (Number(window.walzBannerIndex || 0) + direction + banners.length) % banners.length;
    renderMarketplaceBanner();
    if (restartTimer) startMarketplaceBannerRotation();
}


function selectMarketplaceBanner(index) {
    window.walzBannerIndex = Number(index || 0);
    renderMarketplaceBanner();
    startMarketplaceBannerRotation();
}


async function loadActiveBanners() {
    const container = document.getElementById("marketplace-banners");
    if (!container) return;

    try {
        const response = await fetch(`${API_URL}/banners/active`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const banners = await response.json();

        if (!Array.isArray(banners) || banners.length === 0) {
            stopMarketplaceBannerRotation();
            window.walzActiveBanners = [];
            container.style.display = "none";
            container.innerHTML = "";
            return;
        }

        window.walzActiveBanners = banners;
        window.walzBannerIndex = 0;
        renderMarketplaceBanner();
        container.style.display = "block";
        container.onmouseenter = stopMarketplaceBannerRotation;
        container.onmouseleave = startMarketplaceBannerRotation;
        startMarketplaceBannerRotation();
    } catch (error) {
        console.error("No se pudieron cargar los banners:", error);
        stopMarketplaceBannerRotation();
        container.style.display = "none";
    }
}


function hideBannerAdminSection() {
    const section = document.getElementById("banner-admin-section");
    if (section) section.style.display = "none";
}


function showBannerAdmin() {
    if (currentUserRole !== "ADMIN") {
        showMessage("Se requiere una cuenta administradora.", "error");
        return;
    }

    document.getElementById("marketplace-content")?.style.setProperty("display", "none");
    document.getElementById("orders-section")?.style.setProperty("display", "none");
    document.getElementById("sales-orders-section")?.style.setProperty("display", "none");
    document.getElementById("my-products-section")?.style.setProperty("display", "none");
    const section = document.getElementById("banner-admin-section");
    if (section) section.style.display = "block";
    loadAdminBanners();
}


function bannerDateToIso(inputId) {
    const value = document.getElementById(inputId)?.value || "";
    return value ? new Date(value).toISOString() : null;
}


async function createAdminBanner() {
    const currentToken = localStorage.getItem("walz_token");
    const errorElement = document.getElementById("banner-admin-error");
    const title = document.getElementById("banner-title")?.value.trim() || "";
    const subtitle = document.getElementById("banner-subtitle")?.value.trim() || "";
    const imageUrl = document.getElementById("banner-image-url")?.value.trim() || "";
    const linkUrl = document.getElementById("banner-link-url")?.value.trim() || "";
    const buttonText = document.getElementById("banner-button-text")?.value.trim() || "";
    const displayOrder = Number(document.getElementById("banner-display-order")?.value || 0);
    const isActive = Boolean(document.getElementById("banner-is-active")?.checked);

    if (errorElement) errorElement.textContent = "";
    if (!title || !getProductImageUrl(imageUrl)) {
        if (errorElement) errorElement.textContent = "Completa el titulo y un enlace de imagen valido.";
        return;
    }

    try {
        const response = await fetch(`${API_URL}/banners/`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${currentToken}`
            },
            body: JSON.stringify({
                title,
                subtitle: subtitle || null,
                image_url: imageUrl,
                link_url: getSafeBannerLink(linkUrl) || null,
                button_text: buttonText || null,
                is_active: isActive,
                starts_at: bannerDateToIso("banner-starts-at"),
                ends_at: bannerDateToIso("banner-ends-at"),
                display_order: Number.isInteger(displayOrder) && displayOrder >= 0 ? displayOrder : 0
            })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || `HTTP ${response.status}`);

        showMessage("Banner creado correctamente.", "success");
        for (const id of ["banner-title", "banner-subtitle", "banner-image-url", "banner-link-url", "banner-button-text", "banner-starts-at", "banner-ends-at"]) {
            const input = document.getElementById(id);
            if (input) input.value = "";
        }
        await loadAdminBanners();
        await loadActiveBanners();
    } catch (error) {
        if (errorElement) errorElement.textContent = error.message || "No se pudo crear el banner.";
    }
}


async function loadAdminBanners() {
    const container = document.getElementById("banner-admin-list");
    const currentToken = localStorage.getItem("walz_token");
    if (!container) return;
    container.innerHTML = "Cargando banners...";

    try {
        const response = await fetch(`${API_URL}/banners/admin`, {
            headers: { Authorization: `Bearer ${currentToken}` }
        });
        const banners = await response.json().catch(() => ([]));
        if (!response.ok) throw new Error(banners.detail || `HTTP ${response.status}`);

        if (!Array.isArray(banners) || banners.length === 0) {
            container.innerHTML = '<div class="orders-state-card">Todavia no hay banners.</div>';
            return;
        }

        container.innerHTML = `<div class="banner-admin-list">${banners.map(banner => `
            <article class="banner-admin-card">
                ${renderProductImage(banner.image_url, banner.title, "banner-admin-image")}
                <div>
                    <h3>${escapeHtml(banner.title || "")}</h3>
                    <p>${escapeHtml(banner.subtitle || "Sin texto adicional")}</p>
                    <span class="my-product-state ${banner.is_active ? "active" : "paused"}">${banner.is_active ? "Activo" : "Pausado"}</span>
                </div>
                <button type="button" onclick="toggleAdminBanner('${escapeJs(String(banner.id))}', ${banner.is_active ? "false" : "true"})">
                    ${banner.is_active ? "Pausar" : "Activar"}
                </button>
            </article>
        `).join("")}</div>`;
    } catch (error) {
        container.innerHTML = `<div class="orders-state-card orders-error">${escapeHtml(error.message || "No se pudieron cargar los banners.")}</div>`;
    }
}


async function toggleAdminBanner(bannerId, shouldActivate) {
    const currentToken = localStorage.getItem("walz_token");
    try {
        const response = await fetch(`${API_URL}/banners/${bannerId}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${currentToken}`
            },
            body: JSON.stringify({ is_active: Boolean(shouldActivate) })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || `HTTP ${response.status}`);
        showMessage(shouldActivate ? "Banner activado." : "Banner pausado.", "success");
        await loadAdminBanners();
        await loadActiveBanners();
    } catch (error) {
        showMessage(error.message || "No se pudo modificar el banner.", "error");
    }
}


function closeWalzNewsBar() {
    const bar = document.getElementById("walz-news-bar");
    if (bar) bar.style.display = "none";
    document.body.classList.remove("has-walz-news-bar");
}


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
window.updateDeliveryMethod = updateDeliveryMethod;
window.confirmCheckout = confirmCheckout;
window.closeCheckoutConfirmation = closeCheckoutConfirmation;
window.showMyOrders = showMyOrders;
window.showMarketplaceContent = showMarketplaceContent;
window.loadMyOrders = loadMyOrders;
window.openOrderDetail = openOrderDetail;
window.showReceivedOrders = showReceivedOrders;
window.loadReceivedOrders = loadReceivedOrders;
window.updateSellerOrderStatus = updateSellerOrderStatus;
window.applyReceivedOrdersFilters = applyReceivedOrdersFilters;
window.clearReceivedOrdersFilters = clearReceivedOrdersFilters;
window.showMyProducts = showMyProducts;
window.loadMyProducts = loadMyProducts;
window.applyMyProductsFilters = applyMyProductsFilters;
window.clearMyProductsFilters = clearMyProductsFilters;
window.setMyProductsStatusFilter = setMyProductsStatusFilter;
window.startEditingMyProduct = startEditingMyProduct;
window.cancelEditingMyProduct = cancelEditingMyProduct;
window.saveMyProductChanges = saveMyProductChanges;
window.toggleMyProductStatus = toggleMyProductStatus;
window.showBannerAdmin = showBannerAdmin;
window.createAdminBanner = createAdminBanner;
window.loadAdminBanners = loadAdminBanners;
window.toggleAdminBanner = toggleAdminBanner;
window.closeWalzNewsBar = closeWalzNewsBar;
window.moveMarketplaceBanner = moveMarketplaceBanner;
window.selectMarketplaceBanner = selectMarketplaceBanner;
window.cancelPendingOrder = cancelPendingOrder;

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
        document.body.classList.add("has-walz-news-bar");

        if (token) {

            showMarketplace();
            updateAdminBannerVisibility();
            loadCurrentUserProfile();
            loadActiveBanners();

            loadProducts();

        } else {

            showAuth();
        }
    }
);
