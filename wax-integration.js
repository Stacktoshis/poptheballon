 // wax-integration.js
// Enhanced WAX integration with Cloud Wallet & Anchor support

class WaxIntegration {
  constructor() {
    this.wax = null;
    this.anchor = null;
    this.userAccount = null;
    this.authMethod = null; // 'cloud' or 'anchor'
    this.isAuthenticated = false;
    this.pinataJWT = process.env.PINATA_JWT || '';
    this.contractAccount = process.env.CONTRACT_ACCOUNT || 'popballoons1';
    this.testnet = process.env.TESTNET === 'true' || true;
    this.waxRpcEndpoint = this.testnet 
      ? 'https://testnet.waxsweden.org' 
      : 'https://wax.greymass.com';
    
    this.initWax();
    this.initAnchor();
    this.initEventListeners();
    this.initLoginModal();
  }

  // Initialize WAX Cloud Wallet
  initWax() {
    try {
      this.wax = new waxjs.WaxJS({
        rpcEndpoint: this.waxRpcEndpoint
      });
      console.log('WAXJS initialized');
    } catch (error) {
      console.error('Error initializing WAXJS:', error);
    }
  }

  // Initialize Anchor Wallet
  initAnchor() {
    // Anchor will be initialized when user chooses Anchor login
    this.anchor = {
      isAvailable: typeof window.anchorLink !== 'undefined',
      link: null,
      session: null
    };
  }

  // Create login modal for auth method selection
  initLoginModal() {
    // Create modal HTML if it doesn't exist
    if (!document.getElementById('wax-login-modal')) {
      const modalHTML = `
        <div id="wax-login-modal" class="modal">
          <div class="modal-content">
            <span class="close" id="close-login-modal">&times;</span>
            <h2>Choose Login Method</h2>
            <div class="login-options">
              <button id="cloud-wallet-login" class="login-btn">
                <img src="https://wax.io/favicon.ico" alt="WAX Cloud Wallet">
                WAX Cloud Wallet
              </button>
              <button id="anchor-wallet-login" class="login-btn">
                <img src="https://greymass.com/favicon.ico" alt="Anchor Wallet">
                Anchor Wallet
              </button>
            </div>
            <p class="login-note">Recommended for most users: WAX Cloud Wallet</p>
            <p class="login-note">Advanced users: Anchor Wallet</p>
          </div>
        </div>
      `;
      
      const styleHTML = `
        <style>
          #wax-login-modal .modal-content {
            max-width: 400px;
            text-align: center;
          }
          .login-options {
            display: flex;
            flex-direction: column;
            gap: 15px;
            margin: 20px 0;
          }
          .login-btn {
            padding: 12px;
            border-radius: 8px;
            border: 1px solid #ddd;
            background: white;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            font-size: 16px;
            transition: all 0.2s;
          }
          .login-btn:hover {
            background: #f5f5f5;
            transform: translateY(-2px);
          }
          .login-btn img {
            width: 24px;
            height: 24px;
          }
          .login-note {
            font-size: 14px;
            color: #666;
            margin: 5px 0;
          }
        </style>
      `;
      
      document.body.insertAdjacentHTML('beforeend', modalHTML);
      document.head.insertAdjacentHTML('beforeend', styleHTML);
      
      // Add event listeners
      document.getElementById('cloud-wallet-login').addEventListener('click', () => this.loginWithWax());
      document.getElementById('anchor-wallet-login').addEventListener('click', () => this.loginWithAnchor());
      document.getElementById('close-login-modal').addEventListener('click', () => {
        document.getElementById('wax-login-modal').style.display = 'none';
      });
    }
  }

  // Show login modal
  showLoginModal() {
    document.getElementById('wax-login-modal').style.display = 'block';
  }

