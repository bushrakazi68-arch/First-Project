import { 
  auth, db, storage,
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  onAuthStateChanged,
  doc, setDoc, getDoc,
  collection, addDoc, getDocs, onSnapshot,
  ref, uploadBytes, getDownloadURL
} from './firebase-config.js';

// Global variables
let currentUser = null;
let cart = JSON.parse(localStorage.getItem('cart')) || [];
let pastMeals = JSON.parse(localStorage.getItem('pastMeals')) || []; // for nutrition tracking

// Listen for auth state changes (runs on every page load)
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  
  if (user) {
    console.log("User logged in:", user.uid);
    // Redirect logic
    if (window.location.pathname.includes('login.html')) {
      window.location.href = 'profile.html';
    }
    // Load user-specific data on relevant pages
    if (document.getElementById('profile-form')) loadProfile();
    if (document.getElementById('cart-items')) loadCart();
    if (document.getElementById('reviews-list')) loadReviews();
    if(document.getElementById('order-list')) loadOrderHistory();
  } else {
    console.log("No user logged in");
    // Redirect to login if trying to access protected pages
    if (!window.location.pathname.includes('login.html') && 
        !window.location.pathname.includes('index.html')) {
      window.location.href = 'login.html';
    }
  }
});

// =============================================
// FEATURE 1: Sign Up & Login
// =============================================
const signupForm = document.getElementById('signup-form');
if (signupForm) {
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;

    try {
      await createUserWithEmailAndPassword(auth, email, password);
      alert('Account created successfully!');
      window.location.href = 'profile.html';
    } catch (error) {
      alert('Error: ' + error.message);
    }
  });
}

const loginForm = document.getElementById('login-form');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
      await signInWithEmailAndPassword(auth, email, password);
      alert('Logged in successfully!');
      window.location.href = 'profile.html';
    } catch (error) {
      alert('Error: ' + error.message);
    }
  });
}

// =============================================
// FEATURE 2: Profile + Wallet + Diet Report
// =============================================
async function loadProfile() {
  if (!currentUser) return;
  const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
  if (userDoc.exists()) {
    const data = userDoc.data();
    document.getElementById('name').value = data.name || '';
    document.getElementById('preferences').value = data.preferences || '';
    document.getElementById('dietary').value = data.dietary || '';
    document.getElementById('address').value = data.address || 'Pimpri, Maharashtra';
    document.getElementById('wallet-balance').textContent = data.walletBalance || 0;
  }
}

const profileForm = document.getElementById('profile-form');
if (profileForm) {
  profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return alert('Please login first');

    await setDoc(doc(db, 'users', currentUser.uid), {
      name: document.getElementById('name').value,
      preferences: document.getElementById('preferences').value,
      dietary: document.getElementById('dietary').value,
      address: document.getElementById('address').value,
      walletBalance: parseInt(document.getElementById('wallet-balance').textContent) || 0
    }, { merge: true });

    alert('Profile updated!');
  });
}

// Simulated Add Funds (Feature 16)
const addFundsBtn = document.getElementById('add-funds');
if (addFundsBtn) {
  addFundsBtn.addEventListener('click', async () => {
    if (!currentUser) return;
    let balance = parseInt(document.getElementById('wallet-balance').textContent) || 0;
    balance += 100;
    document.getElementById('wallet-balance').textContent = balance;

    await setDoc(doc(db, 'users', currentUser.uid), { walletBalance: balance }, { merge: true });
    alert('₹100 added to wallet (simulated)');
  });
}

// Weekly Nutrition Report (Features 14+15)
const generateReportBtn = document.getElementById('generate-report');
if (generateReportBtn) {
  generateReportBtn.addEventListener('click', () => {
    if (pastMeals.length === 0) {
      document.getElementById('nutrition-report').innerHTML = '<p>No meals tracked yet.</p>';
      return;
    }

    let totalCal = pastMeals.reduce((sum, m) => sum + (m.calories || 0), 0);
    let totalProtein = pastMeals.reduce((sum, m) => sum + (m.protein || 0), 0);
    let totalCarbs = pastMeals.reduce((sum, m) => sum + (m.carbs || 0), 0);

    document.getElementById('nutrition-report').innerHTML = `
      <div class="alert alert-info">
        <strong>Weekly Nutrition Summary</strong><br>
        Calories: ${totalCal} kcal<br>
        Protein: ${totalProtein}g<br>
        Carbs: ${totalCarbs}g<br>
        <small>Keep eating balanced meals!</small>
      </div>
    `;
  });
}

// =============================================
// WEEKLY HOME VERIFICATION FEATURE
// =============================================
async function loadVerificationStatus() {
  if (!currentUser) return;

  const verificationStatusEl = document.getElementById('verification-status');
  const autoReminderEl = document.getElementById('auto-reminder');

  if (!verificationStatusEl) return;

  try {
    // Load verification data from Firestore
    const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      const lastVerification = data.lastAddressVerification;
      const autoReminder = data.autoVerificationReminder || false;

      if (lastVerification) {
        const date = new Date(lastVerification.seconds * 1000);
        verificationStatusEl.textContent = `Last verified: ${date.toLocaleDateString()} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      }

      if (autoReminderEl) {
        autoReminderEl.checked = autoReminder;
      }
    }
  } catch (error) {
    console.error("Error loading verification status:", error);
  }
}

// Verify address button handler
const verifyAddressBtn = document.getElementById('verify-address');
if (verifyAddressBtn) {
  verifyAddressBtn.addEventListener('click', async () => {
    if (!currentUser) {
      alert("Please login first to verify your address!");
      return;
    }

    const address = document.getElementById('address').value.trim();
    if (!address) {
      showVerificationMessage("Please enter your address in the profile form first.", "danger");
      return;
    }

    try {
      // Update verification timestamp in Firestore
      await setDoc(doc(db, 'users', currentUser.uid), {
        lastAddressVerification: new Date(),
        address: address
      }, { merge: true });

      // Update UI
      const now = new Date();
      document.getElementById('verification-status').textContent =
        `Last verified: ${now.toLocaleDateString()} at ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

      showVerificationMessage("Address verified successfully! Your deliveries are now confirmed for this week.", "success");

      // Add to verification history
      await addDoc(collection(db, 'addressVerifications'), {
        userId: currentUser.uid,
        address: address,
        verifiedAt: new Date(),
        type: "weekly"
      });

    } catch (error) {
      console.error("Error verifying address:", error);
      showVerificationMessage("Failed to verify address. Please try again.", "danger");
    }
  });
}

