package me.englishcards.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.util.Log;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Hidden Google Images tab. JS talks to {@code AndroidPictures}; results are
 * posted back on the app WebView as {@code ec-pictures} events.
 * Harvest script must stay in sync with scripts/picture-shim.mjs.
 */
public final class PictureSearch {
    private static final String TAG = "EnglishCardsPictures";
    private static final String CONSENT_SHIM =
            """
            (function(){
              var labels=['accept all','i agree','accept','i accept','agree'];
              var nodes=document.querySelectorAll('button, input[type=submit], [role=button]');
              for (var i=0;i<nodes.length;i++){
                var t=(nodes[i].innerText||nodes[i].value||nodes[i].getAttribute('aria-label')||'').trim().toLowerCase();
                if(!t) continue;
                for (var j=0;j<labels.length;j++){
                  if(t===labels[j]){ nodes[i].click(); return 'clicked'; }
                }
              }
              return 'none';
            })()
            """;
    private static final String HARVEST_SHIM =
            """
            (function(){
              function captcha(){
                var text=(document.body&&document.body.innerText?document.body.innerText:'').toLowerCase();
                if (location.pathname.indexOf('/sorry')!==-1) return true;
                if (document.querySelector('iframe[src*="recaptcha"], form[action*="sorry"], #captcha')) return true;
                return text.indexOf('unusual traffic')!==-1||text.indexOf('are you a robot')!==-1;
              }
              function skip(url){
                if(!url||url.indexOf('https://')!==0) return true;
                if(url.indexOf('data:')===0) return true;
                return /logo|favicon|sprite|\\/icon(?:s)?\\/|maps\\.google|ssl\\.gstatic\\.com\\/gb|www\\.gstatic\\.com\\/images\\/branding|google\\.com\\/images\\/branding/.test(url);
              }
              function decode(url){
                return String(url).replace(/\\\\u003d/gi,'=').replace(/\\\\u0026/gi,'&').replace(/\\\\\\//g,'/').replace(/&amp;/g,'&').trim();
              }
              function ok(url){
                if(skip(url)) return false;
                if(url.indexOf('encrypted-tbn')!==-1&&url.indexOf('gstatic.com')!==-1) return true;
                if(url.indexOf('googleusercontent.com')!==-1) return true;
                if(url.indexOf('gstatic.com/images')!==-1) return true;
                if(/\\.(jpg|jpeg|png|webp|gif)(\\?|#|$)/i.test(url)) return true;
                try { return /^(?:images?|img|i|cdn|media|static)\\./i.test(new URL(url).hostname); }
                catch (e) { return false; }
              }
              var map={};
              function add(url,thumb,title,width,height){
                url=decode(url||'');
                thumb=decode(thumb||'');
                var chosen=ok(url)?url:ok(thumb)?thumb:'';
                if(!chosen||map[chosen]) return;
                if(width&&width<80) return;
                map[chosen]={url:chosen,thumb:ok(thumb)?thumb:chosen,title:title||'',width:width||0,height:height||0};
              }
              var imgs=document.querySelectorAll('img');
              for (var i=0;i<imgs.length;i++){
                var img=imgs[i];
                var src=img.currentSrc||img.src||img.getAttribute('data-src')||img.getAttribute('data-iurl')||'';
                var ou=img.getAttribute('data-ou')||img.getAttribute('data-lpage')||'';
                add(ou||src,src,img.alt||'',img.naturalWidth||img.width||0,img.naturalHeight||img.height||0);
              }
              var html=document.documentElement?document.documentElement.innerHTML:'';
              var reOu= /"(?:ou|originalUrl|ow)"\\s*:\\s*"(https?:[^"\\\\]+)"/g;
              var match;
              while ((match=reOu.exec(html))) { add(match[1],'','',0,0); }
              var reTbn=/https:\\/\\/encrypted-tbn\\d+\\.gstatic\\.com\\/images\\?[^"' <>]+/g;
              while ((match=reTbn.exec(html))) { add(match[0],match[0],'',0,0); }
              var hits=[];
              for (var key in map) { if (Object.prototype.hasOwnProperty.call(map,key)) hits.push(map[key]); }
              return {captcha:captcha(),hits:hits};
            })()
            """;

    private final Activity activity;
    private final WebView appView;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Set<String> seen = new HashSet<>();
    private WebView tab;
    private String userAgent = "Mozilla/5.0";
    private int generation;
    private boolean delivered;

