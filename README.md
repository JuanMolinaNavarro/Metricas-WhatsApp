# Metricas WhatsApp CallBell

API en Node.js + TypeScript para recibir webhooks de CallBell, deduplicar eventos y calcular metricas operativas de WhatsApp (casos atendidos same-day, FRT y duracion de conversaciones). El reporting se hace por dia local Argentina (America/Argentina/Tucuman) y expone endpoints listos para Power BI.

## Requisitos
- Docker + Docker Compose

## Quick start

1) Copia variables de entorno
```
cp .env.example .env
```

2) Levanta los servicios
```
docker compose up --build
```

La API queda en `http://localhost:3000`.

## Variables de entorno
- `DATABASE_URL`: cadena de conexion a Postgres.
- `PORT`: puerto de la API (default 3000).
- `WEBHOOK_SECRET`: si se setea, se exige header `x-webhook-secret` con el mismo valor.

## Endpoints
- `GET /health`
- `POST /webhooks/callbell`
- `GET /metrics/casos-atendidos?desde=YYYY-MM-DD&hasta=YYYY-MM-DD`
- `GET /metrics/casos-atendidos/resumen?desde=YYYY-MM-DD&hasta=YYYY-MM-DD`
- `GET /metrics/tiempo-primera-respuesta?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&team_uuid=&agent_email=`
- `GET /metrics/tiempo-primera-respuesta/sla?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&max_seconds=300&team_uuid=&agent_email=`
- `GET /metrics/tiempo-primera-respuesta/agentes-resumen?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&team_uuid=`
- `GET /metrics/tiempo-primera-respuesta/ranking-agentes?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&order=asc&limit=10&team_uuid=`
- `GET /metrics/duracion-promedio?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&team_uuid=&agent_email=`
- `GET /metrics/tiempo-primera-respuesta/resumen-agentes?desde=YYYY-MM-DD&hasta=YYYY-MM-DD`
- `GET /metrics/tiempo-primera-respuesta/resumen-equipos?desde=YYYY-MM-DD&hasta=YYYY-MM-DD`
- `GET /metrics/duracion-promedio/resumen-agentes?desde=YYYY-MM-DD&hasta=YYYY-MM-DD`
- `GET /metrics/duracion-promedio/resumen-equipos?desde=YYYY-MM-DD&hasta=YYYY-MM-DD`
- `GET /metrics/casos-resueltos?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&team_uuid=&agent_email=`
- `GET /metrics/casos-abandonados-24h?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&team_uuid=&agent_email=&as_of=`

## Ejemplo de webhook (message_created)

```
curl -X POST http://localhost:3000/webhooks/callbell \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: TU_SECRET" \
  -d '{
    "event": "message_created",
    "data": {
      "uuid": "3f6a2d1b-0f2e-4d7b-8d9b-1f9c6f5d0a11",
      "status": "received",
      "channel": "whatsapp",
      "createdAt": "2025-12-30T14:22:00Z",
      "contact": {
        "conversationHref": "https://dash.callbell.eu/chat/abc123",
        "source": "whatsapp"
      }
    }
  }'
```

## Ejemplo de webhook (conversation_opened)

```
curl -X POST http://localhost:3000/webhooks/callbell \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: TU_SECRET" \
  -d '{
    "event": "conversation_opened",
    "payload": {
      "source": "whatsapp",
      "href": "https://dash.callbell.eu/chat/abc123",
      "createdAt": "2025-12-30T14:22:00Z",
      "contact": {
        "team": {
          "uuid": "c93180c54de0449b805d318cc825d1c4",
          "name": "Salta Cable"
        },
        "assignedUser": "calltnieva@providers.com.ar"
      }
    }
  }'
```

## Metricas para Power BI

