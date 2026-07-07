import SwiftUI
import WebKit

// WKWebView wrapper tuned for a PWA-style app:
// - limitsNavigationsToAppBoundDomains + WKAppBoundDomains (Info.plist)
//   unlock service workers, so the web app's offline cache works here
//   exactly as it does in Safari.
// - Links leaving the app's domain open in the system browser.
// - Pull-to-refresh reloads, matching what users expect from a feed.
struct WebView: UIViewRepresentable {
    let url: URL
    @Binding var loadFailed: Bool

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.limitsNavigationsToAppBoundDomains = true
        configuration.allowsInlineMediaPlayback = true

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        if #available(iOS 16.4, *) {
            webView.isInspectable = true
        }

        let refresh = UIRefreshControl()
        refresh.addTarget(
            context.coordinator,
            action: #selector(Coordinator.handleRefresh(_:)),
            for: .valueChanged
        )
        webView.scrollView.refreshControl = refresh

        context.coordinator.webView = webView
        webView.load(URLRequest(url: url))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate {
        private let parent: WebView
        weak var webView: WKWebView?

        init(_ parent: WebView) {
            self.parent = parent
        }

        @objc func handleRefresh(_ sender: UIRefreshControl) {
            webView?.reload()
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
                sender.endRefreshing()
            }
        }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            if navigationAction.navigationType == .linkActivated,
               let target = navigationAction.request.url,
               target.host != parent.url.host {
                UIApplication.shared.open(target)
                decisionHandler(.cancel)
                return
            }
            decisionHandler(.allow)
        }

        func webView(
            _ webView: WKWebView,
            didFailProvisionalNavigation navigation: WKNavigation!,
            withError error: Error
        ) {
            parent.loadFailed = true
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            parent.loadFailed = false
        }
    }
}
