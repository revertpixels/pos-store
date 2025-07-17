// =======================================================
// FIREBASE CONFIGURATION
// =======================================================
const firebaseConfig = {
    apiKey: "AIzaSyBVJ80GmEz3urOnyI5kQZX-HhLkzvXzO0E",
    authDomain: "stationery-shop-pos.firebaseapp.com",
    projectId: "stationery-shop-pos",
    storageBucket: "stationery-shop-pos.firebasestorage.app",
    messagingSenderId: "852674564204",
    appId: "1:852674564204:web:8d2f751d1e9a8483c14849",
    measurementId: "G-VE6WB0Q72N"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Enable offline persistence
db.enablePersistence().catch(function(err) {
    if (err.code == 'failed-precondition') {
        console.log('Multiple tabs open, persistence can only be enabled in one tab at a time.');
    } else if (err.code == 'unimplemented') {
        console.log('The current browser does not support all features required for persistence');
    }
});

// =======================================================
// 1. GLOBAL VARIABLES AND INITIAL SETUP
// =======================================================
let products = [];
let nextProductId = 1;
let cart = [];
let cashCounter = 0;
let salesHistory = [];
let notifications = [];
let currentUser = { name: 'Shopkeeper', type: 'shopkeeper' };
let isOwnerLoggedIn = false;
let shopSettings = {
    shopName: 'Stationery Shop & Cyber Cafe',
    openTime: '09:00',
    closeTime: '21:00',
    lowStockThreshold: 10
};
let returnedItems = [];
let currentEditingProduct = null;
let searchResults = [];
let isSearching = false;

// User credentials
const OWNER_PASSWORD = "owner2024";
const SHOPKEEPER_PASSWORD = "shop2024";

// =======================================================
// 2. FIREBASE DATABASE FUNCTIONS
// =======================================================

// Load all data from Firebase
async function loadDataFromFirebase() {
    try {
        showMessage('Loading data from database...', 'info');

        // Load products
        const productsSnapshot = await db.collection('products').get();
        products = [];
        productsSnapshot.forEach(doc => {
            products.push({
                id: doc.id,
                ...doc.data()
            });
        });

        // Load sales history
        const salesSnapshot = await db.collection('sales').orderBy('timestamp', 'desc').get();
        salesHistory = [];
        salesSnapshot.forEach(doc => {
            salesHistory.push({
                id: doc.id,
                ...doc.data()
            });
        });

        // Load cash counter
        const cashSnapshot = await db.collection('settings').doc('cashCounter').get();
        if (cashSnapshot.exists) {
            cashCounter = cashSnapshot.data().amount || 0;
        }

        // Load notifications
        const notificationsSnapshot = await db.collection('notifications').orderBy('timestamp', 'desc').get();
        notifications = [];
        notificationsSnapshot.forEach(doc => {
            notifications.push({
                id: doc.id,
                ...doc.data()
            });
        });

        // Load returned items
        const returnedSnapshot = await db.collection('returnedItems').orderBy('timestamp', 'desc').get();
        returnedItems = [];
        returnedSnapshot.forEach(doc => {
            returnedItems.push({
                id: doc.id,
                ...doc.data()
            });
        });

        // Load shop settings
        const settingsSnapshot = await db.collection('settings').doc('shopSettings').get();
        if (settingsSnapshot.exists) {
            shopSettings = { ...shopSettings, ...settingsSnapshot.data() };
        }

        // Update next product ID
        if (products.length > 0) {
            const maxId = Math.max(...products.map(p => {
                const numericId = parseInt(p.id.replace('prod_', ''));
                return isNaN(numericId) ? 0 : numericId;
            }));
            nextProductId = maxId + 1;
        }

        console.log('All data loaded from Firebase:', {
            products: products.length,
            sales: salesHistory.length,
            cash: cashCounter,
            notifications: notifications.length,
            returned: returnedItems.length
        });

        // Update UI after loading
        updateAllDisplays();
        showMessage('Data loaded successfully!', 'success');

    } catch (error) {
        console.error('Error loading data from Firebase:', error);
        showMessage('Error loading data from database: ' + error.message, 'error');
    }
}

// Save product to Firebase
async function saveProductToFirebase(product) {
    try {
        await db.collection('products').doc(product.id).set(product);
        console.log('Product saved to Firebase:', product.id);

        // Add notification
        await addNotification(`Product "${product.name}" added to inventory`, 'product');

    } catch (error) {
        console.error('Error saving product:', error);
        showMessage('Error saving product to database: ' + error.message, 'error');
        throw error;
    }
}

// Update product in Firebase
async function updateProductInFirebase(productId, updates) {
    try {
        await db.collection('products').doc(productId).update(updates);
        console.log('Product updated in Firebase:', productId);
    } catch (error) {
        console.error('Error updating product:', error);
        showMessage('Error updating product in database: ' + error.message, 'error');
        throw error;
    }
}

// Delete product from Firebase
async function deleteProductFromFirebase(productId) {
    try {
        await db.collection('products').doc(productId).delete();
        console.log('Product deleted from Firebase:', productId);
    } catch (error) {
        console.error('Error deleting product:', error);
        showMessage('Error deleting product from database: ' + error.message, 'error');
        throw error;
    }
}

// Save sale to Firebase
async function saveSaleToFirebase(sale) {
    try {
        await db.collection('sales').add(sale);
        console.log('Sale saved to Firebase');
    } catch (error) {
        console.error('Error saving sale:', error);
        showMessage('Error saving sale to database: ' + error.message, 'error');
        throw error;
    }
}

// Update cash counter in Firebase
async function updateCashCounterInFirebase(amount) {
    try {
        await db.collection('settings').doc('cashCounter').set({
            amount: amount,
            lastUpdated: new Date().toISOString(),
            updatedBy: currentUser.name
        });
        console.log('Cash counter updated in Firebase:', amount);
    } catch (error) {
        console.error('Error updating cash counter:', error);
        showMessage('Error updating cash counter in database: ' + error.message, 'error');
        throw error;
    }
}

// Add notification to Firebase
async function addNotification(message, type = 'info') {
    const notification = {
        id: Date.now().toString(),
        message: message,
        type: type,
        timestamp: new Date().toISOString(),
        read: false,
        user: currentUser.name
    };

    try {
        await db.collection('notifications').add(notification);
        notifications.unshift(notification);
        updateNotificationDisplay();
        console.log('Notification added:', message);
    } catch (error) {
        console.error('Error saving notification:', error);
    }
}

// Save returned item to Firebase
async function saveReturnedItemToFirebase(returnedItem) {
    try {
        await db.collection('returnedItems').add(returnedItem);
        console.log('Returned item saved to Firebase');
    } catch (error) {
        console.error('Error saving returned item:', error);
        showMessage('Error saving returned item to database: ' + error.message, 'error');
        throw error;
    }
}

// Save shop settings to Firebase
async function saveShopSettingsToFirebase(settings) {
    try {
        await db.collection('settings').doc('shopSettings').set(settings);
        console.log('Shop settings saved to Firebase');
    } catch (error) {
        console.error('Error saving shop settings:', error);
        showMessage('Error saving shop settings to database: ' + error.message, 'error');
        throw error;
    }
}

// =======================================================
// 3. CLOCK AND TIME FUNCTIONS
// =======================================================

function updateDateTime() {
    const now = new Date();

    // Update date
    const dateOptions = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    };
    const dateString = now.toLocaleDateString('en-US', dateOptions);

    // Update time
    const timeOptions = {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    };
    const timeString = now.toLocaleTimeString('en-US', timeOptions);

    // Update DOM elements
    const dateElement = document.getElementById('date-text');
    const timeElement = document.getElementById('time-text');

    if (dateElement) dateElement.textContent = dateString;
    if (timeElement) timeElement.textContent = timeString;
}

