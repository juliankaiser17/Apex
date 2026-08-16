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

# Google Services
-keep class com.google.android.gms.** { *; }
