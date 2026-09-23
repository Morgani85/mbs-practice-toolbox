# Feature Flags - Executive Overview Module

This document explains how to control access to the Executive Overview module for testing and production deployment.

## Current Setup

The Executive Overview module uses environment-based feature flags to control visibility:

### Development Environment
- **Always Available**: The module appears in the main menu automatically when running locally (`npm run dev`)
- **Direct Access**: Always accessible via `/overview` URL

### Production Environment  
- **Hidden by Default**: Module doesn't appear in main menu unless explicitly enabled
- **Direct Access**: Still accessible via `/overview` URL even when hidden from menu
- **Environment Control**: Can be enabled by setting `VITE_ENABLE_OVERVIEW=true`

## How to Use

### Option 1: Test via Direct URL (Recommended for Development)
Access the Executive Overview directly without showing it in the main menu:
```
https://app.practicetoolbox.co.uk/overview
```
This works in both development and production, regardless of the feature flag setting.

### Option 2: Environment Variable Control
To show the module in the main menu on production:

1. **In your deployment environment variables**, add:
   ```
   VITE_ENABLE_OVERVIEW=true
   ```

2. **Redeploy the application**

3. **The module will appear in the main menu** for all users

### Option 3: Toggle for Testing
To quickly test with the module visible:

1. **Set environment variable**: `VITE_ENABLE_OVERVIEW=true`
2. **Deploy to staging/test environment**
3. **Test thoroughly**
4. **Remove variable** or set to `false` before production deployment

## Deployment Strategy

### Recommended Workflow:
1. **Development**: Test using direct URL `/overview` - module always available
2. **Staging**: Deploy with `VITE_ENABLE_OVERVIEW=true` for full testing
3. **Production**: Deploy without the flag (module hidden from menu but accessible via URL)
4. **Go-Live**: Add `VITE_ENABLE_OVERVIEW=true` when ready to make it public

### Emergency Hiding:
If you need to quickly hide the module:
1. Remove `VITE_ENABLE_OVERVIEW` environment variable
2. Redeploy
3. Module disappears from main menu but remains accessible via direct URL

## Technical Details

- **Feature Flag Location**: `client/src/pages/area-selector.tsx`
- **Logic**: `import.meta.env.DEV || import.meta.env.VITE_ENABLE_OVERVIEW === 'true'`
- **Route**: Always available at `/overview` regardless of flag
- **Menu Visibility**: Controlled by the `available` property in the modules array

## Benefits

✓ **Flexible Testing**: Access module anytime via direct URL
✓ **Production Control**: Hide from general users while allowing specific access  
✓ **Quick Toggle**: Enable/disable via environment variable without code changes
✓ **Emergency Response**: Rapidly hide module if issues are discovered
✓ **Staged Rollout**: Test thoroughly before making publicly visible