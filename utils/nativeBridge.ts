import type { 
    IAPProductId, 
    PurchaseReceipt, 
    NativePurchaseBridge 
} from '../types';

// ============================================================================
// NATIVE BRIDGE IMPLEMENTATION
// ============================================================================
// This file provides the interface between your web app and native mobile apps
// Mobile developers will implement the actual native functionality

/**
 * Native Bridge for In-App Purchases
 * 
 * This bridge provides a clean interface for mobile apps to integrate with
 * your IAP system. Mobile developers will implement the actual native calls
 * to StoreKit (iOS) and Play Billing (Android).
 * 
 * For development/testing, this includes a web fallback that simulates
 * the purchase flow.
 */

// ========================================================================
// WEB FALLBACK IMPLEMENTATION (Development/Testing)
// ========================================================================

/**
 * Web fallback implementation for development and testing
 * This simulates the native purchase flow
 */
class WebFallbackBridge implements NativePurchaseBridge {
    private isSimulating = false;

    async initiatePurchase(productId: IAPProductId): Promise<PurchaseReceipt> {
        if (this.isSimulating) {
            throw new Error('Purchase already in progress');
        }

        this.isSimulating = true;

        try {
            // Simulate network delay
            await this.delay(2000);

            // Simulate user confirmation dialog
            const confirmed = await this.showConfirmationDialog(productId);
            if (!confirmed) {
                throw new Error('Purchase cancelled by user');
            }

            // Simulate purchase processing
            await this.delay(1500);

            // Generate mock receipt
            const receipt: PurchaseReceipt = {
                transactionId: `web_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                productId,
                purchaseDate: new Date().toISOString(),
                originalTransactionId: undefined
            };

            return receipt;

        } finally {
            this.isSimulating = false;
        }
    }

    async restorePurchases(): Promise<PurchaseReceipt[]> {
        // Simulate restore delay
        await this.delay(1000);
        
        // Return empty array for web fallback
        return [];
    }

    async canMakePayments(): Promise<boolean> {
        // Web fallback always returns true for testing
        return true;
    }

    async getAvailableProducts(): Promise<IAPProductId[]> {
        // Return all available products for web fallback
        return [
            'com.galaxia.crystalite_100',
            'com.galaxia.crystalite_550',
            'com.galaxia.crystalite_1200',
            'com.galaxia.crystalite_2500',
            'com.galaxia.crystalite_7000',
            'com.galaxia.crystalite_15000'
        ];
    }

    private async showConfirmationDialog(productId: IAPProductId): Promise<boolean> {
        return new Promise((resolve) => {
            const confirmed = window.confirm(
                `Web Fallback: Confirm purchase of ${productId}?\n\n` +
                'This is a development simulation. In production, this would show the native payment dialog.'
            );
            resolve(confirmed);
        });
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// ========================================================================
// NATIVE BRIDGE DETECTION & INITIALIZATION
// ========================================================================

/**
 * Get the native bridge interface
 */
function getNativeBridge(): NativePurchaseBridge | null {
    if (typeof window === 'undefined') {
        return null;
    }

    const handler = (window as any).nativePurchaseHandler;
    
    if (!handler || typeof handler !== 'object') {
        return null;
    }

    // Validate that all required methods exist
    const requiredMethods = ['initiatePurchase', 'restorePurchases', 'canMakePayments', 'getAvailableProducts'];
    const hasAllMethods = requiredMethods.every(method => typeof handler[method] === 'function');

    if (!hasAllMethods) {
        return null;
    }

    return handler as NativePurchaseBridge;
}

// ========================================================================
// BRIDGE FACTORY
// ========================================================================

/**
 * Create the appropriate bridge implementation
 */
export function createNativeBridge(): NativePurchaseBridge {
    // Try to get native bridge first
    const nativeBridge = getNativeBridge();
    if (nativeBridge) {
        return nativeBridge;
    }

    // Fall back to web implementation
    return new WebFallbackBridge();
}

// ========================================================================
// BRIDGE VALIDATION
// ========================================================================

/**
 * Validate that the native bridge is properly implemented
 */
export function validateNativeBridge(bridge: NativePurchaseBridge): string[] {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required methods
    if (typeof bridge.initiatePurchase !== 'function') {
        errors.push('initiatePurchase method is missing');
    }
    if (typeof bridge.restorePurchases !== 'function') {
        errors.push('restorePurchases method is missing');
    }
    if (typeof bridge.canMakePayments !== 'function') {
        errors.push('canMakePayments method is missing');
    }
    if (typeof bridge.getAvailableProducts !== 'function') {
        errors.push('getAvailableProducts method is missing');
    }

    // Check method signatures (basic validation)
    try {
        // Test initiatePurchase signature
        const purchasePromise = bridge.initiatePurchase('com.galaxia.crystalite_100');
        if (!(purchasePromise instanceof Promise)) {
            errors.push('initiatePurchase must return a Promise');
        }
    } catch (error) {
        warnings.push('initiatePurchase method threw an error during validation');
    }

    try {
        // Test restorePurchases signature
        const restorePromise = bridge.restorePurchases();
        if (!(restorePromise instanceof Promise)) {
            errors.push('restorePurchases must return a Promise');
        }
    } catch (error) {
        warnings.push('restorePurchases method threw an error during validation');
    }

    // Warnings are available in the warnings array

    return errors;
}

// ========================================================================
// BRIDGE STATUS
// ========================================================================

/**
 * Get current bridge status and capabilities
 */
export function getBridgeStatus(): {
    isNative: boolean;
    isAvailable: boolean;
    errors: string[];
    warnings: string[];
} {
    const nativeBridge = getNativeBridge();
    const isNative = !!nativeBridge;
    
    if (isNative) {
        const errors = validateNativeBridge(nativeBridge);
        return {
            isNative: true,
            isAvailable: errors.length === 0,
            errors,
            warnings: []
        };
    }

    return {
        isNative: false,
        isAvailable: true, // Web fallback is always available
        errors: [],
        warnings: ['Using web fallback bridge (development mode)']
    };
}

// ========================================================================
// EXPORTS
// ========================================================================

export { WebFallbackBridge };
export type { NativePurchaseBridge };

// Default export for convenience
export default createNativeBridge;