// Auto reminder checkbox handler
const autoReminderCheckbox = document.getElementById('auto-reminder');
if (autoReminderCheckbox) {
  autoReminderCheckbox.addEventListener('change', async () => {
    if (!currentUser) return;

    try {
      await setDoc(doc(db, 'users', currentUser.uid), {
        autoVerificationReminder: autoReminderCheckbox.checked
      }, { merge: true });

      console.log("Auto reminder preference updated:", autoReminderCheckbox.checked);
    } catch (error) {
      console.error("Error updating auto reminder preference:", error);
    }
  });
}

// Helper function to show verification messages
function showVerificationMessage(message, type) {
  const messageEl = document.getElementById('verification-message');
  if (!messageEl) return;

  messageEl.innerHTML = `
    <div class="alert alert-${type} alert-dismissible fade show" role="alert">
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    </div>
  `;
  messageEl.style.display = 'block';

  // Auto hide after 5 seconds
  setTimeout(() => {
    messageEl.style.display = 'none';
  }, 5000);
}

// Load verification status when profile loads
if (document.getElementById('verification-status')) {
  loadVerificationStatus();
}

async function loadReviews() {
  console.log("Loading reviews...");
  const reviewsList = document.getElementById('reviews-list');
  if (!reviewsList) return;

  reviewsList.innerHTML = '<p class="text-center">Loading reviews...</p>';

  try {
    const querySnapshot = await getDocs(collection(db, 'reviews'));
    reviewsList.innerHTML = '';

    if (querySnapshot.empty) {
      reviewsList.innerHTML = '<p class="text-center text-muted">No reviews yet. Be the first to share your experience!</p>';
      return;
    }

    querySnapshot.forEach(docSnap => {
      const review = docSnap.data();
      const date = new Date(review.timestamp.seconds * 1000).toLocaleDateString();
      const stars = '⭐'.repeat(review.rating);

      reviewsList.innerHTML += `
        <div class="col-md-6 mb-4">
          <div class="glass-card p-3 h-100">
            <div class="d-flex align-items-center mb-2">
              <div class="me-3">
                <strong class="text-black">${review.mealName}</strong>
                <div class="text-warning">${stars}</div>
              </div>
            </div>
            <p class="text-black-50 mb-2">${review.reviewText}</p>
            <small class="text-black-50">Posted on ${date}</small>
            ${review.photoURL ? `<img src="${review.photoURL}" alt="Review photo" class="img-fluid mt-2 rounded" style="max-height: 150px;">` : ''}
          </div>
        </div>
      `;
    });
  } catch (error) {
    console.error("Error loading reviews:", error);
    reviewsList.innerHTML = '<p class="text-danger text-center">Failed to load reviews. Please try again.</p>';
  }
}

// =============================================
// REVIEW FORM SUBMISSION
// =============================================
document.addEventListener('DOMContentLoaded', () => {
  const reviewForm = document.getElementById('review-form');
  if (reviewForm) {
    reviewForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!currentUser) {
        alert("Please login first to submit a review!");
        window.location.href = 'login.html';
        return;
      }

      const mealName = document.getElementById('meal-name').value.trim();
      const rating = document.getElementById('rating').value;
      const reviewText = document.getElementById('review-text').value.trim();
      const reviewPhoto = document.getElementById('review-photo').files[0];

      if (!mealName || !rating || !reviewText) {
        alert("Please fill all required fields!");
        return;
      }

      try {
        let photoURL = null;

        // Upload photo if provided
        if (reviewPhoto) {
          const storageRef = ref(storage, `reviews/${currentUser.uid}/${Date.now()}_${reviewPhoto.name}`);
          const uploadTask = await uploadBytes(storageRef, reviewPhoto);
          photoURL = await getDownloadURL(uploadTask.ref);
        }

        // Save review to Firestore
        await addDoc(collection(db, 'reviews'), {
          userId: currentUser.uid,
          mealName: mealName,
          rating: parseInt(rating),
          reviewText: reviewText,
          photoURL: photoURL,
          timestamp: new Date()
        });

        alert("Thank you for your review! It has been submitted successfully.");
        reviewForm.reset();
        loadReviews(); // Refresh reviews list
      } catch (error) {
        console.error("Error submitting review:", error);
        alert("Failed to submit review. Please try again.");
      }
    });
  }
});

// =============================================
// THEME TOGGLE FUNCTIONALITY
// =============================================
document.addEventListener('DOMContentLoaded', () => {
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    // Load saved theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeToggleButton(savedTheme);

    themeToggle.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
      updateThemeToggleButton(newTheme);
    });
  }
});

function updateThemeToggleButton(theme) {
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    const icon = themeToggle.querySelector('i');
    if (theme === 'dark') {
      icon.className = 'fas fa-sun';
      themeToggle.innerHTML = '<i class="fas fa-sun"></i> Light Mode';
    } else {
      icon.className = 'fas fa-moon';
      themeToggle.innerHTML = '<i class="fas fa-moon"></i> Dark Mode';
    }
  }
}

