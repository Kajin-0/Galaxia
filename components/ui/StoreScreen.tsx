import React, { useState, useEffect } from 'react';
import { playSound } from '../../sounds';
import { ScreenOverlay, CrystaliteIcon, AnimatedNumber } from './shared';
import * as C from '../../constants';
import type { IAPProductId, GameAction } from '../../types';

interface StoreScreenProps {
    dispatch: React.Dispatch<GameAction>;
    crystalite: number;
    iapState: {
        currentPurchase: {
            state: 'idle' | 'initiating' | 'purchasing' | 'validating' | 'success' | 'failed' | 'restoring';
            productId: IAPProductId | null;
            error: any;
            progress: number;
        };
        isAvailable: boolean;
        canMakePayments: boolean;
    };
}

export const StoreScreen: React.FC<StoreScreenProps> = ({ 
    dispatch,
    crystalite,
    iapState
}) => {
    const [showSuccessMessage, setShowSuccessMessage] = useState(false);
    const [showErrorMessage, setShowErrorMessage] = useState(false);

    // Handle purchase state changes
    useEffect(() => {
        if (iapState.currentPurchase.state === 'success') {
            setShowSuccessMessage(true);
            setTimeout(() => {
                setShowSuccessMessage(false);
                dispatch({ type: 'CLEAR_PURCHASE_STATE' });
            }, 3000);
        } else if (iapState.currentPurchase.state === 'failed') {
            setShowErrorMessage(true);
            setTimeout(() => {
                setShowErrorMessage(false);
                dispatch({ type: 'CLEAR_PURCHASE_ERROR' });
            }, 5000);
        }
    }, [iapState.currentPurchase.state, dispatch]);

    const handlePurchase = (productId: IAPProductId) => {
        playSound('purchase');
        dispatch({ type: 'INITIATE_PURCHASE', productId });
    };

    const handleRestorePurchases = () => {
        playSound('uiClick');
        dispatch({ type: 'RESTORE_PURCHASES_STARTED' });
    };

    const getPurchaseButtonText = (productId: IAPProductId) => {
        if (iapState.currentPurchase.state === 'idle') {
            return 'Buy';
        }
        
        if (iapState.currentPurchase.productId === productId) {
            switch (iapState.currentPurchase.state) {
                case 'initiating': return 'Contacting Store...';
                case 'purchasing': return 'Processing...';
                case 'validating': return 'Verifying...';
                case 'success': return 'Success!';
                case 'failed': return 'Failed - Retry';
                case 'restoring': return 'Restoring...';
                default: return 'Buy';
            }
        }
        
        return 'Buy';
    };

    const getPurchaseButtonDisabled = (productId: IAPProductId) => {
        // FIX: Corrected logic to allow retrying a failed purchase.
        // The button should be disabled if a purchase is actively in progress,
        // but not if it has failed or is idle.
        const purchaseInProgress =
            iapState.currentPurchase.state !== 'idle' &&
            iapState.currentPurchase.state !== 'failed';

        return !iapState.isAvailable ||
               !iapState.canMakePayments ||
               purchaseInProgress;
    };

    const getPurchaseButtonClassName = (productId: IAPProductId, color: string) => {
        const baseClasses = `mt-4 w-full px-4 py-3 font-bold text-sm sm:text-base rounded-lg shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900`;
        
        if (iapState.currentPurchase.productId === productId) {
            switch (iapState.currentPurchase.state) {
                case 'success':
                    return `${baseClasses} text-white bg-green-500 shadow-green-500/30 hover:bg-green-400 focus:ring-green-500`;
                case 'failed':
                    return `${baseClasses} text-white bg-red-500 shadow-red-500/30 hover:bg-red-400 focus:ring-red-500`;
                default:
                    return `${baseClasses} text-slate-900 bg-${color}-400 shadow-${color}-500/30 hover:bg-${color}-300 hover:shadow-lg focus:ring-${color}-500`;
            }
        }
        
        return `${baseClasses} text-slate-900 bg-${color}-400 shadow-${color}-500/30 hover:bg-${color}-300 hover:shadow-lg focus:ring-${color}-500`;
    };

    const getProgressBar = () => {
        if (iapState.currentPurchase.state === 'idle') return null;
        
        return (
            <div className="mt-4 w-full max-w-md bg-slate-700 rounded-full h-2">
                <div 
                    className="bg-gradient-to-r from-cyan-400 to-purple-500 h-2 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${iapState.currentPurchase.progress}%` }}
                />
            </div>
        );
    };

    const getStatusMessage = () => {
        if (iapState.currentPurchase.state === 'idle') return null;
        
        const messages = {
            initiating: 'Contacting App Store...',
            purchasing: 'Processing payment...',
            validating: 'Verifying purchase...',
            success: 'Purchase successful!',
            failed: 'Purchase failed',
            restoring: 'Restoring purchases...'
        };
        
        return (
            <div className="mt-2 text-center">
                <p className={`text-sm font-medium ${
                    iapState.currentPurchase.state === 'success' ? 'text-green-400' :
                    iapState.currentPurchase.state === 'failed' ? 'text-red-400' :
                    'text-cyan-400'
                }`}>
                    {messages[iapState.currentPurchase.state]}
                </p>
            </div>
        );
    };

    return (
        <ScreenOverlay>
            <div className="w-full h-full flex flex-col items-center">
                <h1 className="text-5xl md:text-6xl font-black uppercase tracking-widest text-cyan-300" style={{ textShadow: '0 0 15px #0ff' }}>
                    Store
                </h1>
                
                <div className="mt-2 flex items-center justify-center gap-2 text-slate-300 text-xl sm:text-2xl">
                    <span className="flex items-center gap-2 text-purple-400" title="Crystalite">
                        <CrystaliteIcon />
                        <AnimatedNumber value={crystalite} />
                    </span>
                </div>

                {/* IAP Status Messages */}
                {getProgressBar()}
                {getStatusMessage()}

                {/* Success/Error Messages */}
                {showSuccessMessage && (
                    <div className="mt-4 px-6 py-3 bg-green-500/20 border border-green-500/50 rounded-lg">
                        <p className="text-green-400 font-medium text-center">
                            ✅ Purchase completed successfully! Crystalite added to your account.
                        </p>
                    </div>
                )}

                {showErrorMessage && iapState.currentPurchase.error && (
                    <div className="mt-4 px-6 py-3 bg-red-500/20 border border-red-500/50 rounded-lg max-w-md">
                        <p className="text-red-400 font-medium text-center">
                            ❌ {iapState.currentPurchase.error.message || 'Purchase failed. Please try again.'}
                        </p>
                    </div>
                )}

                {/* Store Items */}
                <div className="mt-6 w-full max-w-4xl flex-grow overflow-y-auto p-1 pr-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Object.values(C.IAP_PRODUCTS).map(product => (
                            <div key={product.id} className={`flex flex-col items-center bg-slate-800/70 p-4 rounded-lg border-2 border-${product.color}-500/50`}>
                                <div className="flex-shrink-0 flex items-center justify-center h-32">
                                    <CrystaliteIcon className={`${product.iconSize} ${product.iconColor}`} />
                                </div>
                                
                                <div className="text-center mt-2 flex-grow">
                                    <p className={`font-bold text-lg sm:text-xl text-${product.color}-300`}>
                                        {product.name}
                                    </p>
                                    <p className="text-base text-slate-300 flex items-center justify-center gap-1">
                                        {product.amount.toLocaleString()} <CrystaliteIcon className="h-5 w-5" />
                                    </p>
                                    <p className="text-sm text-slate-400 mt-1">
                                        {product.id}
                                    </p>
                                </div>
                                
                                <button
                                    onClick={() => handlePurchase(product.id)}
                                    disabled={getPurchaseButtonDisabled(product.id)}
                                    className={getPurchaseButtonClassName(product.id, product.color)}
                                >
                                    {getPurchaseButtonText(product.id)} ({product.price})
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="my-6 flex flex-col sm:flex-row gap-4">
                    <button
                        onClick={handleRestorePurchases}
                        disabled={!iapState.isAvailable || iapState.currentPurchase.state !== 'idle'}
                        className="px-6 py-3 text-lg font-bold text-white bg-blue-600 rounded-lg shadow-lg shadow-blue-800/30 transition-all
                                   hover:bg-blue-500 hover:shadow-xl hover:shadow-blue-700/50 focus:outline-none focus:ring-4 focus:ring-blue-500
                                   disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-blue-600 disabled:hover:shadow-lg"
                    >
                        Restore Purchases
                    </button>
                    
                    <button
                        onClick={() => {
                            playSound('uiClick');
                            dispatch({ type: 'RETURN_TO_MENU' });
                        }}
                        className="px-8 py-4 text-lg sm:text-xl font-bold text-white bg-slate-700 rounded-lg shadow-lg shadow-slate-800/30 transition-all
                                   hover:bg-slate-600 hover:shadow-xl hover:shadow-slate-700/50 focus:outline-none focus:ring-4 focus:ring-slate-500 transform hover:scale-105"
                    >
                        Back to Menu
                    </button>
                </div>

                {/* IAP Status Indicator */}
                {!iapState.isAvailable && (
                    <div className="mt-4 px-4 py-2 bg-yellow-500/20 border border-yellow-500/50 rounded-lg">
                        <p className="text-yellow-400 text-sm text-center">
                            ⚠️ In-App Purchases not available. Using development mode.
                        </p>
                    </div>
                )}
            </div>
        </ScreenOverlay>
    );
};