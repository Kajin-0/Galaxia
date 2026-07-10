import React, { useEffect, useState } from 'react';
import {
    AlertTriangle,
    ArrowLeft,
    CheckCircle2,
    Gem,
    RefreshCw,
    ShoppingBag,
    Sparkles,
} from 'lucide-react';
import { playSound } from '../../sounds';
import {
    AnimatedNumber,
    Badge,
    CrystaliteIcon,
    CurrencyChip,
    GlassPanel,
    NeonButton,
    ScreenShell,
} from './shared';
import * as C from '../../constants';
import type { GameAction, GameState, IAPProductId } from '../../types';

interface StoreScreenProps {
    dispatch: React.Dispatch<GameAction>;
    crystalite: number;
    iapState: GameState['iap'];
}

type StoreProduct = (typeof C.IAP_PRODUCTS)[keyof typeof C.IAP_PRODUCTS];
type StoreProductColor = StoreProduct['color'];
type StoreIconSize = StoreProduct['iconSize'];

const PRODUCT_STYLES: Record<StoreProductColor, {
    tone: 'cyan' | 'gold' | 'violet';
    title: string;
    icon: string;
    aura: string;
}> = {
    cyan: {
        tone: 'cyan',
        title: 'text-cyan-100',
        icon: 'text-cyan-200',
        aura: 'bg-cyan-400/10 border-cyan-300/25',
    },
    yellow: {
        tone: 'gold',
        title: 'text-yellow-100',
        icon: 'text-yellow-200',
        aura: 'bg-yellow-300/10 border-yellow-300/25',
    },
    purple: {
        tone: 'violet',
        title: 'text-violet-100',
        icon: 'text-violet-200',
        aura: 'bg-violet-400/10 border-violet-300/25',
    },
};

const PRODUCT_ICON_SIZES: Record<StoreIconSize, string> = {
    'h-12 w-12': 'h-8 w-8',
    'h-16 w-16': 'h-9 w-9',
    'h-20 w-20': 'h-10 w-10',
    'h-24 w-24': 'h-11 w-11',
    'h-28 w-28': 'h-12 w-12',
    'h-32 w-32': 'h-14 w-14',
};

const PURCHASE_MESSAGES = {
    idle: '',
    initiating: 'Contacting App Store...',
    purchasing: 'Processing payment...',
    validating: 'Verifying purchase...',
    success: 'Purchase successful. Crystalite balance updated.',
    failed: 'Purchase failed. You can retry the selected bundle.',
    restoring: 'Restoring purchases...',
} as const;