    PictureSearch(Activity activity, WebView appView) {
        this.activity = activity;
        this.appView = appView;
    }

    @SuppressLint("SetJavaScriptEnabled")
    void attach(FrameLayout root) {
        tab = new WebView(activity);
        tab.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        tab.setFocusable(false);
        tab.setFocusableInTouchMode(false);
        FrameLayout.LayoutParams params =
                new FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT);
        tab.setLayoutParams(params);
        WebSettings settings = tab.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadsImagesAutomatically(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        String ua = settings.getUserAgentString();
        if (ua != null && !ua.isEmpty()) userAgent = ua;
        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(tab, true);
        tab.setWebViewClient(new WebViewClient());
        root.addView(tab, 0);
    }

    Bridge bridge() {
        return new Bridge();
    }

    void destroy() {
        handler.removeCallbacksAndMessages(null);
        if (tab != null) {
            tab.stopLoading();
            tab.destroy();
            tab = null;
        }
    }

    void search(int token, String query) {
        activity.runOnUiThread(
                () -> {
                    String term = query == null ? "" : query.trim();
                    if (term.isEmpty()) {
                        fail(token, "Type a word to search.");
                        return;
                    }
                    if (tab == null) {
                        fail(token, "Search did not work.");
                        return;
                    }
                    int gen = ++generation;
                    delivered = false;
                    seen.clear();
                    tab.stopLoading();
                    tab.loadUrl(googleUrl(term));
                    watch(gen, token, false);
                });
    }

    void more(int token) {
        activity.runOnUiThread(
                () -> {
                    if (tab == null) {
                        fail(token, "Search first.");
                        return;
                    }
                    int gen = ++generation;
                    delivered = false;
                    tab.evaluateJavascript(
                            "window.scrollTo(0, document.body.scrollHeight); window.scrollBy(0, 1400);", null);
                    watch(gen, token, true);
                });
    }

    void download(int token, String imageUrl) {
        final String agent = userAgent;
        new Thread(
                        () -> {
                            try {
                                byte[] bytes = fetchBytes(imageUrl, agent);
                                String mime = sniff(bytes);
                                String dataUrl =
                                        "data:" + mime + ";base64," + Base64.encodeToString(bytes, Base64.NO_WRAP);
                                JSONObject payload = new JSONObject();
                                payload.put("type", "blob");
                                payload.put("token", token);
                                payload.put("dataUrl", dataUrl);
                                post(payload);
                            } catch (Exception error) {
                                Log.w(TAG, "download failed", error);
                                fail(token, "The picture could not be saved.");
                            }
                        })
                .start();
    }

    void close() {
        activity.runOnUiThread(
                () -> {
                    generation++;
                    delivered = true;
                    handler.removeCallbacksAndMessages(null);
                    seen.clear();
                    if (tab != null) {
                        tab.stopLoading();
                        tab.loadUrl("about:blank");
                    }
                });
    }

    private void watch(int gen, int token, boolean more) {
        int first = more ? 500 : 1000;
        handler.postDelayed(
                () -> {
                    if (gen != generation || tab == null) return;
                    tab.evaluateJavascript(
                            CONSENT_SHIM,
                            ignored -> handler.postDelayed(() -> harvest(gen, token, false), more ? 1200 : 1600));
                },
                first);
        handler.postDelayed(() -> harvest(gen, token, true), more ? 2800 : 5200);
    }

    private void harvest(int gen, int token, boolean lastChance) {
        if (tab == null || gen != generation || delivered) return;
        tab.evaluateJavascript(
                HARVEST_SHIM,
                value -> {
                    if (gen != generation || delivered) return;
                    try {
                        if (value == null || "null".equals(value)) {
                            if (lastChance) deliver(token, new JSONArray());
                            return;
                        }
                        JSONObject raw = new JSONObject(value);
                        if (raw.optBoolean("captcha")) {
                            delivered = true;
                            fail(token, "Google asked for a check. Try Search again.");
                            return;
                        }
                        JSONArray incoming = raw.optJSONArray("hits");
                        JSONArray fresh = takeFresh(incoming);
                        if (fresh.length() > 0 || lastChance) {
                            deliver(token, fresh);
                        }
                    } catch (Exception error) {
                        Log.w(TAG, "harvest failed", error);
                        if (lastChance) {
                            fail(token, "Search did not work. You can add a photo from this phone instead.");
                        }
                    }
                });
    }

