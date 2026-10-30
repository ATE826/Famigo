package server

// Интеграционный тест: настоящий HTTP-сервер и настоящий PostgreSQL.
// Запускается, только если задана FAMIGO_TEST_DATABASE_URL (пустая тестовая база!):
//
//	FAMIGO_TEST_DATABASE_URL=postgres://famigo:famigo@localhost:5432/famigo_test go test ./internal/server
//
// Проверяет не только «работает ли», но и типичные атаки: чужие данные по id (IDOR),
// SQL-инъекции, подмену полей, повтор украденного refresh-токена, CSRF, обход лимитов.

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"image"
	"image/png"
	"io"
	"log/slog"
	"mime/multipart"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"os"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"

	"github.com/ATE826/Famigo/backend/internal/ai"
	"github.com/ATE826/Famigo/backend/internal/chats"
	"github.com/ATE826/Famigo/backend/internal/config"
	"github.com/ATE826/Famigo/backend/internal/database"
	"github.com/ATE826/Famigo/backend/internal/fieldcrypt"
	"github.com/ATE826/Famigo/backend/internal/models"
)

const origin = "http://localhost:5173"

type client struct {
	t     *testing.T
	base  string
	http  *http.Client
	token string
}

type response struct {
	Status int
	Body   map[string]any
	Raw    string
	Header http.Header
}

func newClient(t *testing.T, base string) *client {
	jar, _ := cookiejar.New(nil)
	return &client{t: t, base: base, http: &http.Client{Jar: jar}}
}

