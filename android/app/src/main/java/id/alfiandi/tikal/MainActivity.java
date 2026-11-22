package id.alfiandi.tikal;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import com.chaquo.python.Python;
import com.chaquo.python.android.AndroidPlatform;

import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Pembungkus Android untuk tikAl.
 *
 * Server Flask (Python, lewat Chaquopy) dijalankan di dalam aplikasi pada
 * 127.0.0.1, lalu UI web dimuat di WebView. Unduhan diteruskan ke
 * DownloadManager agar tersimpan rapi di folder Download.
 */
public class MainActivity extends Activity {

    private static final String TAG = "tikAl";
    private static final int PORT = 8765;
    private static final String BASE_URL = "http://127.0.0.1:" + PORT;

    private WebView webView;
    private ProgressBar progress;
    private TextView status;
    private View loading;
    private final Handler handler = new Handler(Looper.getMainLooper());

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webview);
        progress = findViewById(R.id.progress);
        status = findViewById(R.id.status);
        loading = findViewById(R.id.loading);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);

        webView.addJavascriptInterface(new Bridge(), "TikAl");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                loading.setVisibility(View.GONE);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String host = uri.getHost();
                if (host == null || host.equals("127.0.0.1") || host.equals("localhost")) {
                    return false;
                }
                // Tautan ke luar (mis. profil TikTok) dibuka di browser.
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (Exception ignored) {
                    // Tidak ada browser — abaikan.
                }
                return true;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                progress.setProgress(Math.max(5, newProgress));
            }
        });

        startServer();
    }

    private void startServer() {
        if (!Python.isStarted()) {
            Python.start(new AndroidPlatform(this));
        }

        new Thread(() -> {
            try {
                Python.getInstance().getModule("server").callAttr("start", PORT);
            } catch (Throwable error) {
                Log.e(TAG, "Server Python gagal dijalankan", error);
                handler.post(() -> status.setText("Server gagal dijalankan. Buka ulang aplikasi."));
            }
        }, "tikal-server").start();

        new Thread(this::waitForServer, "tikal-wait").start();
    }

    private void waitForServer() {
        long deadline = System.currentTimeMillis() + 30000L;
        while (System.currentTimeMillis() < deadline) {
            HttpURLConnection connection = null;
            try {
                connection = (HttpURLConnection) new URL(BASE_URL + "/api/health").openConnection();
                connection.setConnectTimeout(1000);
                connection.setReadTimeout(1000);
                if (connection.getResponseCode() == 200) {
                    handler.post(() -> webView.loadUrl(BASE_URL + "/"));
                    return;
                }
            } catch (IOException ignored) {
                // Server belum siap — coba lagi.
            } finally {
                if (connection != null) {
                    connection.disconnect();
                }
            }
            try {
                Thread.sleep(250);
            } catch (InterruptedException interrupted) {
                return;
            }
        }
        handler.post(() -> status.setText("Server tidak merespons. Tutup lalu buka lagi aplikasi."));
    }

    /** Jembatan JS: window.TikAl.save(url, namaBerkas) */
    public class Bridge {
        @JavascriptInterface
        public void save(String path, String filename) {
            final String url = path.startsWith("http") ? path : BASE_URL + path;
            final String name = sanitize(filename);

            try {
                DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
                request.setTitle(name);
                request.setDescription("tikAl");
                request.setNotificationVisibility(
                        DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name);
                request.setAllowedOverMetered(true);
                request.setAllowedOverRoaming(true);

                DownloadManager manager =
                        (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                manager.enqueue(request);

                handler.post(() -> Toast.makeText(
                        MainActivity.this, "Mengunduh " + name, Toast.LENGTH_SHORT).show());
            } catch (Exception error) {
                Log.e(TAG, "Gagal mengunduh", error);
                handler.post(() -> Toast.makeText(
                        MainActivity.this,
                        "Gagal mengunduh: " + error.getMessage(),
                        Toast.LENGTH_LONG).show());
            }
        }
    }

    private static String sanitize(String filename) {
        String name = (filename == null || filename.trim().isEmpty()) ? "tikal.bin" : filename.trim();
        name = name.replaceAll("[\\\\/:*?\"<>|\\r\\n\\t]+", "_");
        return name.length() > 120 ? name.substring(0, 120) : name;
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
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
