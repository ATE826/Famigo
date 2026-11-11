# Сборка в два этапа: в первом компилируем, во втором — только готовая программа.
# Итоговый образ маленький и без компилятора, shell и пакетного менеджера:
# даже если сервер взломают, в контейнере почти нечем воспользоваться.

FROM golang:1.27-alpine AS build
WORKDIR /src

# Сначала только go.mod/go.sum: зависимости скачиваются заново, лишь когда они меняются.
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/api ./cmd/api \
    && mkdir -p /out/uploads

# distroless/static — почти пустой образ. nonroot — сервер работает не от root.
FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=build /out/api /app/api
COPY --from=build --chown=nonroot:nonroot /out/uploads /app/uploads

ENV PORT=8080 \
    UPLOAD_DIR=/app/uploads

USER nonroot:nonroot
EXPOSE 8080
ENTRYPOINT ["/app/api"]