// Export any needed globals if you want to use in console for testing
window.currentUser = currentUser; // for debugging
// ── Menu Items Array ── (MUST BE DEFINED BEFORE loadMenu!)
const menuItems = [
  // Budget Meals (₹60–₹80)
  {
    name: "Dal Rice + Roti (Classic Budget)",
    price: 60,
    calories: 450,
    protein: 12,
    carbs: 80,
    type: "Budget",
    allergens: "None",
    locality: "pimpri",
    verified: true,
    category: "Main",
    foodType: "healthy",
    icon: "fas fa-utensils",
    image: "https://img.freepik.com/free-photo/indian-delicious-roti-assortment_23-2149073331.jpg?t=st=1770152197~exp=1770155797~hmac=7aefbfde0763ed3d21385b17552d1e59759e71af4ea29256918e2f7faa8e844e"
  },
  {
    name: "Poha + Tea (Maharashtra Special)",
    price: 65,
    calories: 380,
    protein: 8,
    carbs: 70,
    type: "Budget",
    allergens: "Peanuts",
    locality: "mumbai",
    verified: true,
    category: "Main",
    foodType: "healthy",
    icon: "fas fa-coffee",
    image: "https://images.pexels.com/photos/13063292/pexels-photo-13063292.jpeg"
  },
  {
    name: "Khichdi + Kadhi",
    price: 70,
    calories: 400,
    protein: 10,
    carbs: 75,
    type: "Budget/Comfort",
    allergens: "Dairy",
    locality: "all",
    verified: false,
    category: "Main",
    foodType: "healthy",
    icon: "fas fa-bowl-rice",
    image: "https://images.pexels.com/photos/6363499/pexels-photo-6363499.jpeg"
  },
  {
    name: "Aloo Paratha + Curd",
    price: 75,
    calories: 420,
    protein: 11,
    carbs: 65,
    type: "Budget",
    allergens: "Dairy",
    locality: "pimpri",
    verified: true,
    category: "Main",
    foodType: "healthy",
    icon: "fas fa-bread-slice",
    image: "https://images.pexels.com/photos/33428723/pexels-photo-33428723.jpeg"
  },

  // Healthy / Low-Cal Options (₹80–₹100)
  {
    name: "Vegan Sabzi + Brown Rice",
    price: 85,
    calories: 320,
    protein: 9,
    carbs: 55,
    type: "Healthy/Vegan",
    allergens: "None",
    locality: "pimpri",
    verified: true,
    category: "Main",
    foodType: "healthy",
    icon: "fas fa-leaf",
    image: "https://images.pexels.com/photos/10861318/pexels-photo-10861318.jpeg"
  },
  {
    name: "Quinoa Salad + Sprouts (Low-Cal)",
    price: 95,
    calories: 280,
    protein: 14,
    carbs: 40,
    type: "Low-Cal/Protein",
    allergens: "None",
    locality: "mumbai",
    verified: true,
    category: "Main",
    foodType: "healthy",
    icon: "fas fa-seedling",
    image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop"
  },
  {
    name: "Oats Upma + Veggies",
    price: 80,
    calories: 310,
    protein: 10,
    carbs: 50,
    type: "Healthy",
    allergens: "None",
    locality: "all",
    verified: false,
    category: "Main",
    foodType: "healthy",
    icon: "fas fa-wheat-awn",
    image: "https://images.pexels.com/photos/20408460/pexels-photo-20408460.jpeg"
  },

  // Protein Rich Options (₹100–₹120)
  {
    name: "Paneer Bhurji + Roti (High Protein)",
    price: 110,
    calories: 520,
    protein: 28,
    carbs: 45,
    type: "Protein",
    allergens: "Dairy",
    locality: "pimpri",
    verified: true,
    category: "Main",
    foodType: "healthy",
    icon: "fas fa-cheese",
    image: "https://img.freepik.com/free-photo/scrambled-eggs-veggies-salad_23-2148440360.jpg?t=st=1770151074~exp=1770154674~hmac=c498a6d11f8e01155114fd9e86950547397f334c91d496dba983b14fa7780c8d"
  },
  {
    name: "Egg Curry + Rice (2 Eggs)",
    price: 100,
    calories: 480,
    protein: 22,
    carbs: 60,
    type: "Protein",
    allergens: "Egg",
    locality: "mumbai",
    verified: true,
    category: "Main",
    foodType: "healthy",
    icon: "fas fa-egg",
    image: "https://img.freepik.com/free-psd/savory-egg-curry-bowl-with-aromatic-spices_84443-64452.jpg?t=st=1770150438~exp=1770154038~hmac=8b6a0ebccb8d05071bd69f3a6080aadf608e3a3ffab5821491a12ceb8c8cc732"
  },
  {
    name: "Chicken Stir Fry + Roti (100g Chicken)",
    price: 120,
    calories: 550,
    protein: 35,
    carbs: 40,
    type: "Protein",
    allergens: "None",
    locality: "all",
    verified: true,
    category: "Main",
    foodType: "healthy",
    icon: "fas fa-drumstick-bite",
    image: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop"
  },

  // Jain / Special Options
  {
    name: "Jain Pav Bhaji (No Onion/Garlic)",
    price: 90,
    calories: 420,
    protein: 8,
    carbs: 70,
    type: "Jain",
    allergens: "None",
    locality: "pimpri",
    verified: false,
    category: "Main",
    foodType: "healthy",
    icon: "fas fa-pepper-hot",
    image: "https://img.freepik.com/free-photo/fresh-indian-street-food-delight_23-2151996236.jpg?t=st=1770150488~exp=1770154088~hmac=9850aec1935fde0f8a2c89083de0c99c5dd39d7aa9269a147d11c5c77f957236"
  },

  // ── Snacks Section ──
  {
    name: "Masala Vada Pav",
    price: 45,
    type: "Veg",
    calories: 320,
    protein: 8,
    carbs: 45,
    allergens: "Gluten",
    verified: true,
    category: "Snacks",
    foodType: "fastfood",
    icon: "fas fa-hamburger",
    image: "https://images.pexels.com/photos/17433337/pexels-photo-17433337.jpeg"
  },
  {
    name: "Paneer Pakoda (6 pcs)",
    price: 80,
    type: "Veg",
    calories: 380,
    protein: 14,
    carbs: 28,
    allergens: "Dairy, Gluten",
    verified: false,
    category: "Snacks",
    foodType: "fastfood",
    icon: "fas fa-cookie-bite",
    image: "https://img.freepik.com/free-photo/french-toast_74190-871.jpg?t=st=1770150707~exp=1770154307~hmac=cb6f4f766b3c2f043ccc5b3d303f96911b55b272aa05eb4a0f387147a9d52aa5"
  },
  {
    name: "Aloo Tikki Chaat",
    price: 70,
    type: "Veg",
    calories: 290,
    protein: 6,
    carbs: 50,
    allergens: "None",
    verified: true,
    category: "Snacks",
    foodType: "fastfood",
    icon: "fas fa-utensils",
    image: "https://images.pexels.com/photos/34270742/pexels-photo-34270742.jpeg"
  },
  {
    name: "Cheese Corn Poppers (8 pcs)",
    price: 95,
    type: "Veg",
    calories: 410,
    protein: 12,
    carbs: 35,
    allergens: "Dairy",
    verified: false,
    category: "Snacks",
    foodType: "fastfood",
    icon: "fas fa-cheese",
    image: "https://img.freepik.com/free-photo/delicious-food-croquettes-close-up_23-2149202667.jpg?t=st=1770151575~exp=1770155175~hmac=0fc2caa1cc2393cfeb124b8db66857379e12fadf85c6b7d8a0cab621e7ad1bb1"
  },
  {
    name: "Jain Khandvi Rolls (6 pcs)",
    price: 60,
    type: "Jain",
    calories: 220,
    protein: 7,
    carbs: 38,
    allergens: "None",
    verified: true,
    category: "Snacks",
    foodType: "fastfood",
    icon: "fas fa-scroll",
    image: "https://img.freepik.com/free-photo/delicious-rolled-dessert_1127-306.jpg?t=st=1770152125~exp=1770155725~hmac=264b905fee5a4424403144ff019debbb0491adb564332e40ba55c25704f4e852"
  },
  {
    name: "Chicken Seekh Kebab (4 pcs)",
    price: 120,
    type: "Non-Veg",
    calories: 450,
    protein: 28,
    carbs: 15,
    allergens: "None",
    verified: false,
    category: "Snacks",
    foodType: "fastfood",
    icon: "fas fa-drumstick-bite",
    image: "https://img.freepik.com/free-photo/minced-lula-kebab-grilled-turkey-chicken-plate_2829-6709.jpg?t=st=1770151790~exp=1770155390~hmac=c5afb1ecc2da56511252adbfecb77a5032f0df8801ee7506729336d5899f559e"
  }
];

