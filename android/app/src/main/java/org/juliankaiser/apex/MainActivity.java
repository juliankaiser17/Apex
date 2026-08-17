package org.juliankaiser.apex;

import android.graphics.Color;
import android.os.Bundle;
import android.view.Window;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        Window window = getWindow();
        if (window != null) {
            // Keep background seamless dark asphalt #080808
            window.setStatusBarColor(Color.parseColor("#080808"));
            window.setNavigationBarColor(Color.parseColor("#080808"));
            
            // Explicitly fit app inside system windows (status bar at top & nav buttons at bottom)
            WindowCompat.setDecorFitsSystemWindows(window, true);
            
            // Light icons on dark status bar & navigation bar
            WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
            if (controller != null) {
                controller.setAppearanceLightStatusBars(false);
                controller.setAppearanceLightNavigationBars(false);
            }
        }

        WebView webView = getBridge().getWebView();
        if (webView != null) {
            webView.setBackgroundColor(Color.parseColor("#080808"));
            WebSettings settings = webView.getSettings();
            settings.setMediaPlaybackRequiresUserGesture(false);
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);
            settings.setAllowFileAccess(true);
        }
    }
}
