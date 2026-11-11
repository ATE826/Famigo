package families

import (
	"crypto/rand"
	"math/big"
	"regexp"
	"strings"
	"time"
)

// Алфавит без похожих символов (нет 0/O и 1/I), как на фронтенде.
const inviteAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

const (
	inviteLength = 5
	inviteTTL    = 12 * time.Hour
)

var inviteCodePattern = regexp.MustCompile(`^[A-HJ-NP-Z2-9]{5}$`)

// newInviteCode — код из криптографически стойкого генератора (crypto/rand).
// Обычный math/rand предсказуем: зная пару кодов, можно было бы угадать следующие.
func newInviteCode() string {
	var b strings.Builder
	max := big.NewInt(int64(len(inviteAlphabet)))
	for range inviteLength {
		n, err := rand.Int(rand.Reader, max)
		if err != nil {
			panic(err)
		}
		b.WriteByte(inviteAlphabet[n.Int64()])
	}
	return b.String()
}

// normalizeInviteCode приводит ввод к виду кода: «k7mpx » → «K7MPX».
func normalizeInviteCode(code string) (string, bool) {
	code = strings.ToUpper(strings.TrimSpace(code))
	return code, inviteCodePattern.MatchString(code)
}
