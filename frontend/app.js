const API_URL = window.location.origin;

let token = localStorage.getItem("walz_token");
let currentUserId = localStorage.getItem("walz_user_id");
let currentUserRole = localStorage.getItem("walz_user_role") || "";

const GUEST_CART_STORAGE_KEY = "walz_cart_guest";

let cart = loadCart();
let pendingCheckout = null;

function getCartStorageKey() {
    const hasSession = Boolean(
        localStorage.getItem("walz_token")
    );

    return hasSession && currentUserId
        ? `walz_cart_${currentUserId}`
        : GUEST_CART_STORAGE_KEY;
}

function loadCart(storageKey = getCartStorageKey()) {
    try {
        const savedCart = localStorage.getItem(storageKey);

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
        localStorage.setItem(
            getCartStorageKey(),
            JSON.stringify(cart)
        );
    } catch (error) {
        console.error("Error guardando carrito:", error);
    }
}

function clearCartStorage() {
    localStorage.removeItem(
        getCartStorageKey()
    );
}

function mergeGuestCartIntoBuyerCart() {
    if (!currentUserId) {
        return loadCart();
    }

    const buyerCartKey =
        `walz_cart_${currentUserId}`;

    const buyerCart =
        loadCart(buyerCartKey);

    const guestCart =
        loadCart(GUEST_CART_STORAGE_KEY);

    const mergedCart =
        buyerCart.map(item => ({ ...item }));

    for (const guestItem of guestCart) {
        const existing = mergedCart.find(
            item =>
                String(item.id) ===
                String(guestItem.id)
        );

        if (!existing) {
            mergedCart.push({ ...guestItem });
            continue;
        }

        const buyerQty =
            Math.max(1, Number(existing.qty) || 1);

        const guestQty =
            Math.max(1, Number(guestItem.qty) || 1);

        const stockCandidates = [
            Number(existing.stock),
            Number(guestItem.stock),
        ].filter(
            value =>
                Number.isFinite(value) &&
                value > 0
        );

        const safeStock =
            stockCandidates.length
                ? Math.min(...stockCandidates)
                : Math.max(buyerQty, guestQty);

        existing.qty = Math.min(
            Math.max(buyerQty, guestQty),
            safeStock
        );

        existing.stock = safeStock;

        if (guestItem.name) {
            existing.name = guestItem.name;
        }

        if (
            Number.isFinite(
                Number(guestItem.price)
            )
        ) {
            existing.price =
                Number(guestItem.price);
        }
    }

    localStorage.setItem(
        buyerCartKey,
        JSON.stringify(mergedCart)
    );

    localStorage.removeItem(
        GUEST_CART_STORAGE_KEY
    );

    return mergedCart;
}

// =====================================================
// AUTENTICACION
// =====================================================

function openTermsModal(){const modal=document.getElementById("terms-modal");if(modal)modal.style.display="flex"}
function closeTermsModal(){const modal=document.getElementById("terms-modal");if(modal)modal.style.display="none"}
function acceptTermsFromModal(){const checkbox=document.getElementById("reg-accepted-terms");if(checkbox)checkbox.checked=true;closeTermsModal()}

async function handleRegister() {
    const first_name = document.getElementById("reg-firstname").value.trim();
    const last_name = document.getElementById("reg-lastname").value.trim();
    const email = document.getElementById("reg-email").value.trim();
    const password = document.getElementById("reg-password").value;
    const acceptedTerms = Boolean(document.getElementById("reg-accepted-terms")?.checked);

    if (!email || !password || !first_name || !last_name) {
        showMessage("Completa todos los campos.", "error");
        return;
    }

    if (!acceptedTerms) {
        showMessage("Debes aceptar las reglas, terminos y condiciones.", "error");
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
                accepted_terms: acceptedTerms,
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


async function showAccountSettings() {
    hideAllWalzWorkSections();
    const section = document.getElementById("account-settings-section");
    if (section) section.style.display = "block";
    window.scrollTo(0, 0);
    const currentToken = localStorage.getItem("walz_token");
    if (!currentToken) { handleExpiredSession(); return; }
    try {
        const response = await fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${currentToken}` } });
        if (response.status === 401) { handleExpiredSession(); return; }
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || "No se pudo cargar la cuenta.");
        const email = document.getElementById("account-current-email"); if (email) email.textContent = data.email || "";
        const firstName = document.getElementById("account-first-name"); if (firstName) firstName.value = data.first_name || "";
        const lastName = document.getElementById("account-last-name"); if (lastName) lastName.value = data.last_name || "";
        const phone = document.getElementById("account-phone"); if (phone) phone.value = data.phone || "";
    } catch (error) { showMessage(error.message, "error"); }
}

async function saveAccountProfile() {
    const firstName = document.getElementById("account-first-name")?.value.trim() || "";
    const lastName = document.getElementById("account-last-name")?.value.trim() || "";
    const phone = document.getElementById("account-phone")?.value.trim() || "";
    const message = document.getElementById("account-profile-message");
    const button = document.getElementById("account-profile-save-button");
    if (!firstName || !lastName) { if (message) message.textContent = "Completa tu nombre y apellido."; return; }
    if (button) { button.disabled = true; button.textContent = "Guardando..."; }
    try {
        const response = await fetch(`${API_URL}/auth/profile`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("walz_token")}` },
            body: JSON.stringify({ first_name: firstName, last_name: lastName, phone: phone || null })
        });
        const data = await response.json().catch(() => ({}));
        if (response.status === 401) { handleExpiredSession(); return; }
        if (!response.ok) throw new Error(data.detail || "No se pudieron guardar los datos.");
        if (message) { message.classList.add("account-success-message"); message.textContent = "Datos personales guardados correctamente."; }
    } catch (error) {
        if (message) { message.classList.remove("account-success-message"); message.textContent = error.message; }
    } finally {
        if (button) { button.disabled = false; button.textContent = "Guardar datos personales"; }
    }
}

async function changeAccountPassword() {
    const currentPassword = document.getElementById("change-password-current")?.value || "";
    const newPassword = document.getElementById("change-password-new")?.value || "";
    const confirmation = document.getElementById("change-password-confirm")?.value || "";
    const message = document.getElementById("change-password-message");
    const button = document.getElementById("change-password-button");
    if (currentPassword.length < 8 || newPassword.length < 8) { if (message) message.textContent = "Las contrasenas deben tener al menos 8 caracteres."; return; }
    if (newPassword !== confirmation) { if (message) message.textContent = "Las contrasenas nuevas no coinciden."; return; }
    if (button) { button.disabled = true; button.textContent = "Cambiando..."; }
    try {
        const response = await fetch(`${API_URL}/auth/change-password`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("walz_token")}` },
            body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
        });
        const data = await response.json().catch(() => ({}));
        if (response.status === 401) { handleExpiredSession(); return; }
        if (!response.ok) throw new Error(data.detail || "No se pudo cambiar la contrasena.");
        for (const id of ["change-password-current", "change-password-new", "change-password-confirm"]) document.getElementById(id).value = "";
        if (message) { message.classList.add("account-success-message"); message.textContent = data.message || "Contrasena actualizada correctamente."; }
    } catch (error) {
        if (message) { message.classList.remove("account-success-message"); message.textContent = error.message; }
    } finally {
        if (button) { button.disabled = false; button.textContent = "Cambiar contrasena"; }
    }
}
async function requestEmailChange() {
    const newEmail = document.getElementById("account-new-email")?.value.trim() || "";
    const currentPassword = document.getElementById("account-current-password")?.value || "";
    const message = document.getElementById("account-settings-message");
    const button = document.getElementById("account-email-change-button");
    if (!newEmail || currentPassword.length < 8) { if(message) message.textContent="Completa el correo nuevo y tu contrasena actual."; return; }
    if(button){button.disabled=true;button.textContent="Enviando..."}
    try {
        const response=await fetch(`${API_URL}/auth/request-email-change`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${localStorage.getItem("walz_token")}`},body:JSON.stringify({new_email:newEmail,current_password:currentPassword})});
        const data=await response.json().catch(()=>({}));
        if(response.status===401){handleExpiredSession();return} if(!response.ok)throw new Error(data.detail||"No se pudo solicitar el cambio.");
        if(message){message.classList.add("account-success-message");message.textContent=data.message}
        document.getElementById("account-current-password").value="";
    } catch(error){if(message){message.classList.remove("account-success-message");message.textContent=error.message}}
    finally{if(button){button.disabled=false;button.textContent="Enviar confirmacion"}}
}

function showConfirmEmailChange(){hideAuthForms();document.getElementById("confirm-email-change-form").style.display="flex"}

async function confirmEmailChange(){
    const tokenValue=new URLSearchParams(window.location.search).get("email_change_token")||"";const button=document.getElementById("confirm-email-change-button");
    if(!tokenValue){showMessage("El enlace no es valido.","error");return} if(button){button.disabled=true;button.textContent="Confirmando..."}
    try{const response=await fetch(`${API_URL}/auth/confirm-email-change`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token:tokenValue})});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.detail||"No se pudo cambiar el correo.");window.history.replaceState({},document.title,window.location.pathname);handleLogout();showMessage("Correo actualizado. Inicia sesion con el correo nuevo.","success")}
    catch(error){showMessage(error.message||"No se pudo cambiar el correo.","error");if(button){button.disabled=false;button.textContent="Confirmar correo"}}
}

async function closeMyAccount() {
    const password=document.getElementById("close-account-password")?.value||"";
    const confirmation=document.getElementById("close-account-confirmation")?.value.trim()||"";
    const message=document.getElementById("close-account-message");const button=document.getElementById("close-account-button");
    if(password.length<8||confirmation!=="CERRAR MI CUENTA"){if(message)message.textContent="Completa tu contrasena y escribe exactamente CERRAR MI CUENTA.";return}
    if(!confirm("Confirmas el cierre de tu cuenta? Tus publicaciones dejaran de estar visibles."))return;
    if(button){button.disabled=true;button.textContent="Cerrando cuenta..."}
    try{
        const response=await fetch(`${API_URL}/auth/close-account`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${localStorage.getItem("walz_token")}`},body:JSON.stringify({current_password:password,confirmation})});
        const data=await response.json().catch(()=>({}));if(response.status===401){handleExpiredSession();return}if(!response.ok)throw new Error(data.detail||"No se pudo cerrar la cuenta.");
        handleLogout();showMessage("Tu cuenta fue cerrada correctamente.","success");
    }catch(error){if(message)message.textContent=error.message||"No se pudo cerrar la cuenta.";if(button){button.disabled=false;button.textContent="Cerrar mi cuenta"}}
}

async function handleForgotPassword() {
    const emailInput = document.getElementById("forgot-password-email");
    const button = document.getElementById("forgot-password-button");
    const email = emailInput?.value.trim() || "";
    if (!email) { showMessage("Ingresa tu correo electronico.", "error"); return; }
    if (button) { button.disabled = true; button.textContent = "Enviando..."; }
    try {
        const response = await fetch(`${API_URL}/auth/forgot-password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || "No se pudo procesar la solicitud.");
        showMessage(data.message || "Si el correo esta registrado, recibiras un enlace.", "success");
        if (emailInput) emailInput.value = "";
    } catch (error) {
        showMessage(error.message || "No se pudo procesar la solicitud.", "error");
    } finally {
        if (button) { button.disabled = false; button.textContent = "Enviar enlace"; }
    }
}

async function handleResetPassword() {
    const password = document.getElementById("reset-password-new")?.value || "";
    const confirmation = document.getElementById("reset-password-confirm")?.value || "";
    const button = document.getElementById("reset-password-button");
    const resetToken = new URLSearchParams(window.location.search).get("reset_token") || "";
    if (password.length < 8) { showMessage("La contrasena debe tener al menos 8 caracteres.", "error"); return; }
    if (password !== confirmation) { showMessage("Las contrasenas no coinciden.", "error"); return; }
    if (!resetToken) { showMessage("El enlace de recuperacion no es valido.", "error"); return; }
    if (button) { button.disabled = true; button.textContent = "Guardando..."; }
    try {
        const response = await fetch(`${API_URL}/auth/reset-password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: resetToken, new_password: password })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || "No se pudo actualizar la contrasena.");
        window.history.replaceState({}, document.title, window.location.pathname);
        showLogin();
        showMessage("Contrasena actualizada. Ya puedes iniciar sesion.", "success");
    } catch (error) {
        showMessage(error.message || "No se pudo actualizar la contrasena.", "error");
    } finally {
        if (button) { button.disabled = false; button.textContent = "Guardar nueva contrasena"; }
    }
}


function clearLoginCredentials() {
    const emailInput = document.getElementById("login-email");
    const passwordInput = document.getElementById("login-password");

    if (emailInput) emailInput.value = "";
    if (passwordInput) passwordInput.value = "";
}

function prepareLocalLoginForm() {
    const isLocal =
        window.location.hostname === "127.0.0.1" ||
        window.location.hostname === "localhost";

    if (!isLocal) return;

    const emailInput = document.getElementById("login-email");
    const passwordInput = document.getElementById("login-password");

    if (emailInput) {
        emailInput.setAttribute("autocomplete", "off");
        emailInput.value = "";
    }

    if (passwordInput) {
        passwordInput.setAttribute("autocomplete", "new-password");
        passwordInput.value = "";
    }
}

window.addEventListener("pageshow", () => {
    window.setTimeout(prepareLocalLoginForm, 100);
});

document.addEventListener("DOMContentLoaded", () => {
    window.setTimeout(prepareLocalLoginForm, 100);
});


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
            localStorage.setItem("walz_refresh_token", data.refresh_token || "");
            startWalzSessionRenewal();

            currentUserId = data.user.id;
            localStorage.setItem("walz_user_id", currentUserId);
            currentUserRole = String(data.user.role || "").toUpperCase();
            localStorage.setItem("walz_user_role", currentUserRole);
            updateAdminBannerVisibility();
            await loadCurrentUserProfile();

            cart =
                currentUserRole === "COMPRADOR"
                    ? mergeGuestCartIntoBuyerCart()
                    : loadCart();

            pendingCheckout = null;
            updateCartUI();

            showMessage(
                "Bienvenido a WalZ!",
                "success"
            );

            showMarketplace();

            if (currentUserRole === "ADMIN") {
                showAdminCentralPanel();
            } else {
                showMarketplaceContent();
                await loadProducts();
                await loadActiveBanners();
            }

            // WALZ_LOGIN_KEYBOARD_V1
        for (const fieldId of ["login-email", "login-password"]) {
            document.getElementById(fieldId)?.addEventListener("keydown", event => {
                if (event.key !== "Enter" || event.repeat) return;
                event.preventDefault();
                handleLogin();
            });
        }

        updateCartUI();
        showWalzNewsBarIfAllowed();

        } else {

            showMessage(
                data.detail || "Credenciales incorrectas.",
                "error"
            );
        }

    } catch (e) {

        console.error(
            "Error al iniciar sesion:",
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
    localStorage.removeItem("walz_refresh_token");
    stopWalzSessionRenewal();

    currentUserId = null;

    localStorage.removeItem("walz_user_id");
    currentUserRole = "";
    localStorage.removeItem("walz_user_role");
    updateAdminBannerVisibility();
    stopAdminNotifications();
    stopSellerOrderNotifications();
    stopWalzDeviceSync();

    cart = loadCart();

    updateCartUI();

    clearLoginCredentials();
    prepareLocalLoginForm();

    hideAllWalzWorkSections();
    showMarketplace();
    showMarketplaceContent();
    loadProducts();


}


let walzSessionRefreshPromise = null;

async function refreshWalzSession() {
    const refreshToken = localStorage.getItem("walz_refresh_token");
    if (!refreshToken) return false;
    if (walzSessionRefreshPromise) return walzSessionRefreshPromise;

    walzSessionRefreshPromise = (async () => {
        try {
            const response = await fetch(`${API_URL}/auth/refresh`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ refresh_token: refreshToken })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.access_token || !data.refresh_token) return false;
            token = data.access_token;
            localStorage.setItem("walz_token", data.access_token);
            localStorage.setItem("walz_refresh_token", data.refresh_token);
            return true;
        } catch (error) {
            console.error("No se pudo renovar la sesion:", error);
            return false;
        } finally {
            walzSessionRefreshPromise = null;
        }
    })();
    return walzSessionRefreshPromise;
}

function stopWalzSessionRenewal() {
    if (window.walzSessionRenewalTimer) {
        clearInterval(window.walzSessionRenewalTimer);
        window.walzSessionRenewalTimer = null;
    }
}

function startWalzSessionRenewal() {
    stopWalzSessionRenewal();
    if (!localStorage.getItem("walz_refresh_token")) return;
    window.walzSessionRenewalTimer = setInterval(async () => {
        const renewed = await refreshWalzSession();
        if (!renewed) handleExpiredSession();
    }, 20 * 60 * 1000);
}


let isHandlingExpiredSession = false;

function handleExpiredSession() {
    if (isHandlingExpiredSession || !localStorage.getItem("walz_token")) return;

    isHandlingExpiredSession = true;

    const savedCart = Array.isArray(cart) ? [...cart] : [];

    handleLogout();

    cart = savedCart;
    saveCart();
    updateCartUI();

    showMessage(
        "Tu sesion vencio. Podes seguir explorando o iniciar sesion nuevamente.",
        "error"
    );

    window.setTimeout(() => {
        isHandlingExpiredSession = false;
    }, 500);
}


// =====================================================
// PRODUCTOS
// =====================================================

async function optimizeProductImage(file) {
    if (!file || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Selecciona una imagen JPG, PNG o WebP.");
    if (file.size > 12 * 1024 * 1024) throw new Error("La imagen original no puede superar 12 MB.");
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1200 / bitmap.width, 800 / bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/webp", 0.82));
    if (!blob) throw new Error("No se pudo preparar la imagen.");
    return blob;
}

async function uploadNewProductImage(file) {
    const blob = await optimizeProductImage(file); const form = new FormData();
    form.append("image", blob, "producto.webp");
    const response = await fetch(`${API_URL}/products/images`, { method: "POST", headers: { Authorization: `Bearer ${localStorage.getItem("walz_token")}` }, body: form });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || "No se pudo subir la imagen.");
    return data.image_url;
}


async function handleEditProductImageSelection(productId, event) {
    const input = event?.target;
    const file = input?.files?.[0];

    if (!file) return;

    const imageField =
        document.getElementById(
            `edit-product-image-${productId}`
        );

    const status =
        document.getElementById(
            `edit-product-image-status-${productId}`
        );

    const preview =
        document.getElementById(
            `edit-product-image-preview-${productId}`
        );

    if (!imageField) {
        showMessage(
            "No se encontro el campo de imagen.",
            "error"
        );
        return;
    }

    input.disabled = true;

    if (status) {
        status.textContent =
            "Preparando y subiendo imagen...";
    }

    try {
        const imageUrl =
            await uploadNewProductImage(file);

        if (!imageUrl) {
            throw new Error(
                "La imagen se subio pero no devolvio una URL."
            );
        }

        imageField.value = imageUrl;

        if (preview) {
            preview.innerHTML =
                renderProductImage(
                    imageUrl,
                    "Vista previa",
                    "product-card-image"
                );
        }

        saveCurrentMyProductDraft();

        input.value = "";

        if (status) {
            status.textContent =
                "Imagen preparada y conservada. Guarda los cambios del producto.";
        }

        showMessage(
            "Imagen preparada correctamente.",
            "success"
        );

    } catch (error) {
        console.error(
            "Error preparando imagen del producto:",
            error
        );

        if (status) {
            status.textContent =
                "No se pudo preparar la imagen.";
        }

        showMessage(
            error.message ||
            "No se pudo subir la imagen.",
            "error"
        );

    } finally {
        input.disabled = false;
    }
}


function previewNewProductImage() {
    const file = document.getElementById("prod-image-file")?.files?.[0]; const preview = document.getElementById("prod-image-preview");
    if (!preview) return; if (!file) { preview.textContent = "Sin imagen seleccionada"; return; }
    const url = URL.createObjectURL(file); preview.innerHTML = `<img src="${url}" alt="Vista previa">`;
}

// =====================================================
// CARGA RAPIDA DESDE WHATSAPP
// =====================================================

function inferWhatsAppProductCategory(text) {
    const value = String(text || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

    const rules = [
        {
            words: [
                "perfume", "crema", "shampoo", "acondicionador",
                "maquillaje", "labial", "mascara", "serum",
                "esmalte", "cosmetica"
            ],
            category: "Belleza y cuidado personal",
            subcategory: "Cuidado personal"
        },
        {
            words: [
                "sabana", "acolchado", "toalla", "cortina",
                "almohada", "organizador", "blanqueria",
                "frazada", "mantel"
            ],
            category: "Hogar",
            subcategory: "Textil y organizacion"
        },
        {
            words: [
                "termo", "mate", "vaso", "botella", "taza",
                "olla", "sarten", "cubierto", "cocina",
                "vajilla"
            ],
            category: "Bazar y cocina",
            subcategory: "Cocina y accesorios"
        },
        {
            words: [
                "remera", "pantalon", "buzo", "campera",
                "vestido", "cartera", "mochila", "zapatilla",
                "gorra", "bijou", "collar", "pulsera"
            ],
            category: "Moda y accesorios",
            subcategory: "Indumentaria y accesorios"
        },
        {
            words: [
                "auricular", "cargador", "cable", "parlante",
                "smartwatch", "celular", "iphone", "telefono",
                "powerbank"
            ],
            category: "Tecnologia y accesorios",
            subcategory: "Accesorios tecnologicos"
        },
        {
            words: [
                "juguete", "muneca", "peluche", "juego",
                "regalo"
            ],
            category: "Regalos y varios",
            subcategory: "Juguetes y regalos"
        }
    ];

    for (const rule of rules) {
        if (rule.words.some(word => value.includes(word))) {
            return {
                category: rule.category,
                subcategory: rule.subcategory
            };
        }
    }

    return {
        category: "",
        subcategory: ""
    };
}


function buildWhatsAppProductTitle(text) {
    const firstUsefulLine = String(text || "")
        .split(/\r?\n/)
        .map(line => line.trim())
        .find(line => line.length > 0) || "Producto";

    let title = firstUsefulLine
        .replace(/https?:\/\/\S+/gi, "")
        .replace(/\$\s*[\d.,]+/g, "")
        .replace(/[*_~|]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    if (!title) title = "Producto";

    return title.slice(0, 140);
}


function buildWhatsAppProductDescription(text) {
    const lines = String(text || "")
        .split(/\r?\n/)
        .map(line => {
            return line
                .replace(/https?:\/\/\S+/gi, "")
                .replace(/wa\.me\/\S+/gi, "")
                .replace(/\$\s*[\d.,]+/g, "")
                .replace(/\s+/g, " ")
                .trim();
        })
        .filter(line => {
            if (!line) return false;

            if (
                /^(precio mayorista|pedido minimo|pedido mínimo)\b/i.test(line)
            ) {
                return false;
            }

            return true;
        });

    return lines.join("\n").slice(0, 1000);
}

function prepareWhatsAppProduct() {
    const source =
        document.getElementById("wa-product-source")?.value.trim() || "";

    const originalText =
        document.getElementById("wa-product-original-text")?.value.trim() || "";

    const cost =
        Number(document.getElementById("wa-product-cost")?.value);

    const margin =
        Number(document.getElementById("wa-product-margin")?.value);

    const stock =
        parseInt(
            document.getElementById("wa-product-stock")?.value || "1",
            10
        );

    const imageFile =
        document.getElementById("wa-product-image")?.files?.[0] || null;

    if (!originalText) {
        showMessage(
            "Pega primero el mensaje recibido del proveedor.",
            "error"
        );
        return;
    }

    if (!Number.isFinite(cost) || cost <= 0) {
        showMessage(
            "Ingresa el costo del producto.",
            "error"
        );
        return;
    }

    if (!Number.isFinite(margin) || margin < 0) {
        showMessage(
            "Ingresa un margen valido.",
            "error"
        );
        return;
    }

    if (!Number.isInteger(stock) || stock < 0) {
        showMessage(
            "El stock debe ser un numero entero igual o mayor que cero.",
            "error"
        );
        return;
    }

    const calculatedPrice =
        Math.round((cost * (1 + margin / 100)) * 100) / 100;

    const title =
        buildWhatsAppProductTitle(originalText);

    const description =
        buildWhatsAppProductDescription(originalText);

    const classification =
        inferWhatsAppProductCategory(originalText);

    document.getElementById("prod-name").value =
        title;

    document.getElementById("prod-price").value =
        calculatedPrice.toFixed(2);

    document.getElementById("prod-stock").value =
        stock;

    document.getElementById("prod-category").value =
        classification.category;

    document.getElementById("prod-subcategory").value =
        classification.subcategory;

    document.getElementById("prod-description").value =
        description;

    document.getElementById("prod-commercial-type").value =
        "";

    document.getElementById("prod-commercial-text").value =
        "";

    document.getElementById("prod-offer-price").value =
        "";

    window.walzPreparedWhatsAppImage =
        imageFile || null;

    window.walzPreparedFromWhatsApp = true;

    window.walzPreparedWhatsAppSource =
        source;

    const preview =
        document.getElementById("prod-image-preview");

    if (preview && imageFile) {
        const previewUrl =
            URL.createObjectURL(imageFile);

        preview.innerHTML =
            `<img src="${previewUrl}" alt="Vista previa">`;
    }

    const createSection =
        document.getElementById("seller-product-create-section");

    if (createSection) {
        createSection.style.display = "block";
        createSection.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }

    showMessage(
        "Producto preparado. Revisa los datos antes de publicarlo.",
        "success"
    );

    setTimeout(() => {
        document.getElementById("prod-name")?.focus();
    }, 500);
}

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

    let commercialType =
        document.getElementById("prod-commercial-type")?.value.trim() || "";

    const commercialText =
        document.getElementById("prod-commercial-text")?.value.trim() || "";

    const offerPriceText =
        document.getElementById("prod-offer-price")?.value.trim() || "";

    const offerPrice =
        offerPriceText ? Number(offerPriceText) : null;

    if (offerPrice !== null && !commercialType) {
        commercialType = "OFERTA";
    }

    const commercialActive = Boolean(commercialType);
    const offerActive = offerPrice !== null;

    const stock =
        parseInt(
            document.getElementById("prod-stock").value
        );

    const category =
        document.getElementById("prod-category").value.trim();

    const subcategory =
        document.getElementById("prod-subcategory").value.trim();

    const brand =
        document.getElementById("prod-brand").value.trim();

    const avanterEnabled =
        Boolean(document.getElementById("prod-avanter-enabled")?.checked);

    const description =
        document.getElementById("prod-description").value.trim();

    let imageUrl = document.getElementById("prod-image-url").value.trim();
    const imageFile = document.getElementById("prod-image-file")?.files?.[0] || window.walzPreparedWhatsAppImage || null;

    if (!name || isNaN(price) || isNaN(stock)) {

        showMessage(
            "Completa los datos.",
            "error"
        );

        return;
    }

    if (offerActive && (!Number.isFinite(offerPrice) || offerPrice <= 0)) {
        showMessage(
            "Ingresa un precio promocional valido.",
            "error"
        );
        return;
    }

    if (offerActive && offerPrice >= price) {
        showMessage(
            "El precio promocional debe ser menor que el precio normal.",
            "error"
        );
        return;
    }

    if (commercialActive && commercialType === "OFERTA" && offerPrice === null) {
        showMessage(
            "Una oferta activa necesita un precio promocional.",
            "error"
        );
        return;
    }

    try {
        if (imageFile) {
            showMessage("Preparando y subiendo imagen...", "success");
            imageUrl = await uploadNewProductImage(imageFile);
        }

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
                    offer_price: offerPrice,
                    offer_active: offerActive,
                    commercial_type: commercialType || null,
                    commercial_text: commercialText || null,
                    commercial_active: commercialActive,
                    stock,
                    category: category || null,
                    subcategory: subcategory || null,
                    brand: brand || null,
                    avanter_enabled: avanterEnabled,
                    description: description || null,
                    image_url: imageUrl || null
                })
            }
        );

        const text = await res.text();

        console.log(
            "Respuesta creacion producto:",
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

            document.getElementById("prod-commercial-type").value = "";
            document.getElementById("prod-commercial-text").value = "";
            document.getElementById("prod-offer-price").value = "";

            document.getElementById(
                "prod-stock"
            ).value = "";

            document.getElementById("prod-category").value = "";
            document.getElementById("prod-subcategory").value = "";
            document.getElementById("prod-brand").value = "";
            document.getElementById("prod-avanter-enabled").checked = false;
            document.getElementById("prod-description").value = "";
            document.getElementById("prod-image-url").value = "";
            document.getElementById("prod-image-file").value = "";
            document.getElementById("prod-image-preview").textContent = "Sin imagen seleccionada";

            if (window.walzPreparedFromWhatsApp) {
                window.walzPreparedWhatsAppImage = null;
                window.walzPreparedFromWhatsApp = false;

                const waText = document.getElementById("wa-product-original-text");
                const waCost = document.getElementById("wa-product-cost");
                const waStock = document.getElementById("wa-product-stock");
                const waImage = document.getElementById("wa-product-image");

                if (waText) waText.value = "";
                if (waCost) waCost.value = "";
                if (waStock) waStock.value = "1";
                if (waImage) waImage.value = "";
            }

            await Promise.all([loadMyProducts(), loadProducts()]);

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



function openCentralMarketplace() {
    window.walzMarketplaceSellerId = null;
    window.walzPublicStoreSellerId = null;

    window.location.assign("/");
}


async function loadProducts() {

    try {

        const [res, storesResponse] = await Promise.all([
            fetch(`${API_URL}/products/`),
            fetch(`${API_URL}/stores/public`)
        ]);

        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }

        const products = await res.json();
        const stores = storesResponse.ok
            ? await storesResponse.json()
            : [];

        window.walzStoresByOwner = Object.fromEntries(
            (Array.isArray(stores) ? stores : []).map(store => [
                String(store.owner_id),
                store
            ])
        );
        // La portada general de WalZ One SIEMPRE es general.
        // Un marketplace particular se activa solamente
        // cuando la ruta publica de una tienda establece
        // window.walzMarketplaceSellerId.
        const marketplaceSellerId =
            window.walzMarketplaceSellerId || null;

        const sellerMarketplace =
            Boolean(marketplaceSellerId);

        const directStoreMarketplaceButton =
            document.getElementById("direct-store-marketplace-button");

        if (directStoreMarketplaceButton) {
            directStoreMarketplaceButton.style.display =
                sellerMarketplace ? "inline-flex" : "none";

            if (sellerMarketplace) {
                const openedFromAdmin =
                    new URLSearchParams(window.location.search).get("from") === "admin";

                directStoreMarketplaceButton.textContent = openedFromAdmin
                    ? "← Volver a Administracion Central"
                    : "← Marketplace";
            }
        }

        const visibleProducts = sellerMarketplace
            ? products.filter(product =>
                String(product.seller_id) === String(marketplaceSellerId)
            )
            : products;

        window.walzProducts = visibleProducts;

        renderSellerMarketplaceClassification(
            visibleProducts,
            sellerMarketplace,
            marketplaceSellerId
        );

        syncCartWithProducts(visibleProducts);

        renderProducts(visibleProducts);

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
    return /^(https?:\/\/|blob:)/i.test(url) ? url : "";
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

function getProductCommercialLabel(product) {
    const type = String(product?.commercial_type || "").trim().toUpperCase();

    const labels = {
        OFERTA: "Oferta",
        PROMOCION: "Promocion",
        NOVEDAD: "Novedad",
        COMBO: "Combo",
        "2X1": "2x1",
        LIQUIDACION: "Liquidacion",
        BENEFICIO: "Beneficio especial"
    };

    if (product?.commercial_active && labels[type]) {
        return labels[type];
    }

    if (hasActiveProductOffer(product)) {
        return "Oferta";
    }

    return "";
}

function renderProductPrice(product) {
    const normalPrice = Number(product?.price || 0);
    const effectivePrice = getProductEffectivePrice(product);
    const commercialLabel = getProductCommercialLabel(product);
    const commercialText = product?.commercial_active
        ? String(product?.commercial_text || "").trim()
        : "";

    const commercialInfo = commercialLabel
        ? `
            <span class="product-offer-badge">${escapeHtml(commercialLabel)}</span>
            ${commercialText
                ? `<span class="product-commercial-text">${escapeHtml(commercialText)}</span>`
                : ""}
        `
        : "";

    if (hasActiveProductOffer(product)) {
        return `
            <span class="product-normal-price">$${normalPrice.toFixed(2)}</span>
            <span class="product-offer-price">$${effectivePrice.toFixed(2)}</span>
            ${commercialInfo}
        `;
    }

    return `
        <span class="product-current-price">$${normalPrice.toFixed(2)}</span>
        ${commercialInfo}
    `;
}


function renderProductStoreIdentity(product) {
    const store = window.walzStoresByOwner?.[String(product?.seller_id)];
    const storeName = store?.name || "Vendedor WalZ";
    const storeCity = String(store?.city || "").trim();
    const logoUrl = getProductImageUrl(store?.logo_url);
    const initial = storeName.trim().charAt(0).toUpperCase() || "W";
    const logo = logoUrl
        ? `<img src="${escapeHtml(logoUrl)}" alt="Logo de ${escapeHtml(storeName)}" loading="lazy" onerror="this.outerHTML='<span class=&quot;product-store-initial&quot;>${escapeHtml(initial)}</span>'">`
        : `<span class="product-store-initial">${escapeHtml(initial)}</span>`;

    return `
        <button
            type="button"
            class="product-store-identity"
            onclick="event.stopPropagation(); showPublicStore('${product.seller_id}')"
            aria-label="Ver tienda ${escapeHtml(storeName)}"
        >
            <span class="product-store-logo">${logo}</span>
            <span class="product-store-copy">
                <strong>${escapeHtml(storeName)}</strong>
                <small>${storeCity ? escapeHtml(storeCity) : "Tienda en WalZ One"}</small>
            </span>
            <span class="product-store-arrow" aria-hidden="true">&rsaquo;</span>
        </button>
    `;
}


function renderSellerMarketplaceClassification(
    products,
    isSellerMarketplace,
    marketplaceSellerId = null
) {
    const section = document.querySelector(".walz-macro-section");
    const grid = section?.querySelector(".walz-macro-grid");

    if (!section || !grid) return;

    const eyebrow =
        section.querySelector(".walz-section-heading span");

    const title =
        section.querySelector("#walz-macro-title");

    const note =
        section.querySelector(".walz-section-heading > small");

    if (!window.walzDefaultMacroClassification) {
        window.walzDefaultMacroClassification = {
            html: grid.innerHTML,
            eyebrow: eyebrow?.textContent || "",
            title: title?.textContent || "",
            note: note?.textContent || ""
        };
    }

    const heroBubbles =
        Array.from(
            document.querySelectorAll(
                ".walz-city-bubble"
            )
        );

    if (!window.walzDefaultHeroBubbleTexts) {
        window.walzDefaultHeroBubbleTexts =
            heroBubbles.map(
                bubble =>
                    String(
                        bubble.textContent || ""
                    ).trim()
            );
    }

    const exploreSection =
        document.querySelector(".walz-explore-section");

    const exploreGrid =
        exploreSection?.querySelector(
            ".walz-explore-grid"
        );

    if (
        exploreGrid &&
        !window.walzDefaultExploreHtml
    ) {
        window.walzDefaultExploreHtml =
            exploreGrid.innerHTML;
    }

    if (!isSellerMarketplace) {
        const original = window.walzDefaultMacroClassification;

        document
            .querySelector(".walz-seller-marketplace-identity")
            ?.remove();

        document
            .querySelector(".walz-seller-avanter-hero")
            ?.remove();

        const publicSearchExamples =
            document.querySelector(".walz-search-examples");

        if (
            publicSearchExamples &&
            window.walzDefaultSearchExamplesHtml
        ) {
            publicSearchExamples.innerHTML =
                window.walzDefaultSearchExamplesHtml;
        }

        grid.innerHTML = original.html;

        if (eyebrow) eyebrow.textContent = original.eyebrow;
        if (title) title.textContent = original.title;
        if (note) note.textContent = original.note;

        window.walzMarketplaceCategoryFilter = "";
        window.walzMarketplaceSubcategoryFilter = "";

        document
            .getElementById("walz-seller-filter-notice")
            ?.remove();

        if (
            exploreGrid &&
            window.walzDefaultExploreHtml
        ) {
            exploreGrid.innerHTML =
                window.walzDefaultExploreHtml;
        }

        heroBubbles.forEach(
            (bubble, index) => {
                bubble.textContent =
                    window.walzDefaultHeroBubbleTexts[index] || "";

                bubble.style.display = "";
                bubble.onclick = null;
                bubble.onkeydown = null;
                bubble.classList.remove(
                    "walz-city-bubble-clickable"
                );
                bubble.removeAttribute("role");
                bubble.removeAttribute("tabindex");
            }
        );

        document
            .querySelector(".walz-hero-city")
            ?.setAttribute("aria-hidden", "true");

        return;
    }

    const sellerProducts =
        Array.isArray(products) ? products : [];

    const storeOwnerId =
        marketplaceSellerId || currentUserId;

    const store =
        window.walzStoresByOwner?.[String(storeOwnerId)] || {};

    const storeName =
        String(
            store.name ||
            store.business_name ||
            "Tu tienda"
        ).trim();

    const city =
        String(store.city || "").trim();

    const storeDescription =
        String(store.description || "").trim() ||
        `Explor\u00e1 productos y propuestas de ${storeName}.`;

    const categoryCounts = new Map();
    const subcategoryCounts = new Map();

    sellerProducts.forEach(product => {
        const category =
            String(product.category || "").trim();

        const subcategory =
            String(product.subcategory || "").trim();

        if (category) {
            categoryCounts.set(
                category,
                (categoryCounts.get(category) || 0) + 1
            );
        }

        if (subcategory) {
            subcategoryCounts.set(
                subcategory,
                (subcategoryCounts.get(subcategory) || 0) + 1
            );
        }
    });

    const categoriesByUse =
        [...categoryCounts.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([name]) => name);

    const subcategoriesByUse =
        [...subcategoryCounts.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([name]) => name);

    const heroTerms = [];

    const addHeroTerm = value => {
        const term = String(value || "").trim();

        if (!term) return;

        const alreadyExists =
            heroTerms.some(
                current =>
                    current.toLowerCase() ===
                    term.toLowerCase()
            );

        if (!alreadyExists) {
            heroTerms.push(term);
        }
    };

    addHeroTerm(categoriesByUse[0]);
    addHeroTerm(subcategoriesByUse[0]);
    addHeroTerm(categoriesByUse[1]);
    addHeroTerm(subcategoriesByUse[1]);

    categoriesByUse.forEach(addHeroTerm);
    subcategoriesByUse.forEach(addHeroTerm);

    sellerProducts.forEach(product => {
        if (heroTerms.length < 4) {
            addHeroTerm(product.name);
        }
    });

    heroBubbles.forEach(
        (bubble, index) => {
            const term = heroTerms[index];

            if (!term) {
                bubble.style.display = "none";
                bubble.onclick = null;
                bubble.onkeydown = null;
                return;
            }

            bubble.style.display = "";
            bubble.textContent = term;
            bubble.title = `Ver ${term}`;
            bubble.classList.add(
                "walz-city-bubble-clickable"
            );

            const isCategory =
                categoriesByUse.includes(term);

            const matchingProduct =
                sellerProducts.find(
                    product =>
                        String(
                            product.subcategory || ""
                        ).trim() === term
                );

            const category =
                isCategory
                    ? term
                    : String(
                        matchingProduct?.category || ""
                    ).trim();

            const subcategory =
                isCategory
                    ? ""
                    : term;

            const openBubbleFilter = () => {
                setSellerMarketplaceClassification(
                    category,
                    subcategory
                );

                setTimeout(() => {
                    document
                        .getElementById("product-list")
                        ?.scrollIntoView({
                            behavior: "smooth",
                            block: "start"
                        });
                }, 50);
            };

            bubble.onclick =
                openBubbleFilter;

            bubble.setAttribute(
                "role",
                "button"
            );

            bubble.setAttribute(
                "tabindex",
                "0"
            );

            bubble.onkeydown =
                event => {
                    if (
                        event.key === "Enter" ||
                        event.key === " "
                    ) {
                        event.preventDefault();
                        openBubbleFilter();
                    }
                };
        }
    );

    document
        .querySelector(".walz-hero-city")
        ?.removeAttribute("aria-hidden");

    // ========================================================
    // EXPLORA A TU MANERA - CONTENIDO REAL DE LA TIENDA
    // ========================================================

    if (exploreGrid) {
        exploreGrid.innerHTML = "";

        const addExploreCard = ({
            symbol,
            title,
            text,
            action
        }) => {
            const card =
                document.createElement("article");

            card.className =
                "walz-explore-card";

            card.setAttribute(
                "role",
                "button"
            );

            card.setAttribute(
                "tabindex",
                "0"
            );

            card.innerHTML = `
                <span class="walz-explore-symbol">
                    ${symbol}
                </span>

                <strong>${escapeHtml(title)}</strong>
                <small>${escapeHtml(text)}</small>
            `;

            const runAction = () => {
                if (typeof action === "function") {
                    action();
                }
            };

            card.addEventListener(
                "click",
                runAction
            );

            card.addEventListener(
                "keydown",
                event => {
                    if (
                        event.key === "Enter" ||
                        event.key === " "
                    ) {
                        event.preventDefault();
                        runAction();
                    }
                }
            );

            exploreGrid.appendChild(card);
        };


        // ----------------------------------------------------
        // PRODUCTOS
        // ----------------------------------------------------

        addExploreCard({
            symbol: "&#128722;",
            title: "Productos",
            text:
                sellerProducts.length === 1
                    ? "1 producto activo"
                    : `${sellerProducts.length} productos activos`,
            action: () => {
                setSellerMarketplaceClassification(
                    "",
                    ""
                );

                document
                    .getElementById("product-list")
                    ?.scrollIntoView({
                        behavior: "smooth",
                        block: "start"
                    });
            }
        });


        // ----------------------------------------------------
        // RUBROS
        // ----------------------------------------------------

        if (categoryCounts.size > 0) {
            addExploreCard({
                symbol: "&#128194;",
                title: "Rubros",
                text:
                    categoryCounts.size === 1
                        ? "1 rubro disponible"
                        : `${categoryCounts.size} rubros disponibles`,
                action: () => {
                    setSellerMarketplaceClassification(
                        "",
                        ""
                    );

                    document
                        .querySelector(
                            ".walz-macro-section"
                        )
                        ?.scrollIntoView({
                            behavior: "smooth",
                            block: "start"
                        });
                }
            });
        }


        // ----------------------------------------------------
        // BONOS AVANTER
        // ----------------------------------------------------

        const avanterProducts =
            sellerProducts.filter(
                product =>
                    product.avanter_enabled === true
            );

        if (
            store.avanter_enabled === true &&
            avanterProducts.length > 0
        ) {
            addExploreCard({
                symbol: "&#127915;",
                title: "Bonos Avanter",
                text:
                    avanterProducts.length === 1
                        ? "1 producto adherido"
                        : `${avanterProducts.length} productos adheridos`,
                action: () => {
                    const info =
                        document.getElementById(
                            "walz-seller-avanter-info"
                        );

                    if (info) {
                        info.hidden = false;

                        info.scrollIntoView({
                            behavior: "smooth",
                            block: "start"
                        });
                    }
                }
            });
        }


        // ----------------------------------------------------
        // OFERTAS / PROMOCIONES
        // Solo aparece si realmente existen.
        // ----------------------------------------------------

        const commercialProducts =
            sellerProducts.filter(
                product =>
                    product.offer_active === true ||
                    product.commercial_active === true
            );

        if (commercialProducts.length > 0) {
            addExploreCard({
                symbol: "&#10024;",
                title: "Ofertas y promociones",
                text:
                    commercialProducts.length === 1
                        ? "1 propuesta activa"
                        : `${commercialProducts.length} propuestas activas`,
                action: () => {
                    renderProducts(
                        commercialProducts
                    );

                    document
                        .getElementById("product-list")
                        ?.scrollIntoView({
                            behavior: "smooth",
                            block: "start"
                        });
                }
            });
        }


        // ----------------------------------------------------
        // CONTACTO
        // Solo aparece cuando la tienda tiene datos cargados.
        // ----------------------------------------------------

        const hasContact =
            Boolean(
                String(store.phone || "").trim() ||
                String(store.address || "").trim()
            );

        if (hasContact) {
            addExploreCard({
                symbol: "&#128222;",
                title: "Contacto",
                text:
                    String(store.phone || "").trim() ||
                    String(store.address || "").trim(),
                action: () => {
                    document
                        .querySelector(
                            ".walz-seller-marketplace-identity"
                        )
                        ?.scrollIntoView({
                            behavior: "smooth",
                            block: "start"
                        });
                }
            });
        }
    }

    const sellerSearchInput =
        document.getElementById("product-search");

    const sellerSearchIcon =
        document.querySelector(
            ".walz-main-search-icon"
        );

    if (
        sellerSearchInput &&
        !sellerSearchInput.dataset.walzSellerSearchBound
    ) {
        sellerSearchInput.dataset.walzSellerSearchBound =
            "true";

        sellerSearchInput.addEventListener(
            "keydown",
            event => {
                if (event.key !== "Enter") return;

                if (
                    !document.querySelector(
                        ".walz-seller-marketplace-identity"
                    )
                ) {
                    return;
                }

                event.preventDefault();

                executeSellerMarketplaceSearch();
            }
        );
    }

    if (
        sellerSearchIcon &&
        !sellerSearchIcon.dataset.walzSellerSearchBound
    ) {
        sellerSearchIcon.dataset.walzSellerSearchBound =
            "true";

        sellerSearchIcon.removeAttribute(
            "aria-hidden"
        );

        sellerSearchIcon.setAttribute(
            "role",
            "button"
        );

        sellerSearchIcon.setAttribute(
            "tabindex",
            "0"
        );

        sellerSearchIcon.title = "Buscar";

        sellerSearchIcon.addEventListener(
            "click",
            () => {
                if (
                    document.querySelector(
                        ".walz-seller-marketplace-identity"
                    )
                ) {
                    executeSellerMarketplaceSearch();
                }
            }
        );

        sellerSearchIcon.addEventListener(
            "keydown",
            event => {
                if (
                    event.key !== "Enter" &&
                    event.key !== " "
                ) {
                    return;
                }

                event.preventDefault();

                executeSellerMarketplaceSearch();
            }
        );
    }

    const searchExamples =
        document.querySelector(".walz-search-examples");

    if (searchExamples) {

        if (!window.walzDefaultSearchExamplesHtml) {
            window.walzDefaultSearchExamplesHtml =
                searchExamples.innerHTML;
        }

        const subcategories = sellerProducts
            .map(product =>
                String(product.subcategory || "").trim()
            )
            .filter(Boolean);

        const categories = sellerProducts
            .map(product =>
                String(product.category || "").trim()
            )
            .filter(Boolean);

        const sellerSearchTerms = [
            ...new Set([
                ...subcategories,
                ...categories
            ])
        ].slice(0, 5);

        searchExamples.innerHTML = "";

        const searchLabel =
            document.createElement("strong");

        searchLabel.className =
            "walz-seller-search-label";

        searchLabel.textContent =
            `Busc? en ${storeName}:`;

        searchExamples.appendChild(searchLabel);

        sellerSearchTerms.forEach(term => {
            const chip =
                document.createElement("span");

            chip.textContent = term;

            searchExamples.appendChild(chip);
        });
    }

    let sellerIdentity =
        document.querySelector(
            ".walz-seller-marketplace-identity"
        );

    if (!sellerIdentity) {
        sellerIdentity = document.createElement("div");
        sellerIdentity.className =
            "walz-seller-marketplace-identity";
    }

    const discoveryHero =
        document.querySelector(".walz-discovery-hero");

    document
        .querySelector(".walz-seller-avanter-hero")
        ?.remove();

    if (
        store.avanter_enabled === true &&
        discoveryHero
    ) {
        const discoveryCopy =
            discoveryHero.querySelector(
                ".walz-discovery-copy"
            );

        const examples =
            discoveryHero.querySelector(
                ".walz-search-examples"
            );

        if (discoveryCopy) {
            const avanterHero =
                document.createElement("div");

            avanterHero.className =
                "walz-seller-avanter-hero";

            const avanterKicker =
                document.createElement("span");

            avanterKicker.className =
                "walz-seller-avanter-kicker";

            avanterKicker.textContent =
                "BONOS AVANTER";

            const avanterHeadline =
                document.createElement("strong");

            avanterHeadline.textContent =
                `${storeName} trabaja con Bonos Avanter`;

            const avanterDescription =
                document.createElement("p");

            avanterDescription.textContent =
                "Consult\u00e1 productos adheridos y beneficios vigentes.";

            avanterHero.appendChild(
                avanterKicker
            );

            avanterHero.appendChild(
                avanterHeadline
            );

            avanterHero.appendChild(
                avanterDescription
            );

            const avanterButton =
                document.createElement("button");

            avanterButton.type = "button";

            avanterButton.className =
                "walz-seller-avanter-button";

            avanterButton.textContent =
                "Ver productos con Bonos Avanter";

            avanterButton.addEventListener(
                "click",
                () => {
                    const avanterInfo =
                        document.getElementById(
                            "walz-seller-avanter-info"
                        );

                    if (avanterInfo) {
                        avanterInfo.hidden = false;
                    }

                    avanterInfo?.scrollIntoView({
                        behavior: "smooth",
                        block: "start"
                    });
                }
            );

            avanterHero.appendChild(
                avanterButton
            );

            if (
                examples &&
                examples.parentElement === discoveryCopy
            ) {
                discoveryCopy.insertBefore(
                    avanterHero,
                    examples
                );
            } else {
                discoveryCopy.appendChild(
                    avanterHero
                );
            }
        }
    }

    if (
        discoveryHero &&
        sellerIdentity.nextElementSibling !== discoveryHero
    ) {
        discoveryHero.insertAdjacentElement(
            "beforebegin",
            sellerIdentity
        );
    }

    sellerIdentity.innerHTML = "";

    const sellerName =
        document.createElement("h2");

    sellerName.className =
        "walz-seller-marketplace-name";

    sellerName.textContent = storeName;

    sellerIdentity.appendChild(sellerName);

    if (storeDescription) {
        const sellerDescription =
            document.createElement("p");

        sellerDescription.className =
            "walz-seller-marketplace-description";

        sellerDescription.textContent =
            storeDescription;

        sellerIdentity.appendChild(
            sellerDescription
        );
    }

    if (city) {
        const sellerCity =
            document.createElement("div");

        sellerCity.className =
            "walz-seller-marketplace-city";

        sellerCity.textContent = city;

        sellerIdentity.appendChild(
            sellerCity
        );
    }

    document
        .getElementById("walz-seller-avanter-info")
        ?.remove();

    if (store.avanter_enabled === true) {
        const productList =
            document.getElementById("product-list");

        if (productList) {
            const avanterInfo =
                document.createElement("section");

            avanterInfo.id =
                "walz-seller-avanter-info";

            avanterInfo.className =
                "walz-seller-avanter-info";

            avanterInfo.hidden = true;

            const kicker =
                document.createElement("span");

            kicker.className =
                "walz-seller-avanter-info-kicker";

            kicker.textContent =
                "PROGRAMA DE BENEFICIOS";

            const infoTitle =
                document.createElement("h2");

            infoTitle.textContent =
                String(
                    store.avanter_title ||
                    "Bonos Avanter"
                );

            const infoText =
                document.createElement("p");

            infoText.textContent =
                String(
                    store.avanter_text || ""
                ).trim() ||
                "Present\u00e1 tu bono vigente al realizar la compra. El descuento aplicable es el indicado en el bono sobre el precio de lista de la farmacia. Cada bono permite una compra y tiene una fecha de vencimiento. La cantidad de unidades depende de lo autorizado por el laboratorio.";

            const productsTitle =
                document.createElement("strong");

            productsTitle.textContent =
                "Productos asociados a Bonos Avanter";

            const avanterProducts =
                sellerProducts.filter(
                    product =>
                        product.avanter_enabled === true
                );

            const avanterProductsList =
                document.createElement("div");

            avanterProductsList.className =
                "walz-seller-avanter-products";

            avanterProducts.forEach(product => {
                const productCard =
                    document.createElement("article");

                productCard.className =
                    "walz-seller-avanter-product";

                productCard.innerHTML = `
                    <div class="walz-seller-avanter-product-media">
                        ${renderProductImage(
                            product.image_url,
                            product.name,
                            "walz-seller-avanter-product-image"
                        )}
                    </div>

                    <div class="walz-seller-avanter-product-copy">
                        <span class="walz-seller-avanter-product-badge">
                            Producto adherido a Bonos Avanter
                        </span>

                        <h3>
                            ${escapeHtml(product.name || "Producto")}
                        </h3>

                        <div class="walz-seller-avanter-product-price">
                            ${renderProductPrice(product)}
                        </div>

                        <small>
                            El beneficio se aplica seg\u00fan el bono vigente presentado.
                        </small>

                        <span class="walz-seller-avanter-product-stock">
                            Stock: ${Number(product.stock || 0)}
                        </span>

                        <button
                            type="button"
                            class="walz-seller-avanter-product-button"
                        >
                            Ver producto
                        </button>
                    </div>
                `;

                productCard
                    .querySelector(
                        ".walz-seller-avanter-product-button"
                    )
                    ?.addEventListener(
                        "click",
                        () => openProductDetail(
                            String(product.id)
                        )
                    );

                avanterProductsList.appendChild(
                    productCard
                );
            });

            avanterInfo.appendChild(kicker);
            avanterInfo.appendChild(infoTitle);
            avanterInfo.appendChild(infoText);
            avanterInfo.appendChild(productsTitle);
            avanterInfo.appendChild(avanterProductsList);

            productList.insertAdjacentElement(
                "beforebegin",
                avanterInfo
            );
        }
    }

    if (eyebrow) {
        eyebrow.textContent =
            "Cat\u00e1logo de la tienda";
    }

    if (title) {
        title.textContent =
            "Explor\u00e1 por rubro";
    }

    if (note) {
        note.textContent =
            "Solo aparecen rubros y subrubros con productos activos.";
    }

    const groups = new Map();

    sellerProducts.forEach(product => {
        const category =
            String(product.category || "").trim();

        const subcategory =
            String(product.subcategory || "").trim();

        if (!category) return;

        if (!groups.has(category)) {
            groups.set(category, {
                count: 0,
                subcategories: new Map()
            });
        }

        const group = groups.get(category);
        group.count += 1;

        if (subcategory) {
            group.subcategories.set(
                subcategory,
                (group.subcategories.get(subcategory) || 0) + 1
            );
        }
    });

    if (groups.size === 0) {
        grid.innerHTML = `
            <article class="walz-macro-card is-active">
                <span class="walz-macro-icon">&#128230;</span>
                <div>
                    <strong>Sin rubros cargados todavía</strong>
                    <p>Asigná un Rubro a tus productos para organizarlos acá.</p>
                </div>
            </article>
        `;
        return;
    }

    const allCard = `
        <article
            class="walz-macro-card is-active"
            onclick="setSellerMarketplaceClassification('', '')"
        >
            <span class="walz-macro-icon">&#128722;</span>

            <div>
                <strong>Todos los productos</strong>
                <p>Ver el catálogo completo</p>
            </div>

            <em>${sellerProducts.length}</em>
        </article>
    `;

    const categoryCards =
        [...groups.entries()]
            .sort((a, b) =>
                a[0].localeCompare(b[0], "es")
            )
            .map(([category, group]) => {

                const subcategoryButtons =
                    [...group.subcategories.entries()]
                        .sort((a, b) =>
                            a[0].localeCompare(b[0], "es")
                        )
                        .map(([subcategory, count]) => `
                            <button
                                type="button"
                                class="walz-subcategory-chip"
                                onclick="
                                    event.stopPropagation();
                                    setSellerMarketplaceClassification(
                                        '${escapeJs(category)}',
                                        '${escapeJs(subcategory)}'
                                    );
                                "
                            >
                                ${escapeHtml(subcategory)} (${count})
                            </button>
                        `)
                        .join("");

                return `
                    <article
                        class="walz-macro-card is-active"
                        onclick="
                            setSellerMarketplaceClassification(
                                '${escapeJs(category)}',
                                ''
                            )
                        "
                    >
                        <span class="walz-macro-icon">&#128194;</span>

                        <div>
                            <strong>${escapeHtml(category)}</strong>

                            <p>
                                ${
                                    subcategoryButtons ||
                                    "Sin subrubros"
                                }
                            </p>
                        </div>

                        <em>${group.count}</em>
                    </article>
                `;
            })
            .join("");

    grid.innerHTML =
        allCard + categoryCards;
}


function executeSellerMarketplaceSearch() {
    const input =
        document.getElementById("product-search");

    const query =
        String(input?.value || "").trim();

    if (!query) {
        input?.focus();
        return;
    }

    // Una b?squeda nueva sale de cualquier Rubro/Subrubro.
    window.walzMarketplaceCategoryFilter = "";
    window.walzMarketplaceSubcategoryFilter = "";

    document
        .getElementById("walz-seller-filter-notice")
        ?.remove();

    filterProducts();

    const productList =
        document.getElementById("product-list");

    if (!productList) return;

    let notice =
        document.getElementById(
            "walz-seller-search-notice"
        );

    if (!notice) {
        notice = document.createElement("div");

        notice.id =
            "walz-seller-search-notice";

        notice.className =
            "walz-seller-filter-notice";

        productList.insertAdjacentElement(
            "beforebegin",
            notice
        );
    }

    notice.innerHTML = `
        <div>
            <span>Resultados para</span>
            <strong>${escapeHtml(query)}</strong>
        </div>

        <button
            type="button"
            id="walz-seller-new-search"
        >
            Nueva b?squeda
        </button>
    `;

    notice
        .querySelector(
            "#walz-seller-new-search"
        )
        ?.addEventListener(
            "click",
            () => {
                if (input) {
                    input.value = "";
                }

                notice.remove();

                filterProducts();

                document
                    .querySelector(
                        ".walz-discovery-hero"
                    )
                    ?.scrollIntoView({
                        behavior: "smooth",
                        block: "start"
                    });

                setTimeout(() => {
                    input?.focus();
                }, 350);
            }
        );

    setTimeout(() => {
        productList.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }, 60);
}


function updateSellerMarketplaceFilterNotice() {
    const productList =
        document.getElementById("product-list");

    if (!productList) return;

    const category =
        String(
            window.walzMarketplaceCategoryFilter || ""
        ).trim();

    const subcategory =
        String(
            window.walzMarketplaceSubcategoryFilter || ""
        ).trim();

    let notice =
        document.getElementById(
            "walz-seller-filter-notice"
        );

    if (!category && !subcategory) {
        notice?.remove();
        return;
    }

    if (!notice) {
        notice = document.createElement("div");
        notice.id =
            "walz-seller-filter-notice";
        notice.className =
            "walz-seller-filter-notice";

        productList.insertAdjacentElement(
            "beforebegin",
            notice
        );
    }

    const filterLabel =
        subcategory
            ? `${category} ? ${subcategory}`
            : category;

    notice.innerHTML = `
        <div>
            <span>Est?s viendo</span>
            <strong>${escapeHtml(filterLabel)}</strong>
        </div>

        <button
            type="button"
            id="walz-seller-clear-filter"
        >
            Volver a rubros
        </button>
    `;

    notice
        .querySelector(
            "#walz-seller-clear-filter"
        )
        ?.addEventListener(
            "click",
            () => {
                setSellerMarketplaceClassification(
                    "",
                    ""
                );

                document
                    .querySelector(
                        ".walz-macro-section"
                    )
                    ?.scrollIntoView({
                        behavior: "smooth",
                        block: "start"
                    });
            }
        );
}


function setSellerMarketplaceClassification(category, subcategory) {
    if (category || subcategory) {
        const searchInput =
            document.getElementById("product-search");

        if (searchInput) {
            searchInput.value = "";
        }

        document
            .getElementById("walz-seller-search-notice")
            ?.remove();
    }

    window.walzMarketplaceCategoryFilter =
        String(category || "");

    window.walzMarketplaceSubcategoryFilter =
        String(subcategory || "");

    filterProducts();
    updateSellerMarketplaceFilterNotice();
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
                ${renderProductStoreIdentity(product)}

                <div class="product-card-content">

                    <h4>
                        ${escapeHtml(product.name)}
                    </h4>

                    <p class="product-price">${renderProductPrice(product)}</p>

                    <p class="product-stock">
                        \u{1F4E6} Stock: ${stockValue}
                    </p>

                </div>


                <div
                    class="product-actions"
                    onclick="event.stopPropagation()"
                >
                    <button
                        type="button"
                        class="product-store-link"
                        onclick="showPublicStore('${product.seller_id}')"
                    >
                        Ver tienda
                    </button>

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
                            Agregar
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

    const selectedCategory =
        String(
            window.walzMarketplaceCategoryFilter || ""
        )
            .trim()
            .toLowerCase();

    const selectedSubcategory =
        String(
            window.walzMarketplaceSubcategoryFilter || ""
        )
            .trim()
            .toLowerCase();

    const filteredProducts =
        products.filter(product => {

            const category =
                String(product.category || "")
                    .trim()
                    .toLowerCase();

            const subcategory =
                String(product.subcategory || "")
                    .trim()
                    .toLowerCase();

            const searchable =
                [
                    product.name,
                    product.category,
                    product.subcategory,
                    product.brand,
                    product.description
                ]
                    .map(value => String(value || ""))
                    .join(" ")
                    .toLowerCase();

            const price =
                getProductEffectivePrice(product);

            if (
                search &&
                !searchable.includes(search)
            ) {
                return false;
            }

            if (
                selectedCategory &&
                category !== selectedCategory
            ) {
                return false;
            }

            if (
                selectedSubcategory &&
                subcategory !== selectedSubcategory
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

    window.walzMarketplaceCategoryFilter = "";
    window.walzMarketplaceSubcategoryFilter = "";

    document
        .getElementById("walz-seller-filter-notice")
        ?.remove();

    document
        .getElementById("walz-seller-search-notice")
        ?.remove();

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
        "FICHA PRODUCTO:",
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

    if (modal.parentElement?.id === "marketplace-content") {
        document.body.appendChild(modal);
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
                ? `\u{1F4E6} Stock disponible: ${product.stock}`
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

    console.log("AGREGAR PRESIONADO");
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
        "CARRITO ACTUAL:",
        cart
    );

    showMessage(
        `${name} (x${qty}) agregado`,
        "success"
    );
    saveCart();

    updateCartUI();

    // Si el carrito esta abierto,
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

    const cartButton =
        document.querySelector(".cart-button");

    const cartRestricted =
        ["ADMIN", "VENDEDOR", "SELLER"].includes(currentUserRole);

    if (cartButton) {
        cartButton.style.display =
            cartRestricted ? "none" : "inline-flex";
    }

    if (cartRestricted) {
        const cartSection =
            document.getElementById("cart-section");

        if (cartSection) {
            cartSection.style.display = "none";
        }

        document.body.classList.remove("cart-panel-open");
    }

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
    window.walzOrderDetailOpen = false;

    hideAllWalzWorkSections();
    hideSellerApplicationSections();
    hidePublicStoreSection();
    hideStoreProfileSection();
    hideBannerAdminSection();

    const marketplaceContent =
        document.getElementById("marketplace-content");

    const ordersSection =
        document.getElementById("orders-section");

    if (!marketplaceContent || !ordersSection) {
        console.error("No existe la seccion de pedidos.");
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


function showAdminCentralPanel() {
    if (currentUserRole !== "ADMIN") {
        showMarketplaceContent();
        return;
    }

    hideAllWalzWorkSections();

    const section = document.getElementById("admin-central-section");
    if (section) section.style.display = "block";

    showWalzNewsBarIfAllowed();
    refreshAdminPendingCounts();
}


async function showAdminStores() {
    if (currentUserRole !== "ADMIN") {
        showMessage("Se requiere una cuenta administradora.", "error");
        return;
    }

    hideAllWalzWorkSections();

    const section = document.getElementById("admin-stores-section");
    if (section) section.style.display = "block";

    const search = document.getElementById("admin-stores-search");
    if (search) search.value = "";

    window.scrollTo(0, 0);
    await loadAdminStores();
}


async function loadAdminStores() {
    const container = document.getElementById("admin-stores-list");
    const summary = document.getElementById("admin-stores-summary");
    const currentToken = localStorage.getItem("walz_token");

    if (!container) return;

    if (!currentToken) {
        handleExpiredSession();
        return;
    }

    container.innerHTML = '<div class="orders-state-card">Cargando vendedores y tiendas...</div>';
    if (summary) summary.textContent = "";

    try {
        const response = await fetch(`${API_URL}/stores/admin`, {
            headers: {
                Authorization: `Bearer ${currentToken}`
            }
        });

        if (response.status === 401) {
            handleExpiredSession();
            return;
        }

        const data = await response.json().catch(() => ([]));

        if (!response.ok) {
            throw new Error(data.detail || `HTTP ${response.status}`);
        }

        window.walzAdminStores = Array.isArray(data) ? data : [];
        renderAdminStores(window.walzAdminStores);

    } catch (error) {
        console.error("Error cargando tiendas para administracion:", error);
        if (summary) summary.textContent = "";
        container.innerHTML = `
            <div class="orders-state-card">
                No se pudieron cargar los vendedores y tiendas.
            </div>
        `;
    }
}


function filterAdminStores() {
    const search = document.getElementById("admin-stores-search");
    const query = String(search?.value || "").trim().toLocaleLowerCase("es");

    const stores = Array.isArray(window.walzAdminStores)
        ? window.walzAdminStores
        : [];

    if (!query) {
        renderAdminStores(stores);
        return;
    }

    const filtered = stores.filter(store => {
        const categories = Array.isArray(store.business_categories)
            ? store.business_categories.join(" ")
            : "";

        const searchable = [
            store.name,
            store.city,
            categories
        ]
            .filter(Boolean)
            .join(" ")
            .toLocaleLowerCase("es");

        return searchable.includes(query);
    });

    renderAdminStores(filtered);
}


function getAdminStoreStatusPresentation(status) {
    const value = String(status || "ACTIVE").trim().toUpperCase();

    const states = {
        ACTIVE: {
            label: "Activa",
            css: "is-active"
        },
        PAUSED: {
            label: "Pausada por el vendedor",
            css: "is-paused"
        },
        SUSPENDED: {
            label: "Suspendida por WalZ One",
            css: "is-suspended"
        },
        UNDER_REVIEW: {
            label: "En revision",
            css: "is-review"
        },
        REACTIVATION_REQUESTED: {
            label: "Reactivacion solicitada",
            css: "is-requested"
        },
        CLOSED: {
            label: "Cerrada",
            css: "is-inactive"
        }
    };

    return states[value] || {
        label: value || "Estado desconocido",
        css: "is-inactive"
    };
}


function renderAdminStoreStatusActions(store) {
    const status = String(
        store.operational_status || "ACTIVE"
    ).trim().toUpperCase();

    const id = escapeHtml(String(store.id || ""));

    if (!id || status === "CLOSED") {
        return "";
    }

    const actions = [];

    if (status === "ACTIVE") {
        actions.push(`
            <button type="button"
                class="admin-store-status-action danger"
                onclick="changeAdminStoreStatus('${id}', 'SUSPENDED')">
                Suspender
            </button>
        `);

        actions.push(`
            <button type="button"
                class="admin-store-status-action"
                onclick="changeAdminStoreStatus('${id}', 'UNDER_REVIEW')">
                Poner en revision
            </button>
        `);
    }

    if (status === "PAUSED") {
        actions.push(`
            <button type="button"
                class="admin-store-status-action success"
                onclick="changeAdminStoreStatus('${id}', 'ACTIVE')">
                Reactivar
            </button>
        `);

        actions.push(`
            <button type="button"
                class="admin-store-status-action danger"
                onclick="changeAdminStoreStatus('${id}', 'SUSPENDED')">
                Suspender
            </button>
        `);

        actions.push(`
            <button type="button"
                class="admin-store-status-action"
                onclick="changeAdminStoreStatus('${id}', 'UNDER_REVIEW')">
                Poner en revision
            </button>
        `);
    }

    if (status === "SUSPENDED") {
        actions.push(`
            <button type="button"
                class="admin-store-status-action success"
                onclick="changeAdminStoreStatus('${id}', 'ACTIVE')">
                Reactivar
            </button>
        `);

        actions.push(`
            <button type="button"
                class="admin-store-status-action"
                onclick="changeAdminStoreStatus('${id}', 'UNDER_REVIEW')">
                Poner en revision
            </button>
        `);
    }

    if (status === "UNDER_REVIEW") {
        actions.push(`
            <button type="button"
                class="admin-store-status-action success"
                onclick="changeAdminStoreStatus('${id}', 'ACTIVE')">
                Reactivar
            </button>
        `);

        actions.push(`
            <button type="button"
                class="admin-store-status-action danger"
                onclick="changeAdminStoreStatus('${id}', 'SUSPENDED')">
                Suspender
            </button>
        `);
    }

    if (status === "REACTIVATION_REQUESTED") {
        actions.push(`
            <button type="button"
                class="admin-store-status-action success"
                onclick="changeAdminStoreStatus('${id}', 'ACTIVE')">
                Aprobar reactivacion
            </button>
        `);

        actions.push(`
            <button type="button"
                class="admin-store-status-action danger"
                onclick="changeAdminStoreStatus('${id}', 'SUSPENDED')">
                Mantener suspendida
            </button>
        `);

        actions.push(`
            <button type="button"
                class="admin-store-status-action"
                onclick="changeAdminStoreStatus('${id}', 'UNDER_REVIEW')">
                Pasar a revision
            </button>
        `);
    }

    return actions.join("");
}


async function changeAdminStoreStatus(storeId, requestedStatus) {
    if (currentUserRole !== "ADMIN") {
        showMessage("Se requiere una cuenta administradora.", "error");
        return;
    }

    const status = String(requestedStatus || "").trim().toUpperCase();

    let reason = "";

    if (status === "SUSPENDED" || status === "UNDER_REVIEW") {
        reason = window.prompt(
            status === "SUSPENDED"
                ? "Indica el motivo de la suspension:"
                : "Indica el motivo de la revision:"
        );

        if (reason === null) return;

        reason = reason.trim();

        if (!reason) {
            showMessage("Debes indicar un motivo.", "error");
            return;
        }
    } else {
        const confirmed = window.confirm(
            status === "ACTIVE"
                ? "¿Confirmás la reactivación de esta tienda?"
                : "¿Confirmás este cambio de estado?"
        );

        if (!confirmed) return;
    }

    const currentToken = localStorage.getItem("walz_token");

    try {
        const response = await fetch(
            `${API_URL}/stores/admin/${encodeURIComponent(storeId)}/status`,
            {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${currentToken}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    status,
                    reason: reason || null
                })
            }
        );

        if (response.status === 401) {
            handleExpiredSession();
            return;
        }

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(
                data.detail || "No se pudo cambiar el estado de la tienda."
            );
        }

        showMessage("Estado de la tienda actualizado.", "success");
        await loadAdminStores();

    } catch (error) {
        console.error("Error cambiando estado de tienda:", error);
        showMessage(
            error.message || "No se pudo cambiar el estado de la tienda.",
            "error"
        );
    }
}



async function showAdminSellerDetail(ownerId) {
    if (currentUserRole !== "ADMIN") {
        showMessage("Se requiere una cuenta administradora.", "error");
        return;
    }

    const currentToken = localStorage.getItem("walz_token");

    if (!currentToken) {
        handleExpiredSession();
        return;
    }

    const container = document.getElementById("admin-stores-list");
    const summary = document.getElementById("admin-stores-summary");
    const toolbar = document.querySelector(
        "#admin-stores-section .admin-stores-toolbar"
    );

    if (!container) return;

    if (toolbar) toolbar.style.display = "none";
    if (summary) summary.textContent = "Detalle administrativo del vendedor";

    container.innerHTML = `
        <div class="orders-state-card">
            Cargando detalle administrativo...
        </div>
    `;

    try {
        const response = await fetch(
            `${API_URL}/stores/admin/seller/${encodeURIComponent(ownerId)}`,
            {
                headers: {
                    Authorization: `Bearer ${currentToken}`
                }
            }
        );

        if (response.status === 401) {
            handleExpiredSession();
            return;
        }

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(
                data.detail || "No se pudo cargar el detalle del vendedor."
            );
        }

        const store = data.store || {};
        const seller = data.seller || {};
        const application = data.application || null;

        const categories = Array.isArray(store.business_categories)
            ? store.business_categories.filter(Boolean)
            : [];

        const statusInfo = getAdminStoreStatusPresentation(
            store.operational_status
        );

        const deliveryMethods = [];
        if (store.delivery_enabled) deliveryMethods.push("Envio a domicilio");
        if (store.pickup_enabled) deliveryMethods.push("Retiro en el local");

        const sellerName = [
            seller.first_name,
            seller.last_name
        ].filter(Boolean).join(" ").trim() || "No informado";

        const accountStatus = seller.is_active === true
            ? "Activa"
            : "Inactiva";

        const emailStatus = seller.email_verified === true
            ? "Verificado"
            : "No verificado";

        const termsStatus = seller.terms_accepted_at
            ? `Aceptados el ${formatWalzDate(seller.terms_accepted_at)}`
            : "Sin registro de aceptacion";

        let applicationStatus = "Sin solicitud registrada";

        if (application) {
            const value = String(application.status || "").toLowerCase();

            applicationStatus =
                value === "approved" ? "Aprobada" :
                value === "rejected" ? "Rechazada" :
                value === "pending" ? "Pendiente" :
                application.status || "Sin estado";
        }

        container.innerHTML = `
            <article class="admin-store-card">
                <button
                    type="button"
                    class="admin-store-status-action admin-seller-detail-back"
                    onclick="showAdminStoresListFromDetail()"
                >
                    &larr; Volver a vendedores
                </button>

                <div class="admin-store-main">
                    <div>
                        <small>Detalle administrativo</small>
                        <h3>${escapeHtml(store.name || "Sin nombre")}</h3>
                        ${store.city ? `<p>${escapeHtml(store.city)}</p>` : ""}
                    </div>

                    <span class="admin-store-status ${statusInfo.css}">
                        ${statusInfo.label}
                    </span>
                </div>

                <div class="admin-store-status-reason">
                    <strong>Responsable:</strong>
                    <span>${escapeHtml(sellerName)}</span>
                </div>

                <div class="admin-store-status-reason">
                    <strong>Email de la cuenta:</strong>
                    <span>${escapeHtml(seller.email || "No informado")}</span>
                </div>

                <div class="admin-store-status-reason">
                    <strong>Telefono personal:</strong>
                    <span>${escapeHtml(seller.phone || "No informado")}</span>
                </div>

                <div class="admin-store-status-reason">
                    <strong>Rol:</strong>
                    <span>${escapeHtml(seller.role || "No informado")}</span>
                </div>

                <div class="admin-store-status-reason">
                    <strong>Estado de la cuenta:</strong>
                    <span>${escapeHtml(accountStatus)}</span>
                </div>

                <div class="admin-store-status-reason">
                    <strong>Email:</strong>
                    <span>${escapeHtml(emailStatus)}</span>
                </div>

                <div class="admin-store-status-reason">
                    <strong>Alta de la cuenta:</strong>
                    <span>${escapeHtml(
                        seller.created_at
                            ? formatWalzDate(seller.created_at)
                            : "No registrada"
                    )}</span>
                </div>

                <div class="admin-store-status-reason">
                    <strong>Ultimo acceso:</strong>
                    <span>${escapeHtml(
                        seller.last_login
                            ? formatWalzDate(seller.last_login)
                            : "Sin registro"
                    )}</span>
                </div>

                <div class="admin-store-status-reason">
                    <strong>Terminos:</strong>
                    <span>${escapeHtml(termsStatus)}</span>
                </div>

                ${seller.terms_version ? `
                    <div class="admin-store-status-reason">
                        <strong>Version de terminos:</strong>
                        <span>${escapeHtml(seller.terms_version)}</span>
                    </div>
                ` : ""}

                <div class="admin-store-status-reason">
                    <strong>ID interno del vendedor:</strong>
                    <span>${escapeHtml(String(store.owner_id || seller.id || ""))}</span>
                </div>

                <div class="admin-store-status-reason">
                    <strong>Slug de la tienda:</strong>
                    <span>${escapeHtml(store.slug || "Sin slug")}</span>
                </div>

                <div class="admin-store-status-reason">
                    <strong>Telefono comercial:</strong>
                    <span>${escapeHtml(store.phone || "No informado")}</span>
                </div>

                <div class="admin-store-status-reason">
                    <strong>Direccion:</strong>
                    <span>${escapeHtml(store.address || "No informada")}</span>
                </div>

                <div class="admin-store-status-reason">
                    <strong>Formas de entrega:</strong>
                    <span>${escapeHtml(
                        deliveryMethods.length
                            ? deliveryMethods.join(" / ")
                            : "No informadas"
                    )}</span>
                </div>

                ${store.description ? `
                    <div class="admin-store-status-reason">
                        <strong>Descripcion:</strong>
                        <span>${escapeHtml(store.description)}</span>
                    </div>
                ` : ""}

                ${categories.length ? `
                    <div class="admin-store-categories">
                        ${categories.map(
                            category => `<span>${escapeHtml(category)}</span>`
                        ).join("")}
                    </div>
                ` : ""}

                ${application ? `
                    <div class="admin-store-status-reason">
                        <strong>Solicitud para vender:</strong>
                        <span>${escapeHtml(applicationStatus)}</span>
                    </div>

                    <div class="admin-store-status-reason">
                        <strong>Negocio solicitado:</strong>
                        <span>${escapeHtml(application.business_name || "No informado")}</span>
                    </div>

                    <div class="admin-store-status-reason">
                        <strong>Motivo declarado:</strong>
                        <span>${escapeHtml(application.reason || "No informado")}</span>
                    </div>

                    <div class="admin-store-status-reason">
                        <strong>Solicitud presentada:</strong>
                        <span>${escapeHtml(
                            application.created_at
                                ? formatWalzDate(application.created_at)
                                : "No registrada"
                        )}</span>
                    </div>

                    ${application.reviewed_at ? `
                        <div class="admin-store-status-reason">
                            <strong>Revision administrativa:</strong>
                            <span>${escapeHtml(formatWalzDate(application.reviewed_at))}</span>
                        </div>
                    ` : ""}

                    ${application.admin_note ? `
                        <div class="admin-store-status-reason">
                            <strong>Nota administrativa:</strong>
                            <span>${escapeHtml(application.admin_note)}</span>
                        </div>
                    ` : ""}
                ` : `
                    <div class="admin-store-status-reason">
                        <strong>Solicitud para vender:</strong>
                        <span>Sin solicitud registrada</span>
                    </div>
                `}

                ${store.status_reason ? `
                    <div class="admin-store-status-reason">
                        <strong>Motivo / observacion del estado:</strong>
                        <span>${escapeHtml(store.status_reason)}</span>
                    </div>
                ` : ""}

                <div class="admin-store-actions">
                    ${renderAdminStoreStatusActions(store)}
                </div>
            </article>
        `;

        window.scrollTo(0, 0);

    } catch (error) {
        console.error(
            "Error cargando detalle administrativo del vendedor:",
            error
        );

        container.innerHTML = `
            <div class="orders-state-card orders-error">
                ${escapeHtml(
                    error.message ||
                    "No se pudo cargar el detalle del vendedor."
                )}
            </div>
        `;
    }
}


function showAdminStoresListFromDetail() {
    const toolbar = document.querySelector(
        "#admin-stores-section .admin-stores-toolbar"
    );

    if (toolbar) toolbar.style.display = "";

    renderAdminStores(
        Array.isArray(window.walzAdminStores)
            ? window.walzAdminStores
            : []
    );

    window.scrollTo(0, 0);
}

function renderAdminStores(stores) {
    const container = document.getElementById("admin-stores-list");
    const summary = document.getElementById("admin-stores-summary");

    if (!container) return;

    const list = Array.isArray(stores) ? stores : [];
    const totalStores = Array.isArray(window.walzAdminStores)
        ? window.walzAdminStores.length
        : list.length;

    if (summary) {
        summary.textContent = list.length === totalStores
            ? `${totalStores} tienda${totalStores === 1 ? "" : "s"} registrada${totalStores === 1 ? "" : "s"}`
            : `${list.length} de ${totalStores} tiendas`;
    }

    if (list.length === 0) {
        container.innerHTML = `
            <div class="orders-state-card">
                No encontramos tiendas con esa busqueda.
            </div>
        `;
        return;
    }

    container.innerHTML = list.map(store => {
        const isActive = store.is_active === true;
        const categories = Array.isArray(store.business_categories)
            ? store.business_categories.filter(Boolean)
            : [];

        const statusInfo = getAdminStoreStatusPresentation(
            store.operational_status
        );

        const publicAction = isActive && store.slug
            ? `
                <a
                    class="admin-store-public-link"
                    href="/${encodeURIComponent(String(store.slug))}?from=admin"
                >
                    Ver tienda publica
                </a>
            `
            : `
                <span class="admin-store-public-disabled">
                    No visible publicamente
                </span>
            `;

        return `
            <article class="admin-store-card">
                <div class="admin-store-main">
                    <div>
                        <small>Tienda</small>
                        <h3>${escapeHtml(store.name || "Sin nombre")}</h3>
                        ${store.city ? `<p>${escapeHtml(store.city)}</p>` : ""}
                    </div>

                    <span class="admin-store-status ${statusInfo.css}">
                        ${statusInfo.label}
                    </span>
                </div>

                ${categories.length ? `
                    <div class="admin-store-categories">
                        ${categories.map(category => `<span>${escapeHtml(category)}</span>`).join("")}
                    </div>
                ` : ""}

                ${store.status_reason ? `
                    <div class="admin-store-status-reason">
                        <strong>Motivo / observacion:</strong>
                        <span>${escapeHtml(store.status_reason)}</span>
                    </div>
                ` : ""}

                <div class="admin-store-actions">
                    <button
                        type="button"
                        class="admin-store-status-action"
                        onclick="showAdminSellerDetail('${escapeJs(String(store.owner_id || ""))}')"
                    >
                        Ver detalle
                    </button>
                    ${publicAction}
                    ${renderAdminStoreStatusActions(store)}
                </div>
            </article>
        `;
    }).join("");
}



async function showInstitutionalSettings() {
    if (currentUserRole !== "ADMIN") {
        showMessage("Se requiere una cuenta administradora.", "error");
        return;
    }

    hideAllWalzWorkSections();

    const section = document.getElementById("institutional-settings-section");
    if (section) section.style.display = "block";

    const saveButton = document.getElementById("institutional-settings-save-button");
    if (saveButton) saveButton.onclick = saveInstitutionalSettings;

    window.scrollTo(0, 0);
    await loadInstitutionalSettings();
}


function setInstitutionalField(id, value) {
    const element = document.getElementById(id);
    if (element) element.value = value || "";
}


async function loadInstitutionalSettings() {
    const currentToken = localStorage.getItem("walz_token");
    const message = document.getElementById("institutional-settings-message");

    if (!currentToken) {
        handleExpiredSession();
        return;
    }

    if (message) message.textContent = "Cargando configuracion...";

    try {
        const response = await fetch(`${API_URL}/institutional-settings/admin`, {
            headers: {
                Authorization: `Bearer ${currentToken}`
            }
        });

        if (response.status === 401) {
            handleExpiredSession();
            return;
        }

        const data = await response.json().catch(() => null);

        if (!response.ok) {
            throw new Error(data?.detail || `HTTP ${response.status}`);
        }

        setInstitutionalField("institutional-name", data?.institutional_name);
        setInstitutionalField("institutional-description", data?.description);
        setInstitutionalField("institutional-email", data?.email);
        setInstitutionalField("institutional-phone", data?.phone);
        setInstitutionalField("institutional-whatsapp", data?.whatsapp);
        setInstitutionalField("institutional-city", data?.city);
        setInstitutionalField("institutional-address", data?.address);
        setInstitutionalField("institutional-website", data?.website_url);
        setInstitutionalField("institutional-instagram", data?.instagram_url);
        setInstitutionalField("institutional-facebook", data?.facebook_url);

        if (message) {
            message.textContent = data
                ? "Configuracion institucional cargada."
                : "Todavia no hay datos institucionales guardados.";
        }
    } catch (error) {
        if (message) {
            message.textContent =
                error.message || "No se pudo cargar la configuracion institucional.";
        }
    }
}


async function saveInstitutionalSettings() {
    const currentToken = localStorage.getItem("walz_token");
    const message = document.getElementById("institutional-settings-message");
    const saveButton = document.getElementById("institutional-settings-save-button");

    if (!currentToken) {
        handleExpiredSession();
        return;
    }

    const institutionalName =
        document.getElementById("institutional-name")?.value.trim() || "";

    if (institutionalName.length < 2) {
        if (message) {
            message.textContent = "Ingresa un nombre institucional valido.";
        }
        return;
    }

    const payload = {
        institutional_name: institutionalName,
        description: document.getElementById("institutional-description")?.value.trim() || null,
        email: document.getElementById("institutional-email")?.value.trim() || null,
        phone: document.getElementById("institutional-phone")?.value.trim() || null,
        whatsapp: document.getElementById("institutional-whatsapp")?.value.trim() || null,
        city: document.getElementById("institutional-city")?.value.trim() || null,
        address: document.getElementById("institutional-address")?.value.trim() || null,
        website_url: document.getElementById("institutional-website")?.value.trim() || null,
        instagram_url: document.getElementById("institutional-instagram")?.value.trim() || null,
        facebook_url: document.getElementById("institutional-facebook")?.value.trim() || null
    };

    if (saveButton) saveButton.disabled = true;
    if (message) message.textContent = "Guardando configuracion...";

    try {
        const response = await fetch(`${API_URL}/institutional-settings/admin`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${currentToken}`
            },
            body: JSON.stringify(payload)
        });

        if (response.status === 401) {
            handleExpiredSession();
            return;
        }

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data.detail || `HTTP ${response.status}`);
        }

        if (message) {
            message.textContent = "Configuracion institucional guardada correctamente.";
        }
    } catch (error) {
        if (message) {
            message.textContent =
                error.message || "No se pudo guardar la configuracion institucional.";
        }
    } finally {
        if (saveButton) saveButton.disabled = false;
    }
}





function formatAdminEconomyMoney(value, currency = "ARS") {
    const amount = Number(value ?? 0);

    return new Intl.NumberFormat(
        "es-AR",
        {
            style: "currency",
            currency: currency || "ARS",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }
    ).format(Number.isFinite(amount) ? amount : 0);
}


function formatAdminEconomyDate(value) {
    if (!value) return "Sin fecha";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);

    return new Intl.DateTimeFormat(
        "es-AR",
        {
            dateStyle: "short",
            timeStyle: "short"
        }
    ).format(date);
}


async function fetchAdminEconomy(path, options = {}) {
    const currentToken = localStorage.getItem("walz_token");

    if (!currentToken) {
        handleExpiredSession();
        throw new Error("Sesion vencida.");
    }

    const headers = {
        ...(options.headers || {}),
        Authorization: `Bearer ${currentToken}`
    };

    const response = await fetch(
        `${API_URL}${path}`,
        {
            ...options,
            headers
        }
    );

    if (response.status === 401) {
        handleExpiredSession();
        throw new Error("Sesion vencida.");
    }

    const data = await response.json().catch(() => null);

    if (!response.ok) {
        throw new Error(
            data?.detail || `HTTP ${response.status}`
        );
    }

    return data;
}


function renderAdminEconomySetting(setting) {
    const enabledInput =
        document.getElementById("admin-economy-enabled");

    const rateInput =
        document.getElementById("admin-economy-rate");

    const statusText =
        document.getElementById("admin-economy-status-text");

    const enabled = setting?.economy_enabled === true;
    const rate = Number(
        setting?.default_commission_rate ?? 0
    );

    if (enabledInput) {
        enabledInput.checked = enabled;
    }

    if (rateInput) {
        rateInput.value =
            Number.isFinite(rate)
                ? String(rate)
                : "0";
    }

    if (statusText) {
        if (!setting) {
            statusText.textContent =
                "Economia desactivada. Todavia no existe configuracion economica guardada.";
        } else if (enabled) {
            statusText.textContent =
                `Economia HABILITADA. Comision general configurada: ${rate.toFixed(4)} %.`;
        } else {
            statusText.textContent =
                `Economia desactivada. Comision configurada: ${rate.toFixed(4)} %.`;
        }
    }
}


function renderAdminEconomySummary(summary) {
    const currency = summary?.currency || "ARS";

    const accruedAmount =
        document.getElementById("admin-economy-accrued-amount");

    const reversalAmount =
        document.getElementById("admin-economy-reversal-amount");

    const netAmount =
        document.getElementById("admin-economy-net-amount");

    const accruedCount =
        document.getElementById("admin-economy-accrued-count");

    const reversalCount =
        document.getElementById("admin-economy-reversal-count");

    const totalCount =
        document.getElementById("admin-economy-total-count");

    if (accruedAmount) {
        accruedAmount.textContent =
            formatAdminEconomyMoney(
                summary?.accrued_amount,
                currency
            );
    }

    if (reversalAmount) {
        reversalAmount.textContent =
            formatAdminEconomyMoney(
                summary?.reversal_amount,
                currency
            );
    }

    if (netAmount) {
        netAmount.textContent =
            formatAdminEconomyMoney(
                summary?.net_platform_amount,
                currency
            );
    }

    if (accruedCount) {
        accruedCount.textContent =
            `${Number(summary?.accrued_entries || 0)} movimientos`;
    }

    if (reversalCount) {
        reversalCount.textContent =
            `${Number(summary?.reversal_entries || 0)} movimientos`;
    }

    if (totalCount) {
        totalCount.textContent =
            `${Number(summary?.total_entries || 0)} asientos`;
    }
}


function renderAdminEconomyLedger(rows) {
    const container =
        document.getElementById(
            "admin-economy-ledger-content"
        );

    if (!container) return;

    if (!Array.isArray(rows) || rows.length === 0) {
        container.innerHTML = `
            <div class="orders-state-card">
                Todavia no hay movimientos en el libro economico.
            </div>
        `;
        return;
    }

    container.innerHTML = rows.map((row) => {
        const entry = row?.entry || {};
        const store = row?.store || {};
        const seller = row?.seller || {};

        const isReversal =
            entry.entry_type === "platform_fee_reversal";

        const typeLabel = isReversal
            ? "Reverso"
            : "Comision devengada";

        const paymentText = entry.payment_id
            ? escapeHtml(String(entry.payment_id))
            : "Sin pago asociado";

        return `
            <article class="orders-state-card admin-economy-ledger-row">
                <div class="admin-economy-ledger-row-heading">
                    <strong>${escapeHtml(typeLabel)}</strong>
                    <span>
                        ${escapeHtml(
                            formatAdminEconomyMoney(
                                entry.amount,
                                entry.currency || "ARS"
                            )
                        )}
                    </span>
                </div>

                <div>
                    <strong>Tienda:</strong>
                    ${escapeHtml(store.name || "Sin tienda")}
                </div>

                <div>
                    <strong>Vendedor:</strong>
                    ${escapeHtml(seller.name || "Sin vendedor")}
                </div>

                <div>
                    <strong>Pedido:</strong>
                    ${escapeHtml(String(entry.order_id || ""))}
                </div>

                <div>
                    <strong>Pago:</strong>
                    ${paymentText}
                </div>

                <div>
                    <strong>Base:</strong>
                    ${escapeHtml(
                        formatAdminEconomyMoney(
                            entry.platform_fee_base,
                            entry.currency || "ARS"
                        )
                    )}
                </div>

                <div>
                    <strong>Tasa:</strong>
                    ${escapeHtml(
                        String(entry.platform_fee_rate ?? "0")
                    )} %
                </div>

                <div>
                    <strong>Neto vendedor:</strong>
                    ${escapeHtml(
                        formatAdminEconomyMoney(
                            entry.seller_net_amount,
                            entry.currency || "ARS"
                        )
                    )}
                </div>

                <div>
                    <strong>Fecha:</strong>
                    ${escapeHtml(
                        formatAdminEconomyDate(
                            entry.created_at
                        )
                    )}
                </div>
            </article>
        `;
    }).join("");
}


async function showAdminEconomy() {
    if (currentUserRole !== "ADMIN") {
        showMessage(
            "Se requiere una cuenta administradora.",
            "error"
        );
        return;
    }

    hideAllWalzWorkSections();

    const section =
        document.getElementById("admin-economy-section");

    if (!section) {
        console.error(
            "No existe la seccion Economia Central."
        );
        return;
    }

    section.style.display = "block";
    window.scrollTo(0, 0);

    await loadAdminEconomy();
}


async function loadAdminEconomy() {
    const ledgerContainer =
        document.getElementById(
            "admin-economy-ledger-content"
        );

    const message =
        document.getElementById(
            "admin-economy-settings-message"
        );

    if (ledgerContainer) {
        ledgerContainer.innerHTML = `
            <div class="orders-state-card">
                Cargando movimientos economicos...
            </div>
        `;
    }

    if (message) {
        message.textContent = "Cargando datos economicos...";
    }

    try {
        const [
            setting,
            summary,
            ledger
        ] = await Promise.all([
            fetchAdminEconomy("/economy/admin"),
            fetchAdminEconomy("/economy/admin/summary"),
            fetchAdminEconomy(
                "/economy/admin/ledger?limit=100&offset=0"
            )
        ]);

        renderAdminEconomySetting(setting);
        renderAdminEconomySummary(summary);
        renderAdminEconomyLedger(ledger);

        if (message) {
            message.textContent =
                "Datos economicos actualizados.";
        }
    } catch (error) {
        console.error(
            "Error cargando Economia Central:",
            error
        );

        if (message) {
            message.textContent =
                error.message ||
                "No se pudieron cargar los datos economicos.";
        }

        if (ledgerContainer) {
            ledgerContainer.innerHTML = `
                <div class="orders-state-card orders-error">
                    No se pudo cargar el libro economico.
                </div>
            `;
        }
    }
}


async function saveAdminEconomySettings() {
    const enabledInput =
        document.getElementById("admin-economy-enabled");

    const rateInput =
        document.getElementById("admin-economy-rate");

    const message =
        document.getElementById(
            "admin-economy-settings-message"
        );

    const saveButton =
        document.getElementById(
            "admin-economy-save-button"
        );

    const economyEnabled =
        enabledInput?.checked === true;

    const rate = Number(
        rateInput?.value ?? 0
    );

    if (
        !Number.isFinite(rate) ||
        rate < 0 ||
        rate > 100
    ) {
        if (message) {
            message.textContent =
                "La comision debe estar entre 0 y 100 %.";
        }
        return;
    }

    if (economyEnabled) {
        const confirmed = window.confirm(
            "Estas por HABILITAR la economia transaccional de WalZ One. " +
            "Los nuevos pedidos comenzaran a congelar esta configuracion economica. " +
            "Confirma solamente si el esquema de comisiones ya fue definido formalmente."
        );

        if (!confirmed) {
            if (message) {
                message.textContent =
                    "Activacion cancelada. No se guardaron cambios.";
            }
            return;
        }
    }

    const payload = {
        economy_enabled: economyEnabled,
        default_commission_rate: rate.toFixed(4)
    };

    if (saveButton) {
        saveButton.disabled = true;
    }

    if (message) {
        message.textContent =
            "Guardando configuracion economica...";
    }

    try {
        const setting = await fetchAdminEconomy(
            "/economy/admin",
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            }
        );

        renderAdminEconomySetting(setting);

        if (message) {
            message.textContent =
                economyEnabled
                    ? "Configuracion guardada. Economia transaccional HABILITADA."
                    : "Configuracion guardada. Economia transaccional desactivada.";
        }
    } catch (error) {
        console.error(
            "Error guardando Economia Central:",
            error
        );

        if (message) {
            message.textContent =
                error.message ||
                "No se pudo guardar la configuracion economica.";
        }
    } finally {
        if (saveButton) {
            saveButton.disabled = false;
        }
    }
}


async function loadPublicInstitutionalContact() {
    const section =
        document.getElementById("walz-public-contact");

    const description =
        document.getElementById("walz-public-contact-description");

    const links =
        document.getElementById("walz-public-contact-links");

    if (!section || !links) return;

    const currentPath =
        window.location.pathname
            .split("/")
            .filter(Boolean)
            .join("/")
            .toLowerCase();

    // Solo WalZ One Central. Nunca dentro de una tienda directa.
    if (currentPath !== "") {
        section.style.display = "none";
        links.replaceChildren();
        return;
    }

    section.style.display = "none";
    links.replaceChildren();

    try {
        const response = await fetch(
            `${API_URL}/institutional-settings/public`
        );

        if (!response.ok) {
            throw new Error("No se pudieron cargar los contactos institucionales.");
        }

        const data = await response.json();

        if (!data) return;

        if (description) {
            description.textContent =
                String(data.description || "").trim();
        }

        const addLink = (label, href) => {
            if (!href) return;

            const anchor = document.createElement("a");
            anchor.className = "walz-public-contact-link";
            anchor.href = href;
            anchor.target = "_blank";
            anchor.rel = "noopener noreferrer";
            anchor.textContent = label;

            links.appendChild(anchor);
        };

        const website =
            String(data.website_url || "").trim();

        const email =
            String(data.email || "").trim();

        const whatsapp =
            String(data.whatsapp || "").trim();

        const instagram =
            String(data.instagram_url || "").trim();

        const facebook =
            String(data.facebook_url || "").trim();

        addLink("Sitio web", website);

        if (whatsapp) {
            const whatsappNumber =
                whatsapp.replace(/\D/g, "");

            if (whatsappNumber) {
                addLink(
                    "WhatsApp",
                    `https://wa.me/${whatsappNumber}`
                );
            }
        }

        if (email) {
            addLink(
                "Email",
                `mailto:${email}`
            );
        }

        addLink("Instagram", instagram);
        addLink("Facebook", facebook);

        if (links.children.length > 0) {
            section.style.display = "block";
        }
    } catch (error) {
        console.error(
            "No se pudo cargar el contacto institucional:",
            error
        );

        section.style.display = "none";
        links.replaceChildren();
    }
}


function showMarketplaceContent(loadCentralAdvertising = true) {
    window.walzOrderSuccessOpen = false;

    hideSellerApplicationSections();
    hidePublicStoreSection();
    hideStoreProfileSection();

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
    hideBannerProposalSection();
    loadProducts();

    if (loadCentralAdvertising) {
        loadActiveBanners("CENTRAL_MARKETPLACE");
        loadSellerSponsoredBanners();
    } else {
        hideMarketplaceBanners();
        hideSellerSponsoredBanners();
    }

    loadPublicInstitutionalContact();
}


async function loadMyOrders(silent = false, force = false) {

    if (
        window.walzOrderSuccessOpen
        && silent
        && !force
    ) {
        return;
    }

    if (!silent || force) {
        window.walzOrderSuccessOpen = false;
    }

    if (
        window.walzOrderDetailOpen
        && !force
    ) {
        return;
    }

    window.walzOrdersViewToken =
        Number(window.walzOrdersViewToken || 0) + 1;

    const requestToken =
        window.walzOrdersViewToken;

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

    if (!silent) {
        container.innerHTML = `
            <div class="orders-state-card orders-loading">
                Cargando pedidos...
            </div>
        `;
    }

    try {
        const res = await fetch(`${API_URL}/orders/`, {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        if (
            requestToken
            !== window.walzOrdersViewToken
        ) {
            return;
        }

        if (res.status === 401) {
            renderOrdersSessionExpired();
            return;
        }

        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.detail || `HTTP ${res.status}`);
        }

        const orders = await res.json();

        if (
            requestToken
            !== window.walzOrdersViewToken
        ) {
            return;
        }

        window.walzMyOrders = Array.isArray(orders) ? orders : [];
        applyMyOrdersFilters();

    } catch (ordersError) {

        if (
            requestToken
            !== window.walzOrdersViewToken
        ) {
            return;
        }

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
        confirmed: {
            label: "Confirmado",
            className: "order-status-confirmed"
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




// WALZ_ORDER_TIMELINE_V1
function parseWalzDate(value) {
    if (!value) return null;
    let normalized = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(normalized) && !/(Z|[+-]\d{2}:?\d{2})$/i.test(normalized)) {
        normalized += "Z";
    }
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
}

function formatWalzDate(value) {
    const date = parseWalzDate(value);
    if (!date) return "Fecha no disponible";
    return new Intl.DateTimeFormat("es-AR", {
        timeZone: "America/Argentina/Buenos_Aires",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
    }).format(date);
}

function getOrderLatestActivity(order) {
    const candidates = [
        order?.pickup_buyer_received_at,
        order?.pickup_seller_handed_at,
        order?.pickup_buyer_arrived_at,
        order?.pickup_buyer_going_at,
        order?.pickup_ready_at,
        order?.updated_at,
        order?.created_at
    ].map(parseWalzDate).filter(Boolean);
    if (!candidates.length) return null;
    return candidates.reduce((latest, current) => current > latest ? current : latest);
}

function renderOrderTimeline(order) {
    const steps = [
        ["Compra realizada", order?.created_at],
        ["Listo para retirar", order?.pickup_ready_at],
        ["Comprador aviso que va a retirar", order?.pickup_buyer_going_at],
        ["Comprador llego al local", order?.pickup_buyer_arrived_at],
        ["Producto entregado por el vendedor", order?.pickup_seller_handed_at],
        ["Recepcion confirmada por el comprador", order?.pickup_buyer_received_at]
    ].filter(([, value]) => Boolean(parseWalzDate(value)));
    if (!steps.length) return "";
    return `<section class="order-timeline"><h4>Cronologia</h4>${steps.map(([label, value]) => `<div class="order-timeline-step"><span></span><div><strong>${escapeHtml(label)}</strong><time>${escapeHtml(formatWalzDate(value))}</time></div></div>`).join("")}</section>`;
}

function orderMatchesWorkStatus(order, selectedStatus) {
    const status = String(order?.status || "").toLowerCase();
    if (!selectedStatus) return true;
    if (selectedStatus === "active") return ["pending", "confirmed", "shipped"].includes(status);
    return status === selectedStatus;
}

function applyMyOrdersFilters() {
    const allOrders = Array.isArray(window.walzMyOrders) ? window.walzMyOrders : [];
    const selectedStatus = String(document.getElementById("my-orders-status-filter")?.value ?? "active").toLowerCase();
    const filteredOrders = allOrders.filter(order => orderMatchesWorkStatus(order, selectedStatus));
    const counter = document.getElementById("my-orders-results-count");
    if (counter) counter.textContent = `${filteredOrders.length} de ${allOrders.length} compra${allOrders.length === 1 ? "" : "s"}`;
    renderMyOrders(filteredOrders);
}

function clearMyOrdersFilters() {
    const filter = document.getElementById("my-orders-status-filter");
    if (filter) filter.value = "active";
    applyMyOrdersFilters();
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
                <h3>Todavia no realizaste compras</h3>
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
                const latestActivity = getOrderLatestActivity(order);
                const activityAt = latestActivity
                    ? formatWalzDate(latestActivity.toISOString())
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
                                <span>Ultimo movimiento</span>
                                <strong>${escapeHtml(activityAt)}</strong>
                            </div>
                            <div>
                                <span>Vendedor</span>
                                <strong>${escapeHtml(order.seller_display_name || order.seller_account_email || "Sin identificar")}</strong>
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

    window.walzOrderDetailOpen = true;

    window.walzOrdersViewToken =
        Number(window.walzOrdersViewToken || 0) + 1;

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

        try {
            const buyerPayment =
                await loadBuyerPaymentForOrder(
                    order.id,
                    token
                );

            cacheBuyerPaymentForOrder(
                order.id,
                buyerPayment
            );

            // Los datos para pagar pertenecen al snapshot del
            // Payment. Nunca se vuelve a consultar la configuracion
            // actual de la tienda para un pedido ya creado.

        } catch (buyerPaymentError) {
            if (
                buyerPaymentError.message
                === "SESSION_EXPIRED"
            ) {
                renderOrdersSessionExpired();
                return;
            }

            console.error(
                "Error cargando pago del comprador:",
                buyerPaymentError
            );

            cacheBuyerPaymentForOrder(
                order.id,
                null,
                buyerPaymentError.message
                || "No se pudo consultar el pago."
            );
        }

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
                Volver a mis compras
            </button>
        `;
    }
}


function backToMyOrders() {
    window.walzOrderDetailOpen = false;
    loadMyOrders(false, true);
}


function normalizeBuyerPaymentOrderId(value) {
    return String(value || "")
        .replace(/-/g, "")
        .trim()
        .toLowerCase();
}


function getBuyerPaymentMethodLabel(method) {
    const labels = {
        CASH: "Efectivo",
        BANK_TRANSFER: "Transferencia bancaria",
        CUENTA_DNI: "Cuenta DNI",
        MERCADO_PAGO: "Mercado Pago"
    };

    const normalized = String(method || "")
        .trim()
        .toUpperCase();

    return labels[normalized]
        || normalized
        || "No informado";
}


function getBuyerPaymentStatusPresentation(status) {
    const normalized = String(status || "")
        .trim()
        .toLowerCase();

    const states = {
        pending: {
            label: "Pendiente",
            css: "order-status-pending"
        },
        reported: {
            label: "Informado al vendedor",
            css: "order-status-confirmed"
        },
        approved: {
            label: "Pago confirmado",
            css: "order-status-delivered"
        },
        rejected: {
            label: "Pago rechazado",
            css: "order-status-cancelled"
        },
        cancelled: {
            label: "Pago cancelado",
            css: "order-status-cancelled"
        }
    };

    return states[normalized] || {
        label: normalized || "Sin estado",
        css: "order-status-unknown"
    };
}


async function loadBuyerPaymentForOrder(
    orderId,
    currentToken
) {
    const targetOrderId =
        normalizeBuyerPaymentOrderId(orderId);

    const pageSize = 200;
    let offset = 0;

    while (true) {
        const response = await fetch(
            `${API_URL}/payments/mine?limit=${pageSize}&offset=${offset}`,
            {
                headers: {
                    Authorization: `Bearer ${currentToken}`
                }
            }
        );

        const data = await response
            .json()
            .catch(() => ([]));

        if (response.status === 401) {
            throw new Error("SESSION_EXPIRED");
        }

        if (!response.ok) {
            throw new Error(
                data.detail
                || `HTTP ${response.status}`
            );
        }

        const rows = Array.isArray(data)
            ? data
            : [];

        const payment = rows.find(
            row =>
                normalizeBuyerPaymentOrderId(
                    row?.order_id
                ) === targetOrderId
        );

        if (payment) {
            return payment;
        }

        if (rows.length < pageSize) {
            return null;
        }

        offset += pageSize;
    }
}


function cacheBuyerPaymentForOrder(
    orderId,
    payment,
    errorMessage = ""
) {
    const key =
        normalizeBuyerPaymentOrderId(orderId);

    window.walzBuyerPaymentByOrderId =
        window.walzBuyerPaymentByOrderId || {};

    window.walzBuyerPaymentLoadErrors =
        window.walzBuyerPaymentLoadErrors || {};

    if (payment) {
        window.walzBuyerPaymentByOrderId[key] =
            payment;
    } else {
        delete window.walzBuyerPaymentByOrderId[key];
    }

    if (errorMessage) {
        window.walzBuyerPaymentLoadErrors[key] =
            errorMessage;
    } else {
        delete window.walzBuyerPaymentLoadErrors[key];
    }
}


function renderBuyerPaymentBlock(order) {
    const key =
        normalizeBuyerPaymentOrderId(order?.id);

    const payment =
        window.walzBuyerPaymentByOrderId?.[key]
        || null;

    const loadError =
        window.walzBuyerPaymentLoadErrors?.[key]
        || "";

    if (loadError) {
        return `
            <section class="pickup-progress-card">
                <strong>Pago</strong>
                <p>
                    No se pudo consultar el estado del pago.
                </p>
            </section>
        `;
    }

    if (!payment) {
        return `
            <section class="pickup-progress-card">
                <strong>Pago</strong>
                <p>Pago no registrado.</p>
            </section>
        `;
    }

    const method = String(
        payment.method || ""
    ).trim().toUpperCase();

    const status = String(
        payment.status || ""
    ).trim().toLowerCase();

    const statusInfo =
        getBuyerPaymentStatusPresentation(status);

    const amount = Number(
        payment.amount || 0
    );

    const currency = String(
        payment.currency || "ARS"
    ).trim().toUpperCase();

    const paymentId = escapeJs(
        String(payment.id || "")
    );

    const orderId = escapeJs(
        String(order?.id || "")
    );

    const reportable =
        method === "BANK_TRANSFER"
        || method === "CUENTA_DNI";

    const paymentDetails = {
        account_holder:
            payment.destination_account_holder || null,
        account_alias:
            payment.destination_account_alias || null,
        account_cbu_cvu:
            payment.destination_account_cbu_cvu || null,
        bank_name:
            payment.destination_bank_name || null,
        instructions:
            payment.destination_instructions || null
    };

    const hasBankDestination =
        method !== "BANK_TRANSFER"
        || Boolean(
            paymentDetails.account_alias
            || paymentDetails.account_cbu_cvu
        );

    let bankDetailsHtml = "";

    if (method === "BANK_TRANSFER") {
        if (hasBankDestination) {
            bankDetailsHtml = `
                <div class="pickup-progress-card">
                    <strong>Datos para transferir</strong>

                    ${paymentDetails?.account_holder ? `
                        <p>
                            <strong>Titular:</strong>
                            ${escapeHtml(paymentDetails.account_holder)}
                        </p>
                    ` : ""}

                    ${paymentDetails?.account_alias ? `
                        <p>
                            <strong>Alias:</strong>
                            ${escapeHtml(paymentDetails.account_alias)}
                        </p>
                    ` : ""}

                    ${paymentDetails?.account_cbu_cvu ? `
                        <p>
                            <strong>CBU / CVU:</strong>
                            ${escapeHtml(paymentDetails.account_cbu_cvu)}
                        </p>
                    ` : ""}

                    ${paymentDetails?.bank_name ? `
                        <p>
                            <strong>Banco:</strong>
                            ${escapeHtml(paymentDetails.bank_name)}
                        </p>
                    ` : ""}

                    ${paymentDetails?.instructions ? `
                        <p>
                            ${escapeHtml(paymentDetails.instructions)}
                        </p>
                    ` : ""}
                </div>
            `;
        } else {
            bankDetailsHtml = `
                <p>
                    Este pago no tiene un destino de transferencia
                    guardado en su registro original.
                </p>
            `;
        }
    }

    let action = "";

    if (
        status === "pending"
        && reportable
        && hasBankDestination
    ) {
        const label =
            method === "BANK_TRANSFER"
                ? "Informar transferencia realizada"
                : "Informar pago realizado";

        action = `
            <div class="seller-order-actions">
                <button
                    type="button"
                    onclick="reportBuyerPayment(
                        '${paymentId}',
                        '${orderId}'
                    )"
                >
                    ${label}
                </button>
            </div>
        `;
    }

    let explanation = "";

    if (status === "reported") {
        explanation = `
            <p>
                Pago informado. Esperando verificacion
                del vendedor.
            </p>
        `;
    }

    return `
        <section class="pickup-progress-card">
            <strong>Pago</strong>

            <p>
                ${escapeHtml(
                    getBuyerPaymentMethodLabel(method)
                )}
                - $${amount.toFixed(2)}
                ${escapeHtml(currency)}
            </p>

            <span class="order-status ${statusInfo.css}">
                ${escapeHtml(statusInfo.label)}
            </span>

            ${bankDetailsHtml}
            ${explanation}
            ${action}
        </section>
    `;
}


async function reportBuyerPayment(
    paymentId,
    orderId
) {
    const currentToken =
        localStorage.getItem("walz_token");

    if (!currentToken) {
        handleExpiredSession();
        return;
    }

    const confirmed = window.confirm(
        "Confirma que ya realizaste este pago. "
        + "El vendedor debera verificarlo."
    );

    if (!confirmed) {
        return;
    }

    try {
        const response = await fetch(
            `${API_URL}/payments/${encodeURIComponent(paymentId)}/report`,
            {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${currentToken}`
                }
            }
        );

        const data = await response
            .json()
            .catch(() => ({}));

        if (response.status === 401) {
            handleExpiredSession();
            return;
        }

        if (!response.ok) {
            throw new Error(
                data.detail
                || `HTTP ${response.status}`
            );
        }

        cacheBuyerPaymentForOrder(
            orderId,
            data
        );

        showMessage(
            "Pago informado al vendedor.",
            "success"
        );

        await openOrderDetail(orderId);

    } catch (error) {
        console.error(
            "Error informando pago:",
            error
        );

        showMessage(
            error.message
            || "No se pudo informar el pago.",
            "error"
        );
    }
}


function renderOrderDetail(order, items) {

    const container = document.getElementById("orders-content");

    if (!container) {
        return;
    }

    const createdAt = formatWalzDate(order.created_at);
    const pickupTimeline = renderOrderTimeline(order);

    const address = order.shipping_address || "Dirección no disponible";

    const canCancel = String(order.status || '').toLowerCase() === 'pending';
    const isPickup = String(order.shipping_address || '').toLowerCase().includes('retiro en el local');
    const pickupStatus = String(order.pickup_status || '');
    const pickupLabels = { ready: 'Listo para retirar', buyer_going: 'El comprador va a retirar', buyer_arrived: 'El comprador esta en el local', seller_handed: 'Entregado por el vendedor; falta confirmar recepcion', completed: 'Retirado y recibido' };
    let pickupActions = '';
    if (isPickup && pickupStatus === 'ready') pickupActions = `<button type="button" onclick="updateBuyerPickupStatus('${escapeJs(String(order.id))}', 'buyer_going')">Voy a retirar</button>`;
    if (isPickup && ['ready', 'buyer_going'].includes(pickupStatus)) pickupActions += `<button type="button" onclick="updateBuyerPickupStatus('${escapeJs(String(order.id))}', 'buyer_arrived')">Ya estoy en el local</button>`;
    if (isPickup && pickupStatus === 'seller_handed') pickupActions = `<button type="button" onclick="updateBuyerPickupStatus('${escapeJs(String(order.id))}', 'buyer_received')">Producto retirado y recibido</button>`;

    container.innerHTML = `
        <button type="button" onclick="backToMyOrders()">
            ← Volver a mis compras
        </button>
        <article class="order-detail-card">
            <h3>Pedido #${escapeHtml(String(order.id))}</h3>
            <dl class="order-summary">
                <div><dt>Estado</dt><dd>${escapeHtml(order.status || "Sin estado")}</dd></div>
                <div><dt>Compra realizada</dt><dd>${escapeHtml(createdAt)}</dd></div>
                <div><dt>Vendido por</dt><dd>${escapeHtml(order.seller_display_name || "Vendedor sin nombre")}</dd></div>
                <div><dt>Cuenta vendedora</dt><dd>${escapeHtml(order.seller_account_email || "No disponible")}</dd></div>
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

            ${renderBuyerPaymentBlock(order)}

            ${isPickup ? pickupTimeline : renderDeliveryPlan(order) + renderDeliveryResponsible(order)}
            ${isPickup && pickupStatus ? `<div class="pickup-progress-card"><strong>${escapeHtml(pickupLabels[pickupStatus] || pickupStatus)}</strong><div class="seller-order-actions">${pickupActions}</div></div>` : ""}
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


async function updateBuyerPickupStatus(orderId, action) {
    const currentToken = localStorage.getItem("walz_token");
    if (!currentToken) return handleExpiredSession();
    const labels = { buyer_going: "confirmar que vas a retirar", buyer_arrived: "avisar que ya estas en el local", buyer_received: "confirmar que recibiste el producto" };
    if (!window.confirm(`Confirmas que queres ${labels[action]}?`)) return;
    try {
        const res = await fetch(`${API_URL}/orders/${orderId}/pickup`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentToken}` }, body: JSON.stringify({ action }) });
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) return handleExpiredSession();
        if (!res.ok) throw new Error(data.detail || "No se pudo actualizar el retiro.");
        showMessage("Confirmacion registrada correctamente.", "success");
        renderOrderDetail(data, Array.isArray(data.items) ? data.items : []);
    } catch (error) { showMessage(error.message, "error"); }
}

async function confirmSellerPickupHandover(orderId) {
    const currentToken = localStorage.getItem("walz_token");
    if (!currentToken) return handleExpiredSession();
    if (!window.confirm("Confirmas que entregaste el producto al comprador presente?")) return;
    try {
        const res = await fetch(`${API_URL}/orders/seller/${orderId}/pickup-handover`, { method: "PATCH", headers: { Authorization: `Bearer ${currentToken}` } });
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) return handleExpiredSession();
        if (!res.ok) throw new Error(data.detail || "No se pudo confirmar la entrega.");
        showMessage("Entrega registrada. Falta la confirmacion del comprador.", "success");
        await loadReceivedOrders();
    } catch (error) { showMessage(error.message, "error"); }
}

async function cancelPendingOrder(orderId) {
    const token = localStorage.getItem("walz_token");

    if (!token) {
        showMessage("Tu sesion vencio. Inicia sesion nuevamente.", "error");
        handleLogout();
        return;
    }

    const confirmed = window.confirm(
        "¿Confirmas la cancelación del pedido? Las unidades volverán al stock."
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
        <button type="button" onclick="backToMyOrders()">
            Volver a mis compras
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
    // CARRITO VACIO
    // -------------------------------------------------

    if (cart.length === 0) {

        container.innerHTML = `
            <div class="cart-empty">
                Carrito vacío.
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
                            -
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
                            Quitar
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
    renderSellerDeliveryOptions();
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
        `${item.name} eliminado del carrito.`,
        "success"
    );

    updateCartUI();

    renderCart();
}


// =====================================================
// CHECKOUT
// =====================================================

function getCheckoutSellerGroups() {
    const productsById = new Map((window.walzProducts || []).map(product => [String(product.id), product]));
    const groups = new Map();
    for (const item of cart) {
        const product = productsById.get(String(item.id));
        if (!product) continue;
        const sellerId = String(product.seller_id);
        if (!groups.has(sellerId)) {
            const store = window.walzStoresByOwner?.[sellerId] || null;
            groups.set(sellerId, { sellerId, store, items: [] });
        }
        groups.get(sellerId).items.push(item);
    }
    return Array.from(groups.values());
}


function getBuyerCheckoutPaymentDeliveryMethod(
    storeId
) {
    const normalizedStoreId = String(
        storeId || ""
    );

    const group = getCheckoutSellerGroups().find(
        item =>
            String(item?.store?.id || "")
            === normalizedStoreId
    );

    if (!group) {
        return "";
    }

    return document.querySelector(
        `input[data-seller-delivery="${group.sellerId}"]:checked`
    )?.value || "";
}


function isBuyerCheckoutPaymentMethodAvailable(
    method,
    deliveryMethod
) {
    const normalizedMethod = String(
        method || ""
    ).trim().toUpperCase();

    if (normalizedMethod === "CASH") {
        return deliveryMethod === "pickup";
    }

    return true;
}


function setBuyerCheckoutPaymentMethod(
    storeId,
    method
) {
    const normalizedStoreId = String(
        storeId || ""
    );

    const normalizedMethod = String(
        method || ""
    ).trim().toUpperCase();

    if (
        !normalizedStoreId
        || !normalizedMethod
    ) {
        return;
    }

    window.walzBuyerCheckoutPaymentSelections =
        window.walzBuyerCheckoutPaymentSelections
        || {};

    const cache =
        window.walzBuyerCheckoutPaymentMethodsCache
        || {};

    const data =
        cache[normalizedStoreId]?.data;

    const methods = Array.isArray(data?.methods)
        ? data.methods
        : [];

    const exists = methods.some(
        item =>
            String(item?.method || "")
                .trim()
                .toUpperCase()
            === normalizedMethod
    );

    if (!exists) {
        return;
    }

    const deliveryMethod =
        getBuyerCheckoutPaymentDeliveryMethod(
            normalizedStoreId
        );

    if (
        !isBuyerCheckoutPaymentMethodAvailable(
            normalizedMethod,
            deliveryMethod
        )
    ) {
        return;
    }

    window.walzBuyerCheckoutPaymentSelections[
        normalizedStoreId
    ] = normalizedMethod;

    const deliveryError =
        document.getElementById(
            "delivery-error"
        );

    if (deliveryError) {
        deliveryError.textContent = "";
    }
}


function renderBuyerCheckoutPaymentMethodsPreview(
    sellerId,
    data = null,
    errorMessage = ""
) {
    const container = document.querySelector(
        `[data-buyer-payment-methods="${sellerId}"]`
    );

    if (!container) {
        return;
    }

    if (errorMessage) {
        container.innerHTML = `
            <strong>Forma de pago</strong>
            <span class="buyer-payment-methods-error">
                ${escapeHtml(errorMessage)}
            </span>
        `;
        return;
    }

    const storeId = String(
        data?.store_id || ""
    );

    if (!storeId) {
        container.innerHTML = `
            <strong>Forma de pago</strong>
            <span class="buyer-payment-methods-error">
                No se pudo identificar la tienda.
            </span>
        `;
        return;
    }

    const methods = Array.isArray(data?.methods)
        ? data.methods
        : [];

    if (methods.length === 0) {
        container.innerHTML = `
            <strong>Forma de pago</strong>
            <span class="buyer-payment-methods-empty">
                Esta tienda no tiene formas de pago disponibles.
            </span>
        `;
        return;
    }

    window.walzBuyerCheckoutPaymentSelections =
        window.walzBuyerCheckoutPaymentSelections
        || {};

    const selections =
        window.walzBuyerCheckoutPaymentSelections;

    const deliveryMethod =
        getBuyerCheckoutPaymentDeliveryMethod(
            storeId
        );

    let selectedMethod = String(
        selections[storeId] || ""
    ).trim().toUpperCase();

    const selectedStillAvailable = methods.some(
        item => {
            const method = String(
                item?.method || ""
            ).trim().toUpperCase();

            return (
                method === selectedMethod
                && isBuyerCheckoutPaymentMethodAvailable(
                    method,
                    deliveryMethod
                )
            );
        }
    );

    if (
        selectedMethod
        && !selectedStillAvailable
    ) {
        delete selections[storeId];
        selectedMethod = "";
    }

    container.innerHTML = `
        <strong>Eleg&iacute; una forma de pago</strong>

        <div class="buyer-payment-methods-list">
            ${methods.map(item => {
                const method = String(
                    item?.method || ""
                ).trim().toUpperCase();

                const label = String(
                    item?.label
                    || method
                    || "Forma de pago"
                );

                const available =
                    isBuyerCheckoutPaymentMethodAvailable(
                        method,
                        deliveryMethod
                    );

                const selected =
                    available
                    && selectedMethod === method;

                const pickupNote =
                    item.allow_pay_on_pickup === true
                        ? (
                            method === "CASH"
                                ? "Se abona al retirar."
                                : "Tambi&eacute;n puede abonarse al retirar."
                        )
                        : "";

                const unavailableNote =
                    method === "CASH"
                    && !available
                        ? "Disponible solamente con retiro en el local."
                        : "";

                return `
                    <label
                        class="
                            buyer-payment-method-option
                            ${selected ? "is-selected" : ""}
                            ${available ? "" : "is-disabled"}
                        "
                    >
                        <input
                            type="radio"
                            name="buyer-payment-method-${escapeHtml(storeId)}"
                            value="${escapeHtml(method)}"
                            data-buyer-payment-choice="true"
                            data-buyer-payment-store="${escapeHtml(storeId)}"
                            ${selected ? "checked" : ""}
                            ${available ? "" : "disabled"}
                        >

                        <span class="buyer-payment-method-option-content">
                            <strong>
                                ${escapeHtml(label)}
                            </strong>

                            ${pickupNote
                                ? `
                                    <small>
                                        ${escapeHtml(pickupNote)}
                                    </small>
                                `
                                : ""
                            }

                            ${unavailableNote
                                ? `
                                    <small>
                                        ${escapeHtml(unavailableNote)}
                                    </small>
                                `
                                : ""
                            }
                        </span>
                    </label>
                `;
            }).join("")}
        </div>
    `;

    container
        .querySelectorAll(
            'input[data-buyer-payment-choice]'
        )
        .forEach(input => {
            input.addEventListener(
                "change",
                () => {
                    if (!input.checked) {
                        return;
                    }

                    setBuyerCheckoutPaymentMethod(
                        input.getAttribute(
                            "data-buyer-payment-store"
                        ),
                        input.value
                    );

                    renderBuyerCheckoutPaymentMethodsPreview(
                        sellerId,
                        data
                    );
                }
            );
        });
}


function refreshBuyerCheckoutPaymentMethodsFromCache() {
    const cache =
        window.walzBuyerCheckoutPaymentMethodsCache
        || {};

    const groups =
        getCheckoutSellerGroups();

    for (const group of groups) {
        const sellerId = String(
            group?.sellerId || ""
        );

        const storeId = String(
            group?.store?.id || ""
        );

        if (
            !sellerId
            || !storeId
        ) {
            continue;
        }

        const cached =
            cache[storeId];

        if (!cached?.data) {
            continue;
        }

        renderBuyerCheckoutPaymentMethodsPreview(
            sellerId,
            cached.data
        );
    }
}


async function loadBuyerCheckoutPaymentMethodsPreview(groups) {
    const token = localStorage.getItem("walz_token");

    if (!token) {
        return;
    }

    const rows = Array.isArray(groups)
        ? groups
        : [];

    window.walzBuyerCheckoutPaymentMethodsCache =
        window.walzBuyerCheckoutPaymentMethodsCache || {};

    const cache =
        window.walzBuyerCheckoutPaymentMethodsCache;

    await Promise.all(
        rows.map(async group => {
            const sellerId = String(
                group?.sellerId || ""
            );

            const storeId = String(
                group?.store?.id || ""
            );

            if (!sellerId) {
                return;
            }

            if (!storeId) {
                renderBuyerCheckoutPaymentMethodsPreview(
                    sellerId,
                    null,
                    "No se pudo identificar la tienda."
                );
                return;
            }

            const cached = cache[storeId];

            if (
                cached
                && cached.data
                && (
                    Date.now()
                    - Number(cached.loadedAt || 0)
                ) < 30000
            ) {
                renderBuyerCheckoutPaymentMethodsPreview(
                    sellerId,
                    cached.data
                );
                return;
            }

            try {
                const response = await fetch(
                    `${API_URL}/payments/stores/${encodeURIComponent(storeId)}/methods`,
                    {
                        headers: {
                            "Authorization": `Bearer ${token}`
                        }
                    }
                );

                if (response.status === 401) {
                    handleExpiredSession();

                    renderBuyerCheckoutPaymentMethodsPreview(
                        sellerId,
                        null,
                        "Tu sesion vencio."
                    );

                    return;
                }

                const data =
                    await response.json().catch(() => ({}));

                if (!response.ok) {
                    throw new Error(
                        data.detail
                        || "No se pudieron cargar las formas de pago."
                    );
                }

                cache[storeId] = {
                    data,
                    loadedAt: Date.now()
                };

                renderBuyerCheckoutPaymentMethodsPreview(
                    sellerId,
                    data
                );

            } catch (error) {
                console.error(
                    "Error cargando formas de pago para checkout:",
                    error
                );

                renderBuyerCheckoutPaymentMethodsPreview(
                    sellerId,
                    null,
                    error.message
                    || "No se pudieron cargar las formas de pago."
                );
            }
        })
    );
}


function renderSellerDeliveryOptions() {
    const container = document.getElementById("seller-delivery-methods");
    if (!container) return;
    const previous = window.walzSellerDeliverySelections || {};
    const groups = getCheckoutSellerGroups();
    container.innerHTML = groups.map(group => {
        const store = group.store;
        const deliveryEnabled = store?.delivery_enabled !== false;
        const pickupEnabled = store?.pickup_enabled !== false;
        let selected = previous[group.sellerId];
        if (selected === "delivery" && !deliveryEnabled) selected = "";
        if (selected === "pickup" && !pickupEnabled) selected = "";
        if (!selected) selected = deliveryEnabled ? "delivery" : "pickup";
        previous[group.sellerId] = selected;
        const storeName = store?.name || "Vendedor WalZ";
        return `
            <section class="seller-delivery-card">
                <div class="seller-delivery-heading">
                    <strong>${escapeHtml(storeName)}</strong>
                    <span>${group.items.length} producto${group.items.length === 1 ? "" : "s"}</span>
                </div>
                <div class="delivery-method-options">
                    ${deliveryEnabled ? `<label><input type="radio" data-seller-delivery="${group.sellerId}" name="delivery-method-${group.sellerId}" value="delivery" ${selected === "delivery" ? "checked" : ""} onchange="setSellerDeliveryMethod('${group.sellerId}', 'delivery')"> Envio a domicilio</label>` : ""}
                    ${pickupEnabled ? `<label><input type="radio" data-seller-delivery="${group.sellerId}" name="delivery-method-${group.sellerId}" value="pickup" ${selected === "pickup" ? "checked" : ""} onchange="setSellerDeliveryMethod('${group.sellerId}', 'pickup')"> Retiro en el local</label>` : ""}
                </div>
                ${deliveryEnabled ? `<div class="buyer-delivery-preference" data-delivery-preference="${group.sellerId}">
                    <strong>Preferencia para la entrega</strong>
                    <p>Selecciona una fecha desde manana. La tienda podra confirmarla o proponer otra.</p>
                    <div><label>Fecha preferida<input type="date" data-requested-date="${group.sellerId}"></label>
                    <label>Franja preferida<select data-requested-window="${group.sellerId}"><option value="">Seleccionar</option><option value="08:00 a 12:00">08:00 a 12:00</option><option value="12:00 a 16:00">12:00 a 16:00</option><option value="16:00 a 20:00">16:00 a 20:00</option><option value="Horario a coordinar">Horario a coordinar</option></select></label></div>
                </div>` : ""}
            </section>`;
    }).join("");
    window.walzSellerDeliverySelections = previous;

    for (const group of groups) {
        const sellerId = String(
            group?.sellerId || ""
        );

        const deliveryInput = container.querySelector(
            `input[data-seller-delivery="${sellerId}"]`
        );

        const card = deliveryInput?.closest(
            ".seller-delivery-card"
        );

        if (!card) {
            continue;
        }

        const paymentPreview =
            document.createElement("div");

        paymentPreview.className =
            "buyer-payment-methods-preview";

        paymentPreview.setAttribute(
            "data-buyer-payment-methods",
            sellerId
        );

        paymentPreview.innerHTML = `
            <strong>Formas de pago disponibles</strong>
            <span class="buyer-payment-methods-loading">
                Cargando...
            </span>
        `;

        card.appendChild(paymentPreview);
    }

    updateDeliveryMethod();

    loadBuyerCheckoutPaymentMethodsPreview(
        groups
    );
}

function setSellerDeliveryMethod(sellerId, method) {
    window.walzSellerDeliverySelections = window.walzSellerDeliverySelections || {};
    window.walzSellerDeliverySelections[String(sellerId)] = method;
    updateDeliveryMethod();
}

function updateDeliveryMethod() {
    const methods = Array.from(document.querySelectorAll('input[data-seller-delivery]:checked')).map(input => input.value);
    const needsAddress = methods.includes("delivery");
    const hasPickup = methods.includes("pickup");
    const addressFields = document.getElementById("delivery-address-fields");
    const pickupInformation = document.getElementById("pickup-information");
    const deliveryHeading = document.querySelector(".delivery-form > h3:nth-of-type(2)");
    if (addressFields) addressFields.style.display = needsAddress ? "grid" : "none";
    if (pickupInformation) pickupInformation.style.display = hasPickup ? "block" : "none";
    if (deliveryHeading) deliveryHeading.textContent = needsAddress ? "Datos del comprador y domicilio" : "Datos para el retiro";
    document.querySelectorAll("[data-delivery-preference]").forEach(section => {
        const sellerId = section.getAttribute("data-delivery-preference");
        const selected = document.querySelector(`input[data-seller-delivery="${sellerId}"]:checked`)?.value;
        section.style.display = selected === "delivery" ? "grid" : "none";
        const dateInput = section.querySelector("input[type=date]");
        if (dateInput && !dateInput.min) {
            const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
            dateInput.min = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth()+1).padStart(2,"0")}-${String(tomorrow.getDate()).padStart(2,"0")}`;
        }
    });
    refreshBuyerCheckoutPaymentMethodsFromCache();

    const deliveryError = document.getElementById("delivery-error");
    if (deliveryError) deliveryError.textContent = "";
}

function checkout() {
    if (cart.length === 0) { showMessage("El carrito esta vacio.", "error"); return; }
    if (!localStorage.getItem("walz_token")) { showMessage("Debes iniciar sesion para comprar.", "error"); return; }

    const groups = getCheckoutSellerGroups();
    const deliveryName = document.getElementById("delivery-name")?.value.trim() || "";
    const deliveryAddress = document.getElementById("delivery-address")?.value.trim() || "";
    const deliveryCity = document.getElementById("delivery-city")?.value.trim() || "";
    const deliveryPhone = document.getElementById("delivery-phone")?.value.trim() || "";
    const deliveryNotes = document.getElementById("delivery-notes")?.value.trim() || "";
    const deliveryError = document.getElementById("delivery-error");
    const paymentSelections =
        window.walzBuyerCheckoutPaymentSelections
        || {};

    const paymentCache =
        window.walzBuyerCheckoutPaymentMethodsCache
        || {};

    const choices = groups.map(group => {
        const storeId = String(
            group?.store?.id || ""
        );

        const deliveryMethod =
            document.querySelector(
                `input[data-seller-delivery="${group.sellerId}"]:checked`
            )?.value || "";

        const paymentMethod = String(
            paymentSelections[storeId] || ""
        ).trim().toUpperCase();

        const availablePayments = Array.isArray(
            paymentCache[storeId]?.data?.methods
        )
            ? paymentCache[storeId].data.methods
            : [];

        const paymentOption =
            availablePayments.find(
                item =>
                    String(item?.method || "")
                        .trim()
                        .toUpperCase()
                    === paymentMethod
            );

        const paymentValid = Boolean(
            paymentOption
            && isBuyerCheckoutPaymentMethodAvailable(
                paymentMethod,
                deliveryMethod
            )
        );

        return {
            sellerId: group.sellerId,
            storeId,
            storeName:
                group.store?.name
                || "Vendedor WalZ",
            method: deliveryMethod,
            paymentMethod,
            paymentLabel:
                paymentOption?.label
                || paymentMethod,
            paymentValid,
            requestedDate:
                document.querySelector(
                    `[data-requested-date="${group.sellerId}"]`
                )?.value || "",
            requestedTimeWindow:
                document.querySelector(
                    `[data-requested-window="${group.sellerId}"]`
                )?.value || ""
        };
    });
    if (choices.some(choice => !choice.method)) {
        if (deliveryError) deliveryError.textContent = "Selecciona una forma de entrega para cada tienda.";
        return;
    }

    if (
        choices.some(
            choice =>
                !choice.storeId
                || !choice.paymentMethod
                || !choice.paymentValid
        )
    ) {
        if (deliveryError) {
            deliveryError.textContent =
                "Selecciona una forma de pago valida para cada tienda.";
        }
        return;
    }
    const needsAddress = choices.some(choice => choice.method === "delivery");
    if (choices.some(choice => choice.method === "delivery" && (!choice.requestedDate || !choice.requestedTimeWindow))) {
        if (deliveryError) deliveryError.textContent = "Selecciona fecha y franja preferidas para cada envio.";
        return;
    }
    if (!deliveryName || !deliveryPhone || (needsAddress && (!deliveryAddress || !deliveryCity))) {
        if (deliveryError) deliveryError.textContent = needsAddress
            ? "Completa nombre, direccion, ciudad y telefono."
            : "Completa nombre y telefono.";
        return;
    }
    if (deliveryError) deliveryError.textContent = "";

    const deliveries = choices.map(choice => {
        const shippingAddress = [
            choice.method === "pickup" ? "Metodo: Retiro en el local" : "Metodo: Envio a domicilio",
            `Tienda: ${choice.storeName}`,
            `Destinatario: ${deliveryName}`,
            choice.method === "delivery" ? `Direccion: ${deliveryAddress}` : "Direccion del local: A confirmar",
            choice.method === "delivery" ? `Ciudad: ${deliveryCity}` : null,
            `Telefono: ${deliveryPhone}`,
            deliveryNotes ? `Observaciones: ${deliveryNotes}` : null
        ].filter(Boolean).join(" | ");
        return { seller_id: choice.sellerId, store_name: choice.storeName, method: choice.method, shipping_address: shippingAddress, requested_date: choice.method === "delivery" ? choice.requestedDate : null, requested_time_window: choice.method === "delivery" ? choice.requestedTimeWindow : null };
    });
    const payments = choices.map(choice => ({
        store_id: choice.storeId,
        seller_id: choice.sellerId,
        store_name: choice.storeName,
        method: choice.paymentMethod,
        label: choice.paymentLabel
    }));

    const uniqueMethods =
        new Set(
            deliveries.map(
                delivery => delivery.method
            )
        );

    pendingCheckout = {
        items: cart.map(item => ({
            product_id: item.id,
            quantity: item.qty
        })),
        deliveries,
        payments,
        delivery: {
            method:
                uniqueMethods.size > 1
                    ? "mixed"
                    : deliveries[0]?.method
                        || "delivery",
            name: deliveryName,
            address: deliveryAddress,
            city: deliveryCity,
            phone: deliveryPhone,
            notes: deliveryNotes
        },
        cart: cart.map(item => ({
            ...item
        }))
    };
    renderCheckoutConfirmation();
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

    const paymentBySeller = Object.fromEntries(
        (pendingCheckout.payments || []).map(
            payment => [
                String(payment.seller_id || ""),
                payment
            ]
        )
    );

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
            <h3>Entrega por tienda</h3>
            ${pendingCheckout.deliveries.map(delivery => {
                const payment =
                    paymentBySeller[
                        String(delivery.seller_id || "")
                    ] || {};

                return `
                    <div class="checkout-store-delivery-summary">
                        <strong>
                            ${escapeHtml(delivery.store_name)}
                        </strong>

                        <span>
                            ${delivery.method === "pickup"
                                ? "Retiro en el local"
                                : "Envio a domicilio"
                            }
                        </span>

                        ${delivery.method === "delivery"
                            ? `
                                <small>
                                    Preferencia:
                                    ${escapeHtml(
                                        formatDeliveryDateOnly(
                                            delivery.requested_date
                                        )
                                    )}
                                    |
                                    ${escapeHtml(
                                        delivery.requested_time_window
                                        || ""
                                    )}
                                </small>
                            `
                            : ""
                        }

                        <small class="checkout-store-payment-summary">
                            Pago:
                            ${escapeHtml(
                                payment.label
                                || payment.method
                                || "Sin seleccionar"
                            )}
                        </small>
                    </div>
                `;
            }).join("")}
            <p><strong>Nombre:</strong> ${escapeHtml(pendingCheckout.delivery.name)}</p>
            ${pendingCheckout.delivery.address ? `<p><strong>Direccion:</strong> ${escapeHtml(pendingCheckout.delivery.address)} - ${escapeHtml(pendingCheckout.delivery.city)}</p>` : ""}
            <p><strong>Telefono:</strong> ${escapeHtml(pendingCheckout.delivery.phone)}</p>
            ${pendingCheckout.delivery.notes ? `<p><strong>Observaciones:</strong> ${escapeHtml(pendingCheckout.delivery.notes)}</p>` : ""}
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



async function createBuyerPaymentsForCheckout(
    orders,
    paymentSelections,
    token
) {
    const rows =
        Array.isArray(paymentSelections)
            ? paymentSelections
            : [];

    const paymentByStoreId = new Map();
    const duplicateStoreIds = new Set();

    for (const selection of rows) {
        const storeId = String(
            selection?.store_id || ""
        ).trim();

        const method = String(
            selection?.method || ""
        ).trim().toUpperCase();

        if (!storeId || !method) {
            continue;
        }

        if (paymentByStoreId.has(storeId)) {
            duplicateStoreIds.add(storeId);
        }

        paymentByStoreId.set(
            storeId,
            {
                ...selection,
                store_id: storeId,
                method
            }
        );
    }

    const created = [];
    const failures = [];

    for (
        const order of (
            Array.isArray(orders)
                ? orders
                : []
        )
    ) {
        const orderId = String(
            order?.id || ""
        ).trim();

        const storeId = String(
            order?.store_id || ""
        ).trim();

        const sellerId = String(
            order?.seller_id || ""
        ).trim();

        const selection =
            paymentByStoreId.get(storeId)
            || null;

        const storeName = String(
            selection?.store_name
            || "Tienda"
        ).trim();

        if (!orderId || !storeId) {
            failures.push({
                order_id: orderId || null,
                store_id: storeId || null,
                store_name: storeName,
                method: selection?.method || null,
                detail:
                    "El pedido fue creado pero no devolvio "
                    + "los identificadores necesarios para registrar el pago."
            });

            continue;
        }

        if (duplicateStoreIds.has(storeId)) {
            failures.push({
                order_id: orderId,
                store_id: storeId,
                store_name: storeName,
                method: selection?.method || null,
                detail:
                    "Hay mas de una seleccion de pago "
                    + "para la misma tienda."
            });

            continue;
        }

        if (!selection?.method) {
            failures.push({
                order_id: orderId,
                store_id: storeId,
                store_name: storeName,
                method: null,
                detail:
                    "No se encontro la forma de pago "
                    + "seleccionada para esta tienda."
            });

            continue;
        }

        const selectedSellerId = String(
            selection.seller_id || ""
        ).trim();

        if (
            selectedSellerId
            && sellerId
            && selectedSellerId !== sellerId
        ) {
            failures.push({
                order_id: orderId,
                store_id: storeId,
                store_name: storeName,
                method: selection.method,
                detail:
                    "La tienda del pedido no coincide "
                    + "con la seleccion de pago."
            });

            continue;
        }

        try {
            const response = await fetch(
                `${API_URL}/payments/orders/${encodeURIComponent(orderId)}`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        method: selection.method
                    })
                }
            );

            const responseText =
                await response.text();

            if (!response.ok) {
                let detail =
                    "No se pudo registrar la forma de pago.";

                try {
                    const data =
                        JSON.parse(responseText);

                    detail =
                        data.detail
                        || detail;
                } catch (_) {}

                failures.push({
                    order_id: orderId,
                    store_id: storeId,
                    store_name: storeName,
                    method: selection.method,
                    detail
                });

                continue;
            }

            let payment = null;

            if (responseText) {
                try {
                    payment =
                        JSON.parse(responseText);
                } catch (_) {
                    payment = null;
                }
            }

            created.push({
                order_id: orderId,
                store_id: storeId,
                store_name: storeName,
                method: selection.method,
                payment
            });

        } catch (paymentError) {
            console.error(
                "Error creando Payment para pedido:",
                orderId,
                paymentError
            );

            failures.push({
                order_id: orderId,
                store_id: storeId,
                store_name: storeName,
                method: selection.method,
                detail:
                    "No se pudo conectar con el servicio de pagos."
            });
        }
    }

    return {
        created,
        failures
    };
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
                deliveries: orderData.deliveries.map(delivery => ({
                    seller_id: delivery.seller_id,
                    method: delivery.method,
                    shipping_address: delivery.shipping_address,
                    requested_date: delivery.requested_date,
                    requested_time_window: delivery.requested_time_window
                }))
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

        let paymentOutcome = {
            created: [],
            failures: []
        };

        try {
            paymentOutcome =
                await createBuyerPaymentsForCheckout(
                    orders,
                    orderData.payments,
                    token
                );
        } catch (paymentError) {
            console.error(
                "Error inesperado registrando Payments:",
                paymentError
            );

            paymentOutcome = {
                created: [],
                failures: orders.map(
                    order => ({
                        order_id:
                            String(order?.id || "") || null,
                        store_id:
                            String(order?.store_id || "") || null,
                        store_name: "Tienda",
                        method: null,
                        detail:
                            "El pedido fue creado, pero no se pudo "
                            + "registrar su forma de pago."
                    })
                )
            };
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
        // WALZ_LOGIN_KEYBOARD_V1
        for (const fieldId of ["login-email", "login-password"]) {
            document.getElementById(fieldId)?.addEventListener("keydown", event => {
                if (event.key !== "Enter" || event.repeat) return;
                event.preventDefault();
                handleLogin();
            });
        }

        updateCartUI();
        showWalzNewsBarIfAllowed();

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

        if (paymentOutcome.failures.length > 0) {
            const affectedStores = [
                ...new Set(
                    paymentOutcome.failures
                        .map(
                            item =>
                                String(
                                    item.store_name || "Tienda"
                                ).trim()
                        )
                        .filter(Boolean)
                )
            ];

            console.warn(
                "Pedidos creados con Payments pendientes:",
                paymentOutcome.failures
            );

            showMessage(
                "La compra fue creada. "
                + "Falta registrar el pago de: "
                + affectedStores.join(", ")
                + ". No vuelvas a confirmar la compra.",
                "error"
            );
        } else {
            showMessage(
                "Compra confirmada y formas de pago registradas.",
                "success"
            );
        }

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

    window.walzOrderSuccessOpen = true;
    window.walzOrderDetailOpen = false;

    const createdOrders = Array.isArray(orders)
        ? orders
        : [orders];
    const method = delivery?.method === "mixed"
        ? "Modalidad elegida para cada tienda"
        : delivery?.method === "pickup"
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
// UI AUTENTICACION
// =====================================================

function hideAuthForms() {
    for (const id of ["login-form", "register-form", "forgot-password-form", "reset-password-form", "confirm-email-change-form"]) {
        const element = document.getElementById(id);
        if (element) element.style.display = "none";
    }
    const message = document.getElementById("message-box");
    if (message) message.className = "message-box";
}

function showRegister() { hideAuthForms(); document.getElementById("register-form").style.display = "flex"; }
function showLogin() { hideAuthForms(); document.getElementById("login-form").style.display = "flex"; }
function showForgotPassword() { hideAuthForms(); document.getElementById("forgot-password-form").style.display = "flex"; }
function showResetPassword() { hideAuthForms(); document.getElementById("reset-password-form").style.display = "flex"; }

function showAuth() {
    hideAllWalzWorkSections();
    stopMarketplaceBannerRotation();

    const bannerContainer = document.getElementById("marketplace-banners");
    if (bannerContainer) {
        bannerContainer.style.display = "none";
        bannerContainer.innerHTML = "";
    }

    window.walzActiveBanners = [];

    document.getElementById("auth-section").style.display = "block";
    document.getElementById("marketplace-section").style.display = "none";
    if (new URLSearchParams(window.location.search).get("reset_token")) showResetPassword();
    else if (new URLSearchParams(window.location.search).get("email_change_token")) showConfirmEmailChange();
}

function showMarketplace() {

    document.getElementById(
        "auth-section"
    ).style.display = "none";

    document.getElementById(
        "marketplace-section"
    ).style.display = "block";

    updateAdminBannerVisibility();
}




// =====================================================
// FASE 5J - PEDIDOS RECIBIDOS
// =====================================================


// =====================================================
// CONTEXTO PRIVADO DEL VENDEDOR
// =====================================================

function enterSellerPrivateContext() {
    const currentPath =
        window.location.pathname
            .split("/")
            .filter(Boolean)
            .join("/")
            .toLowerCase();

    const hasPublicStoreContext = Boolean(
        window.walzMarketplaceSellerId ||
        window.walzPublicStoreSellerId
    );

    // El panel privado nunca debe conservar
    // el contexto de una tienda publica.
    window.walzMarketplaceSellerId = null;
    window.walzPublicStoreSellerId = null;

    if (currentPath && hasPublicStoreContext) {
        window.history.replaceState(
            {},
            document.title,
            "/"
        );
    }
}

function showReceivedOrders() {
    enterSellerPrivateContext();
    hideAllWalzWorkSections();
    hideSellerApplicationSections();
    hidePublicStoreSection();
    hideStoreProfileSection();
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
    scrollPageToTop();
    loadReceivedOrders();
}


function normalizeSellerPaymentOrderId(value) {
    return String(value || "")
        .replace(/-/g, "")
        .trim()
        .toLowerCase();
}


function getSellerPaymentMethodLabel(method) {
    const labels = {
        CASH: "Efectivo",
        BANK_TRANSFER: "Transferencia bancaria",
        CUENTA_DNI: "Cuenta DNI",
        MERCADO_PAGO: "Mercado Pago"
    };

    const normalized = String(method || "")
        .trim()
        .toUpperCase();

    return labels[normalized] || normalized || "No informado";
}


function getSellerPaymentStatusPresentation(status) {
    const normalized = String(status || "")
        .trim()
        .toLowerCase();

    const states = {
        pending: {
            label: "Pendiente",
            css: "order-status-pending"
        },
        reported: {
            label: "Informado por el comprador",
            css: "order-status-confirmed"
        },
        approved: {
            label: "Pago confirmado",
            css: "order-status-delivered"
        },
        rejected: {
            label: "Pago rechazado",
            css: "order-status-cancelled"
        },
        cancelled: {
            label: "Pago cancelado",
            css: "order-status-cancelled"
        }
    };

    return states[normalized] || {
        label: normalized || "Sin estado",
        css: "order-status-unknown"
    };
}


function rebuildSellerPaymentIndex(payments) {
    const index = {};

    for (
        const payment of Array.isArray(payments)
            ? payments
            : []
    ) {
        const key = normalizeSellerPaymentOrderId(
            payment?.order_id
        );

        if (!key) {
            continue;
        }

        const current = index[key];

        const currentTime = Date.parse(
            current?.created_at || ""
        ) || 0;

        const candidateTime = Date.parse(
            payment?.created_at || ""
        ) || 0;

        if (
            !current
            || candidateTime >= currentTime
        ) {
            index[key] = payment;
        }
    }

    window.walzSellerPaymentByOrderId = index;
}


async function loadAllSellerPayments(currentToken) {
    const pageSize = 200;
    let offset = 0;
    const payments = [];

    while (true) {
        const response = await fetch(
            `${API_URL}/payments/seller/mine?limit=${pageSize}&offset=${offset}`,
            {
                headers: {
                    Authorization: `Bearer ${currentToken}`
                }
            }
        );

        const data = await response
            .json()
            .catch(() => ([]));

        if (response.status === 401) {
            throw new Error("SESSION_EXPIRED");
        }

        if (!response.ok) {
            throw new Error(
                data.detail
                || `HTTP ${response.status}`
            );
        }

        const rows = Array.isArray(data)
            ? data
            : [];

        payments.push(...rows);

        if (rows.length < pageSize) {
            break;
        }

        offset += pageSize;
    }

    return payments;
}


function renderSellerPaymentBlock(order) {
    const orderKey = normalizeSellerPaymentOrderId(
        order?.id
    );

    const payment =
        window.walzSellerPaymentByOrderId?.[
            orderKey
        ] || null;

    if (window.walzSellerPaymentsLoadError) {
        return `
            <div class="sales-delivery-data">
                <span>Pago</span>
                <p>
                    No se pudo consultar el estado del pago.
                </p>
            </div>
        `;
    }

    if (!payment) {
        return `
            <div class="sales-delivery-data">
                <span>Pago</span>
                <p>Pago no registrado.</p>
            </div>
        `;
    }

    const method = String(
        payment.method || ""
    ).trim().toUpperCase();

    const status = String(
        payment.status || ""
    ).trim().toLowerCase();

    const statusInfo =
        getSellerPaymentStatusPresentation(status);

    const amount = Number(
        payment.amount || 0
    );

    const currency = String(
        payment.currency || "ARS"
    ).trim().toUpperCase();

    const paymentId = escapeJs(
        String(payment.id || "")
    );

    const buyerReportable =
        method === "BANK_TRANSFER"
        || method === "CUENTA_DNI";

    const canReview = buyerReportable
        ? status === "reported"
        : (
            status === "pending"
            || status === "reported"
        );

    const waitingForBuyerPayment =
        buyerReportable && status === "pending"
            ? `
                <p>
                    Esperando que el comprador informe el pago.
                </p>
            `
            : "";

    const approveLabel =
        method === "CASH"
            ? "Confirmar pago recibido"
            : "Aprobar pago";

    const actions = canReview
        ? `
            <div class="seller-order-actions">
                <button
                    type="button"
                    onclick="updateSellerPaymentStatus(
                        '${paymentId}',
                        'approved',
                        '${approveLabel}'
                    )"
                >
                    ${approveLabel}
                </button>

                <button
                    type="button"
                    class="seller-cancel-button"
                    onclick="updateSellerPaymentStatus(
                        '${paymentId}',
                        'rejected',
                        'Rechazar pago'
                    )"
                >
                    Rechazar pago
                </button>
            </div>
        `
        : "";

    return `
        <div class="sales-delivery-data">
            <span>Pago</span>

            <p>
                <strong>
                    ${escapeHtml(
                        getSellerPaymentMethodLabel(method)
                    )}
                </strong>
                - $${amount.toFixed(2)}
                ${escapeHtml(currency)}
            </p>

            <span class="order-status ${statusInfo.css}">
                ${escapeHtml(statusInfo.label)}
            </span>

            ${waitingForBuyerPayment}

            ${actions}
        </div>
    `;
}


async function updateSellerPaymentStatus(
    paymentId,
    requestedStatus,
    actionLabel
) {
    const currentToken =
        localStorage.getItem("walz_token");

    if (!currentToken) {
        handleExpiredSession();
        return;
    }

    const confirmed = window.confirm(
        `${actionLabel}. Confirma esta accion.`
    );

    if (!confirmed) {
        return;
    }

    try {
        const response = await fetch(
            `${API_URL}/payments/seller/${encodeURIComponent(paymentId)}/status`,
            {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${currentToken}`
                },
                body: JSON.stringify({
                    status: requestedStatus
                })
            }
        );

        const data = await response
            .json()
            .catch(() => ({}));

        if (response.status === 401) {
            handleExpiredSession();
            return;
        }

        if (!response.ok) {
            throw new Error(
                data.detail
                || `HTTP ${response.status}`
            );
        }

        showMessage(
            requestedStatus === "approved"
                ? "Pago confirmado correctamente."
                : "Pago rechazado.",
            "success"
        );

        await loadReceivedOrders();

    } catch (error) {
        console.error(
            "Error actualizando pago:",
            error
        );

        showMessage(
            error.message
            || "No se pudo actualizar el pago.",
            "error"
        );
    }
}


async function loadReceivedOrders(silent = false) {
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

    if (!silent) {
        container.innerHTML = `
            <div class="orders-state-card orders-loading">
                Cargando tus ventas...
            </div>
        `;
    }

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

        try {
            const sellerPayments =
                await loadAllSellerPayments(currentToken);

            window.walzSellerPayments =
                sellerPayments;

            window.walzSellerPaymentsLoadError = "";

            rebuildSellerPaymentIndex(
                sellerPayments
            );

        } catch (paymentError) {
            if (
                paymentError.message
                === "SESSION_EXPIRED"
            ) {
                handleExpiredSession();
                return;
            }

            console.error(
                "Error cargando pagos del vendedor:",
                paymentError
            );

            window.walzSellerPayments = [];

            window.walzSellerPaymentsLoadError =
                paymentError.message
                || "No se pudieron cargar los pagos.";

            rebuildSellerPaymentIndex([]);
        }

        setSellerPendingOrderBadge(window.walzReceivedOrders.filter(order => String(order.status || "").toLowerCase() === "pending").length);
        applyReceivedOrdersFilters();

    } catch (error) {
        console.error("Error cargando pedidos recibidos:", error);
        container.innerHTML = `
            <div class="orders-state-card orders-error">
                <h3>No pudimos cargar tus ventas</h3>
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
                    : "Todavia no realizaste ventas"
                }</h3>
                <p>${hasReceivedOrders
                    ? "Proba otra palabra o selecciona otro estado."
                    : "Cuando alguien compre uno de tus productos, la venta aparecera aqui."
                }</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="sales-orders-list">
            ${orders.map(order => {
                const statusInfo = getOrderStatusInfo(order.status);
                const latestActivity = getOrderLatestActivity(order);
                const activityAt = latestActivity
                    ? formatWalzDate(latestActivity.toISOString())
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
                            <div><span>Ultimo movimiento</span><strong>${escapeHtml(activityAt)}</strong></div>
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

                        ${String(order.shipping_address || "").toLowerCase().includes("retiro en el local") ? renderOrderTimeline(order) : renderDeliveryPlan(order, false) + renderDeliveryResponsible(order)}

                        <h3 class="order-total">
                            Total de tus productos: ${Number(order.seller_total || 0).toFixed(2)}
                        </h3>

                        ${renderSellerPaymentBlock(order)}

                        ${renderSellerOrderActions(order)}
                    </article>
                `;
            }).join("")}
        </div>
    `;
}





// WALZ_DELIVERY_COORDINATION_V1
function formatDeliveryDateOnly(value) {
    const parts = String(value || "").split("-");
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : String(value || "No informada");
}

function renderBuyerDeliveryRequest(order) {
    if (!order?.delivery_buyer_requested_date) return "";
    return `<section class="buyer-request-card"><h4>Horario solicitado por el comprador</h4><div><span>Fecha</span><strong>${escapeHtml(formatDeliveryDateOnly(order.delivery_buyer_requested_date))}</strong></div><div><span>Franja</span><strong>${escapeHtml(order.delivery_buyer_requested_window || "No informada")}</strong></div></section>`;
}

async function decideBuyerDeliveryPlan(orderId, action) {
    const currentToken = localStorage.getItem("walz_token");
    if (!currentToken) return handleExpiredSession();
    try {
        const res = await fetch(`${API_URL}/orders/${orderId}/delivery-plan-decision`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentToken}` }, body: JSON.stringify({ action }) });
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) return handleExpiredSession();
        if (!res.ok) throw new Error(data.detail || "No se pudo responder la propuesta.");
        showMessage(action === "accept" ? "Horario de entrega aceptado." : "Se mantuvo tu horario solicitado.", "success");
        renderOrderDetail(data, Array.isArray(data.items) ? data.items : []);
    } catch (error) { showMessage(error.message, "error"); }
}

// WALZ_DELIVERY_PLAN_V1
function getDeliveryTransportLabel(value) {
    const labels = {
        moto: "Moto o mensajeria",
        correo: "Correo o paqueteria",
        propio: "Transporte propio de la tienda",
        otro: "Otro medio de transporte"
    };
    return labels[String(value || "")] || "No informado";
}

function renderDeliveryPlan(order, allowBuyerDecision = true) {
    if (!order?.delivery_estimated_date) return renderBuyerDeliveryRequest(order);
    const displayedDate = formatDeliveryDateOnly(order.delivery_estimated_date);
    const status = String(order.delivery_plan_status || "");
    const title = status === "seller_proposed" ? "Nueva propuesta del vendedor" : "Entrega coordinada";
    const buyerActions = allowBuyerDecision && status === "seller_proposed" ? `<div class="delivery-decision-actions"><button type="button" onclick="decideBuyerDeliveryPlan('${escapeJs(String(order.id))}', 'accept')">Aceptar horario</button><button type="button" class="secondary" onclick="decideBuyerDeliveryPlan('${escapeJs(String(order.id))}', 'keep_requested')">Mantener mi horario solicitado</button></div>` : "";
    return `<section class="delivery-plan-card"><h4>${title}</h4><div><span>Fecha estimada</span><strong>${escapeHtml(displayedDate)}</strong></div><div><span>Franja horaria</span><strong>${escapeHtml(order.delivery_time_window || "No informada")}</strong></div><div><span>Medio de envio</span><strong>${escapeHtml(getDeliveryTransportLabel(order.delivery_transport_type))}</strong></div>${buyerActions}</section>`;
}

function renderDeliveryPlanForm(order) {
    const orderId = escapeHtml(String(order.id || ""));
    const safeId = orderId.replace(/[^a-zA-Z0-9-]/g, "");
    const today = new Date();
    today.setDate(today.getDate() + 1);
    const minDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const initialDate = order.delivery_buyer_requested_date || order.delivery_estimated_date || "";
    const initialWindow = order.delivery_buyer_requested_window || order.delivery_time_window || "";
    return `<section class="delivery-plan-form">
        <h4>Coordinar envio</h4>
        ${renderBuyerDeliveryRequest(order)}
        <p>Confirma la preferencia o modifica la fecha y franja para proponer otra opcion. Tambien informa el medio de envio.</p>
        <div class="delivery-plan-fields">
            <label>Fecha estimada<input id="delivery-date-${safeId}" type="date" min="${minDate}" value="${escapeHtml(initialDate)}"></label>
            <label>Franja horaria<select id="delivery-window-${safeId}">
                <option value="">Seleccionar</option>
                <option value="08:00 a 12:00" ${initialWindow === "08:00 a 12:00" ? "selected" : ""}>08:00 a 12:00</option>
                <option value="12:00 a 16:00" ${initialWindow === "12:00 a 16:00" ? "selected" : ""}>12:00 a 16:00</option>
                <option value="16:00 a 20:00" ${initialWindow === "16:00 a 20:00" ? "selected" : ""}>16:00 a 20:00</option>
                <option value="Horario a coordinar" ${initialWindow === "Horario a coordinar" ? "selected" : ""}>Horario a coordinar</option>
            </select></label>
            <label>Medio de envio<select id="delivery-transport-${safeId}">
                <option value="">Seleccionar</option>
                <option value="moto">Moto o mensajeria</option>
                <option value="correo">Correo o paqueteria</option>
                <option value="propio">Transporte propio</option>
                <option value="otro">Otro medio</option>
            </select></label>
        </div>
        <button type="button" onclick="saveSellerDeliveryPlan('${escapeJs(String(order.id || ""))}')">Confirmar o proponer horario</button>
        <p id="delivery-plan-message-${safeId}" class="delivery-plan-inline-message" role="alert"></p>
    </section>`;
}

async function saveSellerDeliveryPlan(orderId) {
    // WALZ_DELIVERY_SAVE_FIX_V1
    const safeId = String(orderId).replace(/[^a-zA-Z0-9-]/g, "");
    const inlineMessage = document.getElementById(`delivery-plan-message-${safeId}`);
    if (inlineMessage) inlineMessage.textContent = "";
    const estimatedDate = document.getElementById(`delivery-date-${safeId}`)?.value || "";
    const timeWindow = document.getElementById(`delivery-window-${safeId}`)?.value || "";
    const transportType = document.getElementById(`delivery-transport-${safeId}`)?.value || "";
    if (!estimatedDate || !timeWindow || !transportType) {
        if (inlineMessage) inlineMessage.textContent = "Completa la fecha, la franja horaria y el medio de envio.";
        showMessage("Completa la fecha, la franja horaria y el medio de envio.", "error");
        return;
    }
    const currentToken = localStorage.getItem("walz_token");
    if (!currentToken) return handleExpiredSession();
    try {
        if (inlineMessage) inlineMessage.textContent = "Guardando programacion...";
        const res = await fetch(`${API_URL}/orders/seller/${orderId}/delivery-plan`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentToken}` },
            body: JSON.stringify({ transport_type: transportType, estimated_date: estimatedDate, time_window: timeWindow })
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) return handleExpiredSession();
        if (!res.ok) throw new Error(data.detail || "No se pudo guardar la programacion.");
        showMessage("Envio programado correctamente.", "success");
        await loadReceivedOrders();
    } catch (error) {
        const message = error.message || "No se pudo guardar la programacion.";
        if (inlineMessage) inlineMessage.textContent = message;
        showMessage(message, "error");
    }
}


// WALZ_DELIVERY_RESPONSIBLE_V1
function deliveryResponsibleIsComplete(order) {
    if (String(order?.delivery_transport_type) === "correo") return Boolean(order?.carrier_company && order?.delivery_tracking_code);
    return Boolean(order?.courier_name && order?.courier_phone && order?.courier_photo_url && order?.courier_vehicle);
}

function renderDeliveryResponsible(order) {
    if (!deliveryResponsibleIsComplete(order)) return "";
    if (String(order.delivery_transport_type) === "correo") {
        return `<section class="delivery-responsible-card"><h4>Responsable del envio</h4><div><span>Empresa</span><strong>${escapeHtml(order.carrier_company)}</strong></div><div><span>Codigo de seguimiento</span><strong>${escapeHtml(order.delivery_tracking_code)}</strong></div></section>`;
    }
    return `<section class="delivery-responsible-card"><img src="${escapeHtml(order.courier_photo_url)}" alt="Foto del responsable del envio"><div class="delivery-responsible-data"><h4>Responsable del envio</h4><strong>${escapeHtml(order.courier_name)}</strong><span>Telefono: ${escapeHtml(order.courier_phone)}</span><span>Vehiculo: ${escapeHtml(order.courier_vehicle)}</span></div></section>`;
}

function renderDeliveryResponsibleForm(order) {
    const safeId = String(order.id || "").replace(/[^a-zA-Z0-9-]/g, "");
    if (String(order.delivery_transport_type) === "correo") {
        return `<section class="delivery-responsible-form"><h4>Identificar correo o paqueteria</h4><div class="delivery-responsible-fields"><label>Empresa<input id="carrier-company-${safeId}" maxlength="120"></label><label>Codigo de seguimiento<input id="tracking-code-${safeId}" maxlength="120"></label></div><button type="button" onclick="saveDeliveryResponsible('${escapeJs(String(order.id))}')">Guardar responsable</button><p id="responsible-message-${safeId}" class="delivery-plan-inline-message"></p></section>`;
    }
    return `<section class="delivery-responsible-form"><h4>Identificar a quien realizara la entrega</h4><p>El comprador vera estos datos para reconocer a la persona.</p><div class="delivery-responsible-fields"><label>Nombre completo<input id="courier-name-${safeId}" maxlength="120"></label><label>Telefono<input id="courier-phone-${safeId}" maxlength="40"></label><label>Vehiculo y datos visibles<input id="courier-vehicle-${safeId}" maxlength="120" placeholder="Ej.: Moto roja, patente ABC123"></label><label>Foto del responsable<input id="courier-photo-${safeId}" type="file" accept="image/jpeg,image/png,image/webp"></label></div><button type="button" onclick="saveDeliveryResponsible('${escapeJs(String(order.id))}')">Guardar responsable</button><p id="responsible-message-${safeId}" class="delivery-plan-inline-message"></p></section>`;
}

async function uploadDeliveryPersonPhoto(orderId, file) {
    const blob = await optimizeProductImage(file);
    const form = new FormData(); form.append("image", blob, "responsable.webp");
    const res = await fetch(`${API_URL}/orders/seller/${orderId}/delivery-person-photo`, { method: "POST", headers: { Authorization: `Bearer ${localStorage.getItem("walz_token")}` }, body: form });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || "No se pudo subir la foto.");
    return data.photo_url;
}

async function saveDeliveryResponsible(orderId) {
    const safeId = String(orderId).replace(/[^a-zA-Z0-9-]/g, "");
    const order = (window.walzReceivedOrders || []).find(item => String(item.id) === String(orderId));
    const message = document.getElementById(`responsible-message-${safeId}`);
    if (!order) return;
    try {
        if (message) message.textContent = "Guardando responsable...";
        let payload;
        if (String(order.delivery_transport_type) === "correo") {
            payload = { carrier_company: document.getElementById(`carrier-company-${safeId}`)?.value.trim() || "", tracking_code: document.getElementById(`tracking-code-${safeId}`)?.value.trim() || "" };
        } else {
            const courierName = document.getElementById(`courier-name-${safeId}`)?.value.trim() || "";
            const courierPhone = document.getElementById(`courier-phone-${safeId}`)?.value.trim() || "";
            const courierVehicle = document.getElementById(`courier-vehicle-${safeId}`)?.value.trim() || "";
            const file = document.getElementById(`courier-photo-${safeId}`)?.files?.[0];
            if (!courierName || !courierPhone || !courierVehicle) throw new Error("Completa nombre, telefono y vehiculo.");
            if (!file) throw new Error("Selecciona una foto del responsable.");
            const photoUrl = await uploadDeliveryPersonPhoto(orderId, file);
            payload = { courier_name: courierName, courier_phone: courierPhone, courier_vehicle: courierVehicle, courier_photo_url: photoUrl };
        }
        const res = await fetch(`${API_URL}/orders/seller/${orderId}/delivery-responsible`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("walz_token")}` }, body: JSON.stringify(payload) });
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) return handleExpiredSession();
        if (!res.ok) throw new Error(data.detail || "No se pudo guardar el responsable.");
        showMessage("Responsable del envio guardado.", "success"); await loadReceivedOrders();
    } catch (error) { if (message) message.textContent = error.message; showMessage(error.message, "error"); }
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
                    onclick="updateSellerOrderStatus('${orderId}', 'confirmed', 'Confirmar pedido')"
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

    if (status === "confirmed") {
        if (!isPickup && !order.delivery_estimated_date) return `${renderDeliveryPlanForm(order)}<div class="seller-order-actions"><button type="button" class="seller-cancel-button" onclick="updateSellerOrderStatus('${orderId}', 'cancelled', 'Cancelar venta')">Cancelar venta</button></div>`;
        if (!isPickup && String(order.delivery_plan_status) === "seller_proposed") return `${renderDeliveryPlan(order, false)}<div class="delivery-waiting-card">Esperando la respuesta del comprador.</div>`;
        if (!isPickup && String(order.delivery_plan_status) === "coordinated" && !deliveryResponsibleIsComplete(order)) return `${renderDeliveryPlan(order, false)}${renderDeliveryResponsibleForm(order)}<div class="seller-order-actions"><button type="button" class="seller-cancel-button" onclick="updateSellerOrderStatus('${orderId}', 'cancelled', 'Cancelar venta')">Cancelar venta</button></div>`;

        const sellerPayment =
            window.walzSellerPaymentByOrderId?.[
                normalizeSellerPaymentOrderId(order?.id)
            ] || null;

        const paymentRequired =
            order?.payment_required === true;

        if (
            paymentRequired
            && !sellerPayment
        ) {
            const paymentMissingContext =
                !isPickup
                    ? renderDeliveryPlan(order, false)
                        + renderDeliveryResponsible(order)
                    : "";

            const paymentMissingMessage =
                isPickup
                    ? "El pago de este pedido no quedo registrado. No se puede marcar listo para retirar hasta regularizarlo."
                    : "El pago de este pedido no quedo registrado. No se puede despachar hasta regularizarlo.";

            return `${paymentMissingContext}<div class="delivery-waiting-card">${paymentMissingMessage}</div><div class="seller-order-actions"><button type="button" class="seller-cancel-button" onclick="updateSellerOrderStatus('${orderId}', 'cancelled', 'Cancelar venta')">Cancelar venta</button></div>`;
        }

        const sellerPaymentMethod = String(
            sellerPayment?.method || ""
        ).trim().toUpperCase();

        const sellerPaymentStatus = String(
            sellerPayment?.status || ""
        ).trim().toLowerCase();

        const requiresApprovedPayment =
            sellerPaymentMethod === "BANK_TRANSFER"
            || sellerPaymentMethod === "CUENTA_DNI";

        if (
            !isPickup
            && requiresApprovedPayment
            && sellerPaymentStatus !== "approved"
        ) {
            const paymentWaitingMessage =
                sellerPaymentStatus === "reported"
                    ? "El comprador informo el pago. Verificalo y aprobalo antes de despachar."
                    : "Esperando que el comprador informe el pago antes del despacho.";

            return `${renderDeliveryPlan(order, false)}${renderDeliveryResponsible(order)}<div class="delivery-waiting-card">${paymentWaitingMessage}</div><div class="seller-order-actions"><button type="button" class="seller-cancel-button" onclick="updateSellerOrderStatus('${orderId}', 'cancelled', 'Cancelar venta')">Cancelar venta</button></div>`;
        }

        const actionLabel = isPickup ? "Marcar listo para retirar" : "Marcar como enviado";
        return `${!isPickup ? renderDeliveryPlan(order, false) + renderDeliveryResponsible(order) : ""}<div class="seller-order-actions"><button type="button" onclick="updateSellerOrderStatus('${orderId}', 'shipped', '${actionLabel}')">${actionLabel}</button><button type="button" class="seller-cancel-button" onclick="updateSellerOrderStatus('${orderId}', 'cancelled', 'Cancelar venta')">Cancelar venta</button></div>`;
    }

    if (status === "shipped") {
        if (isPickup) {
            const pickupStatus = String(order.pickup_status || "ready");
            const labels = { ready: "Esperando al comprador", buyer_going: "El comprador va a retirar", buyer_arrived: "El comprador esta en el local", seller_handed: "Producto entregado; falta confirmacion del comprador", completed: "Retiro completado" };
            return `<div class="pickup-progress-card"><strong>${escapeHtml(labels[pickupStatus] || pickupStatus)}</strong>${pickupStatus === "buyer_arrived" ? `<div class="seller-order-actions"><button type="button" onclick="confirmSellerPickupHandover('${orderId}')">Entregado al comprador</button></div>` : ""}</div>`;
        }
        return `<div class="seller-order-actions"><button type="button" onclick="updateSellerOrderStatus('${orderId}', 'delivered', 'Marcar como entregado')">Marcar como entregado</button></div>`;
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
        `${actionLabel}: ¿confirmas esta acción?`
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

        if (!orderMatchesWorkStatus(order, selectedStatus)) {
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
        statusFilter.value = "active";
    }

    applyReceivedOrdersFilters();
}





// =====================================================
// ETAPA 4B - SUPERVISION CENTRAL DE PRODUCTOS
// SOLO LECTURA
// =====================================================

window.walzAdminProductsPage = 0;
window.walzAdminProductsPageSize = 10;
window.walzAdminProductsHasNext = false;
window.walzAdminProductsTotal = 0;
window.walzAdminProductsTotalPages = 1;


async function showAdminProducts() {
    if (currentUserRole !== "ADMIN") {
        showMessage("Se requiere una cuenta administradora.", "error");
        return;
    }

    hideAllWalzWorkSections();

    const section = document.getElementById("admin-products-section");

    if (!section) {
        console.error("No existe la seccion Productos Central.");
        return;
    }

    window.walzAdminProductsPage = 0;

    section.style.display = "block";
    scrollPageToTop();

    await loadAdminProducts();
}


async function loadAdminProducts() {
    const container = document.getElementById("admin-products-content");
    const counter = document.getElementById("admin-products-results-count");
    const pageLabel = document.getElementById("admin-products-page-label");
    const prevButton = document.getElementById("admin-products-prev");
    const nextButton = document.getElementById("admin-products-next");
    const lastButton = document.getElementById("admin-products-last");

    const currentToken = localStorage.getItem("walz_token");

    if (!container) return;

    if (!currentToken) {
        handleExpiredSession();
        return;
    }

    let page = Math.max(
        0,
        Number(window.walzAdminProductsPage || 0)
    );

    const pageSize = Number(
        window.walzAdminProductsPageSize || 10
    );

    container.innerHTML = `
        <div class="orders-state-card orders-loading">
            Cargando productos...
        </div>
    `;

    if (counter) counter.textContent = "";

    try {
        const headers = {
            Authorization: `Bearer ${currentToken}`
        };

        const countResponse = await fetch(
            `${API_URL}/products/admin/count`,
            { headers }
        );

        if (countResponse.status === 401) {
            handleExpiredSession();
            return;
        }

        const countData = await countResponse
            .json()
            .catch(() => ({}));

        if (!countResponse.ok) {
            throw new Error(
                countData.detail || `HTTP ${countResponse.status}`
            );
        }

        const total = Math.max(
            0,
            Number(countData.total || 0)
        );

        const totalPages = Math.max(
            1,
            Math.ceil(total / pageSize)
        );

        if (page >= totalPages) {
            page = totalPages - 1;
            window.walzAdminProductsPage = page;
        }

        const skip = page * pageSize;

        const response = await fetch(
            `${API_URL}/products/admin?skip=${skip}&limit=${pageSize}`,
            { headers }
        );

        if (response.status === 401) {
            handleExpiredSession();
            return;
        }

        const data = await response.json().catch(() => ([]));

        if (!response.ok) {
            throw new Error(data.detail || `HTTP ${response.status}`);
        }

        const entries = Array.isArray(data) ? data : [];

        window.walzAdminProducts = entries;
        window.walzAdminProductsTotal = total;
        window.walzAdminProductsTotalPages = totalPages;
        window.walzAdminProductsHasNext =
            page < totalPages - 1;

        if (counter) {
            if (total === 0) {
                counter.textContent = "No hay productos registrados";
            } else {
                const firstNumber = skip + 1;
                const lastNumber = Math.min(
                    skip + entries.length,
                    total
                );

                counter.textContent =
                    `Productos ${firstNumber} a ${lastNumber} de ${total}`;
            }
        }

        if (pageLabel) {
            pageLabel.textContent =
                `Pagina ${page + 1} de ${totalPages}`;
        }

        if (prevButton) {
            prevButton.disabled = page <= 0;
        }

        if (nextButton) {
            nextButton.disabled = page >= totalPages - 1;
        }

        if (lastButton) {
            lastButton.disabled = page >= totalPages - 1;
        }

        renderAdminProductPageNumbers(
            page,
            totalPages
        );

        renderAdminProducts(entries);

    } catch (error) {
        console.error(
            "Error cargando Productos Central:",
            error
        );

        container.innerHTML = `
            <div class="orders-state-card orders-error">
                ${escapeHtml(
                    error.message ||
                    "No se pudieron cargar los productos."
                )}
            </div>
        `;

        if (prevButton) prevButton.disabled = page <= 0;
        if (nextButton) nextButton.disabled = true;
        if (lastButton) lastButton.disabled = true;
    }
}

function renderAdminProductPageNumbers(
    currentPage,
    totalPages
) {
    const container = document.getElementById(
        "admin-products-page-numbers"
    );

    if (!container) return;

    if (totalPages <= 1) {
        container.innerHTML = `
            <button
                type="button"
                class="admin-products-page-button is-current"
                disabled
            >1</button>
        `;
        return;
    }

    let startPage = Math.max(
        0,
        currentPage - 1
    );

    let endPage = Math.min(
        totalPages - 1,
        startPage + 2
    );

    startPage = Math.max(
        0,
        endPage - 2
    );

    const buttons = [];

    for (
        let pageIndex = startPage;
        pageIndex <= endPage;
        pageIndex += 1
    ) {
        const isCurrent = pageIndex === currentPage;

        buttons.push(`
            <button
                type="button"
                class="admin-products-page-button ${
                    isCurrent ? "is-current" : ""
                }"
                onclick="goToAdminProductsPage(${pageIndex})"
                ${isCurrent ? "disabled" : ""}
            >
                ${pageIndex + 1}
            </button>
        `);
    }

    container.innerHTML = buttons.join("");
}


async function goToAdminProductsPage(pageIndex) {
    const totalPages = Math.max(
        1,
        Number(window.walzAdminProductsTotalPages || 1)
    );

    const targetPage = Math.min(
        totalPages - 1,
        Math.max(0, Number(pageIndex || 0))
    );

    if (
        targetPage ===
        Number(window.walzAdminProductsPage || 0)
    ) {
        return;
    }

    window.walzAdminProductsPage = targetPage;

    await loadAdminProducts();
    scrollPageToTop();
}


async function goToLastAdminProductsPage() {
    const totalPages = Math.max(
        1,
        Number(window.walzAdminProductsTotalPages || 1)
    );

    await goToAdminProductsPage(
        totalPages - 1
    );
}


async function changeAdminProductsPage(direction) {
    const currentPage = Math.max(
        0,
        Number(window.walzAdminProductsPage || 0)
    );

    const delta = Number(direction || 0);

    if (delta > 0 && !window.walzAdminProductsHasNext) {
        return;
    }

    const nextPage = Math.max(0, currentPage + delta);

    if (nextPage === currentPage) return;

    window.walzAdminProductsPage = nextPage;

    await loadAdminProducts();
    scrollPageToTop();
}


function formatAdminProductMoney(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return "-";
    }

    return number.toLocaleString("es-AR", {
        style: "currency",
        currency: "ARS",
        maximumFractionDigits: 2
    });
}


function formatAdminProductDate(value) {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "-";
    }

    return date.toLocaleString("es-AR");
}


function renderAdminProducts(entries) {
    const container =
        document.getElementById("admin-products-content");

    if (!container) return;

    if (!Array.isArray(entries) || entries.length === 0) {
        container.innerHTML = `
            <div class="orders-state-card orders-empty">
                <h3>No hay productos para mostrar</h3>
                <p>Los productos registrados apareceran aqui.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="admin-products-list">
            ${entries.map(entry => {
                const product = entry?.product || {};
                const seller = entry?.seller || {};
                const store = entry?.store || null;

                const sellerName = [
                    seller.first_name,
                    seller.last_name
                ]
                    .filter(Boolean)
                    .join(" ")
                    .trim();

                const storeName =
                    store?.name || "Sin tienda asociada";

                const categoryParts = [
                    product.category,
                    product.subcategory
                ].filter(Boolean);

                const categoryLabel =
                    categoryParts.length
                        ? categoryParts.join(" / ")
                        : "Sin categoria";

                const brandLabel =
                    product.brand || "Sin marca";

                const activeLabel =
                    product.is_active
                        ? "Activo"
                        : "Pausado";

                const activeClass =
                    product.is_active
                        ? "active"
                        : "paused";

                const offerLabel =
                    product.offer_active &&
                    product.offer_price != null
                        ? formatAdminProductMoney(
                            product.offer_price
                        )
                        : "Sin oferta activa";

                let commercialLabel =
                    "Sin propuesta comercial activa";

                if (
                    product.commercial_active &&
                    product.commercial_type
                ) {
                    commercialLabel =
                        product.commercial_type;

                    if (product.commercial_text) {
                        commercialLabel +=
                            ` - ${product.commercial_text}`;
                    }
                }

                return `
                    <article class="admin-product-card">

                        <div class="admin-product-media">
                            ${renderProductImage(
                                product.image_url,
                                product.name || "Producto",
                                "admin-product-image"
                            )}
                        </div>

                        <div class="admin-product-body">

                            <div class="admin-product-heading">
                                <div>
                                    <span class="admin-product-store">
                                        ${escapeHtml(storeName)}
                                    </span>

                                    <h3>
                                        ${escapeHtml(
                                            product.name ||
                                            "Producto sin nombre"
                                        )}
                                    </h3>
                                </div>

                                <span class="my-product-state ${activeClass}">
                                    ${activeLabel}
                                </span>
                            </div>

                            <div class="admin-product-seller">
                                <strong>Vendedor:</strong>
                                ${escapeHtml(
                                    sellerName ||
                                    "Vendedor sin nombre"
                                )}

                                ${
                                    seller.email
                                        ? `<span>${escapeHtml(
                                            seller.email
                                        )}</span>`
                                        : ""
                                }
                            </div>

                            <div class="admin-product-data-grid">

                                <div>
                                    <span>Precio</span>
                                    <strong>
                                        ${formatAdminProductMoney(
                                            product.price
                                        )}
                                    </strong>
                                </div>

                                <div>
                                    <span>Stock</span>
                                    <strong>
                                        ${escapeHtml(
                                            String(
                                                product.stock ?? 0
                                            )
                                        )}
                                    </strong>
                                </div>

                                <div>
                                    <span>Categoria</span>
                                    <strong>
                                        ${escapeHtml(categoryLabel)}
                                    </strong>
                                </div>

                                <div>
                                    <span>Marca</span>
                                    <strong>
                                        ${escapeHtml(brandLabel)}
                                    </strong>
                                </div>

                                <div>
                                    <span>Oferta</span>
                                    <strong>
                                        ${escapeHtml(offerLabel)}
                                    </strong>
                                </div>

                                <div>
                                    <span>Propuesta comercial</span>
                                    <strong>
                                        ${escapeHtml(commercialLabel)}
                                    </strong>
                                </div>

                                <div>
                                    <span>Avanter</span>
                                    <strong>
                                        ${
                                            product.avanter_enabled
                                                ? "Habilitado"
                                                : "No habilitado"
                                        }
                                    </strong>
                                </div>

                                <div>
                                    <span>Creado</span>
                                    <strong>
                                        ${escapeHtml(
                                            formatAdminProductDate(
                                                product.created_at
                                            )
                                        )}
                                    </strong>
                                </div>

                            </div>

                            ${
                                product.description
                                    ? `
                                        <p class="admin-product-description">
                                            ${escapeHtml(
                                                product.description
                                            )}
                                        </p>
                                    `
                                    : ""
                            }

                        </div>
                    </article>
                `;
            }).join("")}
        </div>
    `;
}


// =====================================================
// ETAPA 4A - SUPERVISION CENTRAL DE PEDIDOS
// =====================================================

async function showAdminOrders() {
    if (currentUserRole !== "ADMIN") {
        showMessage("Se requiere una cuenta administradora.", "error");
        return;
    }

    hideAllWalzWorkSections();

    const section = document.getElementById("admin-orders-section");
    if (!section) {
        console.error("No existe la seccion Pedidos Central.");
        return;
    }

    section.style.display = "block";
    scrollPageToTop();
    await loadAdminOrders();
}


async function loadAdminOrders() {
    const container = document.getElementById("admin-orders-content");
    const counter = document.getElementById("admin-orders-results-count");
    const currentToken = localStorage.getItem("walz_token");

    if (!container) return;

    if (!currentToken) {
        handleExpiredSession();
        return;
    }

    container.innerHTML = `
        <div class="orders-state-card orders-loading">
            Cargando pedidos...
        </div>
    `;

    if (counter) counter.textContent = "";

    try {
        const response = await fetch(`${API_URL}/orders/admin`, {
            headers: {
                Authorization: `Bearer ${currentToken}`
            }
        });

        if (response.status === 401) {
            handleExpiredSession();
            return;
        }

        const data = await response.json().catch(() => ([]));

        if (!response.ok) {
            throw new Error(data.detail || `HTTP ${response.status}`);
        }

        window.walzAdminOrders = Array.isArray(data) ? data : [];

        populateAdminOrdersStoreFilter();
        applyAdminOrdersFilters();

    } catch (error) {
        console.error("Error cargando pedidos para administracion:", error);

        container.innerHTML = `
            <div class="orders-state-card orders-error">
                <h3>No pudimos cargar los pedidos</h3>
                <p>${escapeHtml(error.message || "Error desconocido")}</p>
            </div>
        `;
    }
}


function populateAdminOrdersStoreFilter() {
    const select = document.getElementById("admin-orders-store-filter");
    if (!select) return;

    const previousValue = String(select.value || "");
    const entries = Array.isArray(window.walzAdminOrders)
        ? window.walzAdminOrders
        : [];

    const stores = new Map();

    entries.forEach(entry => {
        const order = entry?.order || {};
        const sellerId = String(
            entry?.store?.seller_id ||
            order.seller_id ||
            ""
        );

        if (!sellerId) return;

        const storeName =
            entry?.store?.name ||
            order.seller_display_name ||
            order.seller_account_email ||
            "Tienda sin nombre";

        if (!stores.has(sellerId)) {
            stores.set(sellerId, storeName);
        }
    });

    const options = [...stores.entries()]
        .sort((first, second) =>
            String(first[1]).localeCompare(String(second[1]), "es")
        )
        .map(([sellerId, storeName]) => `
            <option value="${escapeHtml(sellerId)}">
                ${escapeHtml(storeName)}
            </option>
        `)
        .join("");

    select.innerHTML = `
        <option value="">Todas las tiendas</option>
        ${options}
    `;

    if (previousValue && stores.has(previousValue)) {
        select.value = previousValue;
    }
}


function applyAdminOrdersFilters() {
    const allEntries = Array.isArray(window.walzAdminOrders)
        ? window.walzAdminOrders
        : [];

    const search = normalizeSalesSearchText(
        document.getElementById("admin-orders-search")?.value
    );

    const selectedStatus = String(
        document.getElementById("admin-orders-status-filter")?.value || ""
    ).toLowerCase();

    const selectedStore = String(
        document.getElementById("admin-orders-store-filter")?.value || ""
    );

    const filteredEntries = allEntries.filter(entry => {
        const order = entry?.order || {};
        const store = entry?.store || {};
        const buyer = entry?.buyer || {};

        if (!orderMatchesWorkStatus(order, selectedStatus)) {
            return false;
        }

        const sellerId = String(
            store.seller_id ||
            order.seller_id ||
            ""
        );

        if (selectedStore && sellerId !== selectedStore) {
            return false;
        }

        if (!search) {
            return true;
        }

        const itemNames = (Array.isArray(order.items) ? order.items : [])
            .map(item => item?.product?.name || "")
            .join(" ");

        const status = String(order.status || "").toLowerCase();

        const searchableText = normalizeSalesSearchText([
            order.id,
            status,
            getOrderStatusInfo(status).label,
            store.name,
            store.slug,
            order.seller_display_name,
            order.seller_account_email,
            buyer.name,
            buyer.email,
            order.shipping_address,
            itemNames
        ].join(" "));

        return searchableText.includes(search);
    });

    const counter = document.getElementById("admin-orders-results-count");

    if (counter) {
        counter.textContent =
            allEntries.length === filteredEntries.length
                ? `${allEntries.length} pedido${allEntries.length === 1 ? "" : "s"}`
                : `${filteredEntries.length} de ${allEntries.length} pedidos`;
    }

    renderAdminOrders(filteredEntries);
}


function clearAdminOrdersFilters() {
    const search = document.getElementById("admin-orders-search");
    const status = document.getElementById("admin-orders-status-filter");
    const store = document.getElementById("admin-orders-store-filter");

    if (search) search.value = "";
    if (status) status.value = "active";
    if (store) store.value = "";

    applyAdminOrdersFilters();
}


function renderAdminOrders(entries) {
    const container = document.getElementById("admin-orders-content");
    if (!container) return;

    if (!Array.isArray(entries) || entries.length === 0) {
        const hasOrders =
            Array.isArray(window.walzAdminOrders) &&
            window.walzAdminOrders.length > 0;

        container.innerHTML = `
            <div class="orders-state-card orders-empty">
                <h3>${hasOrders
                    ? "No encontramos pedidos con esos filtros"
                    : "Todavia no hay pedidos registrados"
                }</h3>
                <p>${hasOrders
                    ? "Proba otra busqueda, estado o tienda."
                    : "Cuando se registren compras apareceran aqui."
                }</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="sales-orders-list">
            ${entries.map(entry => {
                const order = entry?.order || {};
                const buyer = entry?.buyer || {};
                const store = entry?.store || {};

                const statusInfo = getOrderStatusInfo(order.status);

                const latestActivity = getOrderLatestActivity(order);
                const activityAt = latestActivity
                    ? formatWalzDate(latestActivity.toISOString())
                    : "Fecha no disponible";

                const createdAt = order.created_at
                    ? formatWalzDate(order.created_at)
                    : "Fecha no disponible";

                const storeName =
                    store.name ||
                    order.seller_display_name ||
                    "Tienda no disponible";

                const sellerContact =
                    order.seller_account_email ||
                    "No disponible";

                const items = Array.isArray(order.items)
                    ? order.items
                    : [];

                const isPickup = String(order.shipping_address || "")
                    .toLowerCase()
                    .includes("retiro en el local");

                const coordination = isPickup
                    ? renderOrderTimeline(order)
                    : renderDeliveryPlan(order, false) +
                      renderDeliveryResponsible(order);

                return `
                    <article class="order-card sales-order-card admin-order-card">
                        <div class="order-card-header">
                            <div>
                                <span class="order-card-label">Pedido</span>
                                <h3>#${escapeHtml(String(order.id || ""))}</h3>
                            </div>

                            <span class="order-status ${statusInfo.className}">
                                ${escapeHtml(statusInfo.label)}
                            </span>
                        </div>

                        <div class="sales-buyer-data">
                            <div>
                                <span>Tienda</span>
                                <strong>${escapeHtml(storeName)}</strong>
                            </div>

                            <div>
                                <span>Cuenta vendedora</span>
                                <strong>${escapeHtml(sellerContact)}</strong>
                            </div>

                            <div>
                                <span>Comprador</span>
                                <strong>${escapeHtml(buyer.name || "Sin nombre")}</strong>
                            </div>

                            <div>
                                <span>Email comprador</span>
                                <strong>${escapeHtml(buyer.email || "No disponible")}</strong>
                            </div>

                            <div>
                                <span>Fecha del pedido</span>
                                <strong>${escapeHtml(createdAt)}</strong>
                            </div>

                            <div>
                                <span>Ultimo movimiento</span>
                                <strong>${escapeHtml(activityAt)}</strong>
                            </div>
                        </div>

                        <div class="sales-order-items">
                            ${items.map(item => {
                                const quantity = Number(item.quantity || 0);
                                const price = Number(item.price_at_purchase || 0);
                                const subtotal = quantity * price;

                                return `
                                    <div class="sales-order-item">
                                        <strong>${escapeHtml(item?.product?.name || "Producto")}</strong>
                                        <span>Cantidad: ${quantity}</span>
                                        <span>Precio: $${price.toFixed(2)}</span>
                                        <strong>Subtotal: $${subtotal.toFixed(2)}</strong>
                                    </div>
                                `;
                            }).join("")}
                        </div>

                        <div class="sales-delivery-data">
                            <span>Datos de entrega</span>
                            <p>${escapeHtml(order.shipping_address || "No disponibles")}</p>
                        </div>

                        ${coordination}

                        <h3 class="order-total">
                            Total del pedido: $${Number(order.total_amount || 0).toFixed(2)}
                        </h3>
                    </article>
                `;
            }).join("")}
        </div>
    `;
}


// =====================================================
// FASE 5P - CARGA MASIVA DE PRODUCTOS (VISTA PREVIA)
// =====================================================

function downloadBulkProductsTemplate() {
    const separator = ";";
    const rows = [
        ["nombre", "precio", "stock", "categoria", "descripcion", "enlace_imagen"],
        ["Producto de ejemplo", "1500", "10", "Cuidado personal", "Descripcion opcional", "https://ejemplo.com/imagen.webp"]
    ];
    const csv = "\uFEFF" + rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(separator)).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "plantilla-productos-walz.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showMessage("Plantilla descargada. Abrila con Excel.", "success");
}

function parseBulkCsvLine(line, separator) {
    const values = [];
    let value = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
        const character = line[index];
        if (character === '"') {
            if (quoted && line[index + 1] === '"') {
                value += '"';
                index += 1;
            } else {
                quoted = !quoted;
            }
        } else if (character === separator && !quoted) {
            values.push(value.trim());
            value = "";
        } else {
            value += character;
        }
    }
    values.push(value.trim());
    return values;
}

function normalizeBulkHeader(value) {
    return String(value || "")
        .replace(/^\uFEFF/, "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "_");
}

function renderBulkProductsPreview(validRows, errors) {
    const container = document.getElementById("bulk-products-preview");
    if (!container) return;

    const summaryClass = errors.length ? "bulk-preview-warning" : "bulk-preview-success";
    const table = validRows.length ? `
        <div class="bulk-preview-table-wrap">
            <table class="bulk-preview-table">
                <thead><tr><th>Fila</th><th>Producto</th><th>Precio</th><th>Stock</th><th>Categoria</th><th>Imagen</th></tr></thead>
                <tbody>${validRows.slice(0, 50).map(item => `
                    <tr>
                        <td>${item.rowNumber}</td>
                        <td>${escapeHtml(item.name)}</td>
                        <td>$${Number(item.price).toFixed(2)}</td>
                        <td>${item.stock}</td>
                        <td>${escapeHtml(item.category || "-")}</td>
                        <td>${item.image_url ? "Si" : "No"}</td>
                    </tr>`).join("")}
                </tbody>
            </table>
        </div>` : "";

    const errorList = errors.length ? `
        <div class="bulk-preview-errors">
            <strong>Corregir antes de publicar:</strong>
            <ul>${errors.slice(0, 20).map(error => `<li>${escapeHtml(error)}</li>`).join("")}</ul>
        </div>` : "";

    container.innerHTML = `
        <div class="bulk-preview-summary ${summaryClass}">
            <strong>${validRows.length} producto${validRows.length === 1 ? "" : "s"} listo${validRows.length === 1 ? "" : "s"} para importar</strong>
            <span>${errors.length} fila${errors.length === 1 ? "" : "s"} con errores</span>
        </div>
        ${table}
        ${validRows.length > 50 ? `<p>Se muestran las primeras 50 filas de ${validRows.length}.</p>` : ""}
        ${errorList}
        <p class="bulk-preview-notice">Vista previa solamente: ningun producto fue publicado.</p>
        ${validRows.length && !errors.length ? `
            <button type="button" id="bulk-products-publish-button" class="bulk-products-publish-button" onclick="publishBulkProducts()">
                Publicar ${validRows.length} productos
            </button>` : ""}`;
}

async function publishBulkProducts() {
    const products = Array.isArray(window.walzBulkProductsPreview) ? window.walzBulkProductsPreview : [];
    const errors = Array.isArray(window.walzBulkProductsErrors) ? window.walzBulkProductsErrors : [];
    const currentToken = localStorage.getItem("walz_token");
    const button = document.getElementById("bulk-products-publish-button");

    if (!currentToken) {
        showMessage("Tu sesion vencio. Inicia sesion nuevamente.", "error");
        return;
    }
    if (!products.length || errors.length) {
        showMessage("Revisa la planilla antes de publicarla.", "error");
        return;
    }
    if (!confirm(`Confirmas la publicacion de ${products.length} productos?`)) return;

    if (button) {
        button.disabled = true;
        button.textContent = "Publicando productos...";
    }

    try {
        const response = await fetch(`${API_URL}/products/bulk`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${currentToken}`
            },
            body: JSON.stringify(products.map(product => ({
                name: product.name,
                price: product.price,
                stock: product.stock,
                category: product.category || null,
                description: product.description || null,
                image_url: product.image_url || null
            })))
        });
        const data = await response.json().catch(() => ({}));

        if (response.status === 401) {
            showMessage("Tu sesion vencio. Inicia sesion nuevamente.", "error");
            handleLogout();
            return;
        }
        if (!response.ok) throw new Error(data.detail || `HTTP ${response.status}`);

        const createdCount = Array.isArray(data) ? data.length : products.length;
        window.walzBulkProductsPreview = [];
        window.walzBulkProductsErrors = [];
        const fileInput = document.getElementById("bulk-products-file");
        const preview = document.getElementById("bulk-products-preview");
        if (fileInput) fileInput.value = "";
        if (preview) preview.innerHTML = `
            <div class="bulk-import-complete">
                <strong>${createdCount} productos publicados correctamente.</strong>
                <span>Ya aparecen en tu catalogo y en WalZ.</span>
            </div>`;
        showMessage(`${createdCount} productos publicados correctamente.`, "success");
        await Promise.all([loadMyProducts(), loadProducts()]);
    } catch (error) {
        console.error("Error en carga masiva:", error);
        showMessage(error.message || "No se pudo completar la carga masiva.", "error");
        if (button) {
            button.disabled = false;
            button.textContent = `Publicar ${products.length} productos`;
        }
    }
}

async function previewBulkProductsFile(event) {
    const file = event?.target?.files?.[0];
    const container = document.getElementById("bulk-products-preview");
    window.walzBulkProductsPreview = [];
    window.walzBulkProductsErrors = [];
    if (!file || !container) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
        container.innerHTML = '<div class="bulk-preview-errors">El archivo debe estar guardado como CSV UTF-8.</div>';
        return;
    }

    try {
        const text = await file.text();
        const lines = text.split(/\r?\n/).filter(line => line.trim());
        if (lines.length < 2) throw new Error("La planilla no contiene productos.");

        const separator = (lines[0].match(/;/g) || []).length >= (lines[0].match(/,/g) || []).length ? ";" : ",";
        const headers = parseBulkCsvLine(lines[0], separator).map(normalizeBulkHeader);
        const required = ["nombre", "precio", "stock"];
        const missing = required.filter(header => !headers.includes(header));
        if (missing.length) throw new Error(`Faltan columnas obligatorias: ${missing.join(", ")}.`);

        const column = name => headers.indexOf(name);
        const validRows = [];
        const errors = [];

        lines.slice(1).forEach((line, index) => {
            const rowNumber = index + 2;
            const values = parseBulkCsvLine(line, separator);
            const name = values[column("nombre")]?.trim() || "";
            const rawPrice = values[column("precio")]?.trim().replace(/\s/g, "").replace(",", ".") || "";
            const rawStock = values[column("stock")]?.trim() || "";
            const price = Number(rawPrice);
            const stock = Number(rawStock);
            const rowErrors = [];

            if (!name) rowErrors.push("falta el nombre");
            if (!Number.isFinite(price) || price <= 0) rowErrors.push("el precio debe ser mayor que 0");
            if (!Number.isInteger(stock) || stock < 0) rowErrors.push("el stock debe ser un numero entero igual o mayor que 0");
            if (name.length > 200) rowErrors.push("el nombre supera los 200 caracteres");

            if (rowErrors.length) {
                errors.push(`Fila ${rowNumber}: ${rowErrors.join("; ")}.`);
                return;
            }

            validRows.push({
                rowNumber,
                name,
                price,
                stock,
                category: column("categoria") >= 0 ? values[column("categoria")]?.trim() || "" : "",
                description: column("descripcion") >= 0 ? values[column("descripcion")]?.trim() || "" : "",
                image_url: column("enlace_imagen") >= 0 ? values[column("enlace_imagen")]?.trim() || "" : ""
            });
        });

        window.walzBulkProductsPreview = validRows;
        window.walzBulkProductsErrors = errors;
        renderBulkProductsPreview(validRows, errors);
    } catch (error) {
        console.error("Error leyendo la planilla:", error);
        container.innerHTML = `<div class="bulk-preview-errors">${escapeHtml(error.message || "No pudimos leer el archivo.")}</div>`;
    }
}


// =====================================================
// FASE 5K - MIS PRODUCTOS
// =====================================================


async function loadMyStoreCapabilities() {
    const currentToken = localStorage.getItem("walz_token");

    let store = null;

    try {
        const response = await fetch(`${API_URL}/stores/mine`, {
            headers: {
                Authorization: `Bearer ${currentToken}`
            }
        });

        if (response.ok) {
            store = await response.json().catch(() => null);
        }
    } catch (error) {
        console.warn(
            "No se pudieron cargar capacidades de la tienda:",
            error
        );
    }

    window.walzMyStore = store || null;

    const avanterEnabled =
        store?.avanter_enabled === true;

    const avanterInput =
        document.getElementById("prod-avanter-enabled");

    const avanterLabel =
        avanterInput?.closest("label");

    if (avanterLabel) {
        avanterLabel.style.display =
            avanterEnabled ? "" : "none";
    }

    if (avanterInput && !avanterEnabled) {
        avanterInput.checked = false;
    }

    return avanterEnabled;
}

function showMyProducts() {
    enterSellerPrivateContext();
    hideAllWalzWorkSections();
    hideSellerApplicationSections();
    hidePublicStoreSection();
    hideStoreProfileSection();
    hideBannerAdminSection();
    hideBannerProposalSection();
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

    loadMyStoreCapabilities()
        .finally(() => loadMyProducts());
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

    // restoreMyProductDraftAfterRender
    if (window.walzEditingProductId) {
        restoreMyProductDraft(
            window.walzEditingProductId
        );
    }
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



// =====================================================
// COMPARTIR PRODUCTOS - WHATSAPP / COPIAR PUBLICACION
// =====================================================

function getSellerPublicStoreUrl() {
    const store = window.walzMyStore || {};

    const slug = String(store.slug || "")
        .trim()
        .replace(/^\/+|\/+$/g, "");

    const isLocal =
        window.location.hostname === "127.0.0.1" ||
        window.location.hostname === "localhost";

    const baseUrl = isLocal
        ? "https://walzone.com.ar"
        : window.location.origin;

    if (slug) {
        return `${baseUrl}/${slug}`;
    }

    return baseUrl;
}


function formatSellerSharePrice(product) {
    const normalPrice = Number(product?.price || 0);
    const offerPrice = Number(product?.offer_price || 0);

    const useOffer =
        product?.offer_active === true &&
        Number.isFinite(offerPrice) &&
        offerPrice > 0 &&
        offerPrice < normalPrice;

    const finalPrice = useOffer
        ? offerPrice
        : normalPrice;

    if (!Number.isFinite(finalPrice) || finalPrice <= 0) {
        return "";
    }

    return new Intl.NumberFormat(
        "es-AR",
        {
            style: "currency",
            currency: "ARS",
            maximumFractionDigits: 2
        }
    ).format(finalPrice);
}


function buildSellerProductShareText(product) {
    const store = window.walzMyStore || {};

    const storeName =
        String(store.name || "WalZ One").trim();

    const productName =
        String(product?.name || "Producto").trim();

    const rawDescription =
        String(product?.description || "")
            .trim()
            .slice(0, 500);

    const normalizedProductName =
        productName
            .toLocaleLowerCase("es-AR")
            .replace(/\s+/g, " ")
            .trim();

    const normalizedDescription =
        rawDescription
            .toLocaleLowerCase("es-AR")
            .replace(/\s+/g, " ")
            .trim();

    const description =
        normalizedDescription === normalizedProductName
            ? ""
            : rawDescription;

    const price =
        formatSellerSharePrice(product);

    const commercialText =
        product?.commercial_active
            ? String(product?.commercial_text || "").trim()
            : "";

    const storeUrl =
        getSellerPublicStoreUrl();

    return [
        productName,
        price,
        commercialText,
        description,
        `Disponible en ${storeName}`,
        storeUrl
    ]
        .filter(Boolean)
        .join("\n");
}



async function copySellerProductImage(productId) {
    const products =
        Array.isArray(window.walzMyProducts)
            ? window.walzMyProducts
            : [];

    const product =
        products.find(
            item => String(item.id) === String(productId)
        );

    if (!product) {
        showMessage(
            "No pudimos encontrar el producto.",
            "error"
        );
        return;
    }

    const imageUrl =
        String(product.image_url || "").trim();

    if (!imageUrl) {
        showMessage(
            "Este producto no tiene una imagen cargada.",
            "error"
        );
        return;
    }

    try {
        if (
            !navigator.clipboard ||
            typeof navigator.clipboard.write !== "function" ||
            typeof ClipboardItem === "undefined"
        ) {
            throw new Error(
                "El navegador no permite copiar imagenes."
            );
        }

        const response =
            await fetch(imageUrl);

        if (!response.ok) {
            throw new Error(
                "No se pudo descargar la imagen."
            );
        }

        const sourceBlob =
            await response.blob();

        const bitmap =
            await createImageBitmap(sourceBlob);

        const canvas =
            document.createElement("canvas");

        canvas.width = bitmap.width;
        canvas.height = bitmap.height;

        const context =
            canvas.getContext("2d");

        context.drawImage(bitmap, 0, 0);

        const pngBlob =
            await new Promise((resolve, reject) => {
                canvas.toBlob(
                    blob => {
                        if (blob) {
                            resolve(blob);
                        } else {
                            reject(
                                new Error(
                                    "No se pudo preparar la imagen."
                                )
                            );
                        }
                    },
                    "image/png"
                );
            });

        await navigator.clipboard.write([
            new ClipboardItem({
                "image/png": pngBlob
            })
        ]);

        if (typeof bitmap.close === "function") {
            bitmap.close();
        }

        showMessage(
            "Imagen copiada. Podes pegarla en WhatsApp con Ctrl + V.",
            "success"
        );

    } catch (error) {
        console.error(
            "Error copiando imagen del producto:",
            error
        );

        showMessage(
            "No se pudo copiar automaticamente. Abrimos la imagen para que puedas usarla.",
            "error"
        );

        window.open(
            imageUrl,
            "_blank",
            "noopener,noreferrer"
        );
    }
}

async function copySellerProductPublication(productId) {
    const products =
        Array.isArray(window.walzMyProducts)
            ? window.walzMyProducts
            : [];

    const product =
        products.find(
            item =>
                String(item.id) === String(productId)
        );

    if (!product) {
        showMessage(
            "No pudimos encontrar el producto.",
            "error"
        );
        return;
    }

    const text =
        buildSellerProductShareText(product);

    try {
        await navigator.clipboard.writeText(text);

        showMessage(
            "Publicacion copiada. Ya podes pegarla donde quieras.",
            "success"
        );
    } catch (error) {
        console.error(
            "No se pudo copiar la publicacion:",
            error
        );

        window.prompt(
            "Copia esta publicacion:",
            text
        );
    }
}


function shareSellerProductWhatsApp(productId) {
    const products =
        Array.isArray(window.walzMyProducts)
            ? window.walzMyProducts
            : [];

    const product =
        products.find(
            item =>
                String(item.id) === String(productId)
        );

    if (!product) {
        showMessage(
            "No pudimos encontrar el producto.",
            "error"
        );
        return;
    }

    const text =
        buildSellerProductShareText(product);

    const url =
        `https://wa.me/?text=${encodeURIComponent(text)}`;

    window.open(
        url,
        "_blank",
        "noopener,noreferrer"
    );
}


function shareSellerProductFacebook(productId) {
    const products =
        Array.isArray(window.walzMyProducts)
            ? window.walzMyProducts
            : [];

    const product =
        products.find(
            item => String(item.id) === String(productId)
        );

    if (!product) {
        showMessage(
            "No pudimos encontrar el producto.",
            "error"
        );
        return;
    }

    const storeUrl =
        getSellerPublicStoreUrl();

    const facebookUrl =
        `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(storeUrl)}`;

    window.open(
        facebookUrl,
        "_blank",
        "noopener,noreferrer,width=760,height=650"
    );
}


function shareSellerProductInstagram(productId) {
    const products =
        Array.isArray(window.walzMyProducts)
            ? window.walzMyProducts
            : [];

    const product =
        products.find(
            item => String(item.id) === String(productId)
        );

    if (!product) {
        showMessage(
            "No pudimos encontrar el producto.",
            "error"
        );
        return;
    }

    showMessage(
        "Instagram abierto. Usa Copiar imagen y Copiar publicacion para preparar el post.",
        "success"
    );

    window.open(
        "https://www.instagram.com/",
        "_blank",
        "noopener,noreferrer"
    );
}

function renderMyProducts(products) {
    const container = document.getElementById("my-products-content");
    if (!container) return;

    if (!Array.isArray(products) || products.length === 0) {
        const hasProducts = Array.isArray(window.walzMyProducts) && window.walzMyProducts.length > 0;
        container.innerHTML = `
            <div class="orders-state-card my-products-empty">
                <h3>${hasProducts ? "No encontramos productos" : "Todavia no publicaste productos"}</h3>
                <p>${hasProducts ? "Proba otra busqueda." : "Publica tu primer producto con el formulario de arriba."}</p>
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
                               <button
                                   type="button"
                                   onclick="shareSellerProductWhatsApp('${escapeJs(String(product.id))}')"
                               >
                                   &#128241; WhatsApp
                               </button>
                               <button
                                   type="button"
                                   onclick="shareSellerProductFacebook('${escapeJs(String(product.id))}')"
                               >
                                   Facebook
                               </button>
                               <button
                                   type="button"
                                   onclick="shareSellerProductInstagram('${escapeJs(String(product.id))}')"
                               >
                                   Instagram
                               </button>
                               <button
                                   type="button"
                                   onclick="copySellerProductImage('${escapeJs(String(product.id))}')"
                               >
                                   &#128444; Copiar imagen
                               </button>
                               <button
                                   type="button"
                                   onclick="copySellerProductPublication('${escapeJs(String(product.id))}')"
                               >
                                   &#128203; Copiar publicacion
                               </button>
                               <button
                                   type="button"
                                   class="delete-product-button"
                                   onclick="deleteMyProduct('${escapeJs(String(product.id))}')"
                               >
                                   Eliminar producto
                               </button>
                           </div>`
                    }
                </article>
            `).join("")}
        </div>
    `;
}



function getMyProductDraftKey(productId) {
    const userId =
        localStorage.getItem("walz_user_id") ||
        currentUserId ||
        "seller";

    return `walz_product_draft_${userId}_${productId}`;
}


function saveCurrentMyProductDraft() {
    const productId = String(window.walzEditingProductId || "");

    if (!productId) return;

    const editor =
        document.getElementById(`edit-product-name-${productId}`);

    if (!editor) return;

    const draft = {
        name: document.getElementById(`edit-product-name-${productId}`)?.value || "",
        price: document.getElementById(`edit-product-price-${productId}`)?.value || "",
        commercial_type: document.getElementById(`edit-product-commercial-type-${productId}`)?.value || "",
        commercial_text: document.getElementById(`edit-product-commercial-text-${productId}`)?.value || "",
        offer_price: document.getElementById(`edit-product-offer-price-${productId}`)?.value || "",
        commercial_active: Boolean(
            document.getElementById(`edit-product-commercial-active-${productId}`)?.checked
        ),
        stock: document.getElementById(`edit-product-stock-${productId}`)?.value || "",
        category: document.getElementById(`edit-product-category-${productId}`)?.value || "",
        subcategory: document.getElementById(`edit-product-subcategory-${productId}`)?.value || "",
        brand: document.getElementById(`edit-product-brand-${productId}`)?.value || "",
        avanter_enabled: Boolean(
            document.getElementById(`edit-product-avanter-enabled-${productId}`)?.checked
        ),
        description: document.getElementById(`edit-product-description-${productId}`)?.value || "",
        image_url: document.getElementById(`edit-product-image-${productId}`)?.value || ""
    };

    localStorage.setItem(
        getMyProductDraftKey(productId),
        JSON.stringify(draft)
    );
}


function restoreMyProductDraft(productId) {
    const raw =
        localStorage.getItem(getMyProductDraftKey(productId));

    if (!raw) return;

    let draft;

    try {
        draft = JSON.parse(raw);
    } catch (_) {
        return;
    }

    const setValue = (prefix, value) => {
        const field =
            document.getElementById(`${prefix}-${productId}`);

        if (field && value !== undefined && value !== null) {
            field.value = value;
        }
    };

    setValue("edit-product-name", draft.name);
    setValue("edit-product-price", draft.price);
    setValue("edit-product-commercial-type", draft.commercial_type);
    setValue("edit-product-commercial-text", draft.commercial_text);
    setValue("edit-product-offer-price", draft.offer_price);
    setValue("edit-product-stock", draft.stock);
    setValue("edit-product-category", draft.category);
    setValue("edit-product-subcategory", draft.subcategory);
    setValue("edit-product-brand", draft.brand);

    const avanterField =
        document.getElementById(`edit-product-avanter-enabled-${productId}`);

    if (avanterField && draft.avanter_enabled !== undefined) {
        avanterField.checked = Boolean(draft.avanter_enabled);
    }

    setValue("edit-product-description", draft.description);
    setValue("edit-product-image", draft.image_url);

    const draftPreview =
        document.getElementById(
            `edit-product-image-preview-${productId}`
        );

    if (draftPreview) {
        if (draft.image_url) {
            draftPreview.innerHTML =
                renderProductImage(
                    draft.image_url,
                    draft.name || "Producto",
                    "product-card-image"
                );
        } else {
            draftPreview.innerHTML =
                "<small>Sin imagen actual.</small>";
        }
    }

    const active =
        document.getElementById(
            `edit-product-commercial-active-${productId}`
        );

    if (active) {
        active.checked = Boolean(draft.commercial_active);
    }
}


function clearMyProductDraft(productId) {
    localStorage.removeItem(
        getMyProductDraftKey(productId)
    );
}

function startEditingMyProduct(productId) {
    window.walzEditingProductId = String(productId);
    applyMyProductsFilters();
    restoreMyProductDraft(productId);
}


function cancelEditingMyProduct() {
    if (window.walzEditingProductId) {
        clearMyProductDraft(window.walzEditingProductId);
    }
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
                <span>Propuesta comercial</span>
                <select id="edit-product-commercial-type-${escapeHtml(String(product.id))}">
                    <option value="">Sin propuesta comercial</option>
                    <option value="OFERTA" ${(product.commercial_type === "OFERTA" || (!product.commercial_type && product.offer_active)) ? "selected" : ""}>Oferta</option>
                    <option value="PROMOCION" ${product.commercial_type === "PROMOCION" ? "selected" : ""}>Promocion</option>
                    <option value="NOVEDAD" ${product.commercial_type === "NOVEDAD" ? "selected" : ""}>Novedad</option>
                    <option value="COMBO" ${product.commercial_type === "COMBO" ? "selected" : ""}>Combo</option>
                    <option value="2X1" ${product.commercial_type === "2X1" ? "selected" : ""}>2x1</option>
                    <option value="LIQUIDACION" ${product.commercial_type === "LIQUIDACION" ? "selected" : ""}>Liquidacion</option>
                    <option value="BENEFICIO" ${product.commercial_type === "BENEFICIO" ? "selected" : ""}>Beneficio especial</option>
                </select>
            </label>
            <label>
                <span>Texto comercial breve</span>
                <input
                    id="edit-product-commercial-text-${escapeHtml(String(product.id))}"
                    type="text"
                    maxlength="200"
                    value="${escapeHtml(product.commercial_text || "")}"
                    placeholder="Ej.: Solo esta semana"
                >
            </label>
            <label>
                <span>Precio promocional</span>
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
                    id="edit-product-commercial-active-${escapeHtml(String(product.id))}"
                    type="checkbox"
                    ${(product.commercial_active || product.offer_active) ? "checked" : ""}
                >
                <span>Propuesta comercial activa</span>
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
            <label>
                <span>Subrubro</span>
                <input
                    id="edit-product-subcategory-${escapeHtml(String(product.id))}"
                    type="text"
                    maxlength="100"
                    value="${escapeHtml(product.subcategory || "")}"
                >
            </label>
            <label>
                <span>Marca</span>
                <input
                    id="edit-product-brand-${escapeHtml(String(product.id))}"
                    type="text"
                    maxlength="100"
                    value="${escapeHtml(product.brand || "")}"
                >
            </label>
            <label class="my-product-offer-toggle">
                <input
                    id="edit-product-avanter-enabled-${escapeHtml(String(product.id))}"
                    type="checkbox"
                    ${product.avanter_enabled ? "checked" : ""}
                >
                <span>Asociado a Bonos Avanter</span>
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
            </label>            <label class="my-product-description-field edit-product-file-label">
                <span>Reemplazar con una imagen de tu dispositivo</span>
                <input
                    id="edit-product-image-file-${escapeHtml(String(product.id))}"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onchange="handleEditProductImageSelection('${escapeJs(String(product.id))}', event)"
                >
                <small>Si no elegis un archivo, se conservara el enlace actual.</small>

                <div
                    id="edit-product-image-preview-${escapeHtml(String(product.id))}"
                    class="edit-product-image-preview"
                >
                    ${
                        product.image_url
                            ? renderProductImage(
                                product.image_url,
                                product.name,
                                "product-card-image"
                            )
                            : "<small>Sin imagen actual.</small>"
                    }
                </div>

                <small
                    id="edit-product-image-status-${escapeHtml(String(product.id))}"
                >
                    La nueva imagen se prepara al seleccionarla.
                </small>
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
    let commercialType = document.getElementById(`edit-product-commercial-type-${productId}`)?.value.trim() || "";
    const commercialText = document.getElementById(`edit-product-commercial-text-${productId}`)?.value.trim() || "";
    const offerPriceText = document.getElementById(`edit-product-offer-price-${productId}`)?.value.trim() || "";
    const offerPrice = offerPriceText ? Number(offerPriceText) : null;
    const commercialActive = Boolean(document.getElementById(`edit-product-commercial-active-${productId}`)?.checked);

    if (offerPrice !== null && !commercialType) {
        commercialType = "OFERTA";
    }

    const offerActive = commercialActive && offerPrice !== null;
    const stock = Number(document.getElementById(`edit-product-stock-${productId}`)?.value);
    const category = document.getElementById(`edit-product-category-${productId}`)?.value.trim() || "";
    const subcategory = document.getElementById(`edit-product-subcategory-${productId}`)?.value.trim() || "";
    const brand = document.getElementById(`edit-product-brand-${productId}`)?.value.trim() || "";
    const avanterEnabled = Boolean(
        document.getElementById(`edit-product-avanter-enabled-${productId}`)?.checked
    );
    const description = document.getElementById(`edit-product-description-${productId}`)?.value.trim() || "";
    let imageUrl = document.getElementById(`edit-product-image-${productId}`)?.value.trim() || "";
    const replacementImage = document.getElementById(`edit-product-image-file-${productId}`)?.files?.[0] || null;

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

    if (offerPrice !== null && (!Number.isFinite(offerPrice) || offerPrice <= 0)) {
        showMessage("Ingresa un precio promocional valido.", "error");
        return;
    }

    if (offerPrice !== null && offerPrice >= price) {
        showMessage("El precio promocional debe ser menor que el precio normal.", "error");
        return;
    }

    if (commercialActive && !commercialType) {
        showMessage("Selecciona un tipo de propuesta comercial.", "error");
        return;
    }

    if (commercialActive && commercialType === "OFERTA" && offerPrice === null) {
        showMessage("Una oferta activa necesita un precio promocional.", "error");
        return;
    }

    if (!currentToken) {
        showMessage("Tu sesion vencio. Inicia sesion nuevamente.", "error");
        handleLogout();
        return;
    }

    try {
        if (replacementImage) {
            showMessage("Preparando y subiendo la nueva imagen...", "success");
            imageUrl = await uploadNewProductImage(replacementImage);
        }
        const res = await fetch(`${API_URL}/products/${productId}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${currentToken}`
            },
            body: JSON.stringify({
                name,
                price,
                offer_price: offerPrice,
                offer_active: offerActive,
                commercial_type: commercialType || null,
                commercial_text: commercialText || null,
                commercial_active: commercialActive,
                stock,
                category: category || null,
                subcategory: subcategory || null,
                brand: brand || null,
                avanter_enabled: avanterEnabled,
                description: description || null,
                image_url: imageUrl
            })
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

        clearMyProductDraft(productId);
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
// ELIMINAR PRODUCTO
// =====================================================

async function deleteMyProduct(productId) {
    const currentToken = localStorage.getItem("walz_token");

    if (!currentToken) {
        showMessage("Tu sesion vencio. Inicia sesion nuevamente.", "error");
        handleLogout();
        return;
    }

    const confirmed = window.confirm(
        "Eliminar este producto? Dejara de mostrarse en tu catalogo y en WalZ One. Las ventas anteriores se conservaran."
    );

    if (!confirmed) return;

    try {
        const res = await fetch(`${API_URL}/products/${productId}`, {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${currentToken}`
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

        window.walzMyProducts = (window.walzMyProducts || []).filter(
            product => String(product.id) !== String(productId)
        );

        if (String(window.walzEditingProductId || "") === String(productId)) {
            window.walzEditingProductId = null;
        }

        showMessage("Producto eliminado correctamente.", "success");
        applyMyProductsFilters();
        await loadProducts();

    } catch (error) {
        console.error("Error eliminando producto:", error);
        showMessage(
            error.message || "No se pudo eliminar el producto.",
            "error"
        );
    }
}


// =====================================================
// FASE 5M - PUBLICIDAD Y BANNERS
// =====================================================


async function openMyPublicStore() {
    const currentToken =
        localStorage.getItem("walz_token");

    if (!currentToken) {
        showAuth();
        showLogin();
        return;
    }

    try {
        const response = await fetch(
            `${API_URL}/stores/mine`,
            {
                headers: {
                    Authorization: `Bearer ${currentToken}`
                }
            }
        );

        const store =
            await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(
                store.detail ||
                "No pudimos encontrar tu tienda."
            );
        }

        const slug =
            String(store.slug || "")
                .trim()
                .replace(/^\/+|\/+$/g, "");

        if (!slug) {
            throw new Error(
                "Tu tienda todavia no tiene una direccion publica."
            );
        }

        window.location.assign(
            `${window.location.origin}/${encodeURIComponent(slug)}`
        );

    } catch (error) {
        console.error(
            "Error abriendo tienda publica:",
            error
        );

        showMessage(
            error.message ||
            "No pudimos abrir tu tienda.",
            "error"
        );
    }
}


function updateAdminBannerVisibility() {
    const hasSession = Boolean(localStorage.getItem("walz_token"));
    const isAdmin = hasSession && currentUserRole === "ADMIN";
    const canSell = hasSession && ["VENDEDOR", "SELLER"].includes(currentUserRole);
    const isBuyer = hasSession && currentUserRole === "COMPRADOR";

    const cartButton = document.querySelector(".cart-button");
    if (cartButton) {
        cartButton.style.display = (isAdmin || canSell) ? "none" : "inline-flex";
    }

    if (isAdmin || canSell) {
        const cartSection = document.getElementById("cart-section");
        if (cartSection) cartSection.style.display = "none";
        document.body.classList.remove("cart-panel-open");
    }

    const viewMyStoreButton =
        document.getElementById("view-my-store-button");

    if (viewMyStoreButton) {
        viewMyStoreButton.style.display =
            canSell && !isAdmin
                ? "inline-flex"
                : "none";
    }



    const publicLoginButton = document.getElementById("public-login-button");
    if (publicLoginButton) {
        publicLoginButton.style.display = hasSession ? "none" : "inline-flex";
    }

    const publicRegisterButton = document.getElementById("public-register-button");
    if (publicRegisterButton) {
        publicRegisterButton.style.display = hasSession ? "none" : "inline-flex";
    }

    const myOrdersButton = document.getElementById("my-orders-button");
    if (myOrdersButton) {
        myOrdersButton.style.display = hasSession && !isAdmin ? "inline-flex" : "none";
    }

    const accountButton = document.getElementById("account-settings-button");
    if (accountButton) {
        accountButton.style.display = hasSession && !isAdmin ? "inline-flex" : "none";
    }

    const logoutButton = document.getElementById("logout-button");
    if (logoutButton) {
        logoutButton.style.display = hasSession ? "inline-flex" : "none";
    }

    const bannerButton = document.getElementById("banner-admin-button");
    if (bannerButton) {
        bannerButton.style.display = "none";
    }

    const adminApplicationsButton = document.getElementById("seller-applications-admin-button");
    if (adminApplicationsButton) {
        adminApplicationsButton.style.display = "none";
    }

    const applicationButton = document.getElementById("seller-application-button");
    if (applicationButton) {
        applicationButton.style.display = isBuyer ? "inline-flex" : "none";
    }

    const productCreateSection = document.getElementById("seller-product-create-section");
    if (productCreateSection) {
        productCreateSection.style.display = canSell ? "block" : "none";
    }

    for (const id of ["store-profile-button", "sales-orders-button", "my-products-button"]) {
        const sellerButton = document.getElementById(id);
        if (sellerButton) {
            sellerButton.style.display = canSell ? "inline-flex" : "none";
        }
    }
}
function setSellerPendingOrderBadge(count) {
    const badge = document.getElementById("seller-pending-orders-badge");
    if (!badge) return;
    const value = Math.max(0, Number(count || 0));
    badge.textContent = value > 99 ? "99+" : String(value);
    badge.style.display = value > 0 ? "inline-flex" : "none";
}


function stopSellerOrderNotifications() {
    if (window.walzSellerOrderNotificationTimer) {
        clearInterval(window.walzSellerOrderNotificationTimer);
        window.walzSellerOrderNotificationTimer = null;
    }
}


async function refreshSellerPendingOrderCount() {
    const canSell = ["VENDEDOR", "SELLER"].includes(currentUserRole);
    if (!canSell) {
        setSellerPendingOrderBadge(0);
        return;
    }
    const currentToken = localStorage.getItem("walz_token");
    if (!currentToken) return;
    try {
        const response = await fetch(`${API_URL}/orders/seller/received`, {
            headers: { Authorization: `Bearer ${currentToken}` }
        });
        const orders = await response.json().catch(() => ([]));
        if (response.status === 401) {
            stopSellerOrderNotifications();
    stopWalzDeviceSync();
            handleExpiredSession();
            return;
        }
        if (response.ok) {
            setSellerPendingOrderBadge((Array.isArray(orders) ? orders : []).filter(order => String(order.status || "").toLowerCase() === "pending").length);
        }
    } catch (error) {
        console.error("No se pudo actualizar el aviso de pedidos:", error);
    }
}


function startSellerOrderNotifications() {
    stopSellerOrderNotifications();
    stopWalzDeviceSync();
    refreshSellerPendingOrderCount();
    window.walzSellerOrderNotificationTimer = setInterval(refreshSellerPendingOrderCount, 60000);
}


function setAdminPendingBadge(id, count) {
    const badge = document.getElementById(id);
    if (!badge) return;
    const value = Math.max(0, Number(count || 0));
    badge.textContent = value > 99 ? "99+" : String(value);
    badge.style.display = value > 0 ? "inline-flex" : "none";

    const centralBadgeMap = {
        "seller-applications-pending-badge": "admin-central-applications-badge",
        "banner-proposals-pending-badge": "admin-central-banners-badge"
    };
    const centralBadge = document.getElementById(centralBadgeMap[id]);
    if (centralBadge) {
        centralBadge.textContent = value > 99 ? "99+" : String(value);
        centralBadge.style.display = value > 0 ? "inline-flex" : "none";
    }
}


function stopAdminNotifications() {
    if (window.walzAdminNotificationTimer) {
        clearInterval(window.walzAdminNotificationTimer);
        window.walzAdminNotificationTimer = null;
    }
}


async function refreshAdminPendingCounts() {
    if (currentUserRole !== "ADMIN") {
        setAdminPendingBadge("seller-applications-pending-badge", 0);
        setAdminPendingBadge("banner-proposals-pending-badge", 0);
        return;
    }
    const currentToken = localStorage.getItem("walz_token");
    if (!currentToken) return;
    try {
        const [applicationsResponse, bannersResponse] = await Promise.all([
            fetch(`${API_URL}/seller-applications/admin`, { headers: { Authorization: `Bearer ${currentToken}` } }),
            fetch(`${API_URL}/banners/admin`, { headers: { Authorization: `Bearer ${currentToken}` } })
        ]);
        const applications = await applicationsResponse.json().catch(() => ([]));
        const banners = await bannersResponse.json().catch(() => ([]));
        if (applicationsResponse.status === 401 || bannersResponse.status === 401) {
            stopAdminNotifications();
            handleExpiredSession();
            return;
        }
        if (applicationsResponse.ok) {
            setAdminPendingBadge("seller-applications-pending-badge", (Array.isArray(applications) ? applications : []).filter(item => item.status === "pending").length);
        }
        if (bannersResponse.ok) {
            setAdminPendingBadge("banner-proposals-pending-badge", (Array.isArray(banners) ? banners : []).filter(item => item.seller_id && item.approval_status === "pending").length);
        }
    } catch (error) {
        console.error("No se pudieron actualizar los avisos administrativos:", error);
    }
}


function startAdminNotifications() {
    stopAdminNotifications();
    refreshAdminPendingCounts();
    window.walzAdminNotificationTimer = setInterval(refreshAdminPendingCounts, 60000);
}


async function loadCurrentUserProfile() {
    const currentToken = localStorage.getItem("walz_token");
    if (!currentToken) return;

    try {
        const response = await fetch(`${API_URL}/auth/me`, {
            headers: { Authorization: `Bearer ${currentToken}` }
        });
        if (response.status === 401) {
            handleExpiredSession();
            return;
        }
        if (!response.ok) return;
        const user = await response.json();
        currentUserRole = String(user.role || "").toUpperCase();
        localStorage.setItem("walz_user_role", currentUserRole);
        updateAdminBannerVisibility();
        if (currentUserRole === "ADMIN") startAdminNotifications();
        else stopAdminNotifications();
        if (["VENDEDOR", "SELLER"].includes(currentUserRole)) startSellerOrderNotifications();
        else stopSellerOrderNotifications();
    } catch (error) {
        console.error("No se pudo cargar el perfil:", error);
    }
}


function getSafeBannerLink(value) {
    const url = String(value || "").trim();
    return /^(https?:\/\/|blob:)/i.test(url) ? url : "";
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


function prepareMarketplaceBannerMotion() {
    if (window.walzBannerMotionObserver) {
        window.walzBannerMotionObserver.disconnect();
        window.walzBannerMotionObserver = null;
    }

    const card = document.querySelector(
        "#marketplace-banners .marketplace-banner-card"
    );

    if (!card) return;

    const motionVariant = String(
        card.dataset.motionVariant || "STATIC"
    ).trim().toUpperCase();

    if (motionVariant === "STATIC") {
        card.classList.add("is-motion-visible");
        return;
    }

    card.classList.add("is-motion-pending");

    if (!("IntersectionObserver" in window)) {
        card.classList.add("is-motion-visible");
        return;
    }

    const observer = new IntersectionObserver(
        entries => {
            const entry = entries[0];
            if (!entry?.isIntersecting) return;

            card.classList.add("is-motion-visible");
            observer.disconnect();

            if (window.walzBannerMotionObserver === observer) {
                window.walzBannerMotionObserver = null;
            }
        },
        { threshold: 0.75 }
    );

    window.walzBannerMotionObserver = observer;
    observer.observe(card);
}


function renderMarketplaceBanner() {
    const container = document.getElementById("marketplace-banners");
    const banners = Array.isArray(window.walzActiveBanners) ? window.walzActiveBanners : [];
    if (!container || banners.length === 0) return;

    const index = Math.max(0, Math.min(Number(window.walzBannerIndex || 0), banners.length - 1));
    window.walzBannerIndex = index;
    const banner = banners[index];

    const rawStyleVariant = String(
        banner.style_variant || "STANDARD"
    ).trim().toUpperCase();

    const styleVariant = [
        "STANDARD",
        "INFO",
        "PROMO",
        "NOTICE",
    ].includes(rawStyleVariant)
        ? rawStyleVariant
        : "STANDARD";

    const rawMotionVariant = String(
        banner.motion_variant || "STATIC"
    ).trim().toUpperCase();

    const motionVariant = [
        "STATIC",
        "FADE",
        "SLIDE",
    ].includes(rawMotionVariant)
        ? rawMotionVariant
        : "STATIC";

    const bannerImageUrl = getProductImageUrl(
        banner.image_url
    );

    const bannerHasImage = Boolean(bannerImageUrl);

    const bannerImage = bannerHasImage
        ? `<img
            class="marketplace-banner-image"
            src="${escapeHtml(bannerImageUrl)}"
            alt="${escapeHtml(banner.title || "Publicidad")}"
            loading="lazy"
            onerror="const card=this.closest('.marketplace-banner-card');if(card)card.classList.add('marketplace-banner-card-no-image');this.remove();"
        >`
        : "";

    const link = getSafeBannerLink(banner.link_url);
    const productButton = banner.product_id
        ? `<button type="button" onclick="openPromotedProduct('${escapeJs(String(banner.product_id))}')">${escapeHtml(banner.button_text || "Ver producto")}</button>`
        : "";

    container.innerHTML = `
        <article
            class="marketplace-banner-card${bannerHasImage ? "" : " marketplace-banner-card-no-image"}"
            data-style-variant="${styleVariant}"
            data-motion-variant="${motionVariant}"
        >
            ${bannerImage}
            <div class="marketplace-banner-copy">
                <span class="marketplace-banner-label">Publicidad</span>
                <h2>${escapeHtml(banner.title || "")}</h2>
                ${banner.subtitle ? `<p>${escapeHtml(banner.subtitle)}</p>` : ""}
                ${link ? `<a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(banner.button_text || "Ver mas")}</a>` : ""}
                ${productButton}
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


function openPromotedProduct(productId) {
    showMarketplaceContent();
    window.setTimeout(() => {
        const product = (window.walzProducts || []).find(item => String(item.id) === String(productId));
        if (product) openProductDetail(productId);
        else showMessage("El producto anunciado ya no esta disponible.", "error");
    }, 350);
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


function hideMarketplaceBanners() {
    const container =
        document.getElementById("marketplace-banners");

    window.walzBannerLoadToken =
        Number(window.walzBannerLoadToken || 0) + 1;

    stopMarketplaceBannerRotation();
    window.walzActiveBanners = [];

    if (container) {
        container.style.display = "none";
        container.innerHTML = "";
    }
}


function bannerMatchesCurrentAudience(banner) {
    const hasSession =
        Boolean(localStorage.getItem("walz_token"));

    const role =
        hasSession ? currentUserRole : null;

    const audience =
        String(banner?.audience || "PUBLIC").toUpperCase();

    if (audience === "BUYER") {
        return role === "COMPRADOR";
    }

    if (audience === "SELLER") {
        return ["VENDEDOR", "SELLER"].includes(role);
    }

    // PUBLIC = cualquier persona que este viendo el Marketplace general.
    return true;
}


async function loadActiveBanners(
    placement = "CENTRAL_MARKETPLACE"
) {
    const container =
        document.getElementById("marketplace-banners");

    if (!container) return;

    const requestToken =
        Number(window.walzBannerLoadToken || 0) + 1;

    window.walzBannerLoadToken = requestToken;

    try {
        const response = await fetch(
            `${API_URL}/banners/active?placement=${encodeURIComponent(placement)}`
        );

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const received = await response.json();

        if (
            requestToken
            !== Number(window.walzBannerLoadToken || 0)
        ) {
            return;
        }

        const banners =
            Array.isArray(received)
                ? received.filter(bannerMatchesCurrentAudience)
                : [];

        if (banners.length === 0) {
            hideMarketplaceBanners();
            return;
        }

        window.walzActiveBanners = banners;
        window.walzBannerIndex = 0;

        renderMarketplaceBanner();

        container.style.display = "block";
        container.onmouseenter =
            stopMarketplaceBannerRotation;
        container.onmouseleave =
            startMarketplaceBannerRotation;

        startMarketplaceBannerRotation();
    } catch (error) {
        if (
            requestToken
            !== Number(window.walzBannerLoadToken || 0)
        ) {
            return;
        }

        console.error(
            "No se pudieron cargar los banners:",
            error
        );

        hideMarketplaceBanners();
    }
}


function stopSellerSponsoredBannerRotation() {
    if (window.walzSellerSponsoredTimer) {
        clearInterval(window.walzSellerSponsoredTimer);
        window.walzSellerSponsoredTimer = null;
    }
}


function startSellerSponsoredBannerRotation() {
    stopSellerSponsoredBannerRotation();

    const banners = Array.isArray(window.walzSellerSponsoredBanners)
        ? window.walzSellerSponsoredBanners
        : [];

    if (banners.length <= 1) return;

    window.walzSellerSponsoredTimer = setInterval(() => {
        moveSellerSponsoredBanner(1, false);
    }, 6500);
}


function moveSellerSponsoredBanner(direction, restart = true) {
    const banners = Array.isArray(window.walzSellerSponsoredBanners)
        ? window.walzSellerSponsoredBanners
        : [];

    if (banners.length <= 1) return;

    const current = Number(window.walzSellerSponsoredIndex || 0);

    window.walzSellerSponsoredIndex =
        (current + Number(direction || 0) + banners.length)
        % banners.length;

    renderSellerSponsoredBanner();

    if (restart) {
        startSellerSponsoredBannerRotation();
    }
}


function renderSellerSponsoredBanner() {
    const container =
        document.getElementById("seller-sponsored-banners");

    const banners = Array.isArray(window.walzSellerSponsoredBanners)
        ? window.walzSellerSponsoredBanners
        : [];

    if (!container || banners.length === 0) return;

    const index = Math.max(
        0,
        Math.min(
            Number(window.walzSellerSponsoredIndex || 0),
            banners.length - 1
        )
    );

    window.walzSellerSponsoredIndex = index;

    const banner = banners[index];

    const bannerImageUrl =
        getProductImageUrl(banner.image_url);

    const bannerHasImage = Boolean(bannerImageUrl);

    const bannerImage = bannerHasImage
        ? `<img
            class="marketplace-banner-image"
            src="${escapeHtml(bannerImageUrl)}"
            alt="${escapeHtml(banner.title || "Publicidad patrocinada")}"
            loading="lazy"
            onerror="const card=this.closest('.marketplace-banner-card');if(card)card.classList.add('marketplace-banner-card-no-image');this.remove();"
        >`
        : "";

    const link = getSafeBannerLink(banner.link_url);

    const productButton = banner.product_id
        ? `<button
            type="button"
            onclick="openPromotedProduct('${escapeJs(String(banner.product_id))}')"
        >${escapeHtml(banner.button_text || "Ver producto")}</button>`
        : "";

    container.innerHTML = `
        <article
            class="marketplace-banner-card${bannerHasImage ? "" : " marketplace-banner-card-no-image"}"
            data-style-variant="STANDARD"
            data-motion-variant="STATIC"
        >
            ${bannerImage}

            <div class="marketplace-banner-copy">
                <span class="marketplace-banner-label">
                    Publicidad patrocinada
                </span>

                <h2>${escapeHtml(banner.title || "")}</h2>

                ${banner.subtitle
                    ? `<p>${escapeHtml(banner.subtitle)}</p>`
                    : ""
                }

                ${link
                    ? `<a
                        href="${escapeHtml(link)}"
                        target="_blank"
                        rel="noopener noreferrer"
                    >${escapeHtml(banner.button_text || "Ver mas")}</a>`
                    : ""
                }

                ${productButton}
            </div>

            ${banners.length > 1 ? `
                <button
                    type="button"
                    class="banner-carousel-arrow previous"
                    onclick="moveSellerSponsoredBanner(-1)"
                    aria-label="Publicidad patrocinada anterior"
                >&#10094;</button>

                <button
                    type="button"
                    class="banner-carousel-arrow next"
                    onclick="moveSellerSponsoredBanner(1)"
                    aria-label="Publicidad patrocinada siguiente"
                >&#10095;</button>
            ` : ""}
        </article>
    `;
}


function hideSellerSponsoredBanners() {
    const container =
        document.getElementById("seller-sponsored-banners");

    window.walzSellerSponsoredLoadToken =
        Number(window.walzSellerSponsoredLoadToken || 0) + 1;

    stopSellerSponsoredBannerRotation();

    window.walzSellerSponsoredBanners = [];
    window.walzSellerSponsoredIndex = 0;

    if (container) {
        container.style.display = "none";
        container.innerHTML = "";
    }
}


async function loadSellerSponsoredBanners() {
    const container =
        document.getElementById("seller-sponsored-banners");

    if (!container) return;

    const requestToken =
        Number(window.walzSellerSponsoredLoadToken || 0) + 1;

    window.walzSellerSponsoredLoadToken = requestToken;

    try {
        const response = await fetch(
            `${API_URL}/banners/active?placement=SELLER_SPONSORED`
        );

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const received = await response.json();

        if (
            requestToken
            !== Number(window.walzSellerSponsoredLoadToken || 0)
        ) {
            return;
        }

        const banners = Array.isArray(received)
            ? received.filter(bannerMatchesCurrentAudience)
            : [];

        if (banners.length === 0) {
            hideSellerSponsoredBanners();
            return;
        }

        window.walzSellerSponsoredBanners = banners;
        window.walzSellerSponsoredIndex = 0;

        renderSellerSponsoredBanner();

        container.style.display = "block";
        container.onmouseenter =
            stopSellerSponsoredBannerRotation;
        container.onmouseleave =
            startSellerSponsoredBannerRotation;

        startSellerSponsoredBannerRotation();
    } catch (error) {
        if (
            requestToken
            !== Number(window.walzSellerSponsoredLoadToken || 0)
        ) {
            return;
        }

        console.error(
            "No se pudo cargar la publicidad patrocinada:",
            error
        );

        hideSellerSponsoredBanners();
    }
}


function hideSellerApplicationSections() {
    document.getElementById("seller-application-section")?.style.setProperty("display", "none");
    document.getElementById("seller-applications-admin-section")?.style.setProperty("display", "none");
}


function getSellerApplicationStatus(status) {
    const value = String(status || "pending").toLowerCase();
    if (value === "approved") return { label: "Aprobada", css: "approved" };
    if (value === "rejected") return { label: "Rechazada", css: "rejected" };
    return { label: "Pendiente de revision", css: "pending" };
}


function getAvailableBusinessCategories() {
    const result = [];
    const seen = new Set();

    document.querySelectorAll(".store-business-category").forEach(input => {
        const value = String(input.value || "").replace(/\s+/g, " ").trim();
        if (!value) return;

        const key = value.toLocaleLowerCase("es");
        if (seen.has(key)) return;

        seen.add(key);
        result.push(value);
    });

    return result;
}


function normalizeSellerApplicationBusinessCategories(values) {
    const result = [];
    const seen = new Set();

    for (const rawValue of Array.isArray(values) ? values : []) {
        const value = String(rawValue || "").replace(/\s+/g, " ").trim();
        if (!value) continue;

        const key = value.toLocaleLowerCase("es");
        if (seen.has(key)) continue;

        seen.add(key);
        result.push(value);
    }

    return result;
}


function getSellerApplicationBusinessCategoriesFromForm() {
    const selected = Array.from(
        document.querySelectorAll(".seller-application-business-category:checked")
    ).map(input => String(input.value || "").trim());

    const custom = String(
        document.getElementById("seller-application-business-categories-custom")?.value || ""
    )
        .split(",")
        .map(value => value.trim())
        .filter(Boolean);

    return normalizeSellerApplicationBusinessCategories([
        ...selected,
        ...custom
    ]);
}


function renderSellerApplicationBusinessCategoriesField(categories = []) {
    const available = getAvailableBusinessCategories();
    const selected = normalizeSellerApplicationBusinessCategories(categories);

    const selectedMap = new Map(
        selected.map(value => [value.toLocaleLowerCase("es"), value])
    );

    const availableKeys = new Set(
        available.map(value => value.toLocaleLowerCase("es"))
    );

    const customValues = selected.filter(
        value => !availableKeys.has(value.toLocaleLowerCase("es"))
    );

    const options = available.map(category => {
        const key = category.toLocaleLowerCase("es");
        const checked = selectedMap.has(key) ? " checked" : "";

        return `<label>
            <input
                type="checkbox"
                class="seller-application-business-category"
                value="${escapeHtml(category)}"${checked}
            >
            <span>${escapeHtml(category)}</span>
        </label>`;
    }).join("");

    return `
        <fieldset class="store-business-categories seller-application-wide">
            <div class="store-delivery-title">&iquest;Qu&eacute; vend&eacute;s u ofrec&eacute;s?</div>
            <p>Eleg&iacute; uno o varios rubros. Pod&eacute;s seleccionar hasta 8.</p>

            <div class="store-business-categories-options">
                ${options}
            </div>

            <label class="store-business-custom">
                <span>Otros rubros</span>
                <input
                    id="seller-application-business-categories-custom"
                    type="text"
                    maxlength="400"
                    placeholder="Ejemplo: Fotografía, Reparación de bicicletas"
                    value="${escapeHtml(customValues.join(", "))}"
                >
                <small>Si tu actividad no aparece, escribila ac&aacute;. Separ&aacute; varios rubros con comas.</small>
            </label>
        </fieldset>
    `;
}


function renderSellerApplicationCategoriesSummary(categories) {
    const values = normalizeSellerApplicationBusinessCategories(categories);

    if (!values.length) return "";

    return `<p><strong>Rubros:</strong> ${values
        .map(value => escapeHtml(value))
        .join(" &middot; ")}</p>`;
}


function renderSellerApplicationForm(application = null) {
    const container = document.getElementById("seller-application-content");
    if (!container) return;
    const state = application ? getSellerApplicationStatus(application.status) : null;

    if (application && application.status === "pending") {
        container.innerHTML = `<div class="seller-application-card">
            <span class="banner-review-state ${state.css}">${state.label}</span>
            <h3>${escapeHtml(application.business_name || "")}</h3>
            <p>${escapeHtml(application.reason || "")}</p>
            ${application.city ? `<p>Ciudad: <strong>${escapeHtml(application.city)}</strong></p>` : ""}
            ${renderSellerApplicationCategoriesSummary(application.business_categories)}
            <small>WalZ te avisara cuando la solicitud sea revisada.</small>
        </div>`;
        return;
    }

    if (application && application.status === "approved") {
        container.innerHTML = `<div class="seller-application-card seller-application-approved">
            <span class="banner-review-state approved">Aprobada</span>
            <h3>Tu cuenta ya puede vender</h3>
            <p>Actualiza la pagina o inicia sesion nuevamente para ver Mi tienda y Mis productos.</p>
        </div>`;
        return;
    }

    container.innerHTML = `
        ${application ? `<div class="seller-application-card seller-application-rejected">
            <span class="banner-review-state rejected">Rechazada</span>
            <p>${escapeHtml(application.admin_note || "Podes corregir la informacion y volver a enviarla.")}</p>
        </div>` : ""}
        <form class="seller-application-form" onsubmit="submitSellerApplication(event)">
            <label><span>Nombre del negocio</span><input id="seller-application-business" type="text" minlength="2" maxlength="160" required value="${escapeHtml(application?.business_name || "")}"></label>
            <label><span>Ciudad</span><input id="seller-application-city" type="text" maxlength="120" value="${escapeHtml(application?.city || "")}"></label>
            ${renderSellerApplicationBusinessCategoriesField(application?.business_categories || [])}
            <label class="seller-application-wide"><span>Contanos que queres vender</span><textarea id="seller-application-reason" minlength="10" maxlength="1200" required>${escapeHtml(application?.reason || "")}</textarea></label>
            <button type="submit">Enviar solicitud</button>
        </form>
        <p id="seller-application-error" class="delivery-error"></p>
    `;
}


async function showSellerApplication() {
    hideAllWalzWorkSections();
    const section = document.getElementById("seller-application-section");
    if (section) section.style.display = "block";
    await loadSellerApplication();
}


async function loadSellerApplication() {
    const container = document.getElementById("seller-application-content");
    const currentToken = localStorage.getItem("walz_token");
    if (!container) return;
    container.innerHTML = '<div class="orders-state-card">Cargando solicitud...</div>';
    try {
        const response = await fetch(`${API_URL}/seller-applications/mine`, {
            headers: { Authorization: `Bearer ${currentToken}` }
        });
        const application = await response.json().catch(() => null);
        if (!response.ok) throw new Error(application?.detail || `HTTP ${response.status}`);
        renderSellerApplicationForm(application);
    } catch (error) {
        container.innerHTML = `<div class="orders-state-card orders-error">${escapeHtml(error.message || "No se pudo cargar la solicitud.")}</div>`;
    }
}


async function submitSellerApplication(event) {
    event?.preventDefault();
    const currentToken = localStorage.getItem("walz_token");
    const errorElement = document.getElementById("seller-application-error");
    const businessName = document.getElementById("seller-application-business")?.value.trim() || "";
    const city = document.getElementById("seller-application-city")?.value.trim() || "";
    const reason = document.getElementById("seller-application-reason")?.value.trim() || "";
    const businessCategories = getSellerApplicationBusinessCategoriesFromForm();

    if (errorElement) errorElement.textContent = "";

    if (!businessCategories.length) {
        if (errorElement) errorElement.textContent = "Selecciona al menos un rubro.";
        return;
    }

    if (businessCategories.length > 8) {
        if (errorElement) errorElement.textContent = "Podes seleccionar hasta 8 rubros.";
        return;
    }

    if (businessCategories.some(category => category.length > 80)) {
        if (errorElement) errorElement.textContent = "Cada rubro puede tener hasta 80 caracteres.";
        return;
    }

    try {
        const response = await fetch(`${API_URL}/seller-applications/mine`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentToken}` },
            body: JSON.stringify({
                business_name: businessName,
                city: city || null,
                reason,
                business_categories: businessCategories
            })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || `HTTP ${response.status}`);
        showMessage("Solicitud enviada correctamente.", "success");
        renderSellerApplicationForm(data);
    } catch (error) {
        if (errorElement) errorElement.textContent = error.message || "No se pudo enviar la solicitud.";
    }
}


function hideAllWalzWorkSections() {
    saveCurrentMyProductDraft();
    for (const id of [
        "marketplace-content", "orders-section", "sales-orders-section", "my-products-section",
        "store-profile-section", "public-store-section", "banner-admin-section", "banner-proposal-section",
        "seller-application-section", "seller-applications-admin-section", "account-settings-section",
        "admin-central-section", "admin-stores-section", "admin-orders-section", "admin-products-section", "admin-economy-section", "institutional-settings-section"
    ]) {
        document.getElementById(id)?.style.setProperty("display", "none");
    }
}


async function showSellerApplicationsAdmin() {
    if (currentUserRole !== "ADMIN") {
        showMessage("Se requiere una cuenta administradora.", "error");
        return;
    }
    hideAllWalzWorkSections();
    const section = document.getElementById("seller-applications-admin-section");
    if (section) section.style.display = "block";
    window.scrollTo(0, 0);
    await loadSellerApplicationsAdmin();
}


async function loadSellerApplicationsAdmin() {
    const container = document.getElementById("seller-applications-admin-list");
    const currentToken = localStorage.getItem("walz_token");
    if (!container) return;
    container.innerHTML = '<div class="orders-state-card">Cargando solicitudes...</div>';
    try {
        const response = await fetch(`${API_URL}/seller-applications/admin`, {
            headers: { Authorization: `Bearer ${currentToken}` }
        });
        const applications = await response.json().catch(() => ([]));
        if (!response.ok) throw new Error(applications.detail || `HTTP ${response.status}`);
        if (!Array.isArray(applications) || applications.length === 0) {
            container.innerHTML = '<div class="orders-state-card">Todavia no hay solicitudes.</div>';
            return;
        }
        container.innerHTML = `<div class="seller-applications-list">${applications.map(application => {
            const state = getSellerApplicationStatus(application.status);
            const isPending = application.status === "pending";
            return `<article class="seller-application-card">
                <div class="seller-application-heading"><div><small>Solicitante</small><h3>${escapeHtml(application.applicant_name || "")}</h3><p>${escapeHtml(application.applicant_email || "")}</p></div><span class="banner-review-state ${state.css}">${state.label}</span></div>
                <p><strong>Negocio:</strong> ${escapeHtml(application.business_name || "")}</p>
                ${application.city ? `<p><strong>Ciudad:</strong> ${escapeHtml(application.city)}</p>` : ""}
                ${renderSellerApplicationCategoriesSummary(application.business_categories)}
                <p><strong>Propuesta:</strong> ${escapeHtml(application.reason || "")}</p>
                ${application.admin_note ? `<p><strong>Observacion:</strong> ${escapeHtml(application.admin_note)}</p>` : ""}
                ${isPending ? `<textarea id="seller-review-note-${escapeHtml(String(application.id))}" maxlength="1200" placeholder="Observacion opcional para el solicitante"></textarea>
                <div class="banner-review-actions"><button type="button" onclick="reviewSellerApplication('${escapeJs(String(application.id))}', 'approved')">Aprobar vendedor</button><button type="button" class="seller-cancel-button" onclick="reviewSellerApplication('${escapeJs(String(application.id))}', 'rejected')">Rechazar</button></div>` : ""}
            </article>`;
        }).join("")}</div>`;
    } catch (error) {
        container.innerHTML = `<div class="orders-state-card orders-error">${escapeHtml(error.message || "No se pudieron cargar las solicitudes.")}</div>`;
    }
}


async function reviewSellerApplication(applicationId, status) {
    const action = status === "approved" ? "aprobar" : "rechazar";
    if (!confirm(`Confirmas que queres ${action} esta solicitud?`)) return;
    const currentToken = localStorage.getItem("walz_token");
    const note = document.getElementById(`seller-review-note-${applicationId}`)?.value.trim() || "";
    try {
        const response = await fetch(`${API_URL}/seller-applications/admin/${applicationId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentToken}` },
            body: JSON.stringify({ status, admin_note: note || null })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || `HTTP ${response.status}`);
        showMessage(status === "approved" ? "Vendedor aprobado correctamente." : "Solicitud rechazada.", "success");
        await loadSellerApplicationsAdmin();
        await refreshAdminPendingCounts();
    } catch (error) {
        showMessage(error.message || "No se pudo revisar la solicitud.", "error");
    }
}


function hidePublicStoreSection() {
    const section = document.getElementById("public-store-section");
    if (section) section.style.display = "none";
}


async function showPublicStore(sellerId) {
    hideSellerApplicationSections();
    const section = document.getElementById("public-store-section");
    const container = document.getElementById("public-store-content");
    if (!section || !container) return;

    const directStorePath = window.location.pathname.split("/").filter(Boolean).join("/").toLowerCase();
    const directStoreEntry = Boolean(directStorePath);
    const backButton = section.querySelector("button");
    if (backButton) backButton.style.display = directStoreEntry ? "none" : "";

    document.getElementById("marketplace-content")?.style.setProperty("display", "none");
    document.getElementById("orders-section")?.style.setProperty("display", "none");
    document.getElementById("sales-orders-section")?.style.setProperty("display", "none");
    document.getElementById("my-products-section")?.style.setProperty("display", "none");
    document.getElementById("store-profile-section")?.style.setProperty("display", "none");
    document.getElementById("banner-admin-section")?.style.setProperty("display", "none");
    document.getElementById("banner-proposal-section")?.style.setProperty("display", "none");
    section.style.display = "block";
    container.innerHTML = '<div class="orders-state-card">Cargando tienda...</div>';

    try {
        const [storeResponse, productsResponse] = await Promise.all([
            fetch(`${API_URL}/stores/seller/${sellerId}`),
            fetch(`${API_URL}/products/`)
        ]);
        const store = await storeResponse.json().catch(() => ({}));
        const products = await productsResponse.json().catch(() => ([]));
        if (!storeResponse.ok) throw new Error(store.detail || "Esta tienda todavia no completo su perfil.");
        if (!productsResponse.ok) throw new Error("No se pudieron cargar los productos de la tienda.");

        const storeProducts = (Array.isArray(products) ? products : []).filter(
            product => String(product.seller_id) === String(sellerId) && product.is_active
        );

        const avanterProducts = storeProducts.filter(
            product => product.avanter_enabled === true
        );

        window.walzProducts = storeProducts;
        window.walzStoresByOwner = { [String(sellerId)]: store };
        container.innerHTML = `
            <header class="public-store-header">
                ${renderProductImage(store.logo_url, store.name, "public-store-logo")}
                <div class="public-store-copy">
                    <span>Tienda en WalZ One</span>
                    <h1>${escapeHtml(store.name || "Tienda")}</h1>
                    ${store.description ? `<p>${escapeHtml(store.description)}</p>` : ""}
                    ${Array.isArray(store.business_categories) && store.business_categories.length ? `
                        <div class="public-store-categories">
                            ${store.business_categories.map(category => `<span>${escapeHtml(category)}</span>`).join("")}
                        </div>
                    ` : ""}

                    ${store.avanter_enabled === true ? `
                        <div class="public-store-avanter-summary">
                            <div>
                                <strong>Trabajamos con Bonos Avanter</strong>
                                <span>Consult&aacute; productos adheridos y beneficios vigentes.</span>
                            </div>

                            <button
                                type="button"
                                onclick="document.getElementById('public-store-avanter-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })"
                            >
                                Ver productos con Bonos Avanter
                            </button>
                        </div>
                    ` : ""}

                    <div class="public-store-contact">
                        ${store.city ? `<span>Ciudad: <strong>${escapeHtml(store.city)}</strong></span>` : ""}
                        ${store.phone ? `<span>Telefono: <strong>${escapeHtml(store.phone)}</strong></span>` : ""}
                        ${store.address ? `<span>Direccion: <strong>${escapeHtml(store.address)}</strong></span>` : ""}
                    </div>
                </div>
            </header>

            ${store.avanter_enabled === true ? `
                <section
                    id="public-store-avanter-section"
                    class="public-store-avanter"
                >
                    <div class="public-store-avanter-copy">
                        <span class="public-store-avanter-kicker">Programa de beneficios</span>

                        <h2>
                            ${escapeHtml(store.avanter_title || "Bonos Avanter")}
                        </h2>

                        ${store.avanter_text ? `
                            <p>${escapeHtml(store.avanter_text)}</p>
                        ` : ""}
                    </div>

                    ${store.avanter_image_url ? `
                        <div class="public-store-avanter-media">
                            ${renderProductImage(
                                store.avanter_image_url,
                                store.avanter_title || "Bonos Avanter",
                                "public-store-avanter-image"
                            )}
                        </div>
                    ` : ""}

                    ${avanterProducts.length ? `
                        <div class="public-store-avanter-products">
                            <h3>Productos asociados a Bonos Avanter</h3>

                            <div class="public-store-products">
                                ${avanterProducts.map(product => `
                                    <article
                                        class="public-store-product public-store-avanter-product"
                                        onclick="openProductDetail('${escapeJs(String(product.id))}')"
                                    >
                                        ${renderProductImage(
                                            product.image_url,
                                            product.name,
                                            "public-store-product-image"
                                        )}

                                        <div>
                                            <span class="public-store-avanter-badge">
                                                Producto adherido a Bonos Avanter
                                            </span>

                                            <h3>${escapeHtml(product.name || "Producto")}</h3>

                                            <p class="product-price">
                                                ${renderProductPrice(product)}
                                            </p>

                                            <small class="public-store-avanter-price-note">
                                                El beneficio se aplica seg&uacute;n el bono vigente presentado.
                                            </small>

                                            <span>
                                                Stock: ${Number(product.stock || 0)}
                                            </span>
                                        </div>

                                        <button
                                            type="button"
                                            onclick="event.stopPropagation(); openProductDetail('${escapeJs(String(product.id))}')"
                                        >
                                            Ver producto
                                        </button>
                                    </article>
                                `).join("")}
                            </div>
                        </div>
                    ` : ""}
                </section>
            ` : ""}

            <h2>Productos de ${escapeHtml(store.name || "la tienda")}</h2>
            ${storeProducts.length ? `<div class="public-store-products">${storeProducts.map(product => `
                <article class="public-store-product" onclick="openProductDetail('${escapeJs(String(product.id))}')">
                    ${renderProductImage(product.image_url, product.name, "public-store-product-image")}
                    <div>
                        <h3>${escapeHtml(product.name || "Producto")}</h3>
                        <p class="product-price">${renderProductPrice(product)}</p>
                        <span>Stock: ${Number(product.stock || 0)}</span>
                    </div>
                    <button type="button" onclick="event.stopPropagation(); openProductDetail('${escapeJs(String(product.id))}')">Ver producto</button>
                </article>
            `).join("")}</div>` : '<div class="orders-state-card">Esta tienda no tiene productos activos en este momento.</div>'}
        `;
    } catch (error) {
        container.innerHTML = `<div class="orders-state-card orders-error"><h3>No pudimos abrir la tienda</h3><p>${escapeHtml(error.message || "Intenta nuevamente.")}</p></div>`;
    }
}


function hideStoreProfileSection() {
    const section = document.getElementById("store-profile-section");
    if (section) section.style.display = "none";
}


function previewStoreLogoFile() {
    const input = document.getElementById("store-logo-file");
    const file = input?.files?.[0] || null;
    const fileName = document.getElementById("store-logo-file-name");
    if (window.walzStoreLogoPreviewUrl) {
        URL.revokeObjectURL(window.walzStoreLogoPreviewUrl);
        window.walzStoreLogoPreviewUrl = "";
    }
    if (!file) {
        if (fileName) fileName.textContent = "Ningun archivo seleccionado";
        renderStorePreview();
        return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        input.value = "";
        if (fileName) fileName.textContent = "Formato no permitido";
        showMessage("Selecciona un logo JPG, PNG o WebP.", "error");
        return;
    }
    if (file.size > 12 * 1024 * 1024) {
        input.value = "";
        if (fileName) fileName.textContent = "La imagen supera 12 MB";
        showMessage("El logo original no puede superar 12 MB.", "error");
        return;
    }
    window.walzStoreLogoPreviewUrl = URL.createObjectURL(file);
    if (fileName) fileName.textContent = `${file.name} - Vista previa lista. Presiona Guardar tienda para confirmar.`;
    renderStorePreview();
}

async function uploadStoreLogo(file) {
    const blob = await optimizeProductImage(file);
    const form = new FormData();
    form.append("image", blob, "logo-tienda.webp");
    const response = await fetch(`${API_URL}/stores/logo`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("walz_token")}` },
        body: form
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || "No se pudo subir el logo.");
    return data.logo_url;
}


function getStoreBusinessCategoriesFromForm() {
    const selected = Array.from(
        document.querySelectorAll(".store-business-category:checked")
    ).map(input => String(input.value || "").trim());

    const custom = String(
        document.getElementById("store-business-categories-custom")?.value || ""
    )
        .split(",")
        .map(value => value.trim())
        .filter(Boolean);

    const result = [];
    const seen = new Set();

    for (const value of [...selected, ...custom]) {
        const normalized = value.replace(/\s+/g, " ").trim();
        if (!normalized) continue;

        const key = normalized.toLocaleLowerCase("es");
        if (seen.has(key)) continue;

        seen.add(key);
        result.push(normalized);
    }

    return result;
}


function setStoreBusinessCategoriesForm(categories) {
    const values = Array.isArray(categories)
        ? categories.map(value => String(value || "").trim()).filter(Boolean)
        : [];

    const remaining = new Map(
        values.map(value => [value.toLocaleLowerCase("es"), value])
    );

    document.querySelectorAll(".store-business-category").forEach(input => {
        const key = String(input.value || "").trim().toLocaleLowerCase("es");
        const selected = remaining.has(key);
        input.checked = selected;
        if (selected) remaining.delete(key);
    });

    const customInput =
        document.getElementById("store-business-categories-custom");

    if (customInput) {
        customInput.value = Array.from(remaining.values()).join(", ");
    }
}


function renderStorePreview() {
    const container = document.getElementById("store-profile-preview");
    if (!container) return;
    const name = document.getElementById("store-name")?.value.trim() || "Nombre de tu tienda";
    const description = document.getElementById("store-description")?.value.trim() || "La descripcion de tu negocio aparecera aqui.";
    const businessCategories = getStoreBusinessCategoriesFromForm();
    const deliveryEnabled = document.getElementById("store-delivery-enabled")?.checked !== false;
    const pickupEnabled = document.getElementById("store-pickup-enabled")?.checked !== false;
    const deliveryLabels = [
        deliveryEnabled ? "Envio a domicilio" : "",
        pickupEnabled ? "Retiro en el local" : ""
    ].filter(Boolean);
    const logoUrl = window.walzStoreLogoPreviewUrl || document.getElementById("store-logo-url")?.value.trim() || "";
    container.innerHTML = `
        <div class="store-preview-brand">
            ${renderProductImage(logoUrl, name, "store-preview-logo")}
            <div>
                <h3>${escapeHtml(name)}</h3>
                <p>${escapeHtml(description)}</p>
                <div class="store-preview-categories">
                    ${businessCategories.length
                        ? businessCategories.map(category => `<span>${escapeHtml(category)}</span>`).join("")
                        : "<strong>Selecciona al menos un rubro</strong>"}
                </div>
                <div class="store-preview-delivery">
                    ${deliveryLabels.length
                        ? deliveryLabels.map(label => `<span>${escapeHtml(label)}</span>`).join("")
                        : "<strong>Selecciona una forma de entrega</strong>"}
                </div>
            </div>
        </div>
    `;
}


async function showStoreProfile() {
    enterSellerPrivateContext();
    hideAllWalzWorkSections();
    hideSellerApplicationSections();
    hidePublicStoreSection();
    const section = document.getElementById("store-profile-section");
    if (!section) return;
    document.getElementById("marketplace-content")?.style.setProperty("display", "none");
    document.getElementById("orders-section")?.style.setProperty("display", "none");
    document.getElementById("sales-orders-section")?.style.setProperty("display", "none");
    document.getElementById("my-products-section")?.style.setProperty("display", "none");
    document.getElementById("banner-admin-section")?.style.setProperty("display", "none");
    document.getElementById("banner-proposal-section")?.style.setProperty("display", "none");
    section.style.display = "block";
    await loadStoreProfile();
    await loadStorePaymentMethods();
}



function getSellerStoreStatusPresentation(status) {
    const value = String(status || "ACTIVE").trim().toUpperCase();

    const states = {
        ACTIVE: {
            label: "Activa",
            description: "Tu tienda esta visible para los compradores.",
            css: "is-active"
        },
        PAUSED: {
            label: "Pausada",
            description: "Tu tienda no esta visible publicamente. Podes reactivarla cuando quieras.",
            css: "is-paused"
        },
        SUSPENDED: {
            label: "Suspendida por WalZ One",
            description: "La tienda no esta visible publicamente. Podes solicitar su reactivacion.",
            css: "is-suspended"
        },
        UNDER_REVIEW: {
            label: "En revision por WalZ One",
            description: "La tienda esta siendo revisada y no se muestra publicamente.",
            css: "is-review"
        },
        REACTIVATION_REQUESTED: {
            label: "Reactivacion solicitada",
            description: "WalZ One recibio tu solicitud. La tienda continuara sin mostrarse hasta que Central la apruebe.",
            css: "is-requested"
        },
        CLOSED: {
            label: "Cerrada",
            description: "Esta tienda se encuentra cerrada.",
            css: "is-closed"
        }
    };

    return states[value] || {
        label: value || "Estado desconocido",
        description: "Consulta con WalZ One si necesitas asistencia.",
        css: "is-unknown"
    };
}


function renderSellerStoreStatus(store) {
    const panel = document.getElementById("seller-store-status-panel");
    if (!panel) return;

    if (!store || !store.id) {
        panel.style.display = "none";
        panel.innerHTML = "";
        return;
    }

    const status = String(
        store.operational_status || "ACTIVE"
    ).trim().toUpperCase();

    const info = getSellerStoreStatusPresentation(status);

    let action = "";

    if (status === "ACTIVE") {
        action = `
            <button type="button"
                class="seller-store-status-action pause"
                onclick="changeSellerStoreStatus('PAUSED')">
                Pausar temporalmente mi tienda
            </button>
        `;
    }

    if (status === "PAUSED") {
        action = `
            <button type="button"
                class="seller-store-status-action activate"
                onclick="changeSellerStoreStatus('ACTIVE')">
                Reactivar mi tienda
            </button>
        `;
    }

    if (status === "SUSPENDED") {
        action = `
            <button type="button"
                class="seller-store-status-action request"
                onclick="changeSellerStoreStatus('REACTIVATION_REQUESTED')">
                Solicitar reactivacion
            </button>
        `;
    }

    panel.innerHTML = `
        <div class="seller-store-status-heading">
            <div>
                <small>Estado de tu tienda</small>
                <strong class="seller-store-status-badge ${info.css}">
                    ${escapeHtml(info.label)}
                </strong>
            </div>
        </div>

        <p>${escapeHtml(info.description)}</p>

        ${store.status_reason ? `
            <div class="seller-store-status-reason">
                <strong>Motivo / observacion</strong>
                <span>${escapeHtml(store.status_reason)}</span>
            </div>
        ` : ""}

        ${action ? `
            <div class="seller-store-status-actions">
                ${action}
            </div>
        ` : ""}
    `;

    panel.style.display = "block";
}


async function changeSellerStoreStatus(requestedStatus) {
    if (!["VENDEDOR", "SELLER"].includes(currentUserRole)) {
        showMessage("Se requiere una cuenta vendedora.", "error");
        return;
    }

    const status = String(requestedStatus || "").trim().toUpperCase();
    let reason = null;

    if (status === "PAUSED") {
        const confirmed = window.confirm(
            "¿Querés pausar temporalmente tu tienda? Dejaría de mostrarse a los compradores hasta que la reactives."
        );
        if (!confirmed) return;
    }

    if (status === "ACTIVE") {
        const confirmed = window.confirm(
            "¿Querés reactivar tu tienda y volver a mostrarla públicamente?"
        );
        if (!confirmed) return;
    }

    if (status === "REACTIVATION_REQUESTED") {
        reason = window.prompt(
            "Conta brevemente por que solicitas la reactivacion:"
        );

        if (reason === null) return;

        reason = reason.trim();

        if (!reason) {
            showMessage(
                "Es necesario explicar brevemente la solicitud de reactivacion.",
                "error"
            );
            return;
        }
    }

    const currentToken = localStorage.getItem("walz_token");

    try {
        const response = await fetch(`${API_URL}/stores/mine/status`, {
            method: "PATCH",
            headers: {
                Authorization: `Bearer ${currentToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                status,
                reason
            })
        });

        if (response.status === 401) {
            handleExpiredSession();
            return;
        }

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(
                data.detail || "No se pudo cambiar el estado de la tienda."
            );
        }

        window.walzMyStore = data;
        renderSellerStoreStatus(data);

        showMessage("Estado de tu tienda actualizado.", "success");

    } catch (error) {
        console.error("Error cambiando estado de la tienda:", error);
        showMessage(
            error.message || "No se pudo cambiar el estado de la tienda.",
            "error"
        );
    }
}


async function loadStoreProfile() {
    const currentToken = localStorage.getItem("walz_token");
    const errorElement = document.getElementById("store-profile-error");
    if (errorElement) errorElement.textContent = "";
    try {
        const response = await fetch(`${API_URL}/stores/mine`, {
            headers: { Authorization: `Bearer ${currentToken}` }
        });
        const store = await response.json().catch(() => null);
        if (!response.ok) throw new Error(store?.detail || `HTTP ${response.status}`);
        const values = store || {};
        window.walzMyStore = values;
        renderSellerStoreStatus(values);
        const fields = {
            "store-name": values.name || "",
            "store-logo-url": values.logo_url || "",
            "store-description": values.description || "",
            "store-phone": values.phone || "",
            "store-city": values.city || "",
            "store-address": values.address || "",
            "store-avanter-title": values.avanter_title || "",
            "store-avanter-text": values.avanter_text || "",
            "store-avanter-image-url": values.avanter_image_url || ""
        };
        const deliveryInput = document.getElementById("store-delivery-enabled");
        const pickupInput = document.getElementById("store-pickup-enabled");

        const avanterSection =
            document.getElementById("store-avanter-settings");

        if (avanterSection) {
            avanterSection.style.display =
                values.avanter_enabled === true
                    ? ""
                    : "none";
        }

        if (deliveryInput) deliveryInput.checked = values.delivery_enabled !== false;
        if (pickupInput) pickupInput.checked = values.pickup_enabled !== false;
        setStoreBusinessCategoriesForm(values.business_categories || []);
        const textFields = {
        };
        for (const [id, value] of Object.entries({...fields, ...textFields})) {
            const input = document.getElementById(id);
            if (input) input.value = value;
        }
        renderStorePreview();
    } catch (error) {
        if (errorElement) errorElement.textContent = error.message || "No se pudo cargar la tienda.";
        renderStorePreview();
    }
}


const STORE_PAYMENT_METHOD_UI = {
    CASH: {
        enabledId: "store-payment-cash-enabled",
        pickupId: "store-payment-cash-pickup"
    },
    BANK_TRANSFER: {
        enabledId: "store-payment-bank-transfer-enabled",
        pickupId: "store-payment-bank-transfer-pickup",
        holderId: "store-payment-bank-transfer-holder",
        aliasId: "store-payment-bank-transfer-alias",
        cbuCvuId: "store-payment-bank-transfer-cbu-cvu",
        bankId: "store-payment-bank-transfer-bank",
        instructionsId: "store-payment-bank-transfer-instructions"
    },
    CUENTA_DNI: {
        enabledId: "store-payment-cuenta-dni-enabled",
        pickupId: "store-payment-cuenta-dni-pickup"
    },
    MERCADO_PAGO: {
        enabledId: "store-payment-mercado-pago-enabled",
        pickupId: "store-payment-mercado-pago-pickup"
    }
};


function syncStorePaymentPickupAvailability() {
    const storePickupEnabled =
        document.getElementById("store-pickup-enabled")?.checked === true;

    for (const config of Object.values(STORE_PAYMENT_METHOD_UI)) {
        const enabledInput =
            document.getElementById(config.enabledId);

        const pickupInput =
            document.getElementById(config.pickupId);

        if (!enabledInput || !pickupInput) continue;

        const canUsePickup =
            storePickupEnabled && enabledInput.checked;

        pickupInput.disabled = !canUsePickup;

        if (!canUsePickup) {
            pickupInput.checked = false;
        }

        const detailIds = [
            config.holderId,
            config.aliasId,
            config.cbuCvuId,
            config.bankId,
            config.instructionsId
        ].filter(Boolean);

        for (const detailId of detailIds) {
            const detailInput =
                document.getElementById(detailId);

            if (detailInput) {
                detailInput.disabled =
                    !enabledInput.checked;
            }
        }
    }
}


function renderStorePaymentMethods(methods) {
    const rows = Array.isArray(methods) ? methods : [];

    const byMethod = Object.fromEntries(
        rows.map(item => [
            String(item.method || "").trim().toUpperCase(),
            item
        ])
    );

    for (const [method, config] of Object.entries(
        STORE_PAYMENT_METHOD_UI
    )) {
        const values = byMethod[method] || {};

        const enabledInput =
            document.getElementById(config.enabledId);

        const pickupInput =
            document.getElementById(config.pickupId);

        if (enabledInput) {
            enabledInput.checked = values.enabled === true;
        }

        if (pickupInput) {
            pickupInput.checked =
                values.allow_pay_on_pickup === true;
        }

        const detailValues = [
            [config.holderId, values.account_holder],
            [config.aliasId, values.account_alias],
            [config.cbuCvuId, values.account_cbu_cvu],
            [config.bankId, values.bank_name],
            [config.instructionsId, values.instructions]
        ];

        for (const [detailId, detailValue] of detailValues) {
            if (!detailId) continue;

            const detailInput =
                document.getElementById(detailId);

            if (detailInput) {
                detailInput.value =
                    String(detailValue || "");
            }
        }
    }

    syncStorePaymentPickupAvailability();
}


async function loadStorePaymentMethods() {
    const currentToken = localStorage.getItem("walz_token");

    const messageElement =
        document.getElementById("store-payment-methods-message");

    if (messageElement) {
        messageElement.textContent = "";
        messageElement.classList.remove("is-success", "is-error");
    }

    try {
        const response = await fetch(
            `${API_URL}/payments/methods/mine`,
            {
                headers: {
                    Authorization: `Bearer ${currentToken}`
                }
            }
        );

        if (response.status === 401) {
            handleExpiredSession();
            return;
        }

        const data =
            await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(
                data.detail ||
                "No se pudieron cargar las formas de pago."
            );
        }

        renderStorePaymentMethods(data.methods);

    } catch (error) {
        console.error("Error cargando formas de pago:", error);

        if (messageElement) {
            messageElement.textContent =
                error.message ||
                "No se pudieron cargar las formas de pago.";

            messageElement.classList.add("is-error");
        }
    }
}


async function saveStorePaymentMethods() {
    const currentToken = localStorage.getItem("walz_token");

    const messageElement =
        document.getElementById("store-payment-methods-message");

    const saveButton =
        document.getElementById("store-payment-methods-save-button");

    if (messageElement) {
        messageElement.textContent = "";
        messageElement.classList.remove("is-success", "is-error");
    }

    const methods = Object.entries(
        STORE_PAYMENT_METHOD_UI
    ).map(([method, config]) => {
        const enabledInput =
            document.getElementById(config.enabledId);

        const pickupInput =
            document.getElementById(config.pickupId);

        const readValue = id => {
            if (!id) return null;

            const value = String(
                document.getElementById(id)?.value || ""
            ).trim();

            return value || null;
        };

        return {
            method,
            enabled: enabledInput?.checked === true,
            allow_pay_on_pickup:
                pickupInput?.checked === true,
            account_holder:
                readValue(config.holderId),
            account_alias:
                readValue(config.aliasId),
            account_cbu_cvu:
                readValue(config.cbuCvuId),
            bank_name:
                readValue(config.bankId),
            instructions:
                readValue(config.instructionsId)
        };
    });

    if (!methods.some(item => item.enabled)) {
        const message =
            "Elegí al menos una forma de pago.";

        if (messageElement) {
            messageElement.textContent = message;
            messageElement.classList.add("is-error");
        }

        showMessage(message, "error");
        return;
    }

    if (saveButton) {
        saveButton.disabled = true;
        saveButton.textContent = "Guardando...";
    }

    try {
        const response = await fetch(
            `${API_URL}/payments/methods/mine`,
            {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${currentToken}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ methods })
            }
        );

        if (response.status === 401) {
            handleExpiredSession();
            return;
        }

        const data =
            await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(
                data.detail ||
                "No se pudieron guardar las formas de pago."
            );
        }

        renderStorePaymentMethods(data.methods);

        const message =
            "Formas de pago guardadas correctamente.";

        if (messageElement) {
            messageElement.textContent = message;
            messageElement.classList.add("is-success");
        }

        showMessage(message, "success");

    } catch (error) {
        console.error("Error guardando formas de pago:", error);

        const message =
            error.message ||
            "No se pudieron guardar las formas de pago.";

        if (messageElement) {
            messageElement.textContent = message;
            messageElement.classList.add("is-error");
        }

        showMessage(message, "error");

    } finally {
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.textContent =
                "Guardar formas de pago";
        }
    }
}


async function saveStoreProfile(event) {
    event?.preventDefault();
    const currentToken = localStorage.getItem("walz_token");
    const errorElement = document.getElementById("store-profile-error");
    const saveButton = document.getElementById("store-save-button");
    const value = id => document.getElementById(id)?.value.trim() || "";
    const name = value("store-name");
    let logoUrl = value("store-logo-url");
    const logoFileInput = document.getElementById("store-logo-file");
    const logoFile = logoFileInput?.files?.[0] || null;
    if (errorElement) {
        errorElement.textContent = "";
        errorElement.classList.remove("store-profile-success-message");
    }
    const businessCategories = getStoreBusinessCategoriesFromForm();
    const deliveryEnabled = Boolean(document.getElementById("store-delivery-enabled")?.checked);
    const pickupEnabled = Boolean(document.getElementById("store-pickup-enabled")?.checked);

    if (!businessCategories.length) {
        if (errorElement) errorElement.textContent = "Selecciona al menos un rubro para tu tienda.";
        return;
    }

    if (businessCategories.length > 8) {
        if (errorElement) errorElement.textContent = "Podes seleccionar hasta 8 rubros por tienda.";
        return;
    }
    if (!deliveryEnabled && !pickupEnabled) {
        if (errorElement) errorElement.textContent = "Selecciona al menos una forma de entrega.";
        return;
    }
    if (name.length < 2) {
        if (errorElement) errorElement.textContent = "Completa el nombre de la tienda.";
        return;
    }
    if (logoUrl && !getProductImageUrl(logoUrl)) {
        if (errorElement) errorElement.textContent = "El enlace del logo debe comenzar con http:// o https://";
        return;
    }
    if (saveButton) saveButton.disabled = true;
    try {
        if (logoFile) {
            if (saveButton) saveButton.textContent = "Subiendo logo...";
            logoUrl = await uploadStoreLogo(logoFile);
        }
        if (saveButton) saveButton.textContent = "Guardando tienda...";
        const response = await fetch(`${API_URL}/stores/mine`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentToken}` },
            body: JSON.stringify({
                name,
                logo_url: logoUrl || null,
                description: value("store-description") || null,
                phone: value("store-phone") || null,
                city: value("store-city") || null,
                address: value("store-address") || null,
                business_categories: businessCategories,
                avanter_title: value("store-avanter-title") || null,
                avanter_text: value("store-avanter-text") || null,
                avanter_image_url: value("store-avanter-image-url") || null,
                delivery_enabled: deliveryEnabled,
                pickup_enabled: pickupEnabled
            })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || `HTTP ${response.status}`);
        document.getElementById("store-logo-url").value = data.logo_url || logoUrl || "";
        if (logoFileInput) logoFileInput.value = "";
        const logoFileName = document.getElementById("store-logo-file-name");
        if (logoFileName) logoFileName.textContent = "Logo guardado en WalZ";
        if (window.walzStoreLogoPreviewUrl) URL.revokeObjectURL(window.walzStoreLogoPreviewUrl);
        window.walzStoreLogoPreviewUrl = "";
        showMessage("Tienda guardada correctamente.", "success");
        if (errorElement) {
            errorElement.textContent = "Tienda guardada correctamente.";
            errorElement.classList.add("store-profile-success-message");
        }
        renderStorePreview();
    } catch (error) {
        if (errorElement) {
            errorElement.classList.remove("store-profile-success-message");
            errorElement.textContent = error.message || "No se pudo guardar la tienda.";
        }
    } finally {
        if (saveButton) { saveButton.disabled = false; saveButton.textContent = "Guardar tienda"; }
    }
}


function hideBannerAdminSection() {
    const section = document.getElementById("banner-admin-section");
    if (section) section.style.display = "none";
}


function hideBannerProposalSection() {
    const section = document.getElementById("banner-proposal-section");
    if (section) section.style.display = "none";
}


function getBannerProposalStatus(status, isActive = null) {
    const value = String(status || "pending").toLowerCase();

    if (value === "approved") {
        if (isActive === true) {
            return { label: "Aprobada y publicada", css: "approved" };
        }

        if (isActive === false) {
            return { label: "Aprobada - pausada", css: "pending" };
        }

        return { label: "Aprobada", css: "approved" };
    }

    if (value === "rejected") {
        return { label: "Rechazada", css: "rejected" };
    }

    return { label: "Pendiente de revision", css: "pending" };
}


async function showBannerProposal() {
    enterSellerPrivateContext();
    hideSellerApplicationSections();
    hidePublicStoreSection();
    hideStoreProfileSection();
    const section = document.getElementById("banner-proposal-section");
    if (!section) return;
    document.getElementById("marketplace-content")?.style.setProperty("display", "none");
    document.getElementById("orders-section")?.style.setProperty("display", "none");
    document.getElementById("sales-orders-section")?.style.setProperty("display", "none");
    document.getElementById("my-products-section")?.style.setProperty("display", "none");
    hideBannerProposalSection();
    hideBannerAdminSection();
    section.style.display = "block";
    await Promise.all([loadBannerProposalProducts(), loadMyBannerProposals()]);
}


async function loadBannerProposalProducts() {
    const select = document.getElementById("banner-proposal-product");
    const currentToken = localStorage.getItem("walz_token");
    if (!select) return;
    try {
        const response = await fetch(`${API_URL}/products/mine`, {
            headers: { Authorization: `Bearer ${currentToken}` }
        });
        const products = await response.json().catch(() => ([]));
        if (!response.ok) throw new Error(products.detail || `HTTP ${response.status}`);
        const activeProducts = (Array.isArray(products) ? products : []).filter(product => product.is_active);
        select.innerHTML = activeProducts.length
            ? `<option value="">Selecciona un producto</option>${activeProducts.map(product => `<option value="${escapeHtml(String(product.id))}">${escapeHtml(product.name || "Producto")}</option>`).join("")}`
            : '<option value="">No tenes productos activos</option>';
    } catch (error) {
        select.innerHTML = '<option value="">No se pudieron cargar</option>';
    }
}


async function uploadBannerImage(file) {
    const blob = await optimizeProductImage(file);
    const form = new FormData();
    form.append("image", blob, "banner.webp");
    const response = await fetch(`${API_URL}/banners/images`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("walz_token")}` },
        body: form
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || "No se pudo subir el banner.");
    return data.image_url;
}


async function submitBannerProposal() {
    const currentToken = localStorage.getItem("walz_token");
    const errorElement = document.getElementById("banner-proposal-error");
    const productId = document.getElementById("banner-proposal-product")?.value || "";
    const title = document.getElementById("banner-proposal-title")?.value.trim() || "";
    const subtitle = document.getElementById("banner-proposal-subtitle")?.value.trim() || "";
    let imageUrl = document.getElementById("banner-proposal-image")?.value.trim() || "";
    const imageFile = document.getElementById("banner-proposal-image-file")?.files?.[0];
    if (errorElement) errorElement.textContent = "";
    if (!productId || !title || (!imageFile && !getProductImageUrl(imageUrl))) {
        if (errorElement) errorElement.textContent = "Selecciona el producto, completa el titulo y elige una imagen.";
        return;
    }
    try {
        if (imageFile) imageUrl = await uploadBannerImage(imageFile);
        const response = await fetch(`${API_URL}/banners/proposals`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${currentToken}`
            },
            body: JSON.stringify({
                product_id: productId,
                title,
                subtitle: subtitle || null,
                image_url: imageUrl
            })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || `HTTP ${response.status}`);
        showMessage("Propuesta enviada para revision.", "success");
        for (const id of ["banner-proposal-title", "banner-proposal-subtitle", "banner-proposal-image"]) {
            const input = document.getElementById(id);
            if (input) input.value = "";
        }
        const proposalFile = document.getElementById("banner-proposal-image-file");
        if (proposalFile) proposalFile.value = "";
        const select = document.getElementById("banner-proposal-product");
        if (select) select.value = "";
        await loadMyBannerProposals();
    } catch (error) {
        if (errorElement) errorElement.textContent = error.message || "No se pudo enviar la propuesta.";
    }
}


async function loadMyBannerProposals() {
    const container = document.getElementById("banner-proposal-list");
    const currentToken = localStorage.getItem("walz_token");
    if (!container) return;
    container.innerHTML = "Cargando propuestas...";
    try {
        const response = await fetch(`${API_URL}/banners/proposals/mine`, {
            headers: { Authorization: `Bearer ${currentToken}` }
        });
        const proposals = await response.json().catch(() => ([]));
        if (!response.ok) throw new Error(proposals.detail || `HTTP ${response.status}`);
        if (!Array.isArray(proposals) || proposals.length === 0) {
            container.innerHTML = '<div class="orders-state-card">Todavia no enviaste propuestas.</div>';
            return;
        }
        container.innerHTML = `<div class="banner-admin-list">${proposals.map(proposal => {
            const state = getBannerProposalStatus(
                proposal.approval_status,
                proposal.is_active
            );
            return `<article class="banner-admin-card banner-proposal-card">
                ${renderProductImage(proposal.image_url, proposal.title, "banner-admin-image")}
                <div>
                    <h3>${escapeHtml(proposal.title || "")}</h3>
                    <p>${escapeHtml(proposal.subtitle || "Sin texto adicional")}</p>
                    <span class="banner-review-state ${state.css}">${state.label}</span>

                    ${proposal.review_note ? `
                        <p class="banner-review-note">
                            <strong>Observacion de WalZ One:</strong>
                            ${escapeHtml(proposal.review_note)}
                        </p>
                    ` : ""}
                </div>
            </article>`;
        }).join("")}</div>`;
    } catch (error) {
        container.innerHTML = `<div class="orders-state-card orders-error">${escapeHtml(error.message || "No se pudieron cargar las propuestas.")}</div>`;
    }
}


function showBannerAdmin() {
    hideSellerApplicationSections();
    hidePublicStoreSection();
    hideStoreProfileSection();
    if (currentUserRole !== "ADMIN") {
        showMessage("Se requiere una cuenta administradora.", "error");
        return;
    }

    document.getElementById("admin-central-section")?.style.setProperty("display", "none");
    document.getElementById("marketplace-content")?.style.setProperty("display", "none");
    document.getElementById("orders-section")?.style.setProperty("display", "none");
    document.getElementById("sales-orders-section")?.style.setProperty("display", "none");
    document.getElementById("my-products-section")?.style.setProperty("display", "none");
    hideBannerProposalSection();
    const section = document.getElementById("banner-admin-section");
    if (section) section.style.display = "block";
    window.scrollTo(0, 0);
    loadAdminBanners();
}


function bannerDateToIso(inputId) {
    const value = document.getElementById(inputId)?.value || "";
    return value ? new Date(value).toISOString() : null;
}

function cancelAdminBannerEdit() {
    window.walzEditingBannerId = null;

    for (const id of [
        "banner-title",
        "banner-subtitle",
        "banner-image-url",
        "banner-link-url",
        "banner-button-text",
        "banner-starts-at",
        "banner-ends-at"
    ]) {
        const input = document.getElementById(id);
        if (input) input.value = "";
    }

    const imageFile = document.getElementById("banner-image-file");
    if (imageFile) imageFile.value = "";

    const orderInput = document.getElementById("banner-display-order");
    if (orderInput) orderInput.value = "0";

    const activeInput = document.getElementById("banner-is-active");
    if (activeInput) activeInput.checked = true;

    const placementInput = document.getElementById("banner-placement");
    if (placementInput) placementInput.value = "CENTRAL_MARKETPLACE";

    const audienceInput = document.getElementById("banner-audience");
    if (audienceInput) audienceInput.value = "PUBLIC";

    const styleInput = document.getElementById("banner-style-variant");
    if (styleInput) styleInput.value = "STANDARD";

    const motionInput = document.getElementById("banner-motion-variant");
    if (motionInput) motionInput.value = "STATIC";

    const submitButton = document.getElementById("banner-admin-submit-button");
    if (submitButton) submitButton.textContent = "Crear banner";

    const cancelButton = document.getElementById("banner-admin-cancel-edit-button");
    if (cancelButton) cancelButton.style.display = "none";

    const errorElement = document.getElementById("banner-admin-error");
    if (errorElement) errorElement.textContent = "";
}


function bannerDateToLocalInput(value) {
    if (!value) return "";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    const offsetMs = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offsetMs)
        .toISOString()
        .slice(0, 16);
}

function editAdminBanner(bannerId) {
    const banner = (Array.isArray(window.walzAdminBanners)
        ? window.walzAdminBanners
        : []
    ).find(item => String(item.id) === String(bannerId));

    if (!banner || banner.seller_id) {
        showMessage("La campana Central no esta disponible para editar.", "error");
        return;
    }

    window.walzEditingBannerId = String(banner.id);

    const values = {
        "banner-title": banner.title || "",
        "banner-subtitle": banner.subtitle || "",
        "banner-image-url": banner.image_url || "",
        "banner-link-url": banner.link_url || "",
        "banner-button-text": banner.button_text || "",
        "banner-display-order": String(Number(banner.display_order || 0)),
        "banner-starts-at": bannerDateToLocalInput(banner.starts_at),
        "banner-ends-at": bannerDateToLocalInput(banner.ends_at),
        "banner-placement": banner.placement || "CENTRAL_MARKETPLACE",
        "banner-audience": banner.audience || "PUBLIC",
        "banner-style-variant": banner.style_variant || "STANDARD",
        "banner-motion-variant": banner.motion_variant || "STATIC"
    };

    for (const [id, value] of Object.entries(values)) {
        const input = document.getElementById(id);
        if (input) input.value = value;
    }

    const imageFile = document.getElementById("banner-image-file");
    if (imageFile) imageFile.value = "";

    const activeInput = document.getElementById("banner-is-active");
    if (activeInput) activeInput.checked = banner.is_active === true;

    const submitButton = document.getElementById("banner-admin-submit-button");
    if (submitButton) submitButton.textContent = "Guardar cambios";

    const cancelButton = document.getElementById("banner-admin-cancel-edit-button");
    if (cancelButton) cancelButton.style.display = "";

    const errorElement = document.getElementById("banner-admin-error");
    if (errorElement) errorElement.textContent = "";

    document.getElementById("banner-admin-section")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function createAdminBanner() {
    const currentToken = localStorage.getItem("walz_token");
    const errorElement = document.getElementById("banner-admin-error");
    const title = document.getElementById("banner-title")?.value.trim() || "";
    const subtitle = document.getElementById("banner-subtitle")?.value.trim() || "";
    let imageUrl = document.getElementById("banner-image-url")?.value.trim() || "";
    const imageFile = document.getElementById("banner-image-file")?.files?.[0];
    const linkUrl = document.getElementById("banner-link-url")?.value.trim() || "";
    const buttonText = document.getElementById("banner-button-text")?.value.trim() || "";
    const displayOrder = Number(document.getElementById("banner-display-order")?.value || 0);
    const isActive = Boolean(document.getElementById("banner-is-active")?.checked);
    const placement =
        document.getElementById("banner-placement")?.value
        || "CENTRAL_MARKETPLACE";
    const audience =
        document.getElementById("banner-audience")?.value
        || "PUBLIC";
    const styleVariant =
        document.getElementById("banner-style-variant")?.value
        || "STANDARD";
    const motionVariant =
        document.getElementById("banner-motion-variant")?.value
        || "STATIC";

    if (errorElement) errorElement.textContent = "";

    if (!title) {
        if (errorElement) {
            errorElement.textContent =
                "Completa el titulo.";
        }
        return;
    }

    const requiresImage =
        placement !== "BOTTOM_BAR";

    if (
        requiresImage
        && !imageFile
        && !getProductImageUrl(imageUrl)
    ) {
        if (errorElement) {
            errorElement.textContent =
                "Los banners graficos requieren una imagen.";
        }
        return;
    }

    try {
        if (imageFile) imageUrl = await uploadBannerImage(imageFile);
        const editingBannerId =
            String(window.walzEditingBannerId || "").trim();

        const response = await fetch(
            editingBannerId
                ? `${API_URL}/banners/${editingBannerId}`
                : `${API_URL}/banners/`,
            {
                method: editingBannerId ? "PATCH" : "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${currentToken}`
                },
                body: JSON.stringify({
                    title,
                    subtitle: subtitle || null,
                    image_url:
                        getProductImageUrl(imageUrl) || null,
                    link_url: getSafeBannerLink(linkUrl) || null,
                    button_text: buttonText || null,
                    is_active: isActive,
                    starts_at: bannerDateToIso("banner-starts-at"),
                    ends_at: bannerDateToIso("banner-ends-at"),
                    display_order: Number.isInteger(displayOrder) && displayOrder >= 0 ? displayOrder : 0,
                    placement,
                    audience,
                    style_variant: styleVariant,
                    motion_variant: motionVariant
                })
            }
        );
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || `HTTP ${response.status}`);

        showMessage(
            editingBannerId
                ? "Campana actualizada correctamente."
                : "Banner creado correctamente.",
            "success"
        );
        for (const id of ["banner-title", "banner-subtitle", "banner-image-url", "banner-link-url", "banner-button-text", "banner-starts-at", "banner-ends-at"]) {
            const input = document.getElementById(id);
            if (input) input.value = "";
        }
        const bannerFile = document.getElementById("banner-image-file");
        if (bannerFile) bannerFile.value = "";

        const placementInput =
            document.getElementById("banner-placement");
        const audienceInput =
            document.getElementById("banner-audience");
        const styleInput =
            document.getElementById("banner-style-variant");
        const motionInput =
            document.getElementById("banner-motion-variant");

        if (placementInput) {
            placementInput.value = "CENTRAL_MARKETPLACE";
        }
        if (audienceInput) {
            audienceInput.value = "PUBLIC";
        }
        if (styleInput) {
            styleInput.value = "STANDARD";
        }
        if (motionInput) {
            motionInput.value = "STATIC";
        }

        const orderInput =
            document.getElementById("banner-display-order");
        if (orderInput) orderInput.value = "0";

        const activeInput =
            document.getElementById("banner-is-active");
        if (activeInput) activeInput.checked = true;

        window.walzEditingBannerId = null;

        const submitButton =
            document.getElementById("banner-admin-submit-button");
        if (submitButton) submitButton.textContent = "Crear banner";

        const cancelButton =
            document.getElementById("banner-admin-cancel-edit-button");
        if (cancelButton) cancelButton.style.display = "none";

        await loadAdminBanners();
        await loadActiveBanners();
        await refreshAdminPendingCounts();
    } catch (error) {
        if (errorElement) errorElement.textContent = error.message || "No se pudo crear el banner.";
    }
}


function getBannerPlacementLabel(placement) {
    const labels = {
        CENTRAL_MARKETPLACE: "Marketplace Central",
        SELLER_SPONSORED: "Publicidad de vendedor",
        BOTTOM_BAR: "Barra inferior"
    };

    return labels[String(placement || "").toUpperCase()]
        || String(placement || "Sin ubicacion");
}


function getBannerAudienceLabel(audience) {
    const labels = {
        PUBLIC: "Visitantes y compradores",
        BUYER: "Solo compradores",
        SELLER: "Vendedores"
    };

    return labels[String(audience || "").toUpperCase()]
        || String(audience || "Sin publico");
}

function getBannerMotionLabel(motionVariant) {
    const labels = {
        STATIC: "Fijo",
        FADE: "Desvanecer",
        SLIDE: "Deslizar"
    };

    return labels[String(motionVariant || "STATIC").toUpperCase()]
        || "Fijo";
}


function renderAdminBannerCard(banner) {
    const isSellerBanner =
        Boolean(banner?.seller_id);

    const placement =
        String(
            banner?.placement
            || (
                isSellerBanner
                    ? "SELLER_SPONSORED"
                    : "CENTRAL_MARKETPLACE"
            )
        ).toUpperCase();

    const imageHtml =
        banner?.image_url
            ? renderProductImage(
                banner.image_url,
                banner.title,
                "banner-admin-image"
            )
            : "";

    const state =
        isSellerBanner
            ? getBannerProposalStatus(
                banner.approval_status
            )
            : null;

    const statusHtml =
        isSellerBanner
            ? `
                <span class="banner-review-state ${state.css}">
                    ${state.label}
                </span>
            `
            : `
                <span class="my-product-state ${banner.is_active ? "active" : "paused"}">
                    ${banner.is_active ? "Activo" : "Pausado"}
                </span>
            `;

    const sellerApprovalStatus =
        String(banner?.approval_status || "")
            .trim()
            .toLowerCase();

    const actionsHtml =
        isSellerBanner
            ? (
                sellerApprovalStatus === "pending"
                    ? `
                        <div class="banner-review-actions">
                            <textarea
                                id="banner-review-note-${escapeHtml(String(banner.id))}"
                                maxlength="1200"
                                placeholder="Observacion para el vendedor (opcional al aprobar)"
                            ></textarea>

                            <p
                                id="banner-review-error-${escapeHtml(String(banner.id))}"
                                class="delivery-error"
                                role="alert"
                            ></p>

                            <button
                                type="button"
                                onclick="reviewBannerProposal(
                                    '${escapeJs(String(banner.id))}',
                                    'approved'
                                )"
                            >
                                Aprobar
                            </button>

                            <button
                                type="button"
                                class="seller-cancel-button"
                                onclick="reviewBannerProposal(
                                    '${escapeJs(String(banner.id))}',
                                    'rejected'
                                )"
                            >
                                Rechazar
                            </button>
                        </div>
                    `
                    : sellerApprovalStatus === "approved"
                        ? `
                            <button
                                type="button"
                                onclick="toggleAdminBanner(
                                    '${escapeJs(String(banner.id))}',
                                    ${banner.is_active ? "false" : "true"}
                                )"
                            >
                                ${banner.is_active ? "Pausar" : "Activar"}
                            </button>
                        `
                        : ""
            )
            : `
                <div class="banner-review-actions">
                    <button
                        type="button"
                        onclick="editAdminBanner(
                            '${escapeJs(String(banner.id))}'
                        )"
                    >
                        Editar
                    </button>

                    <button
                        type="button"
                        onclick="toggleAdminBanner(
                            '${escapeJs(String(banner.id))}',
                            ${banner.is_active ? "false" : "true"}
                        )"
                    >
                        ${banner.is_active ? "Pausar" : "Activar"}
                    </button>
                </div>
            `;


    const cardClass =
        banner?.image_url
            ? "banner-admin-card"
            : "banner-admin-card banner-admin-card-no-image";

    return `
        <article class="${cardClass}">
            ${imageHtml}

            <div>
                <h3>${escapeHtml(banner.title || "")}</h3>

                <p>
                    ${escapeHtml(
                        banner.subtitle || "Sin texto adicional"
                    )}
                </p>

                ${isSellerBanner ? `
                    <p>
                        <strong>Tienda:</strong>
                        ${escapeHtml(banner.store_name || "Sin tienda identificada")}
                        &middot;
                        <strong>Vendedor:</strong>
                        ${escapeHtml(banner.seller_name || banner.seller_email || "Sin identificar")}
                    </p>
                    <p>
                        <strong>Producto:</strong>
                        ${escapeHtml(
                            banner.product_name
                            || (banner.product_id ? "Producto no disponible" : "Publicidad anterior sin producto asociado")
                        )}
                    </p>
                ` : ""}

                <p>
                    <strong>Ubicacion:</strong>
                    ${escapeHtml(
                        getBannerPlacementLabel(placement)
                    )}
                    &middot;
                    <strong>Publico:</strong>
                    ${escapeHtml(
                        getBannerAudienceLabel(
                            banner.audience
                        )
                    )}
                    &middot;
                    <strong>Movimiento:</strong>
                    ${escapeHtml(
                        getBannerMotionLabel(
                            banner.motion_variant
                        )
                    )}
                </p>

                ${statusHtml}
            </div>

            ${actionsHtml}
        </article>
    `;
}


function renderAdminBannerGroup(
    title,
    description,
    banners
) {
    const rows =
        Array.isArray(banners)
            ? banners
            : [];

    return `
        <section class="banner-admin-group">
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(description)}</p>

            ${
                rows.length
                    ? `
                        <div class="banner-admin-list">
                            ${rows
                                .map(renderAdminBannerCard)
                                .join("")}
                        </div>
                    `
                    : `
                        <div class="orders-state-card">
                            No hay publicaciones en este espacio.
                        </div>
                    `
            }
        </section>
    `;
}


async function loadAdminBanners() {
    const container =
        document.getElementById("banner-admin-list");

    const currentToken =
        localStorage.getItem("walz_token");

    if (!container) return;

    container.innerHTML =
        "Cargando banners...";

    try {
        const response = await fetch(
            `${API_URL}/banners/admin`,
            {
                headers: {
                    Authorization:
                        `Bearer ${currentToken}`
                }
            }
        );

        const banners = await response
            .json()
            .catch(() => ([]));

        if (!response.ok) {
            throw new Error(
                banners.detail
                || `HTTP ${response.status}`
            );
        }

        if (
            !Array.isArray(banners)
            || banners.length === 0
        ) {
            window.walzAdminBanners = [];
            container.innerHTML =
                '<div class="orders-state-card">Todavia no hay banners.</div>';
            return;
        }

        window.walzAdminBanners = banners;

        const centralMarketplace =
            banners.filter(
                banner =>
                    !banner.seller_id
                    && String(
                        banner.placement
                        || "CENTRAL_MARKETPLACE"
                    ).toUpperCase()
                        === "CENTRAL_MARKETPLACE"
            );

        const bottomBars =
            banners.filter(
                banner =>
                    !banner.seller_id
                    && String(
                        banner.placement || ""
                    ).toUpperCase()
                        === "BOTTOM_BAR"
            );

        const sellerSponsored =
            banners.filter(
                banner =>
                    Boolean(banner.seller_id)
            );

        container.innerHTML = `
            ${renderAdminBannerGroup(
                "WalZ One Central - Marketplace",
                "Campanas propias de WalZ One en el Marketplace Central.",
                centralMarketplace
            )}

            ${renderAdminBannerGroup(
                "WalZ One Central - Barra inferior",
                "Avisos institucionales o comerciales de la franja inferior.",
                bottomBars
            )}

            ${renderAdminBannerGroup(
                "Publicidad de vendedores",
                "Propuestas comerciales de vendedores, separadas del inventario propio de WalZ One.",
                sellerSponsored
            )}
        `;

    } catch (error) {
        container.innerHTML = `
            <div class="orders-state-card orders-error">
                ${escapeHtml(
                    error.message
                    || "No se pudieron cargar los banners."
                )}
            </div>
        `;
    }
}


async function reviewBannerProposal(bannerId, status) {
    const action = status === "approved" ? "aprobar" : "rechazar";
    const reviewNote =
        document.getElementById(`banner-review-note-${bannerId}`)
            ?.value.trim() || "";

    const reviewError =
        document.getElementById(`banner-review-error-${bannerId}`);

    if (reviewError) reviewError.textContent = "";

    if (status === "rejected" && !reviewNote) {
        if (reviewError) {
            reviewError.textContent =
                "Escribi el motivo del rechazo para que el vendedor pueda corregir la propuesta.";
        }
        return;
    }

    if (!confirm(`Confirmas que queres ${action} esta publicidad?`)) return;
    const currentToken = localStorage.getItem("walz_token");
    try {
        const response = await fetch(`${API_URL}/banners/${bannerId}/review`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentToken}` },
            body: JSON.stringify({
                status,
                review_note: reviewNote || null
            })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || `HTTP ${response.status}`);
        showMessage(status === "approved" ? "Publicidad aprobada y publicada." : "Publicidad rechazada.", "success");
        const bannerFile = document.getElementById("banner-image-file");
        if (bannerFile) bannerFile.value = "";
        await loadAdminBanners();
        await loadActiveBanners();
        await refreshAdminPendingCounts();
    } catch (error) {
        showMessage(error.message || "No se pudo revisar la publicidad.", "error");
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
        const bannerFile = document.getElementById("banner-image-file");
        if (bannerFile) bannerFile.value = "";
        await loadAdminBanners();
        await loadActiveBanners();
        await refreshAdminPendingCounts();
    } catch (error) {
        showMessage(error.message || "No se pudo modificar el banner.", "error");
    }
}


async function showWalzNewsBarIfAllowed() {
    const bar =
        document.getElementById("walz-news-bar");

    const track =
        document.getElementById("walz-news-track");

    if (!bar || !track) {
        return;
    }

    const isAdmin =
        currentUserRole === "ADMIN";

    const wasClosed =
        sessionStorage.getItem(
            "walz_news_closed"
        ) === "1";

    const pathParts =
        window.location.pathname
            .split("/")
            .filter(Boolean);

    const isDirectStore =
        pathParts.length === 1;

    if (
        isAdmin
        || wasClosed
        || isDirectStore
    ) {
        bar.style.display = "none";
        track.innerHTML = "";

        document.body.classList.remove(
            "has-walz-news-bar"
        );

        return;
    }

    try {
        const response = await fetch(
            `${API_URL}/banners/active?placement=BOTTOM_BAR`
        );

        if (!response.ok) {
            throw new Error(
                `HTTP ${response.status}`
            );
        }

        const received = await response.json();

        const banners =
            Array.isArray(received)
                ? received.filter(
                    banner =>
                        !banner.seller_id
                        && bannerMatchesCurrentAudience(
                            banner
                        )
                )
                : [];

        const banner =
            banners[0] || null;

        if (!banner) {
            bar.style.display = "none";
            track.innerHTML = "";

            document.body.classList.remove(
                "has-walz-news-bar"
            );

            return;
        }

        const title =
            String(banner.title || "").trim();

        const subtitle =
            String(banner.subtitle || "").trim();

        const message =
            [title, subtitle]
                .filter(Boolean)
                .join(" - ");

        if (!message) {
            bar.style.display = "none";
            track.innerHTML = "";

            document.body.classList.remove(
                "has-walz-news-bar"
            );

            return;
        }

        const safeMessage =
            escapeHtml(message);

        track.innerHTML = `
            <span>${safeMessage}</span>
            <span aria-hidden="true">${safeMessage}</span>
        `;

        bar.dataset.styleVariant =
            String(
                banner.style_variant
                || "STANDARD"
            ).toUpperCase();

        bar.style.display = "flex";

        document.body.classList.add(
            "has-walz-news-bar"
        );

    } catch (error) {
        console.error(
            "No se pudo cargar la barra inferior:",
            error
        );

        bar.style.display = "none";
        track.innerHTML = "";

        document.body.classList.remove(
            "has-walz-news-bar"
        );
    }
}


function closeWalzNewsBar() {
    sessionStorage.setItem("walz_news_closed", "1");
    const bar = document.getElementById("walz-news-bar");
    if (bar) bar.style.display = "none";
    document.body.classList.remove("has-walz-news-bar");
}


// HACER FUNCIONES GLOBALES
// NECESARIO PARA onclick="..."
// =====================================================

window.handleRegister = handleRegister;
window.openTermsModal = openTermsModal;
window.closeTermsModal = closeTermsModal;
window.acceptTermsFromModal = acceptTermsFromModal;
window.handleLogin = handleLogin;
window.handleForgotPassword = handleForgotPassword;
window.showAccountSettings = showAccountSettings;
window.closeMyAccount = closeMyAccount;
window.saveAccountProfile = saveAccountProfile;
window.changeAccountPassword = changeAccountPassword;
window.requestEmailChange = requestEmailChange;
window.showConfirmEmailChange = showConfirmEmailChange;
window.confirmEmailChange = confirmEmailChange;
window.handleResetPassword = handleResetPassword;
window.handleLogout = handleLogout;
window.handleExpiredSession = handleExpiredSession;
window.handleCreateProduct = handleCreateProduct;
window.handleEditProductImageSelection = handleEditProductImageSelection;
window.previewNewProductImage = previewNewProductImage;

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
window.syncVisibleWalzData = syncVisibleWalzData;
window.applyMyOrdersFilters = applyMyOrdersFilters;
window.clearMyOrdersFilters = clearMyOrdersFilters;
window.openOrderDetail = openOrderDetail;
window.showReceivedOrders = showReceivedOrders;
window.loadReceivedOrders = loadReceivedOrders;
window.updateSellerOrderStatus = updateSellerOrderStatus;
window.applyReceivedOrdersFilters = applyReceivedOrdersFilters;
window.clearReceivedOrdersFilters = clearReceivedOrdersFilters;
window.downloadBulkProductsTemplate = downloadBulkProductsTemplate;
window.previewBulkProductsFile = previewBulkProductsFile;
window.publishBulkProducts = publishBulkProducts;
window.showMyProducts = showMyProducts;
window.loadMyProducts = loadMyProducts;
window.applyMyProductsFilters = applyMyProductsFilters;
window.clearMyProductsFilters = clearMyProductsFilters;
window.setMyProductsStatusFilter = setMyProductsStatusFilter;
window.startEditingMyProduct = startEditingMyProduct;
window.cancelEditingMyProduct = cancelEditingMyProduct;
window.saveMyProductChanges = saveMyProductChanges;
window.toggleMyProductStatus = toggleMyProductStatus;
window.deleteMyProduct = deleteMyProduct;
window.refreshAdminPendingCounts = refreshAdminPendingCounts;
window.refreshSellerPendingOrderCount = refreshSellerPendingOrderCount;
window.showSellerApplication = showSellerApplication;
window.submitSellerApplication = submitSellerApplication;
window.showSellerApplicationsAdmin = showSellerApplicationsAdmin;
window.loadSellerApplicationsAdmin = loadSellerApplicationsAdmin;
window.reviewSellerApplication = reviewSellerApplication;
window.showPublicStore = showPublicStore;
window.showStoreProfile = showStoreProfile;
window.loadStoreProfile = loadStoreProfile;
window.saveStoreProfile = saveStoreProfile;
window.loadStorePaymentMethods = loadStorePaymentMethods;
window.saveStorePaymentMethods = saveStorePaymentMethods;
window.syncStorePaymentPickupAvailability = syncStorePaymentPickupAvailability;
window.renderStorePreview = renderStorePreview;
window.showBannerAdmin = showBannerAdmin;
window.showBannerProposal = showBannerProposal;
window.submitBannerProposal = submitBannerProposal;
window.loadMyBannerProposals = loadMyBannerProposals;
window.reviewBannerProposal = reviewBannerProposal;
window.openPromotedProduct = openPromotedProduct;
window.createAdminBanner = createAdminBanner;
window.loadAdminBanners = loadAdminBanners;
window.toggleAdminBanner = toggleAdminBanner;
window.closeWalzNewsBar = closeWalzNewsBar;
window.moveMarketplaceBanner = moveMarketplaceBanner;
window.selectMarketplaceBanner = selectMarketplaceBanner;
window.cancelPendingOrder = cancelPendingOrder;
window.updateBuyerPickupStatus = updateBuyerPickupStatus;
window.reportBuyerPayment = reportBuyerPayment;
window.confirmSellerPickupHandover = confirmSellerPickupHandover;
window.updateSellerPaymentStatus = updateSellerPaymentStatus;

// =====================================================
// NAVEGACION RAPIDA EN PAGINAS LARGAS
// =====================================================

function scrollPageToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function scrollCartToTop() {
    const cartSection = document.getElementById("cart-section");
    if (cartSection) {
        cartSection.scrollTo({ top: 0, behavior: "smooth" });
    }
}

function closeCartAndReturnToMarketplace() {
    const cartSection = document.getElementById("cart-section");
    if (cartSection) cartSection.style.display = "none";
    document.body.classList.remove("cart-panel-open");
    showMarketplaceContent();
    scrollPageToTop();
}

function returnToMarketplaceTop() {
    showMarketplaceContent();
    scrollPageToTop();
}

function updateBackToTopButton() {
    const button = document.getElementById("walz-back-to-top");
    if (!button) return;
    button.classList.toggle("visible", window.scrollY > 500);
}

window.addEventListener("scroll", updateBackToTopButton, { passive: true });
window.scrollPageToTop = scrollPageToTop;
window.scrollCartToTop = scrollCartToTop;
window.closeCartAndReturnToMarketplace = closeCartAndReturnToMarketplace;
window.returnToMarketplaceTop = returnToMarketplaceTop;
window.showMessage = showMessage;

window.showRegister = showRegister;
window.showForgotPassword = showForgotPassword;
window.showResetPassword = showResetPassword;
window.showLogin = showLogin;
window.showAuth = showAuth;
window.showMarketplace = showMarketplace;



function walzSectionIsVisible(id) {
    const section = document.getElementById(id);
    return Boolean(section && section.style.display !== "none");
}

function deliveryResponsibleFormHasDraft() {
    return Array.from(document.querySelectorAll(".delivery-responsible-form input")).some(input => {
        if (input.type === "file") return Boolean(input.files?.length);
        return Boolean(String(input.value || "").trim());
    });
}

async function syncVisibleWalzData(showConfirmation = false) {
    if (document.visibilityState !== "visible") return;
    if (!localStorage.getItem("walz_token")) return;
    try {
        if (walzSectionIsVisible("orders-section")) {
            await loadMyOrders(true);
        } else if (walzSectionIsVisible("sales-orders-section")) {
            if (!document.querySelector(".delivery-plan-form :focus, .delivery-responsible-form :focus") && !deliveryResponsibleFormHasDraft()) await loadReceivedOrders(true);
        } else if (walzSectionIsVisible("my-products-section")) {
            if (!document.querySelector(".my-product-editor")) await loadMyProducts();
        } else if (walzSectionIsVisible("marketplace-content")) {
            await loadProducts();
        }
        if (showConfirmation) showMessage("Informacion actualizada.", "success");
    } catch (error) {
        console.error("No se pudo sincronizar WalZ:", error);
        if (showConfirmation) showMessage("No se pudo actualizar. Verifica la conexion.", "error");
    }
}

function stopWalzDeviceSync() {
    if (window.walzDeviceSyncTimer) clearInterval(window.walzDeviceSyncTimer);
    window.walzDeviceSyncTimer = null;
}

function startWalzDeviceSync() {
    stopWalzDeviceSync();
    window.walzDeviceSyncTimer = setInterval(() => syncVisibleWalzData(false), 20000);
}

document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") syncVisibleWalzData(false);
});
window.addEventListener("focus", () => syncVisibleWalzData(false));
// =====================================================
// INICIO
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        console.log(
            "WalZ app.js cargado correctamente"
        );

        console.log(
            "Token:",
            token ? "EXISTE" : "NO EXISTE"
        );

        // WALZ_LOGIN_KEYBOARD_V1
        for (const fieldId of ["login-email", "login-password"]) {
            document.getElementById(fieldId)?.addEventListener("keydown", event => {
                if (event.key !== "Enter" || event.repeat) return;
                event.preventDefault();
                handleLogin();
            });
        }

        updateCartUI();
        showWalzNewsBarIfAllowed();

        const resetTokenFromUrl = new URLSearchParams(window.location.search).get("reset_token" );
        const emailChangeTokenFromUrl = new URLSearchParams(window.location.search).get("email_change_token" );

        if (emailChangeTokenFromUrl) {
            showAuth();
            showConfirmEmailChange();
        } else if (resetTokenFromUrl) {
            showAuth();
            showResetPassword();
        } else if (
            window.location.pathname.split("/").filter(Boolean).length === 1
        ) {
            const directStoreSlug = window.location.pathname
                .split("/")
                .filter(Boolean)
                .join("/")
                .toLowerCase();
            showMarketplace();
            try {
                const directStoreResponse = await fetch(API_URL + "/stores/slug/" + encodeURIComponent(directStoreSlug));
                const directStore = await directStoreResponse.json().catch(() => ({}));
                if (!directStoreResponse.ok || !directStore.owner_id) {
                    throw new Error(directStore.detail || "Tienda no encontrada.");
                }
                window.walzMarketplaceSellerId =
                    directStore.owner_id;

                showMarketplaceContent(false);

                await loadProducts();
            } catch (error) {
                const section = document.getElementById("public-store-section");
                const container = document.getElementById("public-store-content");
                if (section) section.style.display = "block";
                if (container) container.innerHTML = `<div class="orders-state-card orders-error"><h3>No pudimos abrir la tienda</h3><p>${escapeHtml(error.message || "Intenta nuevamente.")}</p></div>`;
            }
        } else if (token) {
            const renewed = await refreshWalzSession();
            if (!renewed) {
                handleExpiredSession();
                return;
            }
            startWalzSessionRenewal();
            startWalzDeviceSync();

            showMarketplace();
            await loadCurrentUserProfile();
            updateAdminBannerVisibility();

            if (currentUserRole === "ADMIN") {
                showAdminCentralPanel();
            } else {
                loadActiveBanners();
                loadSellerSponsoredBanners();
                loadProducts();
            }
        } else {
            showMarketplace();
            loadProducts();
            loadActiveBanners("CENTRAL_MARKETPLACE");
            loadSellerSponsoredBanners();
        }
    }
);


// WALZ SELLER RUBRO AUTO SCROLL
document.addEventListener(
    "click",
    event => {
        const selected =
            event.target.closest(
                ".walz-macro-card, .walz-subcategory-chip"
            );

        if (!selected) return;

        // Solo en el marketplace particular de una tienda.
        if (
            !document.querySelector(
                ".walz-seller-marketplace-identity"
            )
        ) {
            return;
        }

        setTimeout(() => {
            document
                .getElementById("product-list")
                ?.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });
        }, 80);
    },
    true
);
