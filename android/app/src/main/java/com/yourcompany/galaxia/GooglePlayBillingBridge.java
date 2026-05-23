package com.yourcompany.galaxia;

import android.app.Activity;
import android.content.Context;
import com.android.billingclient.api.*;
import org.json.JSONObject;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Google Play Billing Bridge for Galaxia
 * Implements client-only consumables with proper consumption pattern
 * Follows Google Play Billing v7+ best practices
 */
public class GooglePlayBillingBridge implements PurchasesUpdatedListener, BillingClientStateListener {
    
    private BillingClient billingClient;
    private Context context;
    private Set<String> processedTokens;
    private boolean isConnected = false;
    
    // Product IDs from constants.ts
    private final List<String> productIds = Arrays.asList(
        "com.galaxia.crystalite_100",
        "com.galaxia.crystalite_550", 
        "com.galaxia.crystalite_1200",
        "com.galaxia.crystalite_2500",
        "com.galaxia.crystalite_7000",
        "com.galaxia.crystalite_15000"
    );
    
    public GooglePlayBillingBridge(Context context) {
        this.context = context;
        this.processedTokens = Collections.newSetFromMap(new ConcurrentHashMap<>());
        initializeBilling();
    }
    
    private void initializeBilling() {
        billingClient = BillingClient.newBuilder(context)
            .setListener(this)
            .enablePendingPurchases()
            .build();
        
        billingClient.startConnection(this);
    }
    
    @Override
    public void onBillingSetupFinished(BillingResult billingResult) {
        isConnected = billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK;
        if (isConnected) {
            System.out.println("Google Play Billing setup finished successfully");
            // Reconcile any pending purchases on startup
            reconcilePurchases();
        } else {
            System.out.println("Billing setup failed: " + billingResult.getDebugMessage());
        }
    }
    
    @Override
    public void onBillingServiceDisconnected() {
        isConnected = false;
        System.out.println("Billing service disconnected");
    }
    
    @Override
    public void onPurchasesUpdated(BillingResult billingResult, List<Purchase> purchases) {
        if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK && purchases != null) {
            for (Purchase purchase : purchases) {
                if (purchase.getPurchaseState() == Purchase.PurchaseState.PURCHASED && 
                    !processedTokens.contains(purchase.getPurchaseToken())) {
                    // Never grant here - consume first
                    consumePurchase(purchase);
                }
            }
        } else {
            System.out.println("Purchase failed: " + billingResult.getDebugMessage());
        }
    }
    
    private void consumePurchase(Purchase purchase) {
        ConsumeParams consumeParams = ConsumeParams.newBuilder()
            .setPurchaseToken(purchase.getPurchaseToken())
            .build();
        
        billingClient.consumeAsync(consumeParams, (billingResult, purchaseToken) -> {
            if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                processedTokens.add(purchaseToken);
                // Now grant the currency
                grantConsumable(purchase);
            } else {
                System.out.println("Consume failed: " + billingResult.getDebugMessage());
                // Retry later in reconciliation
            }
        });
    }
    
    private void grantConsumable(Purchase purchase) {
        String productId = purchase.getProducts().get(0);
        int amount = getProductAmount(productId);
        
        JSONObject receipt = new JSONObject();
        try {
            receipt.put("transactionId", purchase.getOrderId() != null ? purchase.getOrderId() : purchase.getPurchaseToken());
            receipt.put("productId", productId);
            receipt.put("purchaseDate", String.valueOf(purchase.getPurchaseTime()));
            receipt.put("androidReceipt", purchase.getOriginalJson());
        } catch (Exception e) {
            System.err.println("Error creating receipt: " + e.getMessage());
            return;
        }
        
        // Send to JavaScript via Capacitor
        sendPurchaseSuccess(receipt, amount);
    }
    
    private int getProductAmount(String productId) {
        switch (productId) {
            case "com.galaxia.crystalite_100": return 100;
            case "com.galaxia.crystalite_550": return 550;
            case "com.galaxia.crystalite_1200": return 1200;
            case "com.galaxia.crystalite_2500": return 2500;
            case "com.galaxia.crystalite_7000": return 7000;
            case "com.galaxia.crystalite_15000": return 15000;
            default: return 0;
        }
    }
    
    private void sendPurchaseSuccess(JSONObject receipt, int amount) {
        // This will be called by Capacitor to send data to JavaScript
        // The actual implementation will be handled by the Capacitor plugin
        try {
            System.out.println("Purchase successful: " + receipt.getString("productId") + ", amount: " + amount);
        } catch (Exception e) {
            System.err.println("Error processing purchase success: " + e.getMessage());
        }
        
        // TODO: Implement Capacitor bridge to send data to JavaScript
        // This would trigger the IAP service's handleNativePurchaseCompletion method
    }
    
    public void initiatePurchase(String productId, Activity activity) {
        if (!isConnected) {
            System.out.println("Billing not connected");
            return;
        }
        
        try {
            QueryProductDetailsParams.Product product = QueryProductDetailsParams.Product.newBuilder()
                .setProductId(productId)
                .setProductType(BillingClient.ProductType.INAPP)
                .build();
            
            List<QueryProductDetailsParams.Product> productList = Arrays.asList(product);
            QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
                .setProductList(productList)
                .build();
            
            billingClient.queryProductDetailsAsync(params, (billingResult, productDetailsList) -> {
                if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK && 
                    !productDetailsList.isEmpty()) {
                    
                    ProductDetails productDetails = productDetailsList.get(0);
                    List<BillingFlowParams.ProductDetailsParams> productDetailsParamsList = Arrays.asList(
                        BillingFlowParams.ProductDetailsParams.newBuilder()
                            .setProductDetails(productDetails)
                            .build()
                    );
                    
                    BillingFlowParams billingFlowParams = BillingFlowParams.newBuilder()
                        .setProductDetailsParamsList(productDetailsParamsList)
                        .setObfuscatedAccountId("galaxia_user") // Optional user ID
                        .build();
                    
                    billingClient.launchBillingFlow(activity, billingFlowParams);
                } else {
                    System.out.println("Product not found: " + productId);
                }
            });
        } catch (Exception e) {
            System.out.println("Purchase initiation failed: " + e.getMessage());
        }
    }
    
    public void restorePurchases() {
        if (!isConnected) {
            System.out.println("Billing not connected");
            return;
        }
        
        reconcilePurchases();
    }
    
    private void reconcilePurchases() {
        QueryPurchasesParams params = QueryPurchasesParams.newBuilder()
            .setProductType(BillingClient.ProductType.INAPP)
            .build();
        
        billingClient.queryPurchasesAsync(params, (billingResult, purchases) -> {
            if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                for (Purchase purchase : purchases) {
                    if (purchase.getPurchaseState() == Purchase.PurchaseState.PURCHASED && 
                        !processedTokens.contains(purchase.getPurchaseToken())) {
                        consumePurchase(purchase);
                    }
                }
            }
        });
    }
    
    public boolean canMakePayments() {
        return isConnected;
    }
    
    public List<String> getAvailableProducts() {
        return new ArrayList<>(productIds);
    }
    
    public void cleanup() {
        if (billingClient != null) {
            billingClient.endConnection();
        }
    }
}