    private JSONArray takeFresh(JSONArray incoming) {
        JSONArray fresh = new JSONArray();
        if (incoming == null) return fresh;
        for (int i = 0; i < incoming.length(); i++) {
            JSONObject row = incoming.optJSONObject(i);
            if (row == null) continue;
            String url = row.optString("url");
            String thumb = row.optString("thumb", url);
            if (url.isEmpty()) continue;
            if (seen.contains(url) || seen.contains(thumb)) continue;
            seen.add(url);
            seen.add(thumb);
            fresh.put(row);
            if (fresh.length() >= 24) break;
        }
        return fresh;
    }

    private void deliver(int token, JSONArray hits) {
        delivered = true;
        try {
            JSONObject payload = new JSONObject();
            payload.put("type", "hits");
            payload.put("token", token);
            payload.put("hits", hits);
            post(payload);
        } catch (Exception error) {
            fail(token, "Search did not work.");
        }
    }

    private void fail(int token, String message) {
        try {
            JSONObject payload = new JSONObject();
            payload.put("type", "error");
            payload.put("token", token);
            payload.put("message", message);
            post(payload);
        } catch (Exception ignored) {
            /* */
        }
    }

    private void post(JSONObject payload) {
        String js = "window.dispatchEvent(new CustomEvent('ec-pictures',{detail:" + payload + "}))";
        activity.runOnUiThread(() -> appView.evaluateJavascript(js, null));
    }

    private static String googleUrl(String query) {
        try {
            return "https://www.google.com/search?tbm=isch&udm=2&q="
                    + URLEncoder.encode(query, StandardCharsets.UTF_8.name())
                    + "&safe=active&tbs="
                    + URLEncoder.encode("isz:m,itp:photo", StandardCharsets.UTF_8.name())
                    + "&hl=en";
        } catch (Exception error) {
            return "https://www.google.com/search?tbm=isch&safe=active&q=word";
        }
    }

    private static byte[] fetchBytes(String spec, String agent) throws Exception {
        if (spec == null || !spec.startsWith("https://")) {
            throw new IllegalArgumentException("https only");
        }
        URL url = new URL(spec);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setInstanceFollowRedirects(true);
        conn.setConnectTimeout(12000);
        conn.setReadTimeout(15000);
        conn.setRequestProperty("User-Agent", agent == null ? "Mozilla/5.0" : agent);
        conn.setRequestProperty("Referer", "https://www.google.com/");
        conn.setRequestProperty("Accept", "image/avif,image/webp,image/apng,image/*,*/*;q=0.8");
        int code = conn.getResponseCode();
        if (code >= 300 && code < 400) {
            String location = conn.getHeaderField("Location");
            conn.disconnect();
            return fetchBytes(location, agent);
        }
        if (code != 200) {
            conn.disconnect();
            throw new IllegalStateException("http " + code);
        }
        try (InputStream in = conn.getInputStream();
                ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buf = new byte[8192];
            int n;
            int total = 0;
            while ((n = in.read(buf)) != -1) {
                total += n;
                if (total > 2_500_000) throw new IllegalStateException("too large");
                out.write(buf, 0, n);
            }
            byte[] bytes = out.toByteArray();
            if (bytes.length < 32) throw new IllegalStateException("empty");
            return bytes;
        } finally {
            conn.disconnect();
        }
    }

    private static String sniff(byte[] bytes) {
        if (bytes.length >= 3 && (bytes[0] & 0xff) == 0xff && (bytes[1] & 0xff) == 0xd8) return "image/jpeg";
        if (bytes.length >= 8
                && (bytes[0] & 0xff) == 0x89
                && bytes[1] == 0x50
                && bytes[2] == 0x4e
                && bytes[3] == 0x47) {
            return "image/png";
        }
        if (bytes.length >= 12 && bytes[0] == 'R' && bytes[1] == 'I' && bytes[2] == 'F' && bytes[3] == 'F') {
            return "image/webp";
        }
        return "image/jpeg";
    }

    public final class Bridge {
        @JavascriptInterface
        public void search(String token, String query) {
            PictureSearch.this.search(parseToken(token), query);
        }

        @JavascriptInterface
        public void more(String token) {
            PictureSearch.this.more(parseToken(token));
        }

        @JavascriptInterface
        public void download(String token, String url) {
            PictureSearch.this.download(parseToken(token), url);
        }

        @JavascriptInterface
        public void close() {
            PictureSearch.this.close();
        }
    }

    private static int parseToken(String token) {
        try {
            return Integer.parseInt(token);
        } catch (Exception error) {
            return -1;
        }
    }
}