function updateShopStatus() {
    const now = new Date();
    const currentTime = now.getHours() * 100 + now.getMinutes(); // Convert to HHMM format

    const openTime = parseInt(shopSettings.openTime.replace(':', ''));
    const closeTime = parseInt(shopSettings.closeTime.replace(':', ''));

    const statusIcon = document.querySelector('#shop-status i');
    const statusText = document.getElementById('status-text');

    if (currentTime >= openTime && currentTime < closeTime) {
        // Shop is open
        if (statusIcon) {
            statusIcon.className = 'fas fa-store';
            statusIcon.style.color = '#4CAF50';
        }
        if (statusText) statusText.textContent = 'OPEN';
    } else {
        // Shop is closed
        if (statusIcon) {
            statusIcon.className = 'fas fa-store-slash';
            statusIcon.style.color = '#f44336';
        }
        if (statusText) statusText.textContent = 'CLOSED';
    }
}

function startClock() {
    updateDateTime();
    updateShopStatus();
    setInterval(() => {
        updateDateTime();
        updateShopStatus();
    }, 1000);
}

// =======================================================
// 4. HELPER FUNCTIONS
// =======================================================

function generateProductId() {
    const id = `prod_${String(nextProductId).padStart(3, '0')}`;
    nextProductId++;
    return id;
}

