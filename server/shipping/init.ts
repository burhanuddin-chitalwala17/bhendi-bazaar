/**
 * Shipping Module Initialization
 * 
 * Auto-initializes shipping providers when the server starts.
 * Runs only on server-side, never in browser.
 */

import { shippingOrchestrator } from './services/orchestrator.service';
import { ShiprocketProvider } from './providers/shiprocket/shiprocket.provider';

let isInitialized = false;
let initPromise: Promise<void> | null = null;

/**
 * Initialize shipping module with all available providers
 */
export async function initializeShippingModule(): Promise<{
  success: boolean;
  message: string;
  providersLoaded?: number;
  error?: string;
}> {
  // Return immediately if already initialized
  if (isInitialized) {
    return { 
      success: true, 
      message: 'Shipping module already initialized',
      providersLoaded: shippingOrchestrator['providers'].size 
    };
  }

  // If initialization is in progress, wait for it
  if (initPromise) {
    await initPromise;
    return { 
      success: isInitialized, 
      message: isInitialized ? 'Initialized' : 'Initialization failed',
      providersLoaded: shippingOrchestrator['providers'].size 
    };
  }

  // Start initialization
  initPromise = (async () => {
    try {
      console.log('🚀 Initializing shipping module...');

      // Register available provider factories
      await shippingOrchestrator.loadProviders({
        shiprocket: () => new ShiprocketProvider(),
        // Add more providers here as you implement them:
        // delhivery: (config) => new DelhiveryProvider(),
        // bluedart: (config) => new BlueDartProvider(),
      });

      const loadedCount = shippingOrchestrator['providers'].size;

      // Zero providers is not a terminal success: it usually means none is connected
      // *yet*, and an admin can connect one from /admin/shipping/providers at any
      // time afterward. Caching success here would permanently hide that provider
      // from every later request until the server restarts — leaving the caller's
      // retry-when-empty logic (route.ts) with nothing left to retry.
      isInitialized = loadedCount > 0;
      console.log(`✅ Shipping module initialized with ${loadedCount} provider(s)`);
    } catch (error) {
      console.error('❌ Failed to initialize shipping module:', error);
      isInitialized = false;
      throw error;
    } finally {
      initPromise = null;
    }
  })();

  await initPromise;

  return {
    success: isInitialized,
    message: isInitialized 
      ? 'Shipping module initialized successfully' 
      : 'Initialization failed',
    providersLoaded: shippingOrchestrator['providers'].size,
  };
}

/**
 * Get initialization status
 */
export function isShippingInitialized(): boolean {
  return isInitialized;
}

// Auto-initialize on server start (only on server-side)
if (typeof window === 'undefined') {
  // Use setTimeout to avoid blocking module imports
  setTimeout(() => {
    initializeShippingModule().catch((error) => {
      console.error('Failed to auto-initialize shipping module:', error);
    });
  }, 0);
}