  // Initialize event listeners
  initEventListeners() {
    // Replace existing login functionality with our modal
    const loginButtons = [
      document.getElementById('login-btn'),
      document.getElementById('login-btn-mobile')
    ];
    
    loginButtons.forEach(btn => {
      if (btn) {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          this.showLoginModal();
        });
      }
    });

    // Add WAX payment handlers for in-game purchases
    const purchaseButtons = [
      { id: 'buy-pops', action: 'buy_pops', cost: 1 },
      { id: 'buy-keeps', action: 'buy_keeps', cost: 1 },
      { id: 'subscribe-btn', action: 'subscribe', cost: 4.99 },
      { id: 'coffee-bundle-btn', action: 'coffee_bundle', cost: 10 },
      { id: 'remove-ads-btn', action: 'remove_ads', cost: 5 },
      { id: 'rent-btn', action: 'rent_spot', cost: null } // Dynamic cost
    ];

    purchaseButtons.forEach(btnConfig => {
      const btn = document.getElementById(btnConfig.id);
      if (btn) {
        btn.addEventListener('click', async () => {
          if (!this.isAuthenticated) {
            alert('Please login first');
            this.showLoginModal();
            return;
          }
          
          let cost = btnConfig.cost;
          if (btnConfig.id === 'rent-btn') {
            const coords = document.getElementById('search-coords').value.trim().split(',');
            if (coords.length !== 2) {
              alert('Please enter coordinates in the format x,y');
              return;
            }
            const x = parseInt(coords[0]);
            const y = parseInt(coords[1]);
            cost = getBookingFee(x, y);
          }
          
          await this.processPayment(btnConfig.action, cost);
        });
      }
    });
  }

  // Login with WAX Cloud Wallet
  async loginWithWax() {
    try {
      document.getElementById('wax-login-modal').style.display = 'none';
      
      const isAutoLoginAvailable = await this.wax.isAutoLoginAvailable();
      
      if (isAutoLoginAvailable) {
        this.userAccount = this.wax.userAccount;
        this.isAuthenticated = this.wax.isAuthenticated;
      } else {
        this.userAccount = await this.wax.login();
        this.isAuthenticated = true;
      }
      
      if (this.isAuthenticated) {
        this.authMethod = 'cloud';
        console.log('Logged in with WAX Cloud Wallet:', this.userAccount);
        this.updateUIAfterLogin();
        this.checkUserRegistration();
      }
    } catch (error) {
      console.error('WAX login error:', error);
      alert('WAX Cloud Wallet login failed: ' + error.message);
    }
  }

  // Login with Anchor Wallet
  async loginWithAnchor() {
    if (!this.anchor.isAvailable) {
      alert('Anchor Wallet extension not detected. Please install Anchor first.');
      window.open('https://greymass.com/en/anchor/', '_blank');
      return;
    }
    
    try {
      document.getElementById('wax-login-modal').style.display = 'none';
      
      // Initialize Anchor Link
      this.anchor.link = new window.anchorLink.AnchorLink({
        transport: new window.anchorLink.AnchorLinkBrowserTransport(),
        chainId: this.testnet ? 'f16b1833c747c43682f4386fca9cbb327929334a762755ebec17f6f23c9b8a12' : '1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4',
        rpc: this.waxRpcEndpoint
      });
      
      // Perform login
      const identity = await this.anchor.link.login('popballoons');
      this.userAccount = identity.session.auth.actor;
      this.isAuthenticated = true;
      this.authMethod = 'anchor';
      this.anchor.session = identity.session;
      
      console.log('Logged in with Anchor Wallet:', this.userAccount);
      this.updateUIAfterLogin();
      this.checkUserRegistration();
    } catch (error) {
      console.error('Anchor login error:', error);
      alert('Anchor Wallet login failed: ' + error.message);
    }
  }

  // Update UI after successful login
  updateUIAfterLogin() {
    // Update login buttons to show logout
    document.querySelectorAll('#login-btn, #login-btn-mobile').forEach(btn => {
      btn.textContent = `Logout (${this.userAccount})`;
      btn.onclick = () => this.logout();
    });
    
    // Show wallet indicator
    if (!document.getElementById('wallet-indicator')) {
      const indicator = document.createElement('div');
      indicator.id = 'wallet-indicator';
      indicator.style.position = 'fixed';
      indicator.style.bottom = '10px';
      indicator.style.right = '10px';
      indicator.style.padding = '5px 10px';
      indicator.style.background = '#2d3748';
      indicator.style.color = 'white';
      indicator.style.borderRadius = '4px';
      indicator.style.fontSize = '12px';
      indicator.style.zIndex = '1000';
      indicator.textContent = `${this.authMethod === 'cloud' ? 'WAX Cloud' : 'Anchor'}: ${this.userAccount}`;
      document.body.appendChild(indicator);
    }
  }

  // Logout from current auth method
  logout() {
    if (this.authMethod === 'cloud') {
      this.wax.logout();
    } else if (this.authMethod === 'anchor' && this.anchor.session) {
      this.anchor.session.remove();
    }
    
    this.userAccount = null;
    this.isAuthenticated = false;
    this.authMethod = null;
    
    // Update UI to show logged out state
    document.querySelectorAll('#login-btn, #login-btn-mobile').forEach(btn => {
      btn.textContent = 'Login';
      btn.onclick = () => this.showLoginModal();
    });
    
    // Remove wallet indicator
    const indicator = document.getElementById('wallet-indicator');
    if (indicator) indicator.remove();
    
    alert('Successfully logged out');
  }

  // Check if user is registered in game, if not show signup modal
  async checkUserRegistration() {
    try {
      const userData = await this.getUserData(this.userAccount);
      if (!userData) {
        // New user - show signup form prefilled with WAX account
        document.getElementById('signup-modal').style.display = 'block';
        
        // Prefill social handle with WAX account
        const socialHandleInput = document.getElementById('social-handle');
        if (socialHandleInput) {
          socialHandleInput.value = this.userAccount;
          socialHandleInput.readOnly = true;
        }
        
        // Set platform to WAX
        const platformSelect = document.getElementById('platform');
        if (platformSelect) {
          const waxOption = document.createElement('option');
          waxOption.value = 'WAX';
          waxOption.textContent = 'WAX Blockchain';
          platformSelect.appendChild(waxOption);
          platformSelect.value = 'WAX';
        }
      } else {
        // Existing user - load their data
        currentPlayerData = userData;
        localStorage.setItem('playerData', JSON.stringify(userData));
        alert(`Welcome back, ${userData.nickname}!`);
      }
    } catch (error) {
      console.error('Error checking user registration:', error);
    }
  }

  // Process payment with the appropriate wallet
  async processPayment(action, amount) {
    if (!this.isAuthenticated) {
      alert('Please login first');
      this.showLoginModal();
      return false;
    }
    
    try {
      // Convert USD amount to WAX (assuming $1 = 1 WAX for simplicity)
      const waxAmountInTokens = amount.toFixed(8) + ' WAX';
      
      // Prepare transaction
      const transaction = {
        actions: [{
          account: 'eosio.token',
          name: 'transfer',
          authorization: [{
            actor: this.userAccount,
            permission: 'active'
          }],
          data: {
            from: this.userAccount,
            to: this.contractAccount,
            quantity: waxAmountInTokens,
            memo: action
          }
        }]
      };
      
      let result;
      
      if (this.authMethod === 'cloud') {
        // Sign and broadcast with WAX Cloud Wallet
        result = await this.wax.api.transact(transaction, {
          blocksBehind: 3,
          expireSeconds: 30
        });
      } else {
        // Sign and broadcast with Anchor
        result = await this.anchor.session.transact(transaction, {
          blocksBehind: 3,
          expireSeconds: 30
        });
      }
      
      console.log('Transaction successful:', result);
      
      // Handle successful payment based on action
      this.handlePaymentSuccess(action, amount);
      
      return true;
    } catch (error) {
      console.error('Payment error:', error);
      alert('Payment failed: ' + error.message);
      return false;
    }
  }

  // ... rest of the class remains the same (handlePaymentSuccess, Pinata methods, etc) ...
}

