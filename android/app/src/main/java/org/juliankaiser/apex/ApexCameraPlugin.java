package org.juliankaiser.apex;

import android.Manifest;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.Matrix;
import android.graphics.drawable.ColorDrawable;
import android.util.Base64;
import android.util.Log;
import android.util.Range;
import android.util.Rational;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;

import androidx.annotation.NonNull;
import androidx.camera.core.Camera;
import androidx.camera.core.CameraControl;
import androidx.camera.core.CameraInfo;
import androidx.camera.core.CameraSelector;
import androidx.camera.core.ExposureState;
import androidx.camera.core.FocusMeteringAction;
import androidx.camera.core.FocusMeteringResult;
import androidx.camera.core.ImageCapture;
import androidx.camera.core.ImageCaptureException;
import androidx.camera.core.ImageProxy;
import androidx.camera.core.MeteringPoint;
import androidx.camera.core.MeteringPointFactory;
import androidx.camera.core.Preview;
import androidx.camera.lifecycle.ProcessCameraProvider;
import androidx.camera.view.PreviewView;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.google.common.util.concurrent.ListenableFuture;

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

@CapacitorPlugin(
    name = "ApexCamera",
    permissions = {
        @Permission(
            alias = "camera",
            strings = { Manifest.permission.CAMERA }
        )
    }
)
public class ApexCameraPlugin extends Plugin {
    private static final String TAG = "ApexCameraPlugin";

    private PreviewView previewView;
    private ProcessCameraProvider cameraProvider;
    private Camera camera;
    private CameraControl cameraControl;
    private CameraInfo cameraInfo;
    private ImageCapture imageCapture;
    private ExecutorService cameraExecutor;

    private boolean isFrontFacing = false;
    private boolean isCameraActive = false;

    @Override
    public void load() {
        super.load();
        cameraExecutor = Executors.newSingleThreadExecutor();
    }

    @PluginMethod
    public void startCamera(PluginCall call) {
        Log.d(TAG, "[CAMERA_LIFECYCLE] START");
        if (getPermissionState("camera") != PermissionState.GRANTED) {
            Log.d(TAG, "ApexCamera: Requesting CAMERA permission from user");
            requestPermissionForAlias("camera", call, "cameraPermissionCallback");
            return;
        }

        executeStartCamera(call);
    }

    @PermissionCallback
    public void cameraPermissionCallback(PluginCall call) {
        if (getPermissionState("camera") == PermissionState.GRANTED) {
            Log.d(TAG, "ApexCamera: CAMERA permission granted via callback");
            executeStartCamera(call);
        } else {
            Log.e(TAG, "ApexCamera: CAMERA permission denied by user");
            call.reject("Camera permission denied");
        }
    }