export const StoreScreen: React.FC<StoreScreenProps> = ({
    dispatch,
    crystalite,
    iapState,
}) => {
    const [showSuccessMessage, setShowSuccessMessage] = useState(false);
    const [showErrorMessage, setShowErrorMessage] = useState(false);

    useEffect(() => {
        let timeoutId: number | undefined;
        if (iapState.currentPurchase.state === 'success') {
            setShowErrorMessage(false);
            setShowSuccessMessage(true);
            timeoutId = window.setTimeout(() => {
                setShowSuccessMessage(false);
                dispatch({ type: 'CLEAR_PURCHASE_STATE' });
            }, 3000);
        } else if (iapState.currentPurchase.state === 'failed') {
            setShowSuccessMessage(false);
            setShowErrorMessage(true);
            timeoutId = window.setTimeout(() => {
                setShowErrorMessage(false);
                dispatch({ type: 'CLEAR_PURCHASE_ERROR' });
            }, 5000);
        }

        return () => {
            if (timeoutId !== undefined) window.clearTimeout(timeoutId);
        };
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
        if (iapState.currentPurchase.state === 'idle') return 'Buy';

        if (iapState.currentPurchase.productId === productId) {
            switch (iapState.currentPurchase.state) {
                case 'initiating': return 'Contacting Store...';
                case 'purchasing': return 'Processing...';
                case 'validating': return 'Verifying...';
                case 'success': return 'Success';
                case 'failed': return 'Failed - Retry';
                case 'restoring': return 'Restoring...';
                default: return 'Buy';
            }
        }

        return 'Buy';
    };

    const getPurchaseButtonDisabled = (_productId: IAPProductId) => {
        const purchaseInProgress = iapState.currentPurchase.state !== 'idle'
            && iapState.currentPurchase.state !== 'failed';

        return !iapState.isAvailable
            || !iapState.canMakePayments
            || purchaseInProgress;
    };

    const statusTone = iapState.currentPurchase.state === 'success'
        ? 'text-lime-300'
        : iapState.currentPurchase.state === 'failed'
            ? 'text-red-300'
            : 'text-cyan-300';

    const titleId = 'store-screen-title';
    const purchaseState = iapState.currentPurchase.state;
    const purchaseActive = purchaseState !== 'idle';

    return (
        <ScreenShell titleId={titleId} contentClassName="py-2 sm:py-5">
            <main className="flex w-full max-w-5xl flex-col items-center pb-2 text-center">
                <header className="w-full shrink-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-violet-300/80">Crystalite Exchange</p>
                    <h1 id={titleId} className="neon-title mt-1 text-3xl font-black uppercase sm:text-4xl">Store</h1>
                    <div className="mt-3 flex justify-center">
                        <CurrencyChip
                            icon={<CrystaliteIcon className="h-5 w-5" />}
                            label="Crystalite"
                            value={<AnimatedNumber value={crystalite} />}
                            tone="violet"
                        />
                    </div>
                </header>

                <section
                    className="mt-3 min-h-10 w-full max-w-lg"
                    aria-live="polite"
                    aria-atomic="true"
                    aria-busy={purchaseActive && purchaseState !== 'success' && purchaseState !== 'failed'}
                >
                    {purchaseActive && (
                        <div className="w-full">
                            <div
                                className="h-1.5 w-full overflow-hidden rounded-full border border-slate-600/70 bg-slate-950"
                                role="progressbar"
                                aria-label="Purchase progress"
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-valuenow={iapState.currentPurchase.progress}
                            >
                                <div
                                    className="h-full origin-left bg-cyan-400 shadow-neon-cyan transition-transform duration-300 ease-expo"
                                    style={{ transform: `scaleX(${Math.min(100, Math.max(0, iapState.currentPurchase.progress)) / 100})` }}
                                />
                            </div>
                            <p className={`mt-2 text-xs font-bold ${statusTone}`}>{PURCHASE_MESSAGES[purchaseState]}</p>
                        </div>
                    )}

                    {showSuccessMessage && (
                        <div className="mt-2 flex items-center justify-center gap-2 text-sm font-bold text-lime-200" role="status">
                            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                            Crystalite added to your account.
                        </div>
                    )}

                    {showErrorMessage && iapState.currentPurchase.error && (
                        <div className="mt-2 flex items-start justify-center gap-2 text-sm font-bold text-red-200" role="alert">
                            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                            <span>{iapState.currentPurchase.error.message || 'Purchase failed. Please try again.'}</span>
                        </div>
                    )}
                </section>

                <section aria-label="Crystalite bundles" className="mt-3 grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {Object.values(C.IAP_PRODUCTS).map((product, index) => {
                        const style = PRODUCT_STYLES[product.color];
                        const isSelectedProduct = iapState.currentPurchase.productId === product.id;
                        const isSuccess = isSelectedProduct && purchaseState === 'success';
                        const isFailed = isSelectedProduct && purchaseState === 'failed';
                        const bundleLabel = index === 2
                            ? 'Popular'
                            : index === Object.values(C.IAP_PRODUCTS).length - 1
                                ? 'Maximum Reserve'
                                : null;

                        return (
                            <GlassPanel
                                key={product.id}
                                tone={style.tone}
                                interactive
                                className="flex min-h-52 flex-col p-4 text-left"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-md border ${style.aura}`}>
                                        <span className="relative">
                                            <Gem className={`${PRODUCT_ICON_SIZES[product.iconSize]} ${style.icon}`} strokeWidth={1.5} aria-hidden="true" />
                                            <Sparkles className="absolute -right-2 -top-2 h-4 w-4 text-white/75" aria-hidden="true" />
                                        </span>
                                    </div>
                                    {bundleLabel && <Badge tone={style.tone}>{bundleLabel}</Badge>}
                                </div>

                                <div className="mt-3 min-w-0 flex-1">
                                    <h2 className={`text-base font-black uppercase sm:text-lg ${style.title}`}>{product.name}</h2>
                                    <p className="mt-1 flex items-center gap-1.5 font-mono text-lg font-black tabular-nums text-slate-100">
                                        {product.amount.toLocaleString()}
                                        <CrystaliteIcon className={`h-5 w-5 ${style.icon}`} />
                                    </p>
                                    <p className="mt-1 text-xs text-slate-400">Secure one-time Crystalite delivery</p>
                                </div>

                                <NeonButton
                                    fullWidth
                                    variant={isFailed ? 'danger' : isSuccess ? 'secondary' : 'primary'}
                                    className={isSuccess ? 'border-lime-300/50 bg-lime-900/70 text-lime-100' : undefined}
                                    icon={isSuccess
                                        ? <CheckCircle2 className="h-4 w-4" />
                                        : <ShoppingBag className="h-4 w-4" />}
                                    onClick={() => handlePurchase(product.id)}
                                    disabled={getPurchaseButtonDisabled(product.id)}
                                    aria-label={`${getPurchaseButtonText(product.id)} ${product.name} for ${product.price}`}
                                >
                                    {getPurchaseButtonText(product.id)} - {product.price}
                                </NeonButton>
                            </GlassPanel>
                        );
                    })}
                </section>

                {!iapState.isAvailable && (
                    <div className="mt-4 flex w-full max-w-lg items-start justify-center gap-2 text-sm text-yellow-200" role="status">
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                        <span>In-app purchases are unavailable. Development mode remains active.</span>
                    </div>
                )}

                <footer className="mt-5 grid w-full max-w-lg grid-cols-1 gap-2 pb-1 min-[420px]:grid-cols-2">
                    <NeonButton
                        variant="secondary"
                        icon={<RefreshCw className="h-5 w-5" />}
                        onClick={handleRestorePurchases}
                        disabled={!iapState.isAvailable || iapState.currentPurchase.state !== 'idle'}
                    >
                        Restore Purchases
                    </NeonButton>
                    <NeonButton
                        variant="quiet"
                        icon={<ArrowLeft className="h-5 w-5" />}
                        onClick={() => {
                            playSound('uiClick');
                            dispatch({ type: 'RETURN_TO_MENU' });
                        }}
                    >
                        Back to Menu
                    </NeonButton>
                </footer>
            </main>
        </ScreenShell>
    );
};
