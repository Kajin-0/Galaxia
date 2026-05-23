# Galaxia In-App Purchase Implementation Guide

## Overview

This document describes the secure, production-ready in-app purchase (IAP) system implemented for Galaxia. The system follows security best practices and is designed to work seamlessly with both web development and native mobile app stores.

## Architecture

### Security-First Design

The IAP system implements multiple layers of security:

1. **Client-Side Validation**: Basic input validation and state management
2. **Native Bridge**: Secure communication with platform-specific IAP systems
3. **Server-Side Validation**: Receipt verification with Apple/Google servers
4. **Idempotency**: Prevents duplicate purchases and currency grants
5. **Audit Trail**: Comprehensive logging of all purchase attempts

### System Components

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   StoreScreen   │───▶│   IAP Service    │───▶│  Native Bridge  │
│   (UI Layer)    │    │  (Business Logic)│    │ (Platform IAP)  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │                       ▼                       │
         │              ┌──────────────────┐             │
         │              │  Backend Server  │             │
         │              │ (Receipt Validation)            │
         └──────────────┼──────────────────┼─────────────┘
                        │  Game State     │
                        │  (Currency)     │
                        └──────────────────┘
```

## Implementation Details

### 1. Product Configuration

Products are defined in `constants.ts` with proper App Store/Play Store IDs:

```typescript
export const IAP_PRODUCTS = {
    CRYSTALITE_100: {
        id: 'com.galaxia.crystalite_100',  // Must match App Store/Play Store
        name: 'Sack of Crystalite',
        amount: 100,
        price: '$0.99',
        color: 'cyan',
        iconSize: 'h-12 w-12',
        iconColor: 'text-cyan-300'
    },
    // ... more products
};
```

**Important**: Product IDs must exactly match what's configured in:
- Apple App Store Connect
- Google Play Console

### 2. Native Bridge Interface

The system provides a clean interface for mobile developers:

```typescript
interface NativePurchaseBridge {
    initiatePurchase: (productId: IAPProductId) => Promise<PurchaseReceipt>;
    restorePurchases: () => Promise<PurchaseReceipt[]>;
    canMakePayments: () => Promise<boolean>;
    getAvailableProducts: () => Promise<IAPProductId[]>;
}
```

### 3. Purchase Flow

1. **Initiation**: User clicks purchase button
2. **Native Call**: App calls platform IAP (StoreKit/Play Billing)
3. **Receipt Generation**: Platform returns purchase receipt
4. **Server Validation**: Receipt sent to backend for verification
5. **Currency Grant**: Only after successful validation
6. **State Update**: UI reflects completion

### 4. Error Handling

Comprehensive error categorization:

```typescript
type PurchaseErrorType = 
    | 'user_cancelled'
    | 'network_error'
    | 'validation_failed'
    | 'server_error'
    | 'insufficient_funds'
    | 'product_unavailable'
    | 'receipt_invalid'
    | 'duplicate_purchase'
    | 'unknown';
```

## Mobile Developer Integration

### iOS (StoreKit)

```swift
// In your iOS app
class IAPBridge: NSObject {
    func initiatePurchase(productId: String) -> Promise<PurchaseReceipt> {
        return Promise { resolve, reject in
            // 1. Request product from StoreKit
            let request = SKProductsRequest(productIdentifiers: [productId])
            
            // 2. Handle product response
            // 3. Create payment request
            // 4. Process payment
            // 5. Return receipt data
        }
    }
}

// Expose to JavaScript
window.nativePurchaseHandler = IAPBridge()
```

### Android (Play Billing)

```kotlin
// In your Android app
class IAPBridge {
    suspend fun initiatePurchase(productId: String): PurchaseReceipt {
        // 1. Query available products
        // 2. Launch billing flow
        // 3. Handle purchase result
        // 4. Return receipt data
    }
}

// Expose to JavaScript via WebView
webView.addJavascriptInterface(IAPBridge(), "nativePurchaseHandler")
```

## Backend Server Requirements

### Receipt Validation Endpoint

```typescript
POST /api/validate-purchase
{
    "receipt": {
        "transactionId": "string",
        "productId": "string",
        "purchaseDate": "ISO string",
        "iosReceipt": "base64 string",  // iOS only
        "androidReceipt": "string"      // Android only
    },
    "platform": "ios" | "android",
    "userId": "string"  // Optional
}
```

### Response Format

```typescript
{
    "success": true,
    "isValid": true,
    "amount": 100,
    "error": null,
    "timestamp": 1234567890
}
```

### Validation Logic

1. **iOS**: Send receipt to Apple's verification servers
2. **Android**: Verify purchase token with Google Play
3. **Check**: Product ID, amount, transaction status
4. **Prevent**: Duplicate processing, expired receipts

## Development & Testing

### Web Fallback

During development, the system uses a web fallback that simulates the purchase flow:

- Confirms purchases with browser dialog
- Generates mock receipts
- Simulates network delays
- Provides realistic testing experience

### Testing Checklist

- [ ] Product IDs match App Store/Play Store
- [ ] Purchase flow completes successfully
- [ ] Receipt validation works
- [ ] Currency granted correctly
- [ ] Error handling works
- [ ] Purchase restoration works
- [ ] Duplicate prevention works

## Production Deployment

### 1. Configure Products

- Set up products in App Store Connect
- Configure products in Google Play Console
- Ensure product IDs match exactly

### 2. Backend Setup

- Deploy validation server
- Configure Apple/Google API credentials
- Set up monitoring and logging

### 3. App Store Submission

- Test with sandbox accounts
- Verify IAP functionality
- Submit for review

### 4. Monitoring

- Track purchase success rates
- Monitor validation failures
- Log all transactions for audit

## Security Considerations

### Never Trust the Client

- All purchases must be validated server-side
- Receipt data must be verified with platform servers
- Currency should only be granted after validation

### Receipt Security

- Store receipts securely
- Validate receipt signatures
- Check for tampering

### User Privacy

- Minimize data collection
- Secure user information
- Comply with privacy regulations

## Troubleshooting

### Common Issues

1. **Product Not Available**
   - Check product ID spelling
   - Verify App Store/Play Store configuration
   - Ensure product is approved

2. **Purchase Fails**
   - Check network connectivity
   - Verify receipt format
   - Review server logs

3. **Currency Not Granted**
   - Check validation response
   - Verify receipt data
   - Review purchase history

### Debug Mode

Enable debug logging:

```typescript
// In development
localStorage.setItem('galaxia_iap_debug', 'true');
```

## Support

For technical support or questions about the IAP implementation:

1. Check this documentation
2. Review console logs for errors
3. Verify product configuration
4. Test with sandbox accounts
5. Contact development team

## Future Enhancements

- Subscription support
- Promotional offers
- Family sharing
- Cross-platform purchase sync
- Advanced analytics
- A/B testing for pricing

---

**Note**: This IAP system is designed to be production-ready and follows industry best practices. Always test thoroughly before deploying to production.


