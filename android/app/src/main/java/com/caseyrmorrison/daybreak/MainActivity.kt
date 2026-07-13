package com.caseyrmorrison.daybreak

import android.annotation.SuppressLint
import android.content.Intent
import android.os.Bundle
import android.view.View
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

// Native shell around the deployed web app, mirroring the iOS app: the
// web app provides all UI, data, and sync; this wrapper adds a real
// launcher app, back-button handling, pull-to-refresh, external-link
// handoff, and a native retry screen for a first launch with no network.
// Android WebView (Chromium) supports service workers on https, so the
// web app's offline cache works here just like in Chrome.
class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var swipeRefresh:
        androidx.swiperefreshlayout.widget.SwipeRefreshLayout
    private lateinit var errorView: View
    private var lastLoadFailed = false

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // targetSdk 35 enforces edge-to-edge: pad the root for the
        // system bars so content never hides under the status bar, and
        // the bar area shows the app background instead of a dark strip.
        val root = findViewById<View>(R.id.root)
        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
            val bars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() or
                    WindowInsetsCompat.Type.ime(),
            )
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            WindowInsetsCompat.CONSUMED
        }

        webView = findViewById(R.id.web_view)
        swipeRefresh = findViewById(R.id.swipe_refresh)
        errorView = findViewById(R.id.error_view)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest,
            ): Boolean {
                // Keep the app's own pages in the WebView; anything
                // else opens in the system browser.
                if (request.url.host == APP_HOST) return false
                startActivity(Intent(Intent.ACTION_VIEW, request.url))
                return true
            }

            override fun onPageStarted(
                view: WebView,
                url: String?,
                favicon: android.graphics.Bitmap?,
            ) {
                lastLoadFailed = false
            }

            override fun onPageFinished(view: WebView, url: String?) {
                swipeRefresh.isRefreshing = false
                if (!lastLoadFailed) errorView.visibility = View.GONE
            }

            override fun onReceivedError(
                view: WebView,
                request: WebResourceRequest,
                error: WebResourceError,
            ) {
                if (request.isForMainFrame) {
                    lastLoadFailed = true
                    errorView.visibility = View.VISIBLE
                }
            }
        }

        swipeRefresh.setOnRefreshListener { webView.reload() }

        findViewById<View>(R.id.retry_button).setOnClickListener {
            lastLoadFailed = false
            errorView.visibility = View.GONE
            webView.loadUrl(APP_URL)
        }

        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    if (webView.canGoBack()) {
                        webView.goBack()
                    } else {
                        isEnabled = false
                        onBackPressedDispatcher.onBackPressed()
                    }
                }
            },
        )

        if (savedInstanceState == null) {
            webView.loadUrl(APP_URL)
        } else {
            webView.restoreState(savedInstanceState)
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    companion object {
        // If the web app moves, update both constants (and the iOS
        // shell's ContentView/Info.plist).
        const val APP_URL = "https://daybreak-crmorrison.vercel.app"
        const val APP_HOST = "daybreak-crmorrison.vercel.app"
    }
}
