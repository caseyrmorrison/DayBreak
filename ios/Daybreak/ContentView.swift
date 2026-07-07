import SwiftUI

struct ContentView: View {
    // The deployed web app. All UI, data, and sync live there; this
    // shell provides the native container, offline recovery, and
    // external-link handling.
    private let appURL = URL(string: "https://daybreak-crmorrison.vercel.app")!

    @State private var loadFailed = false
    @State private var attempt = 0

    var body: some View {
        ZStack {
            WebView(url: appURL, loadFailed: $loadFailed)
                .id(attempt)
                .ignoresSafeArea(.container, edges: .bottom)

            if loadFailed {
                VStack(spacing: 16) {
                    Image(systemName: "sunrise")
                        .font(.system(size: 40))
                        .foregroundStyle(.secondary)
                    Text("Daybreak couldn't load")
                        .font(.headline)
                    Text("Check your connection. Once the app has loaded on this device at least once, it works offline.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 32)
                    Button("Try again") {
                        loadFailed = false
                        attempt += 1
                    }
                    .buttonStyle(.borderedProminent)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Color(uiColor: .systemBackground))
            }
        }
    }
}

#Preview {
    ContentView()
}
