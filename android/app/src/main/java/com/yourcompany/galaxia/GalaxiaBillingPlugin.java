package com.yourcompany.galaxia;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import android.app.Activity;
import android.content.Context;
import org.json.JSONObject;

@CapacitorPlugin(name = "GalaxiaBilling")
public class GalaxiaBillingPlugin extends Plugin {
    
    private GooglePlayBillingBridge billingBridge;
    
    @Override
    public void load() {
        super.load();
        Context context = getContext();
        billingBridge = new GooglePlayBillingBridge(context);
    }
    
    @PluginMethod
    public void initiatePurchase(PluginCall call) {
        String productId = call.getString("productId");
        if (productId == null) {
            call.reject("Product ID is required");
            return;
        }
        
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity not available");
            return;
        }
        
        try {
            billingBridge.initiatePurchase(productId, activity);
            call.resolve();
        } catch (Exception e) {
            call.reject("Purchase initiation failed: " + e.getMessage());
        }
    }
    
    @PluginMethod
    public void restorePurchases(PluginCall call) {
        try {
            billingBridge.restorePurchases();
            call.resolve();
        } catch (Exception e) {
            call.reject("Restore failed: " + e.getMessage());
        }
    }
    
    @PluginMethod
    public void canMakePayments(PluginCall call) {
        boolean canMakePayments = billingBridge.canMakePayments();
        JSObject result = new JSObject();
        result.put("canMakePayments", canMakePayments);
        call.resolve(result);
    }
    
    @PluginMethod
    public void getAvailableProducts(PluginCall call) {
        try {
            java.util.List<String> products = billingBridge.getAvailableProducts();
            JSObject result = new JSObject();
            result.put("products", products);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to get products: " + e.getMessage());
        }
    }
    
    public void onDestroy() {
        if (billingBridge != null) {
            billingBridge.cleanup();
        }
    }
}