// ── Load Menu Function ── (updated with separate Snacks section and filter support)
function loadMenu(filter = 'all') {
  const menuContainer = document.getElementById('menu-items');
  if (!menuContainer) {
    console.error("Menu container (#menu-items) not found in HTML!");
    return;
  }

  console.log("loadMenu() running with filter:", filter);

  // Clear container ONLY ONCE
  menuContainer.innerHTML = '';

  // Filter items based on the filter parameter
  let filteredItems = menuItems;
  if (filter === 'Snacks') {
    filteredItems = menuItems.filter(item => item.category === "Snacks");
  } else if (filter === 'healthy') {
    filteredItems = menuItems.filter(item => item.foodType === "healthy");
  } else if (filter === 'fastfood') {
    filteredItems = menuItems.filter(item => item.foodType === "fastfood");
  } else if (filter === 'all') {
    filteredItems = menuItems;
  } else {
    // For other filters, you can add more logic here if needed
    filteredItems = menuItems;
  }

  // Separate main meals and snacks
  const mainMeals = filteredItems.filter(item => !item.category || item.category !== "Snacks");
  const snacks = filteredItems.filter(item => item.category === "Snacks");

  // ── Main Meals Section ── (only if there are main meals)
  if (mainMeals.length > 0) {
    menuContainer.innerHTML += `
      <div class="col-12 mb-4 mt-5">
        <h3 class="text-center fw-bold text-success">Main Meals</h3>
        <hr class="w-25 mx-auto mb-4">
      </div>
    `;

    // Add main meals
    mainMeals.forEach(item => {
      const card = `
        <div class="col-md-4 mb-4">
          <div class="card meal-card shadow-sm h-100">
            <div class="text-center mb-3">
              <img src="${item.image}" alt="${item.name}" class="meal-image" style="width: 100%; height: 200px; object-fit: cover; border-radius: 10px;">
            </div>
            <div class="card-body">
              <h5 class="card-title text-black fw-bold mb-3">${item.name}</h5>
              <div class="price-tag mb-3">₹${item.price}</div>
              <div class="nutrition-info text-black-50 mb-3">
                <small><strong>${item.type}</strong> • ${item.calories} cal • P: ${item.protein}g • C: ${item.carbs}g</small>
              </div>
              <p class="small text-black-50 mb-3"><i class="fas fa-exclamation-triangle me-1"></i>Allergens: ${item.allergens}</p>
              ${item.verified ? '<span class="verified-badge"><i class="fas fa-check-circle me-1"></i>Verified</span>' : ''}
              <button class="btn btn-danger mt-3 w-100 add-to-cart fw-bold" data-item='${JSON.stringify(item)}'>
                <i class="fas fa-cart-plus me-2"></i>Add to Cart
              </button>
            </div>
          </div>
        </div>
      `;
      menuContainer.innerHTML += card;
    });
  }

  // ── Snacks Section ── (only if there are snacks)
  if (snacks.length > 0) {
    menuContainer.innerHTML += `
      <div class="col-12 mb-5 mt-5">
        <h3 class="text-center fw-bold text-warning">Snacks & Quick Bites</h3>
        <hr class="w-25 mx-auto mb-4">
      </div>
    `;

    // Add snacks
    snacks.forEach(item => {
      const card = `
        <div class="col-md-4 mb-4">
          <div class="meal-card h-100 border-warning">
            <div class="text-center mb-3">
              <img src="${item.image}" alt="${item.name}" class="meal-image" style="width: 100%; height: 200px; object-fit: cover; border-radius: 10px;">
            </div>
            <div class="card-body">
              <h5 class="card-title text-black fw-bold mb-3">${item.name}</h5>
              <div class="price-tag mb-3">₹${item.price}</div>
              <div class="nutrition-info text-black-50 mb-3">
                <small><strong>${item.type}</strong> • ${item.calories} cal • P: ${item.protein}g • C: ${item.carbs}g</small>
              </div>
              <p class="small text-black-50 mb-3"><i class="fas fa-exclamation-triangle me-1"></i>Allergens: ${item.allergens}</p>
              ${item.verified ? '<span class="verified-badge"><i class="fas fa-check-circle me-1"></i>Verified</span>' : ''}
              <button class="btn btn-warning mt-3 w-100 add-to-cart fw-bold" data-item='${JSON.stringify(item)}'>
                <i class="fas fa-cart-plus me-2"></i>Add to Cart
              </button>
            </div>
          </div>
        </div>
      `;
      menuContainer.innerHTML += card;
    });
  }

  console.log(`Loaded ${filteredItems.length} items successfully!`);

  // Add to cart – event delegation (remove existing listener first to prevent duplicates)
  const existingListener = menuContainer._addToCartListener;
  if (existingListener) {
    menuContainer.removeEventListener('click', existingListener);
  }

  const addToCartHandler = function(e) {
    if (e.target.classList.contains('add-to-cart')) {
      e.preventDefault();
      const itemStr = e.target.getAttribute('data-item');
      if (!itemStr) return;

      try {
        const item = JSON.parse(itemStr);
        cart.push(item);
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartCount();
        alert(`${item.name} added to cart!`);
        console.log("Cart updated:", cart);
      } catch (error) {
        console.error("Add to cart error:", error);
      }
    }
  };

  menuContainer.addEventListener('click', addToCartHandler);
  menuContainer._addToCartListener = addToCartHandler;
}

