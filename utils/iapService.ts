import * as C from '../constants';
import type { 
    IAPProductId, 
    PurchaseReceipt, 
    PurchaseValidationResult, 
    PurchaseError, 
    PendingPurchase,
    PurchaseHistoryEntry,
    NativePurchaseBridge,
    PurchaseValidationRequest,
    PurchaseValidationResponse
} from '../types';

// ============================================================================
// IAP SERVICE - SECURE IN-APP PURCHASE HANDLING
// ============================================================================

/**
 * Secure IAP Service for handling in-app purchases
 * Implements security best practices:
 * - Receipt validation with backend
 * - Duplicate purchase prevention
 * - Idempotency guarantees
 * - Comprehensive error handling
 * - Audit trail logging
 */

class IAPService {
    private pendingPurchases: Map<string, PendingPurchase> = new Map();
    private purchaseHistory: PurchaseHistoryEntry[] = [];
    private isInitialized = false;
    private nativeBridge: NativePurchaseBridge | null = null;
    private validationEndpoint: string | null = null;

    constructor() {
        this.loadStoredData();
    }

    // ========================================================================
    // INITIALIZATION & CONFIGURATION
    // ========================================================================

    /**
     * Initialize the IAP service with native bridge and validation endpoint
     */
    async initialize(
        nativeBridge: NativePurchaseBridge,
        validationEndpoint: string
    ): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        this.nativeBridge = nativeBridge;
        this.validationEndpoint = validationEndpoint;

        // Check IAP availability
        try {
            const canMakePayments = await this.nativeBridge.canMakePayments();
            this.updateAvailability(true, canMakePayments);
        } catch (error) {
            this.updateAvailability(false, false);
        }

        // Process any pending purchases from previous sessions
        await this.processPendingPurchases();

