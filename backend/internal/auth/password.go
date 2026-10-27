// Пакет auth — регистрация, вход, токены и проверка, что запрос сделал вошедший пользователь.
package auth

import (
	"crypto/rand"
	"sync"

	"golang.org/x/crypto/bcrypt"
)

// Стоимость bcrypt: каждая +1 вдвое замедляет подбор пароля. 12 — около 0,25 с на проверку:
// незаметно для человека, но очень дорого для перебора миллионов паролей.
const bcryptCost = 12

// HashPassword превращает пароль в хеш с солью. Из хеша пароль не восстановить.
func HashPassword(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcryptCost)
	return string(hash), err
}

// CheckPassword сравнивает пароль с хешем. Сравнение идёт за одинаковое время,
// поэтому по скорости ответа нельзя понять, сколько символов угадано.
func CheckPassword(hash, password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

var (
	dummyOnce sync.Once
	dummyHash []byte
)

// equalizeTiming тратит столько же времени, сколько настоящая проверка пароля.
// Вызывается, когда пользователя с такой почтой нет: иначе по быстрому ответу
// можно было бы узнать, какие почты зарегистрированы.
func equalizeTiming(password string) {
	dummyOnce.Do(func() {
		random := make([]byte, 32)
		rand.Read(random)
		dummyHash, _ = bcrypt.GenerateFromPassword(random[:32], bcryptCost)
	})
	bcrypt.CompareHashAndPassword(dummyHash, []byte(password))
}
