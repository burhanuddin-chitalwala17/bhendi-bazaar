/**
 * Shipping Module Initialization
 * 
 * Auto-initializes shipping providers when the server starts.
 * Runs only on server-side, never in browser.
 */

import { shippingOrchestrator } from './services/orchestrator.service';
import { PROVIDER_FACTORIES } from './providers';

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
      providersLoaded: shippingOrchestrator.getProviderCount()
    };
  }

  // If initialization is in progress, wait for it
  if (initPromise) {
    await initPromise;
    return {
      success: isInitialized,
      message: isInitialized ? 'Initialized' : 'Initialization failed',
      providersLoaded: shippingOrchestrator.getProviderCount()
    };
  }

  // Start initialization
  initPromise = (async () => {
    try {
      console.log('🚀 Initializing shipping module...');

      // The registry in providers/index.ts is the one list of carriers — declared
      // once, so adding a carrier there cannot leave it silently unloaded at boot.
      await shippingOrchestrator.loadProviders(PROVIDER_FACTORIES);

      const loadedCount = shippingOrchestrator.getProviderCount();

      // A run that loaded nothing is not an initialised module. Latching it true
      // would make this function a no-op forever after — which is how a carrier
      // connected through the admin console after boot (ADR-0002's whole point)
      // stayed invisible until someone restarted the server, and how the rates
      // route's recovery path became dead code.
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