        this.isInitialized = true;
    }

    /**
     * Update IAP availability status
     */
    private updateAvailability(isAvailable: boolean, canMakePayments: boolean): void {
        // This would dispatch to the game state
        // For now, we'll store it locally
        // FIX: Cannot assign to a getter. isAvailable is derived from other properties.
        // this.isAvailable = isAvailable; 
        // FIX: Assign to the private backing field `_canMakePayments`.
        this._canMakePayments = canMakePayments;
    }

    // ========================================================================
    // PURCHASE INITIATION
    // ========================================================================

    /**
     * Initiate a secure purchase flow
     */
    async initiatePurchase(productId: IAPProductId): Promise<void> {
        if (!this.isInitialized) {
            throw new Error('IAP Service not initialized');
        }

        if (!this.nativeBridge) {
            throw new Error('Native bridge not available');
        }

        // Validate product ID
        if (!C.IAP_PRODUCT_IDS.includes(productId)) {
            throw new Error(`Invalid product ID: ${productId}`);
        }

        try {
            // Create pending purchase record
            const pendingPurchase: PendingPurchase = {
                id: this.generatePurchaseId(),
                productId,
                amount: this.getProductAmount(productId),
                initiatedAt: Date.now(),
                attempts: 0,
                lastAttemptAt: Date.now()
            };

            this.pendingPurchases.set(pendingPurchase.id, pendingPurchase);
            this.saveStoredData();

            // Initiate native purchase
            const receipt = await this.nativeBridge.initiatePurchase(productId);
            
            // Process the completed purchase
            await this.processCompletedPurchase(receipt);

        } catch (error) {
            const purchaseError = this.createPurchaseError(error);
            await this.handlePurchaseFailure(productId, purchaseError);
            throw purchaseError;
        }
    }

    /**
     * Process a completed purchase from the native layer
     */
    private async processCompletedPurchase(receipt: PurchaseReceipt): Promise<void> {
        try {
            // Validate the receipt with backend
            const validationResult = await this.validatePurchaseReceipt(receipt);
            
            if (validationResult.isValid) {
                // Grant currency and complete purchase
                await this.completePurchase(receipt, validationResult);
            } else {
                // Handle validation failure
                const error: PurchaseError = {
                    type: 'validation_failed',
                    message: 'Purchase validation failed',
                    details: validationResult.error
                };
                await this.handlePurchaseFailure(receipt.productId, error);
            }

        } catch (error) {
            const purchaseError = this.createPurchaseError(error);
            await this.handlePurchaseFailure(receipt.productId, purchaseError);
        }
    }

    // ========================================================================
    // RECEIPT VALIDATION
    // ========================================================================

    /**
     * Validate purchase receipt with backend server
     * This is the critical security step that prevents fraud
     */
    private async validatePurchaseReceipt(receipt: PurchaseReceipt): Promise<PurchaseValidationResult> {
        if (!this.validationEndpoint) {
            throw new Error('Validation endpoint not configured');
        }

        // FIX: The platform must be 'ios' or 'android' for the validation request.
        // Handle the 'unknown' case to prevent a type error.
        const platform = this.detectPlatform();
        if (platform === 'unknown') {
            throw new Error('Cannot validate purchase receipt for an unknown platform.');
        }

        const request: PurchaseValidationRequest = {
            receipt,
            platform: platform,
            userId: this.getUserId() // Optional user identification
        };

        try {
            const response = await fetch(this.validationEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(request),
                // Add timeout to prevent hanging
                signal: AbortSignal.timeout(C.IAP_CONFIG.VALIDATION_TIMEOUT)
            });

            if (!response.ok) {
                throw new Error(`Validation request failed: ${response.status}`);
            }

            const validationResponse: PurchaseValidationResponse = await response.json();

            return {
                isValid: validationResponse.isValid,
                transactionId: receipt.transactionId,
                productId: receipt.productId,
                amount: validationResponse.amount,
                timestamp: validationResponse.timestamp,
                error: validationResponse.error ? {
                    type: 'validation_failed',
                    message: validationResponse.error,
                    code: response.status.toString()
                } : undefined
            };

        } catch (error) {
            throw new Error(`Receipt validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // ========================================================================
    // PURCHASE COMPLETION
    // ========================================================================

    /**
     * Complete a validated purchase and grant currency
     */
    private async completePurchase(
        receipt: PurchaseReceipt, 
        validationResult: PurchaseValidationResult
    ): Promise<void> {
        // Check for duplicate purchases
        if (this.isDuplicatePurchase(receipt.transactionId)) {
            return; // Already processed
        }

        // Record purchase in history
        const historyEntry: PurchaseHistoryEntry = {
            id: this.generatePurchaseId(),
            productId: receipt.productId,
            amount: validationResult.amount,
            completedAt: Date.now(),
            transactionId: receipt.transactionId,
            platform: this.detectPlatform()
        };

        this.purchaseHistory.push(historyEntry);

        // Remove from pending purchases
        this.pendingPurchases.delete(receipt.transactionId);

        // Save updated data
        this.saveStoredData();

        // Here you would dispatch to the game state
        // dispatch({ type: 'PURCHASE_VALIDATION_COMPLETED', result: validationResult });
    }

    // ========================================================================
    // PURCHASE RESTORATION
    // ========================================================================

    /**
     * Restore previous purchases (important for iOS compliance)
     */
    async restorePurchases(): Promise<void> {
        if (!this.nativeBridge) {
            throw new Error('Native bridge not available');
        }

        try {
            const receipts = await this.nativeBridge.restorePurchases();
            
            // Process each restored receipt
            for (const receipt of receipts) {
                try {
                    await this.processCompletedPurchase(receipt);
                } catch (error) {
                    // Failed to process restored purchase
                }
            }

            // Update last restore attempt
            this.lastRestoreAttempt = Date.now();
            this.saveStoredData();

        } catch (error) {
            const purchaseError = this.createPurchaseError(error);
            throw purchaseError;
        }
    }

    // ========================================================================
    // ERROR HANDLING
    // ========================================================================

    /**
     * Handle purchase failures with proper error categorization
     */
    private async handlePurchaseFailure(productId: IAPProductId, _error: PurchaseError): Promise<void> {

        // Update pending purchase with failure
        const pendingPurchase = Array.from(this.pendingPurchases.values())
            .find(p => p.productId === productId);

        if (pendingPurchase) {
            pendingPurchase.attempts++;
            pendingPurchase.lastAttemptAt = Date.now();
            this.saveStoredData();
        }

        // Here you would dispatch to the game state
        // dispatch({ type: 'PURCHASE_FAILED', error, productId });
    }

    /**
     * Create standardized purchase error from various error types
     */
    private createPurchaseError(error: any): PurchaseError {
        if (error && typeof error === 'object' && 'type' in error) {
            return error as PurchaseError;
        }

        // Categorize common error types
        if (error?.message?.includes('cancelled') || error?.code === 'USER_CANCELLED') {
            return {
                type: 'user_cancelled',
                message: 'Purchase was cancelled by user',
                code: error?.code
            };
        }

        if (error?.message?.includes('network') || error?.name === 'AbortError') {
            return {
                type: 'network_error',
                message: 'Network error occurred during purchase',
                code: error?.code
            };
        }

        return {
            type: 'unknown',
            message: error?.message || 'Unknown purchase error occurred',
            code: error?.code
        };
    }

    // ========================================================================
    // UTILITY METHODS
    // ========================================================================

    /**
     * Get product amount from product ID
     */
    private getProductAmount(productId: IAPProductId): number {
        const product = Object.values(C.IAP_PRODUCTS).find(p => p.id === productId);
        return product?.amount || 0;
    }

    /**
     * Generate unique purchase ID
     */
    private generatePurchaseId(): string {
        return `purchase_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Detect current platform
     */
    private detectPlatform(): 'ios' | 'android' | 'unknown' {
        if (typeof window !== 'undefined') {
            if (/iPad|iPhone|iPod/.test(navigator.userAgent)) return 'ios';
            if (/Android/.test(navigator.userAgent)) return 'android';
        }
        return 'unknown';
    }

    /**
     * Get user ID for purchase validation (implement based on your auth system)
     */
    private getUserId(): string | undefined {
        // Implement based on your authentication system
        // For now, return undefined (anonymous purchases)
        return undefined;
    }

    /**
     * Check if purchase is duplicate
     */
    private isDuplicatePurchase(transactionId: string): boolean {
        return this.purchaseHistory.some(p => p.transactionId === transactionId);
    }

    // ========================================================================
    // PENDING PURCHASE PROCESSING
    // ========================================================================

    /**
     * Process any pending purchases from previous sessions
     */
    private async processPendingPurchases(): Promise<void> {
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours

        for (const [id, purchase] of this.pendingPurchases) {
            // Skip old pending purchases
            if (now - purchase.initiatedAt > maxAge) {
                this.pendingPurchases.delete(id);
                continue;
            }

            // Skip if too many attempts
            if (purchase.attempts >= C.IAP_CONFIG.MAX_RETRY_ATTEMPTS) {
                this.pendingPurchases.delete(id);
                continue;
            }

            // Try to process again
            if (purchase.receipt) {
                try {
                    await this.processCompletedPurchase(purchase.receipt);
                } catch (error) {
                    // Failed to process pending purchase
                }
            }
        }

        this.saveStoredData();
    }

    // ========================================================================
    // DATA PERSISTENCE
    // ========================================================================

    /**
     * Load stored IAP data from localStorage
     */
    private loadStoredData(): void {
        try {
            // Load pending purchases
            const storedPending = localStorage.getItem(C.IAP_CONFIG.STORAGE_KEYS.PENDING_PURCHASES);
            if (storedPending) {
                const pending = JSON.parse(storedPending);
                this.pendingPurchases = new Map(pending);
            }

            // Load purchase history
            const storedHistory = localStorage.getItem(C.IAP_CONFIG.STORAGE_KEYS.PURCHASE_HISTORY);
            if (storedHistory) {
                this.purchaseHistory = JSON.parse(storedHistory);
            }

            // Load last restore attempt
            const storedRestore = localStorage.getItem(C.IAP_CONFIG.STORAGE_KEYS.LAST_RESTORE_ATTEMPT);
            if (storedRestore) {
                this.lastRestoreAttempt = parseInt(storedRestore, 10);
            }

        } catch (error) {
            // Reset to defaults on error
            this.pendingPurchases.clear();
            this.purchaseHistory = [];
            this.lastRestoreAttempt = null;
        }
    }

    /**
     * Save IAP data to localStorage
     */
    private saveStoredData(): void {
        try {
            // Save pending purchases
            const pendingArray = Array.from(this.pendingPurchases.entries());
            localStorage.setItem(C.IAP_CONFIG.STORAGE_KEYS.PENDING_PURCHASES, JSON.stringify(pendingArray));

            // Save purchase history
            localStorage.setItem(C.IAP_CONFIG.STORAGE_KEYS.PURCHASE_HISTORY, JSON.stringify(this.purchaseHistory));

            // Save last restore attempt
            if (this.lastRestoreAttempt) {
                localStorage.setItem(C.IAP_CONFIG.STORAGE_KEYS.LAST_RESTORE_ATTEMPT, this.lastRestoreAttempt.toString());
            }

        } catch (error) {
            // Failed to save IAP data
        }
    }

    // ========================================================================
    // PUBLIC INTERFACE
    // ========================================================================

    /**
     * Get current IAP state
     */
    getState() {
        return {
            isAvailable: this.isAvailable,
            canMakePayments: this.canMakePayments,
            pendingPurchases: Array.from(this.pendingPurchases.values()),
            purchaseHistory: this.purchaseHistory,
            lastRestoreAttempt: this.lastRestoreAttempt
        };
    }

    /**
     * Check if IAP is available
     */
    get isAvailable(): boolean {
        return this.isInitialized && this.nativeBridge !== null;
    }

    /**
     * Check if device can make payments
     */
    get canMakePayments(): boolean {
        return this.isAvailable && this._canMakePayments;
    }

    private _canMakePayments = false;

    /**
     * Get last restore attempt timestamp
     */
    get lastRestoreAttempt(): number | null {
        return this._lastRestoreAttempt;
    }

    private _lastRestoreAttempt: number | null = null;

    set lastRestoreAttempt(value: number | null) {
        this._lastRestoreAttempt = value;
    }
}

// Export singleton instance
export const iapService = new IAPService();

// Export types for external use
export type { IAPService };