// Auto-run on menu page (keep at bottom)
if (document.getElementById('menu-items')) {
  loadMenu();
  updateCartCount();
}
// Update cart count in navbar
function updateCartCount() {
  const countEl = document.getElementById('cart-count');
  if (countEl) {
    countEl.textContent = cart.length;
    console.log("Cart count updated to:", cart.length); // Debug
  } else {
    console.warn("Cart count element (#cart-count) not found in navbar!");
  }
}
// =============================================
// CART PAGE LOGIC – Add This At The Bottom
// =============================================
function loadCart() {
  console.log("loadCart() running!");
  console.log("Current cart from localStorage:",localStorage.getItem('cart'));

  const cartContainer = document.getElementById('cart-items');
  const subtotalEl = document.getElementById('subtotal');
  const discountEl = document.getElementById('discount');
  const totalEl = document.getElementById('total');
  const priorityCheckbox = document.getElementById('priority-delivery');

  if (!cartContainer) {
    console.log("Not on cart page");
    return;
  }

  // Load cart
  cart = JSON.parse(localStorage.getItem('cart')) || [];
  console.log("Cart items:", cart);

  cartContainer.innerHTML = '';
  let subtotal = 0;

  if (cart.length === 0) {
    cartContainer.innerHTML = '';
    document.getElementById('empty-cart-message').style.display = 'block';
    subtotalEl.textContent = '0';
    discountEl.textContent = '0';
    totalEl.textContent = '0';
    return;
  } else {
    document.getElementById('empty-cart-message').style.display = 'none';
  }

  // Show items
  cart.forEach((item, index) => {
    subtotal += item.price;
    cartContainer.innerHTML += `
      <div class="d-flex justify-content-between align-items-center mb-3 border-bottom pb-2" style="border-color: rgba(255,255,255,0.2) !important;">
        <div>
          <strong class="text-white">${item.name}</strong><br>
          <small class="text-white-50">₹${item.price} • ${item.type || 'Meal'}</small>
        </div>
        <button class="btn btn-sm btn-danger remove-item" data-index="${index}" style="background: rgba(220, 53, 69, 0.8); border-color: rgba(220, 53, 69, 0.8);">Remove</button>
      </div>
    `;
  });

  // Add event listeners for remove buttons
  document.querySelectorAll('.remove-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.getAttribute('data-index'));
      cart.splice(index, 1);
      localStorage.setItem('cart', JSON.stringify(cart));
      loadCart(); // Refresh cart display
      updateCartCount();
    });
  });
  // Inside loadCart() – AFTER displaying items