func (c *client) do(method, path string, body any, headers ...string) response {
	c.t.Helper()
	var reader io.Reader
	if body != nil {
		switch b := body.(type) {
		case string:
			reader = strings.NewReader(b)
		default:
			data, _ := json.Marshal(b)
			reader = bytes.NewReader(data)
		}
	}
	req, err := http.NewRequest(method, c.base+path, reader)
	if err != nil {
		c.t.Fatal(err)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}
	for i := 0; i+1 < len(headers); i += 2 {
		req.Header.Set(headers[i], headers[i+1])
	}
	resp, err := c.http.Do(req)
	if err != nil {
		c.t.Fatal(err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	r := response{Status: resp.StatusCode, Raw: string(raw), Header: resp.Header}
	json.Unmarshal(raw, &r.Body)
	return r
}

func (c *client) expect(want int, method, path string, body any, headers ...string) response {
	c.t.Helper()
	r := c.do(method, path, body, headers...)
	if r.Status != want {
		c.t.Fatalf("%s %s: status %d, want %d; body: %s", method, path, r.Status, want, r.Raw)
	}
	return r
}

func str(v any) string {
	s, _ := v.(string)
	return s
}

func (c *client) register(name, email string) {
	c.t.Helper()
	r := c.expect(http.StatusCreated, "POST", "/api/auth/register", map[string]any{
		"name": name, "email": email, "password": "correct horse", "birthday": "1990-05-01",
		"acceptTerms": true, "acceptData": true,
	})
	c.token = str(r.Body["accessToken"])
}

func pngFile(t *testing.T) []byte {
	var buf bytes.Buffer
	png.Encode(&buf, image.NewRGBA(image.Rect(0, 0, 40, 40)))
	return buf.Bytes()
}

func (c *client) upload(path, field, filename string, data []byte) response {
	c.t.Helper()
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	part, _ := w.CreateFormFile(field, filename)
	part.Write(data)
	w.Close()
	req, _ := http.NewRequest("PUT", c.base+path, &buf)
	req.Header.Set("Content-Type", w.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+c.token)
	resp, err := c.http.Do(req)
	if err != nil {
		c.t.Fatal(err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	r := response{Status: resp.StatusCode, Raw: string(raw), Header: resp.Header}
	json.Unmarshal(raw, &r.Body)
	return r
}

func TestAPIIntegration(t *testing.T) {
	url := os.Getenv("FAMIGO_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("FAMIGO_TEST_DATABASE_URL не задан — интеграционный тест пропущен")
	}
	ctx := context.Background()
	log := slog.New(slog.NewTextHandler(io.Discard, nil))

	db, err := database.Connect(ctx, url, log)
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close(db)
	if err := database.Migrate(ctx, db, log); err != nil {
		t.Fatal(err)
	}
	// Повторный запуск миграций ничего не ломает.
	if err := database.Migrate(ctx, db, log); err != nil {
		t.Fatal(err)
	}

	// Два ключа: первый активный. Шаг про смену ключа меняет их местами.
	key1 := fieldcrypt.Key{ID: 1, Secret: bytes.Repeat([]byte{1}, fieldcrypt.KeySize)}
	key2 := fieldcrypt.Key{ID: 2, Secret: bytes.Repeat([]byte{2}, fieldcrypt.KeySize)}

	// Нейросеть в тесте поддельная: отвечает заготовкой и запоминает, что ей прислали.
	var aiRequest atomic.Value
	fakeAI := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		aiRequest.Store(string(body))
		_ = json.NewEncoder(w).Encode(map[string]any{
			"choices": []any{map[string]any{"message": map[string]any{"content": fakeDishes}}},
		})
	}))
	defer fakeAI.Close()

	cfg := config.Config{
		AI:              ai.Config{BaseURL: fakeAI.URL, Model: "fake-model", Timeout: 10 * time.Second, MaxConcurrent: 1},
		MessageKeys:     []fieldcrypt.Key{key1},
		JWTSecret:       []byte("integration-secret-integration-secret"),
		AccessTokenTTL:  15 * time.Minute,
		RefreshTokenTTL: 24 * time.Hour,
		CookieSameSite:  http.SameSiteStrictMode,
		AllowedOrigins:  []string{origin},
		UploadDir:       t.TempDir(),
		DemoPayments:    true,
		LegalVersion:    "test",
		// Все запросы теста идут с одного IP: поднимаем общий лимит, иначе он сработает раньше,
		// чем мы успеем всё проверить. Лимит попыток на одну почту остаётся боевым.
		AuthRateLimit: 10000,
		RateLimit:     100000,
	}
	handler, err := New(cfg, db, log)
	if err != nil {
		t.Fatal(err)
	}
	srv := httptest.NewServer(handler)
	defer srv.Close()

	run := uuid.NewString()[:8]
	email := func(name string) string { return fmt.Sprintf("%s-%s@example.com", name, run) }

	anton, bob, eve := newClient(t, srv.URL), newClient(t, srv.URL), newClient(t, srv.URL)

	// Шаги идут по порядку и зависят друг от друга, поэтому это не отдельные подтесты.
	step := func(name string, fn func(t *testing.T)) {
		t.Log("▶ " + name)
		fn(t)
	}

	step("health и заголовки безопасности", func(t *testing.T) {
		r := anton.expect(200, "GET", "/api/health", nil)
		for _, h := range []string{"X-Content-Type-Options", "X-Frame-Options", "Content-Security-Policy", "Cache-Control"} {
			if r.Header.Get(h) == "" {
				t.Errorf("нет заголовка %s", h)
			}
		}
		if anton.do("GET", "/api/nope", nil).Status != 404 {
			t.Error("неизвестный адрес должен давать 404")
		}
	})

	step("регистрация: проверка ввода", func(t *testing.T) {
		r := anton.expect(422, "POST", "/api/auth/register", map[string]any{
			"name": "", "email": "not-an-email", "password": "123", "birthday": "2999-01-01",
		})
		fields, _ := r.Body["error"].(map[string]any)["fields"].(map[string]any)
		for _, f := range []string{"name", "email", "password", "birthday", "acceptTerms", "acceptData"} {
			if fields[f] == nil {
				t.Errorf("нет ошибки для поля %s: %s", f, r.Raw)
			}
		}
	})

	anton.register("Антон", email("anton"))
	bob.register("Боб", email("bob"))
	eve.register("Ева", email("eve"))

	step("повторная почта в другом регистре", func(t *testing.T) {
		r := newClient(t, srv.URL).expect(409, "POST", "/api/auth/register", map[string]any{
			"name": "Клон", "email": strings.ToUpper(email("anton")), "password": "correct horse",
			"birthday": "1990-05-01", "acceptTerms": true, "acceptData": true,
		})
		if !strings.Contains(r.Raw, "email_taken") {
			t.Fatal(r.Raw)
		}
	})

	step("вход: одинаковый ответ для чужой почты и неверного пароля", func(t *testing.T) {
		c := newClient(t, srv.URL)
		wrongPass := c.expect(401, "POST", "/api/auth/login", map[string]any{"email": email("anton"), "password": "wrong password"})
		noUser := c.expect(401, "POST", "/api/auth/login", map[string]any{"email": email("ghost"), "password": "wrong password"})
		if str(wrongPass.Body["error"].(map[string]any)["message"]) != str(noUser.Body["error"].(map[string]any)["message"]) {
			t.Fatal("ответы различаются — можно узнать, кто зарегистрирован")
		}
		c.expect(200, "POST", "/api/auth/login", map[string]any{"email": strings.ToUpper(email("anton")), "password": "correct horse"})
	})

	step("доступ без токена и с поддельным токеном", func(t *testing.T) {
		c := newClient(t, srv.URL)
		c.expect(401, "GET", "/api/me", nil)
		c.token = anton.token[:len(anton.token)-3] + "abc"
		c.expect(401, "GET", "/api/me", nil)
		c.token = "eyJhbGciOiJub25lIn0.eyJzdWIiOiIxIn0."
		c.expect(401, "GET", "/api/me", nil)
	})

	step("подмена лишних полей (mass assignment)", func(t *testing.T) {
		anton.expect(400, "PATCH", "/api/me", map[string]any{"name": "Антон", "email": "hacker@evil.ru"})
		anton.expect(400, "PATCH", "/api/me", map[string]any{"role": "owner"})
	})

	step("refresh: ротация и защита от повтора украденного токена", func(t *testing.T) {
		c := newClient(t, srv.URL)
		c.expect(200, "POST", "/api/auth/login", map[string]any{"email": email("anton"), "password": "correct horse"})
		u, _ := http.NewRequest("GET", srv.URL+"/api/auth", nil)
		first := c.http.Jar.Cookies(u.URL)
		if len(first) == 0 {
			t.Fatal("нет куки refresh-токена")
		}
		stolen := first[0].Value

		c.expect(200, "POST", "/api/auth/refresh", nil)

		// Повтор сразу после обмена — это не кража: так бывает, когда браузер оборвал запрос
		// (перезагрузили страницу) или две вкладки обновили сессию одновременно.
		tab := newClient(t, srv.URL)
		tab.http.Jar.SetCookies(u.URL, []*http.Cookie{{Name: "famigo_refresh", Value: stolen, Path: "/api/auth"}})
		tab.expect(200, "POST", "/api/auth/refresh", nil)
		c.expect(200, "POST", "/api/auth/refresh", nil)

		// Через 30 секунд повтор старого токена — уже признак кражи. Чтобы не ждать,
		// сдвигаем время обмена в прошлое прямо в базе.
		sum := sha256.Sum256([]byte(stolen))
		if err := db.Model(&models.RefreshToken{}).Where("token_hash = ?", hex.EncodeToString(sum[:])).
			Update("replaced_at", time.Now().Add(-time.Minute)).Error; err != nil {
			t.Fatal(err)
		}
		attacker := newClient(t, srv.URL)
		attacker.http.Jar.SetCookies(u.URL, []*http.Cookie{{Name: "famigo_refresh", Value: stolen, Path: "/api/auth"}})
		attacker.expect(401, "POST", "/api/auth/refresh", nil)

		// После этого все сессии пользователя завершены — и у настоящего владельца, и во второй вкладке.
		c.expect(401, "POST", "/api/auth/refresh", nil)
		tab.expect(401, "POST", "/api/auth/refresh", nil)

		// Завершены все сессии Антона, в том числе основная: её access-токен тоже перестал работать
		// сразу, а не через 15 минут. Дальше тест продолжает с новым входом.
		anton.expect(401, "GET", "/api/me", nil)
		r := anton.expect(200, "POST", "/api/auth/login", map[string]any{"email": email("anton"), "password": "correct horse"})
		anton.token = str(r.Body["accessToken"])
		anton.expect(200, "GET", "/api/me", nil)
	})

	step("выход сразу отзывает access-токен (а не через 15 минут)", func(t *testing.T) {
		// Входим под Бобом: у Антона лимит попыток на почту (10 в минуту) уже потрачен предыдущими шагами.
		login := func(c *client) string {
			r := c.expect(200, "POST", "/api/auth/login", map[string]any{"email": email("bob"), "password": "correct horse"})
			return str(r.Body["accessToken"])
		}
		phone, laptop := newClient(t, srv.URL), newClient(t, srv.URL)
		phone.token, laptop.token = login(phone), login(laptop)
		phone.expect(200, "GET", "/api/me", nil)

		// Обновление сессии не ломает прежний токен той же сессии: сессия одна.
		before := phone.token
		r := phone.expect(200, "POST", "/api/auth/refresh", nil)
		phone.token = str(r.Body["accessToken"])
		phone.expect(200, "GET", "/api/me", nil)

		phone.expect(204, "POST", "/api/auth/logout", nil)
		phone.expect(401, "GET", "/api/me", nil)
		stale := newClient(t, srv.URL)
		stale.token = before
		stale.expect(401, "GET", "/api/me", nil)

		// Другое устройство продолжает работать: выход завершает только свою сессию.
		laptop.expect(200, "GET", "/api/me", nil)
	})

	step("смена пароля и «выйти везде» отзывают все прежние токены", func(t *testing.T) {
		dave, other := newClient(t, srv.URL), newClient(t, srv.URL)
		dave.register("Дэйв", email("dave"))
		r := other.expect(200, "POST", "/api/auth/login", map[string]any{"email": email("dave"), "password": "correct horse"})
		other.token = str(r.Body["accessToken"])
		other.expect(200, "GET", "/api/me", nil)

		changed := dave.expect(200, "PUT", "/api/me/password", map[string]any{"currentPassword": "correct horse", "newPassword": "battery staple"})
		dave.expect(401, "GET", "/api/me", nil)  // сессия, из которой меняли пароль, завершена
		other.expect(401, "GET", "/api/me", nil) // и все остальные тоже
		dave.token = str(changed.Body["accessToken"])
		dave.expect(200, "GET", "/api/me", nil) // новая сессия работает

		again := newClient(t, srv.URL)
		r = again.expect(200, "POST", "/api/auth/login", map[string]any{"email": email("dave"), "password": "battery staple"})
		again.token = str(r.Body["accessToken"])
		dave.expect(204, "POST", "/api/auth/logout-all", nil)
		dave.expect(401, "GET", "/api/me", nil)
		again.expect(401, "GET", "/api/me", nil)
	})

	step("регистрация: строгий лимит с одного адреса затрудняет перебор почт", func(t *testing.T) {
		strict := cfg
		strict.AuthRateLimit = 4 // регистрация: 1 в минуту в среднем, не больше 3 подряд
		handler, err := New(strict, db, log)
		if err != nil {
			t.Fatal(err)
		}
		strictSrv := httptest.NewServer(handler)
		defer strictSrv.Close()

		c := newClient(t, strictSrv.URL)
		for i := range 4 {
			want := http.StatusCreated
			if i == 3 {
				want = http.StatusTooManyRequests
			}
			c.expect(want, "POST", "/api/auth/register", map[string]any{
				"name": "Лимит", "email": fmt.Sprintf("limit%d-%s@example.com", i, run), "password": "correct horse",
				"birthday": "1990-05-01", "acceptTerms": true, "acceptData": true,
			})
		}
	})

	step("WebSocket закрывается после выхода, а не живёт до конца срока", func(t *testing.T) {
		defer func(old time.Duration) { chats.SessionCheckPeriod = old }(chats.SessionCheckPeriod)
		chats.SessionCheckPeriod = 200 * time.Millisecond
		// Период проверки читается в момент открытия соединения.
		c := newClient(t, srv.URL)
		c.register("Икс", email("ws"))
		ticket := str(c.expect(200, "POST", "/api/chats/ws-ticket", nil).Body["ticket"])
		header := http.Header{}
		header.Set("Origin", origin)
		conn, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(srv.URL, "http")+"/api/chats/ws?ticket="+ticket, header)
		if err != nil {
			t.Fatal(err)
		}
		defer conn.Close()

		c.expect(204, "POST", "/api/auth/logout", nil)
		conn.SetReadDeadline(time.Now().Add(3 * time.Second))
		if _, _, err := conn.ReadMessage(); err == nil {
			t.Fatal("после выхода соединение должно закрыться")
		} else if ne, ok := err.(interface{ Timeout() bool }); ok && ne.Timeout() {
			t.Fatal("соединение не закрылось после выхода")
		}
	})

	step("CSRF: refresh с чужого сайта", func(t *testing.T) {
		anton.expect(403, "POST", "/api/auth/refresh", nil, "Origin", "https://evil.example")
	})

	step("CORS: чужой сайт не получает разрешения", func(t *testing.T) {
		r := anton.do("GET", "/api/me", nil, "Origin", "https://evil.example")
		if r.Header.Get("Access-Control-Allow-Origin") != "" {
			t.Fatal("чужому сайту выдан Allow-Origin")
		}
		r = anton.do("GET", "/api/me", nil, "Origin", origin)
		if r.Header.Get("Access-Control-Allow-Origin") != origin {
			t.Fatal("своему фронтенду не выдан Allow-Origin")
		}
	})

	var familyID, homeA, homeB string

	step("семья, приглашение и вступление", func(t *testing.T) {
		r := anton.expect(201, "POST", "/api/families", map[string]any{"name": "Семья Ивановых"})
		familyID = str(r.Body["id"])
		if str(r.Body["role"]) != "owner" {
			t.Fatalf("создатель должен быть владельцем: %s", r.Raw)
		}
		inv := bob.do("POST", "/api/families/"+familyID+"/invite", nil)
		if inv.Status != 404 {
			t.Fatalf("не участник не должен получить код приглашения: %d", inv.Status)
		}
		code := str(anton.expect(200, "POST", "/api/families/"+familyID+"/invite", nil).Body["code"])
		again := str(anton.expect(200, "POST", "/api/families/"+familyID+"/invite", nil).Body["code"])
		if code != again {
			t.Fatal("действующий код должен переиспользоваться")
		}
		bob.expect(400, "POST", "/api/families/join", map[string]any{"code": "AAAAA"})
		bob.expect(200, "POST", "/api/families/join", map[string]any{"code": strings.ToLower(code)})
		bob.expect(409, "POST", "/api/families/join", map[string]any{"code": code})

		n := anton.expect(200, "GET", "/api/notifications", nil)
		if !strings.Contains(n.Raw, "Боб теперь в семье") {
			t.Fatalf("владелец не получил уведомление о новом участнике: %s", n.Raw)
		}
	})

	var bobID string
	step("роли: правила как на фронтенде", func(t *testing.T) {
		d := anton.expect(200, "GET", "/api/families/"+familyID, nil)
		members := d.Body["members"].([]any)
		var antonID string
		for _, m := range members {
			mm := m.(map[string]any)
			if mm["name"] == "Боб" {
				bobID = str(mm["userId"])
			} else {
				antonID = str(mm["userId"])
			}
			if _, leaked := mm["email"]; leaked {
				t.Fatal("почта участников не должна отдаваться семье")
			}
		}
		bob.expect(403, "PATCH", "/api/families/"+familyID+"/members/"+antonID, map[string]any{"role": "member"})
		bob.expect(403, "DELETE", "/api/families/"+familyID+"/members/"+antonID, nil)
		anton.expect(422, "PATCH", "/api/families/"+familyID+"/members/"+bobID, map[string]any{"role": "owner"})
		anton.expect(204, "PATCH", "/api/families/"+familyID+"/members/"+bobID, map[string]any{"role": "admin"})
		bob.expect(403, "DELETE", "/api/families/"+familyID+"/members/"+antonID, nil)
	})

	step("дома и лимит тарифа", func(t *testing.T) {
		home := func(name string) map[string]any {
			return map[string]any{"name": name, "kind": "apartment", "rooms": 3, "peopleCount": 2}
		}
		homeA = str(anton.expect(201, "POST", "/api/families/"+familyID+"/homes", home("Квартира")).Body["id"])
		homeB = str(anton.expect(201, "POST", "/api/families/"+familyID+"/homes", home("Дача")).Body["id"])
		r := anton.expect(403, "POST", "/api/families/"+familyID+"/homes", home("Третий"))
		if !strings.Contains(r.Raw, "plan_limit") {
			t.Fatal(r.Raw)
		}
		anton.expect(200, "POST", "/api/families/"+familyID+"/subscription", map[string]any{"plan": "premium", "period": "month"})
		anton.expect(201, "POST", "/api/families/"+familyID+"/homes", home("Третий"))
		anton.expect(403, "POST", "/api/families/"+familyID+"/homes", home("Четвёртый"))

		anton.expect(204, "PUT", "/api/families/"+familyID+"/members/"+bobID+"/home", map[string]any{"homeId": homeA})
		h := anton.expect(200, "GET", "/api/families/"+familyID+"/homes/"+homeA, nil)
		if !strings.Contains(h.Raw, bobID) {
			t.Fatalf("Боб должен быть жильцом квартиры: %s", h.Raw)
		}
	})

	step("SQL-инъекции сохраняются как обычный текст", func(t *testing.T) {
		evil := "'); DROP TABLE users;--"
		r := anton.expect(201, "POST", "/api/families/"+familyID+"/homes/"+homeA+"/tasks",
			map[string]any{"text": evil, "description": "1' OR '1'='1"})
		if str(r.Body["text"]) != evil {
			t.Fatalf("текст изменился: %s", r.Raw)
		}
		anton.expect(201, "POST", "/api/families/"+familyID+"/homes/"+homeA+"/products",
			map[string]any{"name": "x' OR 1=1--", "category": "dairy", "quantity": 1.5, "unit": "l", "expiresOn": "2026-12-01"})
		// Таблица users жива: вход работает.
		newClient(t, srv.URL).expect(200, "POST", "/api/auth/login", map[string]any{"email": email("bob"), "password": "correct horse"})
		// «Мусор» вместо UUID в адресе — 404, а не ошибка базы.
		anton.expect(404, "GET", "/api/families/"+familyID+"/homes/1%20OR%201=1", nil)
	})

	step("IDOR: чужая семья недоступна", func(t *testing.T) {
		eveFamily := str(eve.expect(201, "POST", "/api/families", map[string]any{"name": "Семья Евы"}).Body["id"])
		eve.expect(404, "GET", "/api/families/"+familyID, nil)
		eve.expect(404, "GET", "/api/families/"+familyID+"/homes", nil)
		eve.expect(404, "GET", "/api/families/"+familyID+"/homes/"+homeA+"/products", nil)
		// Подставляем id чужого дома в адрес своей семьи — тоже мимо.
		eve.expect(404, "GET", "/api/families/"+eveFamily+"/homes/"+homeA, nil)
		eve.expect(404, "GET", "/api/families/"+eveFamily+"/homes/"+homeA+"/products", nil)
		eve.expect(404, "POST", "/api/families/"+eveFamily+"/homes/"+homeA+"/tasks", map[string]any{"text": "взлом"})
		eve.expect(404, "DELETE", "/api/families/"+eveFamily+"/homes/"+homeB, nil)
		// Нельзя записать расход на чужой дом.
		eve.expect(404, "POST", "/api/families/"+eveFamily+"/transactions", map[string]any{
			"type": "expense", "category": "home", "amount": 100, "occurredOn": "2026-10-01", "homeId": homeA})
		// Нельзя позвать в событие человека из другой семьи.
		eveID := str(eve.expect(200, "GET", "/api/me", nil).Body["id"])
		anton.expect(422, "POST", "/api/families/"+familyID+"/events", map[string]any{
			"title": "Ужин", "startsAt": "2026-10-27T19:30:00+03:00", "memberIds": []string{eveID}})
		anton.expect(404, "POST", "/api/families/"+familyID+"/chats/direct", map[string]any{"userId": eveID})
	})

	step("бюджет: копейки, сводка, уведомление", func(t *testing.T) {
		month := time.Now().Format("2006-01")
		day := time.Now().Format(time.DateOnly)
		bob.expect(201, "POST", "/api/families/"+familyID+"/transactions", map[string]any{
			"type": "income", "category": "salary", "amount": 12000000, "occurredOn": day})
		bob.expect(201, "POST", "/api/families/"+familyID+"/transactions", map[string]any{
			"type": "expense", "category": "groceries", "amount": 550050, "occurredOn": day})
		bob.expect(422, "POST", "/api/families/"+familyID+"/transactions", map[string]any{
			"type": "expense", "category": "salary", "amount": 100, "occurredOn": day})
		s := anton.expect(200, "GET", "/api/families/"+familyID+"/budget/summary?month="+month, nil)
		if s.Body["balance"] != float64(12000000-550050) || s.Body["expense"] != float64(550050) {
			t.Fatalf("неверная сводка: %s", s.Raw)
		}
		n := anton.expect(200, "GET", "/api/notifications", nil)
		if !strings.Contains(n.Raw, "5 500,50") {
			t.Fatalf("нет уведомления о расходе: %s", n.Raw)
		}
	})

	step("календарь", func(t *testing.T) {
		e := anton.expect(201, "POST", "/api/families/"+familyID+"/events", map[string]any{
			"title": "Семейный ужин", "startsAt": "2026-10-27T19:30:00+03:00", "place": "apartment",
			"memberIds": []string{bobID}})
		if len(e.Body["memberIds"].([]any)) != 1 {
			t.Fatal(e.Raw)
		}
		l := bob.expect(200, "GET", "/api/families/"+familyID+"/events?from=2026-10-01&to=2026-11-01", nil)
		if !strings.Contains(l.Raw, "Семейный ужин") {
			t.Fatal(l.Raw)
		}
		bob.expect(400, "GET", "/api/families/"+familyID+"/events?from=1000-01-01&to=3000-01-01", nil)
	})

	step("чаты: XSS хранится текстом, чужой чат недоступен", func(t *testing.T) {
		chats := anton.expect(200, "GET", "/api/families/"+familyID+"/chats", nil)
		familyChat := str(chats.Body["items"].([]any)[0].(map[string]any)["id"])
		xss := "<script>alert(1)</script>"
		anton.expect(201, "POST", "/api/families/"+familyID+"/chats/"+familyChat+"/messages", map[string]any{"text": xss})
		m := bob.expect(200, "GET", "/api/families/"+familyID+"/chats/"+familyChat+"/messages", nil)
		escaped := "\\" + "u003cscript" + "\\" + "u003e" // так в JSON выглядит экранированный <script>
		if strings.Contains(m.Raw, "<script>") || !strings.Contains(m.Raw, escaped) {
			t.Fatalf("HTML в JSON должен экранироваться: %s", m.Raw)
		}
		list := bob.expect(200, "GET", "/api/families/"+familyID+"/chats", nil)
		if list.Body["items"].([]any)[0].(map[string]any)["unread"] != float64(1) {
			t.Fatalf("у Боба должно быть 1 непрочитанное: %s", list.Raw)
		}
		eveFamily := str(eve.expect(200, "GET", "/api/families", nil).Body["items"].([]any)[0].(map[string]any)["id"])
		eve.expect(404, "GET", "/api/families/"+eveFamily+"/chats/"+familyChat+"/messages", nil)

		direct := str(anton.expect(200, "POST", "/api/families/"+familyID+"/chats/direct", map[string]any{"userId": bobID}).Body["chatId"])
		again := str(bob.expect(200, "POST", "/api/families/"+familyID+"/chats/direct", map[string]any{"userId": str(anton.expect(200, "GET", "/api/me", nil).Body["id"])}).Body["chatId"])
		if direct != again {
			t.Fatal("у пары должен быть один личный чат")
		}
	})

	step("сообщения в базе зашифрованы; подмена, старые открытые и смена ключа", func(t *testing.T) {
		chatsList := anton.expect(200, "GET", "/api/families/"+familyID+"/chats", nil)
		familyChat := str(chatsList.Body["items"].([]any)[0].(map[string]any)["id"])
		chatUUID := uuid.MustParse(familyChat)
		messagesURL := "/api/families/" + familyID + "/chats/" + familyChat + "/messages"
		secret := "Пароль от wifi: tortilla-" + run
		created := map[uuid.UUID]bool{} // что создали в этом шаге: убираем в конце, чтобы не мешать следующим
		defer func() {
			for id := range created {
				db.Delete(&models.Message{}, "id = ?", id)
			}
		}()

		sent := anton.expect(201, "POST", messagesURL, map[string]any{"text": secret})
		sentID := uuid.MustParse(str(sent.Body["id"]))
		created[sentID] = true
		if str(sent.Body["text"]) != secret {
			t.Fatalf("автору возвращается открытый текст: %s", sent.Raw)
		}

		// 1. В базе открытого текста нет, есть запись «enc:v1:1:…».
		var row models.Message
		if err := db.First(&row, "id = ?", sentID).Error; err != nil {
			t.Fatal(err)
		}
		if strings.Contains(row.Text, "tortilla") || !strings.HasPrefix(row.Text, "enc:v1:1:") {
			t.Fatalf("в базе должен лежать шифртекст, а там: %.60q", row.Text)
		}
		// Длинное сообщение (2000 символов, по 2 байта каждый) тоже помещается в колонку после шифрования.
		long := strings.Repeat("ж", 2000)
		longMsg := anton.expect(201, "POST", messagesURL, map[string]any{"text": long})
		created[uuid.MustParse(str(longMsg.Body["id"]))] = true

		// 2. Через API текст читается у других участников, в том числе в списке чатов.
		if m := bob.expect(200, "GET", messagesURL, nil); !strings.Contains(m.Raw, secret) || !strings.Contains(m.Raw, long) {
			t.Fatalf("Боб должен читать расшифрованный текст: %.200s", m.Raw)
		}

		// 3. Шифртекст привязан к своему сообщению: перенос в другое не расшифровывается.
		var other models.Message
		if err := db.Where("chat_id = ? AND id <> ? AND deleted_at IS NULL AND text <> ''", chatUUID, sentID).First(&other).Error; err != nil {
			t.Fatal(err)
		}
		db.Model(&models.Message{}).Where("id = ?", other.ID).Update("text", row.Text)
		swapped := bob.expect(200, "GET", messagesURL, nil)
		db.Model(&models.Message{}).Where("id = ?", other.ID).Update("text", other.Text) // возвращаем как было
		if !strings.Contains(swapped.Raw, "не удалось расшифровать") {
			t.Fatalf("перенесённый шифртекст не должен расшифровываться: %.200s", swapped.Raw)
		}

		// 4. Старое открытое сообщение (появилось до включения шифрования) читается и при запуске шифруется.
		legacy := models.Message{ID: uuid.New(), ChatID: chatUUID, UserID: ptr(uuid.MustParse(str(anton.expect(200, "GET", "/api/me", nil).Body["id"]))), Text: "старое открытое сообщение"}
		if err := db.Create(&legacy).Error; err != nil {
			t.Fatal(err)
		}
		created[legacy.ID] = true
		if m := bob.expect(200, "GET", messagesURL, nil); !strings.Contains(m.Raw, legacy.Text) {
			t.Fatalf("старое открытое сообщение должно читаться до миграции: %.200s", m.Raw)
		}
		cipher1, _ := fieldcrypt.New([]fieldcrypt.Key{key1})
		done, failed, err := chats.Reencrypt(ctx, db, cipher1, log)
		if err != nil || failed != 0 || done < 1 {
			t.Fatalf("Reencrypt: переведено %d, не удалось %d, err %v", done, failed, err)
		}
		db.First(&row, "id = ?", legacy.ID)
		if strings.Contains(row.Text, "старое") || !strings.HasPrefix(row.Text, "enc:v1:1:") {
			t.Fatalf("старое сообщение должно быть зашифровано: %.60q", row.Text)
		}
		if m := bob.expect(200, "GET", messagesURL, nil); !strings.Contains(m.Raw, legacy.Text) {
			t.Fatal("после шифрования старое сообщение должно читаться")
		}

		// 5. Смена ключа: активным становится ключ 2, все записи перешифровываются, ключ 1 остаётся для чтения.
		cipher21, _ := fieldcrypt.New([]fieldcrypt.Key{key2, key1})
		if _, failed, err := chats.Reencrypt(ctx, db, cipher21, log); err != nil || failed != 0 {
			t.Fatalf("смена ключа: не удалось %d, err %v", failed, err)
		}
		db.First(&row, "id = ?", sentID)
		if !strings.HasPrefix(row.Text, "enc:v1:2:") {
			t.Fatalf("после смены ключа запись должна идти ключом 2: %.30q", row.Text)
		}
		if plain, err := cipher21.Decrypt(row.Text, "message|"+familyChat+"|"+sentID.String()); err != nil || plain != secret {
			t.Fatalf("новым ключом сообщение должно читаться: %q, %v", plain, err)
		}
		// Возвращаем ключ 1 активным: сервер этого теста работает с ним, остальные шаги не должны страдать.
		cipher12, _ := fieldcrypt.New([]fieldcrypt.Key{key1, key2})
		if _, failed, err := chats.Reencrypt(ctx, db, cipher12, log); err != nil || failed != 0 {
			t.Fatalf("возврат ключа: не удалось %d, err %v", failed, err)
		}
		if m := bob.expect(200, "GET", messagesURL, nil); !strings.Contains(m.Raw, secret) {
			t.Fatal("после возврата ключа сообщения должны читаться сервером")
		}
	})

	step("WebSocket: мгновенная доставка, чужие не слышат, билет одноразовый", func(t *testing.T) {
		wsBase := "ws" + strings.TrimPrefix(srv.URL, "http") + "/api/chats/ws?ticket="
		dial := func(c *client, originHeader string) (*websocket.Conn, string, int) {
			ticket := str(c.expect(200, "POST", "/api/chats/ws-ticket", nil).Body["ticket"])
			header := http.Header{}
			if originHeader != "" {
				header.Set("Origin", originHeader)
			}
			conn, resp, err := websocket.DefaultDialer.Dial(wsBase+ticket, header)
			status := 0
			if resp != nil {
				status = resp.StatusCode
			}
			if err != nil {
				return nil, ticket, status
			}
			return conn, ticket, status
		}
		readEvent := func(conn *websocket.Conn, wantType string) map[string]any {
			t.Helper()
			conn.SetReadDeadline(time.Now().Add(3 * time.Second))
			for {
				var ev map[string]any
				if err := conn.ReadJSON(&ev); err != nil {
					t.Fatalf("не дождались события %s: %v", wantType, err)
				}
				if ev["type"] == wantType {
					return ev
				}
			}
		}

		bobConn, used, _ := dial(bob, origin)
		if bobConn == nil {
			t.Fatal("Боб не подключился")
		}
		defer bobConn.Close()
		eveConn, _, _ := dial(eve, origin)
		defer eveConn.Close()

		// Повторно использовать билет нельзя.
		if _, resp, err := websocket.DefaultDialer.Dial(wsBase+used, nil); err == nil || resp.StatusCode != 401 {
			t.Fatal("билет сработал второй раз")
		}
		// Подключение со страницы чужого сайта отклоняется (CSWSH).
		if conn, _, status := dial(bob, "https://evil.example"); conn != nil || status != 403 {
			t.Fatalf("чужой Origin пропущен: %d", status)
		}

		chats := anton.expect(200, "GET", "/api/families/"+familyID+"/chats", nil)
		familyChat := str(chats.Body["items"].([]any)[0].(map[string]any)["id"])

		// Сообщение через REST приходит Бобу по WebSocket.
		anton.expect(201, "POST", "/api/families/"+familyID+"/chats/"+familyChat+"/messages", map[string]any{"text": "Ужин в 19:00"})
		ev := readEvent(bobConn, "message")
		if ev["message"].(map[string]any)["text"] != "Ужин в 19:00" || ev["chatId"] != familyChat {
			t.Fatalf("неверное событие: %v", ev)
		}

		// Боб отправляет через WebSocket и получает своё сообщение с clientId обратно.
		bobConn.WriteJSON(map[string]any{"type": "send", "familyId": familyID, "chatId": familyChat, "text": "Буду!", "clientId": "tmp-1"})
		ev = readEvent(bobConn, "message")
		if ev["clientId"] != "tmp-1" || ev["message"].(map[string]any)["text"] != "Буду!" {
			t.Fatalf("эхо своего сообщения: %v", ev)
		}
		history := anton.expect(200, "GET", "/api/families/"+familyID+"/chats/"+familyChat+"/messages", nil)
		if !strings.Contains(history.Raw, "Буду!") {
			t.Fatal("сообщение из WebSocket не сохранилось")
		}

		// Ева не в этой семье: ни подслушать, ни написать в чужой чат.
		eveConn.WriteJSON(map[string]any{"type": "send", "familyId": familyID, "chatId": familyChat, "text": "взлом", "clientId": "x"})
		if e := readEvent(eveConn, "error"); e["code"] != "not_found" {
			t.Fatalf("Ева смогла писать в чужой чат: %v", e)
		}
		eveConn.SetReadDeadline(time.Now().Add(300 * time.Millisecond))
		var leaked map[string]any
		if err := eveConn.ReadJSON(&leaked); err == nil {
			t.Fatalf("Ева получила чужое событие: %v", leaked)
		}

		// Мусор вместо JSON и неизвестные команды не роняют соединение.
		bobConn.WriteJSON(map[string]any{"type": "drop_tables", "familyId": familyID, "chatId": familyChat})
		if e := readEvent(bobConn, "error"); e["code"] != "unknown_type" {
			t.Fatalf("неизвестная команда: %v", e)
		}

		// «Прочитано»: Боб читает — Антон (по WebSocket) узнаёт об этом.
		antonConn, _, _ := dial(anton, origin)
		defer antonConn.Close()
		bobConn.WriteJSON(map[string]any{"type": "read", "familyId": familyID, "chatId": familyChat})
		if r := readEvent(antonConn, "read"); r["chatId"] != familyChat {
			t.Fatalf("событие прочтения: %v", r)
		}
	})

	step("аватар", func(t *testing.T) {
		r := anton.upload("/api/me/avatar", "avatar", "me.png", pngFile(t))
		if r.Status != 200 {
			t.Fatalf("загрузка: %d %s", r.Status, r.Raw)
		}
		url := str(r.Body["avatarUrl"])
		img := anton.expect(200, "GET", strings.TrimPrefix(url, ""), nil)
		if img.Header.Get("Content-Type") != "image/jpeg" || img.Header.Get("X-Content-Type-Options") != "nosniff" {
			t.Fatalf("заголовки картинки: %v", img.Header)
		}
		bad := anton.upload("/api/me/avatar", "avatar", "evil.png", []byte("<html><script>alert(1)</script>"))
		if bad.Status != 400 {
			t.Fatalf("HTML под видом картинки должен отклоняться: %d", bad.Status)
		}
		anton.expect(404, "GET", "/api/uploads/avatars/..%2F..%2Fgo.mod", nil)
	})

	step("предпочтения в еде требуют согласия", func(t *testing.T) {
		anton.expect(422, "PUT", "/api/me/food", map[string]any{"prefs": []string{"Аллергия на орехи"}})
		r := anton.expect(200, "PUT", "/api/me/food", map[string]any{"prefs": []string{"Аллергия на орехи", "Своё блюдо"}, "consent": true})
		if len(r.Body["foodPrefs"].([]any)) != 2 {
			t.Fatal(r.Raw)
		}
	})

	step("блюда от нейросети: тариф, ограничения, личные данные", func(t *testing.T) {
		base := "/api/families/" + familyID + "/homes/" + homeA
		suggest := base + "/recipes/suggest"
		anton.expect(201, "POST", base+"/products",
			map[string]any{"name": "Яйца", "category": "other", "quantity": 10, "unit": "pcs", "expiresOn": "2099-01-01"})
		anton.expect(201, "POST", base+"/products",
			map[string]any{"name": "Старый кефир", "category": "dairy", "quantity": 1, "unit": "l", "expiresOn": "2020-01-01"})

		r := anton.expect(403, "POST", suggest, map[string]any{"servings": 2})
		if !strings.Contains(r.Raw, "plan_limit") {
			t.Fatalf("на Premium подбор блюд недоступен: %s", r.Raw)
		}
		anton.expect(200, "POST", "/api/families/"+familyID+"/subscription", map[string]any{"plan": "premium_plus", "period": "month"})

		anton.expect(422, "POST", suggest, map[string]any{"servings": 0})
		anton.expect(422, "POST", suggest, map[string]any{"servings": 2, "language": "xx"})
		anton.expect(422, "POST", suggest, map[string]any{"servings": 2, "category": "unknown"})
		anton.expect(422, "POST", suggest, map[string]any{"servings": 2, "memberIds": []string{uuid.NewString()}})
		eve.expect(404, "POST", suggest, map[string]any{"servings": 2})

		r = bob.expect(200, "POST", suggest, map[string]any{"servings": 3})
		items := r.Body["items"].([]any)
		// Пять разных блюд: салат с орехами и блюдо без шагов не проходят проверку.
		if len(items) != 5 || r.Body["dropped"].(float64) != 2 || r.Body["model"] != "fake-model" {
			t.Fatalf("ответ: %s", r.Raw)
		}
		dish := items[0].(map[string]any)
		ingredients := dish["ingredients"].([]any)
		if dish["servings"].(float64) != 3 || len(ingredients) != 3 || dish["missingCount"].(float64) != 1 || ingredients[2].(map[string]any)["staple"] != true {
			t.Fatalf("блюдо: %s", r.Raw)
		}
		if ingredients[0].(map[string]any)["inFridge"] != true || ingredients[1].(map[string]any)["inFridge"] != false {
			t.Fatalf("есть/докупить: %s", r.Raw)
		}

		sent, _ := aiRequest.Load().(string)
		for _, want := range []string{"Яйца", "Аллергия на орехи", `\"servings\":3`} {
			if !strings.Contains(sent, want) {
				t.Errorf("нейросеть не получила %q: %s", want, sent)
			}
		}
		// Модели уходят только продукты и ограничения: без имён, почты и испорченных продуктов.
		for _, leak := range []string{"Антон", "Боб", email("anton"), email("bob"), "Старый кефир"} {
			if strings.Contains(sent, leak) {
				t.Errorf("нейросеть получила лишнее %q", leak)
			}
		}

		// Только Боб: его ограничений нет, и салат с орехами проходит.
		r = bob.expect(200, "POST", suggest, map[string]any{"servings": 1, "memberIds": []string{bobID}, "category": "snack"})
		if len(r.Body["items"].([]any)) != 5 || r.Body["category"] != "snack" {
			t.Fatalf("для Боба должна получиться подборка из пяти закусок: %s", r.Raw)
		}
		r = bob.expect(200, "POST", suggest, map[string]any{"servings": 1, "allMembers": false, "memberIds": []string{}})
		if r.Body["dropped"].(float64) != 1 {
			t.Fatalf("empty selection must apply no restrictions: %s", r.Raw)
		}
		r = bob.expect(200, "POST", suggest, map[string]any{"servings": 1, "allMembers": true, "memberIds": []string{bobID}})
		if r.Body["dropped"].(float64) != 2 {
			t.Fatalf("all members must include family restrictions: %s", r.Raw)
		}
	})

	step("слишком большой запрос", func(t *testing.T) {
		huge := `{"name":"` + strings.Repeat("a", 2<<20) + `"}`
		anton.expect(413, "PATCH", "/api/me", huge)
	})

	step("удаление владельца передаёт права администратору", func(t *testing.T) {
		anton.expect(403, "DELETE", "/api/me", map[string]any{"password": "wrong password"})
		anton.expect(204, "DELETE", "/api/me", map[string]any{"password": "correct horse"})
		// Токен удалённого аккаунта ещё не истёк, но больше нигде не работает.
		anton.expect(401, "GET", "/api/me", nil)
		anton.expect(401, "POST", "/api/families", map[string]any{"name": "Призрак"})
		anton.expect(401, "GET", "/api/families/"+familyID, nil)
		d := bob.expect(200, "GET", "/api/families/"+familyID, nil)
		if str(d.Body["role"]) != "owner" {
			t.Fatalf("Боб (админ) должен стать владельцем: %s", d.Raw)
		}
	})

	step("ограничение попыток входа", func(t *testing.T) {
		c := newClient(t, srv.URL)
		limited := false
		for range 8 {
			r := c.do("POST", "/api/auth/login", map[string]any{"email": email("eve"), "password": "guess guess"})
			if r.Status == 429 {
				limited = true
				break
			}
		}
		if !limited {
			t.Fatal("перебор пароля не ограничивается")
		}
	})
}

