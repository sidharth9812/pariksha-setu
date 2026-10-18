import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';

/**
 * Initializes native Android / Capacitor specific behaviors:
 * 1. Status bar styling (dark slate background matching ParikshaSetu theme)
 * 2. Hardware back button handling:
 *    - Respects browser/app navigation history
 *    - Prevents sudden accidental app exit during active operations
 */
export async function initializeNativeApp() {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    // 1. Configure Status Bar
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#1e293b' });
  } catch (err) {
    console.warn('Status bar configuration error:', err);
  }

  try {
    // 2. Hardware Back Button Listener
    await App.addListener('backButton', ({ canGoBack }) => {
      // If modal or full-screen overlay is open, custom handlers can capture it
      const hasActiveModal = document.querySelector('[role="dialog"], .modal-open, #confirm-modal');
      if (hasActiveModal) {
        const closeBtn = hasActiveModal.querySelector('button[aria-label="Close"], button.close-modal') as HTMLButtonElement | null;
        if (closeBtn) {
          closeBtn.click();
          return;
        }
      }

      // Check if browser navigation history has entries
      if (canGoBack && window.history.length > 1) {
        window.history.back();
      } else {
        // Double-tap or exit confirmation at root screen
        const shouldExit = window.confirm('Do you want to exit ParikshaSetu?');
        if (shouldExit) {
          App.exitApp();
        }
      }
    });
  } catch (err) {
    console.warn('Back button listener registration error:', err);
  }
}
