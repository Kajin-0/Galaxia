package com.yourcompany.galaxia;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.WebView;
import android.webkit.WebSettings;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;
import com.yourcompany.galaxia.GalaxiaBillingPlugin;

public class MainActivity extends BridgeActivity {
    private boolean backswipeDisabled = false;
    private OnBackPressedCallback backPressedCallback;
    
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        registerPlugin(GalaxiaBillingPlugin.class);
        
        // Intercept back button/gesture at the Activity level
        backPressedCallback = new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                // Consume the back gesture - do nothing
                // This prevents the default back navigation behavior
            }
        };
        getOnBackPressedDispatcher().addCallback(this, backPressedCallback);
        
        // Try to disable backswipe immediately
        disableBackswipeGesture();
        
        // Also try with delays in case WebView initialization is async
        new Handler(Looper.getMainLooper()).postDelayed(new Runnable() {
            @Override
            public void run() {
                disableBackswipeGesture();
            }
        }, 100);
        
        new Handler(Looper.getMainLooper()).postDelayed(new Runnable() {
            @Override
            public void run() {
                disableBackswipeGesture();
            }
        }, 300);
        
        new Handler(Looper.getMainLooper()).postDelayed(new Runnable() {
            @Override
            public void run() {
                disableBackswipeGesture();
            }
        }, 500);
    }
    
    private void disableBackswipeGesture() {
        if (backswipeDisabled) return;
        
        WebView webView = this.bridge.getWebView();
        if (webView != null) {
            // Method 1: Disable overscroll (prevents edge swipe effects)
            webView.setOverScrollMode(WebView.OVER_SCROLL_NEVER);
            
            // Method 2: Disable horizontal scrollbars (reduces gesture recognition)
            webView.setHorizontalScrollBarEnabled(false);
            
            // Method 3: Configure WebView settings to minimize gesture interference
            WebSettings settings = webView.getSettings();
            if (settings != null) {
                // Disable built-in zoom controls (can interfere with gestures)
                settings.setBuiltInZoomControls(false);
                settings.setDisplayZoomControls(false);
            }
            
            backswipeDisabled = true;
        }
    }
}