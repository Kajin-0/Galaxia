import { Capacitor } from '@capacitor/core';
import { registerPlugin } from '@capacitor/core';
import { webBillingFallback } from './webBillingFallback';

// Define the plugin interface
interface GalaxiaBillingPlugin {
  canMakePayments(): Promise<GooglePlayBillingResult>;
  getAvailableProducts(): Promise<GooglePlayBillingProducts>;
  initiatePurchase(options: { productId: string }): Promise<void>;
  restorePurchases(): Promise<void>;
}

const GalaxiaBilling = registerPlugin<GalaxiaBillingPlugin>('GalaxiaBilling');

export interface GooglePlayBillingResult {
  canMakePayments: boolean;
}

export interface GooglePlayBillingProducts {
  products: string[];
}

/**
 * Google Play Billing Interface
 * Provides a clean interface to the native Android billing system
 */
export class GooglePlayBillingService {
  private static instance: GooglePlayBillingService;
  
  public static getInstance(): GooglePlayBillingService {
    if (!GooglePlayBillingService.instance) {
      GooglePlayBillingService.instance = new GooglePlayBillingService();
    }
    return GooglePlayBillingService.instance;
  }
  
  /**
   * Check if the device can make payments
   */
  async canMakePayments(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      return webBillingFallback.canMakePayments();
    }
    
    try {
      const result = await GalaxiaBilling.canMakePayments() as GooglePlayBillingResult;
      return result.canMakePayments;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Get available products
   */
  async getAvailableProducts(): Promise<string[]> {
    if (!Capacitor.isNativePlatform()) {
      return webBillingFallback.getAvailableProducts();
    }
    
    try {
      const result = await GalaxiaBilling.getAvailableProducts() as GooglePlayBillingProducts;
      return result.products;
    } catch (error) {
      return [];
    }
  }
  
  /**
   * Initiate a purchase
   */
  async initiatePurchase(productId: string): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      return webBillingFallback.initiatePurchase(productId);
    }
    
    await GalaxiaBilling.initiatePurchase({ productId });
  }
  
  /**
   * Restore previous purchases
   */
  async restorePurchases(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      return webBillingFallback.restorePurchases();
    }
    
    await GalaxiaBilling.restorePurchases();
  }
}

// Export singleton instance
export const googlePlayBilling = GooglePlayBillingService.getInstance();