function createMessageBox() {
    const div = document.createElement('div');
    div.id = 'message-box';
    div.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background-color: #333;
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        z-index: 10000;
        display: none;
        opacity: 0;
        transition: all 0.3s ease-in-out;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        font-size: 14px;
        font-weight: 500;
        max-width: 400px;
        text-align: center;
    `;
    return div;
}

function showMessage(message, type = 'info') {
    const messageBox = document.getElementById('message-box') || createMessageBox();
    if (!document.getElementById('message-box')) {
        document.body.appendChild(messageBox);
    }

    messageBox.textContent = message;
    let bgColor = '#333';
    if (type === 'success') bgColor = '#4CAF50';
    else if (type === 'error') bgColor = '#f44336';
    else if (type === 'info') bgColor = '#2196F3';
    else if (type === 'warning') bgColor = '#ff9800';

    messageBox.style.backgroundColor = bgColor;
    messageBox.style.display = 'block';
    messageBox.offsetWidth;
    messageBox.style.opacity = '1';

    setTimeout(() => {
        messageBox.style.opacity = '0';
        setTimeout(() => {
            messageBox.style.display = 'none';
        }, 300);
    }, 3000);
}

function formatCurrency(amount) {
    return `₹${parseFloat(amount).toFixed(2)}`;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function validateInput(value, type = 'text') {
    if (type === 'number') {
        const num = parseFloat(value);
        return !isNaN(num) && num >= 0;
    }
    return value && value.trim().length > 0;
}

function sanitizeInput(input) {
    return input.trim().replace(/[<>]/g, '');
}

// =======================================================
// 5. PRODUCT MANAGEMENT FUNCTIONS
// =======================================================

async function addProduct() {
    const name = sanitizeInput(document.getElementById('product-name').value);
    const singleBarcode = document.getElementById('single-barcode').value.trim();
    const singlePrice = parseFloat(document.getElementById('single-price').value);
    const bulkBarcode = document.getElementById('bulk-barcode').value.trim();
    const bulkPrice = parseFloat(document.getElementById('bulk-price').value);
    const bulkQuantity = parseInt(document.getElementById('bulk-quantity').value);
    const initialStock = parseInt(document.getElementById('initial-stock').value);
    const initialBoxes = parseInt(document.getElementById('initial-boxes').value) || 0;

    // Validation
    if (!validateInput(name) || !validateInput(singlePrice, 'number') ||
        !validateInput(bulkPrice, 'number') || !validateInput(bulkQuantity, 'number') ||
        !validateInput(initialStock, 'number') || !singleBarcode || !bulkBarcode) {
        showMessage('Please fill all required fields with valid values', 'error');
        return;
    }

    if (singleBarcode === bulkBarcode) {
        showMessage('Single and bulk barcodes must be different', 'error');
        return;
    }

    // Check if barcodes already exist
    const existingProduct = products.find(p =>
        p.singleBarcode === singleBarcode || p.bulkBarcode === bulkBarcode
    );

    if (existingProduct) {
        showMessage('Barcode already exists! Please use different barcodes.', 'error');
        return;
    }

    const product = {
        id: generateProductId(),
        name: name,
        singleBarcode: singleBarcode,
        singlePrice: singlePrice,
        bulkBarcode: bulkBarcode,
        bulkPrice: bulkPrice,
        bulkQuantity: bulkQuantity,
        stock: initialStock + (initialBoxes * bulkQuantity),
        boxes: initialBoxes,
        totalSold: 0,
        totalRevenue: 0,
        lastUpdated: new Date().toISOString(),
        createdBy: currentUser.name,
        createdAt: new Date().toISOString()
    };

    try {
        await saveProductToFirebase(product);
        products.push(product);
        updateAllDisplays();
        clearProductForm();
        showMessage('Product added successfully!', 'success');

        // Check for low stock
        if (product.stock <= shopSettings.lowStockThreshold) {
            await addNotification(`Low stock alert: ${product.name} has only ${product.stock} units left`, 'warning');
        }

    } catch (error) {
        showMessage('Failed to add product. Please try again.', 'error');
    }
}

function clearProductForm() {
    document.getElementById('product-name').value = '';
    document.getElementById('single-barcode').value = '';
    document.getElementById('single-price').value = '';
    document.getElementById('bulk-barcode').value = '';
    document.getElementById('bulk-price').value = '';
    document.getElementById('bulk-quantity').value = '';
    document.getElementById('initial-stock').value = '';
    document.getElementById('initial-boxes').value = '';
}

function displayProducts() {
    const productList = document.getElementById('product-list');
    if (!productList) return;

    productList.innerHTML = '';

    if (products.length === 0) {
        productList.innerHTML = '<p class="no-products">No products added yet. Add your first product above!</p>';
        return;
    }

    // Sort products by name
    const sortedProducts = [...products].sort((a, b) => a.name.localeCompare(b.name));

    sortedProducts.forEach(product => {
        const productDiv = document.createElement('div');
        productDiv.className = 'product-item';

        const stockStatus = product.stock <= shopSettings.lowStockThreshold ? 'low-stock' : 'normal-stock';
        const stockIcon = product.stock <= shopSettings.lowStockThreshold ? '⚠️' : '✅';

        productDiv.innerHTML = `
            <div class="product-info">
                <h3>${product.name}</h3>
                <div class="product-details">
                    <div class="price-info">
                        <span class="single-price">Single: ${formatCurrency(product.singlePrice)}</span>
                        <span class="bulk-price">Bulk(${product.bulkQuantity}): ${formatCurrency(product.bulkPrice)}</span>
                    </div>
                    <div class="stock-info ${stockStatus}">
                        ${stockIcon} Stock: ${product.stock} units
                    </div>
                    <div class="barcode-info">
                        <small>Single: ${product.singleBarcode} | Bulk: ${product.bulkBarcode}</small>
                    </div>
                    <div class="sales-info">
                        <small>Sold: ${product.totalSold} units | Revenue: ${formatCurrency(product.totalRevenue)}</small>
                    </div>
                </div>
            </div>
            <div class="product-actions">
                <button onclick="editProduct('${product.id}')" class="btn-edit" title="Edit Product">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="deleteProduct('${product.id}')" class="btn-delete" title="Delete Product">
                    <i class="fas fa-trash"></i>
                </button>
                <button onclick="addStockToProduct('${product.id}')" class="btn-stock" title="Add Stock">
                    <i class="fas fa-plus"></i>
                </button>
            </div>
        `;
        productList.appendChild(productDiv);
    });
}

function editProduct(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    currentEditingProduct = product;

    // Fill form with existing data
    document.getElementById('product-name').value = product.name;
    document.getElementById('single-barcode').value = product.singleBarcode;
    document.getElementById('single-price').value = product.singlePrice;
    document.getElementById('bulk-barcode').value = product.bulkBarcode;
    document.getElementById('bulk-price').value = product.bulkPrice;
    document.getElementById('bulk-quantity').value = product.bulkQuantity;
    document.getElementById('initial-stock').value = product.stock;
    document.getElementById('initial-boxes').value = product.boxes || 0;

    // Change button text
    const addBtn = document.getElementById('add-product-btn');
    addBtn.textContent = 'Update Product';
    addBtn.onclick = updateProduct;

    // Add cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.className = 'btn-cancel';
    cancelBtn.onclick = cancelEdit;
    addBtn.parentNode.insertBefore(cancelBtn, addBtn.nextSibling);

    showMessage('Edit mode activated. Make changes and click Update Product.', 'info');
}

async function updateProduct() {
    if (!currentEditingProduct) return;

    const name = sanitizeInput(document.getElementById('product-name').value);
    const singleBarcode = document.getElementById('single-barcode').value.trim();
    const singlePrice = parseFloat(document.getElementById('single-price').value);
    const bulkBarcode = document.getElementById('bulk-barcode').value.trim();
    const bulkPrice = parseFloat(document.getElementById('bulk-price').value);
    const bulkQuantity = parseInt(document.getElementById('bulk-quantity').value);
    const stock = parseInt(document.getElementById('initial-stock').value);
    const boxes = parseInt(document.getElementById('initial-boxes').value) || 0;

    // Validation
    if (!validateInput(name) || !validateInput(singlePrice, 'number') ||
        !validateInput(bulkPrice, 'number') || !validateInput(bulkQuantity, 'number') ||
        !validateInput(stock, 'number') || !singleBarcode || !bulkBarcode) {
        showMessage('Please fill all required fields with valid values', 'error');
        return;
    }

    if (singleBarcode === bulkBarcode) {
        showMessage('Single and bulk barcodes must be different', 'error');
        return;
    }

    // Check if barcodes already exist (excluding current product)
    const existingProduct = products.find(p =>
        p.id !== currentEditingProduct.id &&
        (p.singleBarcode === singleBarcode || p.bulkBarcode === bulkBarcode)
    );

    if (existingProduct) {
        showMessage('Barcode already exists! Please use different barcodes.', 'error');
        return;
    }

    const updatedProduct = {
        ...currentEditingProduct,
        name: name,
        singleBarcode: singleBarcode,
        singlePrice: singlePrice,
        bulkBarcode: bulkBarcode,
        bulkPrice: bulkPrice,
        bulkQuantity: bulkQuantity,
        stock: stock,
        boxes: boxes,
        lastUpdated: new Date().toISOString(),
        updatedBy: currentUser.name
    };

    try {
        await updateProductInFirebase(currentEditingProduct.id, updatedProduct);

        // Update in local array
        const index = products.findIndex(p => p.id === currentEditingProduct.id);
        products[index] = updatedProduct;

        updateAllDisplays();
        cancelEdit();
        showMessage('Product updated successfully!', 'success');

        await addNotification(`Product "${updatedProduct.name}" updated`, 'product');

    } catch (error) {
        showMessage('Failed to update product. Please try again.', 'error');
    }
}

function cancelEdit() {
    currentEditingProduct = null;
    clearProductForm();

    // Reset button
    const addBtn = document.getElementById('add-product-btn');
    addBtn.textContent = 'Add Product';
    addBtn.onclick = addProduct;

    // Remove cancel button
    const cancelBtn = document.querySelector('.btn-cancel');
    if (cancelBtn) cancelBtn.remove();

    showMessage('Edit cancelled', 'info');
}

async function deleteProduct(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    if (!confirm(`Are you sure you want to delete "${product.name}"? This action cannot be undone.`)) {
        return;
    }

    try {
        await deleteProductFromFirebase(productId);
        products = products.filter(p => p.id !== productId);
        updateAllDisplays();
        showMessage('Product deleted successfully!', 'success');

        await addNotification(`Product "${product.name}" deleted from inventory`, 'product');

    } catch (error) {
        showMessage('Failed to delete product. Please try again.', 'error');
    }
}

// =======================================================
// 6. STOCK MANAGEMENT FUNCTIONS
// =======================================================

function updateStockSelectOptions() {
    const stockSelect = document.getElementById('stock-product-select');
    if (!stockSelect) return;

    stockSelect.innerHTML = '<option value="">Select a product...</option>';

    products.forEach(product => {
        const option = document.createElement('option');
        option.value = product.id;
        option.textContent = `${product.name} (Current: ${product.stock} units)`;
        stockSelect.appendChild(option);
    });
}

function addStockToProduct(productId) {
    const stockSelect = document.getElementById('stock-product-select');
    if (stockSelect) {
        stockSelect.value = productId;
        updateStockInfo();
    }
}

function updateStockInfo() {
    const stockSelect = document.getElementById('stock-product-select');
    const stockInfo = document.getElementById('stock-update-info');

    if (!stockSelect || !stockInfo) return;

    const productId = stockSelect.value;
    if (!productId) {
        stockInfo.innerHTML = '';
        return;
    }

    const product = products.find(p => p.id === productId);
    if (!product) return;

    stockInfo.innerHTML = `
        <div class="stock-info-card">
            <h4>${product.name}</h4>
            <p>Current Stock: ${product.stock} units</p>
            <p>Single Price: ${formatCurrency(product.singlePrice)}</p>
            <p>Bulk Price: ${formatCurrency(product.bulkPrice)} (${product.bulkQuantity} units)</p>
            <div class="barcode-info">
                <small>Single: ${product.singleBarcode} | Bulk: ${product.bulkBarcode}</small>
            </div>
        </div>
    `;
}

async function addStock() {
    const productId = document.getElementById('stock-product-select').value;
    const singleUnits = parseInt(document.getElementById('add-single-units').value) || 0;
    const bulkBoxes = parseInt(document.getElementById('add-bulk-boxes').value) || 0;

    if (!productId) {
        showMessage('Please select a product first', 'error');
        return;
    }

    if (singleUnits <= 0 && bulkBoxes <= 0) {
        showMessage('Please enter valid quantities to add', 'error');
        return;
    }

    const product = products.find(p => p.id === productId);
    if (!product) {
        showMessage('Product not found', 'error');
        return;
    }

    const totalUnitsToAdd = singleUnits + (bulkBoxes * product.bulkQuantity);
    const newStock = product.stock + totalUnitsToAdd;

    try {
        await updateProductInFirebase(productId, {
            stock: newStock,
            boxes: (product.boxes || 0) + bulkBoxes,
            lastUpdated: new Date().toISOString(),
            updatedBy: currentUser.name
        });

        // Update local data
        product.stock = newStock;
        product.boxes = (product.boxes || 0) + bulkBoxes;

        updateAllDisplays();

        // Clear form
        document.getElementById('add-single-units').value = '';
        document.getElementById('add-bulk-boxes').value = '';

        showMessage(`Stock added successfully! ${totalUnitsToAdd} units added to ${product.name}`, 'success');

        await addNotification(`Stock added: ${totalUnitsToAdd} units to ${product.name}`, 'stock');

    } catch (error) {
        showMessage('Failed to add stock. Please try again.', 'error');
    }
}

// =======================================================
// 7. POINT OF SALE (POS) FUNCTIONS
// =======================================================

function findProductByBarcode(barcode) {
    return products.find(p => p.singleBarcode === barcode || p.bulkBarcode === barcode);
}

function addToCart() {
    const barcodeInput = document.getElementById('barcode-input');
    const quantityInput = document.getElementById('pos-quantity-input');

    const barcode = barcodeInput.value.trim();
    const quantity = parseInt(quantityInput.value) || 1;

    if (!barcode) {
        showMessage('Please enter a barcode', 'error');
        barcodeInput.focus();
        return;
    }

    const product = findProductByBarcode(barcode);
    if (!product) {
        showMessage('Product not found! Please check the barcode.', 'error');
        barcodeInput.focus();
        return;
    }

    const isBulk = product.bulkBarcode === barcode;
    const unitsNeeded = isBulk ? quantity * product.bulkQuantity : quantity;

    if (product.stock < unitsNeeded) {
        showMessage(`Insufficient stock! Only ${product.stock} units available.`, 'error');
        return;
    }

    const price = isBulk ? product.bulkPrice : product.singlePrice;
    const total = price * quantity;

    // Check if item already in cart
    const existingItem = cart.find(item =>
        item.productId === product.id && item.isBulk === isBulk
    );

    if (existingItem) {
        existingItem.quantity += quantity;
        existingItem.total = existingItem.price * existingItem.quantity;
        existingItem.unitsNeeded = existingItem.isBulk ?
            existingItem.quantity * product.bulkQuantity : existingItem.quantity;
    } else {
        cart.push({
            productId: product.id,
            productName: product.name,
            barcode: barcode,
            isBulk: isBulk,
            quantity: quantity,
            price: price,
            total: total,
            unitsNeeded: unitsNeeded
        });
    }

    updateCartDisplay();

    // Clear inputs
    barcodeInput.value = '';
    quantityInput.value = '1';
    barcodeInput.focus();

    showMessage(`Added ${quantity} ${isBulk ? 'bulk' : 'single'} ${product.name} to cart`, 'success');
}

function updateCartDisplay() {
    const cartItems = document.getElementById('cart-items');
    const billTotal = document.getElementById('bill-total');

    if (!cartItems || !billTotal) return;

    cartItems.innerHTML = '';

    if (cart.length === 0) {
        cartItems.innerHTML = '<p class="empty-cart">Cart is empty</p>';
        billTotal.textContent = '₹0.00';
        return;
    }

    let total = 0;

    cart.forEach((item, index) => {
        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';
        cartItem.innerHTML = `
            <div class="item-info">
                <h4>${item.productName}</h4>
                <p>${item.isBulk ? 'Bulk' : 'Single'} × ${item.quantity}</p>
                <p class="item-price">${formatCurrency(item.price)} each</p>
            </div>
            <div class="item-actions">
                <span class="item-total">${formatCurrency(item.total)}</span>
                <button onclick="removeFromCart(${index})" class="btn-remove">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        cartItems.appendChild(cartItem);
        total += item.total;
    });

    billTotal.textContent = formatCurrency(total);
}

