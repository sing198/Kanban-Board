FROM golang:1.23-alpine AS builder

RUN apk add --no-cache gcc musl-dev

WORKDIR /app

# Install dependencies first for caching
COPY go.mod go.sum ./
RUN go mod download

# Copy source code and build
COPY . .
RUN CGO_ENABLED=1 go build -ldflags="-w -s" -o main .

# Runtime: use alpine (provides musl libc) so the CGO-built binary can run.
FROM alpine:latest
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app
COPY --from=builder /app/main .

RUN mkdir -p /app/data

EXPOSE 8080
CMD ["./main"]
