package com.capitalyx.finance;

import android.os.Build;
import android.os.Bundle;
import android.view.Display;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    // Ensure WebView content never renders underneath Android system status/task/navigation bars
    WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
    View rootView = findViewById(android.R.id.content);
    if (rootView != null) {
      ViewCompat.setOnApplyWindowInsetsListener(rootView, (view, windowInsets) -> {
        Insets bars =
            windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
        view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
        return WindowInsetsCompat.CONSUMED;
      });
    }

    // Request highest display refresh rate (120Hz+) when supported on Android 11+
    requestHighRefreshRate();

    // Force hardware layer acceleration on Capacitor WebView for smooth 120 FPS animations
    try {
      if (getBridge() != null && getBridge().getWebView() != null) {
        WebView webView = getBridge().getWebView();
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
      }
    } catch (Exception ignored) {
      // Non-fatal fallback
    }
  }

  private void requestHighRefreshRate() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return;
    try {
      Display display = getDisplay();
      if (display == null) return;
      Display.Mode currentMode = display.getMode();
      Display.Mode bestMode = currentMode;
      for (Display.Mode mode : display.getSupportedModes()) {
        if (mode.getPhysicalWidth() == currentMode.getPhysicalWidth()
            && mode.getPhysicalHeight() == currentMode.getPhysicalHeight()
            && mode.getRefreshRate() > bestMode.getRefreshRate()) {
          bestMode = mode;
        }
      }
      if (bestMode != null && bestMode.getModeId() != currentMode.getModeId()) {
        WindowManager.LayoutParams params = getWindow().getAttributes();
        params.preferredDisplayModeId = bestMode.getModeId();
        getWindow().setAttributes(params);
      }
    } catch (Exception ignored) {
      // Non-fatal on devices restricting display mode changes
    }
  }
}