const clearCartBtn = document.getElementById('clear-cart');
if (clearCartBtn) {
  // Remove any old listeners + create fresh button
  const newBtn = clearCartBtn.cloneNode(true);
  clearCartBtn.parentNode.replaceChild(newBtn, clearCartBtn);

  newBtn.addEventListener('click', () => {
    if (confirm("Are you sure you want to clear the entire cart?")) {
      cart = [];
      localStorage.setItem('cart', JSON.stringify(cart));
      loadCart();          // Refresh cart display
      updateCartCount();   // Update navbar
      alert("Cart cleared successfully!");
    }
  });
}

  // Discount & Total
  const discount = cart.length >= 3 ? Math.round(subtotal * 0.1) : 0;
  let total = subtotal - discount;
  if (priorityCheckbox && priorityCheckbox.checked) total += 10;

  subtotalEl.textContent = subtotal;
  discountEl.textContent = discount;
  totalEl.textContent = total;



  // Priority checkbox
  if (priorityCheckbox) {
    priorityCheckbox.addEventListener('change', loadCart);
  }
}

// Auto-run on cart page
if (document.getElementById('cart-items')) {
  loadCart();
  updateCartCount();
}
// Filter button listeners
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    // Remove active class from all buttons
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    // Add active to clicked button
    btn.classList.add('active');

    // Reload menu with selected filter
    loadMenu(btn.dataset.filter);
  });
});

// Optional: Load all items on page load
loadMenu('all');

// =============================================
// CLOUD KITCHEN LOCALITY FILTER
// =============================================
const kitchenLocalitySelect = document.getElementById('kitchen-locality');
if (kitchenLocalitySelect) {
  kitchenLocalitySelect.addEventListener('change', () => {
    const selectedLocality = kitchenLocalitySelect.value;
    console.log("Selected locality:", selectedLocality);

    // Filter menu items based on locality
    let filteredItems = menuItems;
    if (selectedLocality !== 'all') {
      filteredItems = menuItems.filter(item => item.locality === selectedLocality || item.locality === 'all');
    }

    // Update the menu display with filtered items
    displayFilteredMenu(filteredItems);
  });
}

// Function to display filtered menu items
function displayFilteredMenu(filteredItems) {
  const menuContainer = document.getElementById('menu-items');
  if (!menuContainer) return;

  menuContainer.innerHTML = '';

  // Separate main meals and snacks
  const mainMeals = filteredItems.filter(item => !item.category || item.category !== "Snacks");
  const snacks = filteredItems.filter(item => item.category === "Snacks");

  // ── Main Meals Section ──
  if (mainMeals.length > 0) {
    menuContainer.innerHTML += `
      <div class="col-12 mb-4 mt-5">
        <h3 class="text-center fw-bold text-success">Main Meals</h3>
        <hr class="w-25 mx-auto mb-4">
      </div>
    `;

    mainMeals.forEach(item => {
      const card = `
        <div class="col-md-4 mb-4">
          <div class="card meal-card shadow-sm h-100">
            <div class="text-center mb-3">
              <img src="${item.image}" alt="${item.name}" class="meal-image" style="width: 100%; height: 200px; object-fit: cover; border-radius: 10px;">
            </div>
            <div class="card-body">
              <h5 class="card-title text-black">${item.name}</h5>
              <p class="text-black fw-bold">₹${item.price}</p>
              <p class="small text-black-50"><small>${item.type} • ${item.calories} cal • P: ${item.protein}g • C: ${item.carbs}g</small></p>
              <p class="small text-black-50">Allergens: ${item.allergens}</p>
              ${item.verified ? '<span class="badge bg-primary">Verified</span>' : ''}
              <button class="btn btn-primary mt-3 w-100 add-to-cart" data-item='${JSON.stringify(item)}'>
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      `;
      menuContainer.innerHTML += card;
    });
  }

  // ── Snacks Section ──
  if (snacks.length > 0) {
    menuContainer.innerHTML += `
      <div class="col-12 mb-5 mt-5">
        <h3 class="text-center fw-bold text-warning">Snacks & Quick Bites</h3>
        <hr class="w-25 mx-auto mb-4">
      </div>
    `;

    snacks.forEach(item => {
      const card = `
        <div class="col-md-4 mb-4">
          <div class="card meal-card shadow-sm h-100 border-warning">
            <div class="text-center mb-3">
              <img src="${item.image}" alt="${item.name}" class="meal-image" style="width: 100%; height: 200px; object-fit: cover; border-radius: 10px;">
            </div>
            <div class="card-body">
              <h5 class="card-title text-black">${item.name}</h5>
              <p class="text-success fw-bold">₹${item.price}</p>
              <p class="small text-black-50"><small>${item.type} • ${item.calories} cal • P: ${item.protein}g • C: ${item.carbs}g</small></p>
              <p class="small text-black-50">Allergens: ${item.allergens}</p>
              ${item.verified ? '<span class="badge bg-primary">Verified</span>' : ''}
              <button class="btn btn-warning mt-3 w-100 add-to-cart" data-item='${JSON.stringify(item)}'>
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      `;
      menuContainer.innerHTML += card;
    });
  }

  // Re-attach event listeners for add to cart buttons
  attachAddToCartListeners();

  console.log(`Displayed ${filteredItems.length} items for selected locality`);
}

// Function to attach add to cart event listeners
function attachAddToCartListeners() {
  const menuContainer = document.getElementById('menu-items');
  if (!menuContainer) return;

  // Remove existing listener
  const existingListener = menuContainer._addToCartListener;
  if (existingListener) {
    menuContainer.removeEventListener('click', existingListener);
  }

  // Add new listener
  const addToCartHandler = function(e) {
    if (e.target.classList.contains('add-to-cart')) {
      e.preventDefault();
      const itemStr = e.target.getAttribute('data-item');
      if (!itemStr) return;

      try {
        const item = JSON.parse(itemStr);
        cart.push(item);
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartCount();
        alert(`${item.name} added to cart!`);
        console.log("Cart updated:", cart);
      } catch (error) {
        console.error("Add to cart error:", error);
      }
    }
  };

  menuContainer.addEventListener('click', addToCartHandler);
  menuContainer._addToCartListener = addToCartHandler;
}