Power BI puede consumir endpoints web. Ejemplos:
- `http://localhost:3000/metrics/casos-atendidos?desde=2025-12-01&hasta=2025-12-31`
- `http://localhost:3000/metrics/casos-atendidos/resumen?desde=2025-12-01&hasta=2025-12-31`
- `http://localhost:3000/metrics/tiempo-primera-respuesta?desde=2025-12-01&hasta=2025-12-31`
- `http://localhost:3000/metrics/tiempo-primera-respuesta?desde=2025-12-01&hasta=2025-12-31&team_uuid=c93180c54de0449b805d318cc825d1c4&agent_email=calltnieva@providers.com.ar`
- `http://localhost:3000/metrics/tiempo-primera-respuesta/sla?desde=2025-12-01&hasta=2025-12-31&max_seconds=300`
- `http://localhost:3000/metrics/tiempo-primera-respuesta/agentes-resumen?desde=2025-12-01&hasta=2025-12-31`
- `http://localhost:3000/metrics/tiempo-primera-respuesta/ranking-agentes?desde=2025-12-01&hasta=2025-12-31&order=asc&limit=10`
- `http://localhost:3000/metrics/duracion-promedio?desde=2025-12-01&hasta=2025-12-31`
- `http://localhost:3000/metrics/tiempo-primera-respuesta/resumen-agentes?desde=2025-12-01&hasta=2025-12-31`
- `http://localhost:3000/metrics/tiempo-primera-respuesta/resumen-equipos?desde=2025-12-01&hasta=2025-12-31`
- `http://localhost:3000/metrics/duracion-promedio/resumen-agentes?desde=2025-12-01&hasta=2025-12-31`
- `http://localhost:3000/metrics/duracion-promedio/resumen-equipos?desde=2025-12-01&hasta=2025-12-31`
- `http://localhost:3000/metrics/casos-resueltos?desde=2025-12-01&hasta=2025-12-31`
- `http://localhost:3000/metrics/casos-abandonados-24h?desde=2025-12-01&hasta=2025-12-31`

## Notas de procesamiento
- Deduplicacion por `uuid` usando `messages_raw` con `ON CONFLICT DO NOTHING`.
- La fecha local se calcula en `America/Argentina/Tucuman` a partir de `createdAt` (UTC).
- Solo se actualizan metricas si el evento fue insertado (idempotencia).
- FRT se mide desde el momento en que el backend recibe `conversation_opened` hasta el primer `message_created` con status `sent`.
- `conversation_opened` se deduplica si llega otro evento con el mismo `conversation_href` en una ventana de 60 segundos.
- Duracion de conversacion se calcula entre `opened_received_at_utc` y `closed_received_at_utc` (server receive time) y se atribuye al dia de apertura.
- Casos resueltos se calculan con `is_closed` sobre casos abiertos por dia de apertura.
- Casos abandonados 24h se calculan si el ultimo mensaje fue del cliente (`last_message_status = received`) y `as_of >= last_inbound_at_utc + 24h`.



## Endpoints de rangos recientes

- `GET /metrics/casos-atendidos/ultimas-24h`
- `GET /metrics/casos-atendidos/ultimas-48h`
- `GET /metrics/casos-atendidos/ultimos-7-dias`
- `GET /metrics/casos-abiertos/ultimas-24h?team_uuid=&agent_email=`
- `GET /metrics/casos-abiertos/ultimas-48h?team_uuid=&agent_email=`
- `GET /metrics/casos-abiertos/ultimos-7-dias?team_uuid=&agent_email=`
- `GET /metrics/tiempo-primera-respuesta/ultimas-24h?team_uuid=&agent_email=`
- `GET /metrics/tiempo-primera-respuesta/ultimas-48h?team_uuid=&agent_email=`
- `GET /metrics/tiempo-primera-respuesta/ultimos-7-dias?team_uuid=&agent_email=`
- `GET /metrics/casos-resueltos/ultimas-24h?team_uuid=&agent_email=`
- `GET /metrics/casos-resueltos/ultimas-48h?team_uuid=&agent_email=`
- `GET /metrics/casos-resueltos/ultimos-7-dias?team_uuid=&agent_email=`
- `GET /metrics/casos-abandonados-24h/ultimas-24h?team_uuid=&agent_email=&as_of=`
- `GET /metrics/casos-abandonados-24h/ultimas-48h?team_uuid=&agent_email=&as_of=`
- `GET /metrics/casos-abandonados-24h/ultimos-7-dias?team_uuid=&agent_email=&as_of=`
