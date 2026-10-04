package me.englishcards.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.net.Uri;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.webkit.WebViewAssetLoader;
import java.util.Locale;

public class MainActivity extends Activity {
    private WebView webView;
    private WebViewAssetLoader assetLoader;
    private TextToSpeech voices;

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

        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        webView.addJavascriptInterface(new Speaker(voices), "AndroidSpeech");
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
        setContentView(webView);
        webView.loadUrl("https://appassets.androidplatform.net/index.html");
    }

    private WebResourceResponse load(Uri url, boolean mainFrame) {
        WebResourceResponse found = assetLoader.shouldInterceptRequest(url);
        if (found != null || !mainFrame) return found;
        return assetLoader.shouldInterceptRequest(Uri.parse("https://appassets.androidplatform.net/index.html"));
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
        if (voices != null) {
            voices.stop();
            voices.shutdown();
        }
        super.onDestroy();
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