function removeFromCart(index) {
    cart.splice(index, 1);
    updateCartDisplay();
    showMessage('Item removed from cart', 'info');
}

async function checkout() {
    if (cart.length === 0) {
        showMessage('Cart is empty! Add items before checkout.', 'error');
        return;
    }

    // Check stock availability for all items
    for (const item of cart) {
        const product = products.find(p => p.id === item.productId);
        if (!product) {
            showMessage(`Product ${item.productName} not found!`, 'error');
            return;
        }

        if (product.stock < item.unitsNeeded) {
            showMessage(`Insufficient stock for ${item.productName}! Only ${product.stock} units available.`, 'error');
            return;
        }
    }

    const total = cart.reduce((sum, item) => sum + item.total, 0);

    try {
        // Create sale record
        const sale = {
            id: Date.now().toString(),
            items: cart.map(item => ({
                productId: item.productId,
                productName: item.productName,
                barcode: item.barcode,
                isBulk: item.isBulk,
                quantity: item.quantity,
                price: item.price,
                total: item.total,
                unitsNeeded: item.unitsNeeded
            })),
            total: total,
            timestamp: new Date().toISOString(),
            cashier: currentUser.name,
            saleType: 'pos'
        };

        // Save sale to Firebase
        await saveSaleToFirebase(sale);

        // Update stock and product statistics
        for (const item of cart) {
            const product = products.find(p => p.id === item.productId);
            if (product) {
                const newStock = product.stock - item.unitsNeeded;
                const newTotalSold = product.totalSold + item.unitsNeeded;
                const newTotalRevenue = product.totalRevenue + item.total;

                await updateProductInFirebase(item.productId, {
                    stock: newStock,
                    totalSold: newTotalSold,
                    totalRevenue: newTotalRevenue,
                    lastUpdated: new Date().toISOString()
                });

                // Update local data
                product.stock = newStock;
                product.totalSold = newTotalSold;
                product.totalRevenue = newTotalRevenue;

                // Check for low stock
                if (newStock <= shopSettings.lowStockThreshold) {
                    await addNotification(`Low stock alert: ${product.name} has only ${newStock} units left`, 'warning');
                }
            }
        }

        // Update cash counter
        cashCounter += total;
        await updateCashCounterInFirebase(cashCounter);

        // Add to sales history
        salesHistory.unshift(sale);

        // Clear cart
        cart = [];

        // Update displays
        updateAllDisplays();

        showMessage(`Sale completed successfully! Total: ${formatCurrency(total)}`, 'success');

        await addNotification(`Sale completed: ${formatCurrency(total)} (${cart.length} items)`, 'sale');

        // Generate receipt
        generateReceipt(sale);

    } catch (error) {
        showMessage('Failed to complete sale. Please try again.', 'error');
        console.error('Checkout error:', error);
    }
}