// =============================================
// CUSTOM MEAL BOX FUNCTIONALITY
// =============================================
const customMealForm = document.getElementById('custom-meal-form');
if (customMealForm) {
  customMealForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const sabzi = document.getElementById('sabzi').value;
    const dal = document.getElementById('dal').value;
    const riceRoti = document.getElementById('rice-roti').value;
    const protein = document.getElementById('protein').value;

    // Calculate base price
    let price = 100; // Base price
    if (protein !== 'None') {
      price += 30; // Protein add-on
    }

    // Create custom meal object
    const customMeal = {
      name: `Custom Meal: ${sabzi} + ${dal} + ${riceRoti}${protein !== 'None' ? ` + ${protein}` : ''}`,
      price: price,
      calories: 450 + (protein !== 'None' ? 150 : 0), // Approximate calories
      protein: 15 + (protein !== 'None' ? 20 : 0), // Approximate protein
      carbs: 70,
      type: "Custom Meal",
      allergens: protein === 'Egg Curry (2 eggs)' ? 'Egg' : protein === 'Paneer (100g)' ? 'Dairy' : 'None',
      locality: "all",
      verified: false,
      category: "Main",
      foodType: "healthy",
      icon: "fas fa-utensils",
      isCustom: true
    };

    // Add to cart
    cart.push(customMeal);
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();

    alert(`Custom meal added to cart!\n${customMeal.name}\nPrice: ₹${customMeal.price}`);

    // Reset form
    customMealForm.reset();
  });
}
// ... your loadMenu() function here (with event delegation listener inside) ...

// ===============================
// PLACE ORDER (STEP 3)
// ===============================
async function placeOrder() {
  if (cart.length === 0) {
    alert("Cart is empty!");
    return;
  }

  try {
    const orderRef = await addDoc(collection(db, "orders"), {
      userId: currentUser ? currentUser.uid : "guest",
      items: cart,
      status: "placed",
      createdAt: Date.now()
    });
    window.location.href ='tracking.html'

    // Clear cart after order
    cart = [];
    localStorage.removeItem("cart");
    updateCartCount();

  } catch (error) {
    console.error("Error saving order:", error);
    alert("Order failed. Please try again.");
  }
}
// =============================================
// SUBSCRIPTION BUTTON FIX – SHOW SUCCESS
// =============================================
document.querySelectorAll('.subscribe-btn').forEach(btn => {
  btn.addEventListener('click', async (e) => {
    e.preventDefault();  // Prevent any default behavior

    // Check if logged in
    if (!currentUser) {
      alert("Please login first to subscribe!");
      window.location.href = 'login.html';
      return;
    }

    const plan = btn.dataset.plan;
    const price = parseInt(btn.dataset.price);

    if (!plan || isNaN(price)) {
      alert("Invalid plan selected.");
      return;
    }

    // Simulate wallet check (you can replace with real balance from profile later)
    const walletBalance = 5000; // Example – get from Firestore if you have it
    if (walletBalance < price) {
      alert("Not enough balance in wallet! Add funds first.");
      return;
    }

    // Simulate deduct (optional – show success)
    const newBalance = walletBalance - price;
    // If you have wallet in Firestore, update it here:
    // await setDoc(doc(db, 'users', currentUser.uid), { walletBalance: newBalance }, { merge: true });

    try {
      await addDoc(collection(db, 'subscriptions'), {
        userId: currentUser.uid,
        plan: plan,
        price: price,
        startDate: new Date(),
        endDate: plan === 'weekly' 
          ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) 
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        active: true,
        autoRenew: true
      });

      // Success message – this is what you wanted!
      alert(`Successfully subscribed to \( {plan} plan! ₹ \){price} deducted. Enjoy your meals! 🎉`);

      // Refresh active subscriptions list (if you have loadSubscriptions function)
      if (typeof loadSubscriptions === 'function') {
        loadSubscriptions();
      }
    } catch (error) {
      console.error("Subscription error:", error);
      alert("Failed to subscribe. Please try again or check console.");
    }
  });
});
// Prevent JS from blocking navbar links
document.querySelectorAll('.navbar-nav a.nav-link').forEach(link => {
  link.addEventListener('click', (e) => {
    // Only prevent if it's not a real link (href="#")
    if (link.getAttribute('href') === '#') {
      e.preventDefault();
    }
    // Do NOT prevent other links like menu.html
  });
});
// PLACE ORDER BUTTON – WITH PAYMENT MODAL
const placeOrderBtn = document.getElementById('place-order');
if (placeOrderBtn) {
  placeOrderBtn.addEventListener('click', () => {
    if (cart.length === 0) {
      alert("Your cart is empty!");
      return;
    }

    if (!currentUser) {
      alert("Please login to place order!");
      window.location.href = 'login.html';
      return;
    }

    const total = parseInt(document.getElementById('total').textContent) || 0;

    // Show total in modal
    document.getElementById('modal-total').textContent = `₹${total}`;

    // Optional: Show wallet balance if you have it
    // document.getElementById('wallet-balance').textContent = '₹5000'; // Example
    // document.getElementById('wallet-info').classList.remove('d-none');

    // Open modal
    const paymentModal = new bootstrap.Modal(document.getElementById('paymentModal'));
    paymentModal.show();
  });
}