    private void executeStartCamera(PluginCall call) {
        String facing = call.getString("facing", "environment");
        isFrontFacing = "user".equalsIgnoreCase(facing);

        getActivity().runOnUiThread(() -> {
            try {
                WebView webView = getBridge().getWebView();
                if (webView == null) {
                    call.reject("Capacitor WebView not available");
                    return;
                }

                ViewGroup webViewParent = (ViewGroup) webView.getParent();
                if (webViewParent == null) {
                    call.reject("WebView parent container not available");
                    return;
                }

                if (previewView == null) {
                    previewView = new PreviewView(getContext());
                    previewView.setImplementationMode(PreviewView.ImplementationMode.COMPATIBLE);
                    previewView.setScaleType(PreviewView.ScaleType.FILL_CENTER);
                }

                if (previewView.getParent() != null) {
                    ((ViewGroup) previewView.getParent()).removeView(previewView);
                }

                ViewGroup.LayoutParams params = new ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                );
                webViewParent.addView(previewView, 0, params);

                previewView.setVisibility(View.VISIBLE);
                previewView.setAlpha(1.0f);

                // Ensure WebView and parent are completely transparent
                webView.bringToFront();
                webView.setBackgroundColor(Color.TRANSPARENT);
                webViewParent.setBackgroundColor(Color.TRANSPARENT);
                getActivity().getWindow().setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));

                Log.d(TAG, "ApexCamera: PreviewView added behind WebView in " + webViewParent.getClass().getSimpleName() + " at index 0");
                bindCamera(call);
            } catch (Exception ex) {
                Log.e(TAG, "Error starting camera: ", ex);
                call.reject("Failed to initialize camera: " + ex.getMessage());
            }
        });
    }

    private void bindCamera(PluginCall call) {
        ListenableFuture<ProcessCameraProvider> cameraProviderFuture = ProcessCameraProvider.getInstance(getContext());

        cameraProviderFuture.addListener(() -> {
            try {
                cameraProvider = cameraProviderFuture.get();
                Log.d(TAG, "[CAMERA_LIFECYCLE] REBIND");
                cameraProvider.unbindAll();
                Log.d(TAG, "[CAMERA_LIFECYCLE] UNBIND");

                CameraSelector cameraSelector = isFrontFacing
                        ? CameraSelector.DEFAULT_FRONT_CAMERA
                        : CameraSelector.DEFAULT_BACK_CAMERA;

                Preview preview = new Preview.Builder()
                        .build();

                preview.setSurfaceProvider(previewView.getSurfaceProvider());

                imageCapture = new ImageCapture.Builder()
                        .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
                        .setFlashMode(ImageCapture.FLASH_MODE_OFF)
                        .build();

                camera = cameraProvider.bindToLifecycle(
                        getActivity(),
                        cameraSelector,
                        preview,
                        imageCapture
                );

                cameraControl = camera.getCameraControl();
                cameraInfo = camera.getCameraInfo();
                isCameraActive = true;

                Log.d(TAG, "[CAMERA_LIFECYCLE] BOUND to lifecycle successfully with " + (isFrontFacing ? "FRONT" : "REAR") + " camera");

                JSObject result = new JSObject();
                result.put("active", true);
                result.put("facing", isFrontFacing ? "user" : "environment");
                result.put("hasFlashUnit", cameraInfo.hasFlashUnit());

                ExposureState exposureState = cameraInfo.getExposureState();
                result.put("exposureSupported", exposureState.isExposureCompensationSupported());
                if (exposureState.isExposureCompensationSupported()) {
                    Range<Integer> range = exposureState.getExposureCompensationRange();
                    Rational step = exposureState.getExposureCompensationStep();
                    result.put("minExposure", range.getLower());
                    result.put("maxExposure", range.getUpper());
                    result.put("exposureStep", step.floatValue());
                }

                if (cameraInfo.getZoomState().getValue() != null) {
                    result.put("minZoom", cameraInfo.getZoomState().getValue().getMinZoomRatio());
                    result.put("maxZoom", cameraInfo.getZoomState().getValue().getMaxZoomRatio());
                } else {
                    result.put("minZoom", 1.0f);
                    result.put("maxZoom", 8.0f);
                }

                // Resolve call once the PreviewView is confirmed streaming frames, with safety timeout fallback
                final boolean[] resolved = {false};
                previewView.getPreviewStreamState().observe(getActivity(), streamState -> {
                    Log.d(TAG, "ApexCamera: PreviewStreamState = " + streamState);
                    if (streamState == PreviewView.StreamState.STREAMING) {
                        Log.d(TAG, "[CAMERA_LIFECYCLE] STREAMING width=" + previewView.getWidth() + ", height=" + previewView.getHeight());
                        if (!resolved[0]) {
                            resolved[0] = true;
                            call.resolve(result);
                        }
                    }
                });

                previewView.postDelayed(() -> {
                    if (!resolved[0]) {
                        resolved[0] = true;
                        Log.d(TAG, "ApexCamera: StreamState timeout fallback fired, resolving camera active");
                        call.resolve(result);
                    }
                }, 350);

            } catch (Exception e) {
                Log.e(TAG, "Camera binding error: ", e);
                call.reject("Camera binding failed: " + e.getMessage());
            }
        }, ContextCompat.getMainExecutor(getContext()));
    }

    @PluginMethod
    public void stopCamera(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                Log.d(TAG, "[CAMERA_LIFECYCLE] STOP");
                if (cameraProvider != null) {
                    cameraProvider.unbindAll();
                    Log.d(TAG, "[CAMERA_LIFECYCLE] UNBIND");
                }
                if (previewView != null) {
                    previewView.setVisibility(View.GONE);
                    if (previewView.getParent() != null) {
                        ((ViewGroup) previewView.getParent()).removeView(previewView);
                    }
                }
                if (getBridge() != null && getBridge().getWebView() != null) {
                    getBridge().getWebView().setBackgroundColor(Color.parseColor("#080808"));
                    ViewGroup parent = (ViewGroup) getBridge().getWebView().getParent();
                    if (parent != null) {
                        parent.setBackgroundColor(Color.parseColor("#080808"));
                    }
                }
                isCameraActive = false;
                Log.d(TAG, "ApexCamera: Camera stopped and cleaned up");
                call.resolve();
            } catch (Exception ex) {
                Log.e(TAG, "Error stopping camera: ", ex);
                call.reject("Failed to stop camera: " + ex.getMessage());
            }
        });
    }

    @PluginMethod
    public void setFocus(PluginCall call) {
        Double normX = call.getDouble("normX");
        Double normY = call.getDouble("normY");
        Double x = call.getDouble("x");
        Double y = call.getDouble("y");

        getActivity().runOnUiThread(() -> {
            if (cameraControl == null || previewView == null || !isCameraActive) {
                call.reject("Camera not active");
                return;
            }

            try {
                MeteringPointFactory factory = previewView.getMeteringPointFactory();
                float pointX;
                float pointY;

                if (normX != null && normY != null) {
                    pointX = (float) (normX * previewView.getWidth());
                    pointY = (float) (normY * previewView.getHeight());
                } else if (x != null && y != null) {
                    pointX = x.floatValue();
                    pointY = y.floatValue();
                } else {
                    call.reject("Coordinates required");
                    return;
                }

                MeteringPoint point = factory.createPoint(pointX, pointY);

                // Build AF & AE action with 3s auto-cancel back to continuous AF
                FocusMeteringAction action = new FocusMeteringAction.Builder(point, FocusMeteringAction.FLAG_AF | FocusMeteringAction.FLAG_AE)
                        .setAutoCancelDuration(3, TimeUnit.SECONDS)
                        .build();

                Log.d(TAG, "ApexCamera: Triggering CameraX hardware autofocus at screen (" + pointX + ", " + pointY + ") for PreviewView (" + previewView.getWidth() + "x" + previewView.getHeight() + ")");
                ListenableFuture<FocusMeteringResult> future = cameraControl.startFocusAndMetering(action);
                future.addListener(() -> {
                    try {
                        FocusMeteringResult focusResult = future.get();
                        Log.d(TAG, "ApexCamera: Hardware autofocus locked. isFocusSuccessful=" + focusResult.isFocusSuccessful());
                        JSObject ret = new JSObject();
                        ret.put("success", true);
                        ret.put("isFocusSuccessful", focusResult.isFocusSuccessful());
                        call.resolve(ret);
                    } catch (Exception e) {
                        Log.w(TAG, "ApexCamera: Autofocus listener error: ", e);
                        JSObject ret = new JSObject();
                        ret.put("success", false);
                        ret.put("error", e.getMessage());
                        call.resolve(ret);
                    }
                }, ContextCompat.getMainExecutor(getContext()));
            } catch (Exception ex) {
                Log.e(TAG, "ApexCamera: Error triggering focus: ", ex);
                call.reject("Failed to trigger focus: " + ex.getMessage());
            }
        });
    }

    @PluginMethod
    public void setExposure(PluginCall call) {
        Double ev = call.getDouble("ev", 0.0);

        getActivity().runOnUiThread(() -> {
            if (cameraControl == null || cameraInfo == null || !isCameraActive) {
                call.reject("Camera not active");
                return;
            }

            try {
                ExposureState exposureState = cameraInfo.getExposureState();
                if (exposureState.isExposureCompensationSupported()) {
                    Rational step = exposureState.getExposureCompensationStep();
                    Range<Integer> range = exposureState.getExposureCompensationRange();
                    int index = Math.round(ev.floatValue() / step.floatValue());
                    index = Math.max(range.getLower(), Math.min(range.getUpper(), index));
                    cameraControl.setExposureCompensationIndex(index);
                    JSObject ret = new JSObject();
                    ret.put("supported", true);
                    ret.put("index", index);
                    ret.put("ev", index * step.floatValue());
                    call.resolve(ret);
                } else {
                    call.resolve(new JSObject().put("supported", false));
                }
            } catch (Exception ex) {
                call.reject("Failed to set exposure: " + ex.getMessage());
            }
        });
    }

    @PluginMethod
    public void setZoom(PluginCall call) {
        Double ratio = call.getDouble("ratio", 1.0);

        getActivity().runOnUiThread(() -> {
            if (cameraControl == null || !isCameraActive) {
                call.reject("Camera not active");
                return;
            }

            try {
                cameraControl.setZoomRatio(ratio.floatValue());
                call.resolve();
            } catch (Exception ex) {
                call.reject("Failed to set zoom: " + ex.getMessage());
            }
        });
    }

    @PluginMethod
    public void toggleTorch(PluginCall call) {
        Boolean on = call.getBoolean("on", false);

        getActivity().runOnUiThread(() -> {
            if (cameraControl == null || cameraInfo == null || !isCameraActive) {
                call.reject("Camera not active");
                return;
            }

            try {
                if (cameraInfo.hasFlashUnit()) {
                    cameraControl.enableTorch(on);
                    call.resolve(new JSObject().put("torchOn", on));
                } else {
                    call.resolve(new JSObject().put("torchOn", false));
                }
            } catch (Exception ex) {
                call.reject("Failed to toggle torch: " + ex.getMessage());
            }
        });
    }

    @PluginMethod
    public void switchCamera(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            isFrontFacing = !isFrontFacing;
            bindCamera(call);
        });
    }

    private String bitmapToDataUrl(Bitmap bitmap) {
        int maxDim = 1600;
        Bitmap scaled = bitmap;
        if (bitmap.getWidth() > maxDim || bitmap.getHeight() > maxDim) {
            float scale = Math.min((float) maxDim / bitmap.getWidth(), (float) maxDim / bitmap.getHeight());
            int targetW = Math.round(bitmap.getWidth() * scale);
            int targetH = Math.round(bitmap.getHeight() * scale);
            scaled = Bitmap.createScaledBitmap(bitmap, targetW, targetH, true);
        }

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        scaled.compress(Bitmap.CompressFormat.JPEG, 90, baos);
        byte[] jpegBytes = baos.toByteArray();
        if (scaled != bitmap) {
            scaled.recycle();
        }
        return "data:image/jpeg;base64," + Base64.encodeToString(jpegBytes, Base64.NO_WRAP);
    }

    @PluginMethod
    public void captureFrame(PluginCall call) {
        Log.d(TAG, "[CAMERA_LIFECYCLE] CAPTURE_REQUEST isCameraActive=" + isCameraActive + ", imageCapture=" + (imageCapture != null));
        Log.d(TAG, "[CAMERA] captureFrame_started");

        if (imageCapture == null || !isCameraActive) {
            Log.w(TAG, "[CAMERA] ImageCapture not active or camera inactive. Trying emergency PreviewView bitmap...");
            getActivity().runOnUiThread(() -> {
                if (previewView != null) {
                    Bitmap viewBitmap = previewView.getBitmap();
                    if (viewBitmap != null && viewBitmap.getWidth() > 0 && viewBitmap.getHeight() > 0) {
                        try {
                            String dataUrl = bitmapToDataUrl(viewBitmap);
                            int byteLen = dataUrl != null ? dataUrl.length() : 0;
                            Log.d(TAG, "[CAMERA] captureFrame_result: success=true (from PreviewView fallback), width=" + viewBitmap.getWidth() + ", height=" + viewBitmap.getHeight() + ", byteLength=" + byteLen + ", mime=image/jpeg, base64NonEmpty=" + (byteLen > 0));
                            JSObject ret = new JSObject();
                            ret.put("photoDataUrl", dataUrl);
                            ret.put("width", viewBitmap.getWidth());
                            ret.put("height", viewBitmap.getHeight());
                            ret.put("byteLength", byteLen);
                            ret.put("mimeType", "image/jpeg");
                            call.resolve(ret);
                            return;
                        } catch (Exception ex) {
                            Log.e(TAG, "[CAMERA] PreviewView capture fallback error: ", ex);
                        }
                    }
                }
                Log.e(TAG, "[CAMERA] captureFrame_result: success=false, error=ImageCapture not active");
                call.reject("ImageCapture not active");
            });
            return;
        }

        cameraExecutor.execute(() -> {
            imageCapture.takePicture(cameraExecutor, new ImageCapture.OnImageCapturedCallback() {
                @Override
                public void onCaptureSuccess(@NonNull ImageProxy imageProxy) {
                    Log.d(TAG, "[CAMERA_LIFECYCLE] CAPTURE_SUCCESS");
                    try {
                        Bitmap bitmap = null;
                        try {
                            bitmap = imageProxy.toBitmap();
                        } catch (Throwable t) {
                            Log.w(TAG, "[CAMERA] imageProxy.toBitmap() failed, falling back to plane buffer: ", t);
                        }

                        if (bitmap == null) {
                            ByteBuffer buffer = imageProxy.getPlanes()[0].getBuffer();
                            byte[] bytes = new byte[buffer.remaining()];
                            buffer.get(bytes);
                            bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
                        }

                        if (bitmap == null) {
                            throw new IllegalStateException("Decoded bitmap is null from ImageCapture frame");
                        }

                        int rotation = imageProxy.getImageInfo().getRotationDegrees();
                        if (rotation != 0 || isFrontFacing) {
                            Matrix matrix = new Matrix();
                            if (rotation != 0) matrix.postRotate(rotation);
                            if (isFrontFacing) matrix.postScale(-1, 1);
                            Bitmap transformed = Bitmap.createBitmap(bitmap, 0, 0, bitmap.getWidth(), bitmap.getHeight(), matrix, true);
                            if (transformed != bitmap) {
                                bitmap.recycle();
                                bitmap = transformed;
                            }
                        }

                        int finalW = bitmap.getWidth();
                        int finalH = bitmap.getHeight();
                        String base64DataUrl = bitmapToDataUrl(bitmap);
                        bitmap.recycle();
                        int byteLen = base64DataUrl != null ? base64DataUrl.length() : 0;

                        Log.d(TAG, "[CAMERA] captureFrame_result: success=true, width=" + finalW + ", height=" + finalH + ", byteLength=" + byteLen + ", mime=image/jpeg, base64NonEmpty=" + (byteLen > 0));

                        JSObject ret = new JSObject();
                        ret.put("photoDataUrl", base64DataUrl);
                        ret.put("width", finalW);
                        ret.put("height", finalH);
                        ret.put("byteLength", byteLen);
                        ret.put("mimeType", "image/jpeg");
                        call.resolve(ret);
                    } catch (Exception ex) {
                        Log.e(TAG, "[CAMERA_LIFECYCLE] CAPTURE_ERROR in post-processing: ", ex);
                        Log.e(TAG, "[CAMERA] captureFrame_result: success=false, error=" + ex.getMessage());
                        getActivity().runOnUiThread(() -> {
                            if (previewView != null) {
                                Bitmap viewBitmap = previewView.getBitmap();
                                if (viewBitmap != null && viewBitmap.getWidth() > 0 && viewBitmap.getHeight() > 0) {
                                    try {
                                        String fallbackUrl = bitmapToDataUrl(viewBitmap);
                                        int byteLen = fallbackUrl != null ? fallbackUrl.length() : 0;
                                        Log.d(TAG, "[CAMERA] PreviewView recovery fallback succeeded: " + viewBitmap.getWidth() + "x" + viewBitmap.getHeight());
                                        JSObject ret = new JSObject();
                                        ret.put("photoDataUrl", fallbackUrl);
                                        ret.put("width", viewBitmap.getWidth());
                                        ret.put("height", viewBitmap.getHeight());
                                        ret.put("byteLength", byteLen);
                                        ret.put("mimeType", "image/jpeg");
                                        call.resolve(ret);
                                        return;
                                    } catch (Exception ignored) {}
                                }
                            }
                            call.reject("Capture processing failed: " + ex.getMessage());
                        });
                    } finally {
                        imageProxy.close();
                    }
                }

                @Override
                public void onError(@NonNull ImageCaptureException exception) {
                    Log.e(TAG, "[CAMERA_LIFECYCLE] CAPTURE_ERROR: " + exception.getMessage(), exception);
                    Log.e(TAG, "[CAMERA] captureFrame_result: success=false, error=" + exception.getMessage());
                    getActivity().runOnUiThread(() -> {
                        if (previewView != null) {
                            Bitmap viewBitmap = previewView.getBitmap();
                            if (viewBitmap != null && viewBitmap.getWidth() > 0 && viewBitmap.getHeight() > 0) {
                                try {
                                    String fallbackUrl = bitmapToDataUrl(viewBitmap);
                                    int byteLen = fallbackUrl != null ? fallbackUrl.length() : 0;
                                    Log.d(TAG, "[CAMERA] PreviewView fallback on onError succeeded: " + viewBitmap.getWidth() + "x" + viewBitmap.getHeight());
                                    JSObject ret = new JSObject();
                                    ret.put("photoDataUrl", fallbackUrl);
                                    ret.put("width", viewBitmap.getWidth());
                                    ret.put("height", viewBitmap.getHeight());
                                    ret.put("byteLength", byteLen);
                                    ret.put("mimeType", "image/jpeg");
                                    call.resolve(ret);
                                    return;
                                } catch (Exception ex) {
                                    Log.e(TAG, "[CAMERA] Fallback bitmap export failed: ", ex);
                                }
                            }
                        }
                        call.reject("Capture failed: " + exception.getMessage());
                    });
                }
            });
        });
    }

    @Override
    protected void handleOnDestroy() {
        if (cameraExecutor != null) {
            cameraExecutor.shutdown();
        }
        super.handleOnDestroy();
    }
}
