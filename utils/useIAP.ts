import { useEffect, useCallback, useRef } from 'react';
import { iapService } from './iapService';
import { createNativeBridge, getBridgeStatus } from './nativeBridge';
import type { IAPProductId, PurchaseReceipt, PurchaseError } from '../types';

// ============================================================================
// IAP INTEGRATION HOOK
// ============================================================================
// This hook provides a clean interface for components to interact with the IAP system
// It handles initialization, purchase flow, and state management

export interface UseIAPReturn {
    // IAP State
    isAvailable: boolean;
    canMakePayments: boolean;
    currentPurchase: {
        state: 'idle' | 'initiating' | 'purchasing' | 'validating' | 'success' | 'failed' | 'restoring';
        productId: IAPProductId | null;
        error: PurchaseError | null;
        progress: number;
    };
    
    // Actions
    initiatePurchase: (productId: IAPProductId) => Promise<void>;
    restorePurchases: () => Promise<void>;
    clearPurchaseError: () => void;
    clearPurchaseState: () => void;
    
    // Status
    isInitialized: boolean;
    bridgeStatus: {
        isNative: boolean;
        isAvailable: boolean;
        errors: string[];
        warnings: string[];
    };
}

export function useIAP(
    dispatch: (action: any) => void,
    validationEndpoint?: string
): UseIAPReturn {
    const isInitialized = useRef(false);
    const bridgeStatus = useRef(getBridgeStatus());

    // Initialize IAP service
    useEffect(() => {
        if (isInitialized.current) return;

        const initializeIAP = async () => {
            try {
                // Create native bridge
                const nativeBridge = createNativeBridge();
                
                // Get validation endpoint (use provided one or default)
                const endpoint = validationEndpoint || 
                    (process.env.NODE_ENV === 'development' 
                        ? 'http://localhost:3001/api/validate-purchase' 
                        : 'https://your-backend.com/api/validate-purchase');

                // Initialize IAP service
                await iapService.initialize(nativeBridge, endpoint);
                
                // Update bridge status
                bridgeStatus.current = getBridgeStatus();
                
                // Update availability in game state
                const iapState = iapService.getState();
                dispatch({
                    type: 'IAP_AVAILABILITY_CHANGED',
                    isAvailable: iapState.isAvailable,
                    canMakePayments: iapState.canMakePayments
                });

                isInitialized.current = true;

            } catch (error) {
                
                // Set IAP as unavailable
                dispatch({
                    type: 'IAP_AVAILABILITY_CHANGED',
                    isAvailable: false,
                    canMakePayments: false
                });
            }
        };

        initializeIAP();
    }, [dispatch, validationEndpoint]);

    // Initiate purchase flow
    const initiatePurchase = useCallback(async (productId: IAPProductId) => {
        if (!isInitialized.current) {
            throw new Error('IAP system not initialized');
        }

        try {
            // Dispatch initial state
            dispatch({ type: 'INITIATE_PURCHASE', productId });
            
            // Start purchase through IAP service
            await iapService.initiatePurchase(productId);
            
            // Note: The IAP service will handle the rest of the flow
            // and dispatch appropriate actions through the game state
            
        } catch (error) {
            // Handle the error
            const purchaseError = error as PurchaseError;
            dispatch({ 
                type: 'PURCHASE_FAILED', 
                error: purchaseError, 
                productId 
            });
        }
    }, [dispatch]);

    // Restore purchases
    const restorePurchases = useCallback(async () => {
        if (!isInitialized.current) {
            throw new Error('IAP system not initialized');
        }

        try {
            dispatch({ type: 'RESTORE_PURCHASES_STARTED' });
            
            await iapService.restorePurchases();
            
            dispatch({ type: 'RESTORE_PURCHASES_COMPLETED', receipts: [] });
            
        } catch (error) {
            const purchaseError = error as PurchaseError;
            dispatch({ 
                type: 'RESTORE_PURCHASES_FAILED', 
                error: purchaseError 
            });
        }
    }, [dispatch]);

    // Clear purchase error
    const clearPurchaseError = useCallback(() => {
        dispatch({ type: 'CLEAR_PURCHASE_ERROR' });
    }, [dispatch]);

    // Clear purchase state
    const clearPurchaseState = useCallback(() => {
        dispatch({ type: 'CLEAR_PURCHASE_STATE' });
    }, [dispatch]);

    // Get current IAP state from the service
    const getCurrentState = useCallback(() => {
        if (!isInitialized.current) {
            return {
                isAvailable: false,
                canMakePayments: false,
                currentPurchase: {
                    state: 'idle' as const,
                    productId: null,
                    error: null,
                    progress: 0
                }
            };
        }

        const iapState = iapService.getState();
        return {
            isAvailable: iapState.isAvailable,
            canMakePayments: iapState.canMakePayments,
            currentPurchase: {
                state: 'idle' as const,
                productId: null,
                error: null,
                progress: 0
            }
        };
    }, []);

    return {
        ...getCurrentState(),
        initiatePurchase,
        restorePurchases,
        clearPurchaseError,
        clearPurchaseState,
        isInitialized: isInitialized.current,
        bridgeStatus: bridgeStatus.current
    };
}

// ============================================================================
// IAP SERVICE INTEGRATION
// ============================================================================
// These functions integrate the IAP service with the game state dispatcher

/**
 * Initialize IAP service with game state dispatcher
 * This allows the IAP service to update the game state directly
 */
export function initializeIAPWithGameState(dispatch: (action: any) => void) {
    // Override the IAP service's internal dispatch calls
    const originalCompletePurchase = (iapService as any).completePurchase;
    const originalHandlePurchaseFailure = (iapService as any).handlePurchaseFailure;
    
    if (originalCompletePurchase) {
        (iapService as any).completePurchase = async function(receipt: PurchaseReceipt, validationResult: any) {
            // Call original method
            await originalCompletePurchase.call(this, receipt, validationResult);
            
            // Dispatch to game state
            dispatch({
                type: 'PURCHASE_VALIDATION_COMPLETED',
                result: validationResult
            });
        };
    }
    
    if (originalHandlePurchaseFailure) {
        (iapService as any).handlePurchaseFailure = async function(productId: IAPProductId, error: PurchaseError) {
            // Call original method
            await originalHandlePurchaseFailure.call(this, productId, error);
            
            // Dispatch to game state
            dispatch({
                type: 'PURCHASE_FAILED',
                error,
                productId
            });
        };
    }
}

/**
 * Get IAP service instance for direct access
 */
export { iapService };

/**
 * Get bridge status for debugging
 */
export { getBridgeStatus };