// =======================================================
// 8. INVENTORY AND REPORTING FUNCTIONS
// =======================================================

function displayInventory() {
    const inventoryList = document.getElementById('inventory-list');
    if (!inventoryList) return;

    inventoryList.innerHTML = '';

    if (products.length === 0) {
        inventoryList.innerHTML = '<p class="no-inventory">No products in inventory</p>';
        return;
    }

    // Sort products by stock (low to high)
    const sortedProducts = [...products].sort((a, b) => a.stock - b.stock);

    sortedProducts.forEach(product => {
        const inventoryItem = document.createElement('div');
        inventoryItem.className = 'inventory-item';

        const stockStatus = product.stock <= shopSettings.lowStockThreshold ? 'critical' :
            product.stock <= shopSettings.lowStockThreshold * 2 ? 'warning' : 'normal';

        inventoryItem.innerHTML = `
            <div class="inventory-info">
                <h4>${product.name}</h4>
                <div class="stock-status ${stockStatus}">
                    <span class="stock-number">${product.stock}</span>
                    <span class="stock-label">units</span>
                </div>
                <div class="inventory-details">
                    <p>Single: ${formatCurrency(product.singlePrice)} | Bulk: ${formatCurrency(product.bulkPrice)}</p>
                    <p>Sold: ${product.totalSold || 0} | Revenue: ${formatCurrency(product.totalRevenue || 0)}</p>
                </div>
            </div>
            <div class="inventory-actions">
                <button onclick="addStockToProduct('${product.id}')" class="btn-add-stock">
                    <i class="fas fa-plus"></i> Add Stock
                </button>
            </div>
        `;

        inventoryList.appendChild(inventoryItem);
    });
}

function updateStatistics() {
    // Update header statistics
    const today = new Date().toDateString();
    const todaySales = salesHistory.filter(sale =>
        new Date(sale.timestamp).toDateString() === today
    );

    const todayRevenue = todaySales.reduce((sum, sale) => sum + sale.total, 0);
    const todayTransactions = todaySales.length;
    const lowStockCount = products.filter(p => p.stock <= shopSettings.lowStockThreshold).length;

    // Update DOM elements
    if (document.getElementById('today-sales')) {
        document.getElementById('today-sales').textContent = formatCurrency(todayRevenue);
    }
    if (document.getElementById('today-transactions')) {
        document.getElementById('today-transactions').textContent = todayTransactions;
    }
    if (document.getElementById('low-stock-count')) {
        document.getElementById('low-stock-count').textContent = lowStockCount;
    }
    if (document.getElementById('total-products')) {
        document.getElementById('total-products').textContent = products.length;
    }
}

function displaySalesHistory() {
    const salesHistoryDiv = document.getElementById('sales-history');
    if (!salesHistoryDiv) return;

    salesHistoryDiv.innerHTML = '';

    if (salesHistory.length === 0) {
        salesHistoryDiv.innerHTML = '<p class="no-sales">No sales recorded yet</p>';
        return;
    }

    // Show recent sales (last 20)
    const recentSales = salesHistory.slice(0, 20);

    recentSales.forEach(sale => {
        const saleDiv = document.createElement('div');
        saleDiv.className = 'sale-item';

        const itemCount = sale.items ? sale.items.length : 1;
        const itemsText = sale.items ?
            sale.items.map(item => `${item.productName} (×${item.quantity})`).join(', ') :
            'Legacy Sale';

        saleDiv.innerHTML = `
            <div class="sale-info">
                <div class="sale-header">
                    <h4>Sale #${sale.id}</h4>
                    <span class="sale-total">${formatCurrency(sale.total)}</span>
                </div>
                <div class="sale-details">
                    <p class="sale-items">${itemsText}</p>
                    <p class="sale-meta">
                        ${formatDate(sale.timestamp)} | Cashier: ${sale.cashier}
                    </p>
                </div>
            </div>
            <div class="sale-actions">
                <button onclick="showSaleDetails('${sale.id}')" class="btn-details">
                    <i class="fas fa-eye"></i>
                </button>
                ${currentUser.type === 'owner' ? `
                    <button onclick="returnSale('${sale.id}')" class="btn-return">
                        <i class="fas fa-undo"></i>
                    </button>
                ` : ''}
            </div>
        `;

        salesHistoryDiv.appendChild(saleDiv);
    });
}

function updateCashDisplay() {
    const cashTotal = document.getElementById('cash-total');
    if (cashTotal) {
        cashTotal.textContent = formatCurrency(cashCounter);
    }
}

// =======================================================
// 9. RECEIPT GENERATION
// =======================================================

