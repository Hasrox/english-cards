package me.englishcards.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.FrameLayout;
import androidx.webkit.WebViewAssetLoader;
import java.util.Locale;

public class MainActivity extends Activity {
    private static final int FILE_CHOOSER = 71;
    private WebView webView;
    private WebViewAssetLoader assetLoader;
    private TextToSpeech voices;
    private PictureSearch pictures;
    private ValueCallback<Uri[]> filePathCallback;

    @Override
    @SuppressLint("SetJavaScriptEnabled")
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        voices = new TextToSpeech(this, status -> {
            if (status != TextToSpeech.SUCCESS || voices == null) return;
            int english = voices.setLanguage(Locale.US);
            if (english == TextToSpeech.LANG_MISSING_DATA || english == TextToSpeech.LANG_NOT_SUPPORTED) {
                voices.setLanguage(Locale.ENGLISH);
            }
        });
        assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        FrameLayout root = new FrameLayout(this);
        root.setLayoutParams(new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        webView = new WebView(this);
        webView.setLayoutParams(new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        webView.addJavascriptInterface(new Speaker(voices), "AndroidSpeech");
        // The WebView has no Fullscreen API — JS toggles immersive mode here.
        webView.addJavascriptInterface(new Ui(), "AndroidUi");
        webView.setWebViewClient(new android.webkit.WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return load(request.getUrl(), request.isForMainFrame());
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, String url) {
                return load(Uri.parse(url), false);
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(
                    WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (filePathCallback != null) filePathCallback.onReceiveValue(null);
                filePathCallback = callback;
                Intent intent = params.createIntent();
                try {
                    startActivityForResult(intent, FILE_CHOOSER);
                } catch (Exception error) {
                    filePathCallback = null;
                    callback.onReceiveValue(null);
                    return false;
                }
                return true;
            }
        });

        pictures = new PictureSearch(this, webView);
        pictures.attach(root);
        webView.addJavascriptInterface(pictures.bridge(), "AndroidPictures");
        root.addView(webView);
        setContentView(root);
        // Document URL stays `/` so TanStack matches Home. The asset loader has
        // no file at `/` (that is ERR_INVALID_RESPONSE); load() maps it to index.html.
        webView.loadUrl("https://appassets.androidplatform.net/");
    }

    private static final Uri INDEX_HTML =
            Uri.parse("https://appassets.androidplatform.net/index.html");

    private WebResourceResponse load(Uri url, boolean mainFrame) {
        String path = url.getPath();
        if (path == null || path.isEmpty() || "/".equals(path)) {
            return assetLoader.shouldInterceptRequest(INDEX_HTML);
        }
        WebResourceResponse found = assetLoader.shouldInterceptRequest(url);
        if (usable(found)) return found;
        if (mainFrame) return assetLoader.shouldInterceptRequest(INDEX_HTML);
        return found;
    }

    /** AssetsPathHandler returns a body-less response when the file is missing. */
    private static boolean usable(WebResourceResponse response) {
        return response != null && response.getData() != null;
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode != FILE_CHOOSER) {
            super.onActivityResult(requestCode, resultCode, data);
            return;
        }
        if (filePathCallback == null) return;
        Uri[] uris = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
        filePathCallback.onReceiveValue(uris);
        filePathCallback = null;
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (filePathCallback != null) {
            filePathCallback.onReceiveValue(null);
            filePathCallback = null;
        }
        if (pictures != null) pictures.destroy();
        if (voices != null) {
            voices.stop();
            voices.shutdown();
        }
        super.onDestroy();
    }

    /** Hide/show the system bars; the WebView ignores the Web Fullscreen API. */
    private void applyFullscreen(final boolean on) {
        runOnUiThread(() -> {
            if (Build.VERSION.SDK_INT >= 30) {
                WindowInsetsController controller = getWindow().getInsetsController();
                if (controller == null) return;
                if (on) {
                    controller.hide(WindowInsets.Type.systemBars());
                    controller.setSystemBarsBehavior(
                            WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                } else {
                    controller.show(WindowInsets.Type.systemBars());
                }
            } else {
                View decor = getWindow().getDecorView();
                if (on) {
                    decor.setSystemUiVisibility(
                            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                                    | View.SYSTEM_UI_FLAG_FULLSCREEN
                                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                                    | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
                } else {
                    decor.setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
                }
            }
        });
    }

    /** Exposed to JavaScript as `AndroidUi` (PRD FR-7). */
    public final class Ui {
        @JavascriptInterface
        public void enterFullscreen() {
            applyFullscreen(true);
        }

        @JavascriptInterface
        public void exitFullscreen() {
            applyFullscreen(false);
        }
    }

    public static final class Speaker {
        private final TextToSpeech voices;

        Speaker(TextToSpeech voices) {
            this.voices = voices;
        }

        @JavascriptInterface
        public void speak(String text) {
            if (voices == null || text == null || text.trim().isEmpty()) return;
            voices.speak(text, TextToSpeech.QUEUE_FLUSH, null, "word");
        }
    }
}
