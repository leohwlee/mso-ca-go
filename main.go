// mso-ca-go — offline mock-exam app for the C&ED MSO Competence Assessment.
// Serves an embedded single-page app on 127.0.0.1 and opens the browser.
package main

import (
	"embed"
	"flag"
	"fmt"
	"io/fs"
	"net"
	"net/http"
	"os"
	"os/exec"
	"runtime"
)

//go:embed web
var webFS embed.FS

func main() {
	port := flag.Int("port", 8321, "port to listen on (next ports are tried if busy)")
	noBrowser := flag.Bool("no-browser", false, "do not open the browser automatically")
	flag.Parse()

	sub, err := fs.Sub(webFS, "web")
	if err != nil {
		fatal(err)
	}

	// Find a free port starting at -port.
	var ln net.Listener
	p := *port
	for i := 0; i < 20; i++ {
		ln, err = net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", p))
		if err == nil {
			break
		}
		p++
	}
	if ln == nil {
		fatal(fmt.Errorf("no free port found near %d: %w", *port, err))
	}

	url := fmt.Sprintf("http://127.0.0.1:%d", p)
	fmt.Println("MSO Competence Assessment mock exam 金錢服務經營者能力評核模擬試")
	fmt.Println("Serving at", url)
	fmt.Println("Keep this window open while using the app. Press Ctrl+C to quit.")
	fmt.Println("使用期間請保持此視窗開啟；按 Ctrl+C 結束。")

	fileServer := http.FileServer(http.FS(sub))
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store") // always pick up updated app/bank
		fileServer.ServeHTTP(w, r)
	})

	if !*noBrowser {
		openBrowser(url)
	}
	if err := http.Serve(ln, nil); err != nil {
		fatal(err)
	}
}

func openBrowser(url string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	case "darwin":
		cmd = exec.Command("open", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	_ = cmd.Start()
}

func fatal(err error) {
	fmt.Fprintln(os.Stderr, "error:", err)
	os.Exit(1)
}
