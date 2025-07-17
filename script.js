// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyBVJ80GmEz3urOnyI5kQZX-HhLkzvXzO0E",
    authDomain: "stationery-shop-pos.firebaseapp.com",
    projectId: "stationery-shop-pos",
    storageBucket: "stationery-shop-pos.firebasestorage.app",
    messagingSenderId: "852674564204",
    appId: "1:852674564204:web:8d2f751d1e9a8483c14849"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Global variables
let products = [];
let cart = [];
let cashCounter = 0;
let salesHistory = [];

// Clock function
function updateDateTime() {
    const now = new Date();
    const dateString = now.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    const timeString = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });
    
    document.getElementById('date-text').textContent = dateString;
    document.getElementById('time-text').textContent = timeString;
}

// Start clock
function startClock() {
    updateDateTime();
    setInterval(updateDateTime, 1000);
}

// Load data from Firebase
async function loadData() {
    try {
        const snapshot = await db.collection('products').get();
        products = [];
        snapshot.forEach(doc => {
            products.push({ id: doc.id, ...doc.data() });
        });
        displayProducts();
        updateStats();
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

// Add product
async function addProduct() {
    const name = document.getElementById('product-name').value;
    const singleBarcode = document.getElementById('single-barcode').value;
    const singlePrice = parseFloat(document.getElementById('single-price').value);
    const bulkBarcode = document.getElementById('bulk-barcode').value;
    const bulkPrice = parseFloat(document.getElementById('bulk-price').value);
    const bulkQuantity = parseInt(document.getElementById('bulk-quantity').value);
    const stock = parseInt(document.getElementById('initial-stock').value);
    
    if (!name || !singleBarcode || !singlePrice || !bulkBarcode || !bulkPrice || !bulkQuantity || !stock) {
        alert('Please fill all fields');
        return;
    }
    
    const product = {
        name, singleBarcode, singlePrice, bulkBarcode, bulkPrice, bulkQuantity, stock,
        createdAt: new Date().toISOString()
    };
    
    try {
        await db.collection('products').add(product);
        clearForm();
        loadData();
        alert('Product added successfully!');
    } catch (error) {
        console.error('Error adding product:', error);
        alert('Error adding product');
    }
}

// Clear form
function clearForm() {
    document.getElementById('product-name').value = '';
    document.getElementById('single-barcode').value = '';
    document.getElementById('single-price').value = '';
    document.getElementById('bulk-barcode').value = '';
    document.getElementById('bulk-price').value = '';
    document.getElementById('bulk-quantity').value = '';
    document.getElementById('initial-stock').value = '';
    document.getElementById('initial-boxes').value = '';
}

// Display products
function displayProducts() {
    const productList = document.getElementById('product-list');
    productList.innerHTML = '';
    
    if (products.length === 0) {
        productList.innerHTML = '<p>No products added yet.</p>';
        return;
    }
    
    products.forEach(product => {
        const div = document.createElement('div');
        div.className = 'product-item';
        div.innerHTML = `
            <h3>${product.name}</h3>
            <p>Single: ₹${product.singlePrice} | Bulk: ₹${product.bulkPrice} (${product.bulkQuantity} units)</p>
            <p>Stock: ${product.stock} units</p>
            <p>Barcodes: ${product.singleBarcode} | ${product.bulkBarcode}</p>
        `;
        productList.appendChild(div);
    });
}

// Add to cart
function addToCart() {
    const barcode = document.getElementById('barcode-input').value;
    const quantity = parseInt(document.getElementById('pos-quantity-input').value) || 1;
    
    if (!barcode) {
        alert('Please enter a barcode');
        return;
    }
    
    const product = products.find(p => p.singleBarcode === barcode || p.bulkBarcode === barcode);
    if (!product) {
        alert('Product not found');
        return;
    }
    
    const isBulk = product.bulkBarcode === barcode;
    const price = isBulk ? product.bulkPrice : product.singlePrice;
    
    cart.push({
        productName: product.name,
        quantity: quantity,
        price: price,
        total: price * quantity,
        isBulk: isBulk
    });
    
    updateCartDisplay();
    document.getElementById('barcode-input').value = '';
}

// Update cart display
function updateCartDisplay() {
    const cartItems = document.getElementById('cart-items');
    const billTotal = document.getElementById('bill-total');
    
    cartItems.innerHTML = '';
    let total = 0;
    
    cart.forEach((item, index) => {
        const div = document.createElement('div');
        div.innerHTML = `
            <p>${item.productName} (${item.isBulk ? 'Bulk' : 'Single'}) x${item.quantity} = ₹${item.total}</p>
            <button onclick="removeFromCart(${index})">Remove</button>
        `;
        cartItems.appendChild(div);
        total += item.total;
    });
    
    billTotal.textContent = `₹${total.toFixed(2)}`;
}

// Remove from cart
function removeFromCart(index) {
    cart.splice(index, 1);
    updateCartDisplay();
}

// Checkout
async function checkout() {
    if (cart.length === 0) {
        alert('Cart is empty');
        return;
    }
    
    const total = cart.reduce((sum, item) => sum + item.total, 0);
    
    try {
        await db.collection('sales').add({
            items: cart,
            total: total,
            timestamp: new Date().toISOString()
        });
        
        cashCounter += total;
        await db.collection('settings').doc('cashCounter').set({ amount: cashCounter });
        
        cart = [];
        updateCartDisplay();
        updateCashDisplay();
        alert(`Sale completed! Total: ₹${total.toFixed(2)}`);
    } catch (error) {
        console.error('Error processing sale:', error);
        alert('Error processing sale');
    }
}

// Update cash display
function updateCashDisplay() {
    document.getElementById('cash-total').textContent = `₹${cashCounter.toFixed(2)}`;
}

// Update statistics
function updateStats() {
    document.getElementById('total-products').textContent = products.length;
    document.getElementById('today-sales').textContent = `₹${cashCounter.toFixed(2)}`;
}

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    startClock();
    loadData();
    
    // Event listeners
    document.getElementById('add-product-btn').addEventListener('click', addProduct);
    document.getElementById('add-to-cart-btn').addEventListener('click', addToCart);
    document.getElementById('checkout-btn').addEventListener('click', checkout);
    document.getElementById('barcode-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') addToCart();
    });
});