// Confirm Payment – inside modal
const confirmPaymentBtn = document.getElementById('confirm-payment');
if (confirmPaymentBtn) {
  confirmPaymentBtn.addEventListener('click', async () => {
    const method = document.getElementById('payment-method').value;
    const total = parseInt(document.getElementById('modal-total').textContent.replace('₹', '')) || 0;

    let paymentSuccess = true; // Simulate success for now
    let message = `Payment successful via ${method.toUpperCase()}!`;

    // Optional: Wallet check
    if (method === "wallet") {
      const walletBalance = 5000; // Replace with real value from user doc
      if (walletBalance < total) {
        paymentSuccess = false;
        message = "Not enough balance in wallet!";
      }
    }

    if (paymentSuccess) {
      const orderItems = [...cart]; // Copy before clearing

      try {
        const orderRef = await addDoc(collection(db, 'orders'), {
          userId: currentUser.uid,
          items: orderItems,
          total: total,
          timestamp: new Date(),
          status: "preparing",
          etaMinutes: 30,
          paymentMethod: method
        });

        console.log("Order saved! ID:", orderRef.id);

        // Clear cart
        cart = [];
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartCount();

        alert(message + "\nOrder placed successfully! Redirecting to tracking...");

        // Close modal
        bootstrap.Modal.getInstance(document.getElementById('paymentModal')).hide();

        // Redirect to tracking page
        window.location.href = `tracking.html?orderId=${orderRef.id}`;
      } catch (error) {
        console.error("Order save error:", error);
        alert("Payment successful, but failed to save order. Check console.");
      }
    } else {
      alert(message);
    }
  });
}
// =============================================
// CONTACT US FORM – SAVE TO FIRESTORE
// =============================================
const contactForm = document.getElementById('contact-form');
if (contactForm) {
  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const subject = document.getElementById('subject').value.trim();
    const message = document.getElementById('message').value.trim();

    if (!name || !email || !phone || !subject || !message) {
      alert("Please fill all fields!");
      return;
    }

    try {
      await addDoc(collection(db, 'contacts'), {
        userId: currentUser ? currentUser.uid : null,
        name,
        email,
        phone,
        subject,
        message,
        timestamp: new Date(),
        status: "new"
      });

      alert("Thank you! Your message has been sent. We'll get back to you soon.");
      contactForm.reset();
    } catch (error) {
      console.error("Error submitting contact form:", error);
      alert("Failed to send message. Please try again or check console.");
    }
  });
}
// =============================================
// ORDER HISTORY FEATURE
// =============================================
// =============================================
// ORDER HISTORY – LOAD PAST ORDERS
// =============================================
// =============================================
// ORDER HISTORY – LOAD PAST ORDERS
// =============================================
async function loadOrderHistory() {
  const orderList = document.getElementById('order-list');
  const noOrders = document.getElementById('no-orders');

  if (!orderList || !noOrders) {
    console.warn("Order history elements not found on this page");
    return;
  }

  if (!currentUser) {
    noOrders.textContent = "Please login to view your order history.";
    noOrders.classList.remove('d-none');
    orderList.innerHTML = '';
    return;
  }

  noOrders.classList.add('d-none');
  orderList.innerHTML = '<p class="text-center">Loading your past orders...</p>';

  try {
    const querySnapshot = await getDocs(collection(db, 'orders'));
    const orders = [];

    querySnapshot.forEach(docSnap => {
      const order = docSnap.data();
      if (order.userId === currentUser.uid) {
        orders.push({ id: docSnap.id, ...order });
      }
    });

    // Sort by timestamp (newest first)
    orders.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));

    if (orders.length === 0) {
      noOrders.classList.remove('d-none');
      noOrders.innerHTML = `
        You haven't placed any orders yet.<br>
        <a href="menu.html" class="btn btn-primary mt-3">Start Ordering</a>
      `;
      orderList.innerHTML = '';
      return;
    }

    orderList.innerHTML = ''; // Clear loading message

    orders.forEach(order => {
      const date = order.timestamp?.seconds 
        ? new Date(order.timestamp.seconds * 1000).toLocaleString() 
        : 'Date unknown';

      const statusClass = {
        preparing: 'status-preparing',
        out: 'status-out',
        delivered: 'status-delivered',
        cancelled: 'status-cancelled'
      }[order.status?.toLowerCase()] || 'text-muted';

      const statusText = order.status 
        ? order.status.charAt(0).toUpperCase() + order.status.slice(1) 
        : 'Unknown';

      orderList.innerHTML += `
        <div class="col-md-6 col-lg-4">
          <div class="card order-card shadow-sm">
            <div class="card-body">
              <h5 class="card-title">Order #${order.id.slice(0,8)}</h5>
              <p class="card-text mb-1"><strong>Date:</strong> ${date}</p>
              <p class="card-text mb-1"><strong>Total:</strong> ₹${order.total || 0}</p>
              <p class="card-text mb-1"><strong>Items:</strong> ${order.items?.length || 0}</p>
              <p class="card-text mb-3">
                <strong>Status:</strong> 
                <span class="\( {statusClass}"> \){statusText}</span>
              </p>
              <p class="card-text mb-3"><strong>Payment:</strong> ${order.paymentMethod || 'Unknown'}</p>
              <a href="tracking.html?orderId=${order.id}" class="btn btn-outline-primary btn-sm">
                View Details & Track
              </a>
            </div>
          </div>
        </div>
      `;
    });
  } catch (error) {
    console.error("Error loading order history:", error);
    orderList.innerHTML = `
      <p class="text-danger text-center">
        Failed to load order history.<br>
        ${error.message.includes('permission-denied') 
          ? 'Permission denied – check Firestore rules' 
          : 'Please try again later.'}
      </p>
    `;
  }
}

// Auto-run when on history page
if (document.getElementById('order-list')) {
  loadOrderHistory();
}