function generateReceipt(sale) {
    const receiptWindow = window.open('', '_blank', 'width=400,height=600');
    const receiptContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Receipt - ${sale.id}</title>
            <style>
                body { font-family: 'Courier New', monospace; font-size: 12px; margin: 20px; }
                .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 10px; }
                .shop-name { font-size: 16px; font-weight: bold; }
                .receipt-info { margin-bottom: 10px; }
                .items-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
                .items-table th, .items-table td { padding: 5px; text-align: left; border-bottom: 1px solid #ddd; }
                .total-row { font-weight: bold; border-top: 2px solid #000; }
                .footer { text-align: center; margin-top: 20px; font-size: 10px; }
                @media print { body { margin: 0; } }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="shop-name">${shopSettings.shopName}</div>
                <div>Receipt #${sale.id}</div>
            </div>
            
            <div class="receipt-info">
                <div>Date: ${formatDate(sale.timestamp)}</div>
                <div>Cashier: ${sale.cashier}</div>
            </div>
            
            <table class="items-table">
                <thead>
                    <tr>
                        <th>Item</th>
                        <th>Qty</th>
                        <th>Price</th>
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${sale.items.map(item => `
                        <tr>
                            <td>${item.productName}${item.isBulk ? ' (Bulk)' : ''}</td>
                            <td>${item.quantity}</td>
                            <td>${formatCurrency(item.price)}</td>
                            <td>${formatCurrency(item.total)}</td>
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr class="total-row">
                        <td colspan="3">TOTAL</td>
                        <td>${formatCurrency(sale.total)}</td>
                    </tr>
                </tfoot>
            </table>
            
            <div class="footer">
                <div>Thank you for your business!</div>
                <div>Visit us again!</div>
            </div>
            
            <script>
                window.onload = function() {
                    window.print();
                };
            </script>
        </body>
        </html>
    `;

    receiptWindow.document.write(receiptContent);
    receiptWindow.document.close();
}

// =======================================================
// 10. NOTIFICATION SYSTEM
// =======================================================

function updateNotificationDisplay() {
    const notificationCount = document.getElementById('notification-count');
    const notificationList = document.getElementById('notification-list');

    if (!notificationCount || !notificationList) return;

    const unreadCount = notifications.filter(n => !n.read).length;

    if (unreadCount > 0) {
        notificationCount.textContent = unreadCount;
        notificationCount.style.display = 'block';
    } else {
        notificationCount.style.display = 'none';
    }

    notificationList.innerHTML = '';

    if (notifications.length === 0) {
        notificationList.innerHTML = '<div class="no-notifications">No notifications</div>';
        return;
    }

    // Show recent notifications (last 10)
    const recentNotifications = notifications.slice(0, 10);

    recentNotifications.forEach(notification => {
        const notificationDiv = document.createElement('div');
        notificationDiv.className = `notification-item ${notification.read ? 'read' : 'unread'}`;
        notificationDiv.innerHTML = `
            <div class="notification-content">
                <p>${notification.message}</p>
                <small>${formatDate(notification.timestamp)}</small>
            </div>
            <button onclick="markNotificationAsRead('${notification.id}')" class="btn-mark-read">
                <i class="fas fa-check"></i>
            </button>
        `;

        notificationList.appendChild(notificationDiv);
    });
}

async function markNotificationAsRead(notificationId) {
    const notification = notifications.find(n => n.id === notificationId);
    if (!notification) return;

    notification.read = true;

    try {
        await db.collection('notifications').doc(notificationId).update({ read: true });
        updateNotificationDisplay();
    } catch (error) {
        console.error('Error marking notification as read:', error);
    }
}

async function clearAllNotifications() {
    if (!confirm('Are you sure you want to clear all notifications?')) return;

    try {
        const batch = db.batch();
        notifications.forEach(notification => {
            const notificationRef = db.collection('notifications').doc(notification.id);
            batch.delete(notificationRef);
        });

        await batch.commit();
        notifications = [];
        updateNotificationDisplay();
        showMessage('All notifications cleared', 'success');

    } catch (error) {
        console.error('Error clearing notifications:', error);
        showMessage('Failed to clear notifications', 'error');
    }
}

// =======================================================
// 11. SEARCH FUNCTIONALITY
// =======================================================

function performQuickSearch() {
    const searchTerm = document.getElementById('quick-search').value.trim().toLowerCase();

    if (!searchTerm) {
        showMessage('Please enter a search term', 'error');
        return;
    }

    const results = products.filter(product =>
        product.name.toLowerCase().includes(searchTerm) ||
        product.singleBarcode.toLowerCase().includes(searchTerm) ||
        product.bulkBarcode.toLowerCase().includes(searchTerm)
    );

    if (results.length === 0) {
        showMessage('No products found matching your search', 'info');
        return;
    }

    // Show results in a modal or dedicated section
    showSearchResults(results, searchTerm);
}

function showSearchResults(results, searchTerm) {
    const modal = document.getElementById('search-results-modal') || createSearchResultsModal();
    const resultsList = document.getElementById('search-results-list');

    resultsList.innerHTML = '';

    const resultsHeader = document.createElement('h3');
    resultsHeader.textContent = `Search Results for "${searchTerm}" (${results.length} found)`;
    resultsList.appendChild(resultsHeader);

    results.forEach(product => {
        const resultItem = document.createElement('div');
        resultItem.className = 'search-result-item';
        resultItem.innerHTML = `
            <div class="result-info">
                <h4>${product.name}</h4>
                <p>Stock: ${product.stock} units</p>
                <p>Single: ${formatCurrency(product.singlePrice)} | Bulk: ${formatCurrency(product.bulkPrice)}</p>
                <p>Barcodes: ${product.singleBarcode} | ${product.bulkBarcode}</p>
            </div>
            <div class="result-actions">
                <button onclick="addToCartFromSearch('${product.singleBarcode}')" class="btn-add-single">
                    Add Single
                </button>
                <button onclick="addToCartFromSearch('${product.bulkBarcode}')" class="btn-add-bulk">
                    Add Bulk
                </button>
            </div>
        `;
        resultsList.appendChild(resultItem);
    });

    modal.style.display = 'block';
}

function createSearchResultsModal() {
    const modal = document.createElement('div');
    modal.id = 'search-results-modal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>Search Results</h2>
                <span class="close" onclick="closeSearchResults()">&times;</span>
            </div>
            <div class="modal-body">
                <div id="search-results-list"></div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    return modal;
}

function addToCartFromSearch(barcode) {
    document.getElementById('barcode-input').value = barcode;
    addToCart();
    closeSearchResults();
}

function closeSearchResults() {
    const modal = document.getElementById('search-results-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// =======================================================
// 12. USER AUTHENTICATION AND ACCESS CONTROL
// =======================================================

function showLogin() {
    const loginModal = document.getElementById('login-modal');
    if (loginModal) {
        loginModal.style.display = 'block';
    }
}

function hideLogin() {
    const loginModal = document.getElementById('login-modal');
    if (loginModal) {
        loginModal.style.display = 'none';
        document.getElementById('login-form').reset();
    }
}

function login() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value.trim();

    if (!username || !password) {
        showMessage('Please enter both username and password', 'error');
        return;
    }

    // Simple authentication (in a real app, this would be more secure)
    if (password === OWNER_PASSWORD) {
        currentUser = { name: username, type: 'owner' };
        isOwnerLoggedIn = true;
        hideLogin();
        updateUserDisplay();
        showMessage(`Welcome, ${username}! You are logged in as Owner.`, 'success');
        updateUIForUserType();
    } else if (password === SHOPKEEPER_PASSWORD) {
        currentUser = { name: username, type: 'shopkeeper' };
        isOwnerLoggedIn = false;
        hideLogin();
        updateUserDisplay();
        showMessage(`Welcome, ${username}! You are logged in as Shopkeeper.`, 'success');
        updateUIForUserType();
    } else {
        showMessage('Invalid password!', 'error');
    }
}

function updateUserDisplay() {
    const userNameSpan = document.getElementById('user-name');
    const dropdownUserName = document.getElementById('dropdown-user-name');

    if (userNameSpan) {
        userNameSpan.textContent = currentUser.name;
    }
    if (dropdownUserName) {
        dropdownUserName.textContent = `${currentUser.name} (${currentUser.type})`;
    }
}

function updateUIForUserType() {
    const ownerOnlyElements = document.querySelectorAll('.owner-only');
    const shopkeeperOnlyElements = document.querySelectorAll('.shopkeeper-only');

    ownerOnlyElements.forEach(element => {
        element.style.display = currentUser.type === 'owner' ? 'block' : 'none';
    });

    shopkeeperOnlyElements.forEach(element => {
        element.style.display = currentUser.type === 'shopkeeper' ? 'block' : 'none';
    });
}

function logout() {
    currentUser = { name: 'Guest', type: 'guest' };
    isOwnerLoggedIn = false;
    updateUserDisplay();
    updateUIForUserType();
    showMessage('Logged out successfully', 'info');
}

// =======================================================
// 13. RETURNS AND REPLACEMENTS
// =======================================================

function updateReturnedItemsDisplay() {
    const returnsCount = document.getElementById('returns-count');
    const reviewCount = document.getElementById('review-count');

    if (returnsCount) {
        returnsCount.textContent = returnedItems.length;
        returnsCount.style.display = returnedItems.length > 0 ? 'block' : 'none';
    }

    if (reviewCount) {
        reviewCount.textContent = returnedItems.filter(item => item.status === 'pending').length;
        reviewCount.style.display = returnedItems.filter(item => item.status === 'pending').length > 0 ? 'block' : 'none';
    }
}

function showReturns() {
    const returnsModal = document.getElementById('returns-modal');
    if (returnsModal) {
        returnsModal.style.display = 'block';
        displayReturnedItems();
    }
}

function hideReturns() {
    const returnsModal = document.getElementById('returns-modal');
    if (returnsModal) {
        returnsModal.style.display = 'none';
    }
}

function displayReturnedItems() {
    const returnsList = document.getElementById('returns-list');
    if (!returnsList) return;

    returnsList.innerHTML = '';

    if (returnedItems.length === 0) {
        returnsList.innerHTML = '<p class="no-returns">No returned items</p>';
        return;
    }

    returnedItems.forEach(item => {
        const returnDiv = document.createElement('div');
        returnDiv.className = 'return-item';
        returnDiv.innerHTML = `
            <div class="return-info">
                <h4>${item.productName}</h4>
                <p>Quantity: ${item.quantity} | Amount: ${formatCurrency(item.amount)}</p>
                <p>Reason: ${item.reason}</p>
                <p>Date: ${formatDate(item.timestamp)}</p>
                <p>Status: <span class="status-${item.status}">${item.status}</span></p>
            </div>
            <div class="return-actions">
                ${item.status === 'pending' ? `
                    <button onclick="approveReturn('${item.id}')" class="btn-approve">Approve</button>
                    <button onclick="rejectReturn('${item.id}')" class="btn-reject">Reject</button>
                ` : ''}
            </div>
        `;
        returnsList.appendChild(returnDiv);
    });
}

async function returnSale(saleId) {
    const sale = salesHistory.find(s => s.id === saleId);
    if (!sale) {
        showMessage('Sale not found', 'error');
        return;
    }

    const reason = prompt('Enter reason for return:');
    if (!reason) return;

    const returnItem = {
        id: Date.now().toString(),
        saleId: saleId,
        productName: sale.items ? sale.items.map(item => item.productName).join(', ') : 'Legacy Sale',
        quantity: sale.items ? sale.items.reduce((sum, item) => sum + item.quantity, 0) : 1,
        amount: sale.total,
        reason: reason,
        timestamp: new Date().toISOString(),
        status: 'pending',
        returnedBy: currentUser.name
    };

    try {
        await saveReturnedItemToFirebase(returnItem);
        returnedItems.unshift(returnItem);
        updateReturnedItemsDisplay();
        showMessage('Return request submitted for review', 'success');

        await addNotification(`Return request: ${returnItem.productName} (${formatCurrency(returnItem.amount)})`, 'return');

    } catch (error) {
        showMessage('Failed to submit return request', 'error');
    }
}

async function approveReturn(returnId) {
    const returnItem = returnedItems.find(item => item.id === returnId);
    if (!returnItem) return;

    try {
        // Update return status
        await db.collection('returnedItems').doc(returnId).update({ status: 'approved' });
        returnItem.status = 'approved';

        // Update cash counter
        cashCounter -= returnItem.amount;
        await updateCashCounterInFirebase(cashCounter);

        updateReturnedItemsDisplay();
        updateCashDisplay();
        showMessage('Return approved successfully', 'success');

        await addNotification(`Return approved: ${returnItem.productName} (${formatCurrency(returnItem.amount)})`, 'return');

    } catch (error) {
        showMessage('Failed to approve return', 'error');
    }
}

async function rejectReturn(returnId) {
    const returnItem = returnedItems.find(item => item.id === returnId);
    if (!returnItem) return;

    try {
        await db.collection('returnedItems').doc(returnId).update({ status: 'rejected' });
        returnItem.status = 'rejected';

        updateReturnedItemsDisplay();
        showMessage('Return rejected', 'info');

        await addNotification(`Return rejected: ${returnItem.productName}`, 'return');

    } catch (error) {
        showMessage('Failed to reject return', 'error');
    }
}

// =======================================================
// 14. EXPORT AND BACKUP FUNCTIONS
// =======================================================

function exportData() {
    const data = {
        products: products,
        salesHistory: salesHistory,
        cashCounter: cashCounter,
        shopSettings: shopSettings,
        exportDate: new Date().toISOString()
    };

    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });

    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `stationery-shop-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.click();

    showMessage('Data exported successfully', 'success');
}

function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = function(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = JSON.parse(e.target.result);

                if (confirm('This will replace all current data. Are you sure?')) {
                    restoreFromBackup(data);
                }
            } catch (error) {
                showMessage('Invalid backup file', 'error');
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

async function restoreFromBackup(data) {
    try {
        // Clear existing data
        const batch = db.batch();

        // Delete all products
        const productsSnapshot = await db.collection('products').get();
        productsSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });

        // Delete all sales
        const salesSnapshot = await db.collection('sales').get();
        salesSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();

        // Restore products
        for (const product of data.products) {
            await saveProductToFirebase(product);
        }

        // Restore sales
        for (const sale of data.salesHistory) {
            await saveSaleToFirebase(sale);
        }

        // Restore cash counter
        await updateCashCounterInFirebase(data.cashCounter);

        // Restore shop settings
        if (data.shopSettings) {
            await saveShopSettingsToFirebase(data.shopSettings);
        }

        // Reload data
        await loadDataFromFirebase();

        showMessage('Data restored successfully', 'success');

    } catch (error) {
        showMessage('Failed to restore data', 'error');
        console.error('Restore error:', error);
    }
}

// =======================================================
// 15. MAIN UPDATE FUNCTION
// =======================================================

function updateAllDisplays() {
    displayProducts();
    displayInventory();
    displaySalesHistory();
    updateCashDisplay();
    updateStatistics();
    updateNotificationDisplay();
    updateReturnedItemsDisplay();
    updateStockSelectOptions();
    updateCartDisplay();
    updateUserDisplay();
    updateUIForUserType();
}

// =======================================================
// 16. EVENT LISTENERS AND INITIALIZATION
// =======================================================

document.addEventListener('DOMContentLoaded', async function() {
    console.log('Stationery Shop Manager initialized successfully!');

    // Create message box
    const messageBox = createMessageBox();
    document.body.appendChild(messageBox);

    // Start clock
    startClock();

    // Load data from Firebase
    await loadDataFromFirebase();

    // Set up event listeners
    setupEventListeners();

    // Initial UI update
    updateAllDisplays();

    // Focus on barcode input
    const barcodeInput = document.getElementById('barcode-input');
    if (barcodeInput) {
        barcodeInput.focus();
    }
});

function setupEventListeners() {
    // Product management
    const addProductBtn = document.getElementById('add-product-btn');
    if (addProductBtn) {
        addProductBtn.addEventListener('click', addProduct);
    }

    // Stock management
    const addStockBtn = document.getElementById('add-stock-btn');
    if (addStockBtn) {
        addStockBtn.addEventListener('click', addStock);
    }

    const stockSelect = document.getElementById('stock-product-select');
    if (stockSelect) {
        stockSelect.addEventListener('change', updateStockInfo);
    }

    // POS system
    const addToCartBtn = document.getElementById('add-to-cart-btn');
    if (addToCartBtn) {
        addToCartBtn.addEventListener('click', addToCart);
    }

    const checkoutBtn = document.getElementById('checkout-btn');
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', checkout);
    }

    // Barcode input enter key
    const barcodeInput = document.getElementById('barcode-input');
    if (barcodeInput) {
        barcodeInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                addToCart();
            }
        });
    }

    // Quick search
    const quickSearchBtn = document.getElementById('quick-search-btn');
    if (quickSearchBtn) {
        quickSearchBtn.addEventListener('click', performQuickSearch);
    }

    const quickSearchInput = document.getElementById('quick-search');
    if (quickSearchInput) {
        quickSearchInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                performQuickSearch();
            }
        });
    }

    // User authentication
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
        loginBtn.addEventListener('click', login);
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }

    const switchUserBtn = document.getElementById('switch-user-btn');
    if (switchUserBtn) {
        switchUserBtn.addEventListener('click', showLogin);
    }

    // Notifications
    const clearNotificationsBtn = document.getElementById('clear-notifications');
    if (clearNotificationsBtn) {
        clearNotificationsBtn.addEventListener('click', clearAllNotifications);
    }

    // Returns
    const returnsBtn = document.getElementById('returns-btn');
    if (returnsBtn) {
        returnsBtn.addEventListener('click', showReturns);
    }

    const closeReturnsModal = document.querySelector('.close-returns-modal');
    if (closeReturnsModal) {
        closeReturnsModal.addEventListener('click', hideReturns);
    }

    // Cash management
    const resetCashBtn = document.getElementById('reset-cash-btn');
    if (resetCashBtn) {
        resetCashBtn.addEventListener('click', async function() {
            if (confirm('Are you sure you want to reset the cash counter?')) {
                cashCounter = 0;
                await updateCashCounterInFirebase(cashCounter);
                updateCashDisplay();
                showMessage('Cash counter reset', 'info');
            }
        });
    }

    // Export/Import
    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportData);
    }

    const importBtn = document.getElementById('import-btn');
    if (importBtn) {
        importBtn.addEventListener('click', importData);
    }

    // Modal close events
    window.onclick = function(event) {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    };

    // Dropdown toggles
    const notificationBtn = document.getElementById('notification-btn');
    const notificationDropdown = document.getElementById('notification-dropdown');
    if (notificationBtn && notificationDropdown) {
        notificationBtn.addEventListener('click', function() {
            notificationDropdown.style.display =
                notificationDropdown.style.display === 'block' ? 'none' : 'block';
        });
    }

    const userBtn = document.getElementById('user-btn');
    const userDropdown = document.getElementById('user-dropdown');
    if (userBtn && userDropdown) {
        userBtn.addEventListener('click', function() {
            userDropdown.style.display =
                userDropdown.style.display === 'block' ? 'none' : 'block';
        });
    }

    // Close dropdowns when clicking outside
    document.addEventListener('click', function(event) {
        if (!event.target.closest('.notification-container')) {
            const notificationDropdown = document.getElementById('notification-dropdown');
            if (notificationDropdown) {
                notificationDropdown.style.display = 'none';
            }
        }

        if (!event.target.closest('.user-container')) {
            const userDropdown = document.getElementById('user-dropdown');
            if (userDropdown) {
                userDropdown.style.display = 'none';
            }
        }
    });
}

// =======================================================
// 17. ADDITIONAL UTILITY FUNCTIONS
// =======================================================

// Show sale details
function showSaleDetails(saleId) {
    const sale = salesHistory.find(s => s.id === saleId);
    if (!sale) return;

    const detailsHtml = `
        <h3>Sale Details #${sale.id}</h3>
        <p><strong>Date:</strong> ${formatDate(sale.timestamp)}</p>
        <p><strong>Cashier:</strong> ${sale.cashier}</p>
        <p><strong>Total:</strong> ${formatCurrency(sale.total)}</p>
        <h4>Items:</h4>
        <ul>
            ${sale.items ? sale.items.map(item => `
                <li>${item.productName} - ${item.isBulk ? 'Bulk' : 'Single'} × ${item.quantity} = ${formatCurrency(item.total)}</li>
            `).join('') : '<li>Legacy Sale Data</li>'}
        </ul>
    `;

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
            </div>
            <div class="modal-body">
                ${detailsHtml}
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.style.display = 'block';
}

// Generate reports
function generateDailyReport() {
    const today = new Date().toDateString();
    const todaySales = salesHistory.filter(sale =>
        new Date(sale.timestamp).toDateString() === today
    );

    const totalRevenue = todaySales.reduce((sum, sale) => sum + sale.total, 0);
    const totalTransactions = todaySales.length;

    const reportHtml = `
        <h3>Daily Sales Report - ${today}</h3>
        <p><strong>Total Revenue:</strong> ${formatCurrency(totalRevenue)}</p>
        <p><strong>Total Transactions:</strong> ${totalTransactions}</p>
        <h4>Top Selling Products:</h4>
        <div id="top-products"></div>
        <h4>Sales List:</h4>
        <div id="sales-list"></div>
    `;

    showMessage('Daily report generated', 'success');
    console.log('Daily Report:', { totalRevenue, totalTransactions, todaySales });
}

// Print current inventory
function printInventory() {
    const printWindow = window.open('', '_blank');
    const inventoryHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Inventory Report</title>
            <style>
                body { font-family: Arial, sans-serif; }
                table { width: 100%; border-collapse: collapse; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; }
                .low-stock { background-color: #ffebee; }
            </style>
        </head>
        <body>
            <h1>${shopSettings.shopName} - Inventory Report</h1>
            <p>Generated on: ${new Date().toLocaleDateString()}</p>
            <table>
                <thead>
                    <tr>
                        <th>Product Name</th>
                        <th>Stock</th>
                        <th>Single Price</th>
                        <th>Bulk Price</th>
                        <th>Total Sold</th>
                        <th>Revenue</th>
                    </tr>
                </thead>
                <tbody>
                    ${products.map(product => `
                        <tr class="${product.stock <= shopSettings.lowStockThreshold ? 'low-stock' : ''}">
                            <td>${product.name}</td>
                            <td>${product.stock}</td>
                            <td>${formatCurrency(product.singlePrice)}</td>
                            <td>${formatCurrency(product.bulkPrice)}</td>
                            <td>${product.totalSold || 0}</td>
                            <td>${formatCurrency(product.totalRevenue || 0)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </body>
        </html>
    `;

    printWindow.document.write(inventoryHtml);
    printWindow.document.close();
    printWindow.print();
}

// Auto-save functionality
setInterval(async function() {
    try {
        // Auto-save critical data every 5 minutes
        await updateCashCounterInFirebase(cashCounter);
        console.log('Auto-save completed');
    } catch (error) {
        console.error('Auto-save failed:', error);
    }
}, 300000); // 5 minutes

// Welcome message
setTimeout(function() {
    showMessage('Welcome to Stationery Shop Manager! Your data is now stored securely in the cloud.', 'success');
}, 2000);

console.log('Stationery Shop Manager with Firebase - Fully Loaded!');