func ptr[T any](v T) *T { return &v }

// fakeDishes — пять разных подходящих блюд, салат с орехами (нарушает
// аллергию Антона) и сломанное блюдо без шагов.
const fakeDishes = `{"dishes":[
 {"title":"Омлет с сыром","minutes":10,"ingredients":[
   {"name":"Яйца","name_ru":"Яйца","amount":"4 шт.","product":"Яйца"},
   {"name":"Сыр","name_ru":"Сыр","amount":"50 г","product":""},
   {"name":"Соль","name_ru":"Соль","amount":"по вкусу","product":""}],
  "steps":["Взбейте яйца.","Жарьте под крышкой 5 минут."]},
 {"title":"Салат с яйцом и грецкими орехами","minutes":15,"ingredients":[
   {"name":"Яйца","name_ru":"Яйца","amount":"2 шт.","product":"Яйца"},
   {"name":"Грецкие орехи","name_ru":"Грецкие орехи","amount":"30 г","product":""}],
  "steps":["Отварите яйца.","Смешайте с орехами."]},
 {"title":"Загадочное блюдо","minutes":5,"ingredients":[{"name":"Яйца","name_ru":"Яйца","amount":"1","product":"Яйца"}],"steps":[]},
 {"title":"Яичная запеканка","minutes":25,"ingredients":[{"name":"Яйца","name_ru":"Яйца","amount":"2 шт.","product":"Яйца"},{"name":"Картофель","name_ru":"Картофель","amount":"200 г","product":""}],"steps":["Взбейте яйца для запеканки.","Запеките в форме."]},
 {"title":"Рулет с зеленью","minutes":20,"ingredients":[{"name":"Яйца","name_ru":"Яйца","amount":"2 шт.","product":"Яйца"},{"name":"Укроп","name_ru":"Укроп","amount":"20 г","product":""}],"steps":["Приготовьте яичный блин.","Сверните в рулет с зеленью."]},
 {"title":"Яичные маффины","minutes":30,"ingredients":[{"name":"Яйца","name_ru":"Яйца","amount":"2 шт.","product":"Яйца"},{"name":"Мука","name_ru":"Мука","amount":"100 г","product":""}],"steps":["Разлейте смесь по формам для маффинов.","Испеките маффины."]},
 {"title":"Воздушное суфле","minutes":25,"ingredients":[{"name":"Яйца","name_ru":"Яйца","amount":"2 шт.","product":"Яйца"},{"name":"Творог","name_ru":"Творог","amount":"100 г","product":""}],"steps":["Взбейте белки для суфле.","Осторожно соедините и запеките суфле."]}
]}`