// Initialize WAX integration when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.waxIntegration = new WaxIntegration();
  
  // Replace the existing processPayment function
  window.processPayment = function(amount, description, callback) {
    waxIntegration.processPayment(description.toLowerCase().replace(/ /g, '_'), amount)
      .then(success => callback(success))
      .catch(() => callback(false));
  };
  
  // Update signup form to handle WAX accounts
  const signupForm = document.getElementById('signup-form');
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      // Get form values
      const nickname = document.getElementById('nickname').value.trim();
      const gender = document.getElementById('gender').value;
      const platform = document.getElementById('platform').value;
      const socialHandle = document.getElementById('social-handle').value.trim();
      const age = document.getElementById('age').value.trim();
      const profilePic = document.getElementById('profile-pic').value.trim();
      const termsConfirmed = document.getElementById('terms-confirm').checked;
      
      // Validate form
      if (!termsConfirmed) {
        alert('You must confirm that you are 18 years or older and agree to the Terms of Use and Privacy Policy.');
        return;
      }
      
      // Get preferences
      const getSelectedValues = (selectId) => {
        const select = document.getElementById(selectId);
        return Array.from(select.selectedOptions).map(option => option.value);
      };
      
      const loveLanguages = getSelectedValues('pref-loveLanguages');
      const hobbies = getSelectedValues('pref-hobbies');
      const dealBreakers = getSelectedValues('pref-dealBreakers');
      
      if (loveLanguages.length === 0 || hobbies.length === 0 || dealBreakers.length === 0) {
        alert('Please select at least one option in each category');
        return;
      }
      
      // Create user object
      const newCandidate = {
        nickname,
        gender,
        platform,
        socialHandle: platform === 'WAX' ? waxIntegration.userAccount : socialHandle,
        age,
        profilePic,
        loveLanguages,
        hobbies,
        dealBreakers,
        waxAccount: platform === 'WAX' ? waxIntegration.userAccount : null,
        isRealSignup: true,
        matchedWith: [],
        fullHearts: 0,
        brokenHearts: 0,
        isSimulated: false,
        isSubscribed: false,
        adFree: false
      };
      
      // Handle profile picture upload
      const fileInput = document.getElementById('profile-pic-upload');
      if (fileInput.files && fileInput.files[0]) {
        try {
          const ipfsHash = await waxIntegration.uploadToIPFS(fileInput.files[0]);
          newCandidate.profilePic = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
        } catch (error) {
          console.error('Error uploading profile picture:', error);
          alert('Error uploading profile picture. Using URL instead.');
        }
      }
      
      // Save user data
      try {
        await waxIntegration.saveUserData(newCandidate);
        currentPlayerData = newCandidate;
        localStorage.setItem('playerData', JSON.stringify(newCandidate));
        
        // Assign user to a balloon spot
        let assigned = false;
        for (let x = 0; x < gridWidth; x++) {
          for (let y = 0; y < gridHeight; y++) {
            if (!balloons[x][y].user && y < gridHeight/2) {
              balloons[x][y].user = newCandidate;
              assigned = true;
              break;
            }
          }
          if (assigned) break;
        }
        
        if (!assigned) {
          if (newCandidate.gender === 'male') {
            waitlistMale.push(newCandidate);
          } else {
            waitlistFemale.push(newCandidate);
          }
        }
        
        signupModal.style.display = 'none';
        assignBalloonSpots();
        alert('Sign-up successful!');
      } catch (error) {
        console.error('Error during signup:', error);
        alert('Signup failed. Please try again.');
      }
    });
  }
});

// Helper function to upload files to IPFS
async function uploadToIPFS(file) {
  if (!waxIntegration.pinataJWT) {
    throw new Error('Pinata JWT not configured');
  }
  
  const formData = new FormData();
  formData.append('file', file);
  
  const metadata = JSON.stringify({
    name: `profile_${file.name}`,
    keyvalues: {
      waxAccount: waxIntegration.userAccount
    }
  });
  formData.append('pinataMetadata', metadata);
  
  const response = await axios.post(
    'https://api.pinata.cloud/pinning/pinFileToIPFS',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
        'Authorization': `Bearer ${waxIntegration.pinataJWT}`
      }
    }
  );
  
  return response.data.IpfsHash;
}
