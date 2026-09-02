// mso-ca-go — offline mock-exam app for the C&ED MSO Competence Assessment.
// Serves an embedded single-page app on 127.0.0.1 and opens the browser.
package main

import (
	"embed"
	"encoding/base64"
	"flag"
	"fmt"
	"io/fs"
	"net"
	"net/http"
	"os"
	"os/exec"
	"regexp"
	"runtime"
	"strings"
)

//go:embed web
var webFS embed.FS

func main() {
	port := flag.Int("port", 8321, "port to listen on (next ports are tried if busy)")
	noBrowser := flag.Bool("no-browser", false, "do not open the browser automatically")
	exportHTML := flag.String("export-html", "", "write the whole app as one self-contained HTML file to this path, then exit")
	flag.Parse()

	sub, err := fs.Sub(webFS, "web")
	if err != nil {
		fatal(err)
	}

	if *exportHTML != "" {
		if err := writeSingleFile(sub, *exportHTML); err != nil {
			fatal(err)
		}
		fmt.Println("wrote", *exportHTML)
		return
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

// writeSingleFile folds index.html, the stylesheet (with the fonts embedded as
// data URIs), the question bank and the script into one HTML file that runs
// straight from disk — no server needed.
func writeSingleFile(fsys fs.FS, path string) error {
	read := func(name string) (string, error) {
		b, err := fs.ReadFile(fsys, name)
		return string(b), err
	}
	index, err := read("index.html")
	if err != nil {
		return err
	}
	css, err := read("style.css")
	if err != nil {
		return err
	}
	js, err := read("app.js")
	if err != nil {
		return err
	}
	bank, err := read("questions.json")
	if err != nil {
		return err
	}

	fontRef := regexp.MustCompile(`url\("fonts/([^"]+)"\)`)
	css = fontRef.ReplaceAllStringFunc(css, func(m string) string {
		name := fontRef.FindStringSubmatch(m)[1]
		b, err := fs.ReadFile(fsys, "fonts/"+name)
		if err != nil {
			return m
		}
		return "url(data:font/woff2;base64," + base64.StdEncoding.EncodeToString(b) + ")"
	})

	// a literal "</script" inside inlined code would end the script element early
	safe := func(s string) string { return strings.ReplaceAll(s, "</script", `<\/script`) }

	out := strings.Replace(index, `<link rel="stylesheet" href="style.css">`, "<style>\n"+css+"\n</style>", 1)
	out = strings.Replace(out, `<script src="app.js"></script>`,
		"<script>window.BANK = "+safe(bank)+";</script>\n<script>\n"+safe(js)+"\n</script>", 1)
	if strings.Contains(out, `href="style.css"`) || strings.Contains(out, `src="app.js"`) {
		return fmt.Errorf("index.html did not contain the expected stylesheet/script tags")
	}
	return os.WriteFile(path, []byte(out), 0o644)
}

func fatal(err error) {
	fmt.Fprintln(os.Stderr, "error:", err)
	os.Exit(1)
}
