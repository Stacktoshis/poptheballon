// wax-integration.js
import { WalletCheckModal, Login } from 'waxjs';
import WaxJS from '@waxio/waxjs/dist';
import pinataSDK from '@pinata/sdk';

// Load environment variables
const CONTRACT_ACCOUNT = process.env.WAX_CONTRACT_ACCOUNT;
const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET_KEY = process.env.PINATA_SECRET_KEY;
const WAX_RPC_URL = process.env.WAX_TESTNET_RPC_URL;

// Initialize Wax and Pinata
const wax = new WaxJS(WAX_RPC_URL, null, null, false);
const pinata = pinataSDK(PINATA_API_KEY, PINATA_SECRET_KEY);

class WaxIntegration {
  constructor() {
    this.user = null;
    this.contractAccount = CONTRACT_ACCOUNT;
  }

  async init() {
    try {
      this.user = await wax.login();
      console.log('WAX user authenticated:', this.user);
      return this.user;
    } catch (error) {
      console.error('WAX login failed:', error);
      throw error;
    }
  }

  async transact(action, data) {
    try {
      const result = await wax.api.transact({
        actions: [{
          account: this.contractAccount,
          name: action,
          authorization: [{
            actor: this.user.account,
            permission: 'active',
          }],
          data: data,
        }]
      }, {
        blocksBehind: 3,
        expireSeconds: 1200,
      });
      return result;
    } catch (error) {
      console.error('Transaction failed:', error);
      throw error;
    }
  }

  async purchaseItem(itemType) {
    const items = {
      'pop': { cost: 1, action: 'purchasepop' },
      'keep': { cost: 2, action: 'purchasekeep' },
      'subscription': { cost: 10, action: 'purchasesub' },
      'spot': { cost: 5, action: 'purchasespot' }
    };

    if (!items[itemType]) throw new Error('Invalid item type');
    
    return this.transact(items[itemType].action, {
      user: this.user.account,
      quantity: `${items[itemType].cost} WAX`
    });
  }

  async storeGameData(data) {
    try {
      const result = await pinata.pinJSONToIPFS(data);
      return result.IpfsHash;
    } catch (error) {
      console.error('Pinata upload failed:', error);
      throw error;
    }
  }

  async getGameData(ipfsHash) {
    try {
      const response = await fetch(`https://gateway.pinata.cloud/ipfs/${ipfsHash}`);
      return response.json();
    } catch (error) {
      console.error('Failed to fetch game data:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const waxIntegration = new WaxIntegration();
