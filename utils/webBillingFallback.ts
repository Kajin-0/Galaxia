/**
 * Web Billing Fallback for Development
 * Simulates Google Play Billing for web development
 */
export class WebBillingFallback {
  private static instance: WebBillingFallback;
  
  public static getInstance(): WebBillingFallback {
    if (!WebBillingFallback.instance) {
      WebBillingFallback.instance = new WebBillingFallback();
    }
    return WebBillingFallback.instance;
  }
  
  async canMakePayments(): Promise<boolean> {
    // Simulate billing availability
    return true;
  }
  
  async getAvailableProducts(): Promise<string[]> {
    return [
      'com.galaxia.crystalite_100',
      'com.galaxia.crystalite_550',
      'com.galaxia.crystalite_1200',
      'com.galaxia.crystalite_2500',
      'com.galaxia.crystalite_7000',
      'com.galaxia.crystalite_15000'
    ];
  }
  
  async initiatePurchase(productId: string): Promise<void> {
    // Simulate purchase flow
    const confirmed = confirm(`Purchase ${productId} for development?`);
    if (confirmed) {
      // Simulate successful purchase
      setTimeout(() => {
        this.simulatePurchaseCompletion(productId);
      }, 1000);
    } else {
      throw new Error('Purchase cancelled by user');
    }
  }
  
  async restorePurchases(): Promise<void> {
    // Simulate restore
    // Web fallback: Restore purchases (no-op)
  }
  
  private simulatePurchaseCompletion(productId: string) {
    // Create mock receipt
    const receipt = {
      transactionId: `web_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      productId: productId,
      purchaseDate: new Date().toISOString(),
      androidReceipt: JSON.stringify({ mock: true })
    };
    
    // Dispatch to game state
    if (typeof window !== 'undefined' && (window as any).galaxiaGame) {
      (window as any).galaxiaGame.dispatch({
        type: 'PURCHASE_COMPLETED',
        receipt: receipt,
        amount: this.getProductAmount(productId)
      });
    }
  }
  
  private getProductAmount(productId: string): number {
    switch (productId) {
      case 'com.galaxia.crystalite_100': return 100;
      case 'com.galaxia.crystalite_550': return 550;
      case 'com.galaxia.crystalite_1200': return 1200;
      case 'com.galaxia.crystalite_2500': return 2500;
      case 'com.galaxia.crystalite_7000': return 7000;
      case 'com.galaxia.crystalite_15000': return 15000;
      default: return 0;
    }
  }
}

export const webBillingFallback = WebBillingFallback.getInstance();
