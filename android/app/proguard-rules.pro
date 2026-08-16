# Capacitor Bridge & Plugins Protection
-keep class com.getcapacitor.** { *; }
-keep interface com.getcapacitor.** { *; }
-keep public class * extends com.getcapacitor.Plugin { *; }
-keepclassmembers class * extends com.getcapacitor.Plugin {
    @com.getcapacitor.PluginMethod public *;
}

# Preserve JavascriptInterfaces
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Google Play Services & Identity
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.android.gms.**

# Strip debug log invocations in release builds
-assumenosideeffects class android.util.Log {
    public static boolean isLoggable(java.lang.String, int);
    public static int v(...);
    public static int d(...);
    public static int i(...);
}
