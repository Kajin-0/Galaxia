# Google Play Billing Setup Guide

## Overview

Your game is now configured for Google Play Billing with client-only consumables. This guide will help you complete the setup in Google Play Console.

## What's Been Implemented

✅ **Google Play Billing Library v7.0.0** - Added to Android build  
✅ **Native Android Bridge** - Handles purchase flow and consumption  
✅ **Capacitor Plugin** - Bridges native code with JavaScript  
✅ **Client-Only IAP Service** - No server validation needed  
✅ **Web Development Fallback** - For testing in browser  

## Google Play Console Setup

### 1. Create In-App Products

Go to **Google Play Console** → **Your App** → **Monetization** → **Products** → **In-app products**

Create these products with **exact** IDs:

| Product ID | Name | Price |
|------------|------|-------|
| `com.galaxia.crystalite_100` | Sack of Crystalite | $0.99 |
| `com.galaxia.crystalite_550` | Pile of Crystalite | $4.99 |
| `com.galaxia.crystalite_1200` | Chest of Crystalite | $9.99 |
| `com.galaxia.crystalite_2500` | Crate of Crystalite | $19.99 |
| `com.galaxia.crystalite_7000` | Vault of Crystalite | $49.99 |
| `com.galaxia.crystalite_15000` | Star-Tons of Crystalite | $99.99 |

### 2. Product Configuration

For each product:
- **Product ID**: Must match exactly (case-sensitive)
- **Name**: Display name in store
- **Description**: What the player gets
- **Price**: Set in your local currency
- **Status**: Set to **Active**

### 3. Testing Setup

1. **Upload APK** to Internal Testing track
2. **Add Test Accounts**:
   - Go to **Testing** → **License testing**
   - Add your Google account as a license tester
3. **Test Cards**: Use Google Play test cards for purchases

## Development Testing

### Web Development
```bash
npm run dev
```
- Uses web fallback for IAP testing
- Simulates purchase flow with browser dialogs
- No real money involved

### Android Testing
```bash
npm run build
npx cap sync android
npx cap run android
```
- Uses real Google Play Billing
- Requires test account setup
- Test with Google Play test cards

## Key Features

### ✅ Client-Only Security
- Google Play Billing handles security
- No server validation needed for consumables
- Proper consumption pattern prevents duplicates

### ✅ Automatic Reconciliation
- Handles app crashes during purchase
- Processes pending purchases on startup
- Prevents lost transactions

### ✅ Error Handling
- Comprehensive error categorization
- User-friendly error messages
- Automatic retry logic

### ✅ Development Friendly
- Web fallback for browser testing
- Detailed logging for debugging
- Easy to test purchase flows

## Testing Checklist

- [ ] Products created in Google Play Console
- [ ] APK uploaded to Internal Testing
- [ ] Test account added as license tester
- [ ] Purchase flow works end-to-end
- [ ] Currency granted correctly
- [ ] Duplicate purchases prevented
- [ ] App restart reconciles purchases
- [ ] Error handling works properly

## Production Deployment

1. **Test thoroughly** with Internal Testing
2. **Verify all products** work correctly
3. **Check error handling** with network issues
4. **Test purchase restoration** after app reinstall
5. **Submit for review** with IAP functionality

## Troubleshooting

### Common Issues

**"Product not available"**
- Check product ID spelling (case-sensitive)
- Verify product is Active in Play Console
- Ensure app is signed with release key

**"Purchase fails"**
- Check network connectivity
- Verify test account setup
- Review Google Play Console logs

**"Currency not granted"**
- Check consumption logic
- Verify purchase state is PURCHASED
- Review reconciliation process

### Debug Mode

Enable detailed logging:
```typescript
// In your app
localStorage.setItem('galaxia_iap_debug', 'true');
```

## Security Notes

- ✅ **Google Play Billing v7+** handles security
- ✅ **Consumption pattern** prevents duplicates  
- ✅ **Client-only approach** is safe for consumables
- ✅ **No server needed** for this implementation

## Next Steps

1. **Set up products** in Google Play Console
2. **Test with Internal Testing** track
3. **Verify purchase flow** works end-to-end
4. **Deploy to production** when ready

Your game is now ready for Google Play Billing! 🚀
